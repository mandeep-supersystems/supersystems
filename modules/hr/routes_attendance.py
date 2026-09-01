from flask import Blueprint, request
from extensions import db
import uuid, json

hr_attendance_bp = Blueprint("hr_attendance", __name__)


def _log(action, etype, eid, old=None, new=None):
    try:
        ip = (request.headers.get('X-Forwarded-For', '') or request.remote_addr or '').split(',')[0].strip()
        extra = {}
        if old: extra['old'] = old
        if new: extra['new'] = new
        db.session.execute(db.text(
            "INSERT INTO audit.logs (id, action, module, entity_type, entity_id, ip_address, tenant_id, user_email, user_name, extra_data, created_at) "
            "VALUES (gen_random_uuid(), :action, 'HR', :etype, :eid, :ip, :tid, :email, :name, :extra, NOW())"
        ), {"action": action, "etype": etype, "eid": str(eid),
            "ip": ip, "tid": request.headers.get('X-Tenant-ID', ''),
            "email": request.headers.get('X-User-Email', ''),
            "name": request.headers.get('X-User-Name', ''),
            "extra": json.dumps(extra) if extra else None})
    except Exception:
        pass


def _err(e):
    db.session.rollback()
    return {"success": False, "message": str(e), "data": []}, 500


# ─── SHIFTS ───
@hr_attendance_bp.route("/shifts", methods=["GET"])
def list_shifts():
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        rows = db.session.execute(db.text(
            "SELECT id, name, start_time, end_time, break_minutes, is_night_shift, created_at "
            "FROM hr.shifts WHERE tenant_id=:tid AND is_deleted=false ORDER BY name"
        ), {"tid": tid}).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "name": r[1], "start_time": str(r[2]), "end_time": str(r[3]),
             "break_minutes": r[4], "is_night_shift": r[5], "created_at": str(r[6]) if r[6] else None}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_attendance_bp.route("/shifts", methods=["POST"])
def create_shift():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    if not data.get("name") or not data.get("start_time") or not data.get("end_time"):
        return {"success": False, "message": "Name, start_time and end_time are required"}, 400
    try:
        sid = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO hr.shifts (id, name, start_time, end_time, break_minutes, is_night_shift, tenant_id) "
            "VALUES (:id, :name, :st, :et, :brk, :night, :tid)"
        ), {"id": sid, "name": data["name"], "st": data["start_time"], "et": data["end_time"],
            "brk": data.get("break_minutes", 30), "night": data.get("is_night_shift", False), "tid": tid})
        db.session.commit()
        _log('CREATE', 'Shift', data['name'], new={"name": data["name"]})
        return {"success": True, "data": {"id": sid}, "message": "Shift created"}, 201
    except Exception as e:
        return _err(e)


@hr_attendance_bp.route("/shifts/<sid>", methods=["PUT"])
def update_shift(sid):
    data = request.get_json()
    try:
        old = db.session.execute(db.text("SELECT name, start_time, end_time FROM hr.shifts WHERE id=:id"), {"id": sid}).first()
        old_v = {"name": old[0], "start_time": str(old[1]), "end_time": str(old[2])} if old else {}
        db.session.execute(db.text(
            "UPDATE hr.shifts SET name=:name, start_time=:st, end_time=:et, break_minutes=:brk, is_night_shift=:night, updated_at=NOW() WHERE id=:id"
        ), {"id": sid, "name": data.get("name"), "st": data.get("start_time"), "et": data.get("end_time"),
            "brk": data.get("break_minutes", 30), "night": data.get("is_night_shift", False)})
        db.session.commit()
        _log('UPDATE', 'Shift', old_v.get('name', sid), old=old_v, new=data)
        return {"success": True, "message": "Shift updated"}
    except Exception as e:
        return _err(e)


