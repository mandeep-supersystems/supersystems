import uuid
import json
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from extensions import db

purchase_bp = Blueprint("purchase", __name__)


def _ensure_etd_columns():
    """Add ETD tracking columns if they don't exist yet."""
    try:
        db.session.execute(db.text(
            "ALTER TABLE procurement.purchase_orders "
            "ADD COLUMN IF NOT EXISTS original_promised_date DATE, "
            "ADD COLUMN IF NOT EXISTS delay_days INTEGER DEFAULT 0"
        ))
        db.session.commit()
    except Exception:
        db.session.rollback()


@purchase_bp.before_app_request
def _init_once():
    global _etd_cols_checked
    if not globals().get('_etd_cols_checked'):
        _ensure_etd_columns()
        globals()['_etd_cols_checked'] = True


def _get_tenant():
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if isinstance(identity, dict):
            return identity.get("tenant_id", "TEST")
        elif isinstance(identity, str):
            try:
                data = json.loads(identity)
                return data.get("tenant_id", "TEST")
            except Exception:
                pass
    except Exception:
        pass
    return "TEST"


def _log(action, entity_type, entity_id, old_value=None, new_value=None):
    try:
        import json
        db.session.execute(db.text(
            "INSERT INTO audit.logs (id, action, module, entity_type, entity_id, ip_address, tenant_id, user_email, user_name, created_at, old_value, new_value) "
            "VALUES (gen_random_uuid(), :action, 'Purchase Management', :etype, :eid, :ip, :tid, :email, :name, NOW(), :old_val, :new_val)"
        ), {
            "action": action,
            "etype": entity_type,
            "eid": str(entity_id) if entity_id else "",
            "ip": request.remote_addr or "",
            "tid": _get_tenant(),
            "email": request.headers.get("X-User-Email", ""),
            "name": request.headers.get("X-User-Name", ""),
            "old_val": json.dumps(old_value) if old_value else None,
            "new_val": json.dumps(new_value) if new_value else None
        })
    except Exception:
        pass


def _tid_cond():
    return "(tenant_id = :tid OR tenant_id = 'TEST' OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = '' OR tenant_id IS NULL)"


