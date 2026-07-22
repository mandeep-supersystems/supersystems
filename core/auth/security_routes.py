from flask import Blueprint, request
from extensions import db
import uuid
import json
import bcrypt

security_bp = Blueprint("security", __name__)

# Available modules in the platform
MODULES = [
    {"code": "part_management", "name": "Part Management", "icon": "settings_input_component"},
    {"code": "auth_security", "name": "Auth & Security", "icon": "security"},
    {"code": "rm_management", "name": "RM Management", "icon": "science"},
    {"code": "machine_management", "name": "Machine Management", "icon": "precision_manufacturing"},
    {"code": "workflow_costing", "name": "Workflow & Costing", "icon": "account_tree"},
    {"code": "inventory", "name": "Inventory Management", "icon": "inventory_2"},
    {"code": "procurement", "name": "Procurement", "icon": "shopping_cart"},
    {"code": "finance", "name": "Finance", "icon": "account_balance"},
    {"code": "manufacturing", "name": "Manufacturing", "icon": "factory"},
    {"code": "warehouse", "name": "Warehouse Management", "icon": "warehouse"},
    {"code": "quality", "name": "Quality Management", "icon": "verified"},
    {"code": "hr", "name": "Human Resources", "icon": "people"},
    {"code": "project", "name": "Project Management", "icon": "assignment"},
    {"code": "logistics", "name": "Logistics", "icon": "local_shipping"},
    {"code": "analytics", "name": "Analytics & Reporting", "icon": "analytics"},
    {"code": "maintenance", "name": "Maintenance", "icon": "build"},
    {"code": "asset", "name": "Asset Management", "icon": "business"},
    {"code": "treasury", "name": "Treasury", "icon": "savings"},
    {"code": "supplier", "name": "Supplier Management", "icon": "handshake"},
    {"code": "plm", "name": "Product Lifecycle", "icon": "category"},
    {"code": "customer_service", "name": "Customer Service", "icon": "support_agent"},
    {"code": "governance", "name": "Governance & Risk", "icon": "shield"},
    {"code": "ehs", "name": "EHS", "icon": "health_and_safety"},
]

# Entities per module (what sections/buttons exist)
MODULE_ENTITIES = {
    "Part Management": ["categories", "subcategories", "parts", "generate_part_code", "part_mapping", "audit_logs", "obsolete_parts", "user_management"],
    "Auth & Security": ["users", "roles", "modules", "permissions", "audit_logs"],
    "Inventory Management": ["stock_levels", "stock_movements", "transfers", "adjustments", "counts", "reports"],
    "Procurement": ["requisitions", "purchase_orders", "goods_receipt", "vendor_invoices", "contracts", "reports"],
    "Finance": ["general_ledger", "accounts_payable", "accounts_receivable", "invoicing", "payments", "reports"],
    "Manufacturing": ["bom", "production_orders", "work_centers", "routing", "shop_floor", "reports"],
    "Warehouse Management": ["zones", "bins", "pick_lists", "putaway", "shipping", "receiving", "reports"],
    "Quality Management": ["inspections", "non_conformances", "capa", "quality_plans", "certificates", "reports"],
    "Human Resources": ["employees", "leave", "attendance", "payroll", "recruitment", "performance", "reports"],
}

# Actions available for each entity
ACTIONS = ["view", "create", "edit", "delete", "export", "import"]


DEFAULT_TENANT_ID = 'b424df0e-f766-4e94-b3fd-05777e158958'


def _get_tenant_id():
    tid = (request.headers.get("X-Tenant-ID") or "").strip()
    if not tid or tid == "TEST":
        return DEFAULT_TENANT_ID
    return tid


