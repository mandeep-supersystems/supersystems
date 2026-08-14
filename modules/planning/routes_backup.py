from flask import Blueprint, request
from extensions import db
import uuid
import json
from datetime import datetime

planning_bp = Blueprint("planning", __name__)


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
            "VALUES (gen_random_uuid(), :mod, :evt, :ref_no, :ref_id, :title, :msg, :role, :tid, NOW())"
        ), {
            "mod": module, "evt": event_type, "ref_no": ref_no,
            "ref_id": ref_id if ref_id else None,
            "title": title, "msg": message, "role": role, "tid": tenant_id
        })
    except Exception:
        pass


# ─── NOTIFICATIONS ───

@planning_bp.route("/notifications", methods=["GET"])
def list_notifications():
    tid = _tid()
    role = request.args.get("role", "")
    unread_only = request.args.get("unread", "false").lower() == "true"
    where = f"tenant_id = :tid"
    params = {"tid": tid}
    if role:
        where += " AND (recipient_role = :role OR recipient_role = 'all')"
        params["role"] = role
    if unread_only:
        where += " AND is_read = false"
    rows = db.session.execute(db.text(
        f"SELECT id, module, event_type, reference_no, reference_id, title, message, "
        f"recipient_role, is_read, created_at FROM planning.notifications "
        f"WHERE {where} ORDER BY created_at DESC LIMIT 100"
    ), params).fetchall()
    return {"success": True, "data": [{
        "id": str(r[0]), "module": r[1], "event_type": r[2], "reference_no": r[3],
        "reference_id": str(r[4]) if r[4] else None, "title": r[5], "message": r[6],
        "recipient_role": r[7], "is_read": r[8],
        "created_at": str(r[9]) if r[9] else None
    } for r in rows]}


@planning_bp.route("/notifications/<nid>/read", methods=["PUT"])
def mark_notification_read(nid):
    db.session.execute(db.text(
        "UPDATE planning.notifications SET is_read=true, read_at=NOW() WHERE id=:id"
    ), {"id": nid})
    db.session.commit()
    return {"success": True}


@planning_bp.route("/notifications/mark-all-read", methods=["PUT"])
def mark_all_read():
    tid = _tid()
    role = request.get_json(silent=True) or {}
    db.session.execute(db.text(
        "UPDATE planning.notifications SET is_read=true, read_at=NOW() "
        "WHERE tenant_id=:tid AND is_read=false"
    ), {"tid": tid})
    db.session.commit()
    return {"success": True}


@planning_bp.route("/notifications/unread-count", methods=["GET"])
def unread_count():
    tid = _tid()
    role = request.args.get("role", "")
    where = "tenant_id = :tid AND is_read = false"
    params = {"tid": tid}
    if role:
        where += " AND (recipient_role = :role OR recipient_role = 'all')"
        params["role"] = role
    count = db.session.execute(db.text(
        f"SELECT COUNT(*) FROM planning.notifications WHERE {where}"
    ), params).scalar() or 0
    return {"success": True, "data": {"count": count}}


# ─── DEMAND PLANS ───

@planning_bp.route("/demands", methods=["GET"])
def list_demands():
    tid = _tid()
    rows = db.session.execute(db.text(
        f"SELECT id, plan_no, item_code, item_description, item_type, required_qty, "
        f"available_stock, reserved_qty, shortage_qty, source, reference_no, customer_name, "
        f"required_date, status, notes, created_by, created_at "
        f"FROM planning.demand_plans WHERE is_deleted=false AND {_tid_cond()} "
        f"ORDER BY created_at DESC"
    ), {"tid": tid}).fetchall()
    return {"success": True, "data": [{
        "id": str(r[0]), "plan_no": r[1], "item_code": r[2], "item_description": r[3] or "",
        "item_type": r[4] or "PART", "required_qty": float(r[5] or 0),
        "available_stock": float(r[6] or 0), "reserved_qty": float(r[7] or 0),
        "shortage_qty": float(r[8] or 0), "source": r[9] or "manual",
        "reference_no": r[10] or "", "customer_name": r[11] or "",
        "required_date": str(r[12]) if r[12] else "", "status": r[13] or "open",
        "notes": r[14] or "", "created_by": r[15] or "",
        "created_at": str(r[16]) if r[16] else None
    } for r in rows]}