# ─── OVERVIEW STATS ───
@purchase_bp.route("/overview-stats", methods=["GET"])
def overview_stats():
    tenant_id = _get_tenant()
    cond = _tid_cond()
    try:
        total_pending_prs = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM planning.purchase_requests WHERE status IN ('pending', 'draft') AND is_deleted = false AND {cond}"
        ), {"tid": tenant_id}).scalar() or 0

        total_converted_prs = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM planning.purchase_requests WHERE status = 'converted_to_po' AND is_deleted = false AND {cond}"
        ), {"tid": tenant_id}).scalar() or 0

        active_pos = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM procurement.purchase_orders WHERE po_status IN ('draft', 'sent_to_supplier', 'acknowledged') AND is_deleted = false AND {cond}"
        ), {"tid": tenant_id}).scalar() or 0

        lt_revisions = db.session.execute(db.text(
            f"SELECT COALESCE(SUM(delay_days), 0) FROM procurement.purchase_orders WHERE is_deleted = false AND {cond}"
        ), {"tid": tenant_id}).scalar() or 0

        pending_invoices = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM purchase_supplier_invoices WHERE status = 'received' AND is_deleted = false AND {cond}"
        ), {"tid": tenant_id}).scalar() or 0

        prs_today = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM planning.purchase_requests WHERE DATE(created_at) = CURRENT_DATE AND is_deleted = false AND {cond}"
        ), {"tid": tenant_id}).scalar() or 0

        converted_today = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM planning.purchase_requests WHERE status = 'converted_to_po' AND DATE(updated_at) = CURRENT_DATE AND is_deleted = false AND {cond}"
        ), {"tid": tenant_id}).scalar() or 0

        po_drafts = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM procurement.purchase_orders WHERE po_status = 'draft' AND is_deleted = false AND {cond}"
        ), {"tid": tenant_id}).scalar() or 0

        invoices_today = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM purchase_supplier_invoices WHERE DATE(created_at) = CURRENT_DATE AND is_deleted = false AND {cond}"
        ), {"tid": tenant_id}).scalar() or 0

        return jsonify({
            "success": True,
            "data": {
                "pending_prs": total_pending_prs,
                "prs_today": prs_today,
                "converted_prs": total_converted_prs,
                "converted_today": converted_today,
                "active_pos": active_pos,
                "po_drafts": po_drafts,
                "lead_time_revisions": int(lt_revisions),
                "pending_invoices": pending_invoices,
                "invoices_today": invoices_today
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


# ─── CUSTOMER DEMAND & STOCK RESERVATION CALCULATOR ───
@purchase_bp.route("/customer-demands", methods=["GET"])
def list_customer_demands():
    tenant_id = _get_tenant()
    cond = _tid_cond()
    try:
        rows = db.session.execute(db.text(
            f"SELECT id, demand_no, customer_name, part_or_rm_code, rm_code, rm_description, item_type, item_description, "
            f"ordered_qty, available_stock, occupy_option, occupied_qty, remaining_stock, "
            f"qty_to_buy, status, notes, created_at FROM purchase_customer_demands "
            f"WHERE is_deleted = false AND {cond} ORDER BY created_at DESC"
        ), {"tid": tenant_id}).fetchall()
        demands = [{
            "id": r[0], "demand_no": r[1], "customer_name": r[2], "part_or_rm_code": r[3],
            "rm_code": r[4] or "RM-STEEL-316L", "rm_description": r[5] or "Forged Alloy Steel Bar 316L",
            "item_type": r[6] or "PART", "item_description": r[7] or "",
            "ordered_qty": float(r[8] or 0), "available_stock": float(r[9] or 0),
            "occupy_option": r[10] or "do_not_occupy", "occupied_qty": float(r[11] or 0),
            "remaining_stock": float(r[12] or 0), "qty_to_buy": float(r[13] or 0),
            "status": r[14] or "pending", "notes": r[15] or "", "created_at": str(r[16]) if r[16] else ""
        } for r in rows]
        return jsonify({"success": True, "data": demands})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@purchase_bp.route("/customer-demands/<did>", methods=["GET"])
def get_customer_demand(did):
    tenant_id = _get_tenant()
    cond = _tid_cond()
    r = db.session.execute(db.text(
        f"SELECT id, demand_no, customer_name, part_or_rm_code, rm_code, rm_description, item_type, item_description, "
        f"ordered_qty, available_stock, occupy_option, occupied_qty, remaining_stock, "
        f"qty_to_buy, status, notes, created_at FROM purchase_customer_demands "
        f"WHERE id = :id AND is_deleted = false AND {cond}"
    ), {"id": did, "tid": tenant_id}).first()
    if not r:
        return jsonify({"success": False, "message": "Customer demand not found"}), 404
    data = {
        "id": r[0], "demand_no": r[1], "customer_name": r[2], "part_or_rm_code": r[3],
        "rm_code": r[4] or "RM-STEEL-316L", "rm_description": r[5] or "Forged Alloy Steel Bar 316L",
        "item_type": r[6] or "PART", "item_description": r[7] or "",
        "ordered_qty": float(r[8] or 0), "available_stock": float(r[9] or 0),
        "occupy_option": r[10] or "do_not_occupy", "occupied_qty": float(r[11] or 0),
        "remaining_stock": float(r[12] or 0), "qty_to_buy": float(r[13] or 0),
        "status": r[14] or "pending", "notes": r[15] or "", "created_at": str(r[16]) if r[16] else ""
    }
    return jsonify({"success": True, "data": data})


@purchase_bp.route("/customer-demands", methods=["POST"])
def create_customer_demand():
    tenant_id = _get_tenant()
    data = request.get_json() or {}

    cname = data.get("customer_name")
    code = data.get("part_or_rm_code")
    ord_qty = float(data.get("ordered_qty", 0))

    if not cname or not code or ord_qty <= 0:
        return jsonify({"success": False, "message": "Customer name, Part code, and ordered quantity (>0) required"}), 400

    # Auto-resolve mapped Raw Material (RM) from BOM/Part Mapping
    rm_row = db.session.execute(db.text(
        "SELECT item_code, item_description FROM manufacturing_bom_lines "
        "WHERE item_type = 'RM' AND bom_id IN (SELECT id FROM manufacturing_boms WHERE fg_part_number = :p OR fg_part_number LIKE :p_base) LIMIT 1"
    ), {"p": code, "p_base": f"{code.split('-99')[0]}%"}).first()

    rm_code = rm_row[0] if rm_row else "RM-STEEL-316L"
    rm_desc = rm_row[1] if rm_row else "Forged Alloy Steel Bar 316L"

    # Fetch available stock from inventory
    stock_row = db.session.execute(db.text(
        f"SELECT COALESCE(SUM(qty_available), 0), COALESCE(MAX(part_description), '') FROM inventory_stock_levels "
        f"WHERE part_number = :p AND is_deleted = false AND {_tid_cond()}"
    ), {"p": code, "tid": tenant_id}).first()

    avail_stock = float(stock_row[0]) if stock_row else 0.0
    item_desc = data.get("item_description") or (stock_row[1] if stock_row else f"Part {code}")
    item_type = "PART"

    occupy_opt = data.get("occupy_option", "do_not_occupy")
    wanted_occupy = float(data.get("occupied_qty", 0))

    if occupy_opt == "occupy":
        occupied_qty = min(avail_stock, wanted_occupy)
        remaining_stock = avail_stock - occupied_qty
        qty_to_buy = max(0.0, ord_qty - occupied_qty)

        # Update stock reservation in inventory
        if occupied_qty > 0:
            db.session.execute(db.text(
                f"UPDATE inventory_stock_levels SET qty_reserved = qty_reserved + :occ, qty_available = MAX(0, qty_on_hand - (qty_reserved + :occ)) "
                f"WHERE part_number = :p AND is_deleted = false AND {_tid_cond()}"
            ), {"occ": occupied_qty, "p": code, "tid": tenant_id})
    else:
        occupy_opt = "do_not_occupy"
        occupied_qty = 0.0
        remaining_stock = avail_stock
        qty_to_buy = ord_qty

    did = str(uuid.uuid4())
    dno = f"DEM-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    db.session.execute(db.text(
        "INSERT INTO purchase_customer_demands (id, demand_no, customer_name, part_or_rm_code, rm_code, rm_description, item_type, "
        "item_description, ordered_qty, available_stock, occupy_option, occupied_qty, remaining_stock, qty_to_buy, "
        "status, notes, tenant_id) VALUES (:id, :dno, :cname, :code, :rm_code, :rm_desc, :itype, :desc, :oqty, :astock, :opt, :occ, :rem, :tobuy, 'pending', :notes, :tid)"
    ), {
        "id": did, "dno": dno, "cname": cname, "code": code, "rm_code": rm_code, "rm_desc": rm_desc, "itype": item_type, "desc": item_desc,
        "oqty": ord_qty, "astock": avail_stock, "opt": occupy_opt, "occ": occupied_qty, "rem": remaining_stock,
        "tobuy": qty_to_buy, "notes": data.get("notes", ""), "tid": tenant_id
    })
    db.session.commit()
    return jsonify({"success": True, "message": f"Part demand {dno} recorded for {code}. Mapped RM: {rm_code}. Net shortage to buy: {qty_to_buy}", "demand_no": dno})


# ─── SUPPLIER QUOTATIONS & SOP / SQP RULES ───
@purchase_bp.route("/supplier-rules", methods=["GET"])
def list_supplier_rules():
    tenant_id = _get_tenant()
    code = request.args.get("part_or_rm_code", "").strip()
    cond = _tid_cond()

    where_sql = f"WHERE is_deleted = false AND is_active = true AND {cond}"
    params = {"tid": tenant_id}
    if code:
        where_sql += " AND part_or_rm_code = :code"
        params["code"] = code

    try:
        rows = db.session.execute(db.text(
            f"SELECT id, part_or_rm_code, supplier_code, supplier_name, unit_price, lead_time_days, "
            f"min_order_qty, sop_price, sqp_pack, created_at FROM purchase_supplier_quotations {where_sql} ORDER BY unit_price ASC"
        ), params).fetchall()
        suppliers = [{
            "id": r[0], "part_or_rm_code": r[1], "supplier_code": r[2], "supplier_name": r[3],
            "unit_price": float(r[4] or 0), "lead_time_days": int(r[5] or 7),
            "min_order_qty": float(r[6] or 1), "sop_price": float(r[7] or r[4] or 0),
            "sqp_pack": float(r[8] or 1), "created_at": str(r[9]) if r[9] else ""
        } for r in rows]
        return jsonify({"success": True, "data": suppliers})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@purchase_bp.route("/supplier-rules/<sid>", methods=["GET"])
def get_supplier_rule(sid):
    tenant_id = _get_tenant()
    cond = _tid_cond()
    r = db.session.execute(db.text(
        f"SELECT id, part_or_rm_code, supplier_code, supplier_name, unit_price, lead_time_days, "
        f"min_order_qty, sop_price, sqp_pack, created_at FROM purchase_supplier_quotations "
        f"WHERE id = :id AND is_deleted = false AND {cond}"
    ), {"id": sid, "tid": tenant_id}).first()
    if not r:
        return jsonify({"success": False, "message": "Supplier rule not found"}), 404
    data = {
        "id": r[0], "part_or_rm_code": r[1], "supplier_code": r[2], "supplier_name": r[3],
        "unit_price": float(r[4] or 0), "lead_time_days": int(r[5] or 7),
        "min_order_qty": float(r[6] or 1), "sop_price": float(r[7] or r[4] or 0),
        "sqp_pack": float(r[8] or 1), "created_at": str(r[9]) if r[9] else ""
    }
    return jsonify({"success": True, "data": data})


@purchase_bp.route("/supplier-rules", methods=["POST"])
def add_supplier_rule():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    code = data.get("part_or_rm_code")
    sname = data.get("supplier_name")
    scode = data.get("supplier_code", f"SUP-{datetime.now().strftime('%H%M%S')}")
    price = float(data.get("unit_price", 0))
    lead = int(data.get("lead_time_days", 7))
    moq = float(data.get("min_order_qty", 1))
    sqp = float(data.get("sqp_pack", 1))

    if not code or not sname or price <= 0:
        return jsonify({"success": False, "message": "Part/RM code, supplier name, and unit price (>0) required"}), 400

    qid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO purchase_supplier_quotations (id, part_or_rm_code, supplier_code, supplier_name, unit_price, "
        "lead_time_days, min_order_qty, sop_price, sqp_pack, tenant_id) VALUES (:id, :code, :scode, :sname, :price, :lead, :moq, :sop, :sqp, :tid)"
    ), {
        "id": qid, "code": code, "scode": scode, "sname": sname, "price": price, "lead": lead,
        "moq": moq, "sop": price, "sqp": sqp, "tid": tenant_id
    })
    db.session.commit()
    return jsonify({"success": True, "message": f"Supplier rule created for {sname}"})