def _client_ip():
    """Get real client IP from X-Forwarded-For (set by nginx/proxy) or fallback."""
    forwarded = request.headers.get('X-Forwarded-For', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.remote_addr or ''


def _log_audit(action, entity_type, entity_id, details='', old_values=None, new_values=None):
    try:
        user_email = request.headers.get('X-User-Email', '')
        user_name = request.headers.get('X-User-Name', '')
        extra = {}
        if details:
            extra['details'] = details
        if old_values and new_values:
            extra['changes'] = {k: {'old': old_values.get(k), 'new': v}
                                for k, v in new_values.items() if old_values.get(k) != v}
        if old_values:
            extra['old'] = old_values
        if new_values:
            extra['new'] = new_values
        old_v = json.dumps(old_values) if old_values is not None else None
        new_v = json.dumps(new_values) if new_values is not None else None
        db.session.execute(db.text(
            "INSERT INTO audit.logs (id, action, module, entity_type, entity_id, ip_address, tenant_id, user_email, user_name, old_values, new_values, extra_data, created_at) "
            "VALUES (:id, :action, 'Auth & Security', :etype, :eid, :ip, :tid, :email, :name, :old_v, :new_v, :extra, NOW())"
        ), {
            "id": str(uuid.uuid4()),
            "action": action, "etype": entity_type, "eid": str(entity_id),
            "ip": _client_ip(), "tid": _get_tenant_id(),
            "email": user_email, "name": user_name,
            "old_v": old_v, "new_v": new_v,
            "extra": json.dumps(extra) if extra else None
        })
        db.session.commit()
    except Exception:
        db.session.rollback()


# ─── OVERVIEW ───
@security_bp.route("/overview", methods=["GET"])
def security_overview():
    tid = _get_tenant_id()
    tid_cond = "(tenant_id = :tid OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = 'TEST' OR tenant_id = '' OR tenant_id IS NULL)"
    users_count = db.session.execute(db.text(
        f"SELECT COUNT(*) FROM iam.users WHERE {tid_cond} AND is_deleted = false"
    ), {"tid": tid}).scalar() or 0
    roles_count = db.session.execute(db.text(
        f"SELECT COUNT(*) FROM iam.module_roles WHERE (tenant_id = :tid OR tenant_id = 'SYSTEM' OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = '' OR tenant_id IS NULL) AND is_active = true"
    ), {"tid": tid}).scalar() or 0
    module_users = db.session.execute(db.text(
        f"SELECT COUNT(*) FROM iam.module_access WHERE {tid_cond} AND is_active = true"
    ), {"tid": tid}).scalar() or 0
    modules_active = db.session.execute(db.text(
        f"SELECT COUNT(DISTINCT module) FROM iam.module_access WHERE {tid_cond} AND is_active = true"
    ), {"tid": tid}).scalar() or 0
    return {"success": True, "data": {
        "total_users": users_count, "total_roles": roles_count,
        "module_assignments": module_users, "active_modules": modules_active
    }}


# ─── MODULES LIST ───
@security_bp.route("/modules", methods=["GET"])
def list_modules():
    return {"success": True, "data": MODULES}


@security_bp.route("/modules/entities", methods=["GET"])
def list_module_entities():
    module = request.args.get("module", "")
    entities = MODULE_ENTITIES.get(module, [])
    return {"success": True, "data": {"module": module, "entities": entities, "actions": ACTIONS}}


# ─── USERS (org users) ───
@security_bp.route("/users", methods=["GET"])
def list_org_users():
    tid = _get_tenant_id()
    rows = db.session.execute(db.text(
        "SELECT id, email, first_name, last_name, phone, is_active, created_at "
        "FROM iam.users WHERE (tenant_id = :tid OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = 'TEST' OR tenant_id = '' OR tenant_id IS NULL) AND is_deleted = false ORDER BY created_at DESC"
    ), {"tid": tid})
    items = [{"id": r[0], "email": r[1], "first_name": r[2] or '', "last_name": r[3] or '',
              "phone": r[4] or '', "is_active": r[5], "created_at": str(r[6]) if r[6] else None} for r in rows]
    return {"success": True, "data": items}


@security_bp.route("/users", methods=["POST"])
def create_user():
    data = request.get_json()
    tenant_id = _get_tenant_id()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    if not email or not password:
        return {"success": False, "message": "Email and password required"}, 400
    existing = db.session.execute(db.text(
        "SELECT id FROM iam.users WHERE LOWER(email) = LOWER(:email) AND is_deleted = false"
    ), {"email": email}).first()
    if existing:
        return {"success": False, "message": "Email already exists"}, 409
    user_id = str(uuid.uuid4())
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    db.session.execute(db.text(
        "INSERT INTO iam.users (id, email, password_hash, first_name, last_name, phone, tenant_id, is_active) "
        "VALUES (:id, :email, :hash, :fn, :ln, :phone, :tid, true)"
    ), {"id": user_id, "email": email, "hash": password_hash,
        "fn": data.get("first_name", ""), "ln": data.get("last_name", ""),
        "phone": data.get("phone", ""), "tid": tenant_id})
    db.session.commit()
    _log_audit('CREATE', 'User', email)
    return {"success": True, "data": {"id": user_id}, "message": "User created"}, 201


@security_bp.route("/users/<user_id>", methods=["PUT"])
def update_user(user_id):
    data = request.get_json()
    old = db.session.execute(db.text(
        "SELECT email, first_name, last_name, phone, is_active FROM iam.users WHERE id=:id"
    ), {"id": user_id}).first()
    old_values = {"email": old[0], "first_name": old[1], "last_name": old[2], "phone": old[3], "is_active": old[4]} if old else {}
    email = old[0] if old else user_id
    updates, params = [], {"id": user_id}
    if "first_name" in data:
        updates.append("first_name=:fn"); params["fn"] = data["first_name"]
    if "last_name" in data:
        updates.append("last_name=:ln"); params["ln"] = data["last_name"]
    if "phone" in data:
        updates.append("phone=:phone"); params["phone"] = data["phone"]
    if "is_active" in data:
        updates.append("is_active=:active"); params["active"] = data["is_active"]
    if "password" in data and data["password"]:
        updates.append("password_hash=:hash")
        params["hash"] = bcrypt.hashpw(data["password"].encode(), bcrypt.gensalt()).decode()
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE iam.users SET {', '.join(updates)} WHERE id=:id"), params)
    db.session.commit()
    new_values = {k: data[k] for k in ["first_name", "last_name", "phone", "is_active"] if k in data}
    _log_audit('UPDATE', 'User', email, old_values=old_values, new_values=new_values)
    return {"success": True, "message": "User updated"}


@security_bp.route("/users/<user_id>", methods=["DELETE"])
def delete_user(user_id):
    row = db.session.execute(db.text(
        "SELECT email, first_name, last_name FROM iam.users WHERE id=:id"
    ), {"id": user_id}).first()
    email = row[0] if row else user_id
    old_values = {"email": row[0], "name": f"{row[1] or ''} {row[2] or ''}".strip()} if row else {}
    db.session.execute(db.text("UPDATE iam.users SET is_deleted=true WHERE id=:id"), {"id": user_id})
    db.session.execute(db.text("DELETE FROM iam.module_access WHERE user_id=:id"), {"id": user_id})
    db.session.commit()
    _log_audit('DELETE', 'User', email, old_values=old_values)
    return {"success": True, "message": "User deleted"}


# ─── MODULE ACCESS (assign users to modules) ───
@security_bp.route("/module-access", methods=["GET"])
def list_module_access():
    tid = _get_tenant_id()
    module = request.args.get("module", "")
    where = "(ma.tenant_id = :tid OR ma.tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR ma.tenant_id = 'TEST' OR ma.tenant_id = '' OR ma.tenant_id IS NULL)"
    params = {"tid": tid}
    if module:
        where += " AND ma.module = :module"
        params["module"] = module
    rows = db.session.execute(db.text(
        f"SELECT ma.id, ma.user_id, ma.module, ma.role, ma.permissions, ma.is_active, ma.created_at, "
        f"u.email, u.first_name, u.last_name, ma.granted_by, ma.updated_at "
        f"FROM iam.module_access ma JOIN iam.users u ON ma.user_id = u.id "
        f"WHERE {where} ORDER BY ma.module, ma.created_at DESC"
    ), params)
    items = [{"id": r[0], "user_id": r[1], "module": r[2], "role": r[3],
              "permissions": r[4] or {}, "is_active": r[5], "created_at": str(r[6]) if r[6] else None,
              "email": r[7], "first_name": r[8] or '', "last_name": r[9] or '',
              "granted_by": r[10] or '', "updated_at": str(r[11]) if r[11] else None} for r in rows]
    return {"success": True, "data": items}


@security_bp.route("/module-access", methods=["POST"])
def grant_module_access():
    data = request.get_json()
    user_id = data.get("user_id")
    module = data.get("module")
    role = data.get("role", "viewer")
    permissions = data.get("permissions", {})
    if not user_id or not module:
        return {"success": False, "message": "user_id and module required"}, 400
        
    user_row = db.session.execute(db.text(
        "SELECT tenant_id FROM iam.users WHERE id = :uid"
    ), {"uid": user_id}).first()
    tenant_id = (user_row[0] if user_row and user_row[0] else None) or _get_tenant_id()

    existing = db.session.execute(db.text(
        "SELECT id FROM iam.module_access WHERE user_id=:uid AND module=:mod"
    ), {"uid": user_id, "mod": module}).first()
    if existing:
        return {"success": False, "message": "User already has access to this module"}, 409

    access_id = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO iam.module_access (id, user_id, module, role, permissions, granted_by, tenant_id) "
        "VALUES (:id, :uid, :mod, :role, :perms, :granted_by, :tid)"
    ), {"id": access_id, "uid": user_id, "mod": module, "role": role,
        "perms": json.dumps(permissions), "granted_by": request.headers.get('X-User-Email', ''),
        "tid": tenant_id})
    db.session.commit()
    _log_audit('GRANT_ACCESS', 'Module Access', f"{user_id} -> {module}")
    return {"success": True, "message": "Access granted"}, 201


