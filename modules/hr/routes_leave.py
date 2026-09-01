from flask import Blueprint, request
from extensions import db
import uuid, json

hr_leave_bp = Blueprint("hr_leave", __name__)


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


# ─── LEAVE TYPES ───
@hr_leave_bp.route("/leave-types", methods=["GET"])
def list_leave_types():
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        rows = db.session.execute(db.text(
            "SELECT id, name, code, accrual_type, days_per_year, carry_forward, max_carry_forward, is_paid, applicable_gender, created_at "
            "FROM hr.leave_types WHERE tenant_id=:tid AND is_deleted=false ORDER BY name"
        ), {"tid": tid}).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "name": r[1], "code": r[2], "accrual_type": r[3],
             "days_per_year": float(r[4]) if r[4] else 0, "carry_forward": r[5],
             "max_carry_forward": float(r[6]) if r[6] else 0, "is_paid": r[7],
             "applicable_gender": r[8], "created_at": str(r[9]) if r[9] else None}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_leave_bp.route("/leave-types", methods=["POST"])
def create_leave_type():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    if not data.get("name") or not data.get("code"):
        return {"success": False, "message": "Name and code are required"}, 400
    try:
        lid = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO hr.leave_types (id, name, code, accrual_type, days_per_year, carry_forward, max_carry_forward, is_paid, applicable_gender, tenant_id) "
            "VALUES (:id, :name, :code, :accrual, :days, :cf, :mcf, :paid, :gender, :tid)"
        ), {"id": lid, "name": data["name"], "code": data["code"],
            "accrual": data.get("accrual_type", "manual"),
            "days": data.get("days_per_year", 0), "cf": data.get("carry_forward", False),
            "mcf": data.get("max_carry_forward", 0), "paid": data.get("is_paid", True),
            "gender": data.get("applicable_gender", "all"), "tid": tid})
        db.session.commit()
        _log('CREATE', 'Leave Type', data['name'], new=data)
        return {"success": True, "data": {"id": lid}, "message": "Leave type created"}, 201
    except Exception as e:
        return _err(e)


@hr_leave_bp.route("/leave-types/<lid>", methods=["PUT"])
def update_leave_type(lid):
    data = request.get_json()
    try:
        db.session.execute(db.text(
            "UPDATE hr.leave_types SET name=:name, code=:code, accrual_type=:accrual, days_per_year=:days, "
            "carry_forward=:cf, max_carry_forward=:mcf, is_paid=:paid, applicable_gender=:gender, updated_at=NOW() WHERE id=:id"
        ), {"id": lid, "name": data.get("name"), "code": data.get("code"),
            "accrual": data.get("accrual_type", "manual"), "days": data.get("days_per_year", 0),
            "cf": data.get("carry_forward", False), "mcf": data.get("max_carry_forward", 0),
            "paid": data.get("is_paid", True), "gender": data.get("applicable_gender", "all")})
        db.session.commit()
        _log('UPDATE', 'Leave Type', lid, new=data)
        return {"success": True, "message": "Leave type updated"}
    except Exception as e:
        return _err(e)


@hr_leave_bp.route("/leave-types/<lid>", methods=["DELETE"])
def delete_leave_type(lid):
    try:
        row = db.session.execute(db.text("SELECT name FROM hr.leave_types WHERE id=:id"), {"id": lid}).first()
        db.session.execute(db.text("UPDATE hr.leave_types SET is_deleted=true, updated_at=NOW() WHERE id=:id"), {"id": lid})
        db.session.commit()
        _log('DELETE', 'Leave Type', row[0] if row else lid)
        return {"success": True, "message": "Leave type deleted"}
    except Exception as e:
        return _err(e)


# ─── LEAVE BALANCES ───
@hr_leave_bp.route("/leave-balances", methods=["GET"])
def list_leave_balances():
    tid = request.headers.get("X-Tenant-ID", "")
    emp_id = request.args.get("employee_id")
    year = request.args.get("year")
    where = "WHERE lb.tenant_id=:tid"
    params = {"tid": tid}
    if emp_id:
        where += " AND lb.employee_id=:emp"
        params["emp"] = emp_id
    if year:
        where += " AND lb.year=:year"
        params["year"] = year
    try:
        rows = db.session.execute(db.text(
            f"SELECT lb.id, lb.employee_id, e.emp_code, e.first_name, e.last_name, "
            f"lb.leave_type_id, lt.name as leave_type_name, lb.year, "
            f"lb.total_days, lb.used_days, lb.pending_days, lb.balance_days "
            f"FROM hr.leave_balances lb "
            f"JOIN hr.employees e ON e.id=lb.employee_id "
            f"JOIN hr.leave_types lt ON lt.id=lb.leave_type_id "
            f"{where} ORDER BY e.emp_code, lt.name"
        ), params).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "employee_id": str(r[1]), "emp_code": r[2],
             "employee_name": f"{r[3]} {r[4] or ''}".strip(),
             "leave_type_id": str(r[5]), "leave_type_name": r[6], "year": r[7],
             "total_days": float(r[8]) if r[8] else 0, "used_days": float(r[9]) if r[9] else 0,
             "pending_days": float(r[10]) if r[10] else 0, "balance_days": float(r[11]) if r[11] else 0}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_leave_bp.route("/leave-balances", methods=["POST"])
