from flask import Blueprint, request
from extensions import db
import uuid
import json

project_bp = Blueprint("projects", __name__)


# ─── ORGANIZATIONS ───

@project_bp.route("/organizations", methods=["GET"])
def list_organizations():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    rows = db.session.execute(db.text(
        "SELECT id, name, code, industry, website, phone, email, gst_number, pan_number, "
        "addresses, contacts, created_at "
        "FROM project.organizations WHERE (tenant_id = :tid OR tenant_id = '' OR tenant_id IS NULL) "
        "AND is_deleted = false ORDER BY name"
    ), {"tid": tenant_id})
    items = [{"id": r[0], "name": r[1], "code": r[2] or '', "industry": r[3] or '',
              "website": r[4] or '', "phone": r[5] or '', "email": r[6] or '',
              "gst_number": r[7] or '', "pan_number": r[8] or '',
              "addresses": r[9] or [], "contacts": r[10] or [],
              "created_at": str(r[11]) if r[11] else None} for r in rows]
    return {"success": True, "data": items}


@project_bp.route("/organizations", methods=["POST"])
def create_organization():
    data = request.get_json()
    tenant_id = request.headers.get("X-Tenant-ID", "")
    if not data.get("name"):
        return {"success": False, "message": "Organization name is required"}, 400
    oid = str(uuid.uuid4())
    created_by = request.headers.get('X-User-Name', '') or request.headers.get('X-User-Email', '')
    db.session.execute(db.text(
        "INSERT INTO project.organizations (id, name, code, industry, website, phone, email, "
        "gst_number, pan_number, addresses, contacts, tenant_id, created_by) "
        "VALUES (:id, :name, :code, :industry, :website, :phone, :email, "
        ":gst, :pan, :addresses, :contacts, :tid, :cb)"
    ), {
        "id": oid, "name": data["name"], "code": data.get("code", ""),
        "industry": data.get("industry", ""), "website": data.get("website", ""),
        "phone": data.get("phone", ""), "email": data.get("email", ""),
        "gst": data.get("gst_number", ""), "pan": data.get("pan_number", ""),
        "addresses": json.dumps(data.get("addresses", [])),
        "contacts": json.dumps(data.get("contacts", [])),
        "tid": tenant_id, "cb": created_by
    })
    db.session.commit()
    return {"success": True, "data": {"id": oid, "name": data["name"]}, "message": "Organization created"}, 201


@project_bp.route("/organizations/<oid>", methods=["PUT"])
def update_organization(oid):
    data = request.get_json()
    fields = {"name": "name", "code": "code", "industry": "industry", "website": "website",
              "phone": "phone", "email": "email", "gst_number": "gst_number", "pan_number": "pan_number"}
    updates, params = [], {"id": oid}
    for key, col in fields.items():
        if key in data:
            updates.append(f"{col}=:{col}")
            params[col] = data[key] or ''
    if "addresses" in data:
        updates.append("addresses=:addresses")
        params["addresses"] = json.dumps(data["addresses"])
    if "contacts" in data:
        updates.append("contacts=:contacts")
        params["contacts"] = json.dumps(data["contacts"])
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE project.organizations SET {', '.join(updates)} WHERE id=:id"), params)
    db.session.commit()
    return {"success": True, "message": "Organization updated"}


@project_bp.route("/organizations/<oid>", methods=["DELETE"])
def delete_organization(oid):
    db.session.execute(db.text("UPDATE project.organizations SET is_deleted=true WHERE id=:id"), {"id": oid})
    db.session.commit()
    return {"success": True, "message": "Organization deleted"}


