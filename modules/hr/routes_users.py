from flask import Blueprint, request
from extensions import db
import uuid, json

hr_users_bp = Blueprint("hr_users", __name__)


def _log(action, etype, eid, new=None):
    try:
        ip = (request.headers.get('X-Forwarded-For', '') or request.remote_addr or '').split(',')[0].strip()
        db.session.execute(db.text(
            "INSERT INTO audit.logs (id, action, module, entity_type, entity_id, ip_address, "
            "tenant_id, user_email, user_name, extra_data, created_at) "
            "VALUES (gen_random_uuid(), :action, 'HR', :etype, :eid, :ip, :tid, :email, :name, :extra, NOW())"
        ), {"action": action, "etype": etype, "eid": str(eid), "ip": ip,
            "tid": request.headers.get('X-Tenant-ID', ''),
            "email": request.headers.get('X-User-Email', ''),
            "name": request.headers.get('X-User-Name', ''),
            "extra": json.dumps({"new": new}) if new else None})
    except Exception:
        pass


@hr_users_bp.route("/module-users", methods=["GET"])
def list_module_users():
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        rows = db.session.execute(db.text(
            "SELECT mu.id, mu.user_id, mu.user_email, mu.user_name, mu.hr_role, "
            "mu.employee_id, e.emp_code, mu.is_active, mu.created_at "
            "FROM hr.module_users mu "
            "LEFT JOIN hr.employees e ON e.id=mu.employee_id "
            "WHERE mu.tenant_id=:tid AND mu.is_deleted=false ORDER BY mu.user_name"
        ), {"tid": tid}).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "user_id": r[1], "user_email": r[2] or '',
             "user_name": r[3] or '', "hr_role": r[4],
             "employee_id": str(r[5]) if r[5] else None, "emp_code": r[6] or '',
             "is_active": r[7], "created_at": str(r[8]) if r[8] else None}
            for r in rows]}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e), "data": []}, 500


@hr_users_bp.route("/module-users", methods=["POST"])
def add_module_user():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    if not data.get("user_email"):
        return {"success": False, "message": "user_email is required"}, 400
    existing = db.session.execute(db.text(
        "SELECT id FROM hr.module_users WHERE user_email=:email AND tenant_id=:tid AND is_deleted=false"
    ), {"email": data["user_email"], "tid": tid}).first()
    if existing:
        return {"success": False, "message": "User already has HR access"}, 409
    uid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO hr.module_users (id, user_id, user_email, user_name, hr_role, employee_id, tenant_id, created_by) "
        "VALUES (:id, :uid, :email, :name, :role, :emp, :tid, :by)"
    ), {"id": uid, "uid": data.get("user_id", ""), "email": data["user_email"],
        "name": data.get("user_name", ""), "role": data.get("hr_role", "employee"),
        "emp": data.get("employee_id"), "tid": tid,
        "by": request.headers.get('X-User-Name', '')})
    db.session.commit()
    _log('CREATE', 'HR Module User', data['user_email'], new=data)
    return {"success": True, "data": {"id": uid}, "message": "User added to HR module"}, 201


@hr_users_bp.route("/module-users/<uid>", methods=["PUT"])
def update_module_user(uid):
    data = request.get_json()
    db.session.execute(db.text(
        "UPDATE hr.module_users SET hr_role=:role, is_active=:active, updated_at=NOW() WHERE id=:id"
    ), {"id": uid, "role": data.get("hr_role", "employee"), "active": data.get("is_active", True)})
    db.session.commit()
    _log('UPDATE', 'HR Module User', uid, new=data)
    return {"success": True, "message": "User updated"}


@hr_users_bp.route("/module-users/<uid>", methods=["DELETE"])
def remove_module_user(uid):
    row = db.session.execute(db.text("SELECT user_email FROM hr.module_users WHERE id=:id"), {"id": uid}).first()
    db.session.execute(db.text(
        "UPDATE hr.module_users SET is_deleted=true, is_active=false, updated_at=NOW() WHERE id=:id"
    ), {"id": uid})
    db.session.commit()
    _log('DELETE', 'HR Module User', row[0] if row else uid)
    return {"success": True, "message": "User removed from HR module"}