@security_bp.route("/module-access/<access_id>", methods=["PUT"])
@security_bp.route("/module-access/<access_id>/permissions", methods=["PUT"])
def update_module_access(access_id):
    data = request.get_json()
    updates = []
    params = {"id": access_id}
    if "role" in data:
        updates.append("role=:role")
        params["role"] = data["role"]
    if "permissions" in data:
        updates.append("permissions=:perms")
        params["perms"] = json.dumps(data["permissions"])
    if "is_active" in data:
        updates.append("is_active=:active")
        params["active"] = data["is_active"]
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE iam.module_access SET {', '.join(updates)} WHERE id=:id"), params)
    db.session.commit()
    _log_audit('UPDATE_ACCESS', 'Module Access', access_id)
    return {"success": True, "message": "Access updated"}


@security_bp.route("/module-access/<access_id>", methods=["DELETE"])
def revoke_module_access(access_id):
    row = db.session.execute(db.text(
        "SELECT u.email, ma.module, ma.role FROM iam.module_access ma "
        "JOIN iam.users u ON ma.user_id = u.id WHERE ma.id=:id"
    ), {"id": access_id}).first()
    label = f"{row[0]} -> {row[1]}" if row else access_id
    old_values = {"email": row[0], "module": row[1], "role": row[2]} if row else {}
    db.session.execute(db.text("DELETE FROM iam.module_access WHERE id=:id"), {"id": access_id})
    db.session.commit()
    _log_audit('REVOKE_ACCESS', 'Module Access', label, old_values=old_values)
    return {"success": True, "message": "Access revoked"}


