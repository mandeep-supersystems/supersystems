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
@hr_analytics_bp.route("/audit-logs", methods=["GET"])
def hr_audit_logs():
    tid = (request.headers.get("X-Tenant-ID") or "").strip()
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 50, type=int)
    entity_types_param = request.args.get("entity_type", "").strip()
    action = request.args.get("action", "").strip().upper()
    user_email = request.args.get("user_email", "").strip()
    search = request.args.get("search", "").strip()
    from_date = request.args.get("from_date", "").strip()
    to_date = request.args.get("to_date", "").strip()

    offset = (page - 1) * limit
    try:
        where_clauses = ["UPPER(module)='HR'"]
        params = {"limit": limit, "offset": offset}
        if tid and tid not in ('TEST', ''):
            where_clauses.append("(tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL)")
            params["tid"] = tid

        if entity_types_param:
            etypes = [e.strip() for e in entity_types_param.split(',') if e.strip()]
            if len(etypes) == 1:
                where_clauses.append("LOWER(entity_type) = LOWER(:etype)")
                params["etype"] = etypes[0]
            elif len(etypes) > 1:
                in_placeholders = []
                for idx, et in enumerate(etypes):
                    pname = f"etype_{idx}"
                    in_placeholders.append(f":{pname}")
                    params[pname] = et.lower()
                where_clauses.append(f"LOWER(entity_type) IN ({', '.join(in_placeholders)})")

        if action:
            where_clauses.append("UPPER(action) = :action")
            params["action"] = action

        if user_email:
            where_clauses.append("LOWER(user_email) LIKE :user_email")
            params["user_email"] = f"%{user_email.lower()}%"

        if search:
            where_clauses.append(
                "(LOWER(user_email) LIKE :search OR LOWER(user_name) LIKE :search OR "
                "LOWER(entity_id) LIKE :search OR LOWER(entity_type) LIKE :search OR "
                "LOWER(action) LIKE :search)"
            )
            params["search"] = f"%{search.lower()}%"

        if from_date:
            where_clauses.append("created_at >= :from_date")
            params["from_date"] = from_date

        if to_date:
            where_clauses.append("created_at <= :to_date")
            params["to_date"] = to_date + " 23:59:59"

        where_sql = " AND ".join(where_clauses)

        total = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM audit.logs WHERE {where_sql}"
        ), params).scalar() or 0

        stats = {
            "total": total,
            "creates": db.session.execute(db.text(f"SELECT COUNT(*) FROM audit.logs WHERE {where_sql} AND UPPER(action)='CREATE'"), params).scalar() or 0,
            "updates": db.session.execute(db.text(f"SELECT COUNT(*) FROM audit.logs WHERE {where_sql} AND UPPER(action)='UPDATE'"), params).scalar() or 0,
            "deletes": db.session.execute(db.text(f"SELECT COUNT(*) FROM audit.logs WHERE {where_sql} AND UPPER(action)='DELETE'"), params).scalar() or 0,
            "unique_users": db.session.execute(db.text(f"SELECT COUNT(DISTINCT user_email) FROM audit.logs WHERE {where_sql} AND user_email IS NOT NULL AND user_email != ''"), params).scalar() or 0,
        }

        rows = db.session.execute(db.text(
            f"SELECT id, action, entity_type, entity_id, user_email, user_name, ip_address, extra_data, created_at "
            f"FROM audit.logs WHERE {where_sql} "
            f"ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        ), params).fetchall()

        def parse(v):
            if isinstance(v, dict): return v
            try: return json.loads(v) if v else {}
            except: return {}

        items = []
        for r in rows:
            extra = parse(r[7])
            items.append({
                "id": str(r[0]),
                "action": (r[1] or '').upper(),
                "entity_type": r[2] or '',
                "entity_id": r[3] or '',
                "user_email": r[4] or '',
                "user_name": r[5] or '',
                "ip_address": r[6] or '',
                "extra_data": extra,
                "changes": extra.get("changes") or {},
                "created_at": str(r[8]) if r[8] else None
            })

        return {"success": True, "data": {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "stats": stats
        }}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e), "data": {"items": [], "total": 0, "page": page, "limit": limit, "stats": {}}}, 500