@planning_bp.route("/demands", methods=["POST"])
def create_demand():
    tid = _tid()
    data = request.get_json() or {}
    item_code = data.get("item_code", "").strip()
    required_qty = float(data.get("required_qty", 0))
    if not item_code or required_qty <= 0:
        return {"success": False, "message": "Item code and required quantity are required"}, 400

    # Auto-fetch available stock from inventory
    stock_row = db.session.execute(db.text(
        "SELECT COALESCE(SUM(qty_available), 0) FROM inventory_stock_levels "
        "WHERE part_number = :code AND is_deleted = false"
    ), {"code": item_code}).scalar() or 0
    available = float(stock_row)
    shortage = max(0.0, required_qty - available)

    plan_id = str(uuid.uuid4())
    plan_no = f"PLN-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    db.session.execute(db.text(
        "INSERT INTO planning.demand_plans (id, plan_no, item_code, item_description, item_type, "
        "required_qty, available_stock, reserved_qty, shortage_qty, source, reference_no, "
        "customer_name, required_date, status, notes, tenant_id, created_by) "
        "VALUES (:id, :pno, :code, :desc, :itype, :rqty, :avail, 0, :short, :src, :ref, "
        ":cname, :rdate, 'open', :notes, :tid, :by)"
    ), {
        "id": plan_id, "pno": plan_no, "code": item_code,
        "desc": data.get("item_description", ""), "itype": data.get("item_type", "PART"),
        "rqty": required_qty, "avail": available, "short": shortage,
        "src": data.get("source", "manual"), "ref": data.get("reference_no", ""),
        "cname": data.get("customer_name", ""), "rdate": data.get("required_date") or None,
        "notes": data.get("notes", ""), "tid": tid, "by": _user()
    })
    db.session.commit()

    _notify(tid, "Planning", "DEMAND_CREATED", plan_no, plan_id,
            f"New Demand Plan: {plan_no}",
            f"Demand for {item_code} | Required: {required_qty} | Shortage: {shortage}",
            "planner")
    return {"success": True, "data": {"id": plan_id, "plan_no": plan_no,
            "shortage_qty": shortage}, "message": f"Demand plan {plan_no} created"}, 201


@planning_bp.route("/demands/<did>", methods=["DELETE"])
def delete_demand(did):
    db.session.execute(db.text(
        "UPDATE planning.demand_plans SET is_deleted=true, updated_at=NOW() WHERE id=:id"
    ), {"id": did})
    db.session.commit()
    return {"success": True, "message": "Demand deleted"}


# ─── PURCHASE REQUESTS (PR) ───

@planning_bp.route("/purchase-requests", methods=["GET"])
def list_prs():
    tid = _tid()
    rows = db.session.execute(db.text(
        f"SELECT id, pr_no, plan_no, item_code, item_description, required_qty, uom, "
        f"required_date, suggested_supplier_name, estimated_unit_price, status, priority, "
        f"notes, created_by, sent_to_purchaser_at, created_at "
        f"FROM planning.purchase_requests WHERE is_deleted=false AND {_tid_cond()} "
        f"ORDER BY created_at DESC"
    ), {"tid": tid}).fetchall()
    return {"success": True, "data": [{
        "id": str(r[0]), "pr_no": r[1], "plan_no": r[2] or "", "item_code": r[3],
        "item_description": r[4] or "", "required_qty": float(r[5] or 0),
        "uom": r[6] or "PCS", "required_date": str(r[7]) if r[7] else "",
        "suggested_supplier_name": r[8] or "", "estimated_unit_price": float(r[9] or 0),
        "status": r[10] or "draft", "priority": r[11] or "normal",
        "notes": r[12] or "", "created_by": r[13] or "",
        "sent_to_purchaser_at": str(r[14]) if r[14] else None,
        "created_at": str(r[15]) if r[15] else None
    } for r in rows]}


@planning_bp.route("/purchase-requests", methods=["POST"])
def create_pr():
    tid = _tid()
    data = request.get_json() or {}
    item_code = data.get("item_code", "").strip()
    required_qty = float(data.get("required_qty", 0))
    if not item_code or required_qty <= 0:
        return {"success": False, "message": "Item code and required quantity are required"}, 400

    pr_id = str(uuid.uuid4())
    pr_no = f"PR-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    db.session.execute(db.text(
        "INSERT INTO planning.purchase_requests (id, pr_no, plan_id, plan_no, item_code, "
        "item_description, required_qty, uom, required_date, suggested_supplier_name, "
        "estimated_unit_price, status, priority, notes, tenant_id, created_by) "
        "VALUES (:id, :prno, :plan_id, :plan_no, :code, :desc, :qty, :uom, :rdate, "
        ":sname, :price, 'draft', :priority, :notes, :tid, :by)"
    ), {
        "id": pr_id, "prno": pr_no,
        "plan_id": data.get("plan_id") or None,
        "plan_no": data.get("plan_no", ""),
        "code": item_code, "desc": data.get("item_description", ""),
        "qty": required_qty, "uom": data.get("uom", "PCS"),
        "rdate": data.get("required_date") or None,
        "sname": data.get("suggested_supplier_name", ""),
        "price": float(data.get("estimated_unit_price", 0)),
        "priority": data.get("priority", "normal"),
        "notes": data.get("notes", ""), "tid": tid, "by": _user()
    })
    db.session.commit()

    _notify(tid, "Planning", "PR_CREATED", pr_no, pr_id,
            f"Purchase Request Created: {pr_no}",
            f"PR for {item_code} | Qty: {required_qty} | Priority: {data.get('priority','normal')}",
            "planner")
    return {"success": True, "data": {"id": pr_id, "pr_no": pr_no},
            "message": f"Purchase Request {pr_no} created"}, 201