@project_bp.route("/organizations/search", methods=["GET"])
def search_organizations():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    q = request.args.get("q", "").strip()
    if not q or len(q) < 2:
        return {"success": True, "data": []}
    search = f"%{q}%"
    rows = db.session.execute(db.text(
        "SELECT id, name, code, industry, phone, email FROM project.organizations "
        "WHERE (tenant_id = :tid OR tenant_id = '' OR tenant_id IS NULL) AND is_deleted = false "
        "AND (LOWER(name) LIKE LOWER(:q) OR LOWER(code) LIKE LOWER(:q)) ORDER BY name LIMIT 15"
    ), {"tid": tenant_id, "q": search})
    items = [{"id": r[0], "name": r[1], "code": r[2] or '', "industry": r[3] or '',
              "phone": r[4] or '', "email": r[5] or ''} for r in rows]
    return {"success": True, "data": items}


# ─── PROJECTS ───

@project_bp.route("/projects", methods=["GET"])
def list_projects():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    rows = db.session.execute(db.text(
        "SELECT p.id, p.code, p.name, p.project_type, p.status, p.start_date, p.due_date, "
        "p.closing_date, p.progress, p.percent_complete, p.bp_code, p.bp_name, "
        "p.contact_person, p.territory, p.sales_employee, p.owner, p.created_at, "
        "p.organization_id, o.name as org_name "
        "FROM project.projects p LEFT JOIN project.organizations o ON p.organization_id = o.id "
        "WHERE p.tenant_id = :tid AND p.is_deleted = false ORDER BY p.created_at DESC"
    ), {"tid": tenant_id})
    items = [{"id": r[0], "project_number": r[1], "project_name": r[2], "project_type": r[3] or '',
              "status": r[4] or 'open', "start_date": str(r[5]) if r[5] else '',
              "due_date": str(r[6]) if r[6] else '', "closing_date": str(r[7]) if r[7] else '',
              "progress": r[8] or 0, "percent_complete": float(r[9] or 0),
              "bp_code": r[10] or '', "bp_name": r[11] or '',
              "contact_person": r[12] or '', "territory": r[13] or '',
              "sales_employee": r[14] or '', "owner": r[15] or '',
              "created_at": str(r[16]) if r[16] else None,
              "organization_id": r[17] or '', "organization_name": r[18] or ''} for r in rows]
    return {"success": True, "data": items}


@project_bp.route("/projects/<pid>", methods=["GET"])
def get_project(pid):
    r = db.session.execute(db.text(
        "SELECT p.id, p.code, p.name, p.project_type, p.status, p.start_date, p.due_date, "
        "p.closing_date, p.progress, p.percent_complete, p.bp_code, p.bp_name, "
        "p.contact_person, p.territory, p.sales_employee, p.owner, p.description, "
        "p.budget, p.actual_cost, p.created_at, p.organization_id, o.name as org_name, "
        "p.addresses, p.contacts, p.purchase_orders "
        "FROM project.projects p LEFT JOIN project.organizations o ON p.organization_id = o.id "
        "WHERE p.id = :id AND p.is_deleted = false"
    ), {"id": pid}).first()
    if not r:
        return {"success": False, "message": "Project not found"}, 404
    task_count = db.session.execute(db.text(
        "SELECT COUNT(*) FROM project.tasks WHERE project_id = :pid AND is_deleted = false"
    ), {"pid": pid}).scalar() or 0
    open_tasks = db.session.execute(db.text(
        "SELECT COUNT(*) FROM project.tasks WHERE project_id = :pid AND is_deleted = false AND status != 'completed'"
    ), {"pid": pid}).scalar() or 0
    return {"success": True, "data": {
        "id": r[0], "project_number": r[1], "project_name": r[2], "project_type": r[3] or '',
        "status": r[4] or 'open', "start_date": str(r[5]) if r[5] else '',
        "due_date": str(r[6]) if r[6] else '', "closing_date": str(r[7]) if r[7] else '',
        "progress": r[8] or 0, "percent_complete": float(r[9] or 0),
        "bp_code": r[10] or '', "bp_name": r[11] or '',
        "contact_person": r[12] or '', "territory": r[13] or '',
        "sales_employee": r[14] or '', "owner": r[15] or '',
        "description": r[16] or '', "budget": float(r[17] or 0),
        "actual_cost": float(r[18] or 0), "created_at": str(r[19]) if r[19] else None,
        "organization_id": r[20] or '', "organization_name": r[21] or '',
        "addresses": r[22] or [], "contacts": r[23] or [], "purchase_orders": r[24] or [],
        "total_tasks": task_count, "open_tasks": open_tasks
    }}