# ─── MODULE ROLES ───
@security_bp.route("/roles", methods=["GET"])
def list_module_roles():
    tid = _get_tenant_id()
    module = request.args.get("module", "")
    where = "(tenant_id = :tid OR tenant_id = 'SYSTEM' OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = 'TEST' OR tenant_id = '' OR tenant_id IS NULL) AND is_active = true"
    params = {"tid": tid}
    if module:
        where += " AND module = :module"
        params["module"] = module
    rows = db.session.execute(db.text(
        f"SELECT id, name, code, module, permissions, is_system, created_at "
        f"FROM iam.module_roles WHERE {where} ORDER BY module, is_system DESC, name"
    ), params)
    items = [{"id": r[0], "name": r[1], "code": r[2], "module": r[3],
              "permissions": r[4] or {}, "is_system": r[5], "created_at": str(r[6]) if r[6] else None} for r in rows]

    # Ensure system roles always exist in output for the requested module
    if module:
        system_role_codes = {r['code'] for r in items if r.get('is_system')}
        default_system_roles = [
            {"id": f"sys_admin_{module}", "name": "Module Admin", "code": "module_admin", "module": module, "permissions": {}, "is_system": True},
            {"id": f"sys_editor_{module}", "name": "Editor", "code": "editor", "module": module, "permissions": {}, "is_system": True},
            {"id": f"sys_viewer_{module}", "name": "Viewer", "code": "viewer", "module": module, "permissions": {}, "is_system": True},
        ]
        for dsr in default_system_roles:
            if dsr['code'] not in system_role_codes:
                items.insert(0, dsr)

    return {"success": True, "data": items}