@hr_attendance_bp.route("/shifts/<sid>", methods=["DELETE"])
def delete_shift(sid):
    try:
        row = db.session.execute(db.text("SELECT name FROM hr.shifts WHERE id=:id"), {"id": sid}).first()
        db.session.execute(db.text("UPDATE hr.shifts SET is_deleted=true, updated_at=NOW() WHERE id=:id"), {"id": sid})
        db.session.commit()
        _log('DELETE', 'Shift', row[0] if row else sid)
        return {"success": True, "message": "Shift deleted"}
    except Exception as e:
        return _err(e)


# ─── ROSTER ───
@hr_attendance_bp.route("/roster", methods=["GET"])
def get_roster():
    tid = request.headers.get("X-Tenant-ID", "")
    month = request.args.get("month")
    year = request.args.get("year")
    try:
        rows = db.session.execute(db.text(
            "SELECT r.id, r.employee_id, e.emp_code, e.first_name, e.last_name, "
            "r.shift_id, s.name as shift_name, r.roster_date "
            "FROM hr.shift_roster r "
            "JOIN hr.employees e ON e.id=r.employee_id "
            "JOIN hr.shifts s ON s.id=r.shift_id "
            "WHERE r.tenant_id=:tid "
            "AND EXTRACT(MONTH FROM r.roster_date)=:month AND EXTRACT(YEAR FROM r.roster_date)=:year "
            "ORDER BY r.roster_date, e.emp_code"
        ), {"tid": tid, "month": month or 1, "year": year or 2025}).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "employee_id": str(r[1]), "emp_code": r[2],
             "employee_name": f"{r[3]} {r[4] or ''}".strip(),
             "shift_id": str(r[5]), "shift_name": r[6], "roster_date": str(r[7])}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_attendance_bp.route("/roster", methods=["POST"])
def assign_roster():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        rid = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO hr.shift_roster (id, employee_id, shift_id, roster_date, tenant_id, created_by) "
            "VALUES (:id, :emp, :shift, :date, :tid, :by) ON CONFLICT DO NOTHING"
        ), {"id": rid, "emp": data["employee_id"], "shift": data["shift_id"],
            "date": data["roster_date"], "tid": tid,
            "by": request.headers.get('X-User-Name', '')})
        db.session.commit()
        _log('CREATE', 'Roster', data.get('employee_id', ''), new=data)
        return {"success": True, "message": "Roster assigned"}, 201
    except Exception as e:
        return _err(e)


# ─── ATTENDANCE ───
@hr_attendance_bp.route("/attendance", methods=["GET"])
def list_attendance():
    tid = request.headers.get("X-Tenant-ID", "")
    emp_id = request.args.get("employee_id")
    month = request.args.get("month")
    year = request.args.get("year")
    where = "WHERE a.tenant_id=:tid AND a.is_deleted=false"
    params = {"tid": tid}
    if emp_id:
        where += " AND a.employee_id=:emp"
        params["emp"] = emp_id
    if month and year:
        where += " AND EXTRACT(MONTH FROM a.date)=:month AND EXTRACT(YEAR FROM a.date)=:year"
        params["month"] = month
        params["year"] = year
    try:
        rows = db.session.execute(db.text(
            f"SELECT a.id, a.employee_id, e.emp_code, e.first_name, e.last_name, "
            f"a.date, a.check_in, a.check_out, a.hours_worked, a.status, a.check_in_method, a.remarks "
            f"FROM hr.attendance a JOIN hr.employees e ON e.id=a.employee_id {where} ORDER BY a.date DESC"
        ), params).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "employee_id": str(r[1]), "emp_code": r[2],
             "employee_name": f"{r[3]} {r[4] or ''}".strip(),
             "date": str(r[5]), "check_in": str(r[6]) if r[6] else None,
             "check_out": str(r[7]) if r[7] else None, "hours_worked": float(r[8]) if r[8] else 0,
             "status": r[9], "check_in_method": r[10], "remarks": r[11] or ''}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_attendance_bp.route("/attendance/checkin", methods=["POST"])
