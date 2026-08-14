import uuid
import base64
import io
from datetime import datetime
from flask import Blueprint, request, jsonify, render_template
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from extensions import db

warehouse_bp = Blueprint("warehouse", __name__)


def _get_tenant():
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if isinstance(identity, dict):
            return identity.get("tenant_id", "TEST")
        elif isinstance(identity, str):
            import json
            try:
                data = json.loads(identity)
                return data.get("tenant_id", "TEST")
            except Exception:
                pass
    except Exception:
        pass
    return "TEST"


def _generate_qr_base64(data_str):
    try:
        import qrcode
        qr = qrcode.QRCode(version=1, box_size=8, border=2)
        qr.add_data(data_str)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        return f"data:image/png;base64,{base64.b64encode(buffered.getvalue()).decode()}"
    except Exception:
        # Fallback SVG base64 or placeholder
        encoded_data = base64.b64encode(f"QR-{data_str}".encode()).decode()
        return f"data:image/svg+xml;base64,{base64.b64encode(f'<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"120\" height=\"120\"><rect width=\"120\" height=\"120\" fill=\"#f0f0f0\"/><text x=\"60\" y=\"60\" font-size=\"12\" text-anchor=\"middle\">{data_str}</text></svg>'.encode()).decode()}"


@warehouse_bp.route("/overview-stats", methods=["GET"])
def overview_stats():
    tenant_id = _get_tenant()
    tid_cond = "(tenant_id = :tid OR tenant_id = 'TEST' OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = '' OR tenant_id IS NULL)"
    try:
        rows = db.session.execute(db.text(
            f"SELECT COUNT(*) as total, "
            f"SUM(CASE WHEN current_units = 0 THEN 1 ELSE 0 END) as empty, "
            f"SUM(CASE WHEN current_units >= capacity_units AND capacity_units > 0 THEN 1 ELSE 0 END) as filled, "
            f"SUM(CASE WHEN current_units > 0 AND current_units < capacity_units THEN 1 ELSE 0 END) as partial, "
            f"SUM(CASE WHEN is_deleted = true THEN 1 ELSE 0 END) as trashed "
            f"FROM warehouse_bins WHERE {tid_cond}"
        ), {"tid": tenant_id}).first()
        return jsonify({"success": True, "data": {
            "total_bins": int(rows[0] or 0),
            "empty": int(rows[1] or 0),
            "filled": int(rows[2] or 0),
            "partial": int(rows[3] or 0),
            "trashed": int(rows[4] or 0)
        }})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


# 2. BIN MANAGEMENT & QR CODES
@warehouse_bp.route("/bins", methods=["GET"])
def list_bins():
    tenant_id = _get_tenant()
    tid_cond = "(tenant_id = :tid OR tenant_id = 'TEST' OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = '' OR tenant_id IS NULL)"
    status = request.args.get("status", "").strip()
    search = request.args.get("search", "").strip()

    where = f"WHERE is_deleted = false AND {tid_cond}"
    params = {"tid": tenant_id}
    if status:
        where += " AND status = :status"
        params["status"] = status
    if search:
        where += " AND (bin_code ILIKE :s OR location_code ILIKE :s OR bin_type ILIKE :s)"
        params["s"] = f"%{search}%"

    rows = db.session.execute(db.text(
        f"SELECT id, bin_code, location_code, warehouse_code, aisle, rack, level, capacity_units, current_units, status, bin_type, bin_color FROM warehouse_bins {where} ORDER BY bin_code ASC"
    ), params).fetchall()

    bins = [{
        "id": r[0], "bin_code": r[1], "location_code": r[2] or "",
        "warehouse_code": r[3] or "MAIN",
        "aisle": r[4] or "", "rack": r[5] or "", "level": r[6] or "",
        "capacity_units": int(r[7] or 500), "current_units": int(r[8] or 0),
        "status": r[9] or "active", "bin_type": r[10] or "medium",
        "bin_color": r[11] or ""
    } for r in rows]
    return jsonify({"success": True, "data": bins})