@security_bp.route("/roles", methods=["POST"])
def create_module_role():
    data = request.get_json()
    tenant_id = _get_tenant_id()
    name = data.get("name", "").strip()
    code = data.get("code", "").strip().lower()
    module = data.get("module", "")
    permissions = data.get("permissions", {})
    if not name or not code or not module:
        return {"success": False, "message": "name, code, and module required"}, 400
    existing = db.session.execute(db.text(
        "SELECT id FROM iam.module_roles WHERE code=:code AND module=:mod AND (tenant_id=:tid OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958')"
    ), {"code": code, "mod": module, "tid": tenant_id}).first()
    if existing:
        return {"success": False, "message": "Role code already exists for this module"}, 409
    role_id = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO iam.module_roles (id, name, code, module, permissions, is_system, tenant_id) "
        "VALUES (:id, :name, :code, :mod, :perms, false, :tid)"
    ), {"id": role_id, "name": name, "code": code, "mod": module,
        "perms": json.dumps(permissions), "tid": tenant_id})
    db.session.commit()
    _log_audit('CREATE', 'Module Role', f"{name} ({code})")
    return {"success": True, "data": {"id": role_id}, "message": "Role created"}, 201


@security_bp.route("/roles/<role_id>", methods=["PUT"])
def update_module_role(role_id):
    data = request.get_json()
    row = db.session.execute(db.text("SELECT is_system, name, module FROM iam.module_roles WHERE id=:id"), {"id": role_id}).first()
    if row and row[0]:
        return {"success": False, "message": "Cannot edit system roles"}, 403
    role_name = f"{row[1]} ({row[2]})" if row else role_id
    updates, params = [], {"id": role_id}
    if "name" in data:
        updates.append("name=:name"); params["name"] = data["name"]
    if "permissions" in data:
        updates.append("permissions=:perms"); params["perms"] = json.dumps(data["permissions"])
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE iam.module_roles SET {', '.join(updates)} WHERE id=:id"), params)
    db.session.commit()
    _log_audit('UPDATE', 'Module Role', role_name, new_values={k: v for k, v in data.items() if k != 'permissions'})
    return {"success": True, "message": "Role updated"}


@security_bp.route("/roles/<role_id>", methods=["DELETE"])
def delete_module_role(role_id):
    row = db.session.execute(db.text("SELECT is_system, name, module FROM iam.module_roles WHERE id=:id"), {"id": role_id}).first()
    if row and row[0]:
        return {"success": False, "message": "Cannot delete system roles"}, 403
    role_name = f"{row[1]} ({row[2]})" if row else role_id
    db.session.execute(db.text("UPDATE iam.module_roles SET is_active=false WHERE id=:id"), {"id": role_id})
    db.session.commit()
    _log_audit('DELETE', 'Module Role', role_name, old_values={"name": row[1], "module": row[2]} if row else {})
    return {"success": True, "message": "Role deleted"}


# ─── SEARCH EMPLOYEES & SYSTEM USERS ───
@security_bp.route("/search-employees", methods=["GET"])
def search_employees():
    """Search system users and HR employees by name, email, or emp_code for user selection."""
    tid = _get_tenant_id()
    q = request.args.get("q", "").strip()
    if not q or len(q) < 2:
        return {"success": True, "data": []}
    search = f"%{q}%"

    user_rows = db.session.execute(db.text(
        "SELECT u.id, '' as emp_code, u.first_name, u.last_name, u.email, u.phone, 'System User' as designation "
        "FROM iam.users u WHERE u.is_deleted = false "
        "AND (LOWER(u.first_name) LIKE LOWER(:q) OR LOWER(u.last_name) LIKE LOWER(:q) "
        "OR LOWER(u.email) LIKE LOWER(:q)) "
        "ORDER BY u.first_name LIMIT 10"
    ), {"q": search}).fetchall()

    existing_emails = {r[4].lower() for r in user_rows if r[4]}
    items = [{
        "id": r[0], "emp_code": r[1], "first_name": r[2] or '', "last_name": r[3] or '',
        "email": r[4] or '', "phone": r[5] or '', "designation": r[6] or '', "is_user": True
    } for r in user_rows]

    emp_rows = db.session.execute(db.text(
        "SELECT id, emp_code, first_name, last_name, email, phone, designation "
        "FROM hr.employees WHERE is_deleted = false AND status = 'active' "
        "AND (LOWER(first_name) LIKE LOWER(:q) OR LOWER(last_name) LIKE LOWER(:q) "
        "OR LOWER(email) LIKE LOWER(:q) OR LOWER(emp_code) LIKE LOWER(:q)) "
        "ORDER BY first_name LIMIT 10"
    ), {"q": search}).fetchall()

    for r in emp_rows:
        emp_email = (r[4] or '').lower()
        if emp_email not in existing_emails:
            items.append({
                "id": r[0], "emp_code": r[1], "first_name": r[2] or '', "last_name": r[3] or '',
                "email": r[4] or '', "phone": r[5] or '', "designation": r[6] or '', "is_user": False
            })

    return {"success": True, "data": items}


