from flask import Blueprint, request
from extensions import db
import uuid
import json
from datetime import datetime

# Common functions (we should ideally put these in a utils file, but for now we'll duplicate or import)
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

purchase_requests_bp = Blueprint('purchase_requests', __name__)



@purchase_requests_bp.route("/purchase-requests", methods=["GET"])
def list_prs():
    tid = _tid()
    rows = db.session.execute(db.text(
        f"SELECT id, pr_no, plan_no, item_code, item_description, required_qty, uom, "
        f"required_date, suggested_supplier_name, estimated_unit_price, status, priority, "
        f"notes, created_by, sent_to_purchaser_at, created_at, source_line_keys "
        f"FROM planning.purchase_requests WHERE is_deleted=false AND {_tid_cond()} "
        f"ORDER BY created_at DESC"
    ), {"tid": tid}).fetchall()
    
    data = []
    for r in rows:
        pr_no = r[1]
        po_rows = db.session.execute(db.text(
            "SELECT doc_no, po_status, promised_date::text, COALESCE(delay_days, 0), item_code, lines "
            "FROM procurement.purchase_orders "
            "WHERE pr_no = :pr_no AND is_deleted = false"
        ), {"pr_no": pr_no}).fetchall()
        
        pos = []
        for po in po_rows:
            raw_lines = po[5]
            lines_list = []
            if raw_lines:
                try:
                    if isinstance(raw_lines, (list, dict)):
                        lines_list = raw_lines if isinstance(raw_lines, list) else [raw_lines]
                    else:
                        lines_list = json.loads(raw_lines)
                except Exception:
                    lines_list = []
            
            reschedule_count = db.session.execute(db.text(
                "SELECT COUNT(*) FROM purchase_lead_time_history WHERE po_no = :po_no"
            ), {"po_no": po[0]}).scalar() or 0
            
            pos.append({
                "po_no": po[0],
                "po_status": po[1] or "draft",
                "po_etd": po[2] or "",
                "delay_days": int(po[3] or 0),
                "item_code": po[4] or "",
                "lines": lines_list,
                "reschedule_count": reschedule_count
            })
            
        data.append({
            "id": str(r[0]), "pr_no": r[1], "plan_no": r[2] or "", "item_code": r[3],
            "item_description": r[4] or "", "required_qty": float(r[5] or 0),
            "uom": r[6] or "PCS", "required_date": str(r[7]) if r[7] else "",
            "suggested_supplier_name": r[8] or "", "estimated_unit_price": float(r[9] or 0),
            "status": r[10] or "draft", "priority": r[11] or "normal",
            "notes": r[12] or "", "created_by": r[13] or "",
            "sent_to_purchaser_at": str(r[14]) if r[14] else None,
            "created_at": str(r[15]) if r[15] else None,
            "source_line_keys": r[16] or "",
            "pos": pos
        })
    return {"success": True, "data": data}


@purchase_requests_bp.route("/purchase-requests", methods=["POST"])
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
        "estimated_unit_price, status, priority, notes, source_line_keys, tenant_id, created_by) "
        "VALUES (:id, :prno, :plan_id, :plan_no, :code, :desc, :qty, :uom, :rdate, "
        ":sname, :price, 'draft', :priority, :notes, :slk, :tid, :by)"
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
        "notes": data.get("notes", ""),
        "slk": data.get("source_line_keys", ""),
        "tid": tid, "by": _user()
    })
    db.session.commit()

    _notify(tid, "Planning", "PR_CREATED", pr_no, pr_id,
            f"Purchase Request Created: {pr_no}",
            f"PR for {item_code} | Qty: {required_qty} | Priority: {data.get('priority','normal')}",
            "planner")
    return {"success": True, "data": {"id": pr_id, "pr_no": pr_no},
            "message": f"Purchase Request {pr_no} created"}, 201


@purchase_requests_bp.route("/purchase-requests/<pr_id>/send-to-purchaser", methods=["POST"])
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


@purchase_requests_bp.route("/purchase-requests/<pr_id>", methods=["DELETE"])
def delete_pr(pr_id):
    db.session.execute(db.text(
        "UPDATE planning.purchase_requests SET is_deleted=true, updated_at=NOW() WHERE id=:id"
    ), {"id": pr_id})
    db.session.commit()
    return {"success": True, "message": "PR deleted"}


