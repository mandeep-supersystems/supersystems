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

notifications_bp = Blueprint('notifications', __name__)



@notifications_bp.route("/notifications", methods=["GET"])
def list_notifications():
    tid = _tid()
    role = request.args.get("role", "")
    unread_only = request.args.get("unread", "false").lower() == "true"
    where = "(tenant_id = :tid OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = 'TEST' OR tenant_id = '' OR tenant_id IS NULL)"
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


@notifications_bp.route("/notifications/<nid>/read", methods=["PUT"])
def mark_notification_read(nid):
    db.session.execute(db.text(
        "UPDATE planning.notifications SET is_read=true, read_at=NOW() WHERE id=:id"
    ), {"id": nid})
    db.session.commit()
    return {"success": True}


@notifications_bp.route("/notifications/mark-all-read", methods=["PUT"])
def mark_all_read():
    tid = _tid()
    role = request.get_json(silent=True) or {}
    db.session.execute(db.text(
        "UPDATE planning.notifications SET is_read=true, read_at=NOW() "
        "WHERE tenant_id=:tid AND is_read=false"
    ), {"tid": tid})
    db.session.commit()
    return {"success": True}


@notifications_bp.route("/notifications/unread-count", methods=["GET"])
def unread_count():
    tid = _tid()
    role = request.args.get("role", "")
    where = "(tenant_id = :tid OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = 'TEST' OR tenant_id = '' OR tenant_id IS NULL) AND is_read = false"
    params = {"tid": tid}
    if role:
        where += " AND (recipient_role = :role OR recipient_role = 'all')"
        params["role"] = role
    count = db.session.execute(db.text(
        f"SELECT COUNT(*) FROM planning.notifications WHERE {where}"
    ), params).scalar() or 0
    return {"success": True, "data": {"count": count}}