@planning_bp.route("/purchase-requests/<pr_id>/send-to-purchaser", methods=["POST"])
def send_pr_to_purchaser(pr_id):
    tid = _tid()
    pr = db.session.execute(db.text(
        "SELECT pr_no, item_code, required_qty, status FROM planning.purchase_requests WHERE id=:id"
    ), {"id": pr_id}).first()
    if not pr:
        return {"success": False, "message": "PR not found"}, 404
    if pr[3] not in ("draft", "rejected"):
        return {"success": False, "message": f"PR is already {pr[3]}"}, 400

    db.session.execute(db.text(
        "UPDATE planning.purchase_requests SET status='sent_to_purchaser', "
        "sent_to_purchaser_at=NOW(), updated_at=NOW() WHERE id=:id"
    ), {"id": pr_id})
    db.session.commit()

    _notify(tid, "Purchase", "PR_RECEIVED", pr[0], pr_id,
            f"New PR Received: {pr[0]}",
            f"Planning has sent PR {pr[0]} for {pr[1]} | Qty: {pr[2]}. Please review and create PO.",
            "purchaser")
    return {"success": True, "message": f"PR {pr[0]} sent to Purchaser"}


@planning_bp.route("/purchase-requests/<pr_id>", methods=["DELETE"])
def delete_pr(pr_id):
    db.session.execute(db.text(
        "UPDATE planning.purchase_requests SET is_deleted=true, updated_at=NOW() WHERE id=:id"
    ), {"id": pr_id})
    db.session.commit()
    return {"success": True, "message": "PR deleted"}


# ─── OVERVIEW STATS ───

@planning_bp.route("/overview", methods=["GET"])
def overview():
    tid = _tid()
    cond = _tid_cond()
    try:
        total_demands = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM planning.demand_plans WHERE is_deleted=false AND {cond}"
        ), {"tid": tid}).scalar() or 0
        open_demands = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM planning.demand_plans WHERE status='open' AND is_deleted=false AND {cond}"
        ), {"tid": tid}).scalar() or 0
        total_prs = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM planning.purchase_requests WHERE is_deleted=false AND {cond}"
        ), {"tid": tid}).scalar() or 0
        pending_prs = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM planning.purchase_requests WHERE status='draft' AND is_deleted=false AND {cond}"
        ), {"tid": tid}).scalar() or 0
        sent_prs = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM planning.purchase_requests WHERE status='sent_to_purchaser' AND is_deleted=false AND {cond}"
        ), {"tid": tid}).scalar() or 0
        unread_notifs = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM planning.notifications WHERE is_read=false AND tenant_id=:tid"
        ), {"tid": tid}).scalar() or 0
        return {"success": True, "data": {
            "total_demands": total_demands, "open_demands": open_demands,
            "total_prs": total_prs, "pending_prs": pending_prs,
            "sent_prs": sent_prs, "unread_notifications": unread_notifs
        }}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e)}, 500


# ─── DEMANDS FROM PROCUREMENT POs ───

@planning_bp.route("/demands/from-po", methods=["GET"])
def demands_from_po():
    """List demands that originated from approved procurement POs."""
    tid = _tid()
    rows = db.session.execute(db.text(
        f"SELECT id, plan_no, item_code, item_description, required_qty, available_stock, "
        f"reserved_qty, shortage_qty, reference_no, status, notes, created_at "
        f"FROM planning.demand_plans "
        f"WHERE source = 'procurement_po' AND is_deleted=false AND {_tid_cond()} "
        f"ORDER BY created_at DESC"
    ), {"tid": tid}).fetchall()
    return {"success": True, "data": [{
        "id": str(r[0]), "plan_no": r[1], "item_code": r[2],
        "item_description": r[3] or "", "required_qty": float(r[4] or 0),
        "available_stock": float(r[5] or 0), "reserved_qty": float(r[6] or 0),
        "shortage_qty": float(r[7] or 0), "reference_no": r[8] or "",
        "status": r[9] or "open", "notes": r[10] or "",
        "created_at": str(r[11]) if r[11] else None
    } for r in rows]}


