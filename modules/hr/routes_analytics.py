from flask import Blueprint, request
from extensions import db
import uuid, json

hr_analytics_bp = Blueprint("hr_analytics", __name__)


@hr_analytics_bp.route("/hr-analytics/overview", methods=["GET"])
def hr_analytics_overview():
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        total = db.session.execute(db.text(
            "SELECT COUNT(*) FROM hr.employees WHERE (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) AND is_deleted=false"
        ), {"tid": tid}).scalar() or 0
        active = db.session.execute(db.text(
            "SELECT COUNT(*) FROM hr.employees WHERE (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) AND is_deleted=false AND status='active'"
        ), {"tid": tid}).scalar() or 0
        dept_rows = db.session.execute(db.text(
            "SELECT department_id, COUNT(*) FROM hr.employees "
            "WHERE (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) AND is_deleted=false AND status='active' "
            "GROUP BY department_id ORDER BY COUNT(*) DESC LIMIT 10"
        ), {"tid": tid}).fetchall()
        gender_rows = db.session.execute(db.text(
            "SELECT gender, COUNT(*) FROM hr.employees "
            "WHERE (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) AND is_deleted=false AND status='active' "
            "GROUP BY gender"
        ), {"tid": tid}).fetchall()
        type_rows = db.session.execute(db.text(
            "SELECT employment_type, COUNT(*) FROM hr.employees "
            "WHERE (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) AND is_deleted=false AND status='active' "
            "GROUP BY employment_type"
        ), {"tid": tid}).fetchall()
        new_joiners = db.session.execute(db.text(
            "SELECT COUNT(*) FROM hr.employees "
            "WHERE (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) AND is_deleted=false "
            "AND EXTRACT(MONTH FROM date_of_joining)=EXTRACT(MONTH FROM NOW()) "
            "AND EXTRACT(YEAR FROM date_of_joining)=EXTRACT(YEAR FROM NOW())"
        ), {"tid": tid}).scalar() or 0
        attrition = db.session.execute(db.text(
            "SELECT COUNT(*) FROM hr.employees "
            "WHERE (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) AND is_deleted=false "
            "AND status IN ('terminated','inactive') "
            "AND EXTRACT(YEAR FROM updated_at)=EXTRACT(YEAR FROM NOW())"
        ), {"tid": tid}).scalar() or 0
        pending_leaves = 0
        try:
            pending_leaves = db.session.execute(db.text(
                "SELECT COUNT(*) FROM hr.leave_requests WHERE tenant_id=:tid AND status='pending' AND is_deleted=false"
            ), {"tid": tid}).scalar() or 0
        except Exception:
            db.session.rollback()
        open_jobs = 0
        try:
            open_jobs = db.session.execute(db.text(
                "SELECT COUNT(*) FROM hr.job_requisitions WHERE tenant_id=:tid AND status='open' AND is_deleted=false"
            ), {"tid": tid}).scalar() or 0
        except Exception:
            db.session.rollback()
        pending_tasks = 0
        try:
            pending_tasks = db.session.execute(db.text(
                "SELECT COUNT(*) FROM hr.onboarding_tasks WHERE tenant_id=:tid AND status='pending' AND is_deleted=false"
            ), {"tid": tid}).scalar() or 0
        except Exception:
            db.session.rollback()
        return {"success": True, "data": {
            "headcount": {"total": total, "active": active, "inactive": total - active},
            "new_joiners_this_month": new_joiners,
            "attrition_this_year": attrition,
            "attrition_rate": round((attrition / total * 100), 1) if total > 0 else 0,
            "pending_leaves": pending_leaves,
            "open_jobs": open_jobs,
            "pending_onboarding_tasks": pending_tasks,
            "department_breakdown": [{"department": r[0] or "Unassigned", "count": r[1]} for r in dept_rows],
            "gender_split": [{"gender": r[0] or "Not Specified", "count": r[1]} for r in gender_rows],
            "employment_type": [{"type": r[0] or "Unknown", "count": r[1]} for r in type_rows]
        }}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e)}, 500


@hr_analytics_bp.route("/hr-analytics/headcount-trend", methods=["GET"])
def headcount_trend():
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        rows = db.session.execute(db.text(
            "SELECT EXTRACT(YEAR FROM date_of_joining) as yr, EXTRACT(MONTH FROM date_of_joining) as mo, COUNT(*) "
            "FROM hr.employees "
            "WHERE (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) AND is_deleted=false "
            "AND date_of_joining IS NOT NULL "
            "AND date_of_joining >= NOW() - INTERVAL '12 months' "
            "GROUP BY yr, mo ORDER BY yr, mo"
        ), {"tid": tid}).fetchall()
        return {"success": True, "data": [
            {"year": int(r[0]), "month": int(r[1]), "count": r[2]} for r in rows
        ]}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e), "data": []}, 500


@hr_analytics_bp.route("/hr-analytics/audit-logs", methods=["GET"])
def hr_audit_logs():
    tid = request.headers.get("X-Tenant-ID", "")
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 50, type=int)
    offset = (page - 1) * limit
    try:
        total = db.session.execute(db.text(
            "SELECT COUNT(*) FROM audit.logs WHERE module='HR' AND tenant_id=:tid"
        ), {"tid": tid}).scalar() or 0
        rows = db.session.execute(db.text(
            "SELECT id, action, entity_type, entity_id, user_email, user_name, ip_address, extra_data, created_at "
            "FROM audit.logs WHERE module='HR' AND tenant_id=:tid "
            "ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        ), {"tid": tid, "limit": limit, "offset": offset}).fetchall()
        def parse(v):
            if isinstance(v, dict): return v
            try: return json.loads(v) if v else {}
            except: return {}
        return {"success": True, "data": {
            "items": [{"id": str(r[0]), "action": r[1], "entity_type": r[2] or '',
                       "entity_id": r[3] or '', "user_email": r[4] or '', "user_name": r[5] or '',
                       "ip_address": r[6] or '', "extra_data": parse(r[7]),
                       "created_at": str(r[8]) if r[8] else None} for r in rows],
            "total": total, "page": page, "limit": limit
        }}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e), "data": {"items": [], "total": 0, "page": page, "limit": limit}}, 500
