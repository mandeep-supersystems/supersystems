from flask import Blueprint, request
from extensions import db
import uuid
import json
from datetime import datetime

logistics_bp = Blueprint("logistics", __name__)

_stock_cols_ensured = False

@logistics_bp.before_app_request
def _ensure_cols_once():
    global _stock_cols_ensured
    if not _stock_cols_ensured:
        _stock_cols_ensured = True
        _ensure_stock_location_columns()


def _tid():
    return request.headers.get("X-Tenant-ID", "")

def _user():
    return request.headers.get("X-User-Name", "") or request.headers.get("X-User-Email", "")

def _tid_cond():
    return "(tenant_id = :tid OR tenant_id = '' OR tenant_id IS NULL)"

def _notify(tenant_id, module, event_type, ref_no, ref_id, title, message, role):
    try:
        db.session.execute(db.text(
            "INSERT INTO planning.notifications (id, module, event_type, reference_no, reference_id, "
            "title, message, recipient_role, tenant_id, created_at) "
            "VALUES (:id, :mod, :evt, :ref_no, :ref_id, :title, :msg, :role, :tid, NOW())"
        ), {
            "id": str(uuid.uuid4()),
            "mod": module, "evt": event_type, "ref_no": ref_no,
            "ref_id": str(ref_id) if ref_id else None,
            "title": title, "msg": message, "role": role, "tid": tenant_id
        })
        db.session.commit()
    except Exception:
        db.session.rollback()


def _ensure_stock_location_columns():
    """Add location_code and bin_code tracking columns to inventory_stock_levels if missing."""
    try:
        db.session.execute(db.text(
            "ALTER TABLE inventory_stock_levels "
            "ADD COLUMN IF NOT EXISTS location_code VARCHAR(100) DEFAULT ''"
        ))
        db.session.commit()
    except Exception:
        db.session.rollback()


# ─── GRN LIST ───

@logistics_bp.route("/grn", methods=["GET"])
def list_grn():
    tid = _tid()
    status_filter = request.args.get("status", "").strip()
    extra = ""
    params = {"tid": tid}
    if status_filter:
        if status_filter == "pending_iqc":
            extra = " AND g.grn_status IN ('pending_iqc', 'partially_handed_over')"
        else:
            extra = " AND g.grn_status=:status"
            params["status"] = status_filter

    rows = db.session.execute(db.text(
        "SELECT g.id, g.grn_no, g.po_id, g.item_code, g.item_description, "
        "g.po_qty, g.invoice_qty, g.received_qty, g.invoice_no, g.invoice_amount, "
        "g.supplier_name, g.discrepancy_notes, g.grn_status, g.created_by, g.created_at, "
        "p.doc_no as po_no, "
        "COALESCE(g.batch_no,'') as batch_no, COALESCE(g.supplier_lot,'') as supplier_lot, "
        "COALESCE(g.remarks,'') as remarks, "
        "COALESCE(g.assigned_bin_code,'') as assigned_bin_code, "
        "COALESCE(g.handover_warehouse,'') as handover_warehouse, "
        "COALESCE(g.handover_by,'') as handover_by "
        "FROM procurement.grn g "
        "LEFT JOIN procurement.purchase_orders p ON g.po_id = p.id "
        f"WHERE g.is_deleted=false AND g.grn_no IS NOT NULL AND (g.tenant_id=:tid OR g.tenant_id='' OR g.tenant_id IS NULL){extra} "
        "ORDER BY g.created_at DESC"
    ), params).fetchall()
    return {"success": True, "data": [{
        "id": str(r[0]), "grn_no": r[1] or "", "po_id": str(r[2]) if r[2] else "",
        "item_code": r[3] or "", "item_description": r[4] or "",
        "po_qty": float(r[5] or 0), "invoice_qty": float(r[6] or 0),
        "received_qty": float(r[7] or 0), "invoice_no": r[8] or "",
        "invoice_amount": float(r[9] or 0), "supplier_name": r[10] or "",
        "discrepancy_notes": r[11] or "", "grn_status": r[12] or "pending_iqc",
        "created_by": r[13] or "", "created_at": str(r[14]) if r[14] else None,
        "po_no": r[15] or "", "batch_no": r[16] or "",
        "supplier_lot": r[17] or "", "remarks": r[18] or "",
        "assigned_bin_code": r[19] or "", "handover_warehouse": r[20] or "",
        "handover_by": r[21] or ""
    } for r in rows]}


# ─── CREATE GRN ───