# ─── PURCHASE REQUISITIONS (REQ ORDERS) ───
@purchase_bp.route("/requisitions", methods=["GET"])
def list_requisitions():
    tenant_id = _get_tenant()
    cond = _tid_cond()
    try:
        rows = db.session.execute(db.text(
            f"SELECT id, req_no, demand_no, part_or_rm_code, item_description, required_qty, "
            f"supplier_code, supplier_name, unit_price, moq, sqp, total_amount, requested_by, "
            f"status, notes, created_at FROM purchase_requisitions WHERE is_deleted = false AND {cond} ORDER BY created_at DESC"
        ), {"tid": tenant_id}).fetchall()
        reqs = [{
            "id": r[0], "req_no": r[1], "demand_no": r[2] or "-", "part_or_rm_code": r[3],
            "item_description": r[4] or "", "required_qty": float(r[5] or 0),
            "supplier_code": r[6], "supplier_name": r[7], "unit_price": float(r[8] or 0),
            "moq": float(r[9] or 1), "sqp": float(r[10] or 1), "total_amount": float(r[11] or 0),
            "requested_by": r[12] or "Purchaser", "status": r[13] or "pending",
            "notes": r[14] or "", "created_at": str(r[15]) if r[15] else ""
        } for r in rows]
        return jsonify({"success": True, "data": reqs})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@purchase_bp.route("/requisitions", methods=["POST"])
def create_requisition():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    code = data.get("part_or_rm_code")
    req_qty = float(data.get("required_qty", 0))
    sname = data.get("supplier_name")
    scode = data.get("supplier_code", "SUP-101")
    uprice = float(data.get("unit_price", 0))

    if not code or req_qty <= 0 or not sname or uprice <= 0:
        return jsonify({"success": False, "message": "Part/RM code, quantity, supplier, and price required"}), 400

    moq = float(data.get("moq", 1))
    sqp = float(data.get("sqp", 1))

    # Apply MOQ & SQP rounding rule
    effective_qty = max(req_qty, moq)
    if sqp > 1:
        import math
        effective_qty = math.ceil(effective_qty / sqp) * sqp

    tot_amt = round(effective_qty * uprice, 2)
    rid = str(uuid.uuid4())
    rno = f"REQ-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    db.session.execute(db.text(
        "INSERT INTO purchase_requisitions (id, req_no, demand_no, part_or_rm_code, item_description, "
        "required_qty, supplier_code, supplier_name, unit_price, moq, sqp, total_amount, requested_by, status, notes, tenant_id) "
        "VALUES (:id, :rno, :dno, :code, :desc, :qty, :scode, :sname, :uprice, :moq, :sqp, :tot, :reqby, 'pending', :notes, :tid)"
    ), {
        "id": rid, "rno": rno, "dno": data.get("demand_no", ""), "code": code,
        "desc": data.get("item_description", code), "qty": effective_qty,
        "scode": scode, "sname": sname, "uprice": uprice, "moq": moq, "sqp": sqp,
        "tot": tot_amt, "reqby": data.get("requested_by", "Purchaser"), "notes": data.get("notes", ""), "tid": tenant_id
    })
    db.session.commit()
    return jsonify({"success": True, "message": f"Req Order {rno} created for {sname} (Qty: {effective_qty})", "req_no": rno})


@purchase_bp.route("/requisitions/<rid>/convert-po", methods=["POST"])
def convert_requisition_to_po(rid):
    tenant_id = _get_tenant()
    data = request.get_json() or {}

    req = db.session.execute(db.text("SELECT req_no, supplier_code, supplier_name, part_or_rm_code, item_description, required_qty, unit_price, total_amount FROM purchase_requisitions WHERE id = :id"), {"id": rid}).first()
    if not req:
        return jsonify({"success": False, "message": "Requisition not found"}), 404

    lead_days = int(data.get("lead_time_days", 7))
    pdate = (datetime.now() + timedelta(days=lead_days)).strftime('%Y-%m-%d')
    poid = str(uuid.uuid4())
    pono = f"PO-PUR-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    db.session.execute(db.text(
        "INSERT INTO purchase_orders (id, po_no, req_no, supplier_code, supplier_name, part_or_rm_code, "
        "item_description, order_qty, unit_price, total_amount, lead_time_days, promised_delivery_date, "
        "lead_time_change_count, status, remarks, tenant_id) VALUES (:id, :pono, :rno, :scode, :sname, :code, :desc, :qty, :uprice, :tot, :lead, :pdate, 0, 'released', :rem, :tid)"
    ), {
        "id": poid, "pono": pono, "rno": req[0], "scode": req[1], "sname": req[2], "code": req[3],
        "desc": req[4], "qty": req[5], "uprice": req[6], "tot": req[7], "lead": lead_days, "pdate": pdate,
        "rem": data.get("remarks", "Generated from Requisition"), "tid": tenant_id
    })

    db.session.execute(db.text("UPDATE purchase_requisitions SET status = 'converted_to_po' WHERE id = :id"), {"id": rid})
    db.session.commit()
    return jsonify({"success": True, "message": f"PO {pono} generated with initial lead time {lead_days} days", "po_no": pono})


# ─── PURCHASE ORDERS & LEAD TIME REVISION TRACKER ───
@purchase_bp.route("/orders", methods=["GET"])
def list_purchase_orders():
    tenant_id = _get_tenant()
    cond = _tid_cond()
    try:
        rows = db.session.execute(db.text(
            f"SELECT id, po_no, req_no, supplier_code, supplier_name, part_or_rm_code, "
            f"item_description, order_qty, unit_price, total_amount, lead_time_days, "
            f"promised_delivery_date, lead_time_change_count, status, remarks, created_at FROM purchase_orders "
            f"WHERE is_deleted = false AND {cond} ORDER BY created_at DESC"
        ), {"tid": tenant_id}).fetchall()
        orders = [{
            "id": r[0], "po_no": r[1], "req_no": r[2] or "-", "supplier_code": r[3],
            "supplier_name": r[4], "part_or_rm_code": r[5], "item_description": r[6] or "",
            "order_qty": float(r[7] or 0), "unit_price": float(r[8] or 0),
            "total_amount": float(r[9] or 0), "lead_time_days": int(r[10] or 7),
            "promised_delivery_date": str(r[11]) if r[11] else "",
            "lead_time_change_count": int(r[12] or 0), "status": r[13] or "released",
            "remarks": r[14] or "", "created_at": str(r[15]) if r[15] else ""
        } for r in rows]
        return jsonify({"success": True, "data": orders})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@purchase_bp.route("/requisitions/<rid>", methods=["GET"])
def get_requisition(rid):
    tenant_id = _get_tenant()
    cond = _tid_cond()
    r = db.session.execute(db.text(
        f"SELECT id, req_no, demand_no, part_or_rm_code, item_description, required_qty, "
        f"supplier_code, supplier_name, unit_price, moq, sqp, total_amount, requested_by, "
        f"status, notes, created_at FROM purchase_requisitions "
        f"WHERE id = :id AND is_deleted = false AND {cond}"
    ), {"id": rid, "tid": tenant_id}).first()
    if not r:
        return jsonify({"success": False, "message": "Requisition not found"}), 404
    data = {
        "id": r[0], "req_no": r[1], "demand_no": r[2] or "-", "part_or_rm_code": r[3],
        "item_description": r[4] or "", "required_qty": float(r[5] or 0),
        "supplier_code": r[6], "supplier_name": r[7], "unit_price": float(r[8] or 0),
        "moq": float(r[9] or 1), "sqp": float(r[10] or 1), "total_amount": float(r[11] or 0),
        "requested_by": r[12] or "Purchaser", "status": r[13] or "pending",
        "notes": r[14] or "", "created_at": str(r[15]) if r[15] else ""
    }
    return jsonify({"success": True, "data": data})