# ─── STOCK BOOKING (Planning books available stock for a demand) ───

@planning_bp.route("/demands/<did>/book-stock", methods=["POST"])
def book_stock_for_demand(did):
    """Book available inventory stock for a demand plan. Updates inventory reserved_qty."""
    tid = _tid()
    data = request.get_json() or {}

    demand = db.session.execute(db.text(
        "SELECT id, plan_no, item_code, required_qty, available_stock, reserved_qty, shortage_qty, status "
        f"FROM planning.demand_plans WHERE id=:id AND is_deleted=false AND {_tid_cond()}"
    ), {"id": did, "tid": tid}).first()
    if not demand:
        return {"success": False, "message": "Demand not found"}, 404

    item_code = demand[2]
    required_qty = float(demand[3] or 0)
    book_qty = float(data.get("book_qty") or demand[4] or 0)  # default: book all available

    if book_qty <= 0:
        return {"success": False, "message": "Nothing to book — no available stock"}, 400

    # Reserve in inventory_stock_levels
    stock_rows = db.session.execute(db.text(
        "SELECT id, qty_on_hand, qty_reserved, qty_available FROM inventory_stock_levels "
        "WHERE part_number = :pn AND is_deleted = false ORDER BY qty_available DESC"
    ), {"pn": item_code}).fetchall()

    total_booked = 0.0
    booked_for = f"Demand {demand[1]} | {_user()}"

    for sr in stock_rows:
        if total_booked >= book_qty:
            break
        avail = float(sr[3] or 0)
        if avail <= 0:
            continue
        to_book = min(avail, book_qty - total_booked)
        db.session.execute(db.text(
            "UPDATE inventory_stock_levels SET qty_reserved = qty_reserved + :qty, "
            "updated_at = NOW() WHERE id = :id"
        ), {"qty": to_book, "id": sr[0]})
        total_booked += to_book

    if total_booked <= 0:
        return {"success": False, "message": "No stock available to book"}, 400

    # Update demand plan
    new_reserved = float(demand[5] or 0) + total_booked
    new_shortage = max(0.0, required_qty - float(demand[4] or 0))
    new_status = "stock_booked" if new_shortage <= 0 else "partial_stock"

    db.session.execute(db.text(
        "UPDATE planning.demand_plans SET reserved_qty=:rqty, shortage_qty=:short, "
        "status=:status, updated_at=NOW() WHERE id=:id"
    ), {"rqty": new_reserved, "short": new_shortage, "status": new_status, "id": did})
    db.session.commit()

    _notify(tid, "Inventory", "STOCK_BOOKED", demand[1], did,
            f"Stock Booked: {item_code}",
            f"Planning booked {total_booked} units of {item_code} for demand {demand[1]}. "
            f"Remaining shortage: {new_shortage}.",
            "planner")

    if new_shortage > 0:
        _notify(tid, "Planning", "PR_NEEDED", demand[1], did,
                f"PR Required: {item_code}",
                f"After booking {total_booked} units, shortage of {new_shortage} remains for {item_code}. "
                f"Please create a Purchase Request.",
                "planner")

    return {"success": True, "message": f"Booked {total_booked} units of {item_code}. "
            f"Shortage remaining: {new_shortage}",
            "data": {"booked_qty": total_booked, "shortage_remaining": new_shortage}}


# ─── RM STOCK VIEW (for Planning to see RM availability alongside part demands) ───

@planning_bp.route("/rm-stock", methods=["GET"])
def rm_stock_for_planning():
    """Show RM stock levels relevant to current demand plans."""
    tid = _tid()
    item_code = request.args.get("item_code", "").strip()

    # Get RM-Part mappings for the item
    where = "(tenant_id = :tid OR tenant_id IS NULL) AND is_deleted = false"
    params = {"tid": tid}
    if item_code:
        where += " AND part_number = :pn"
        params["pn"] = item_code

    rm_mappings = db.session.execute(db.text(
        f"SELECT rm_code, rm_description, quantity_required, unit, part_number "
        f"FROM rawmaterial.rm_part_mapping WHERE {where} ORDER BY part_number, rm_code"
    ), params).fetchall()

    result = []
    for rm in rm_mappings:
        rm_code = rm[0]
        # Get stock for this RM
        stock = db.session.execute(db.text(
            "SELECT COALESCE(SUM(qty_on_hand), 0), COALESCE(SUM(qty_reserved), 0), "
            "COALESCE(SUM(qty_available), 0) FROM inventory_stock_levels "
            "WHERE part_number = :pn AND is_deleted = false"
        ), {"pn": rm_code}).first()
        result.append({
            "part_number": rm[4], "rm_code": rm_code,
            "rm_description": rm[1] or "",
            "qty_required_per_part": float(rm[2] or 0),
            "unit": rm[3] or "",
            "stock_on_hand": float(stock[0] or 0),
            "stock_reserved": float(stock[1] or 0),
            "stock_available": float(stock[2] or 0)
        })
    return {"success": True, "data": result}