@logistics_bp.route("/grn", methods=["POST"])
def create_grn():
    tid = _tid()
    
    # Handle multipart/form-data (required for file uploads)
    if request.content_type and "multipart/form-data" in request.content_type:
        po_id           = request.form.get("po_id", "").strip()
        invoice_no      = request.form.get("invoice_no", "").strip()
        invoice_amount  = float(request.form.get("invoice_amount", 0))
        batch_no        = request.form.get("batch_no", "").strip()
        supplier_lot    = request.form.get("supplier_lot", "").strip()
        remarks         = request.form.get("remarks", "").strip()
        grn_lines_json  = request.form.get("lines") or "[]"
        
        try:
            physical_checks = json.loads(request.form.get("physical_checks", "{}"))
        except Exception:
            physical_checks = {}
            
        try:
            failed_checks   = json.loads(request.form.get("failed_checks", "[]"))
        except Exception:
            failed_checks   = []

        # Process uploaded file
        invoice_file_path = None
        if 'file' in request.files:
            uploaded = request.files['file']
            if uploaded and uploaded.filename:
                import os
                upload_dir = os.path.join(os.getcwd(), 'static', 'uploads', 'invoices')
                os.makedirs(upload_dir, exist_ok=True)
                saved_name = f"{uuid.uuid4()}_{uploaded.filename}"
                saved_path = os.path.join(upload_dir, saved_name)
                uploaded.save(saved_path)
                invoice_file_path = f"/static/uploads/invoices/{saved_name}"
    else:
        # Fallback to standard JSON
        data = request.get_json() or {}
        po_id           = data.get("po_id", "").strip()
        invoice_no      = data.get("invoice_no", "").strip()
        invoice_amount  = float(data.get("invoice_amount", 0))
        batch_no        = data.get("batch_no", "").strip()
        supplier_lot    = data.get("supplier_lot", "").strip()
        remarks         = data.get("remarks", "").strip()
        physical_checks = data.get("physical_checks", {})
        failed_checks   = data.get("failed_checks", [])
        grn_lines_json  = json.dumps(data.get("lines", []))
        invoice_file_path = None

    if not po_id:
        return {"success": False, "message": "PO ID is required"}, 400

    try:
        lines = json.loads(grn_lines_json)
    except Exception:
        lines = []

    if not lines:
        return {"success": False, "message": "At least one item line must be received"}, 400

    po = db.session.execute(db.text(
        "SELECT doc_no, item_code, item_description, order_qty, supplier_name, po_status, pr_no "
        "FROM procurement.purchase_orders WHERE id=:id"
    ), {"id": po_id}).first()
    if not po:
        return {"success": False, "message": "PO not found"}, 404
    if po[5] not in ("sent_to_supplier", "acknowledged", "partially_received"):
        return {"success": False, "message": f"PO status is '{po[5]}' — cannot create GRN"}, 400

    po_qty = float(po[3] or 0)
    
    # Calculate totals from lines
    received_qty = sum(float(l.get("received_qty") or 0) for l in lines)
    invoice_qty = sum(float(l.get("invoice_qty") or l.get("received_qty") or 0) for l in lines)
    
    # Extract details of the first item for top-level columns fallback
    first_item = lines[0]
    item_code = first_item.get("item_code", po[1])
    item_desc = first_item.get("item_description", po[2])

    # Calculate cumulative received quantity for PO status validation
    past_received = db.session.execute(db.text(
        "SELECT COALESCE(SUM(received_qty), 0) FROM procurement.grn WHERE po_id = :po_id AND grn_status != 'rejected' AND is_deleted = false"
    ), {"po_id": po_id}).scalar() or 0.0
    total_received = past_received + received_qty

    discrepancy = []
    # Check physical count checks
    if failed_checks:
        discrepancy.append(f"Failed checks: {', '.join(failed_checks)}")
        
    # Check individual lines for discrepancy (Physical received vs Pending)
    # Get all past GRNs for this PO to count received quantities per part code
    grns = db.session.execute(db.text(
        "SELECT lines FROM procurement.grn WHERE po_id=:po_id AND grn_status != 'rejected' AND is_deleted=false"
    ), {"po_id": po_id}).fetchall()
    
    received_map = {}
    for g in grns:
        if g[0]:
            try:
                g_lines = json.loads(g[0]) if isinstance(g[0], str) else g[0]
                if not isinstance(g_lines, list):
                    g_lines = [g_lines]
                for gl in g_lines:
                    code = gl.get("item_code")
                    qty = float(gl.get("received_qty") or gl.get("qty") or 0)
                    if code:
                        received_map[code] = received_map.get(code, 0.0) + qty
            except Exception:
                pass

    # Compare lines
    for l in lines:
        code = l.get("item_code")
        rec = float(l.get("received_qty") or 0)
        # Find ordered quantity for this code in PO lines
        po_lines = []
        if po[6]:
            pass # wait, let's load it from the database PO record lines
        
    # For simplicity, if lines mismatch or have discrepancy, report it:
    if received_qty != (po_qty - past_received):
        discrepancy.append(f"Total physical qty ({received_qty}) ≠ Total pending PO qty ({po_qty - past_received})")

    grn_id = str(uuid.uuid4())
    grn_no = f"GRN-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    db.session.execute(db.text(
        "INSERT INTO procurement.grn (id, doc_no, date, grn_no, po_id, item_code, item_description, "
        "po_qty, invoice_qty, received_qty, invoice_no, invoice_amount, supplier_name, "
        "batch_no, supplier_lot, remarks, physical_checks, "
        "discrepancy_notes, grn_status, tenant_id, created_by, created_at, invoice_file_path, lines) "
        "VALUES (:id, :gno, CURRENT_DATE, :gno, :po_id, :code, :desc, :po_qty, :inv_qty, :rec_qty, "
        ":inv_no, :inv_amt, :sname, :batch, :lot, :remarks, CAST(:checks AS jsonb), "
        ":disc, 'pending_iqc', :tid, :by, NOW(), :file_path, CAST(:lines AS jsonb))"
    ), {
        "id": grn_id, "gno": grn_no, "po_id": po_id,
        "code": item_code, "desc": item_desc or "",
        "po_qty": po_qty, "inv_qty": invoice_qty, "rec_qty": received_qty,
        "inv_no": invoice_no, "inv_amt": invoice_amount,
        "sname": po[4], "batch": batch_no, "lot": supplier_lot,
        "remarks": remarks, "checks": json.dumps(physical_checks),
        "disc": "; ".join(discrepancy) if discrepancy else "",
        "tid": tid, "by": _user(), "file_path": invoice_file_path,
        "lines": json.dumps(lines)
    })

    new_po_status = "received" if total_received >= po_qty else "partially_received"
    db.session.execute(db.text(
        "UPDATE procurement.purchase_orders SET po_status=:status, updated_at=NOW() WHERE id=:id"
    ), {"status": new_po_status, "id": po_id})
    db.session.commit()

    disc_msg = f" ⚠ Discrepancy: {'; '.join(discrepancy)}" if discrepancy else " ✓ Quantities match."
    _notify(tid, "Logistics", "GRN_CREATED", grn_no, grn_id,
            f"GRN Created — Awaiting Handover: {grn_no}",
            f"GRN {grn_no} for {po[1]} | Batch: {batch_no} | Received: {received_qty}.{disc_msg} Assign location to hand over to Inventory.",
            "logistics")
    _notify(tid, "Purchase", "GRN_CREATED", grn_no, grn_id,
            f"Goods Received: {grn_no}",
            f"Logistics received goods for PO {po[0]}. GRN: {grn_no}.{disc_msg}",
            "purchaser")
            
    if po[6]:
        # Notify Planning team
        _notify(tid, "Planning", "MATERIAL_ARRIVED", po[6], grn_id,
                f"Material Arrived: {po[1]}",
                f"Material for PR {po[6]} ({received_qty} units of {po[1]}) arrived at store under GRN {grn_no}.",
                "planner")

    return {"success": True, "data": {"id": grn_id, "grn_no": grn_no, "discrepancy": discrepancy},
            "message": f"GRN {grn_no} created. Assign location to hand over to Inventory."}, 201


# ─── GET SINGLE GRN ───

@logistics_bp.route("/grn/<grn_id>", methods=["GET"])
def get_grn(grn_id):
    tid = _tid()
    r = db.session.execute(db.text(
        "SELECT g.id, g.grn_no, g.po_id, g.item_code, g.item_description, "
        "g.po_qty, g.invoice_qty, g.received_qty, g.invoice_no, g.invoice_amount, "
        "g.supplier_name, g.discrepancy_notes, g.grn_status, g.created_by, g.created_at, "
        "p.doc_no as po_no, "
        "COALESCE(g.batch_no,'') as batch_no, COALESCE(g.supplier_lot,'') as supplier_lot, "
        "COALESCE(g.remarks,'') as remarks, "
        "COALESCE(g.physical_checks::text,'{}') as physical_checks, "
        "COALESCE(g.invoice_file_path,'') as invoice_file_path, "
        "g.lines "
        "FROM procurement.grn g "
        "LEFT JOIN procurement.purchase_orders p ON g.po_id = p.id "
        "WHERE g.id=:id AND g.is_deleted=false"
    ), {"id": grn_id}).first()
    if not r:
        return {"success": False, "message": "GRN not found"}, 404
    try:
        checks = json.loads(r[19]) if r[19] else {}
    except Exception:
        checks = {}
    return {"success": True, "data": {
        "id": str(r[0]), "grn_no": r[1] or "", "po_id": str(r[2]) if r[2] else "",
        "item_code": r[3] or "", "item_description": r[4] or "",
        "po_qty": float(r[5] or 0), "invoice_qty": float(r[6] or 0),
        "received_qty": float(r[7] or 0), "invoice_no": r[8] or "",
        "invoice_amount": float(r[9] or 0), "supplier_name": r[10] or "",
        "discrepancy_notes": r[11] or "", "grn_status": r[12] or "pending_iqc",
        "created_by": r[13] or "", "created_at": str(r[14]) if r[14] else None,
        "po_no": r[15] or "", "batch_no": r[16] or "",
        "supplier_lot": r[17] or "", "remarks": r[18] or "",
        "physical_checks": checks,
        "invoice_file_path": r[20] or "",
        "lines": r[21] if r[21] else []
    }}