@project_bp.route("/projects", methods=["POST"])
def create_project():
    data = request.get_json()
    tenant_id = request.headers.get("X-Tenant-ID", "")
    if not data.get("project_name") or not data.get("project_number"):
        return {"success": False, "message": "Project name and number are required"}, 400
    existing = db.session.execute(db.text(
        "SELECT id FROM project.projects WHERE code = :code AND tenant_id = :tid AND is_deleted = false"
    ), {"code": data["project_number"], "tid": tenant_id}).first()
    if existing:
        return {"success": False, "message": "Project number already exists"}, 409
    pid = str(uuid.uuid4())
    created_by = request.headers.get('X-User-Name', '') or request.headers.get('X-User-Email', '')
    db.session.execute(db.text(
        "INSERT INTO project.projects (id, code, name, project_type, status, start_date, due_date, "
        "closing_date, bp_code, bp_name, contact_person, territory, sales_employee, owner, "
        "organization_id, addresses, contacts, purchase_orders, tenant_id, created_by) "
        "VALUES (:id, :code, :name, :ptype, :status, :start, :due, :closing, "
        ":bp_code, :bp_name, :contact, :territory, :sales, :owner, "
        ":org_id, :addresses, :contacts, :pos, :tid, :created_by)"
    ), {
        "id": pid, "code": data["project_number"], "name": data["project_name"],
        "ptype": data.get("project_type", ""), "status": data.get("status", "open"),
        "start": data.get("start_date") or None, "due": data.get("due_date") or None,
        "closing": data.get("closing_date") or None,
        "bp_code": data.get("bp_code", ""), "bp_name": data.get("bp_name", ""),
        "contact": data.get("contact_person", ""), "territory": data.get("territory", ""),
        "sales": data.get("sales_employee", ""), "owner": data.get("owner", ""),
        "org_id": data.get("organization_id") or None,
        "addresses": json.dumps(data.get("addresses", [])),
        "contacts": json.dumps(data.get("contacts", [])),
        "pos": json.dumps(data.get("purchase_orders", [])),
        "tid": tenant_id, "created_by": created_by
    })
    db.session.commit()
    return {"success": True, "data": {"id": pid}, "message": "Project created"}, 201


@project_bp.route("/projects/<pid>", methods=["PUT"])
def update_project(pid):
    data = request.get_json()
    fields_map = {
        "project_name": "name", "project_number": "code", "project_type": "project_type",
        "status": "status", "start_date": "start_date", "due_date": "due_date",
        "closing_date": "closing_date", "percent_complete": "percent_complete",
        "bp_code": "bp_code", "bp_name": "bp_name", "contact_person": "contact_person",
        "territory": "territory", "sales_employee": "sales_employee", "owner": "owner",
        "description": "description", "budget": "budget", "organization_id": "organization_id"
    }
    updates, params = [], {"id": pid}
    for key, col in fields_map.items():
        if key in data:
            updates.append(f"{col}=:{col}")
            params[col] = data[key] if data[key] else None
    if "addresses" in data:
        updates.append("addresses=:addresses")
        params["addresses"] = json.dumps(data["addresses"])
    if "contacts" in data:
        updates.append("contacts=:contacts")
        params["contacts"] = json.dumps(data["contacts"])
    if "purchase_orders" in data:
        updates.append("purchase_orders=:pos")
        params["pos"] = json.dumps(data["purchase_orders"])
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE project.projects SET {', '.join(updates)} WHERE id=:id"), params)
    db.session.commit()
    return {"success": True, "message": "Project updated"}


