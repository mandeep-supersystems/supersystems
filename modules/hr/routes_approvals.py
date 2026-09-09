from flask import Blueprint, request
from extensions import db

hr_approvals_bp = Blueprint("hr_approvals", __name__)

from modules.hr.audit import log_hr_audit

def _log(action, etype, eid, old=None, new=None):
    log_hr_audit(action, etype, eid, old_values=old, new_values=new)

def _err(e):
    db.session.rollback()
    return {"success": False, "message": str(e), "data": []}, 500


@hr_approvals_bp.route("/approvals/summary", methods=["GET"])
def approvals_summary():
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        pending_leaves = db.session.execute(db.text(
            "SELECT COUNT(*) FROM hr.leave_requests WHERE tenant_id = :tid AND is_deleted = false AND status = 'pending'"
        ), {"tid": tid}).scalar() or 0
        try:
            pending_reviews = db.session.execute(db.text(
                "SELECT COUNT(*) FROM hr.performance_reviews WHERE tenant_id = :tid AND is_deleted = false AND status = 'pending'"
            ), {"tid": tid}).scalar() or 0
        except Exception:
            pending_reviews = 0
        approved_today = db.session.execute(db.text(
            "SELECT COUNT(*) FROM hr.leave_requests WHERE tenant_id = :tid AND is_deleted = false AND status = 'approved' AND DATE(approved_at) = CURRENT_DATE"
        ), {"tid": tid}).scalar() or 0
        return {"success": True, "data": {
            "pending_leaves": int(pending_leaves),
            "pending_reviews": int(pending_reviews),
            "approved_today": int(approved_today),
            "total_pending": int(pending_leaves) + int(pending_reviews)
        }}
    except Exception as e:
        return _err(e)


@hr_approvals_bp.route("/approvals/leaves", methods=["GET"])
def pending_leave_approvals():
    tid = request.headers.get("X-Tenant-ID", "")
    status_filter = request.args.get("status", "pending")
    emp_filter = request.args.get("employee_id", "")
    try:
        where = "WHERE lr.tenant_id = :tid AND lr.is_deleted = false"
        params = {"tid": tid}
        if status_filter and status_filter != "all":
            where += " AND lr.status = :status"
            params["status"] = status_filter
        if emp_filter:
            where += " AND lr.employee_id = :emp"
            params["emp"] = emp_filter
        rows = db.session.execute(db.text(
            f"SELECT lr.id, lr.employee_id, e.emp_code, e.first_name, e.last_name, "
            f"e.designation, e.department_id, "
            f"lr.leave_type, lr.start_date, lr.end_date, lr.days, lr.reason, lr.status, "
            f"lr.approved_by, lr.rejection_reason, lr.created_at, lr.approved_at "
            f"FROM hr.leave_requests lr "
            f"JOIN hr.employees e ON e.id = lr.employee_id "
            f"{where} ORDER BY lr.created_at DESC LIMIT 200"
        ), params).fetchall()
        return {"success": True, "data": [{
            "id": str(r[0]),
            "employee_id": str(r[1]),
            "emp_code": r[2] or "",
            "employee_name": f"{r[3]} {r[4] or ''}".strip(),
            "designation": r[5] or "",
            "department": r[6] or "",
            "leave_type": r[7] or "",
            "start_date": str(r[8]) if r[8] else "",
            "end_date": str(r[9]) if r[9] else "",
            "days": float(r[10]) if r[10] else 0,
            "reason": r[11] or "",
            "status": r[12] or "pending",
            "approved_by": r[13] or "",
            "rejection_reason": r[14] or "",
            "created_at": str(r[15]) if r[15] else None,
            "approved_at": str(r[16]) if r[16] else None
        } for r in rows]}
    except Exception as e:
        return _err(e)


@hr_approvals_bp.route("/approvals/leaves/<lid>/approve", methods=["POST"])
def approve_leave_request(lid):
    try:
        row = db.session.execute(db.text(
            "SELECT employee_id, status FROM hr.leave_requests WHERE id = :id"
        ), {"id": lid}).first()
        if not row:
            return {"success": False, "message": "Leave request not found"}, 404
        if row[1] == "approved":
            return {"success": False, "message": "Already approved"}, 400
        by = request.headers.get("X-User-Name", "") or request.headers.get("X-User-Email", "")
        db.session.execute(db.text(
            "UPDATE hr.leave_requests SET status = 'approved', approved_by = :by, "
            "approved_at = NOW(), updated_at = NOW() WHERE id = :id"
        ), {"id": lid, "by": by})
        db.session.commit()
        _log("APPROVE", "Leave Request", lid)
        return {"success": True, "message": "Leave approved"}
    except Exception as e:
        return _err(e)