# ─── HANDOVER GRN TO INVENTORY ───

@logistics_bp.route("/grn/<grn_id>/handover", methods=["POST"])
def handover_grn(grn_id):
    tid = _tid()
    data = request.get_json() or {}
    input_assignments = data.get("assignments", [])
    notes = data.get("notes", "").strip()

    if not input_assignments:
        return {"success": False, "message": "No location assignments provided"}, 400

    grn = db.session.execute(db.text(
        "SELECT g.grn_no, g.item_code, g.item_description, g.received_qty, g.batch_no, "
        "g.supplier_name, g.grn_status, g.invoice_no, g.lines, g.supplier_lot, g.po_id "
        "FROM procurement.grn g WHERE g.id=:id AND g.is_deleted=false"
    ), {"id": grn_id}).first()
    if not grn:
        return {"success": False, "message": "GRN not found"}, 404
    if grn[6] == "handed_over":
        return {"success": False, "message": "GRN already handed over"}, 400

    # Parse received lines
    grn_lines = []
    if grn[8]:
        try:
            grn_lines = json.loads(grn[8]) if isinstance(grn[8], str) else grn[8]
        except Exception:
            grn_lines = []

    if not grn_lines:
        grn_lines = [{
            "item_code": grn[1],
            "item_description": grn[2],
            "received_qty": float(grn[3] or 0),
            "batch_no": grn[4],
            "supplier_lot": grn[9] or ""
        }]

    # Ensure cumulative fields exist
    for line in grn_lines:
        if "handed_over_qty" not in line:
            line["handed_over_qty"] = 0.0
        if "assignments" not in line:
            line["assignments"] = []

    # Validate assignments
    assigned_by_item = {}
    for ass in input_assignments:
        code = ass.get("item_code")
        ass_qty = float(ass.get("qty") or 0)
        if ass_qty <= 0:
            return {"success": False, "message": f"Quantity for item {code} must be greater than 0"}, 400
        assigned_by_item[code] = assigned_by_item.get(code, 0.0) + ass_qty

    for code, ass_qty in assigned_by_item.items():
        line = next((l for l in grn_lines if l.get("item_code") == code), None)
        if not line:
            return {"success": False, "message": f"Item code {code} is not part of this GRN"}, 400
        
        total_rec = float(line.get("received_qty") or 0)
        already_ho = float(line.get("handed_over_qty") or 0)
        if already_ho + ass_qty > total_rec:
            return {"success": False, "message": f"Over-assigning quantity for item {code}. Received: {total_rec}, Handed over: {already_ho}, Assigning: {ass_qty}"}, 400

    # Process inventory updates
    for ass in input_assignments:
        code = ass.get("item_code")
        ass_qty = float(ass.get("qty"))
        loc_id = ass.get("location_id") or None
        loc_code = (ass.get("location_code") or "").strip()
        wh = (ass.get("warehouse_code") or "MAIN").strip()

        # Resolve actual bin_code from inventory_locations by location_code
        loc_row = db.session.execute(db.text(
            "SELECT bin_code FROM inventory_locations WHERE location_code=:lc AND is_deleted=false LIMIT 1"
        ), {"lc": loc_code}).first()
        bin_code = (loc_row[0] or "").strip() if loc_row else (ass.get("bin_code") or "").strip()

        line = next((l for l in grn_lines if l.get("item_code") == code), None)
        desc = line.get("item_description") or ""
        line_batch = line.get("batch_no") or grn[4] or ""
        line_lot = line.get("supplier_lot") or grn[9] or ""

        # Log assignment to grn lines
        line["assignments"].append({
            "location_id": loc_id,
            "location_code": loc_code,
            "bin_code": bin_code,
            "warehouse_code": wh,
            "qty": ass_qty,
            "handover_by": _user(),
            "handover_at": datetime.now().isoformat()
        })
        line["handed_over_qty"] = float(line["handed_over_qty"] or 0) + ass_qty

        # 1. Update inventory stock levels
        bin_cond = "bin_code=:bin" if bin_code else "(bin_code IS NULL OR bin_code='')"
        sql_check = (
            f"SELECT id, qty_on_hand FROM inventory_stock_levels "
            f"WHERE part_number=:code AND warehouse_code=:wh AND {bin_cond} "
            f"AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) AND is_deleted=false"
        )
        params_check = {"code": code, "wh": wh, "tid": tid}
        if bin_code:
            params_check["bin"] = bin_code

        existing = db.session.execute(db.text(sql_check), params_check).first()

        if existing:
            db.session.execute(db.text(
                "UPDATE inventory_stock_levels SET "
                "qty_on_hand=qty_on_hand+:qty, qty_available=qty_available+:qty, "
                "total_value=(qty_on_hand+:qty)*COALESCE(unit_cost,0), "
                "location_code=:loc, bin_code=:bin, last_movement_at=NOW() "
                "WHERE id=:id"
            ), {"qty": ass_qty, "loc": loc_code, "bin": bin_code or None, "id": existing[0]})
        else:
            db.session.execute(db.text(
                "INSERT INTO inventory_stock_levels "
                "(id, part_number, part_description, item_type, warehouse_code, bin_code, "
                "location_code, qty_on_hand, qty_reserved, qty_available, unit, tenant_id, created_at) "
                "VALUES (:id, :code, :desc, 'RM', :wh, :bin, :loc, :qty, 0, :qty, 'pcs', :tid, NOW())"
            ), {
                "id": str(uuid.uuid4()), "code": code, "desc": desc,
                "wh": wh, "bin": bin_code or None, "loc": loc_code, "qty": ass_qty, "tid": tid
            })

        # Update location current_occupancy
        if loc_code:
            db.session.execute(db.text(
                "UPDATE inventory_locations SET current_occupancy=current_occupancy+:qty "
                "WHERE location_code=:lc AND is_deleted=false"
            ), {"qty": ass_qty, "lc": loc_code})

        # 2. Update/insert batch
        if line_batch:
            batch_bin_cond = "bin_code=:bin" if bin_code else "(bin_code IS NULL OR bin_code='')"
            sql_batch = (
                f"SELECT id FROM inventory_batches WHERE batch_no=:batch AND part_number=:code "
                f"AND warehouse_code=:wh AND {batch_bin_cond} "
                f"AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) AND is_deleted=false"
            )
            params_batch = {"batch": line_batch, "code": code, "wh": wh, "tid": tid}
            if bin_code:
                params_batch["bin"] = bin_code

            existing_batch = db.session.execute(db.text(sql_batch), params_batch).first()

            if existing_batch:
                db.session.execute(db.text(
                    "UPDATE inventory_batches SET qty_received=qty_received+:qty, qty_remaining=qty_remaining+:qty, updated_at=NOW() "
                    "WHERE id=:id"
                ), {"qty": ass_qty, "id": existing_batch[0]})
            else:
                db.session.execute(db.text(
                    "INSERT INTO inventory_batches "
                    "(id, batch_no, part_number, supplier_lot, manufacture_date, qty_received, qty_remaining, "
                    "warehouse_code, bin_code, status, is_deleted, tenant_id, created_at, updated_at) "
                    "VALUES (:id, :batch, :code, :lot, CAST(CURRENT_DATE AS text), :qty, :qty, :wh, :bin, 'active', false, :tid, NOW(), NOW())"
                ), {
                    "id": str(uuid.uuid4()), "batch": line_batch, "code": code, "lot": line_lot,
                    "qty": ass_qty, "wh": wh, "bin": bin_code or None, "tid": tid
                })

        # 3. Movement logs
        mov_no = f"MOV-GRN-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        db.session.execute(db.text(
            "INSERT INTO inventory_stock_movements "
            "(id, movement_no, movement_type, part_number, part_description, "
            "to_warehouse_code, to_bin_code, qty, unit, reference_type, reference_no, "
            "reason, performed_by, tenant_id, created_at) "
            "VALUES (:id, :mno, 'RECEIPT', :code, :desc, :wh, :bin, :qty, 'pcs', "
            "'GRN', :grn_no, :reason, :by, :tid, NOW())"
        ), {
            "id": str(uuid.uuid4()), "mno": mov_no, "code": code, "desc": desc,
            "wh": wh, "bin": bin_code if bin_code else None, "qty": ass_qty,
            "grn_no": grn[0], "reason": f"GRN handover to {loc_code or wh}. Batch: {line_batch or '-'}",
            "by": _user(), "tid": tid
        })

        # 4. Check-in record for quality/IQC inspection visibility
        cid = str(uuid.uuid4())
        cno_uniq = f"CHK-{grn[0]}-{code}-{uuid.uuid4().hex[:6].upper()}"
        
        # Resolve PO doc number
        po_doc = db.session.execute(db.text(
            "SELECT doc_no FROM procurement.purchase_orders WHERE id=:po_id"
        ), {"po_id": grn[10]}).scalar() or grn[10] or "PO"

        qr_data = f"QR-{po_doc}|{code}|QTY:{ass_qty}|TIME:{datetime.now().strftime('%Y-%m-%d %H:%M')}"

        db.session.execute(db.text(
            "INSERT INTO inventory_stock_checkins ("
            "id, checkin_no, po_no, supplier_code, supplier_name, part_or_rm_code, "
            "item_description, ordered_qty, received_qty, checked_in_by, checkin_time, "
            "iqc_status, warehouse_code, bin_code, location_code, qr_code_data, tenant_id) "
            "VALUES (:cid, :cno, :po_no, 'SUP-101', :sname, :code, :desc, :oqty, :rqty, :by, "
            "NOW(), 'pending_iqc', :wh, :bin, :loc_code, :qr, :tid)"
        ), {
            "cid": cid, "cno": cno_uniq, "po_no": po_doc, "sname": grn[5], "code": code,
            "desc": desc, "oqty": float(line.get("received_qty") or ass_qty), "rqty": ass_qty,
            "by": _user() or "system", "wh": wh, "bin": bin_code or None, "loc_code": loc_code or None,
            "qr": qr_data, "tid": tid
        })

    # Determine status
    is_fully_handed_over = True
    for l in grn_lines:
        total_rec = float(l.get("received_qty") or 0)
        already_ho = float(l.get("handed_over_qty") or 0)
        if already_ho < total_rec:
            is_fully_handed_over = False
            break

    new_status = "handed_over" if is_fully_handed_over else "partially_handed_over"

    # Save to GRN — cast location_id only when it is a valid UUID
    first_ass = input_assignments[0]
    raw_loc_id = first_ass.get("location_id") or ""
    try:
        import uuid as _uuid
        safe_loc_id = str(_uuid.UUID(str(raw_loc_id))) if raw_loc_id else None
    except (ValueError, AttributeError):
        safe_loc_id = None

    db.session.execute(db.text(
        "UPDATE procurement.grn SET grn_status=:status, "
        "assigned_bin_code=:bin, assigned_location_id=:loc_id, "
        "assigned_location_code=:loc_code, handover_warehouse=:wh, "
        "handover_notes=:notes, handover_by=:by, handover_at=NOW(), "
        "lines=CAST(:lines_json AS jsonb), updated_at=NOW() WHERE id=:id"
    ), {
        "status": new_status,
        "bin": first_ass.get("bin_code") or "",
        "loc_id": safe_loc_id,
        "loc_code": first_ass.get("location_code") or "",
        "wh": first_ass.get("warehouse_code") or "MAIN",
        "notes": notes, "by": _user(), "lines_json": json.dumps(grn_lines), "id": grn_id
    })

    db.session.commit()

    # Notifications
    _notify(tid, "Quality", "GRN_HANDOVER", grn[0], grn_id,
            f"IQC Required: {grn[0]}",
            f"Logistics handed over {grn[0]} to Inventory ({len(grn_lines)} items). Please inspect.",
            "iqc")
    _notify(tid, "Inventory", "GRN_HANDOVER", grn[0], grn_id,
            f"Stock Received: {grn[0]}",
            f"GRN {grn[0]} handed over. {len(grn_lines)} items placed at locations.",
            "inventory")

    return {"success": True, "message": f"GRN {grn[0]} handover registered successfully."}