@project_bp.route("/projects/<pid>", methods=["DELETE"])
def delete_project(pid):
    db.session.execute(db.text("UPDATE project.projects SET is_deleted=true, updated_at=NOW() WHERE id=:id"), {"id": pid})
    db.session.execute(db.text("UPDATE project.tasks SET is_deleted=true, updated_at=NOW() WHERE project_id=:id"), {"id": pid})
    db.session.commit()
    return {"success": True, "message": "Project deleted"}


# ─── TASKS ───

@project_bp.route("/projects/<pid>/tasks", methods=["GET"])
def list_tasks(pid):
    rows = db.session.execute(db.text(
        "SELECT id, COALESCE(task_name, name) as task_name, description, stage, owner, "
        "start_date, end_date, due_date, planned_cost, invoiced_amount, "
        "percent_complete, dependencies, status, created_at "
        "FROM project.tasks WHERE project_id = :pid AND is_deleted = false ORDER BY created_at"
    ), {"pid": pid})
    items = [{"id": r[0], "task_name": r[1] or '', "description": r[2] or '',
              "stage": r[3] or '', "owner": r[4] or '',
              "start_date": str(r[5]) if r[5] else '', "end_date": str(r[6]) if r[6] else '',
              "due_date": str(r[7]) if r[7] else '',
              "planned_cost": float(r[8] or 0), "invoiced_amount": float(r[9] or 0),
              "percent_complete": float(r[10] or 0), "dependencies": r[11] or '',
              "status": r[12] or 'open', "created_at": str(r[13]) if r[13] else None} for r in rows]
    return {"success": True, "data": items}


@project_bp.route("/projects/<pid>/tasks", methods=["POST"])
def create_task(pid):
    data = request.get_json()
    tenant_id = request.headers.get("X-Tenant-ID", "")
    if not data.get("task_name"):
        return {"success": False, "message": "Task name is required"}, 400
    tid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO project.tasks (id, project_id, task_name, name, description, stage, owner, "
        "start_date, end_date, due_date, planned_cost, invoiced_amount, "
        "percent_complete, dependencies, status, tenant_id) "
        "VALUES (:id, :pid, :tname, :tname, :desc, :stage, :owner, "
        ":start, :end, :due, :cost, :invoiced, :pct, :deps, :status, :tid)"
    ), {
        "id": tid, "pid": pid, "tname": data["task_name"],
        "desc": data.get("description", ""), "stage": data.get("stage", ""),
        "owner": data.get("owner", ""),
        "start": data.get("start_date") or None, "end": data.get("end_date") or None,
        "due": data.get("due_date") or None,
        "cost": data.get("planned_cost", 0), "invoiced": data.get("invoiced_amount", 0),
        "pct": data.get("percent_complete", 0), "deps": data.get("dependencies", ""),
        "status": data.get("status", "open"), "tid": tenant_id
    })
    db.session.commit()
    return {"success": True, "data": {"id": tid}, "message": "Task created"}, 201


@project_bp.route("/tasks/<tid>", methods=["PUT"])
def update_task(tid):
    data = request.get_json()
    fields = ["task_name", "description", "stage", "owner", "start_date", "end_date",
              "due_date", "planned_cost", "invoiced_amount", "percent_complete",
              "dependencies", "status"]
    updates, params = [], {"id": tid}
    for f in fields:
        if f in data:
            updates.append(f"{f}=:{f}")
            params[f] = data[f] if data[f] else None
    if "task_name" in params and params["task_name"]:
        updates.append("name=:task_name")
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE project.tasks SET {', '.join(updates)} WHERE id=:id"), params)
    db.session.commit()
    return {"success": True, "message": "Task updated"}


@project_bp.route("/tasks/<tid>", methods=["DELETE"])
def delete_task(tid):
    db.session.execute(db.text("UPDATE project.tasks SET is_deleted=true, updated_at=NOW() WHERE id=:id"), {"id": tid})
    db.session.commit()
    return {"success": True, "message": "Task deleted"}