@purchase_bp.route("/orders/<poid>", methods=["GET"])
def get_purchase_order(poid):
    tenant_id = _get_tenant()
    cond = _tid_cond()
    r = db.session.execute(db.text(
        f"SELECT id, po_no, req_no, supplier_code, supplier_name, part_or_rm_code, "
        f"item_description, order_qty, unit_price, total_amount, lead_time_days, "
        f"promised_delivery_date, lead_time_change_count, status, remarks, created_at FROM purchase_orders "
        f"WHERE id = :id AND is_deleted = false AND {cond}"
    ), {"id": poid, "tid": tenant_id}).first()
    if not r:
        return jsonify({"success": False, "message": "Purchase order not found"}), 404
    data = {
        "id": r[0], "po_no": r[1], "req_no": r[2] or "-", "supplier_code": r[3],
        "supplier_name": r[4], "part_or_rm_code": r[5], "item_description": r[6] or "",
        "order_qty": float(r[7] or 0), "unit_price": float(r[8] or 0),
        "total_amount": float(r[9] or 0), "lead_time_days": int(r[10] or 7),
        "promised_delivery_date": str(r[11]) if r[11] else "",
        "lead_time_change_count": int(r[12] or 0), "status": r[13] or "released",
        "remarks": r[14] or "", "created_at": str(r[15]) if r[15] else ""
    }
    return jsonify({"success": True, "data": data})


@purchase_bp.route("/orders/<poid>/lead-time", methods=["PUT"])
def update_po_lead_time(poid):
    tenant_id = _get_tenant()
    data = request.get_json() or {}

    new_lead = int(data.get("new_lead_time_days", 0))
    reason = data.get("change_reason", "Supplier lead time update")
    remarks = data.get("remarks", "")
    changed_by = request.headers.get('X-User-Name') or data.get("changed_by", "Purchaser")

    if new_lead <= 0 or not remarks:
        return jsonify({"success": False, "message": "New lead time days (>0) and mandatory action remarks are required"}), 400

    po = db.session.execute(db.text("SELECT po_no, lead_time_days, lead_time_change_count FROM purchase_orders WHERE id = :id"), {"id": poid}).first()
    if not po:
        return jsonify({"success": False, "message": "Purchase order not found"}), 404

    old_lead = int(po[1] or 7)
    old_count = int(po[2] or 0)
    new_count = old_count + 1
    new_deliv_date = (datetime.now() + timedelta(days=new_lead)).strftime('%Y-%m-%d')

    # Update PO lead time, promised date, and change count
    db.session.execute(db.text(
        "UPDATE purchase_orders SET lead_time_days = :new_lead, promised_delivery_date = :pdate, "
        "lead_time_change_count = :count, remarks = :rem, updated_at = NOW() WHERE id = :id"
    ), {"new_lead": new_lead, "pdate": new_deliv_date, "count": new_count, "rem": f"Revised LT ({new_lead}d): {remarks}", "id": poid})

    # Log immutable lead time change history entry
    hid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO purchase_lead_time_history (id, po_id, po_no, old_lead_time_days, new_lead_time_days, "
        "change_reason, remarks, changed_by, tenant_id) VALUES (:id, :poid, :pono, :old_lead, :new_lead, :reason, :rem, :by, :tid)"
    ), {
        "id": hid, "poid": poid, "pono": po[0], "old_lead": old_lead, "new_lead": new_lead,
        "reason": reason, "rem": remarks, "by": changed_by, "tid": tenant_id
    })

    db.session.commit()
    return jsonify({"success": True, "message": f"Lead time for PO {po[0]} revised from {old_lead} to {new_lead} days. Change count: {new_count}"})


@purchase_bp.route("/orders/<poid>/lead-time-history", methods=["GET"])
def get_po_lead_time_history(poid):
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, old_lead_time_days, new_lead_time_days, change_reason, remarks, changed_by, changed_at "
        "FROM purchase_lead_time_history WHERE po_id = :poid ORDER BY changed_at DESC"
    ), {"poid": poid}).fetchall()
    history = [{
        "id": r[0], "old_lead_time_days": int(r[1]), "new_lead_time_days": int(r[2]),
        "change_reason": r[3] or "", "remarks": r[4] or "", "changed_by": r[5] or "Purchaser",
        "changed_at": str(r[6])
    } for r in rows]
    return jsonify({"success": True, "data": history})


@purchase_bp.route("/lead-time-history", methods=["GET"])
def get_all_lead_time_history():
    tenant_id = _get_tenant()
    cond = _tid_cond()
    rows = db.session.execute(db.text(
        f"SELECT po_no, old_lead_time_days, new_lead_time_days, change_reason, remarks, changed_by, changed_at "
        f"FROM purchase_lead_time_history WHERE {cond} ORDER BY changed_at DESC"
    ), {"tid": tenant_id}).fetchall()
    history = [{
        "po_no": r[0] or "—",
        "old_lead_time_days": int(r[1]) if r[1] is not None else 0,
        "new_lead_time_days": int(r[2]) if r[2] is not None else 0,
        "change_reason": r[3] or "",
        "remarks": r[4] or "",
        "changed_by": r[5] or "Purchaser",
        "changed_at": str(r[6])
    } for r in rows]
    return jsonify({"success": True, "data": history})


# ─── PR INBOX (received from Planning) ───
@purchase_bp.route("/pr-inbox", methods=["GET"])
def pr_inbox():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, pr_no, plan_no, item_code, item_description, required_qty, uom, "
        "required_date, suggested_supplier_name, estimated_unit_price, status, priority, "
        "notes, created_by, sent_to_purchaser_at, created_at "
        "FROM planning.purchase_requests WHERE status IN ('sent_to_purchaser','approved','rejected','converted_to_po') "
        "AND is_deleted=false AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) "
        "ORDER BY created_at DESC"
    ), {"tid": tenant_id}).fetchall()
    return jsonify({"success": True, "data": [{
        "id": str(r[0]), "pr_no": r[1], "plan_no": r[2] or "", "item_code": r[3],
        "item_description": r[4] or "", "required_qty": float(r[5] or 0),
        "uom": r[6] or "PCS", "required_date": str(r[7]) if r[7] else "",
        "suggested_supplier_name": r[8] or "", "estimated_unit_price": float(r[9] or 0),
        "status": r[10] or "sent_to_purchaser", "priority": r[11] or "normal",
        "notes": r[12] or "", "created_by": r[13] or "",
        "sent_to_purchaser_at": str(r[14]) if r[14] else None,
        "created_at": str(r[15]) if r[15] else None
    } for r in rows]})