def upsert_leave_balance():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        existing = db.session.execute(db.text(
            "SELECT id FROM hr.leave_balances WHERE employee_id=:emp AND leave_type_id=:lt AND year=:year AND tenant_id=:tid"
        ), {"emp": data["employee_id"], "lt": data["leave_type_id"], "year": data["year"], "tid": tid}).first()
        if existing:
            db.session.execute(db.text(
                "UPDATE hr.leave_balances SET total_days=:total, used_days=:used, pending_days=:pending, balance_days=:balance, updated_at=NOW() WHERE id=:id"
            ), {"id": str(existing[0]), "total": data.get("total_days", 0), "used": data.get("used_days", 0),
                "pending": data.get("pending_days", 0), "balance": data.get("balance_days", 0)})
        else:
            bid = str(uuid.uuid4())
            db.session.execute(db.text(
                "INSERT INTO hr.leave_balances (id, employee_id, leave_type_id, year, total_days, used_days, pending_days, balance_days, tenant_id) "
                "VALUES (:id, :emp, :lt, :year, :total, :used, :pending, :balance, :tid)"
            ), {"id": bid, "emp": data["employee_id"], "lt": data["leave_type_id"], "year": data["year"],
                "total": data.get("total_days", 0), "used": data.get("used_days", 0),
                "pending": data.get("pending_days", 0), "balance": data.get("balance_days", 0), "tid": tid})
        db.session.commit()
        return {"success": True, "message": "Leave balance saved"}
    except Exception as e:
        return _err(e)


# ─── LEAVE REQUESTS ───
@hr_leave_bp.route("/leave-requests", methods=["GET"])
def list_leave_requests():
    tid = request.headers.get("X-Tenant-ID", "")
    emp_id = request.args.get("employee_id")
    status = request.args.get("status")
    where = "WHERE lr.tenant_id=:tid AND lr.is_deleted=false"
    params = {"tid": tid}
    if emp_id:
        where += " AND lr.employee_id=:emp"
        params["emp"] = emp_id
    if status:
        where += " AND lr.status=:status"
        params["status"] = status
    try:
        rows = db.session.execute(db.text(
            f"SELECT lr.id, lr.employee_id, e.emp_code, e.first_name, e.last_name, "
            f"lr.leave_type, lr.start_date, lr.end_date, lr.days, lr.reason, lr.status, "
            f"lr.approved_by, lr.created_at "
            f"FROM hr.leave_requests lr JOIN hr.employees e ON e.id=lr.employee_id "
            f"{where} ORDER BY lr.created_at DESC"
        ), params).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "employee_id": str(r[1]), "emp_code": r[2],
             "employee_name": f"{r[3]} {r[4] or ''}".strip(),
             "leave_type": r[5], "start_date": str(r[6]), "end_date": str(r[7]),
             "days": float(r[8]) if r[8] else 0, "reason": r[9] or '',
             "status": r[10], "approved_by": r[11] or '',
             "created_at": str(r[12]) if r[12] else None}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_leave_bp.route("/leave-requests", methods=["POST"])
def create_leave_request():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    if not data.get("employee_id") or not data.get("start_date") or not data.get("end_date"):
        return {"success": False, "message": "employee_id, start_date, end_date are required"}, 400
    try:
        lid = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO hr.leave_requests (id, employee_id, leave_type_id, leave_type, start_date, end_date, days, reason, tenant_id, created_by) "
            "VALUES (:id, :emp, :lt_id, :lt, :sd, :ed, :days, :reason, :tid, :by)"
        ), {"id": lid, "emp": data["employee_id"], "lt_id": data.get("leave_type_id"),
            "lt": data.get("leave_type", ""), "sd": data["start_date"], "ed": data["end_date"],
            "days": data.get("days", 1), "reason": data.get("reason", ""),
            "tid": tid, "by": request.headers.get('X-User-Name', '')})
        db.session.commit()
        _log('CREATE', 'Leave Request', data.get('employee_id', ''), new=data)
        return {"success": True, "data": {"id": lid}, "message": "Leave request submitted"}, 201
    except Exception as e:
        return _err(e)


@hr_leave_bp.route("/leave-requests/<lid>/approve", methods=["POST"])
def approve_leave(lid):
    try:
        row = db.session.execute(db.text(
            "SELECT employee_id FROM hr.leave_requests WHERE id=:id"
        ), {"id": lid}).first()
        if not row:
            return {"success": False, "message": "Request not found"}, 404
        db.session.execute(db.text(
            "UPDATE hr.leave_requests SET status='approved', approved_by=:by, approved_at=NOW(), updated_at=NOW() WHERE id=:id"
        ), {"id": lid, "by": request.headers.get('X-User-Name', '')})
        db.session.commit()
        _log('APPROVE', 'Leave Request', lid)
        return {"success": True, "message": "Leave approved"}
    except Exception as e:
        return _err(e)


