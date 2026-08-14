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
    _log_audit('CREATE', 'Organization', data["name"])
    return {"success": True, "data": {"id": oid, "name": data["name"]}, "message": "Organization created"}, 201


@project_bp.route("/organizations/<oid>", methods=["PUT"])
def update_organization(oid):
    data = request.get_json()
    
    # Fetch original organization state
    original = db.session.execute(db.text(
        "SELECT name, code, industry, website, phone, email, gst_number, pan_number, addresses, contacts "
        "FROM project.organizations WHERE id = :id"
    ), {"id": oid}).first()
    
    fields = {"name": "name", "code": "code", "industry": "industry", "website": "website",
              "phone": "phone", "email": "email", "gst_number": "gst_number", "pan_number": "pan_number"}
    updates, params = [], {"id": oid}
    
    old_state = {}
    new_state = {}
    
    if original:
        col_names = ["name", "code", "industry", "website", "phone", "email", "gst_number", "pan_number", "addresses", "contacts"]
        org_dict = {col_names[i]: original[i] for i in range(len(col_names))}
        
        for key, col in fields.items():
            if key in data:
                old_val = org_dict.get(col) or ''
                new_val = data[key] or ''
                if str(old_val).strip() != str(new_val).strip():
                    old_state[col] = old_val
                    new_state[col] = new_val
                updates.append(f"{col}=:{col}")
                params[col] = new_val
        
        if "addresses" in data:
            old_addr = org_dict.get("addresses") or []
            if isinstance(old_addr, str):
                try: old_addr = json.loads(old_addr)
                except Exception: pass
            if json.dumps(old_addr) != json.dumps(data["addresses"]):
                old_state["addresses"] = old_addr
                new_state["addresses"] = data["addresses"]
            updates.append("addresses=:addresses")
            params["addresses"] = json.dumps(data["addresses"])
            
        if "contacts" in data:
            old_cont = org_dict.get("contacts") or []
            if isinstance(old_cont, str):
                try: old_cont = json.loads(old_cont)
                except Exception: pass
            if json.dumps(old_cont) != json.dumps(data["contacts"]):
                old_state["contacts"] = old_cont
                new_state["contacts"] = data["contacts"]
            updates.append("contacts=:contacts")
            params["contacts"] = json.dumps(data["contacts"])
    else:
        for key, col in fields.items():
            if key in data:
                updates.append(f"{col}=:{col}")
                params[col] = data[key] or ''
                new_state[col] = data[key] or ''
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
    
    _log_audit('UPDATE', 'Organization', data.get("name", oid), old_val=old_state, new_val=new_state)
    return {"success": True, "message": "Organization updated"}


@project_bp.route("/organizations/<oid>", methods=["DELETE"])
def delete_organization(oid):
    db.session.execute(db.text("UPDATE project.organizations SET is_deleted=true WHERE id=:id"), {"id": oid})
    db.session.commit()
    _log_audit('DELETE', 'Organization', oid)
    return {"success": True, "message": "Organization deleted"}


@project_bp.route("/organizations/<oid>/delete-secure", methods=["DELETE"])
def delete_organization_secure(oid):
    password = request.headers.get("X-Confirmation-Password", "")
    
    # We fetch user password hash from current user email
    user_email = request.headers.get("X-User-Email", "")
    if not user_email:
        return {"success": False, "message": "User session not found"}, 401
        
    user_row = db.session.execute(db.text(
        "SELECT password_hash FROM iam.users WHERE email = :email AND is_deleted = false"
    ), {"email": user_email}).first()
    
    if not user_row:
        return {"success": False, "message": "User not found"}, 404
        
    import bcrypt
    pwd_bytes = password.encode('utf-8')
    hash_bytes = user_row[0].encode('utf-8')
    if not bcrypt.checkpw(pwd_bytes, hash_bytes):
        return {"success": False, "message": "Incorrect password verification"}, 403
        
    db.session.execute(db.text("UPDATE project.organizations SET is_deleted=true WHERE id=:id"), {"id": oid})
    db.session.commit()
    _log_audit('DELETE_SECURE', 'Organization', oid)
    return {"success": True, "message": "Organization deleted secure"}


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
    _log_audit('CREATE', 'Project', data["project_name"])
    return {"success": True, "data": {"id": pid}, "message": "Project created"}, 201