@purchase_bp.route("/pr-inbox/<pr_id>/create-po", methods=["POST"])
def create_po_from_pr(pr_id):
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    pr = db.session.execute(db.text(
        "SELECT pr_no, item_code, item_description, required_qty, uom FROM planning.purchase_requests WHERE id=:id"
    ), {"id": pr_id}).first()
    if not pr:
        return jsonify({"success": False, "message": "PR not found"}), 404

    supplier_id   = data.get("supplier_id") or None
    supplier_name = data.get("supplier_name", "").strip()
    supplier_email = data.get("supplier_email", "").strip()
    unit_price    = float(data.get("unit_price", 0))

    # If supplier_id given, fetch name from supplier.suppliers
    if supplier_id:
        sup = db.session.execute(db.text(
            "SELECT brand_name, supplier_code FROM supplier.suppliers WHERE id=:id AND is_deleted=false"
        ), {"id": supplier_id}).first()
        if not sup:
            return jsonify({"success": False, "message": "Supplier not found"}), 404
        supplier_name = sup[0]

    if not supplier_name:
        return jsonify({"success": False, "message": "Supplier is required — select from Supplier Management or enter name"}), 400
    if unit_price <= 0:
        return jsonify({"success": False, "message": "Unit price required"}), 400

    qty   = float(pr[3] or 0)
    total = round(qty * unit_price, 2)
    po_id = str(uuid.uuid4())
    po_no = f"PO-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    created_by = request.headers.get('X-User-Name', '') or request.headers.get('X-User-Email', '')

    db.session.execute(db.text(
        "INSERT INTO procurement.purchase_orders "
        "(id, doc_no, pr_no, plan_no, item_code, item_description, order_qty, unit_price, "
        "total_amount, supplier_name, supplier_email, supplier_id, promised_date, po_status, notes, "
        "tenant_id, created_by, date) "
        "VALUES (:id, :pono, :prno, :plan_no, :code, :desc, :qty, :uprice, :total, "
        ":sname, :semail, :sup_id, :pdate, 'draft', :notes, :tid, :by, NOW())"
    ), {
        "id": po_id, "pono": po_no, "prno": pr[0], "plan_no": data.get("plan_no", ""),
        "code": pr[1], "desc": pr[2] or "", "qty": qty, "uprice": unit_price,
        "total": total, "sname": supplier_name, "semail": supplier_email,
        "sup_id": supplier_id,
        "pdate": data.get("promised_date") or None,
        "notes": data.get("notes", ""), "tid": tenant_id, "by": created_by
    })
    db.session.execute(db.text(
        "UPDATE planning.purchase_requests SET status='converted_to_po', updated_at=NOW() WHERE id=:id"
    ), {"id": pr_id})
    db.session.commit()

    _purchase_notify(tenant_id, "Purchase", "PO_CREATED", po_no, po_id,
        f"PO Created: {po_no}",
        f"PO {po_no} created for {pr[1]} | Supplier: {supplier_name} | Qty: {qty} | Total: ₹{total}",
        "purchaser")
    return jsonify({"success": True, "data": {"id": po_id, "po_no": po_no},
            "message": f"PO {po_no} created for supplier {supplier_name}"}), 201


@purchase_bp.route("/po-list", methods=["GET"])
def list_pos():
    tenant_id = _get_tenant()
    cond = _tid_cond()
    try:
        rows = db.session.execute(db.text(
            "SELECT po.id, po.doc_no, po.pr_no, po.item_code, po.item_description, po.order_qty, "
            "po.unit_price, po.total_amount, po.supplier_name, po.supplier_email, po.promised_date, "
            "po.po_status, po.sent_to_supplier_at, po.notes, po.created_by, po.date, "
            "COALESCE(po.supplier_id::text,'') as supplier_id, "
            "COALESCE((SELECT s.brand_name FROM supplier.suppliers s WHERE s.id::text = po.supplier_id AND s.is_deleted=false LIMIT 1), po.supplier_name, '') as supplier_brand, "
            "COALESCE((SELECT s.supplier_code FROM supplier.suppliers s WHERE s.id::text = po.supplier_id AND s.is_deleted=false LIMIT 1), '') as supplier_code, "
            "COALESCE(po.supplier_invoice_no,'') as supplier_invoice_no, "
            "COALESCE(po.supplier_invoice_date::text,'') as supplier_invoice_date, "
            "COALESCE(po.supplier_invoice_amount,0) as supplier_invoice_amount, "
            "COALESCE(po.lines::text,'[]') as lines, "
            "COALESCE(po.original_promised_date::text,'') as original_promised_date, "
            "COALESCE(po.delay_days,0) as delay_days "
            "FROM procurement.purchase_orders po "
            "WHERE po.is_deleted=false "
            f"AND {cond} "
            "ORDER BY po.date DESC"
        ), {"tid": tenant_id}).fetchall()
        data = []
        for r in rows:
            try:
                raw_lines = r[22]
                if isinstance(raw_lines, (list, dict)):
                    lines = raw_lines if isinstance(raw_lines, list) else [raw_lines]
                elif raw_lines and raw_lines != '[]':
                    lines = json.loads(raw_lines)
                else:
                    lines = []
            except Exception:
                lines = []
            data.append({
                "id": str(r[0]), "po_no": r[1] or "", "pr_no": r[2] or "", "item_code": r[3] or "",
                "item_description": r[4] or "", "order_qty": float(r[5] or 0),
                "unit_price": float(r[6] or 0), "total_amount": float(r[7] or 0),
                "supplier_name": r[8] or "", "supplier_email": r[9] or "",
                "promised_date": str(r[10]) if r[10] else "",
                "po_status": r[11] or "draft",
                "sent_to_supplier_at": str(r[12]) if r[12] else None,
                "notes": r[13] or "", "created_by": r[14] or "",
                "po_date": str(r[15]) if r[15] else "",
                "supplier_id": r[16] or "",
                "supplier_brand": r[17] or "",
                "supplier_code": r[18] or "",
                "supplier_invoice_no": r[19] or "",
                "supplier_invoice_date": r[20] or "",
                "supplier_invoice_amount": float(r[21] or 0),
                "lines": lines,
                "original_promised_date": r[23] or "",
                "delay_days": int(r[24] or 0)
            })
        return jsonify({"success": True, "data": data})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@purchase_bp.route("/po-list/<po_id>/etd", methods=["PUT"])
def update_po_etd(po_id):
    """Update ETD (promised_date). Auto-calculates delay_days from original_promised_date."""
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    new_etd = data.get("promised_date", "").strip()
    if not new_etd:
        return jsonify({"success": False, "message": "promised_date required"}), 400

    po = db.session.execute(db.text(
        "SELECT doc_no, promised_date, original_promised_date FROM procurement.purchase_orders WHERE id=:id AND is_deleted=false"
    ), {"id": po_id}).first()
    if not po:
        return jsonify({"success": False, "message": "PO not found"}), 404

    # On first update, save the original promised_date
    original = po[2] if po[2] else po[1]

    # Calculate delay days: new_etd - original
    delay_days = 0
    try:
        from datetime import date as _date
        orig_d = original if hasattr(original, 'year') else _date.fromisoformat(str(original))
        new_d  = _date.fromisoformat(new_etd)
        delay_days = (new_d - orig_d).days
    except Exception:
        pass

    db.session.execute(db.text(
        "UPDATE procurement.purchase_orders "
        "SET promised_date=:new_etd, "
        "original_promised_date=COALESCE(original_promised_date, :orig), "
        "delay_days=:delay, updated_at=NOW() WHERE id=:id"
    ), {"new_etd": new_etd, "orig": original, "delay": delay_days, "id": po_id})
    db.session.commit()
    return jsonify({"success": True, "message": f"ETD updated. Delay: {delay_days} days",
                    "delay_days": delay_days, "original_promised_date": str(original)})


@purchase_bp.route("/po-list/<po_id>/send-to-supplier", methods=["POST"])
def send_po_to_supplier(po_id):
    tenant_id = _get_tenant()
    po = db.session.execute(db.text(
        "SELECT doc_no, item_code, order_qty, supplier_name, supplier_email, po_status "
        "FROM procurement.purchase_orders WHERE id=:id"
    ), {"id": po_id}).first()
    if not po:
        return jsonify({"success": False, "message": "PO not found"}), 404
    if po[5] not in ("draft", None, ""):
        return jsonify({"success": False, "message": f"PO already {po[5]}"}), 400

    db.session.execute(db.text(
        "UPDATE procurement.purchase_orders SET po_status='sent_to_supplier', "
        "sent_to_supplier_at=NOW(), updated_at=NOW() WHERE id=:id"
    ), {"id": po_id})
    _log("SEND_TO_SUPPLIER", "Purchase Order", po_id, new_value={"po_no": po[0], "supplier_name": po[3]})
    db.session.commit()

    _purchase_notify(tenant_id, "Supplier", "PO_SENT", po[0], po_id,
        f"Purchase Order Received: {po[0]}",
        f"You have received PO {po[0]} for {po[1]} | Qty: {po[2]}. Please confirm and arrange delivery.",
        "supplier")
    _purchase_notify(tenant_id, "Logistics", "PO_SENT_TO_SUPPLIER", po[0], po_id,
        f"PO Sent to Supplier: {po[0]}",
        f"PO {po[0]} sent to {po[3]} for {po[1]}. Prepare to receive goods.",
        "logistics")
    return jsonify({"success": True, "message": f"PO {po[0]} sent to supplier {po[3]}"})