# ─── OVERVIEW ───

@project_bp.route("/overview", methods=["GET"])
def project_overview():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    total_projects = db.session.execute(db.text(
        "SELECT COUNT(*) FROM project.projects WHERE tenant_id = :tid AND is_deleted = false"
    ), {"tid": tenant_id}).scalar() or 0
    open_projects = db.session.execute(db.text(
        "SELECT COUNT(*) FROM project.projects WHERE tenant_id = :tid AND is_deleted = false AND status IN ('open','in_progress')"
    ), {"tid": tenant_id}).scalar() or 0
    completed_projects = db.session.execute(db.text(
        "SELECT COUNT(*) FROM project.projects WHERE tenant_id = :tid AND is_deleted = false AND status = 'completed'"
    ), {"tid": tenant_id}).scalar() or 0
    total_tasks = db.session.execute(db.text(
        "SELECT COUNT(*) FROM project.tasks t JOIN project.projects p ON t.project_id = p.id WHERE p.tenant_id = :tid AND t.is_deleted = false"
    ), {"tid": tenant_id}).scalar() or 0
    total_orgs = db.session.execute(db.text(
        "SELECT COUNT(*) FROM project.organizations WHERE (tenant_id = :tid OR tenant_id = '' OR tenant_id IS NULL) AND is_deleted = false"
    ), {"tid": tenant_id}).scalar() or 0
    recent_logs = db.session.execute(db.text(
        "SELECT action, entity_type, entity_id, created_at FROM audit.logs "
        "WHERE module = 'Project Management' AND tenant_id = :tid ORDER BY created_at DESC LIMIT 10"
    ), {"tid": tenant_id})
    recent_activity = [{"action": r[0], "entity_type": r[1], "entity_id": r[2],
                        "created_at": str(r[3]) if r[3] else None} for r in recent_logs]
    return {"success": True, "data": {
        "total_projects": total_projects, "open_projects": open_projects,
        "completed_projects": completed_projects, "total_tasks": total_tasks,
        "total_organizations": total_orgs, "recent_activity": recent_activity
    }}


# ─── AUDIT LOGS ───

