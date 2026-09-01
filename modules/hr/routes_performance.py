from flask import Blueprint, request
from extensions import db
import uuid, json

hr_performance_bp = Blueprint("hr_performance", __name__)


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


# ─── REVIEW CYCLES ───
@hr_performance_bp.route("/review-cycles", methods=["GET"])
def list_review_cycles():
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        rows = db.session.execute(db.text(
            "SELECT id, name, cycle_type, start_date, end_date, status, created_at "
            "FROM hr.review_cycles WHERE tenant_id=:tid AND is_deleted=false ORDER BY created_at DESC"
        ), {"tid": tid}).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "name": r[1], "cycle_type": r[2],
             "start_date": str(r[3]) if r[3] else None, "end_date": str(r[4]) if r[4] else None,
             "status": r[5], "created_at": str(r[6]) if r[6] else None}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_performance_bp.route("/review-cycles", methods=["POST"])
def create_review_cycle():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        cid = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO hr.review_cycles (id, name, cycle_type, start_date, end_date, tenant_id) "
            "VALUES (:id, :name, :type, :sd, :ed, :tid)"
        ), {"id": cid, "name": data["name"], "type": data.get("cycle_type", "annual"),
            "sd": data.get("start_date"), "ed": data.get("end_date"), "tid": tid})
        db.session.commit()
        _log('CREATE', 'Review Cycle', data['name'], new=data)
        return {"success": True, "data": {"id": cid}, "message": "Review cycle created"}, 201
    except Exception as e:
        return _err(e)


@hr_performance_bp.route("/review-cycles/<cid>", methods=["PUT"])
def update_review_cycle(cid):
    data = request.get_json()
    try:
        db.session.execute(db.text(
            "UPDATE hr.review_cycles SET name=:name, cycle_type=:type, start_date=:sd, "
            "end_date=:ed, status=:status, updated_at=NOW() WHERE id=:id"
        ), {"id": cid, "name": data.get("name"), "type": data.get("cycle_type", "annual"),
            "sd": data.get("start_date"), "ed": data.get("end_date"),
            "status": data.get("status", "active")})
        db.session.commit()
        _log('UPDATE', 'Review Cycle', cid, new=data)
        return {"success": True, "message": "Review cycle updated"}
    except Exception as e:
        return _err(e)


# ─── PERFORMANCE GOALS ───
@hr_performance_bp.route("/performance-goals", methods=["GET"])
def list_goals():
    tid = request.headers.get("X-Tenant-ID", "")
    emp_id = request.args.get("employee_id")
    where = "WHERE pg.tenant_id=:tid AND pg.is_deleted=false"
    params = {"tid": tid}
    if emp_id:
        where += " AND pg.employee_id=:emp"
        params["emp"] = emp_id
    try:
        rows = db.session.execute(db.text(
            f"SELECT pg.id, pg.employee_id, e.emp_code, e.first_name, e.last_name, "
            f"pg.title, pg.goal_type, pg.target_value, pg.actual_value, pg.weight, "
            f"pg.start_date, pg.end_date, pg.status, pg.created_at "
            f"FROM hr.performance_goals pg JOIN hr.employees e ON e.id=pg.employee_id "
            f"{where} ORDER BY pg.created_at DESC"
        ), params).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "employee_id": str(r[1]), "emp_code": r[2],
             "employee_name": f"{r[3]} {r[4] or ''}".strip(),
             "title": r[5], "goal_type": r[6], "target_value": r[7] or '',
             "actual_value": r[8] or '', "weight": float(r[9]) if r[9] else 0,
             "start_date": str(r[10]) if r[10] else None, "end_date": str(r[11]) if r[11] else None,
             "status": r[12], "created_at": str(r[13]) if r[13] else None}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_performance_bp.route("/performance-goals", methods=["POST"])
def create_goal():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        gid = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO hr.performance_goals (id, employee_id, title, description, goal_type, "
            "target_value, weight, start_date, end_date, review_cycle_id, tenant_id) "
            "VALUES (:id, :emp, :title, :desc, :type, :target, :weight, :sd, :ed, :cycle, :tid)"
        ), {"id": gid, "emp": data["employee_id"], "title": data["title"],
            "desc": data.get("description", ""), "type": data.get("goal_type", "kra"),
            "target": data.get("target_value", ""), "weight": data.get("weight", 0),
            "sd": data.get("start_date"), "ed": data.get("end_date"),
            "cycle": data.get("review_cycle_id"), "tid": tid})
        db.session.commit()
        _log('CREATE', 'Performance Goal', data.get('employee_id', ''), new=data)
        return {"success": True, "data": {"id": gid}, "message": "Goal created"}, 201
    except Exception as e:
        return _err(e)