@purchase_bp.route("/po-list/<po_id>/acknowledge", methods=["POST"])
def supplier_acknowledge_po(po_id):
    """Supplier acknowledges the PO."""
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    po = db.session.execute(db.text(
        "SELECT doc_no, item_code, supplier_name FROM procurement.purchase_orders WHERE id=:id"
    ), {"id": po_id}).first()
    if not po:
        return jsonify({"success": False, "message": "PO not found"}), 404

    db.session.execute(db.text(
        "UPDATE procurement.purchase_orders SET po_status='acknowledged', updated_at=NOW() WHERE id=:id"
    ), {"id": po_id})
    _log("ACKNOWLEDGE", "Purchase Order", po_id, new_value={"po_no": po[0], "supplier_name": po[2]})
    db.session.commit()

    _purchase_notify(tenant_id, "Purchase", "PO_ACKNOWLEDGED", po[0], po_id,
        f"PO Acknowledged: {po[0]}",
        f"Supplier {po[2]} has acknowledged PO {po[0]} for {po[1]}.",
        "purchaser")
    return jsonify({"success": True, "message": f"PO {po[0]} acknowledged"})


def _purchase_notify(tenant_id, module, event_type, ref_no, ref_id, title, message, role):
    try:
        db.session.execute(db.text(
            "INSERT INTO planning.notifications (id, module, event_type, reference_no, reference_id, "
            "title, message, recipient_role, tenant_id, created_at) "
            "VALUES (gen_random_uuid(), :mod, :evt, :ref_no, :ref_id, :title, :msg, :role, :tid, NOW())"
        ), {
            "mod": module, "evt": event_type, "ref_no": ref_no,
            "ref_id": ref_id if ref_id else None,
            "title": title, "msg": message, "role": role, "tid": tenant_id
        })
    except Exception:
        pass


# ─── SUPPLIER LEAD TIMES ───
@purchase_bp.route("/lead-times", methods=["GET"])
def list_lead_times():
    tenant_id = _get_tenant()
    cond = _tid_cond()
    try:
        rows = db.session.execute(db.text(
            f"SELECT id, part_or_rm_code, supplier_code, supplier_name, lead_time_days, created_at "
            f"FROM purchase_supplier_quotations WHERE is_deleted=false AND is_active=true AND {cond} "
            f"ORDER BY part_or_rm_code, supplier_name"
        ), {"tid": tenant_id}).fetchall()
        return jsonify({"success": True, "data": [{
            "id": str(r[0]), "item_code": r[1] or "", "supplier_code": r[2] or "",
            "supplier_name": r[3] or "", "lead_time_days": int(r[4] or 7),
            "created_at": str(r[5]) if r[5] else ""
        } for r in rows]})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@purchase_bp.route("/lead-times/<lt_id>", methods=["PUT"])
def update_lead_time(lt_id):
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    days = int(data.get("lead_time_days", 0))
    if days <= 0:
        return jsonify({"success": False, "message": "lead_time_days must be > 0"}), 400
    db.session.execute(db.text(
        "UPDATE purchase_supplier_quotations SET lead_time_days=:d, updated_at=NOW() WHERE id=:id"
    ), {"d": days, "id": lt_id})
    db.session.commit()
    return jsonify({"success": True, "message": "Lead time updated"})


# ─── SUPPLIER SEARCH (for PO creation — links to supplier.suppliers) ───

@purchase_bp.route("/search-suppliers", methods=["GET"])
def search_suppliers():
    tenant_id = _get_tenant()
    q = request.args.get("q", "").strip()
    if not q or len(q) < 2:
        return jsonify({"success": True, "data": []})
    rows = db.session.execute(db.text(
        "SELECT id, supplier_code, brand_name, status, gst_no "
        "FROM supplier.suppliers "
        "WHERE (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) AND is_deleted=false "
        "AND (LOWER(brand_name) LIKE LOWER(:q) OR LOWER(supplier_code) LIKE LOWER(:q)) "
        "ORDER BY brand_name LIMIT 20"
    ), {"tid": tenant_id, "q": f"%{q}%"}).fetchall()
    return jsonify({"success": True, "data": [{
        "id": str(r[0]), "supplier_code": r[1], "brand_name": r[2],
        "status": r[3] or "active", "gst_no": r[4] or ""
    } for r in rows]})


# ─── SUPPLIER INVOICES ───

@purchase_bp.route("/po-list/<po_id>/invoices", methods=["GET"])
def list_po_invoices(po_id):
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT i.id, i.invoice_no, i.invoice_date, i.invoice_amount, i.currency, "
        "i.status, i.notes, i.received_by, i.created_at, "
        "COALESCE(s.brand_name, i.supplier_name, '') as supplier_name, "
        "COALESCE(s.supplier_code,'') as supplier_code "
        "FROM purchase_supplier_invoices i "
        "LEFT JOIN supplier.suppliers s ON i.supplier_id = s.id "
        "WHERE i.po_id=:po_id AND i.is_deleted=false "
        "AND (i.tenant_id=:tid OR i.tenant_id='' OR i.tenant_id IS NULL) "
        "ORDER BY i.created_at DESC"
    ), {"po_id": po_id, "tid": tenant_id}).fetchall()
    return jsonify({"success": True, "data": [{
        "id": str(r[0]), "invoice_no": r[1], "invoice_date": str(r[2]) if r[2] else "",
        "invoice_amount": float(r[3] or 0), "currency": r[4] or "INR",
        "status": r[5] or "received", "notes": r[6] or "",
        "received_by": r[7] or "", "created_at": str(r[8]) if r[8] else None,
        "supplier_name": r[9] or "", "supplier_code": r[10] or ""
    } for r in rows]})