# ─── POs available for GRN ───

@logistics_bp.route("/pending-pos", methods=["GET"])
def pending_pos():
    tid = _tid()
    rows = db.session.execute(db.text(
        "SELECT po.id, po.doc_no, po.item_code, po.item_description, po.order_qty, po.supplier_name, "
        "po.promised_date, po.po_status, "
        "COALESCE((SELECT SUM(g.received_qty) FROM procurement.grn g WHERE g.po_id = po.id AND g.is_deleted = false), 0) AS received_qty, "
        "po.unit_price, po.total_amount "
        "FROM procurement.purchase_orders po "
        "WHERE po.po_status IN ('sent_to_supplier','acknowledged','partially_received') "
        "AND po.is_deleted=false AND (po.tenant_id=:tid OR po.tenant_id='' OR po.tenant_id IS NULL) "
        "ORDER BY po.created_at DESC"
    ), {"tid": tid}).fetchall()
    return {"success": True, "data": [{
        "id": str(r[0]), "po_no": r[1], "item_code": r[2] or "",
        "item_description": r[3] or "", "order_qty": float(r[4] or 0),
        "supplier_name": r[5] or "", "promised_date": str(r[6]) if r[6] else "",
        "po_status": r[7] or "", "received_qty": float(r[8] or 0),
        "pending_qty": float(r[4] or 0) - float(r[8] or 0),
        "unit_price": float(r[9] or 0),
        "total_amount": float(r[10] or 0)
    } for r in rows]}


