from flask import Blueprint, request
from extensions import db
import uuid, json

hr_onboarding_bp = Blueprint("hr_onboarding", __name__)


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


# ─── ONBOARDING TASKS ───
@hr_onboarding_bp.route("/onboarding-tasks", methods=["GET"])
def list_onboarding_tasks():
    tid = request.headers.get("X-Tenant-ID", "")
    emp_id = request.args.get("employee_id")
    where = "WHERE ot.tenant_id=:tid AND ot.is_deleted=false"
    params = {"tid": tid}
    if emp_id:
        where += " AND ot.employee_id=:emp"
        params["emp"] = emp_id
    try:
        rows = db.session.execute(db.text(
            f"SELECT ot.id, ot.employee_id, e.emp_code, e.first_name, e.last_name, "
            f"ot.task_name, ot.task_category, ot.phase, ot.due_date, ot.assigned_to, "
            f"ot.status, ot.completed_at, ot.notes, ot.created_at "
            f"FROM hr.onboarding_tasks ot JOIN hr.employees e ON e.id=ot.employee_id "
            f"{where} ORDER BY ot.phase, ot.due_date"
        ), params).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "employee_id": str(r[1]), "emp_code": r[2],
             "employee_name": f"{r[3]} {r[4] or ''}".strip(),
             "task_name": r[5], "task_category": r[6] or '', "phase": r[7],
             "due_date": str(r[8]) if r[8] else None, "assigned_to": r[9] or '',
             "status": r[10], "completed_at": str(r[11]) if r[11] else None,
             "notes": r[12] or '', "created_at": str(r[13]) if r[13] else None}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_onboarding_bp.route("/onboarding-tasks", methods=["POST"])
def create_onboarding_task():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        tid_task = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO hr.onboarding_tasks (id, employee_id, task_name, task_category, phase, "
            "due_date, assigned_to, notes, tenant_id) "
            "VALUES (:id, :emp, :name, :cat, :phase, :due, :assigned, :notes, :tid)"
        ), {"id": tid_task, "emp": data["employee_id"], "name": data["task_name"],
            "cat": data.get("task_category", ""), "phase": data.get("phase", "day1"),
            "due": data.get("due_date"), "assigned": data.get("assigned_to", ""),
            "notes": data.get("notes", ""), "tid": tid})
        db.session.commit()
        _log('CREATE', 'Onboarding Task', data.get('employee_id', ''), new=data)
        return {"success": True, "data": {"id": tid_task}, "message": "Task created"}, 201
    except Exception as e:
        return _err(e)


@hr_onboarding_bp.route("/onboarding-tasks/<tid_task>", methods=["PUT"])
def update_onboarding_task(tid_task):
    data = request.get_json()
    try:
        db.session.execute(db.text(
            "UPDATE hr.onboarding_tasks SET task_name=:name, task_category=:cat, phase=:phase, "
            "due_date=:due, assigned_to=:assigned, status=:status, notes=:notes, "
            "completed_at=CASE WHEN :status='completed' THEN NOW() ELSE completed_at END, "
            "updated_at=NOW() WHERE id=:id"
        ), {"id": tid_task, "name": data.get("task_name"), "cat": data.get("task_category", ""),
            "phase": data.get("phase", "day1"), "due": data.get("due_date"),
            "assigned": data.get("assigned_to", ""), "status": data.get("status", "pending"),
            "notes": data.get("notes", "")})
        db.session.commit()
        _log('UPDATE', 'Onboarding Task', tid_task, new=data)
        return {"success": True, "message": "Task updated"}
    except Exception as e:
        return _err(e)


@hr_onboarding_bp.route("/onboarding-tasks/<tid_task>", methods=["DELETE"])
def delete_onboarding_task(tid_task):
    try:
        db.session.execute(db.text(
            "UPDATE hr.onboarding_tasks SET is_deleted=true, updated_at=NOW() WHERE id=:id"
        ), {"id": tid_task})
        db.session.commit()
        _log('DELETE', 'Onboarding Task', tid_task)
        return {"success": True, "message": "Task deleted"}
    except Exception as e:
        return _err(e)


# ─── EXIT REQUESTS ───
@hr_onboarding_bp.route("/exit-requests", methods=["GET"])
def list_exit_requests():
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        rows = db.session.execute(db.text(
            "SELECT er.id, er.employee_id, e.emp_code, e.first_name, e.last_name, "
            "er.resignation_date, er.last_working_date, er.reason, er.status, "
            "er.exit_interview_done, er.clearances, er.created_at "
            "FROM hr.exit_requests er JOIN hr.employees e ON e.id=er.employee_id "
            "WHERE er.tenant_id=:tid AND er.is_deleted=false ORDER BY er.created_at DESC"
        ), {"tid": tid}).fetchall()
        def parse(v):
            if isinstance(v, dict): return v
            try: return json.loads(v) if v else {}
            except: return {}
        return {"success": True, "data": [
            {"id": str(r[0]), "employee_id": str(r[1]), "emp_code": r[2],
             "employee_name": f"{r[3]} {r[4] or ''}".strip(),
             "resignation_date": str(r[5]) if r[5] else None,
             "last_working_date": str(r[6]) if r[6] else None,
             "reason": r[7] or '', "status": r[8],
             "exit_interview_done": r[9], "clearances": parse(r[10]),
             "created_at": str(r[11]) if r[11] else None}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_onboarding_bp.route("/exit-requests", methods=["POST"])
def create_exit_request():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        eid = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO hr.exit_requests (id, employee_id, resignation_date, last_working_date, "
            "reason, reason_detail, clearances, tenant_id) "
            "VALUES (:id, :emp, :res, :lwd, :reason, :detail, :clearances, :tid)"
        ), {"id": eid, "emp": data["employee_id"],
            "res": data.get("resignation_date"), "lwd": data.get("last_working_date"),
            "reason": data.get("reason", ""), "detail": data.get("reason_detail", ""),
            "clearances": json.dumps({"it": False, "finance": False, "admin": False}),
            "tid": tid})
        db.session.commit()
        _log('CREATE', 'Exit Request', data.get('employee_id', ''), new=data)
        return {"success": True, "data": {"id": eid}, "message": "Exit request initiated"}, 201
    except Exception as e:
        return _err(e)


@hr_onboarding_bp.route("/exit-requests/<eid>", methods=["PUT"])
def update_exit_request(eid):
    data = request.get_json()
    try:
        db.session.execute(db.text(
            "UPDATE hr.exit_requests SET status=:status, exit_interview_done=:eid_done, "
            "exit_interview_notes=:notes, clearances=:clearances, updated_at=NOW() WHERE id=:id"
        ), {"id": eid, "status": data.get("status", "initiated"),
            "eid_done": data.get("exit_interview_done", False),
            "notes": data.get("exit_interview_notes", ""),
            "clearances": json.dumps(data.get("clearances", {}))})
        db.session.commit()
        _log('UPDATE', 'Exit Request', eid, new=data)
        return {"success": True, "message": "Exit request updated"}
    except Exception as e:
        return _err(e)
