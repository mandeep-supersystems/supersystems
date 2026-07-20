from flask import Flask, render_template, request, redirect
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_cors import CORS
from config.settings import config_by_name
from extensions import db, jwt, migrate, cache, limiter


def _serialize_identity(identity):
    """Convert dict identity to JSON string for JWT sub claim."""
    import json
    if isinstance(identity, dict):
        return json.dumps(identity)
    return identity


def _deserialize_identity(identity_str):
    """Convert JSON string back to dict."""
    import json
    if isinstance(identity_str, str):
        try:
            return json.loads(identity_str)
        except (json.JSONDecodeError, TypeError):
            return identity_str
    return identity_str


def create_app(config_name="development"):
    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])

    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)
    cache.init_app(app)
    limiter.init_app(app)
    CORS(app)

    # JWT identity serialization: store dict as JSON string in 'sub'
    @jwt.user_identity_loader
    def user_identity_lookup(identity):
        return _serialize_identity(identity)

    # Level 0: Platform Super Admin Portal (separate portal)
    from core.super_admin.routes import super_admin_bp
    app.register_blueprint(super_admin_bp, url_prefix="/api/v1/super-admin")

    # Core Blueprints
    from core.auth.routes import auth_bp
    from core.auth.security_routes import security_bp
    from core.workflow.routes import workflow_bp
    from core.audit.routes import audit_bp
    from core.notification.routes import notification_bp
    from core.dms.routes import dms_bp
    from core.reporting.routes import reporting_bp
    from core.api_gateway.routes import gateway_bp
    from core.ai.routes import ai_bp
    from core.master_data.routes import master_data_bp

    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
    app.register_blueprint(security_bp, url_prefix="/api/v1/security")
    app.register_blueprint(workflow_bp, url_prefix="/api/v1/workflow")
    app.register_blueprint(audit_bp, url_prefix="/api/v1/audit")
    app.register_blueprint(notification_bp, url_prefix="/api/v1/notifications")
    app.register_blueprint(dms_bp, url_prefix="/api/v1/dms")
    app.register_blueprint(reporting_bp, url_prefix="/api/v1/reports")
    app.register_blueprint(gateway_bp, url_prefix="/api/v1/gateway")
    app.register_blueprint(ai_bp, url_prefix="/api/v1/ai")
    app.register_blueprint(master_data_bp, url_prefix="/api/v1/master-data")

    # Business Module Blueprints
    from modules.inventory.routes import inventory_bp
    from modules.procurement.routes import procurement_bp
    from modules.finance.routes import finance_bp
    from modules.hr.routes import hr_bp
    from modules.manufacturing.routes import manufacturing_bp
    from modules.quality.routes import quality_bp
    from modules.warehouse.routes import warehouse_bp
    from modules.maintenance.routes import maintenance_bp
    from modules.project_management.routes import project_bp
    from modules.logistics.routes import logistics_bp
    from modules.customer_service.routes import customer_service_bp
    from modules.analytics.routes import analytics_bp
    from modules.treasury.routes import treasury_bp
    from modules.asset_management.routes import asset_bp
    from modules.governance_risk.routes import governance_bp
    from modules.product_lifecycle.routes import plm_bp
    from modules.supplier_management.routes import supplier_bp  # noqa: F811
    from modules.ehs.routes import ehs_bp
    from modules.part.routes import part_bp
    from modules.rawmaterial.routes import rawmaterial_bp
    from modules.machine.routes import machine_bp
    from modules.workflow_costing.routes import workflow_bp

    app.register_blueprint(inventory_bp, url_prefix="/api/v1/inventory")
    app.register_blueprint(procurement_bp, url_prefix="/api/v1/procurement")
    app.register_blueprint(finance_bp, url_prefix="/api/v1/finance")
    app.register_blueprint(hr_bp, url_prefix="/api/v1/hr")
    app.register_blueprint(manufacturing_bp, url_prefix="/api/v1/manufacturing")
    app.register_blueprint(quality_bp, url_prefix="/api/v1/quality")
    app.register_blueprint(warehouse_bp, url_prefix="/api/v1/warehouse")
    app.register_blueprint(maintenance_bp, url_prefix="/api/v1/maintenance")
    app.register_blueprint(project_bp, url_prefix="/api/v1/projects")
    app.register_blueprint(logistics_bp, url_prefix="/api/v1/logistics")
    app.register_blueprint(customer_service_bp, url_prefix="/api/v1/customer-service")
    app.register_blueprint(analytics_bp, url_prefix="/api/v1/analytics")
    app.register_blueprint(treasury_bp, url_prefix="/api/v1/treasury")
    app.register_blueprint(asset_bp, url_prefix="/api/v1/assets")
    app.register_blueprint(governance_bp, url_prefix="/api/v1/governance")
    app.register_blueprint(plm_bp, url_prefix="/api/v1/plm")
    app.register_blueprint(supplier_bp, url_prefix="/api/v1/suppliers")
    app.register_blueprint(ehs_bp, url_prefix="/api/v1/ehs")
    app.register_blueprint(part_bp, url_prefix="/api/v1/part")
    app.register_blueprint(rawmaterial_bp, url_prefix="/api/v1/rawmaterial")
    app.register_blueprint(machine_bp, url_prefix="/api/v1/machine")
    app.register_blueprint(workflow_bp, url_prefix="/api/v1/workflow-costing")

    @app.route("/login")
    def login_page():
        return render_template("login.html")

    def _require_auth():
        """Check JWT token from cookie or Authorization header for page routes."""
        from flask_jwt_extended import decode_token
        from flask_jwt_extended.exceptions import JWTExtendedException
        from jwt.exceptions import PyJWTError
        token = request.cookies.get('access_token') or request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return False
        try:
            decode_token(token)
            return True
        except (JWTExtendedException, PyJWTError, Exception):
            return False

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/part")
    @app.route("/part/<section>")
    def part_page(section=None):
        return render_template("part/part.html")

    @app.route("/part/detail/<part_number>")
    def part_detail_page(part_number):
        return render_template("part/part_detail.html", part_number=part_number)

    @app.route("/auth")
    @app.route("/auth/<section>")
    def auth_security_page(section=None):
        return render_template("auth/auth_security.html")

    @app.route("/hr")
    @app.route("/hr/<section>")
    def hr_page(section=None):
        return render_template("hr/hr.html")

    @app.route("/hr/employee/<emp_id>")
    def hr_employee_detail(emp_id):
        return render_template("hr/employee_detail.html", emp_id=emp_id)

    @app.route("/project")
    @app.route("/project/<section>")
    def project_page(section=None):
        return render_template("project/project.html")

    @app.route("/rawmaterial")
    @app.route("/rawmaterial/<section>")
    def rawmaterial_page(section=None):
        return render_template("rawmaterial/rawmaterial.html")

    @app.route("/procurement")
    @app.route("/procurement/<section>")
    def procurement_page(section=None):
        return render_template("procurement/procurement.html")

    @app.route("/supplier")
    @app.route("/supplier/<section>")
    def supplier_page(section=None):
        return render_template("supplier/supplier.html")

    @app.route("/supplier/detail/<sid>")
    def supplier_detail_page(sid):
        return render_template("supplier/supplier_detail.html", supplier_id=sid)

    @app.route("/supplier/evaluation")
    def supplier_evaluation_page():
        return render_template("supplier/supplier_evaluation.html")

    @app.route("/supplier/contracts")
    def supplier_contracts_page():
        return render_template("supplier/supplier_contracts.html")

    @app.route("/supplier/performance")
    def supplier_performance_page():
        return render_template("supplier/supplier_performance.html")

    @app.route("/machine")
    @app.route("/machine/<section>")
    def machine_page(section=None):
        return render_template("machine/machine.html")

    @app.route("/workflow")
    @app.route("/workflow/<section>")
    def workflow_page(section=None):
        return render_template("workflow/workflow.html")

    @app.route("/workflow/routing/<rid>")
    def workflow_routing_detail(rid):
        return render_template("workflow/routing_detail.html", routing_id=rid)

    @app.route("/superadmin")
    def superadmin_portal():
        return render_template("superadmin.html")

    # Audit log helper
    def log_audit(action, module, entity_type, entity_id, tenant_id):
        import uuid
        db.session.execute(db.text(
            "INSERT INTO audit.logs (id, action, module, entity_type, entity_id, ip_address, tenant_id, created_at) "
            "VALUES (:id, :action, :module, :entity_type, :entity_id, :ip, :tenant_id, NOW())"
        ), {
            "id": str(uuid.uuid4()), "action": action, "module": module,
            "entity_type": entity_type, "entity_id": entity_id,
            "ip": request.remote_addr or '', "tenant_id": tenant_id or ''
        })

    # Super Admin Portal API (no JWT for GUI portal)
    @app.route("/superadmin/api/organizations", methods=["GET"])
    def sa_list_orgs():
        try:
            result = db.session.execute(db.text(
                "SELECT id, name, code, domain, is_active, created_at, email, phone, city, state, pan, industry FROM iam.tenants WHERE is_deleted = false ORDER BY created_at DESC"
            ))
            orgs = [{"id": r[0], "name": r[1], "code": r[2], "domain": r[3], "is_active": r[4], "created_at": str(r[5]) if r[5] else None, "email": r[6], "phone": r[7], "city": r[8], "state": r[9], "pan": r[10], "industry": r[11]} for r in result]
            return {"success": True, "data": orgs}
        except Exception as err:
            db.session.rollback()
            result = db.session.execute(db.text(
                "SELECT id, name, code, domain, is_active, created_at FROM iam.tenants WHERE is_deleted = false ORDER BY created_at DESC"
            ))
            orgs = [{"id": r[0], "name": r[1], "code": r[2], "domain": r[3], "is_active": r[4], "created_at": str(r[5]) if r[5] else None, "email": "", "phone": "", "city": "", "state": "", "pan": "", "industry": ""} for r in result]
            return {"success": True, "data": orgs}

    @app.route("/superadmin/api/organizations", methods=["POST"])
    def sa_create_org():
        data = request.get_json()
        if not data.get("name") or not data.get("code"):
            return {"success": False, "message": "Name and Code are required"}, 400
        existing = db.session.execute(db.text("SELECT id FROM iam.tenants WHERE code = :code"), {"code": data["code"]}).first()
        if existing:
            return {"success": False, "message": "Organization code already exists"}, 409
        import uuid
        org_id = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO iam.tenants (id, name, code, domain, pan, gst, cin, email, phone, "
            "address_line1, address_line2, city, state, pincode, country, industry, employee_count, "
            "contact_person, contact_designation, contact_phone, contact_email, "
            "is_active, is_deleted, tenant_id, version, created_at, updated_at) "
            "VALUES (:id, :name, :code, :domain, :pan, :gst, :cin, :email, :phone, "
            ":addr1, :addr2, :city, :state, :pincode, :country, :industry, :emp_count, "
            ":cp_name, :cp_designation, :cp_phone, :cp_email, "
            "true, false, :tenant_id, 1, NOW(), NOW())"
        ), {
            "id": org_id, "name": data["name"], "code": data["code"],
            "domain": data.get("domain", ""), "pan": data.get("pan", ""),
            "gst": data.get("gst", ""), "cin": data.get("cin", ""),
            "email": data.get("email", ""), "phone": data.get("phone", ""),
            "addr1": data.get("address_line1", ""), "addr2": data.get("address_line2", ""),
            "city": data.get("city", ""), "state": data.get("state", ""),
            "pincode": data.get("pincode", ""), "country": data.get("country", "India"),
            "industry": data.get("industry", ""), "emp_count": data.get("employee_count", ""),
            "cp_name": data.get("contact_person", ""), "cp_designation": data.get("contact_designation", ""),
            "cp_phone": data.get("contact_phone", ""), "cp_email": data.get("contact_email", ""),
            "tenant_id": data["code"]
        })
        log_audit('CREATE', 'IAM', 'Organization', org_id, data['code'])
        db.session.commit()
        return {"success": True, "data": {"id": org_id, "name": data["name"], "code": data["code"], "domain": data.get("domain", ""), "is_active": True}, "message": "Organization created"}, 201

    @app.route("/superadmin/api/organizations/<org_id>/suspend", methods=["POST"])
    def sa_suspend_org(org_id):
        try:
            db.session.execute(db.text("UPDATE iam.tenants SET is_active = false WHERE id = :id OR code = :code"), {"id": org_id, "code": org_id})
            log_audit('SUSPEND', 'IAM', 'Organization', org_id, org_id)
            db.session.commit()
            return {"success": True, "message": "Organization suspended"}
        except Exception as e:
            db.session.rollback()
            return {"success": False, "message": str(e)}, 500

    @app.route("/superadmin/api/organizations/<org_id>/activate", methods=["POST"])
    def sa_activate_org(org_id):
        try:
            db.session.execute(db.text("UPDATE iam.tenants SET is_active = true WHERE id = :id OR code = :code"), {"id": org_id, "code": org_id})
            log_audit('ACTIVATE', 'IAM', 'Organization', org_id, org_id)
            db.session.commit()
            return {"success": True, "message": "Organization activated"}
        except Exception as e:
            db.session.rollback()
            return {"success": False, "message": str(e)}, 500

    @app.route("/superadmin/api/organizations/<org_id>", methods=["GET"])
    def sa_get_org(org_id):
        try:
            r = db.session.execute(db.text(
                "SELECT id, name, code, domain, is_active, email, phone, city, state, pan, gst, cin, "
                "industry, employee_count, address_line1, address_line2, pincode, country, "
                "contact_person, contact_designation, contact_phone, contact_email "
                "FROM iam.tenants WHERE id = :id OR code = :code LIMIT 1"
            ), {"id": org_id, "code": org_id}).first()
            if not r:
                return {"success": False, "message": "Not found"}, 404
            return {"success": True, "data": {
                "id": r[0], "name": r[1], "code": r[2], "domain": r[3] or "", "is_active": r[4],
                "email": r[5] or "", "phone": r[6] or "", "city": r[7] or "", "state": r[8] or "",
                "pan": r[9] or "", "gst": r[10] or "", "cin": r[11] or "", "industry": r[12] or "",
                "employee_count": r[13] or "", "address_line1": r[14] or "", "address_line2": r[15] or "",
                "pincode": r[16] or "", "country": r[17] or "India",
                "contact_person": r[18] or "", "contact_designation": r[19] or "",
                "contact_phone": r[20] or "", "contact_email": r[21] or ""
            }}
        except Exception as e:
            db.session.rollback()
            return {"success": False, "message": str(e)}, 500

    @app.route("/superadmin/api/organizations/<org_id>/update", methods=["POST", "PUT"])
    def sa_update_org(org_id):
        try:
            data = request.get_json() or {}
            # Support lookup by UUID id or by code
            row = db.session.execute(db.text(
                "SELECT id FROM iam.tenants WHERE id = :id OR code = :code LIMIT 1"
            ), {"id": org_id, "code": org_id}).first()
            if not row:
                return {"success": False, "message": "Organization not found"}, 404
            real_id = row[0]
            db.session.execute(db.text(
                "UPDATE iam.tenants SET name=:name, domain=:domain, pan=:pan, gst=:gst, cin=:cin, "
                "email=:email, phone=:phone, address_line1=:addr1, address_line2=:addr2, city=:city, "
                "state=:state, pincode=:pincode, country=:country, industry=:industry, employee_count=:emp_count, "
                "contact_person=:cp_name, contact_designation=:cp_designation, contact_phone=:cp_phone, "
                "contact_email=:cp_email, updated_at=NOW() WHERE id=:id"
            ), {
                "id": real_id, "name": data.get("name", ""),
                "domain": data.get("domain", ""), "pan": data.get("pan", ""),
                "gst": data.get("gst", ""), "cin": data.get("cin", ""),
                "email": data.get("email", ""), "phone": data.get("phone", ""),
                "addr1": data.get("address_line1", ""), "addr2": data.get("address_line2", ""),
                "city": data.get("city", ""), "state": data.get("state", ""),
                "pincode": data.get("pincode", ""), "country": data.get("country", "India"),
                "industry": data.get("industry", ""), "emp_count": data.get("employee_count", ""),
                "cp_name": data.get("contact_person", ""), "cp_designation": data.get("contact_designation", ""),
                "cp_phone": data.get("contact_phone", ""), "cp_email": data.get("contact_email", "")
            })
            log_audit('UPDATE', 'IAM', 'Organization', str(real_id), data.get('code', org_id))
            db.session.commit()
            return {"success": True, "message": "Organization updated"}
        except Exception as e:
            db.session.rollback()
            return {"success": False, "message": str(e)}, 500

    @app.route("/superadmin/api/overview", methods=["GET"])
    def sa_overview():
        total = db.session.execute(db.text("SELECT COUNT(*) FROM iam.tenants WHERE is_deleted = false")).scalar() or 0
        active = db.session.execute(db.text("SELECT COUNT(*) FROM iam.tenants WHERE is_active = true AND is_deleted = false")).scalar() or 0
        users = db.session.execute(db.text("SELECT COUNT(*) FROM iam.users WHERE is_deleted = false")).scalar() or 0
        return {"success": True, "data": {
            "total_tenants": total, "active_tenants": active,
            "total_users": users, "active_licenses": 0, "active_subscriptions": 0
        }}

    @app.route("/superadmin/api/audit-logs", methods=["GET"])
    def sa_audit_logs():
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 50, type=int)
        module = request.args.get('module', '')
        action = request.args.get('action', '')
        offset = (page - 1) * limit
        where = "WHERE 1=1"
        params = {"limit": limit, "offset": offset}
        if module:
            where += " AND l.module = :module"
            params["module"] = module
        if action:
            where += " AND l.action = :action"
            params["action"] = action
        count = db.session.execute(db.text(f"SELECT COUNT(*) FROM audit.logs l {where}"), params).scalar() or 0
        rows = db.session.execute(db.text(
            f"SELECT l.id, l.user_id, l.action, l.module, l.entity_type, l.entity_id, "
            f"l.ip_address, l.tenant_id, l.created_at "
            f"FROM audit.logs l {where} ORDER BY l.created_at DESC LIMIT :limit OFFSET :offset"
        ), params)
        logs = [{"id": r[0], "user_id": r[1], "action": r[2], "module": r[3], "entity_type": r[4], "entity_id": r[5], "ip_address": r[6], "tenant_id": r[7], "created_at": str(r[8]) if r[8] else None} for r in rows]
        return {"success": True, "data": {"items": logs, "total": count, "page": page, "limit": limit}}

    # ─── DASHBOARD API ───
    @app.route("/api/v1/dashboard", methods=["GET"])
    @jwt_required()
    def dashboard_overview():
        raw = get_jwt_identity()
        identity = _deserialize_identity(raw)

        user_id = identity.get('user_id')
        tenant_id = identity.get('tenant_id', '')
        is_super = identity.get('is_super_admin', False)
        period = request.args.get('period', 'month')  # day, week, month, year, all

        # Time filter
        time_filter = ""
        if period == 'day':
            time_filter = "AND created_at >= NOW() - INTERVAL '1 day'"
        elif period == 'week':
            time_filter = "AND created_at >= NOW() - INTERVAL '7 days'"
        elif period == 'month':
            time_filter = "AND created_at >= NOW() - INTERVAL '30 days'"
        elif period == 'year':
            time_filter = "AND created_at >= NOW() - INTERVAL '365 days'"
        # 'all' = no filter

        login_time_filter = time_filter.replace('created_at', 'login_at')

        # Recent logins for this user
        logins = db.session.execute(db.text(
            f"SELECT login_at, ip_address, user_agent, login_type FROM audit.login_history "
            f"WHERE user_id = :uid {login_time_filter} ORDER BY login_at DESC LIMIT 20"
        ), {"uid": user_id})
        login_list = [{"login_at": str(r[0]), "ip_address": r[1], "user_agent": r[2], "login_type": r[3]} for r in logins]

        # Total login count
        login_count = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM audit.login_history WHERE user_id = :uid {login_time_filter}"
        ), {"uid": user_id}).scalar() or 0

        user_email = identity.get('email', '')

        # Audit activity (work done by this user)
        if is_super:
            audit_rows = db.session.execute(db.text(
                f"SELECT action, module, entity_type, entity_id, created_at, ip_address "
                f"FROM audit.logs WHERE 1=1 {time_filter} ORDER BY created_at DESC LIMIT 30"
            ))
        else:
            audit_rows = db.session.execute(db.text(
                f"SELECT action, module, entity_type, entity_id, created_at, ip_address "
                f"FROM audit.logs WHERE (user_id = :uid OR user_email = :email) {time_filter} "
                f"ORDER BY created_at DESC LIMIT 30"
            ), {"uid": user_id, "email": user_email})

        audit_list = [{"action": r[0], "module": r[1], "entity_type": r[2], "entity_id": r[3], "created_at": str(r[4]), "ip_address": r[5]} for r in audit_rows]

        # Work summary counts
        if is_super:
            work_counts = db.session.execute(db.text(
                f"SELECT action, COUNT(*) FROM audit.logs WHERE 1=1 {time_filter} GROUP BY action"
            ))
        else:
            work_counts = db.session.execute(db.text(
                f"SELECT action, COUNT(*) FROM audit.logs WHERE (user_id = :uid OR user_email = :email) {time_filter} GROUP BY action"
            ), {"uid": user_id, "email": user_email})

        work_summary = {r[0]: r[1] for r in work_counts}

        # Module activity breakdown
        if is_super:
            module_rows = db.session.execute(db.text(
                f"SELECT module, COUNT(*) FROM audit.logs WHERE 1=1 {time_filter} GROUP BY module ORDER BY COUNT(*) DESC LIMIT 10"
            ))
        else:
            module_rows = db.session.execute(db.text(
                f"SELECT module, COUNT(*) FROM audit.logs WHERE (user_id = :uid OR user_email = :email) {time_filter} GROUP BY module ORDER BY COUNT(*) DESC LIMIT 10"
            ), {"uid": user_id, "email": user_email})

        module_activity = [{"module": r[0], "count": r[1]} for r in module_rows]

        # User info
        user_info = {}
        if is_super:
            sa = db.session.execute(db.text("SELECT name, email FROM public.super_admins WHERE id = :id"), {"id": user_id}).first()
            if sa:
                user_info = {"name": sa[0], "email": sa[1], "role": "Super Admin"}
        else:
            u = db.session.execute(db.text("SELECT first_name, last_name, email FROM iam.users WHERE id = :id"), {"id": user_id}).first()
            if u:
                user_info = {"name": f"{u[0] or ''} {u[1] or ''}".strip(), "email": u[2], "role": "Organization User"}
            t = db.session.execute(db.text("SELECT name FROM iam.tenants WHERE id = :id"), {"id": tenant_id}).first()
            if t:
                user_info["organization"] = t[0]

        return {"success": True, "data": {
            "user": user_info,
            "period": period,
            "login_count": login_count,
            "recent_logins": login_list,
            "recent_activity": audit_list,
            "work_summary": work_summary,
            "module_activity": module_activity,
            "total_actions": sum(work_summary.values()) if work_summary else 0
        }}

    @app.route("/api")
    def api_info():
        return {
            "platform": "SUPERSYSTEMS",
            "version": "1.0.0",
            "status": "running",
            "api_base": "/api/v1",
            "modules": {
                "super_admin": "/api/v1/super-admin",
                "auth": "/api/v1/auth",
                "workflow": "/api/v1/workflow",
                "audit": "/api/v1/audit",
                "notifications": "/api/v1/notifications",
                "dms": "/api/v1/dms",
                "reports": "/api/v1/reports",
                "gateway": "/api/v1/gateway",
                "ai": "/api/v1/ai",
                "master_data": "/api/v1/master-data",
                "inventory": "/api/v1/inventory",
                "procurement": "/api/v1/procurement",
                "finance": "/api/v1/finance",
                "hr": "/api/v1/hr",
                "manufacturing": "/api/v1/manufacturing",
                "quality": "/api/v1/quality",
                "warehouse": "/api/v1/warehouse",
                "maintenance": "/api/v1/maintenance",
                "projects": "/api/v1/projects",
                "logistics": "/api/v1/logistics",
                "customer_service": "/api/v1/customer-service",
                "analytics": "/api/v1/analytics",
                "treasury": "/api/v1/treasury",
                "assets": "/api/v1/assets",
                "governance": "/api/v1/governance",
                "plm": "/api/v1/plm",
                "suppliers": "/api/v1/suppliers",
                "ehs": "/api/v1/ehs",
                "part": "/api/v1/part",
                "rawmaterial": "/api/v1/rawmaterial",
            }
        }

    return app


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5010))
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=port)
