import uuid
import json
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from extensions import db

purchase_bp = Blueprint("purchase", __name__)


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


def _tid_cond():
    return "(tenant_id = :tid OR tenant_id = 'TEST' OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = '' OR tenant_id IS NULL)"


# ─── OVERVIEW STATS ───
@purchase_bp.route("/overview-stats", methods=["GET"])
def overview_stats():
    tenant_id = _get_tenant()
    cond = _tid_cond()
    try:
        total_demands = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM purchase_customer_demands WHERE is_deleted = false AND {cond}"
        ), {"tid": tenant_id}).scalar() or 0

        total_occupied_qty = db.session.execute(db.text(
            f"SELECT COALESCE(SUM(occupied_qty), 0) FROM purchase_customer_demands WHERE is_deleted = false AND {cond}"
        ), {"tid": tenant_id}).scalar() or 0

        net_shortage_qty = db.session.execute(db.text(
            f"SELECT COALESCE(SUM(qty_to_buy), 0) FROM purchase_customer_demands WHERE is_deleted = false AND {cond}"
        ), {"tid": tenant_id}).scalar() or 0

        active_pos = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM purchase_orders WHERE status IN ('released', 'in_progress') AND is_deleted = false AND {cond}"
        ), {"tid": tenant_id}).scalar() or 0

        lt_revisions = db.session.execute(db.text(
            f"SELECT COALESCE(SUM(lead_time_change_count), 0) FROM purchase_orders WHERE is_deleted = false AND {cond}"
        ), {"tid": tenant_id}).scalar() or 0

        return jsonify({
            "success": True,
            "data": {
                "total_demands": total_demands,
                "total_occupied_qty": float(total_occupied_qty),
                "net_shortage_qty": float(net_shortage_qty),
                "active_pos": active_pos,
                "lead_time_revisions": int(lt_revisions)
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


# ─── AUDIT LOGS & MODULE USERS ───
@purchase_bp.route("/audit-logs", methods=["GET"])
def get_audit_logs():
    tenant_id = _get_tenant()
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 20, type=int)
    try:
        rows = db.session.execute(db.text(
            "SELECT action, entity_type, entity_id, user_name, user_email, ip_address, created_at FROM audit.logs WHERE module IN ('Purchase', 'PROCUREMENT') AND tenant_id = :tid ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        ), {"tid": tenant_id, "limit": limit, "offset": (page-1)*limit}).fetchall()
        items = [{
            "action": r[0], "entity_type": r[1] or "PO", "entity_id": r[2] or "-",
            "user_name": r[3] or r[4] or "Purchaser", "user_email": r[4] or "",
            "ip_address": r[5] or "127.0.0.1", "created_at": str(r[6])
        } for r in rows]
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