# ─── PO DETAILS WITH LINES ───

@logistics_bp.route("/po/<po_id>", methods=["GET"])
def get_po_details(po_id):
    tid = _tid()
    po = db.session.execute(db.text(
        "SELECT po.id, po.doc_no, po.item_code, po.item_description, po.order_qty, po.unit_price, po.total_amount, po.supplier_name, "
        "po.promised_date, po.po_status, po.lines "
        "FROM procurement.purchase_orders po "
        "WHERE po.id=:id AND (po.tenant_id=:tid OR po.tenant_id='' OR po.tenant_id IS NULL) AND po.is_deleted=false"
    ), {"id": po_id, "tid": tid}).first()
    
    if not po:
        return {"success": False, "message": "PO not found"}, 404
        
    # Get all past GRNs for this PO to count received quantities per part code
    grns = db.session.execute(db.text(
        "SELECT lines FROM procurement.grn "
        "WHERE po_id=:po_id AND grn_status != 'rejected' AND is_deleted=false"
    ), {"po_id": po_id}).fetchall()
    
    received_map = {}
    for g in grns:
        if g[0]:
            try:
                g_lines = json.loads(g[0]) if isinstance(g[0], str) else g[0]
                if not isinstance(g_lines, list):
                    g_lines = [g_lines]
                for gl in g_lines:
                    code = gl.get("item_code")
                    qty = float(gl.get("received_qty") or gl.get("qty") or 0)
                    if code:
                        received_map[code] = received_map.get(code, 0.0) + qty
            except Exception:
                pass
                
    po_lines = []
    if po[10]:
        try:
            po_lines = json.loads(po[10]) if isinstance(po[10], str) else po[10]
            if not isinstance(po_lines, list):
                po_lines = [po_lines]
        except Exception:
            po_lines = []
            
    if not po_lines:
        po_lines = [{
            "item_code": po[2],
            "item_description": po[3],
            "order_qty": float(po[4] or 0),
            "unit_price": float(po[5] or 0),
            "uom": "pcs",
            "aml": []
        }]
        
    # Inject received and pending quantities for each line
    for pl in po_lines:
        code = pl.get("item_code")
        ord_qty = float(pl.get("order_qty") or 0)
        rec_qty = received_map.get(code, 0.0)
        pl["received_qty"] = rec_qty
        pl["pending_qty"] = max(0.0, ord_qty - rec_qty)
        pl["unit_price"] = float(pl.get("unit_price") or 0)
        pl["item_description"] = pl.get("item_description") or ""
        
    return {
        "success": True,
        "data": {
            "id": str(po[0]),
            "po_no": po[1],
            "item_code": po[2] or "",
            "item_description": po[3] or "",
            "order_qty": float(po[4] or 0),
            "unit_price": float(po[5] or 0),
            "total_amount": float(po[6] or 0),
            "supplier_name": po[7] or "",
            "promised_date": str(po[8]) if po[8] else "",
            "po_status": po[9] or "",
            "lines": po_lines
        }
    }


# ─── OVERVIEW ───

@logistics_bp.route("/overview", methods=["GET"])
def overview():
    tid = _tid()
    try:
        pending_pos_count = db.session.execute(db.text(
            "SELECT COUNT(*) FROM procurement.purchase_orders "
            "WHERE po_status IN ('sent_to_supplier','acknowledged') "
            "AND is_deleted=false AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL)"
        ), {"tid": tid}).scalar() or 0

        total_grn = db.session.execute(db.text(
            "SELECT COUNT(*) FROM procurement.grn "
            "WHERE is_deleted=false AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL)"
        ), {"tid": tid}).scalar() or 0

        pending_handover = db.session.execute(db.text(
            "SELECT COUNT(*) FROM procurement.grn "
            "WHERE grn_status='pending_iqc' AND is_deleted=false "
            "AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL)"
        ), {"tid": tid}).scalar() or 0

        handed_over = db.session.execute(db.text(
            "SELECT COUNT(*) FROM procurement.grn "
            "WHERE grn_status='handed_over' AND is_deleted=false "
            "AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL)"
        ), {"tid": tid}).scalar() or 0

        return {"success": True, "data": {
            "pending_pos_to_receive": pending_pos_count,
            "total_grns": total_grn,
            "pending_handover": pending_handover,
            "handed_over": handed_over
        }}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e)}, 500


# ═══════════════════════════════════════════════════════════════════════════════
# OUTBOUND SHIPMENTS — Dispatch to Plant / Customer
# Flow: Quality OK stock → Inventory → Logistics Outbound → Customer
# ═══════════════════════════════════════════════════════════════════════════════