@project_bp.route("/projects/<pid>", methods=["PUT"])
def update_project(pid):
    data = request.get_json()
    
    # Fetch original project state
    original = db.session.execute(db.text(
        "SELECT name, code, project_type, status, start_date, due_date, closing_date, percent_complete, owner, territory, sales_employee, budget, description "
        "FROM project.projects WHERE id = :id"
    ), {"id": pid}).first()
    
    fields_map = {
        "project_name": "name", "project_number": "code", "project_type": "project_type",
        "status": "status", "start_date": "start_date", "due_date": "due_date",
        "closing_date": "closing_date", "percent_complete": "percent_complete",
        "bp_code": "bp_code", "bp_name": "bp_name", "contact_person": "contact_person",
        "territory": "territory", "sales_employee": "sales_employee", "owner": "owner",
        "description": "description", "budget": "budget", "organization_id": "organization_id"
    }
    updates, params = [], {"id": pid}
    
    old_state = {}
    new_state = {}
    
    if original:
        col_names = ["name", "code", "project_type", "status", "start_date", "due_date", "closing_date", "percent_complete", "owner", "territory", "sales_employee", "budget", "description"]
        proj_dict = {col_names[i]: original[i] for i in range(len(col_names))}
        
        for key, col in fields_map.items():
            if key in data:
                old_val = proj_dict.get(col) or ''
                new_val = data[key] or ''
                if str(old_val).strip() != str(new_val).strip():
                    old_state[col] = old_val
                    new_state[col] = new_val
                updates.append(f"{col}=:{col}")
                params[col] = new_val if new_val else None
    else:
        for key, col in fields_map.items():
            if key in data:
                updates.append(f"{col}=:{col}")
                params[col] = data[key] if data[key] else None
                new_state[col] = data[key] or ''

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
    
    _log_audit('UPDATE', 'Project', data.get("project_name", pid), old_val=old_state, new_val=new_state)
    return {"success": True, "message": "Project updated"}