@purchase_bp.route("/po-list/<po_id>/invoices", methods=["POST"])
def add_po_invoice(po_id):
    """Purchaser records supplier invoice received against a PO."""
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    invoice_no = data.get("invoice_no", "").strip()
    if not invoice_no:
        return jsonify({"success": False, "message": "Invoice number is required"}), 400

    # Fetch PO to get supplier_id and po_no
    po = db.session.execute(db.text(
        "SELECT doc_no, supplier_id, supplier_name FROM procurement.purchase_orders WHERE id=:id"
    ), {"id": po_id}).first()
    if not po:
        return jsonify({"success": False, "message": "PO not found"}), 404

    inv_id = str(uuid.uuid4())
    received_by = request.headers.get("X-User-Name", "") or request.headers.get("X-User-Email", "")

    db.session.execute(db.text(
        "INSERT INTO purchase_supplier_invoices "
        "(id, po_id, po_no, supplier_id, supplier_name, invoice_no, invoice_date, "
        "invoice_amount, currency, line_items, status, notes, received_by, tenant_id) "
        "VALUES (:id, :po_id, :po_no, :sup_id, :sname, :inv_no, :inv_date, "
        ":inv_amt, :currency, :lines::jsonb, 'received', :notes, :by, :tid)"
    ), {
        "id": inv_id, "po_id": po_id, "po_no": po[0],
        "sup_id": po[1], "sname": po[2] or "",
        "inv_no": invoice_no,
        "inv_date": data.get("invoice_date") or None,
        "inv_amt": float(data.get("invoice_amount", 0)),
        "currency": data.get("currency", "INR"),
        "lines": json.dumps(data.get("line_items", [])),
        "notes": data.get("notes", ""),
        "by": received_by, "tid": tenant_id
    })

    # Update PO with latest invoice reference
    db.session.execute(db.text(
        "UPDATE procurement.purchase_orders SET "
        "supplier_invoice_no=:inv_no, supplier_invoice_date=:inv_date, "
        "supplier_invoice_amount=:inv_amt, invoice_received_at=NOW(), "
        "invoice_received_by=:by, updated_at=NOW() WHERE id=:id"
    ), {
        "inv_no": invoice_no,
        "inv_date": data.get("invoice_date") or None,
        "inv_amt": float(data.get("invoice_amount", 0)),
        "by": received_by, "id": po_id
    })
    db.session.commit()

    # Notify logistics that invoice is received and goods can be expected
    _purchase_notify(tenant_id, "Logistics", "INVOICE_RECEIVED", po[0], po_id,
        f"Supplier Invoice Received: {invoice_no}",
        f"Invoice {invoice_no} received for PO {po[0]} from {po[2] or 'supplier'}. "
        f"Amount: ₹{data.get('invoice_amount',0)}. Prepare to receive goods.",
        "logistics")

    return jsonify({"success": True, "message": f"Invoice {invoice_no} recorded against PO {po[0]}. Logistics notified.",
                    "id": inv_id}), 201


@purchase_bp.route("/po-list/<po_id>/invoices/<inv_id>/verify", methods=["POST"])
def verify_invoice(po_id, inv_id):
    """Purchaser verifies the supplier invoice."""
    tenant_id = _get_tenant()
    db.session.execute(db.text(
        "UPDATE purchase_supplier_invoices SET status='verified', updated_at=NOW() WHERE id=:id"
    ), {"id": inv_id})
    db.session.commit()
    return jsonify({"success": True, "message": "Invoice verified"})


