from flask import Blueprint, request
from extensions import db
import uuid, json

hr_training_bp = Blueprint("hr_training", __name__)


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


def _err(e):
    db.session.rollback()
    return {"success": False, "message": str(e), "data": []}, 500


# ─── COURSES ───
@hr_training_bp.route("/training-courses", methods=["GET"])
def list_courses():
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        rows = db.session.execute(db.text(
            "SELECT id, title, description, category, duration_hours, mode, "
            "is_mandatory, certification_name, validity_months, created_at "
            "FROM hr.training_courses WHERE tenant_id=:tid AND is_deleted=false ORDER BY title"
        ), {"tid": tid}).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "title": r[1], "description": r[2] or '', "category": r[3] or '',
             "duration_hours": float(r[4]) if r[4] else 0, "mode": r[5],
             "is_mandatory": r[6], "certification_name": r[7] or '',
             "validity_months": r[8], "created_at": str(r[9]) if r[9] else None}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_training_bp.route("/training-courses", methods=["POST"])
def create_course():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    if not data.get("title"):
        return {"success": False, "message": "Title is required"}, 400
    try:
        cid = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO hr.training_courses (id, title, description, category, duration_hours, "
            "mode, is_mandatory, certification_name, validity_months, tenant_id) "
            "VALUES (:id, :title, :desc, :cat, :dur, :mode, :mandatory, :cert, :validity, :tid)"
        ), {"id": cid, "title": data["title"], "desc": data.get("description", ""),
            "cat": data.get("category", ""), "dur": data.get("duration_hours", 0),
            "mode": data.get("mode", "online"), "mandatory": data.get("is_mandatory", False),
            "cert": data.get("certification_name", ""), "validity": data.get("validity_months"),
            "tid": tid})
        db.session.commit()
        _log('CREATE', 'Training Course', data['title'], new=data)
        return {"success": True, "data": {"id": cid}, "message": "Course created"}, 201
    except Exception as e:
        return _err(e)


@hr_training_bp.route("/training-courses/<cid>", methods=["PUT"])
def update_course(cid):
    data = request.get_json()
    try:
        db.session.execute(db.text(
            "UPDATE hr.training_courses SET title=:title, description=:desc, category=:cat, "
            "duration_hours=:dur, mode=:mode, is_mandatory=:mandatory, "
            "certification_name=:cert, validity_months=:validity, updated_at=NOW() WHERE id=:id"
        ), {"id": cid, "title": data.get("title"), "desc": data.get("description", ""),
            "cat": data.get("category", ""), "dur": data.get("duration_hours", 0),
            "mode": data.get("mode", "online"), "mandatory": data.get("is_mandatory", False),
            "cert": data.get("certification_name", ""), "validity": data.get("validity_months")})
        db.session.commit()
        _log('UPDATE', 'Training Course', cid, new=data)
        return {"success": True, "message": "Course updated"}
    except Exception as e:
        return _err(e)


@hr_training_bp.route("/training-courses/<cid>", methods=["DELETE"])
def delete_course(cid):
    try:
        db.session.execute(db.text(
            "UPDATE hr.training_courses SET is_deleted=true, updated_at=NOW() WHERE id=:id"
        ), {"id": cid})
        db.session.commit()
        _log('DELETE', 'Training Course', cid)
        return {"success": True, "message": "Course deleted"}
    except Exception as e:
        return _err(e)