def _ensure_shipment_tables():
    """Create logistics.shipments tables if not yet migrated."""
    try:
        db.session.execute(db.text("SELECT 1 FROM logistics.shipments LIMIT 1"))
    except Exception:
        db.session.rollback()
        try:
            db.session.execute(db.text("CREATE SCHEMA IF NOT EXISTS logistics"))
            db.session.execute(db.text("""
                CREATE TABLE IF NOT EXISTS logistics.shipments (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    shipment_no TEXT NOT NULL,
                    shipment_date DATE NOT NULL DEFAULT CURRENT_DATE,
                    customer_name TEXT NOT NULL,
                    customer_po_no TEXT NOT NULL,
                    customer_invoice_no TEXT,
                    customer_invoice_amount NUMERIC(18,4) DEFAULT 0,
                    selling_price_total NUMERIC(18,4) DEFAULT 0,
                    cost_price_total NUMERIC(18,4) DEFAULT 0,
                    gross_profit NUMERIC(18,4) DEFAULT 0,
                    transport_mode TEXT DEFAULT 'Road',
                    transporter_name TEXT,
                    lr_no TEXT,
                    vehicle_no TEXT,
                    dispatch_from TEXT DEFAULT 'MAIN',
                    status TEXT DEFAULT 'draft',
                    po_verified BOOLEAN DEFAULT FALSE,
                    invoice_verified BOOLEAN DEFAULT FALSE,
                    discrepancy_notes TEXT,
                    remarks TEXT,
                    created_by TEXT,
                    tenant_id TEXT,
                    is_deleted BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            db.session.execute(db.text("""
                CREATE TABLE IF NOT EXISTS logistics.shipment_lines (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    shipment_id UUID NOT NULL,
                    part_number TEXT NOT NULL,
                    part_description TEXT,
                    warehouse_code TEXT DEFAULT 'MAIN',
                    bin_code TEXT,
                    qty_dispatched NUMERIC(18,4) NOT NULL,
                    unit TEXT DEFAULT 'pcs',
                    unit_cost NUMERIC(18,4) DEFAULT 0,
                    unit_selling NUMERIC(18,4) DEFAULT 0,
                    total_cost NUMERIC(18,4) DEFAULT 0,
                    total_selling NUMERIC(18,4) DEFAULT 0,
                    profit NUMERIC(18,4) DEFAULT 0,
                    customer_po_no TEXT,
                    customer_po_qty NUMERIC(18,4) DEFAULT 0,
                    tenant_id TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            db.session.execute(db.text("""
                CREATE TABLE IF NOT EXISTS logistics.stock_dispatch_log (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    shipment_id UUID NOT NULL,
                    shipment_no TEXT NOT NULL,
                    part_number TEXT NOT NULL,
                    warehouse_code TEXT,
                    qty_before NUMERIC(18,4),
                    qty_dispatched NUMERIC(18,4),
                    qty_after NUMERIC(18,4),
                    dispatched_by TEXT,
                    tenant_id TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            db.session.commit()
        except Exception:
            db.session.rollback()


_shipment_tables_ensured = False

@logistics_bp.before_app_request
def _ensure_shipment_tables_once():
    global _shipment_tables_ensured
    if not _shipment_tables_ensured:
        _shipment_tables_ensured = True
        _ensure_shipment_tables()


# ─── LIST SHIPMENTS ───

@logistics_bp.route("/shipments", methods=["GET"])
def list_shipments():
    tid = _tid()
    status = request.args.get("status", "").strip()
    customer = request.args.get("customer", "").strip()
    params = {"tid": tid}
    where = "(tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) AND is_deleted=false"
    if status:
        where += " AND status=:status"
        params["status"] = status
    if customer:
        where += " AND customer_name ILIKE :cust"
        params["cust"] = f"%{customer}%"
    try:
        rows = db.session.execute(db.text(
            f"SELECT id, shipment_no, shipment_date, customer_name, customer_po_no, "
            f"customer_invoice_no, customer_invoice_amount, selling_price_total, "
            f"cost_price_total, gross_profit, transport_mode, transporter_name, "
            f"lr_no, vehicle_no, dispatch_from, status, po_verified, invoice_verified, "
            f"discrepancy_notes, remarks, created_by, created_at "
            f"FROM logistics.shipments WHERE {where} ORDER BY created_at DESC"
        ), params).fetchall()
        return {"success": True, "data": [_ship_row(r) for r in rows]}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e)}, 500


def _ship_row(r):
    return {
        "id": str(r[0]), "shipment_no": r[1], "shipment_date": str(r[2]) if r[2] else "",
        "customer_name": r[3], "customer_po_no": r[4],
        "customer_invoice_no": r[5] or "", "customer_invoice_amount": float(r[6] or 0),
        "selling_price_total": float(r[7] or 0), "cost_price_total": float(r[8] or 0),
        "gross_profit": float(r[9] or 0), "transport_mode": r[10] or "Road",
        "transporter_name": r[11] or "", "lr_no": r[12] or "", "vehicle_no": r[13] or "",
        "dispatch_from": r[14] or "MAIN", "status": r[15] or "draft",
        "po_verified": r[16] or False, "invoice_verified": r[17] or False,
        "discrepancy_notes": r[18] or "", "remarks": r[19] or "",
        "created_by": r[20] or "", "created_at": str(r[21]) if r[21] else None
    }


# ─── GET SINGLE SHIPMENT WITH LINES ───

@logistics_bp.route("/shipments/<ship_id>", methods=["GET"])
def get_shipment(ship_id):
    tid = _tid()
    try:
        r = db.session.execute(db.text(
            "SELECT id, shipment_no, shipment_date, customer_name, customer_po_no, "
            "customer_invoice_no, customer_invoice_amount, selling_price_total, "
            "cost_price_total, gross_profit, transport_mode, transporter_name, "
            "lr_no, vehicle_no, dispatch_from, status, po_verified, invoice_verified, "
            "discrepancy_notes, remarks, created_by, created_at "
            "FROM logistics.shipments WHERE id=:id AND is_deleted=false"
        ), {"id": ship_id}).first()
        if not r:
            return {"success": False, "message": "Shipment not found"}, 404

        lines = db.session.execute(db.text(
            "SELECT id, part_number, part_description, warehouse_code, bin_code, "
            "qty_dispatched, unit, unit_cost, unit_selling, total_cost, total_selling, "
            "profit, customer_po_no, customer_po_qty "
            "FROM logistics.shipment_lines WHERE shipment_id=:sid ORDER BY created_at"
        ), {"sid": ship_id}).fetchall()

        dispatch_log = db.session.execute(db.text(
            "SELECT part_number, warehouse_code, qty_before, qty_dispatched, qty_after, "
            "dispatched_by, created_at FROM logistics.stock_dispatch_log "
            "WHERE shipment_id=:sid ORDER BY created_at"
        ), {"sid": ship_id}).fetchall()

        return {"success": True, "data": {
            **_ship_row(r),
            "lines": [{
                "id": str(l[0]), "part_number": l[1], "part_description": l[2] or "",
                "warehouse_code": l[3] or "MAIN", "bin_code": l[4] or "",
                "qty_dispatched": float(l[5] or 0), "unit": l[6] or "pcs",
                "unit_cost": float(l[7] or 0), "unit_selling": float(l[8] or 0),
                "total_cost": float(l[9] or 0), "total_selling": float(l[10] or 0),
                "profit": float(l[11] or 0), "customer_po_no": l[12] or "",
                "customer_po_qty": float(l[13] or 0)
            } for l in lines],
            "dispatch_log": [{
                "part_number": d[0], "warehouse_code": d[1] or "",
                "qty_before": float(d[2] or 0), "qty_dispatched": float(d[3] or 0),
                "qty_after": float(d[4] or 0), "dispatched_by": d[5] or "",
                "created_at": str(d[6]) if d[6] else None
            } for d in dispatch_log]
        }}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e)}, 500


# ─── CREATE SHIPMENT (DRAFT) ───

@logistics_bp.route("/shipments", methods=["POST"])
def create_shipment():
    """
    Create outbound shipment. Cross-checks customer PO qty vs dispatch qty.
    Lines: [{part_number, qty_dispatched, unit_selling, warehouse_code, bin_code,
              customer_po_no, customer_po_qty, part_description}]
    """
    tid = _tid()
    data = request.get_json() or {}

    customer_name  = (data.get("customer_name") or "").strip()
    customer_po_no = (data.get("customer_po_no") or "").strip()
    lines          = data.get("lines", [])

    if not customer_name or not customer_po_no:
        return {"success": False, "message": "customer_name and customer_po_no are required"}, 400
    if not lines:
        return {"success": False, "message": "At least one line item required"}, 400

    ship_id = str(uuid.uuid4())
    ship_no = f"SHP-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    discrepancies = []
    total_cost = total_selling = 0.0

    for line in lines:
        pn       = (line.get("part_number") or "").strip()
        qty_disp = float(line.get("qty_dispatched") or 0)
        cpo_qty  = float(line.get("customer_po_qty") or 0)
        if not pn or qty_disp <= 0:
            continue

        # Cross-check: dispatch qty vs customer PO qty
        if cpo_qty > 0 and qty_disp > cpo_qty:
            discrepancies.append(
                f"{pn}: dispatching {qty_disp} but customer PO qty is {cpo_qty}"
            )

        # Get cost price from inventory
        inv = db.session.execute(db.text(
            "SELECT unit_cost FROM inventory_stock_levels "
            "WHERE part_number=:pn AND is_deleted=false "
            "AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) LIMIT 1"
        ), {"pn": pn, "tid": tid}).first()
        unit_cost    = float(inv[0] or 0) if inv else 0.0
        unit_selling = float(line.get("unit_selling") or 0)
        t_cost       = round(unit_cost * qty_disp, 4)
        t_sell       = round(unit_selling * qty_disp, 4)
        total_cost   += t_cost
        total_selling += t_sell

        db.session.execute(db.text(
            "INSERT INTO logistics.shipment_lines "
            "(id, shipment_id, part_number, part_description, warehouse_code, bin_code, "
            "qty_dispatched, unit, unit_cost, unit_selling, total_cost, total_selling, "
            "profit, customer_po_no, customer_po_qty, tenant_id) "
            "VALUES (:id, :sid, :pn, :desc, :wh, :bin, :qty, :unit, :cost, :sell, "
            ":tcost, :tsell, :profit, :cpo, :cpoqty, :tid)"
        ), {
            "id": str(uuid.uuid4()), "sid": ship_id, "pn": pn,
            "desc": line.get("part_description") or "",
            "wh": line.get("warehouse_code") or "MAIN",
            "bin": line.get("bin_code") or "",
            "qty": qty_disp, "unit": line.get("unit") or "pcs",
            "cost": unit_cost, "sell": unit_selling,
            "tcost": t_cost, "tsell": t_sell,
            "profit": round(t_sell - t_cost, 4),
            "cpo": line.get("customer_po_no") or customer_po_no,
            "cpoqty": cpo_qty, "tid": tid
        })

    gross_profit = round(total_selling - total_cost, 4)

    db.session.execute(db.text(
        "INSERT INTO logistics.shipments "
        "(id, shipment_no, shipment_date, customer_name, customer_po_no, "
        "customer_invoice_no, customer_invoice_amount, selling_price_total, "
        "cost_price_total, gross_profit, transport_mode, transporter_name, "
        "lr_no, vehicle_no, dispatch_from, status, po_verified, invoice_verified, "
        "discrepancy_notes, remarks, created_by, tenant_id) "
        "VALUES (:id, :sno, CURRENT_DATE, :cust, :cpo, :inv_no, :inv_amt, "
        ":sell, :cost, :profit, :tmode, :tname, :lr, :veh, :from_wh, "
        "'draft', :po_ok, :inv_ok, :disc, :rem, :by, :tid)"
    ), {
        "id": ship_id, "sno": ship_no,
        "cust": customer_name, "cpo": customer_po_no,
        "inv_no": data.get("customer_invoice_no") or "",
        "inv_amt": float(data.get("customer_invoice_amount") or 0),
        "sell": round(total_selling, 4), "cost": round(total_cost, 4),
        "profit": gross_profit,
        "tmode": data.get("transport_mode") or "Road",
        "tname": data.get("transporter_name") or "",
        "lr": data.get("lr_no") or "", "veh": data.get("vehicle_no") or "",
        "from_wh": data.get("dispatch_from") or "MAIN",
        "po_ok": len(discrepancies) == 0,
        "inv_ok": bool(data.get("customer_invoice_no")),
        "disc": "; ".join(discrepancies) if discrepancies else "",
        "rem": data.get("remarks") or "",
        "by": _user(), "tid": tid
    })
    db.session.commit()

    return {"success": True, "data": {
        "id": ship_id, "shipment_no": ship_no,
        "gross_profit": gross_profit,
        "discrepancies": discrepancies,
        "po_verified": len(discrepancies) == 0
    }, "message": f"Shipment {ship_no} created."
               + (f" ⚠ {len(discrepancies)} discrepancy(ies) found." if discrepancies else " ✓ PO quantities match.")
    }, 201


# ─── DISPATCH SHIPMENT (deduct stock) ───

@logistics_bp.route("/shipments/<ship_id>/dispatch", methods=["POST"])
def dispatch_shipment(ship_id):
    """
    Mark shipment as dispatched. Deducts stock from inventory_stock_levels
    and logs qty_before / qty_after in stock_dispatch_log.
    """
    tid = _tid()
    try:
        ship = db.session.execute(db.text(
            "SELECT shipment_no, status, customer_name, customer_po_no "
            "FROM logistics.shipments WHERE id=:id AND is_deleted=false"
        ), {"id": ship_id}).first()
        if not ship:
            return {"success": False, "message": "Shipment not found"}, 404
        if ship[1] == "dispatched":
            return {"success": False, "message": "Already dispatched"}, 400
        if ship[1] == "cancelled":
            return {"success": False, "message": "Shipment is cancelled"}, 400

        lines = db.session.execute(db.text(
            "SELECT part_number, warehouse_code, bin_code, qty_dispatched "
            "FROM logistics.shipment_lines WHERE shipment_id=:sid"
        ), {"sid": ship_id}).fetchall()

        for line in lines:
            pn, wh, bin_c, qty = line[0], line[1] or "MAIN", line[2] or "", float(line[3] or 0)
            if qty <= 0:
                continue

            # Get current stock
            bin_cond = "bin_code=:bin" if bin_c else "(bin_code IS NULL OR bin_code='')"
            params = {"pn": pn, "wh": wh, "tid": tid}
            if bin_c:
                params["bin"] = bin_c

            stock = db.session.execute(db.text(
                f"SELECT id, qty_on_hand, qty_available FROM inventory_stock_levels "
                f"WHERE part_number=:pn AND warehouse_code=:wh AND {bin_cond} "
                f"AND is_deleted=false "
                f"AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) LIMIT 1"
            ), params).first()

            qty_before = float(stock[1] or 0) if stock else 0.0
            qty_after  = max(0.0, qty_before - qty)

            if stock:
                db.session.execute(db.text(
                    "UPDATE inventory_stock_levels SET "
                    "qty_on_hand=:qa, qty_available=GREATEST(0, qty_available-:qty), "
                    "total_value=:qa*COALESCE(unit_cost,0), last_movement_at=NOW() "
                    "WHERE id=:id"
                ), {"qa": qty_after, "qty": qty, "id": stock[0]})

            # Log dispatch
            db.session.execute(db.text(
                "INSERT INTO logistics.stock_dispatch_log "
                "(id, shipment_id, shipment_no, part_number, warehouse_code, "
                "qty_before, qty_dispatched, qty_after, dispatched_by, tenant_id) "
                "VALUES (:id, :sid, :sno, :pn, :wh, :qb, :qd, :qa, :by, :tid)"
            ), {
                "id": str(uuid.uuid4()), "sid": ship_id, "sno": ship[0],
                "pn": pn, "wh": wh, "qb": qty_before, "qd": qty, "qa": qty_after,
                "by": _user(), "tid": tid
            })

            # Stock movement record
            db.session.execute(db.text(
                "INSERT INTO inventory_stock_movements "
                "(id, movement_no, movement_type, part_number, "
                "from_warehouse_code, from_bin_code, qty, unit, "
                "reference_type, reference_no, reason, performed_by, tenant_id, created_at) "
                "VALUES (:id, :mno, 'DISPATCH', :pn, :wh, :bin, :qty, 'pcs', "
                "'SHIPMENT', :sno, :reason, :by, :tid, NOW())"
            ), {
                "id": str(uuid.uuid4()),
                "mno": f"DSP-{ship[0]}-{pn[:8]}",
                "pn": pn, "wh": wh, "bin": bin_c or None, "qty": qty,
                "sno": ship[0],
                "reason": f"Dispatched to {ship[2]} against PO {ship[3]}",
                "by": _user(), "tid": tid
            })

        db.session.execute(db.text(
            "UPDATE logistics.shipments SET status='dispatched', updated_at=NOW() WHERE id=:id"
        ), {"id": ship_id})
        db.session.commit()

        _notify(tid, "Logistics", "SHIPMENT_DISPATCHED", ship[0], ship_id,
                f"Shipment Dispatched: {ship[0]}",
                f"Shipment {ship[0]} dispatched to {ship[2]} (PO: {ship[3]}). Stock deducted.",
                "logistics")

        return {"success": True, "message": f"Shipment {ship[0]} dispatched. Stock updated."}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e)}, 500


# ─── STOCK AVAILABILITY CHECK (before creating shipment) ───

@logistics_bp.route("/shipments/stock-check", methods=["POST"])
def shipment_stock_check():
    """Check available stock for each part before creating a shipment."""
    tid = _tid()
    data = request.get_json() or {}
    lines = data.get("lines", [])
    result = []
    for line in lines:
        pn  = (line.get("part_number") or "").strip()
        qty = float(line.get("qty_dispatched") or 0)
        if not pn:
            continue
        stock = db.session.execute(db.text(
            "SELECT COALESCE(SUM(qty_available), 0) FROM inventory_stock_levels "
            "WHERE part_number=:pn AND is_deleted=false "
            "AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL)"
        ), {"pn": pn, "tid": tid}).scalar() or 0.0
        result.append({
            "part_number": pn,
            "qty_requested": qty,
            "qty_available": float(stock),
            "sufficient": float(stock) >= qty,
            "shortage": max(0.0, qty - float(stock))
        })
    return {"success": True, "data": result}


# ─── SENT VS REMAINING per part ───

@logistics_bp.route("/shipments/part-summary/<part_number>", methods=["GET"])
def part_shipment_summary(part_number):
    """How many units of a part were dispatched vs remaining in stock."""
    tid = _tid()
    try:
        total_dispatched = db.session.execute(db.text(
            "SELECT COALESCE(SUM(qty_dispatched), 0) FROM logistics.stock_dispatch_log "
            "WHERE part_number=:pn AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL)"
        ), {"pn": part_number, "tid": tid}).scalar() or 0.0

        current_stock = db.session.execute(db.text(
            "SELECT COALESCE(SUM(qty_available), 0) FROM inventory_stock_levels "
            "WHERE part_number=:pn AND is_deleted=false "
            "AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL)"
        ), {"pn": part_number, "tid": tid}).scalar() or 0.0

        shipment_history = db.session.execute(db.text(
            "SELECT s.shipment_no, s.shipment_date, s.customer_name, s.customer_po_no, "
            "sl.qty_dispatched, sl.unit_selling, sl.total_selling, sl.total_cost, sl.profit, s.status "
            "FROM logistics.shipment_lines sl "
            "JOIN logistics.shipments s ON s.id=sl.shipment_id "
            "WHERE sl.part_number=:pn AND s.is_deleted=false "
            "AND (s.tenant_id=:tid OR s.tenant_id='' OR s.tenant_id IS NULL) "
            "ORDER BY s.created_at DESC"
        ), {"pn": part_number, "tid": tid}).fetchall()

        return {"success": True, "data": {
            "part_number": part_number,
            "total_dispatched": float(total_dispatched),
            "current_stock": float(current_stock),
            "shipment_history": [{
                "shipment_no": h[0], "shipment_date": str(h[1]) if h[1] else "",
                "customer_name": h[2], "customer_po_no": h[3],
                "qty_dispatched": float(h[4] or 0),
                "unit_selling": float(h[5] or 0),
                "total_selling": float(h[6] or 0),
                "total_cost": float(h[7] or 0),
                "profit": float(h[8] or 0),
                "status": h[9] or ""
            } for h in shipment_history]
        }}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e)}, 500


# ─── CUSTOMER PO SUMMARY (all shipments against a customer PO) ───

@logistics_bp.route("/customer-po/<customer_po_no>", methods=["GET"])
def customer_po_summary(customer_po_no):
    """Full summary of a customer PO — what was shipped, invoice, P&L."""
    tid = _tid()
    try:
        shipments = db.session.execute(db.text(
            "SELECT id, shipment_no, shipment_date, customer_name, status, "
            "selling_price_total, cost_price_total, gross_profit, "
            "customer_invoice_no, customer_invoice_amount, po_verified, invoice_verified "
            "FROM logistics.shipments "
            "WHERE customer_po_no=:cpo AND is_deleted=false "
            "AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) "
            "ORDER BY created_at"
        ), {"cpo": customer_po_no, "tid": tid}).fetchall()

        lines = db.session.execute(db.text(
            "SELECT sl.part_number, sl.part_description, "
            "SUM(sl.qty_dispatched), SUM(sl.total_cost), SUM(sl.total_selling), SUM(sl.profit), "
            "sl.customer_po_qty "
            "FROM logistics.shipment_lines sl "
            "JOIN logistics.shipments s ON s.id=sl.shipment_id "
            "WHERE sl.customer_po_no=:cpo AND s.is_deleted=false "
            "AND (s.tenant_id=:tid OR s.tenant_id='' OR s.tenant_id IS NULL) "
            "GROUP BY sl.part_number, sl.part_description, sl.customer_po_qty"
        ), {"cpo": customer_po_no, "tid": tid}).fetchall()

        total_sell  = sum(float(s[5] or 0) for s in shipments)
        total_cost  = sum(float(s[6] or 0) for s in shipments)
        total_profit = sum(float(s[7] or 0) for s in shipments)

        return {"success": True, "data": {
            "customer_po_no": customer_po_no,
            "total_selling": round(total_sell, 4),
            "total_cost": round(total_cost, 4),
            "gross_profit": round(total_profit, 4),
            "margin_pct": round((total_profit / total_sell * 100) if total_sell else 0, 2),
            "shipments": [{
                "id": str(s[0]), "shipment_no": s[1],
                "shipment_date": str(s[2]) if s[2] else "",
                "customer_name": s[3], "status": s[4],
                "selling_price_total": float(s[5] or 0),
                "cost_price_total": float(s[6] or 0),
                "gross_profit": float(s[7] or 0),
                "customer_invoice_no": s[8] or "",
                "customer_invoice_amount": float(s[9] or 0),
                "po_verified": s[10] or False,
                "invoice_verified": s[11] or False
            } for s in shipments],
            "part_summary": [{
                "part_number": l[0], "part_description": l[1] or "",
                "total_dispatched": float(l[2] or 0),
                "total_cost": float(l[3] or 0),
                "total_selling": float(l[4] or 0),
                "profit": float(l[5] or 0),
                "customer_po_qty": float(l[6] or 0)
            } for l in lines]
        }}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e)}, 500