@hr_approvals_bp.route("/approvals/leaves/<lid>/reject", methods=["POST"])
def reject_leave_request(lid):
    data = request.get_json() or {}
    try:
        by = request.headers.get("X-User-Name", "") or request.headers.get("X-User-Email", "")
        db.session.execute(db.text(
            "UPDATE hr.leave_requests SET status = 'rejected', approved_by = :by, "
            "approved_at = NOW(), rejection_reason = :reason, updated_at = NOW() WHERE id = :id"
        ), {"id": lid, "by": by, "reason": data.get("reason", "")})
        db.session.commit()
        _log("REJECT", "Leave Request", lid)
        return {"success": True, "message": "Leave rejected"}
    except Exception as e:
        return _err(e)


@hr_approvals_bp.route("/approvals/reviews", methods=["GET"])
def pending_review_approvals():
    tid = request.headers.get("X-Tenant-ID", "")
    status_filter = request.args.get("status", "pending")
    try:
        where = "WHERE pr.tenant_id = :tid AND pr.is_deleted = false"
        params = {"tid": tid}
        if status_filter and status_filter != "all":
            where += " AND pr.status = :status"
            params["status"] = status_filter
        rows = db.session.execute(db.text(
            f"SELECT pr.id, pr.employee_id, e.emp_code, e.first_name, e.last_name, "
            f"e.designation, e.department_id, "
            f"pr.review_type, pr.self_rating, pr.manager_rating, pr.overall_rating, "
            f"pr.feedback, pr.status, pr.reviewer_id, pr.submitted_at, pr.created_at "
            f"FROM hr.performance_reviews pr "
            f"JOIN hr.employees e ON e.id = pr.employee_id "
            f"{where} ORDER BY pr.created_at DESC LIMIT 200"
        ), params).fetchall()
        return {"success": True, "data": [{
            "id": str(r[0]),
            "employee_id": str(r[1]),
            "emp_code": r[2] or "",
            "employee_name": f"{r[3]} {r[4] or ''}".strip(),
            "designation": r[5] or "",
            "department": r[6] or "",
            "review_type": r[7] or "",
            "self_rating": float(r[8]) if r[8] is not None else None,
            "manager_rating": float(r[9]) if r[9] is not None else None,
            "overall_rating": float(r[10]) if r[10] is not None else None,
            "feedback": r[11] or "",
            "status": r[12] or "pending",
            "reviewer_id": r[13] or "",
            "submitted_at": str(r[14]) if r[14] else None,
            "created_at": str(r[15]) if r[15] else None
        } for r in rows]}
    except Exception as e:
        return _err(e)


@hr_approvals_bp.route("/approvals/reviews/<rid>/approve", methods=["POST"])
def approve_review(rid):
    data = request.get_json() or {}
    try:
        db.session.execute(db.text(
            "UPDATE hr.performance_reviews SET status = 'approved', "
            "manager_rating = COALESCE(:mgr_r, manager_rating), "
            "overall_rating = COALESCE(:overall, overall_rating), "
            "submitted_at = NOW(), updated_at = NOW() WHERE id = :id"
        ), {"id": rid, "mgr_r": data.get("manager_rating"), "overall": data.get("overall_rating")})
        db.session.commit()
        _log("APPROVE", "Performance Review", rid)
        return {"success": True, "message": "Performance review approved"}
    except Exception as e:
        return _err(e)


@hr_approvals_bp.route("/approvals/reviews/<rid>/reject", methods=["POST"])
def reject_review(rid):
    data = request.get_json() or {}
    try:
        db.session.execute(db.text(
            "UPDATE hr.performance_reviews SET status = 'rejected', "
            "feedback = COALESCE(NULLIF(:feedback,''), feedback), "
            "submitted_at = NOW(), updated_at = NOW() WHERE id = :id"
        ), {"id": rid, "feedback": data.get("reason", "")})
        db.session.commit()
        _log("REJECT", "Performance Review", rid)
        return {"success": True, "message": "Performance review rejected"}
    except Exception as e:
        return _err(e)