@warehouse_bp.route("/bins", methods=["POST"])
def create_bin():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    bcode = data.get("bin_code")
    location_code = data.get("location_code", "")
    wh = data.get("warehouse_code", "MAIN")
    bin_type = data.get("bin_type", "medium")

    if not bcode:
        return jsonify({"success": False, "message": "Bin code required"}), 400

    bid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO warehouse_bins (id, bin_code, zone_code, location_code, warehouse_code, aisle, rack, level, capacity_units, current_units, status, bin_type, bin_color, tenant_id) "
        "VALUES (:id, :bcode, :zone, :lcode, :wh, :aisle, :rack, :level, :cap, 0, 'active', :btype, :bcolor, :tid)"
    ), {
        "id": bid, "bcode": bcode, "zone": data.get("zone_code", "ZONE-A"),
        "lcode": location_code, "wh": wh,
        "aisle": data.get("aisle", ""), "rack": data.get("rack", ""), "level": data.get("level", ""),
        "cap": int(data.get("capacity_units", 500)), "btype": bin_type,
        "bcolor": data.get("bin_color", ""), "tid": tenant_id
    })
    db.session.commit()
    return jsonify({"success": True, "message": f"Bin {bcode} created", "id": bid})


@warehouse_bp.route("/bins/<bin_code>/details", methods=["GET"])
def get_bin_details(bin_code):
    tenant_id = _get_tenant()
    tid_cond = "(tenant_id = :tid OR tenant_id = 'TEST' OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = '' OR tenant_id IS NULL)"
    bin_row = db.session.execute(db.text(
        f"SELECT id, bin_code, location_code, warehouse_code, capacity_units, current_units, status, bin_type, bin_color, qr_data "
        f"FROM warehouse_bins WHERE bin_code = :b AND {tid_cond} AND is_deleted = false"
    ), {"b": bin_code, "tid": tenant_id}).first()

    if not bin_row:
        return jsonify({"success": False, "message": "Bin not found"}), 404

    location_code = bin_row[2] or ""
    warehouse_code = bin_row[3] or "MAIN"

    # QR code — use stored qr_data or generate
    qr_img = bin_row[9] or _generate_qr_base64(f"/warehouse/bin/{bin_code}")

    bin_info = {
        "bin_code": bin_row[1], "location_code": location_code,
        "warehouse_code": warehouse_code, "capacity_units": bin_row[4] or 500,
        "current_units": bin_row[5] or 0, "status": bin_row[6] or "active",
        "bin_type": bin_row[7] or "medium", "bin_color": bin_row[8] or "",
        "qr_code": qr_img
    }

    # Location detail
    location = None
    if location_code:
        loc_row = db.session.execute(db.text(
            "SELECT id, location_code, plant, floor_name, shelf_name, row_name, column_name, bin_code, warehouse_code "
            "FROM inventory_locations WHERE location_code = :lc AND is_deleted = false LIMIT 1"
        ), {"lc": location_code}).first()
        if loc_row:
            location = {
                "id": loc_row[0], "location_code": loc_row[1], "plant": loc_row[2],
                "floor_name": loc_row[3], "shelf_name": loc_row[4],
                "row_name": loc_row[5], "column_name": loc_row[6],
                "bin_code": loc_row[7], "warehouse_code": loc_row[8]
            }

    # Stock in bin
    stock_rows = db.session.execute(db.text(
        "SELECT part_number, COALESCE(manufacturer,'') as manufacturer, qty_on_hand, qty_available, unit "
        "FROM inventory_stock_levels "
        "WHERE bin_code = :b AND qty_on_hand > 0 AND is_deleted = false "
        "ORDER BY part_number ASC"
    ), {"b": bin_code}).fetchall()

    stock = [{
        "part_number": r[0], "description": r[1] or "",
        "qty_on_hand": float(r[2] or 0), "qty_available": float(r[3] or 0),
        "unit": r[4] or "pcs", "unit_cost": 0
    } for r in stock_rows]

    # Movements
    try:
        mov_rows = db.session.execute(db.text(
            "SELECT movement_no, movement_type, part_number, qty, unit, "
            "from_bin_code, to_bin_code, reference_no, performed_by, created_at "
            "FROM inventory_stock_movements "
            "WHERE (from_bin_code = :b OR to_bin_code = :b) AND is_deleted = false "
            "ORDER BY created_at DESC LIMIT 50"
        ), {"b": bin_code}).fetchall()
        movements = [{
            "movement_no": r[0] or "-", "movement_type": r[1],
            "part_number": r[2], "qty": float(r[3] or 0), "unit": r[4] or "pcs",
            "from_bin": r[5], "to_bin": r[6],
            "reference_no": r[7] or "-", "performed_by": r[8] or "System",
            "created_at": str(r[9]) if r[9] else "-",
            "direction": "IN" if r[6] == bin_code else "OUT"
        } for r in mov_rows]
    except Exception:
        db.session.rollback()
        movements = []

    # Scan history
    try:
        scan_rows = db.session.execute(db.text(
            "SELECT performer_name, scan_action, bin_code, scan_time "
            "FROM warehouse_bin_scans WHERE bin_code = :b "
            "ORDER BY scan_time DESC LIMIT 30"
        ), {"b": bin_code}).fetchall()
        scan_history = [{
            "scanned_by": r[0] or "Unknown", "scan_context": r[1] or "QR Scan",
            "location_at_scan": location_code, "scanned_at": str(r[3]) if r[3] else "-"
        } for r in scan_rows]
    except Exception:
        db.session.rollback()
        scan_history = []

    return jsonify({"success": True, "data": {
        "bin": bin_info, "location": location,
        "stock": stock, "movements": movements, "scan_history": scan_history
    }})