@security_bp.route("/import-employee", methods=["POST"])
def import_employee_as_user():
    """Create/link an HR employee as a system user in iam.users."""
    data = request.get_json()
    tenant_id = _get_tenant_id()
    employee_id = data.get("employee_id")
    if not employee_id:
        return {"success": False, "message": "employee_id required"}, 400
    emp = db.session.execute(db.text(
        "SELECT id, emp_code, first_name, last_name, email, phone "
        "FROM hr.employees WHERE id = :id AND is_deleted = false"
    ), {"id": employee_id}).first()
    if not emp:
        return {"success": False, "message": "Employee not found"}, 404
    email = emp[4] or f"{emp[1].lower()}@system.local"
    existing = db.session.execute(db.text(
        "SELECT id FROM iam.users WHERE LOWER(email) = LOWER(:email) AND is_deleted = false"
    ), {"email": email}).first()
    if existing:
        return {"success": True, "data": {"id": existing[0], "email": email, "already_exists": True},
                "message": "User already exists"}
    import bcrypt
    user_id = str(uuid.uuid4())
    default_pwd = emp[1]
    password_hash = bcrypt.hashpw(default_pwd.encode(), bcrypt.gensalt()).decode()
    db.session.execute(db.text(
        "INSERT INTO iam.users (id, email, password_hash, first_name, last_name, phone, tenant_id, is_active) "
        "VALUES (:id, :email, :hash, :fn, :ln, :phone, :tid, true)"
    ), {"id": user_id, "email": email, "hash": password_hash,
        "fn": emp[2] or '', "ln": emp[3] or '', "phone": emp[5] or '', "tid": tenant_id})
    db.session.commit()
    _log_audit('IMPORT_EMPLOYEE', 'User', email)
    return {"success": True, "data": {"id": user_id, "email": email, "default_password": default_pwd},
            "message": f"User created from employee {emp[1]}"}, 201


# ─── AVAILABLE USERS (not yet assigned to a module) ───
@security_bp.route("/available-users", methods=["GET"])
def available_users_for_module():
    tid = _get_tenant_id()
    module = request.args.get("module", "")
    tid_cond = "(tenant_id = :tid OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = 'TEST' OR tenant_id = '' OR tenant_id IS NULL)"
    if not module:
        rows = db.session.execute(db.text(
            f"SELECT id, email, first_name, last_name FROM iam.users "
            f"WHERE {tid_cond} AND is_deleted=false AND is_active=true ORDER BY email"
        ), {"tid": tid})
    else:
        rows = db.session.execute(db.text(
            f"SELECT u.id, u.email, u.first_name, u.last_name FROM iam.users u "
            f"WHERE {tid_cond} AND u.is_deleted=false AND u.is_active=true "
            f"AND u.id NOT IN (SELECT user_id FROM iam.module_access WHERE module=:mod AND {tid_cond}) "
            f"ORDER BY u.email"
        ), {"tid": tid, "mod": module})
    items = [{"id": r[0], "email": r[1], "first_name": r[2] or '', "last_name": r[3] or ''} for r in rows]
    return {"success": True, "data": items}