@project_bp.route("/projects/<pid>", methods=["DELETE"])
def delete_project(pid):
    db.session.execute(db.text("UPDATE project.projects SET is_deleted=true, updated_at=NOW() WHERE id=:id"), {"id": pid})
    db.session.execute(db.text("UPDATE project.tasks SET is_deleted=true, updated_at=NOW() WHERE project_id=:id"), {"id": pid})
    db.session.commit()
    _log_audit('DELETE', 'Project', pid)
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
    period = request.args.get("period", "all")

    # Time filter
    time_filter = ""
    if period == "day":
        time_filter = "AND created_at >= NOW() - INTERVAL '1 day'"
    elif period == "week":
        time_filter = "AND created_at >= NOW() - INTERVAL '7 days'"
    elif period == "month":
        time_filter = "AND created_at >= NOW() - INTERVAL '30 days'"
    elif period == "year":
        time_filter = "AND created_at >= NOW() - INTERVAL '365 days'"

    total_projects = db.session.execute(db.text(
        f"SELECT COUNT(*) FROM project.projects WHERE tenant_id = :tid AND is_deleted = false {time_filter}"
    ), {"tid": tenant_id}).scalar() or 0
    open_projects = db.session.execute(db.text(
        f"SELECT COUNT(*) FROM project.projects WHERE tenant_id = :tid AND is_deleted = false AND status IN ('open','in_progress') {time_filter}"
    ), {"tid": tenant_id}).scalar() or 0
    completed_projects = db.session.execute(db.text(
        f"SELECT COUNT(*) FROM project.projects WHERE tenant_id = :tid AND is_deleted = false AND status = 'completed' {time_filter}"
    ), {"tid": tenant_id}).scalar() or 0
    total_tasks = db.session.execute(db.text(
        f"SELECT COUNT(*) FROM project.tasks t JOIN project.projects p ON t.project_id = p.id WHERE p.tenant_id = :tid AND t.is_deleted = false {time_filter.replace('created_at', 't.created_at')}"
    ), {"tid": tenant_id}).scalar() or 0
    total_orgs = db.session.execute(db.text(
        "SELECT COUNT(*) FROM project.organizations WHERE (tenant_id = :tid OR tenant_id = '' OR tenant_id IS NULL) AND is_deleted = false"
    ), {"tid": tenant_id}).scalar() or 0

    # Recent activity with time filter
    audit_time = time_filter.replace("created_at", "created_at")
    recent_logs = db.session.execute(db.text(
        f"SELECT action, entity_type, entity_id, created_at FROM audit.logs "
        f"WHERE module = 'Project Management' AND tenant_id = :tid {audit_time} ORDER BY created_at DESC LIMIT 20"
    ), {"tid": tenant_id})
    recent_activity = [{"action": r[0], "entity_type": r[1], "entity_id": r[2],
                        "created_at": str(r[3]) if r[3] else None} for r in recent_logs]

    # Action breakdown
    action_rows = db.session.execute(db.text(
        f"SELECT action, COUNT(*) FROM audit.logs "
        f"WHERE module = 'Project Management' AND tenant_id = :tid {audit_time} GROUP BY action"
    ), {"tid": tenant_id}).fetchall()
    action_breakdown = {r[0]: r[1] for r in action_rows}

    # Status breakdown
    status_rows = db.session.execute(db.text(
        f"SELECT status, COUNT(*) FROM project.projects WHERE tenant_id = :tid AND is_deleted = false {time_filter} GROUP BY status"
    ), {"tid": tenant_id}).fetchall()
    status_breakdown = {r[0]: r[1] for r in status_rows}

    # Org-wise project + PO value
    org_rows = db.session.execute(db.text(
        "SELECT o.name, COUNT(p.id) as proj_count, p.customer_pos "
        "FROM project.projects p "
        "JOIN project.organizations o ON p.organization_id = o.id "
        "WHERE p.tenant_id = :tid AND p.is_deleted = false "
        "GROUP BY o.name, p.customer_pos"
    ), {"tid": tenant_id}).fetchall()

    import json as _json
    org_map = {}
    for row in org_rows:
        name = row[0] or "Unknown"
        if name not in org_map:
            org_map[name] = {"projects": 0, "po_value": 0.0}
        org_map[name]["projects"] += 1
        try:
            pos = row[2] or []
            if isinstance(pos, str): pos = _json.loads(pos)
            for po in pos:
                org_map[name]["po_value"] += float(po.get("amount", 0) or 0)
        except Exception:
            pass
    top_orgs = sorted([{"name": k, **v} for k, v in org_map.items()],
                      key=lambda x: x["po_value"], reverse=True)[:8]

    # Monthly project creation (last 6 months)
    monthly_rows = db.session.execute(db.text(
        "SELECT TO_CHAR(created_at, 'Mon YYYY') as month, COUNT(*) "
        "FROM project.projects WHERE tenant_id = :tid AND is_deleted = false "
        "AND created_at >= NOW() - INTERVAL '6 months' "
        "GROUP BY TO_CHAR(created_at, 'Mon YYYY'), DATE_TRUNC('month', created_at) "
        "ORDER BY DATE_TRUNC('month', created_at)"
    ), {"tid": tenant_id}).fetchall()
    monthly_projects = [{"month": r[0], "count": r[1]} for r in monthly_rows]

    return {"success": True, "data": {
        "total_projects": total_projects, "open_projects": open_projects,
        "completed_projects": completed_projects, "total_tasks": total_tasks,
        "total_organizations": total_orgs, "recent_activity": recent_activity,
        "action_breakdown": action_breakdown,
        "status_breakdown": status_breakdown,
        "top_orgs": top_orgs,
        "monthly_projects": monthly_projects,
        "period": period
    }}