def clock_in():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    emp_id = data.get("employee_id")
    today = data.get("date")
    try:
        existing = db.session.execute(db.text(
            "SELECT id, check_in FROM hr.attendance WHERE employee_id=:emp AND date=:date AND is_deleted=false"
        ), {"emp": emp_id, "date": today}).first()
        if existing and existing[1]:
            return {"success": False, "message": "Already checked in today"}, 409
        aid = str(uuid.uuid4())
        if existing:
            db.session.execute(db.text(
                "UPDATE hr.attendance SET check_in=NOW(), check_in_method=:method, updated_at=NOW() WHERE id=:id"
            ), {"id": str(existing[0]), "method": data.get("method", "web")})
        else:
            db.session.execute(db.text(
                "INSERT INTO hr.attendance (id, employee_id, date, check_in, check_in_method, status, tenant_id) "
                "VALUES (:id, :emp, :date, NOW(), :method, 'present', :tid)"
            ), {"id": aid, "emp": emp_id, "date": today, "method": data.get("method", "web"), "tid": tid})
        db.session.commit()
        _log('CHECKIN', 'Attendance', emp_id)
        return {"success": True, "message": "Checked in successfully"}
    except Exception as e:
        return _err(e)


@hr_attendance_bp.route("/attendance/checkout", methods=["POST"])
def clock_out():
    data = request.get_json()
    emp_id = data.get("employee_id")
    today = data.get("date")
    try:
        row = db.session.execute(db.text(
            "SELECT id, check_in FROM hr.attendance WHERE employee_id=:emp AND date=:date AND is_deleted=false"
        ), {"emp": emp_id, "date": today}).first()
        if not row or not row[1]:
            return {"success": False, "message": "No check-in found for today"}, 404
        db.session.execute(db.text(
            "UPDATE hr.attendance SET check_out=NOW(), "
            "hours_worked=EXTRACT(EPOCH FROM (NOW() - check_in))/3600, updated_at=NOW() WHERE id=:id"
        ), {"id": str(row[0])})
        db.session.commit()
        _log('CHECKOUT', 'Attendance', emp_id)
        return {"success": True, "message": "Checked out successfully"}
    except Exception as e:
        return _err(e)


@hr_attendance_bp.route("/attendance/<aid>", methods=["PUT"])
def update_attendance(aid):
    data = request.get_json()
    try:
        db.session.execute(db.text(
            "UPDATE hr.attendance SET status=:status, remarks=:remarks, updated_at=NOW() WHERE id=:id"
        ), {"id": aid, "status": data.get("status"), "remarks": data.get("remarks", "")})
        db.session.commit()
        _log('UPDATE', 'Attendance', aid, new=data)
        return {"success": True, "message": "Attendance updated"}
    except Exception as e:
        return _err(e)


# ─── REGULARIZATION ───
@hr_attendance_bp.route("/regularization", methods=["GET"])
def list_regularization():
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        rows = db.session.execute(db.text(
            "SELECT r.id, r.employee_id, e.emp_code, e.first_name, e.last_name, "
            "r.attendance_date, r.requested_check_in, r.requested_check_out, r.reason, r.status, r.created_at "
            "FROM hr.regularization_requests r JOIN hr.employees e ON e.id=r.employee_id "
            "WHERE r.tenant_id=:tid ORDER BY r.created_at DESC"
        ), {"tid": tid}).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "employee_id": str(r[1]), "emp_code": r[2],
             "employee_name": f"{r[3]} {r[4] or ''}".strip(),
             "attendance_date": str(r[5]), "requested_check_in": str(r[6]) if r[6] else None,
             "requested_check_out": str(r[7]) if r[7] else None,
             "reason": r[8], "status": r[9], "created_at": str(r[10]) if r[10] else None}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_attendance_bp.route("/regularization", methods=["POST"])
def create_regularization():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        rid = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO hr.regularization_requests (id, employee_id, attendance_date, requested_check_in, "
            "requested_check_out, reason, tenant_id, created_by) VALUES (:id, :emp, :date, :ci, :co, :reason, :tid, :by)"
        ), {"id": rid, "emp": data["employee_id"], "date": data["attendance_date"],
            "ci": data.get("requested_check_in"), "co": data.get("requested_check_out"),
            "reason": data["reason"], "tid": tid, "by": request.headers.get('X-User-Name', '')})
        db.session.commit()
        _log('CREATE', 'Regularization', data.get('employee_id', ''), new=data)
        return {"success": True, "data": {"id": rid}, "message": "Regularization request submitted"}, 201
    except Exception as e:
        return _err(e)