# ─── AUDIT LOGS ───
@security_bp.route("/audit-logs", methods=["GET"])
def security_audit_logs():
    tid = _get_tenant_id()
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 30, type=int)
    action_filter = request.args.get('action', '').strip()
    offset = (page - 1) * limit

    cond = "AND (tenant_id = :tid OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = 'TEST' OR tenant_id = '' OR tenant_id IS NULL) "
    params = {"tid": tid, "limit": limit, "offset": offset}
    if action_filter:
        cond += "AND action = :action "
        params["action"] = action_filter

    rows = db.session.execute(db.text(
        f"SELECT id, action, entity_type, entity_id, ip_address, created_at, user_email, user_name, old_values, new_values, extra_data "
        f"FROM audit.logs WHERE (module = 'Auth & Security' OR action IN ('LOGIN', 'LOGOUT')) {cond} "
        f"ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    ), params)
    logs = [{
        "id": r[0], "action": r[1], "entity_type": r[2], "entity_id": r[3],
        "ip_address": r[4], "created_at": str(r[5]) if r[5] else None,
        "user_email": r[6] or '', "user_name": r[7] or '',
        "old_values": r[8], "new_values": r[9], "extra_data": r[10]
    } for r in rows]

    total = db.session.execute(db.text(
        f"SELECT COUNT(*) FROM audit.logs WHERE (module = 'Auth & Security' OR action IN ('LOGIN', 'LOGOUT')) {cond}"
    ), params).scalar() or 0
    return {"success": True, "data": {"items": logs, "total": total, "page": page}}


# ─── LOGIN & LOGOUT HISTORY ───
@security_bp.route("/login-history", methods=["GET"])
def security_login_history():
    tid = _get_tenant_id()
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 30, type=int)
    offset = (page - 1) * limit
    rows = db.session.execute(db.text(
        "SELECT id, user_id, email, login_at, logout_at, ip_address, user_agent, login_type "
        "FROM audit.login_history "
        "WHERE (tenant_id = :tid OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = 'TEST' OR tenant_id = '' OR tenant_id IS NULL) "
        "ORDER BY login_at DESC LIMIT :limit OFFSET :offset"
    ), {"tid": tid, "limit": limit, "offset": offset})
    items = [{
        "id": str(r[0]), "user_id": r[1], "email": r[2],
        "login_at": str(r[3]) if r[3] else None,
        "logout_at": str(r[4]) if r[4] else None,
        "ip_address": r[5] or '', "user_agent": r[6] or '', "login_type": r[7] or ''
    } for r in rows]
    total = db.session.execute(db.text(
        "SELECT COUNT(*) FROM audit.login_history "
        "WHERE (tenant_id = :tid OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = 'TEST' OR tenant_id = '' OR tenant_id IS NULL)"
    ), {"tid": tid}).scalar() or 0
    return {"success": True, "data": {"items": items, "total": total, "page": page}}


# ─── USER MODULE ACCESS (for services panel filtering) ───
@security_bp.route("/user-module-access", methods=["GET"])
def get_user_module_access():
    """Return list of modules the current user has active access to."""
    user_id = request.headers.get("X-User-ID", "").strip()
    user_email = request.headers.get("X-User-Email", "").strip()
    if not user_id and not user_email:
        return {"success": True, "data": [], "show_all": True}

    # Resolve user_id from email if needed
    resolved_uid = user_id
    if not resolved_uid and user_email:
        user = db.session.execute(db.text(
            "SELECT id FROM iam.users WHERE LOWER(email) = LOWER(:email) AND is_deleted = false LIMIT 1"
        ), {"email": user_email}).first()
        resolved_uid = user[0] if user else None

    if not resolved_uid:
        return {"success": True, "data": [], "show_all": True}

    rows = db.session.execute(db.text(
        "SELECT module, role FROM iam.module_access WHERE is_active = true AND user_id = :uid ORDER BY module"
    ), {"uid": resolved_uid}).fetchall()

    # If user has no module_access rows at all, show all (owner/admin with no restrictions)
    if not rows:
        return {"success": True, "data": [], "show_all": True}

    return {"success": True, "data": [{"module": r[0], "role": r[1]} for r in rows], "show_all": False}


# ─── USER PERMISSIONS SUMMARY ───
@security_bp.route("/user-permissions", methods=["GET"])
def user_permissions_summary():
    """All users with their module assignments, roles, and permissions."""
    tid = _get_tenant_id()
    rows = db.session.execute(db.text(
        "SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.is_active, u.last_login, "
        "COALESCE(e.emp_code, '') as emp_code, "
        "ma.id as access_id, ma.module, ma.role, ma.permissions, ma.is_active as access_active "
        "FROM iam.users u "
        "LEFT JOIN iam.module_access ma ON ma.user_id = u.id "
        "LEFT JOIN hr.employees e ON LOWER(e.email) = LOWER(u.email) AND e.is_deleted = false "
        "WHERE u.is_deleted = false AND (u.tenant_id = :tid OR u.tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR u.tenant_id = 'TEST' OR u.tenant_id = '' OR u.tenant_id IS NULL) "
        "ORDER BY u.first_name, u.email, ma.module"
    ), {"tid": tid})

    users = {}
    for r in rows:
        uid = r[0]
        if uid not in users:
            users[uid] = {
                "id": uid, "email": r[1], "first_name": r[2] or "", "last_name": r[3] or "",
                "phone": r[4] or "", "is_active": r[5], "last_login": str(r[6]) if r[6] else None,
                "emp_code": r[7], "modules": []
            }
        if r[8]:  # access_id exists
            users[uid]["modules"].append({
                "access_id": r[8], "module": r[9], "role": r[10],
                "permissions": r[11] or {}, "is_active": r[12]
            })
    return {"success": True, "data": list(users.values())}


@security_bp.route("/module-access/<access_id>/permissions", methods=["PUT"])
def update_access_permissions(access_id):
    """Update role and permissions for a specific module access entry."""
    data = request.get_json()
    updates, params = ["updated_at=NOW()"], {"id": access_id}
    if "role" in data:
        updates.append("role=:role"); params["role"] = data["role"]
    if "permissions" in data:
        import json
        updates.append("permissions=:perms"); params["perms"] = json.dumps(data["permissions"])
    if "is_active" in data:
        updates.append("is_active=:active"); params["active"] = data["is_active"]
    db.session.execute(db.text(f"UPDATE iam.module_access SET {', '.join(updates)} WHERE id=:id"), params)
    _log_audit('UPDATE_PERMISSIONS', 'Module Access', access_id)
    db.session.commit()
    return {"success": True, "message": "Permissions updated"}


# ─── CHECK PERMISSION (for frontend button visibility) ───
@security_bp.route("/check-access", methods=["POST"])
def check_user_access():
    data = request.get_json()
    tenant_id = request.headers.get("X-Tenant-ID", "")
    user_email = request.headers.get("X-User-Email", "")
    module = data.get("module", "")
    entity = data.get("entity", "")
    action = data.get("action", "")

    if not user_email:
        return {"success": True, "data": {"allowed": True}}

    user = db.session.execute(db.text(
        "SELECT id FROM iam.users WHERE email=:email AND tenant_id=:tid"
    ), {"email": user_email, "tid": tenant_id}).first()
    if not user:
        return {"success": True, "data": {"allowed": True}}

    access = db.session.execute(db.text(
        "SELECT role, permissions FROM iam.module_access "
        "WHERE user_id=:uid AND module=:mod AND tenant_id=:tid AND is_active=true"
    ), {"uid": user[0], "mod": module, "tid": tenant_id}).first()
    if not access:
        return {"success": True, "data": {"allowed": False, "reason": "No module access"}}

    role_code = access[0]
    custom_perms = access[1] or {}

    # Get role permissions from module_roles
    role_row = db.session.execute(db.text(
        "SELECT permissions FROM iam.module_roles WHERE code=:code AND module=:mod AND (tenant_id=:tid OR tenant_id='SYSTEM') LIMIT 1"
    ), {"code": role_code, "mod": module, "tid": tenant_id}).first()

    role_perms = role_row[0] if role_row else {}
    if isinstance(role_perms, str):
        role_perms = json.loads(role_perms)
    if isinstance(custom_perms, str):
        custom_perms = json.loads(custom_perms)

    # Merge: role permissions + custom overrides
    entity_actions = role_perms.get(entity, [])
    if isinstance(custom_perms, dict):
        entity_actions = list(set(entity_actions + custom_perms.get(entity, [])))

    allowed = action in entity_actions
    return {"success": True, "data": {"allowed": allowed, "role": role_code, "entity_actions": entity_actions}}