# ─── AUDIT LOGS & MODULE USERS ───
@purchase_bp.route("/audit-logs", methods=["GET"])
def get_audit_logs():
    tenant_id = _get_tenant()
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 20, type=int)
    try:
        rows = db.session.execute(db.text(
            "SELECT action, entity_type, entity_id, user_name, user_email, ip_address, created_at, old_value, new_value FROM audit.logs WHERE module IN ('Purchase Management', 'Purchase', 'PROCUREMENT') AND tenant_id = :tid ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        ), {"tid": tenant_id, "limit": limit, "offset": (page-1)*limit}).fetchall()
        
        import json
        items = []
        for r in rows:
            items.append({
                "action": r[0], "entity_type": r[1] or "PO", "entity_id": r[2] or "-",
                "user_name": r[3] or r[4] or "Purchaser", "user_email": r[4] or "",
                "ip_address": r[5] or "127.0.0.1", "created_at": str(r[6]),
                "old_value": r[7] if isinstance(r[7], (dict, list)) else (json.loads(r[7]) if (isinstance(r[7], str) and r[7].strip()) else None),
                "new_value": r[8] if isinstance(r[8], (dict, list)) else (json.loads(r[8]) if (isinstance(r[8], str) and r[8].strip()) else None)
            })
        return jsonify({"success": True, "data": {"items": items, "total": len(items)}})
    except Exception:
        db.session.rollback()
        return jsonify({"success": True, "data": {"items": [], "total": 0}})


@purchase_bp.route("/users", methods=["GET"])
def get_module_users():
    tenant_id = _get_tenant()
    try:
        rows = db.session.execute(db.text(
            "SELECT ma.id, ma.user_id, ma.role, ma.permissions, ma.is_active, ma.created_at, "
            "u.email, u.first_name, u.last_name "
            "FROM iam.module_access ma JOIN iam.users u ON ma.user_id = u.id "
            "WHERE ma.module IN ('Purchase Management', 'Purchase', 'Procurement') "
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


@purchase_bp.route("/users", methods=["POST"])
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

    access_id = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO iam.module_access (id, user_id, module, role, permissions, granted_by, tenant_id) "
        "VALUES (:id, :uid, 'Purchase Management', :role, :perms, 'system', :tid)"
    ), {"id": access_id, "uid": user_id, "role": role, "perms": json.dumps(permissions), "tid": tenant_id})
    db.session.commit()
    return jsonify({"success": True, "message": f"Access granted to {user[1]}"}), 201


@purchase_bp.route("/users/<access_id>", methods=["PUT"])
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


@purchase_bp.route("/users/<access_id>", methods=["DELETE"])
def revoke_module_user(access_id):
    db.session.execute(db.text("DELETE FROM iam.module_access WHERE id = :id"), {"id": access_id})
    db.session.commit()
    return jsonify({"success": True, "message": "Access revoked"})


# ─── BULK PO / BUY MATERIAL FLOW ───
import re as _re

def _parse_pr_notes(notes, fallback_code, fallback_desc, fallback_qty, fallback_uom):
    """Parse '1. CODE — desc (qty UOM)' lines from notes. Returns list of dicts."""
    items = []
    if notes:
        for line in notes.splitlines():
            m = _re.match(r'^\d+\.\s+(.+?)\s+[\u2014\-]\s+(.+?)\s+\((\d+(?:\.\d+)?)\s+([^)]+)\)', line.strip())
            if m:
                items.append({
                    "item_code": m.group(1).strip(),
                    "item_description": m.group(2).strip(),
                    "required_qty": float(m.group(3)),
                    "uom": m.group(4).strip()
                })
    if not items:
        items.append({
            "item_code": fallback_code,
            "item_description": fallback_desc,
            "required_qty": float(fallback_qty or 0),
            "uom": fallback_uom or "PCS"
        })
    return items


def _match_suppliers_for_code(item_code):
    """Return (aml_list, matched_suppliers_list) for a given item_code."""
    aml_rows = []
    try:
        aml_rows = db.session.execute(db.text(
            "SELECT mpn, make FROM part.manufacturers WHERE part_number = :pn"
        ), {"pn": item_code}).fetchall()
    except Exception:
        db.session.rollback()

    matched_sups = []
    try:
        sql = (
            "SELECT sp.supplier_id, s.brand_name, s.supplier_code, "
            "COALESCE((SELECT c.email FROM supplier.contacts c WHERE c.supplier_id = s.id AND c.is_deleted = false LIMIT 1), '') as email, "
            "sp.mpn, sp.make, sp.moq_price, sp.spq_price, sp.moq, sp.spq, s.currency "
            "FROM supplier.parts sp "
            "JOIN supplier.suppliers s ON sp.supplier_id = s.id "
            "WHERE sp.is_deleted = false AND s.is_deleted = false "
            "AND (sp.part_code = :pn"
        )
        sql_params = {"pn": item_code}
        if aml_rows:
            conds = []
            for i, aml in enumerate(aml_rows):
                conds.append(f"(sp.mpn = :mpn_{i} AND sp.make = :make_{i})")
                sql_params[f"mpn_{i}"] = aml[0] or ""
                sql_params[f"make_{i}"] = aml[1] or ""
            sql += " OR " + " OR ".join(conds)
        sql += ")"
        for sr in db.session.execute(db.text(sql), sql_params).fetchall():
            matched_sups.append({
                "supplier_id": str(sr[0]),
                "brand_name": sr[1] or "",
                "supplier_code": sr[2] or "",
                "email": sr[3] or "",
                "mpn": sr[4] or "",
                "make": sr[5] or "",
                "moq_price": float(sr[6] or 0),
                "spq_price": float(sr[7] or 0),
                "moq": float(sr[8] or 1),
                "spq": float(sr[9] or 1),
                "currency": sr[10] or "INR"
            })
    except Exception:
        db.session.rollback()

    return [{"mpn": a[0] or "", "make": a[1] or ""} for a in aml_rows], matched_sups


@purchase_bp.route("/buy-material/match-suppliers", methods=["POST"])
def match_suppliers_for_prs():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    pr_ids = data.get("pr_ids", [])
    if not pr_ids:
        return jsonify({"success": False, "message": "No PR IDs provided"}), 400

    placeholders = ",".join([f":id{i}" for i in range(len(pr_ids))])
    params = {f"id{i}": v for i, v in enumerate(pr_ids)}
    params["tid"] = tenant_id

    try:
        rows = db.session.execute(db.text(
            f"SELECT id, pr_no, plan_no, item_code, item_description, required_qty, uom, "
            f"required_date, estimated_unit_price, notes "
            f"FROM planning.purchase_requests "
            f"WHERE id IN ({placeholders}) AND is_deleted=false "
            f"AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL)"
        ), params).fetchall()
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Failed to fetch PRs: {str(e)}"}), 500

    results = []
    for r in rows:
        pr_id = str(r[0])
        pr_no, plan_no = r[1], r[2] or ""
        required_date = str(r[7]) if r[7] else ""
        estimated_price = float(r[8] or 0)
        notes = r[9] or ""

        # Expand each line item from notes (or fallback to single top-level item)
        line_items = _parse_pr_notes(notes, r[3], r[4] or "", r[5], r[6] or "PCS")

        for li in line_items:
            aml, suppliers = _match_suppliers_for_code(li["item_code"])
            results.append({
                "pr_id": pr_id,
                "pr_no": pr_no,
                "plan_no": plan_no,
                "item_code": li["item_code"],
                "item_description": li["item_description"],
                "required_qty": li["required_qty"],
                "uom": li["uom"],
                "required_date": required_date,
                "estimated_unit_price": estimated_price,
                "aml": aml,
                "suppliers": suppliers
            })

    return jsonify({"success": True, "data": results})


@purchase_bp.route("/buy-material/generate-pos", methods=["POST"])
def generate_pos_from_assignments():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    assignments = data.get("assignments", [])
    if not assignments:
        return jsonify({"success": False, "message": "No assignments provided"}), 400

    # Group by supplier
    from collections import defaultdict
    by_supplier = defaultdict(list)
    for ass in assignments:
        supplier_id = ass.get("supplier_id")
        if not supplier_id:
            return jsonify({"success": False, "message": f"Missing supplier assignment for item {ass.get('item_code')}"}), 400
        by_supplier[supplier_id].append(ass)

    created_by = request.headers.get('X-User-Name', '') or request.headers.get('X-User-Email', '')

    generated_pos = []
    try:
        import uuid as _uuid
        for supplier_id, items in by_supplier.items():
            # Get supplier details
            sup = db.session.execute(db.text(
                "SELECT brand_name, supplier_code, currency, "
                "COALESCE((SELECT c.email FROM supplier.contacts c WHERE c.supplier_id = s.id AND c.is_deleted=false LIMIT 1),'') "
                "FROM supplier.suppliers s WHERE s.id=:id AND s.is_deleted=false"
            ), {"id": supplier_id}).first()
            if not sup:
                return jsonify({"success": False, "message": f"Supplier with ID {supplier_id} not found"}), 404

            supplier_name = sup[0]
            supplier_code = sup[1] or ""
            currency = sup[2] or "INR"
            supplier_email = sup[3] or ""

            po_id = str(_uuid.uuid4())
            import time
            po_no = f"PO-PUR-{datetime.now().strftime('%Y%m%d%H%M%S')}-{int(time.time() * 1000) % 1000:03d}"

            # Construct lines JSON and calculate totals
            lines_array = []
            total_amount = 0.0

            for it in items:
                pr_id = it.get("pr_id")
                item_code = it.get("item_code")
                order_qty = float(it.get("order_qty", 0))
                unit_price = float(it.get("unit_price", 0))
                item_total = round(order_qty * unit_price, 2)
                total_amount += item_total

                # Retrieve PR no and description
                pr_data = db.session.execute(db.text(
                    "SELECT pr_no, item_description, plan_no, uom FROM planning.purchase_requests WHERE id=:id"
                ), {"id": pr_id}).first()
                
                pr_no = pr_data[0] if pr_data else ""
                item_desc = pr_data[1] if pr_data else ""
                plan_no = pr_data[2] if pr_data else ""
                uom = pr_data[3] if pr_data else "PCS"

                lines_array.append({
                    "pr_id": pr_id,
                    "pr_no": pr_no,
                    "plan_no": plan_no,
                    "item_code": item_code,
                    "item_description": item_desc,
                    "order_qty": order_qty,
                    "unit_price": unit_price,
                    "total_amount": item_total,
                    "uom": uom,
                    "aml": it.get("aml", [])
                })

                # Update the planning PR status to converted
                db.session.execute(db.text(
                    "UPDATE planning.purchase_requests SET status='converted_to_po', updated_at=NOW() WHERE id=:id"
                ), {"id": pr_id})

            first_line = lines_array[0]
            summary_code = first_line["item_code"]
            if len(lines_array) > 1:
                summary_code = f"{summary_code} (+{len(lines_array)-1} more)"
            
            summary_desc = first_line["item_description"]
            summary_qty = sum(l["order_qty"] for l in lines_array)
            first_price = first_line["unit_price"]

            db.session.execute(db.text(
                "INSERT INTO procurement.purchase_orders "
                "(id, doc_no, pr_no, plan_no, item_code, item_description, order_qty, unit_price, "
                "total_amount, supplier_name, supplier_email, supplier_id, promised_date, po_status, notes, "
                "tenant_id, created_by, date, lines, subtotal, total, currency, vendor_id) "
                "VALUES (:id, :pono, :prno, :plan_no, :code, :desc, :qty, :uprice, :total, "
                ":sname, :semail, :sup_id, :pdate, 'draft', :notes, :tid, :by, NOW(), :lines, :subtotal, :total_amt, :currency, :sup_id)"
            ), {
                "id": po_id, "pono": po_no, 
                "prno": first_line["pr_no"], 
                "plan_no": first_line["plan_no"],
                "code": summary_code, "desc": summary_desc, "qty": summary_qty, "uprice": first_price,
                "total": total_amount, "sname": supplier_name, "semail": supplier_email,
                "sup_id": supplier_id,
                "pdate": items[0].get("promised_date") or None,
                "notes": items[0].get("notes", "Bulk Generated PO"), 
                "tid": tenant_id, "by": created_by,
                "lines": json.dumps(lines_array),
                "subtotal": total_amount, "total_amt": total_amount, "currency": currency
            })

            generated_pos.append({"po_no": po_no, "supplier_name": supplier_name, "total_amount": total_amount})

            _log("CREATE", "Purchase Order", po_id, new_value={"po_no": po_no, "supplier_name": supplier_name, "total_amount": total_amount})

            _purchase_notify(tenant_id, "Purchase", "PO_CREATED", po_no, po_id,
                f"PO Created: {po_no}",
                f"PO {po_no} created for Supplier {supplier_name} | Lines: {len(lines_array)} | Total: {currency} {total_amount}",
                "purchaser")

        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Failed to generate POs: {str(e)}"}), 500

    return jsonify({
        "success": True, 
        "data": generated_pos,
        "message": f"Successfully generated {len(generated_pos)} POs for suppliers."
    }), 201