# 3. BIN CAPACITY RULES
@warehouse_bp.route("/bin-capacity", methods=["GET"])
def list_bin_capacity():
    tenant_id = _get_tenant()
    tid_cond = "(tenant_id = :tid OR tenant_id = 'TEST' OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = '' OR tenant_id IS NULL)"
    rows = db.session.execute(db.text(
        f"SELECT id, part_code, part_description, capacity_small, capacity_medium, capacity_large FROM warehouse_bin_capacity WHERE is_deleted = false AND {tid_cond} ORDER BY part_code ASC"
    ), {"tid": tenant_id}).fetchall()
    data = [{
        "id": r[0], "part_code": r[1], "part_description": r[2] or "",
        "capacity_small": int(r[3] or 100), "capacity_medium": int(r[4] or 150), "capacity_large": int(r[5] or 200)
    } for r in rows]
    return jsonify({"success": True, "data": data})


@warehouse_bp.route("/bin-capacity", methods=["POST"])
def create_bin_capacity():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    part_code = data.get("part_code", "").strip()
    if not part_code:
        return jsonify({"success": False, "message": "Part code required"}), 400
    rid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO warehouse_bin_capacity (id, part_code, part_description, capacity_small, capacity_medium, capacity_large, tenant_id) "
        "VALUES (:id, :pc, :desc, :sm, :md, :lg, :tid)"
    ), {
        "id": rid, "pc": part_code, "desc": data.get("part_description", ""),
        "sm": int(data.get("capacity_small", 100)), "md": int(data.get("capacity_medium", 150)),
        "lg": int(data.get("capacity_large", 200)), "tid": tenant_id
    })
    db.session.commit()
    return jsonify({"success": True, "message": f"Capacity rule for {part_code} created", "id": rid})


@warehouse_bp.route("/bin-capacity/<rid>", methods=["PUT"])
def update_bin_capacity(rid):
    data = request.get_json() or {}
    updates, params = [], {"id": rid}
    for field in ["capacity_small", "capacity_medium", "capacity_large"]:
        if field in data:
            updates.append(f"{field}=:{field}")
            params[field] = int(data[field])
    if not updates:
        return jsonify({"success": False, "message": "Nothing to update"}), 400
    db.session.execute(db.text(f"UPDATE warehouse_bin_capacity SET {', '.join(updates)} WHERE id=:id"), params)
    db.session.commit()
    return jsonify({"success": True, "message": "Capacity rule updated"})


# 5. BATCH TRACKING
@warehouse_bp.route("/batches", methods=["GET"])
def list_batches():
    tenant_id = _get_tenant()
    tid_cond = "(tenant_id = :tid OR tenant_id = 'TEST' OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = '' OR tenant_id IS NULL)"
    search = request.args.get("search", "").strip()
    where = f"WHERE is_deleted = false AND {tid_cond}"
    params = {"tid": tenant_id}
    if search:
        where += " AND (batch_no ILIKE :s OR part_number ILIKE :s OR supplier_lot ILIKE :s)"
        params["s"] = f"%{search}%"

    # One row per batch_no — aggregate parts, sum qty
    rows = db.session.execute(db.text(
        f"SELECT batch_no, "
        f"  array_agg(DISTINCT part_number ORDER BY part_number) AS parts, "
        f"  MAX(supplier_lot) AS supplier_lot, "
        f"  MAX(manufacture_date) AS manufacture_date, "
        f"  MAX(expiry_date) AS expiry_date, "
        f"  SUM(qty_received) AS qty_received, "
        f"  SUM(qty_remaining) AS qty_remaining, "
        f"  MAX(warehouse_code) AS warehouse_code, "
        f"  MAX(status) AS status, "
        f"  MAX(created_at) AS created_at "
        f"FROM inventory_batches {where} "
        f"GROUP BY batch_no ORDER BY MAX(created_at) DESC"
    ), params).fetchall()

    data = [{
        "batch_no": r[0],
        "parts": r[1] or [],
        "parts_count": len(r[1] or []),
        "supplier_lot": r[2] or "",
        "manufacture_date": str(r[3]) if r[3] else "",
        "expiry_date": str(r[4]) if r[4] else "",
        "qty_received": float(r[5] or 0),
        "qty_remaining": float(r[6] or 0),
        "warehouse_code": r[7] or "",
        "status": r[8] or "active",
        "created_at": str(r[9]) if r[9] else ""
    } for r in rows]
    return jsonify({"success": True, "data": data})