@hr_performance_bp.route("/performance-goals/<gid>", methods=["PUT"])
def update_goal(gid):
    data = request.get_json()
    try:
        db.session.execute(db.text(
            "UPDATE hr.performance_goals SET title=:title, target_value=:target, actual_value=:actual, "
            "weight=:weight, status=:status, updated_at=NOW() WHERE id=:id"
        ), {"id": gid, "title": data.get("title"), "target": data.get("target_value", ""),
            "actual": data.get("actual_value", ""), "weight": data.get("weight", 0),
            "status": data.get("status", "active")})
        db.session.commit()
        _log('UPDATE', 'Performance Goal', gid, new=data)
        return {"success": True, "message": "Goal updated"}
    except Exception as e:
        return _err(e)


@hr_performance_bp.route("/performance-goals/<gid>", methods=["DELETE"])
def delete_goal(gid):
    try:
        db.session.execute(db.text(
            "UPDATE hr.performance_goals SET is_deleted=true, updated_at=NOW() WHERE id=:id"
        ), {"id": gid})
        db.session.commit()
        _log('DELETE', 'Performance Goal', gid)
        return {"success": True, "message": "Goal deleted"}
    except Exception as e:
        return _err(e)


# ─── PERFORMANCE REVIEWS ───
@hr_performance_bp.route("/performance-reviews", methods=["GET"])
def list_reviews():
    tid = request.headers.get("X-Tenant-ID", "")
    emp_id = request.args.get("employee_id")
    where = "WHERE pr.tenant_id=:tid AND pr.is_deleted=false"
    params = {"tid": tid}
    if emp_id:
        where += " AND pr.employee_id=:emp"
        params["emp"] = emp_id
    try:
        rows = db.session.execute(db.text(
            f"SELECT pr.id, pr.employee_id, e.emp_code, e.first_name, e.last_name, "
            f"pr.review_type, pr.overall_rating, pr.self_rating, pr.manager_rating, "
            f"pr.status, pr.submitted_at, pr.created_at "
            f"FROM hr.performance_reviews pr JOIN hr.employees e ON e.id=pr.employee_id "
            f"{where} ORDER BY pr.created_at DESC"
        ), params).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "employee_id": str(r[1]), "emp_code": r[2],
             "employee_name": f"{r[3]} {r[4] or ''}".strip(),
             "review_type": r[5], "overall_rating": float(r[6]) if r[6] else None,
             "self_rating": float(r[7]) if r[7] else None,
             "manager_rating": float(r[8]) if r[8] else None,
             "status": r[9], "submitted_at": str(r[10]) if r[10] else None,
             "created_at": str(r[11]) if r[11] else None}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_performance_bp.route("/performance-reviews", methods=["POST"])
def create_review():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        rid = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO hr.performance_reviews (id, employee_id, reviewer_id, review_cycle_id, "
            "review_type, self_rating, manager_rating, overall_rating, feedback, strengths, improvements, tenant_id) "
            "VALUES (:id, :emp, :reviewer, :cycle, :type, :self_r, :mgr_r, :overall, :feedback, :strengths, :improve, :tid)"
        ), {"id": rid, "emp": data["employee_id"],
            "reviewer": request.headers.get('X-User-Email', ''),
            "cycle": data.get("review_cycle_id"), "type": data.get("review_type", "manager"),
            "self_r": data.get("self_rating"), "mgr_r": data.get("manager_rating"),
            "overall": data.get("overall_rating"), "feedback": data.get("feedback", ""),
            "strengths": data.get("strengths", ""), "improve": data.get("improvements", ""),
            "tid": tid})
        db.session.commit()
        _log('CREATE', 'Performance Review', data.get('employee_id', ''), new=data)
        return {"success": True, "data": {"id": rid}, "message": "Review submitted"}, 201
    except Exception as e:
        return _err(e)


@hr_performance_bp.route("/performance-reviews/<rid>", methods=["PUT"])
def update_review(rid):
    data = request.get_json()
    try:
        db.session.execute(db.text(
            "UPDATE hr.performance_reviews SET self_rating=:self_r, manager_rating=:mgr_r, "
            "overall_rating=:overall, feedback=:feedback, strengths=:strengths, "
            "improvements=:improve, status=:status, updated_at=NOW() WHERE id=:id"
        ), {"id": rid, "self_r": data.get("self_rating"), "mgr_r": data.get("manager_rating"),
            "overall": data.get("overall_rating"), "feedback": data.get("feedback", ""),
            "strengths": data.get("strengths", ""), "improve": data.get("improvements", ""),
            "status": data.get("status", "pending")})
        db.session.commit()
        _log('UPDATE', 'Performance Review', rid, new=data)
        return {"success": True, "message": "Review updated"}
    except Exception as e:
        return _err(e)