# ─── PLANNING OVERVIEW (extended with PO demands) ───

@planning_bp.route("/overview/extended", methods=["GET"])
def overview_extended():
    """Extended overview including PO-sourced demands and stock booking status."""
    tid = _tid()
    cond = _tid_cond()
    try:
        po_demands = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM planning.demand_plans "
            f"WHERE source='procurement_po' AND is_deleted=false AND {cond}"
        ), {"tid": tid}).scalar() or 0

        stock_booked = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM planning.demand_plans "
            f"WHERE status IN ('stock_booked','partial_stock') AND is_deleted=false AND {cond}"
        ), {"tid": tid}).scalar() or 0

        pr_needed = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM planning.demand_plans "
            f"WHERE shortage_qty > 0 AND status NOT IN ('converted_to_pr','closed') "
            f"AND is_deleted=false AND {cond}"
        ), {"tid": tid}).scalar() or 0

        return {"success": True, "data": {
            "po_sourced_demands": po_demands,
            "stock_booked_demands": stock_booked,
            "pr_needed_demands": pr_needed
        }}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e)}, 500

# ─── CUSTOMER ORDERS ───

@planning_bp.route("/customer-orders", methods=["GET"])
def get_all_customer_orders():
    tid = _tid()
    rows = db.session.execute(db.text(
        "SELECT id, project_name, customer_pos FROM project.projects WHERE is_deleted = false AND " + _tid_cond()
    ), {"tid": tid}).fetchall()
    
    orders = []
    for r in rows:
        proj_id = str(r[0])
        proj_name = r[1]
        pos = r[2]
        if isinstance(pos, str):
            try:
                pos = json.loads(pos)
            except:
                pos = []
        if pos:
            for po in pos:
                po["project_id"] = proj_id
                po["project_name"] = proj_name
                orders.append(po)
                
    # Sort orders by date or version if needed
    return {"success": True, "data": orders}

@planning_bp.route("/bom-analysis/<part_number>", methods=["GET"])
def analyze_bom(part_number):
    tid = _tid()
    
    fg_part = part_number
    if not fg_part.endswith("-99"):
        fg_part = f"{fg_part}-99"
        
    bom_row = db.session.execute(db.text(
        "SELECT id, bom_no, version, yield_qty FROM manufacturing_boms "
        "WHERE fg_part_number = :fg AND status = 'active' AND " + _tid_cond() + " LIMIT 1"
    ), {"fg": fg_part, "tid": tid}).first()
    
    if not bom_row:
        # Also check without -99 just in case
        bom_row = db.session.execute(db.text(
            "SELECT id, bom_no, version, yield_qty FROM manufacturing_boms "
            "WHERE fg_part_number = :fg AND status = 'active' AND " + _tid_cond() + " LIMIT 1"
        ), {"fg": part_number, "tid": tid}).first()
        
    if not bom_row:
        return {"success": False, "message": f"No active BOM found for {part_number}"}, 404
        
    bom_id = str(bom_row[0])
    bom_no = bom_row[1]
    yield_qty = float(bom_row[3] or 1)
    
    # Get raw materials / components
    lines = db.session.execute(db.text(
        "SELECT component_no, component_description, qty_per, unit, component_type "
        "FROM manufacturing_bom_lines WHERE bom_id = :bid AND " + _tid_cond()
    ), {"bid": bom_id, "tid": tid}).fetchall()
    
    components = []
    for l in lines:
        components.append({
            "component_no": l[0],
            "description": l[1] or "",
            "qty_per": float(l[2] or 1),
            "unit": l[3] or "pcs",
            "type": l[4] or "RM"
        })
        
    return {"success": True, "data": {
        "bom_id": bom_id,
        "bom_no": bom_no,
        "fg_part_number": part_number,
        "yield_qty": yield_qty,
        "components": components
    }}