@warehouse_bp.route("/batches/<batch_no>/detail", methods=["GET"])
def get_batch_detail(batch_no):
    tenant_id = _get_tenant()
    tid_cond = "(tenant_id = :tid OR tenant_id = 'TEST' OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = '' OR tenant_id IS NULL)"

    # All rows for this batch_no
    part_rows = db.session.execute(db.text(
        f"SELECT id, batch_no, part_number, supplier_lot, manufacture_date, expiry_date, "
        f"qty_received, qty_remaining, warehouse_code, bin_code, status, created_at "
        f"FROM inventory_batches WHERE batch_no = :bn AND is_deleted = false AND {tid_cond} "
        f"ORDER BY part_number ASC"
    ), {"bn": batch_no, "tid": tenant_id}).fetchall()

    if not part_rows:
        return jsonify({"success": False, "message": "Batch not found"}), 404

    parts = [{
        "id": r[0], "batch_no": r[1], "part_number": r[2],
        "supplier_lot": r[3] or "", "manufacture_date": str(r[4]) if r[4] else "",
        "expiry_date": str(r[5]) if r[5] else "",
        "qty_received": float(r[6] or 0), "qty_remaining": float(r[7] or 0),
        "warehouse_code": r[8] or "", "bin_code": r[9] or "",
        "status": r[10] or "active", "created_at": str(r[11]) if r[11] else ""
    } for r in part_rows]

    first = part_rows[0]
    batch_summary = {
        "batch_no": first[1],
        "supplier_lot": first[3] or "",
        "manufacture_date": str(first[4]) if first[4] else "",
        "expiry_date": str(first[5]) if first[5] else "",
        "warehouse_code": first[8] or "",
        "status": first[10] or "active",
        "qty_received": sum(float(r[6] or 0) for r in part_rows),
        "qty_remaining": sum(float(r[7] or 0) for r in part_rows),
        "parts_count": len(parts)
    }

    part_numbers = [r[2] for r in part_rows]
    pn_placeholders = ", ".join(f":p{i}" for i in range(len(part_numbers)))
    pn_params = {f"p{i}": pn for i, pn in enumerate(part_numbers)}

    # Stock for all parts in this batch
    stock_rows = db.session.execute(db.text(
        f"SELECT part_number, warehouse_code, bin_code, location_code, qty_on_hand, qty_available, unit "
        f"FROM inventory_stock_levels "
        f"WHERE part_number IN ({pn_placeholders}) AND qty_on_hand > 0 AND is_deleted = false "
        f"AND {tid_cond} ORDER BY part_number, warehouse_code ASC"
    ), {**pn_params, "tid": tenant_id}).fetchall()
    stock = [{
        "part_number": s[0], "warehouse_code": s[1] or "",
        "bin_code": s[2] or "", "location_code": s[3] or "",
        "qty_on_hand": float(s[4] or 0), "qty_available": float(s[5] or 0),
        "unit": s[6] or "pcs"
    } for s in stock_rows]

    # Movements for all parts in this batch
    mov_rows = db.session.execute(db.text(
        f"SELECT movement_no, movement_type, part_number, qty, unit, "
        f"from_warehouse_code, from_bin_code, to_warehouse_code, to_bin_code, "
        f"reference_type, reference_no, performed_by, created_at "
        f"FROM inventory_stock_movements "
        f"WHERE part_number IN ({pn_placeholders}) AND is_deleted = false "
        f"AND {tid_cond} ORDER BY created_at DESC LIMIT 100"
    ), {**pn_params, "tid": tenant_id}).fetchall()
    movements = [{
        "movement_no": m[0] or "-", "movement_type": m[1],
        "part_number": m[2], "qty": float(m[3] or 0), "unit": m[4] or "pcs",
        "from_warehouse": m[5] or "-", "from_bin": m[6] or "-",
        "to_warehouse": m[7] or "-", "to_bin": m[8] or "-",
        "reference_type": m[9] or "", "reference_no": m[10] or "-",
        "performed_by": m[11] or "System",
        "created_at": str(m[12]) if m[12] else "-"
    } for m in mov_rows]

    # GRN source
    grn_source = []
    try:
        grn_rows = db.session.execute(db.text(
            "SELECT g.grn_number, g.po_number, g.supplier_name, g.received_date, g.status "
            "FROM procurement.grn g "
            "WHERE g.batch_no = :bn LIMIT 10"
        ), {"bn": batch_no}).fetchall()
        grn_source = [{
            "grn_number": g[0], "po_number": g[1] or "",
            "supplier_name": g[2] or "", "received_date": str(g[3]) if g[3] else "",
            "status": g[4] or ""
        } for g in grn_rows]
    except Exception:
        grn_source = []

    return jsonify({"success": True, "data": {
        "batch": batch_summary, "parts": parts,
        "stock": stock, "movements": movements, "grn_source": grn_source
    }})