# ─── AUDIT LOGS ───

@project_bp.route("/audit-logs", methods=["GET"])
def project_audit_logs():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    offset = (page - 1) * limit
    rows = db.session.execute(db.text(
        "SELECT id, action, entity_type, entity_id, ip_address, created_at, user_email, user_name, old_values, new_values "
        "FROM audit.logs WHERE module = 'Project Management' AND tenant_id = :tid "
        "ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    ), {"tid": tenant_id, "limit": limit, "offset": offset})
    logs = [{"id": r[0], "action": r[1], "entity_type": r[2], "entity_id": r[3],
             "ip_address": r[4], "created_at": str(r[5]) if r[5] else None,
             "user_email": r[6] or '', "user_name": r[7] or '',
             "old_values": r[8] if r[8] else None, "new_values": r[9] if r[9] else None} for r in rows]
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

def _log_audit(action, entity_type, entity_id, old_val=None, new_val=None):
    try:
        from flask import request as req
        tid = req.headers.get('X-Tenant-ID', '')
        if not tid or tid == 'TEST':
            tid = 'b424df0e-f766-4e94-b3fd-05777e158958'
        
        old_json = json.dumps(old_val) if old_val else None
        new_json = json.dumps(new_val) if new_val else None
        
        db.session.execute(db.text(
            "INSERT INTO audit.logs (id, action, module, entity_type, entity_id, old_values, new_values, ip_address, tenant_id, user_email, user_name, created_at) "
            "VALUES (gen_random_uuid(), :action, 'Project Management', :etype, :eid, :old, :new, :ip, :tid, :email, :name, NOW())"
        ), {"action": action, "etype": entity_type, "eid": str(entity_id),
            "old": old_json, "new": new_json,
            "ip": req.remote_addr or '', "tid": tid,
            "email": req.headers.get('X-User-Email', ''), "name": req.headers.get('X-User-Name', '')})
        db.session.commit()
    except Exception:
        pass


# ─── CUSTOMER POs (uploaded FROM customer, stored on project) ───

@project_bp.route("/projects/<pid>/customer-pos", methods=["GET"])
def get_customer_pos(pid):
    r = db.session.execute(db.text(
        "SELECT customer_pos FROM project.projects WHERE id = :id AND is_deleted = false"
    ), {"id": pid}).first()
    if not r:
        return {"success": False, "message": "Project not found"}, 404
    pos = r[0] or []
    if isinstance(pos, str):
        pos = json.loads(pos)
    return {"success": True, "data": pos}


@project_bp.route("/projects/<pid>/customer-pos", methods=["POST"])
def add_customer_po(pid):
    import hashlib
    data = request.get_json()
    r = db.session.execute(db.text(
        "SELECT customer_pos FROM project.projects WHERE id = :id AND is_deleted = false"
    ), {"id": pid}).first()
    if not r:
        return {"success": False, "message": "Project not found"}, 404
    pos = r[0] or []
    if isinstance(pos, str):
        pos = json.loads(pos)

    po_number = data.get("po_number", "").strip()
    new_lines = data.get("lines", [])

    # Find all existing entries with same po_number
    existing = [p for p in pos if p.get("po_number") == po_number]

    if existing:
        # Check if content is identical to latest version
        latest = max(existing, key=lambda p: p.get("version", 1))
        def _sig(p):
            return hashlib.md5(json.dumps({
                "lines": p.get("lines", []),
                "customer_name": p.get("customer_name", ""),
                "amount": str(p.get("amount", 0))
            }, sort_keys=True).encode()).hexdigest()
        new_sig = hashlib.md5(json.dumps({
            "lines": new_lines,
            "customer_name": data.get("customer_name", ""),
            "amount": str(data.get("amount", 0))
        }, sort_keys=True).encode()).hexdigest()
        if _sig(latest) == new_sig:
            return {"success": False, "already_exists": True,
                    "message": f"PO {po_number} already exists with identical content (v{latest.get('version',1)})."}, 409
        next_version = latest.get("version", 1) + 1
    else:
        next_version = 1

    po_id = str(uuid.uuid4())
    new_po = {
        "id": po_id,
        "po_number": po_number,
        "version": next_version,
        "po_date": data.get("po_date", ""),
        "customer_name": data.get("customer_name", ""),
        "amount": data.get("amount", 0),
        "currency": data.get("currency", "INR"),
        "delivery_date": data.get("delivery_date", ""),
        "remarks": data.get("remarks", ""),
        "status": data.get("status", "received"),
        "lines": new_lines,
        "original_pdf": data.get("original_pdf", None)
    }
    pos.append(new_po)
    db.session.execute(db.text(
        "UPDATE project.projects SET customer_pos = :pos, updated_at = NOW() WHERE id = :id"
    ), {"pos": json.dumps(pos), "id": pid})
    db.session.commit()
    _log_audit('ADD_CUSTOMER_PO', 'Customer PO', f"{po_number} v{next_version}")
    return {"success": True, "data": new_po, "message": f"Customer PO saved as v{next_version}"}, 201

@project_bp.route("/projects/<pid>/customer-pos/<po_id>", methods=["DELETE"])
def delete_customer_po(pid, po_id):
    r = db.session.execute(db.text(
        "SELECT customer_pos FROM project.projects WHERE id = :id AND is_deleted = false"
    ), {"id": pid}).first()
    if not r:
        return {"success": False, "message": "Project not found"}, 404
    pos = r[0] or []
    if isinstance(pos, str):
        pos = json.loads(pos)
    pos = [p for p in pos if p.get("id") != po_id]
    db.session.execute(db.text(
        "UPDATE project.projects SET customer_pos = :pos, updated_at = NOW() WHERE id = :id"
    ), {"pos": json.dumps(pos), "id": pid})
    return {"success": True, "message": "Customer PO removed"}


@project_bp.route("/customer-pos/examples", methods=["GET"])
def list_po_examples():
    import os
    po_dir = os.path.join(os.getcwd(), 'POs')
    if not os.path.exists(po_dir):
        return {"success": True, "data": []}
    files = [f for f in os.listdir(po_dir) if f.lower().endswith('.pdf')]
    return {"success": True, "data": files}


@project_bp.route("/customer-pos/parse-pdf", methods=["POST"])
def parse_po_pdf():
    import os, re
    from pypdf import PdfReader

    file_name = None
    if request.is_json:
        file_name = request.json.get('filename')
    else:
        file_name = request.values.get('filename')

    text = ""
    try:
        if file_name:
            po_path = os.path.join(os.getcwd(), 'POs', file_name)
            if not os.path.exists(po_path):
                return {"success": False, "message": "File not found"}, 404
            reader = PdfReader(po_path)
        elif 'file' in request.files:
            uploaded = request.files['file']
            upload_dir = os.path.join(os.getcwd(), 'POs', 'uploads')
            os.makedirs(upload_dir, exist_ok=True)
            import uuid as _uuid
            saved_name = str(_uuid.uuid4()) + '.pdf'
            saved_path = os.path.join(upload_dir, saved_name)
            uploaded.save(saved_path)
            reader = PdfReader(saved_path)
        else:
            return {"success": False, "message": "No file content provided"}, 400
        for page in reader.pages:
            text += page.extract_text() or ""
    except Exception as e:
        return {"success": False, "message": f"Failed to read PDF: {str(e)}"}, 500

    # PO Number
    po_number = ""
    m = re.search(r'PO\s+Number[:\s]+([A-Z0-9\-]+)', text, re.IGNORECASE)
    if m:
        po_number = m.group(1).strip()

    # PO Date — handle "24 January 2026", "24/01/2026", "2026-01-24"
    po_date = ""
    m = re.search(r'PO\s+Date[:\s]+(\d{1,2}\s+\w+\s+\d{4}|\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2})', text, re.IGNORECASE)
    if m:
        raw = m.group(1).strip()
        # Normalise "24 January 2026" -> "2026-01-24"
        month_map = {'january':'01','february':'02','march':'03','april':'04','may':'05','june':'06',
                     'july':'07','august':'08','september':'09','october':'10','november':'11','december':'12'}
        parts = raw.split()
        if len(parts) == 3 and parts[1].lower() in month_map:
            po_date = f"{parts[2]}-{month_map[parts[1].lower()]}-{parts[0].zfill(2)}"
        else:
            po_date = raw

    # Customer/Vendor name — stop at newline or GSTIN
    customer_name = ""
    m = re.search(r'Vendor[:\s]+([^\n\r]+)', text, re.IGNORECASE)
    if m:
        customer_name = re.split(r'\s*GSTIN|\s*GST\b', m.group(1), flags=re.IGNORECASE)[0].strip()

    # Line items — match rows: <index> <part/desc...> <qty> ₹<price> ₹<amount>
    lines_extracted = []
    skip_words = {'total','subtotal','freight','igst','cgst','sgst','tax','discount','round','shipping','s.no','sr.no','description','particulars','amount'}

    def _split_part_desc(raw):
        """Split 'PART-123 Some description text' into (part_number, description).
        Part number heuristic: leading token that looks like a code (has digits/hyphens, no spaces, <=30 chars)."""
        raw = raw.strip()
        # Try: first token is part number if it matches code pattern
        m2 = re.match(r'^([A-Z0-9][A-Z0-9\-\/\.]{2,29})\s+(.+)$', raw)
        if m2:
            return m2.group(1).strip(), m2.group(2).strip()
        # No clear split — use full text as description, empty part number
        return "", raw

    # Primary pattern: idx  <text>  qty  ₹unit  ₹total
    line_pattern = re.compile(
        r'^\s*(\d+)\s+(.+?)\s+([\d,]+)\s+[₹Rs\.]+\s*([\d,]+(?:\.\d+)?)\s+[₹Rs\.]+\s*([\d,]+(?:\.\d+)?)\s*$',
        re.MULTILINE
    )
    for m in line_pattern.finditer(text):
        raw_desc = m.group(2).strip()
        if any(w in raw_desc.lower() for w in skip_words):
            continue
        try:
            qty  = int(m.group(3).replace(',', ''))
            cost = float(m.group(4).replace(',', ''))
            amt  = float(m.group(5).replace(',', ''))
            if qty > 0 and cost > 0 and abs(qty * cost - amt) < max(amt * 0.05, 5):
                pn, desc = _split_part_desc(raw_desc)
                lines_extracted.append({"part_number": pn, "description": desc, "qty": qty, "cost": cost})
        except (ValueError, ZeroDivisionError):
            pass

    # Fallback: simpler pattern without strict amount validation
    if not lines_extracted:
        fallback = re.compile(
            r'^\s*\d+\s+(.+?)\s+([\d,]+)\s+[₹Rs\.]+\s*([\d,]+(?:\.\d+)?)',
            re.MULTILINE
        )
        for m in fallback.finditer(text):
            raw_desc = m.group(1).strip()
            if any(w in raw_desc.lower() for w in skip_words) or len(raw_desc) < 3:
                continue
            try:
                qty  = int(m.group(2).replace(',', ''))
                cost = float(m.group(3).replace(',', ''))
                if qty > 0 and cost > 0:
                    pn, desc = _split_part_desc(raw_desc)
                    lines_extracted.append({"part_number": pn, "description": desc, "qty": qty, "cost": cost})
            except ValueError:
                pass

    total_amount = sum(item["qty"] * item["cost"] for item in lines_extracted)

    return {
        "success": True,
        "data": {
            "po_number": po_number or "PO-TEMP",
            "po_date": po_date,
            "customer_name": customer_name,
            "amount": total_amount,
            "lines": lines_extracted,
            "original_pdf": saved_path if 'saved_path' in dir() else None
        }
    }


@project_bp.route("/projects/<pid>/customer-pos/<po_id>/pdf", methods=["GET"])
def download_customer_po_pdf(pid, po_id):
    import os, io
    from flask import send_file
    pdf_type = request.args.get("type", "generated")

    # Fetch PO data
    r = db.session.execute(db.text(
        "SELECT customer_pos FROM project.projects WHERE id = :id AND is_deleted = false"
    ), {"id": pid}).first()
    if not r:
        return {"success": False, "message": "Project not found"}, 404
    pos = r[0] or []
    if isinstance(pos, str):
        import json as _json
        pos = _json.loads(pos)
    po = next((p for p in pos if p.get("id") == po_id), None)
    if not po:
        return {"success": False, "message": "PO not found"}, 404

    # Original PDF
    if pdf_type == "original":
        orig_path = po.get("original_pdf")
        if orig_path and os.path.exists(orig_path):
            return send_file(orig_path, mimetype="application/pdf",
                             as_attachment=True,
                             download_name=f"{po.get('po_number','PO')}_v{po.get('version',1)}_original.pdf")
        return {"success": False, "message": "Original PDF not available"}, 404

    # Generated PDF using reportlab
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_RIGHT, TA_CENTER

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=20*mm, rightMargin=20*mm,
                            topMargin=20*mm, bottomMargin=20*mm)
    styles = getSampleStyleSheet()
    accent = colors.HexColor('#1a73e8')
    muted  = colors.HexColor('#6b7280')
    dark   = colors.HexColor('#1f2937')

    title_style = ParagraphStyle('title', fontSize=16, fontName='Helvetica-Bold', textColor=dark, spaceAfter=2)
    sub_style   = ParagraphStyle('sub',   fontSize=10, fontName='Helvetica',      textColor=muted, spaceAfter=12)
    label_style = ParagraphStyle('lbl',   fontSize=8,  fontName='Helvetica-Bold', textColor=muted, spaceAfter=1)
    val_style   = ParagraphStyle('val',   fontSize=10, fontName='Helvetica',      textColor=dark)

    lines = po.get("lines", [])
    subtotal = sum(l.get("qty", 0) * l.get("cost", 0) for l in lines)
    igst     = subtotal * 0.18
    total    = subtotal + igst

    def inr(v):
        return f"₹ {v:,.2f}"

    story = []
    story.append(Paragraph(f"{po.get('po_number','')}  <font size=9 color='#1a73e8'>v{po.get('version',1)}</font>", title_style))
    story.append(Paragraph(f"{po.get('customer_name','')}  &bull;  {po.get('po_date','')}", sub_style))

    # Meta grid
    meta = [
        ["PO Date", po.get("po_date") or "—",
         "Delivery", po.get("delivery_date") or "—"],
        ["Currency", po.get("currency") or "INR",
         "Status", (po.get("status") or "").replace("_", " ").title()],
    ]
    if po.get("remarks"):
        meta.append(["Remarks", po.get("remarks"), "", ""])
    meta_table = Table(meta, colWidths=[30*mm, 60*mm, 30*mm, 60*mm])
    meta_table.setStyle(TableStyle([
        ('FONTNAME',  (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE',  (0,0), (-1,-1), 9),
        ('FONTNAME',  (0,0), (0,-1), 'Helvetica-Bold'),
        ('FONTNAME',  (2,0), (2,-1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0,0), (0,-1), muted),
        ('TEXTCOLOR', (2,0), (2,-1), muted),
        ('BACKGROUND',(0,0), (-1,-1), colors.HexColor('#f8f9fa')),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [colors.HexColor('#f8f9fa')]),
        ('BOX',       (0,0), (-1,-1), 0.5, colors.HexColor('#e5e7eb')),
        ('INNERGRID', (0,0), (-1,-1), 0.3, colors.HexColor('#e5e7eb')),
        ('TOPPADDING',(0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0), (-1,-1), 5),
        ('LEFTPADDING',(0,0), (-1,-1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 8*mm))

    # Line items table
    header = ["#", "Part / Description", "Qty", "Unit Price", "Line Total"]
    rows = [[str(i+1), l.get("part_number",""), str(l.get("qty",0)),
             inr(l.get("cost",0)), inr(l.get("qty",0)*l.get("cost",0))]
            for i, l in enumerate(lines)]
    col_w = [10*mm, 80*mm, 15*mm, 30*mm, 30*mm]
    tbl = Table([header] + rows, colWidths=col_w, repeatRows=1)
    tbl.setStyle(TableStyle([
        ('FONTNAME',     (0,0), (-1,0),  'Helvetica-Bold'),
        ('FONTSIZE',     (0,0), (-1,-1), 9),
        ('BACKGROUND',   (0,0), (-1,0),  colors.HexColor('#f3f4f6')),
        ('TEXTCOLOR',    (0,0), (-1,0),  muted),
        ('ROWBACKGROUNDS',(0,1),(-1,-1), [colors.white, colors.HexColor('#f9fafb')]),
        ('ALIGN',        (2,0), (-1,-1), 'RIGHT'),
        ('BOX',          (0,0), (-1,-1), 0.5, colors.HexColor('#e5e7eb')),
        ('INNERGRID',    (0,0), (-1,-1), 0.3, colors.HexColor('#e5e7eb')),
        ('TOPPADDING',   (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0), (-1,-1), 5),
        ('LEFTPADDING',  (0,0), (-1,-1), 6),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 6*mm))

    # Summary
    summary_data = [
        ["Total Base Amount (Subtotal)", inr(subtotal)],
        ["IGST @18%",                    inr(igst)],
        ["Total Order Value",            inr(total)],
    ]
    sum_tbl = Table(summary_data, colWidths=[130*mm, 35*mm], hAlign='RIGHT')
    sum_tbl.setStyle(TableStyle([
        ('FONTNAME',    (0,0), (-1,-2), 'Helvetica'),
        ('FONTNAME',    (0,-1),(-1,-1), 'Helvetica-Bold'),
        ('FONTSIZE',    (0,0), (-1,-2), 9),
        ('FONTSIZE',    (0,-1),(-1,-1), 11),
        ('TEXTCOLOR',   (0,0), (-1,-2), muted),
        ('TEXTCOLOR',   (0,-1),(-1,-1), accent),
        ('ALIGN',       (1,0), (1,-1),  'RIGHT'),
        ('LINEABOVE',   (0,-1),(-1,-1), 1, accent),
        ('TOPPADDING',  (0,0), (-1,-1), 4),
        ('BOTTOMPADDING',(0,0),(-1,-1), 4),
    ]))
    story.append(sum_tbl)

    doc.build(story)
    buf.seek(0)
    fname = f"{po.get('po_number','PO')}_v{po.get('version',1)}.pdf"
    return send_file(buf, mimetype="application/pdf",
                     as_attachment=True, download_name=fname)



# ─── PRODUCTION ORDERS (linked FROM Manufacturing) ───

@project_bp.route("/projects/<pid>/production-orders", methods=["GET"])
def get_project_production_orders(pid):
    """Read production orders from manufacturing that are linked to this project."""
    rows = db.session.execute(db.text(
        "SELECT id, order_no, fg_part_number, fg_description, planned_qty, produced_qty, "
        "rejected_qty, planned_start, planned_end, status, priority, created_at "
        "FROM manufacturing_production_orders "
        "WHERE project_id = :pid AND is_deleted = false ORDER BY created_at DESC"
    ), {"pid": pid}).fetchall()
    items = [{
        "id": r[0], "order_no": r[1], "fg_part_number": r[2], "fg_description": r[3] or "",
        "planned_qty": float(r[4] or 0), "produced_qty": float(r[5] or 0),
        "rejected_qty": float(r[6] or 0),
        "planned_start": str(r[7]) if r[7] else "", "planned_end": str(r[8]) if r[8] else "",
        "status": r[9] or "draft", "priority": r[10] or "normal",
        "created_at": str(r[11]) if r[11] else None
    } for r in rows]
    return {"success": True, "data": items}