@hr_attendance_bp.route("/regularization/<rid>/approve", methods=["POST"])
def approve_regularization(rid):
    try:
        row = db.session.execute(db.text(
            "SELECT employee_id, attendance_date, requested_check_in, requested_check_out "
            "FROM hr.regularization_requests WHERE id=:id"
        ), {"id": rid}).first()
        if not row:
            return {"success": False, "message": "Request not found"}, 404
        db.session.execute(db.text(
            "UPDATE hr.regularization_requests SET status='approved', approved_by=:by, approved_at=NOW(), updated_at=NOW() WHERE id=:id"
        ), {"id": rid, "by": request.headers.get('X-User-Name', '')})
        existing = db.session.execute(db.text(
            "SELECT id FROM hr.attendance WHERE employee_id=:emp AND date=:date AND is_deleted=false"
        ), {"emp": str(row[0]), "date": row[1]}).first()
        if existing:
            db.session.execute(db.text(
                "UPDATE hr.attendance SET check_in=:ci, check_out=:co, updated_at=NOW() WHERE id=:id"
            ), {"id": str(existing[0]), "ci": row[2], "co": row[3]})
        db.session.commit()
        _log('APPROVE', 'Regularization', rid)
        return {"success": True, "message": "Regularization approved and attendance updated"}
    except Exception as e:
        return _err(e)


@hr_attendance_bp.route("/regularization/<rid>/reject", methods=["POST"])
def reject_regularization(rid):
    try:
        db.session.execute(db.text(
            "UPDATE hr.regularization_requests SET status='rejected', approved_by=:by, approved_at=NOW(), updated_at=NOW() WHERE id=:id"
        ), {"id": rid, "by": request.headers.get('X-User-Name', '')})
        db.session.commit()
        _log('REJECT', 'Regularization', rid)
        return {"success": True, "message": "Regularization rejected"}
    except Exception as e:
        return _err(e)


# ─── ATTENDANCE SUMMARY ───
@hr_attendance_bp.route("/attendance/summary", methods=["GET"])
def attendance_summary():
    tid = request.headers.get("X-Tenant-ID", "")
    month = request.args.get("month", 1)
    year = request.args.get("year", 2025)
    try:
        rows = db.session.execute(db.text(
            "SELECT e.emp_code, e.first_name, e.last_name, "
            "COUNT(CASE WHEN a.status='present' THEN 1 END) as present, "
            "COUNT(CASE WHEN a.status='absent' THEN 1 END) as absent, "
            "COUNT(CASE WHEN a.status='half_day' THEN 1 END) as half_day, "
            "COUNT(CASE WHEN a.status='leave' THEN 1 END) as on_leave, "
            "ROUND(AVG(a.hours_worked)::numeric, 2) as avg_hours "
            "FROM hr.employees e LEFT JOIN hr.attendance a ON a.employee_id=e.id "
            "AND EXTRACT(MONTH FROM a.date)=:month AND EXTRACT(YEAR FROM a.date)=:year AND a.is_deleted=false "
            "WHERE (e.tenant_id=:tid OR e.tenant_id='' OR e.tenant_id IS NULL) AND e.is_deleted=false "
            "GROUP BY e.emp_code, e.first_name, e.last_name ORDER BY e.emp_code"
        ), {"tid": tid, "month": month, "year": year}).fetchall()
        return {"success": True, "data": [
            {"emp_code": r[0], "name": f"{r[1]} {r[2] or ''}".strip(),
             "present": r[3] or 0, "absent": r[4] or 0, "half_day": r[5] or 0,
             "on_leave": r[6] or 0, "avg_hours": float(r[7]) if r[7] else 0}
            for r in rows]}
    except Exception as e:
        return _err(e)