# 6. PACKING & SHIPPING
@warehouse_bp.route("/receipts", methods=["GET"])
def list_receipts():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, receipt_no, po_number, supplier_name, warehouse_code, receipt_date, status, notes FROM warehouse_receipts WHERE is_deleted = false AND tenant_id = :tid ORDER BY created_at DESC"
    ), {"tid": tenant_id}).fetchall()
    receipts = [{
        "id": r[0], "receipt_no": r[1], "po_number": r[2] or "", "supplier_name": r[3] or "",
        "warehouse_code": r[4] or "MAIN", "receipt_date": r[5], "status": r[6], "notes": r[7] or ""
    } for r in rows]
    return jsonify({"success": True, "data": receipts})


@warehouse_bp.route("/receipts", methods=["POST"])
def create_receipt():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    rid = str(uuid.uuid4())
    rno = f"REC-{datetime.now().strftime('%Y%m%d%H%M')}"
    po = data.get("po_number", "PO-2026-001")
    supplier = data.get("supplier_name", "Acme Components")

    db.session.execute(db.text(
        "INSERT INTO warehouse_receipts (id, receipt_no, po_number, supplier_name, warehouse_code, receipt_date, status, notes, tenant_id) "
        "VALUES (:id, :rno, :po, :supplier, :wh, :rdate, 'received', :notes, :tid)"
    ), {
        "id": rid, "rno": rno, "po": po, "supplier": supplier, "wh": data.get("warehouse_code", "MAIN"),
        "rdate": data.get("receipt_date", datetime.now().strftime('%Y-%m-%d')), "notes": data.get("notes", ""), "tid": tenant_id
    })

    db.session.commit()
    return jsonify({"success": True, "message": f"Goods Receipt {rno} logged", "receipt_no": rno})


# 6. PACKING & SHIPPING
@warehouse_bp.route("/packing", methods=["GET"])
def list_packing():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, packing_no, customer_ref, fg_part_number, qty, box_pallet_details, weight_kg, dimensions, status FROM warehouse_packing_lists WHERE is_deleted = false AND tenant_id = :tid"
    ), {"tid": tenant_id}).fetchall()
    packs = [{
        "id": r[0], "packing_no": r[1], "customer_ref": r[2] or "", "fg_part_number": r[3],
        "qty": float(r[4] or 0), "box_pallet_details": r[5] or "", "weight_kg": float(r[6] or 0),
        "dimensions": r[7] or "", "status": r[8]
    } for r in rows]
    return jsonify({"success": True, "data": packs})


@warehouse_bp.route("/shipments", methods=["GET"])
def list_shipments():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, shipment_no, customer_name, delivery_address, warehouse_code, dispatch_date, carrier, tracking_no, status FROM warehouse_shipments WHERE is_deleted = false AND tenant_id = :tid ORDER BY created_at DESC"
    ), {"tid": tenant_id}).fetchall()
    shipments = [{
        "id": r[0], "shipment_no": r[1], "customer_name": r[2] or "", "delivery_address": r[3] or "",
        "warehouse_code": r[4] or "MAIN", "dispatch_date": r[5] or "", "carrier": r[6] or "",
        "tracking_no": r[7] or "", "status": r[8]
    } for r in rows]
    return jsonify({"success": True, "data": shipments})