# ─── TRAINING ASSIGNMENTS ───
@hr_training_bp.route("/training-assignments", methods=["GET"])
def list_assignments():
    tid = request.headers.get("X-Tenant-ID", "")
    emp_id = request.args.get("employee_id")
    status = request.args.get("status")
    where = "WHERE ta.tenant_id=:tid AND ta.is_deleted=false"
    params = {"tid": tid}
    if emp_id:
        where += " AND ta.employee_id=:emp"
        params["emp"] = emp_id
    if status:
        where += " AND ta.status=:status"
        params["status"] = status
    try:
        rows = db.session.execute(db.text(
            f"SELECT ta.id, ta.employee_id, e.emp_code, e.first_name, e.last_name, "
            f"ta.course_id, tc.title as course_title, ta.due_date, ta.completed_at, "
            f"ta.score, ta.cert_expiry_date, ta.status, ta.created_at "
            f"FROM hr.training_assignments ta "
            f"JOIN hr.employees e ON e.id=ta.employee_id "
            f"JOIN hr.training_courses tc ON tc.id=ta.course_id "
            f"{where} ORDER BY ta.due_date"
        ), params).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "employee_id": str(r[1]), "emp_code": r[2],
             "employee_name": f"{r[3]} {r[4] or ''}".strip(),
             "course_id": str(r[5]), "course_title": r[6],
             "due_date": str(r[7]) if r[7] else None,
             "completed_at": str(r[8]) if r[8] else None,
             "score": float(r[9]) if r[9] else None,
             "cert_expiry_date": str(r[10]) if r[10] else None,
             "status": r[11], "created_at": str(r[12]) if r[12] else None}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_training_bp.route("/training-assignments", methods=["POST"])
def create_assignment():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        aid = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO hr.training_assignments (id, course_id, employee_id, assigned_by, due_date, tenant_id) "
            "VALUES (:id, :course, :emp, :by, :due, :tid)"
        ), {"id": aid, "course": data["course_id"], "emp": data["employee_id"],
            "by": request.headers.get('X-User-Name', ''),
            "due": data.get("due_date"), "tid": tid})
        db.session.commit()
        _log('CREATE', 'Training Assignment', data.get('employee_id', ''), new=data)
        return {"success": True, "data": {"id": aid}, "message": "Training assigned"}, 201
    except Exception as e:
        return _err(e)


@hr_training_bp.route("/training-assignments/<aid>", methods=["PUT"])
def update_assignment(aid):
    data = request.get_json()
    try:
        db.session.execute(db.text(
            "UPDATE hr.training_assignments SET status=:status, score=:score, "
            "cert_expiry_date=:expiry, "
            "completed_at=CASE WHEN :status='completed' THEN NOW() ELSE completed_at END, "
            "updated_at=NOW() WHERE id=:id"
        ), {"id": aid, "status": data.get("status", "assigned"),
            "score": data.get("score"), "expiry": data.get("cert_expiry_date")})
        db.session.commit()
        _log('UPDATE', 'Training Assignment', aid, new=data)
        return {"success": True, "message": "Assignment updated"}
    except Exception as e:
        return _err(e)


# ─── EXPIRING CERTIFICATIONS ───
@hr_training_bp.route("/expiring-certifications", methods=["GET"])
def expiring_certifications():
    tid = request.headers.get("X-Tenant-ID", "")
    days = int(request.args.get("days", 30))
    try:
        rows = db.session.execute(db.text(
            "SELECT ta.id, ta.employee_id, e.emp_code, e.first_name, e.last_name, "
            "tc.title, ta.cert_expiry_date, ta.status "
            "FROM hr.training_assignments ta "
            "JOIN hr.employees e ON e.id=ta.employee_id "
            "JOIN hr.training_courses tc ON tc.id=ta.course_id "
            "WHERE ta.tenant_id=:tid AND ta.is_deleted=false "
            "AND ta.cert_expiry_date IS NOT NULL "
            "AND ta.cert_expiry_date <= NOW() + (:days || ' days')::interval "
            "ORDER BY ta.cert_expiry_date"
        ), {"tid": tid, "days": days}).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "employee_id": str(r[1]), "emp_code": r[2],
             "employee_name": f"{r[3]} {r[4] or ''}".strip(),
             "course_title": r[5], "cert_expiry_date": str(r[6]) if r[6] else None,
             "status": r[7]}
            for r in rows]}
    except Exception as e:
        return _err(e)