@project_bp.route("/audit-logs", methods=["GET"])
def project_audit_logs():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    offset = (page - 1) * limit
    rows = db.session.execute(db.text(
        "SELECT id, action, entity_type, entity_id, ip_address, created_at, user_email, user_name "
        "FROM audit.logs WHERE module = 'Project Management' AND tenant_id = :tid "
        "ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    ), {"tid": tenant_id, "limit": limit, "offset": offset})
    logs = [{"id": r[0], "action": r[1], "entity_type": r[2], "entity_id": r[3],
             "ip_address": r[4], "created_at": str(r[5]) if r[5] else None,
             "user_email": r[6] or '', "user_name": r[7] or ''} for r in rows]
    total = db.session.execute(db.text(
        "SELECT COUNT(*) FROM audit.logs WHERE module = 'Project Management' AND tenant_id = :tid"
    ), {"tid": tenant_id}).scalar() or 0
    return {"success": True, "data": {"items": logs, "total": total, "page": page}}


# ─── MODULE USERS ───

@project_bp.route("/users", methods=["GET"])
def list_module_users():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    if not tenant_id or tenant_id == 'TEST':
        tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958'
    rows = db.session.execute(db.text(
        "SELECT ma.id, ma.user_id, ma.role, ma.permissions, ma.is_active, ma.created_at, "
        "u.email, u.first_name, u.last_name "
        "FROM iam.module_access ma JOIN iam.users u ON ma.user_id = u.id "
        "WHERE ma.module = 'Project Management' "
        "AND (ma.tenant_id = :tid OR ma.tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR ma.tenant_id = 'TEST' OR ma.tenant_id = '' OR ma.tenant_id IS NULL) "
        "ORDER BY ma.created_at DESC"
    ), {"tid": tenant_id})
    items = [{"id": r[0], "user_id": r[1], "role": r[2], "permissions": r[3] or [],
              "is_active": r[4], "created_at": str(r[5]) if r[5] else None,
              "email": r[6], "first_name": r[7] or '', "last_name": r[8] or ''} for r in rows]
    return {"success": True, "data": items}


@project_bp.route("/users", methods=["POST"])
def add_module_user():
    import uuid
    data = request.get_json()
    tenant_id = request.headers.get("X-Tenant-ID", "")
    if not tenant_id or tenant_id == 'TEST':
        tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958'
    user_id = data.get("user_id")
    role = data.get("role", "viewer")
    permissions = data.get("permissions", [])
    if not user_id:
        return {"success": False, "message": "user_id required"}, 400
    user = db.session.execute(db.text(
        "SELECT id, email FROM iam.users WHERE id = :id AND is_deleted = false"
    ), {"id": user_id}).first()
    if not user:
        return {"success": False, "message": "User not found"}, 404
    existing = db.session.execute(db.text(
        "SELECT id FROM iam.module_access WHERE user_id = :uid AND module = 'Project Management'"
    ), {"uid": user_id}).first()
    if existing:
        return {"success": False, "message": "User already has access"}, 409
    access_id = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO iam.module_access (id, user_id, module, role, permissions, granted_by, tenant_id) "
        "VALUES (:id, :uid, 'Project Management', :role, :perms, :granted_by, :tid)"
    ), {"id": access_id, "uid": user_id, "role": role, "perms": json.dumps(permissions),
        "granted_by": request.headers.get('X-User-Email', ''), "tid": tenant_id})
    db.session.commit()
    _log_audit('GRANT_ACCESS', 'Module User', user[1])
    return {"success": True, "message": f"Access granted to {user[1]}"}, 201


@project_bp.route("/users/<access_id>", methods=["PUT"])
def update_module_user(access_id):
    data = request.get_json()
    updates, params = [], {"id": access_id}
    if "role" in data:
        updates.append("role=:role")
        params["role"] = data["role"]
    if "permissions" in data:
        updates.append("permissions=:permissions")
        params["permissions"] = json.dumps(data["permissions"])
    if "is_active" in data:
        updates.append("is_active=:is_active")
        params["is_active"] = data["is_active"]
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE iam.module_access SET {', '.join(updates)} WHERE id=:id"), params)
    db.session.commit()
    _log_audit('UPDATE_ACCESS', 'Module User', access_id)
    return {"success": True, "message": "Access updated"}


@project_bp.route("/users/<access_id>", methods=["DELETE"])
def revoke_module_user(access_id):
    row = db.session.execute(db.text(
        "SELECT u.email FROM iam.module_access ma JOIN iam.users u ON ma.user_id = u.id WHERE ma.id = :id"
    ), {"id": access_id}).first()
    db.session.execute(db.text("DELETE FROM iam.module_access WHERE id = :id"), {"id": access_id})
    db.session.commit()
    _log_audit('REVOKE_ACCESS', 'Module User', row[0] if row else access_id)
    return {"success": True, "message": "Access revoked"}


# ─── AUDIT HELPER ───

def _log_audit(action, entity_type, entity_id, details=''):
    try:
        from flask import request as req
        db.session.execute(db.text(
            "INSERT INTO audit.logs (id, action, module, entity_type, entity_id, ip_address, tenant_id, user_email, user_name, created_at) "
            "VALUES (gen_random_uuid(), :action, 'Project Management', :etype, :eid, :ip, :tid, :email, :name, NOW())"
        ), {"action": action, "etype": entity_type, "eid": str(entity_id),
            "ip": req.remote_addr or '', "tid": req.headers.get('X-Tenant-ID', ''),
            "email": req.headers.get('X-User-Email', ''), "name": req.headers.get('X-User-Name', '')})
    except Exception:
        pass