# AUDIT LOGS & USER MANAGEMENT FOR WAREHOUSE
@warehouse_bp.route("/audit-logs", methods=["GET"])
def get_audit_logs():
    tenant_id = _get_tenant()
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 20, type=int)
    try:
        rows = db.session.execute(db.text(
            "SELECT action, entity_type, entity_id, user_name, user_email, ip_address, created_at FROM audit.logs WHERE module IN ('Warehouse', 'WAREHOUSE') AND tenant_id = :tid ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        ), {"tid": tenant_id, "limit": limit, "offset": (page-1)*limit}).fetchall()
        items = [{
            "action": r[0], "entity_type": r[1] or "Bin", "entity_id": r[2] or "-",
            "user_name": r[3] or r[4] or "Warehouse Officer", "user_email": r[4] or "",
            "ip_address": r[5] or "127.0.0.1", "created_at": str(r[6])
        } for r in rows]
        return jsonify({"success": True, "data": {"items": items, "total": len(items)}})
    except Exception:
        db.session.rollback()
        return jsonify({"success": True, "data": {"items": [], "total": 0}})


@warehouse_bp.route("/users", methods=["GET"])
def get_module_users():
    tenant_id = _get_tenant()
    try:
        rows = db.session.execute(db.text(
            "SELECT ma.id, ma.user_id, ma.role, ma.permissions, ma.is_active, ma.created_at, "
            "u.email, u.first_name, u.last_name "
            "FROM iam.module_access ma JOIN iam.users u ON ma.user_id = u.id "
            "WHERE ma.module IN ('Warehouse Management', 'Warehouse') "
            "ORDER BY ma.created_at DESC"
        )).fetchall()
        items = [{
            "id": r[0], "user_id": r[1], "role": r[2], "permissions": r[3] or {},
            "is_active": r[4], "created_at": str(r[5]) if r[5] else None,
            "email": r[6], "first_name": r[7] or '', "last_name": r[8] or ''
        } for r in rows]
        return jsonify({"success": True, "data": items})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e), "data": []})


@warehouse_bp.route("/users", methods=["POST"])
def add_module_user():
    data = request.get_json() or {}
    tenant_id = _get_tenant()
    user_id = data.get("user_id")
    role = data.get("role", "viewer")
    permissions = data.get("permissions", {})

    if not user_id:
        return jsonify({"success": False, "message": "user_id required"}), 400

    user = db.session.execute(db.text("SELECT id, email FROM iam.users WHERE id = :id AND is_deleted = false"), {"id": user_id}).first()
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404

    existing = db.session.execute(db.text("SELECT id FROM iam.module_access WHERE user_id = :uid AND module IN ('Warehouse Management', 'Warehouse')"), {"uid": user_id}).first()
    if existing:
        return jsonify({"success": False, "message": "User already has access to this module"}), 409

    access_id = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO iam.module_access (id, user_id, module, role, permissions, granted_by, tenant_id) "
        "VALUES (:id, :uid, 'Warehouse Management', :role, :perms, 'system', :tid)"
    ), {"id": access_id, "uid": user_id, "role": role, "perms": json.dumps(permissions), "tid": tenant_id})
    db.session.commit()
    return jsonify({"success": True, "message": f"Access granted to {user[1]}"}), 201


@warehouse_bp.route("/users/<access_id>", methods=["PUT"])
def update_module_user(access_id):
    data = request.get_json() or {}
    updates, params = [], {"id": access_id}
    if "role" in data:
        updates.append("role=:role")
        params["role"] = data["role"]
    if "permissions" in data:
        updates.append("permissions=:permissions")
        params["permissions"] = json.dumps(data["permissions"])
    if "is_active" in data:
        updates.append("is_active=:is_active")
        params["is_active"] = data["is_active"]
    if not updates:
        return jsonify({"success": False, "message": "Nothing to update"}), 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE iam.module_access SET {', '.join(updates)} WHERE id=:id"), params)
    db.session.commit()
    return jsonify({"success": True, "message": "Access updated"})


@warehouse_bp.route("/users/<access_id>", methods=["DELETE"])
def revoke_module_user(access_id):
    db.session.execute(db.text("DELETE FROM iam.module_access WHERE id = :id"), {"id": access_id})
    db.session.commit()
    return jsonify({"success": True, "message": "Access revoked"})