@hr_leave_bp.route("/leave-requests/<lid>/reject", methods=["POST"])
def reject_leave(lid):
    data = request.get_json() or {}
    try:
        db.session.execute(db.text(
            "UPDATE hr.leave_requests SET status='rejected', approved_by=:by, approved_at=NOW(), "
            "rejection_reason=:reason, updated_at=NOW() WHERE id=:id"
        ), {"id": lid, "by": request.headers.get('X-User-Name', ''), "reason": data.get("reason", "")})
        db.session.commit()
        _log('REJECT', 'Leave Request', lid)
        return {"success": True, "message": "Leave rejected"}
    except Exception as e:
        return _err(e)


@hr_leave_bp.route("/leave-requests/<lid>", methods=["DELETE"])
def cancel_leave(lid):
    try:
        db.session.execute(db.text(
            "UPDATE hr.leave_requests SET status='cancelled', is_deleted=true, updated_at=NOW() WHERE id=:id"
        ), {"id": lid})
        db.session.commit()
        _log('CANCEL', 'Leave Request', lid)
        return {"success": True, "message": "Leave request cancelled"}
    except Exception as e:
        return _err(e)


# ─── HOLIDAYS ───
@hr_leave_bp.route("/holidays", methods=["GET"])
def list_holidays():
    tid = request.headers.get("X-Tenant-ID", "")
    year = request.args.get("year")
    where = "WHERE tenant_id=:tid AND is_deleted=false"
    params = {"tid": tid}
    if year:
        where += " AND year=:year"
        params["year"] = year
    try:
        rows = db.session.execute(db.text(
            f"SELECT id, name, date, holiday_type, location, year FROM hr.holidays {where} ORDER BY date"
        ), params).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "name": r[1], "date": str(r[2]), "holiday_type": r[3],
             "location": r[4] or '', "year": r[5]}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_leave_bp.route("/holidays", methods=["POST"])
def create_holiday():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        hid = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO hr.holidays (id, name, date, holiday_type, location, year, tenant_id) "
            "VALUES (:id, :name, :date, :type, :loc, :year, :tid)"
        ), {"id": hid, "name": data["name"], "date": data["date"],
            "type": data.get("holiday_type", "national"), "loc": data.get("location", ""),
            "year": data.get("year", 2025), "tid": tid})
        db.session.commit()
        _log('CREATE', 'Holiday', data['name'], new=data)
        return {"success": True, "data": {"id": hid}, "message": "Holiday added"}, 201
    except Exception as e:
        return _err(e)


@hr_leave_bp.route("/holidays/<hid>", methods=["DELETE"])
def delete_holiday(hid):
    try:
        row = db.session.execute(db.text("SELECT name FROM hr.holidays WHERE id=:id"), {"id": hid}).first()
        db.session.execute(db.text("UPDATE hr.holidays SET is_deleted=true, updated_at=NOW() WHERE id=:id"), {"id": hid})
        db.session.commit()
        _log('DELETE', 'Holiday', row[0] if row else hid)
        return {"success": True, "message": "Holiday deleted"}
    except Exception as e:
        return _err(e)


# ─── LEAVE CALENDAR ───
@hr_leave_bp.route("/leave-calendar", methods=["GET"])
def leave_calendar():
    tid = request.headers.get("X-Tenant-ID", "")
    month = request.args.get("month")
    year = request.args.get("year")
    try:
        rows = db.session.execute(db.text(
            "SELECT lr.id, lr.employee_id, e.emp_code, e.first_name, e.last_name, "
            "lr.leave_type, lr.start_date, lr.end_date, lr.days, lr.status "
            "FROM hr.leave_requests lr JOIN hr.employees e ON e.id=lr.employee_id "
            "WHERE lr.tenant_id=:tid AND lr.is_deleted=false AND lr.status IN ('approved','pending') "
            "AND (EXTRACT(MONTH FROM lr.start_date)=:month OR EXTRACT(MONTH FROM lr.end_date)=:month) "
            "AND (EXTRACT(YEAR FROM lr.start_date)=:year OR EXTRACT(YEAR FROM lr.end_date)=:year) "
            "ORDER BY lr.start_date"
        ), {"tid": tid, "month": month or 1, "year": year or 2025}).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "employee_id": str(r[1]), "emp_code": r[2],
             "employee_name": f"{r[3]} {r[4] or ''}".strip(),
             "leave_type": r[5], "start_date": str(r[6]), "end_date": str(r[7]),
             "days": float(r[8]) if r[8] else 0, "status": r[9]}
            for r in rows]}
    except Exception as e:
        return _err(e)
