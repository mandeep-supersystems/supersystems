from flask import Blueprint, request
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity
)
from extensions import db
from core.super_admin.models import (
    SuperAdmin, OrganizationLicense, Subscription, SSOConfig,
    ModuleRegistry, TenantModule, CompanyModule, GlobalSetting, GlobalAuditLog, TenantMonitor
)
from core.auth.models import Tenant, User
from shared.utils.helpers import success_response, error_response, paginate
from datetime import datetime
from functools import wraps
import bcrypt

super_admin_bp = Blueprint("super_admin", __name__)


# ============================================
# SUPER ADMIN AUTH DECORATOR
# ============================================
def super_admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        identity = get_jwt_identity()
        if isinstance(identity, str):
            try:
                import json
                identity = json.loads(identity)
            except Exception:
                identity = {"user_id": identity, "is_super_admin": True}
        if not isinstance(identity, dict) or not (identity.get("is_super_admin") or identity.get("role") == "super_admin"):
            return error_response("Super Admin access required", 403)
        return fn(*args, **kwargs)
    return wrapper


def log_admin_action(admin_id, action, target_type=None, target_id=None, details=None):
    try:
        log = GlobalAuditLog(
            admin_id=str(admin_id) if admin_id else "system", action=action, target_type=target_type,
            target_id=str(target_id) if target_id else None, details=details,
            ip_address=request.remote_addr
        )
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        db.session.rollback()


# ============================================
# SUPER ADMIN AUTH (kept for backward compat, redirects to unified /api/v1/auth/login)
# ============================================
@super_admin_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    admin = SuperAdmin.query.filter(db.func.lower(SuperAdmin.email) == email, SuperAdmin.is_active == True).first()
    if not admin or not bcrypt.checkpw(data.get("password", "").encode(), admin.password_hash.encode()):
        return error_response("Invalid credentials", 401)
    admin.last_login = datetime.utcnow()
    db.session.commit()
    identity = {"user_id": admin.id, "email": admin.email, "is_super_admin": True, "role": "super_admin"}
    token = create_access_token(identity=identity)
    return success_response({"access_token": token, "user_type": "super_admin", "user": admin.to_dict()})


# ============================================
# ORGANIZATION MANAGEMENT
# ============================================
@super_admin_bp.route("/organizations", methods=["GET"])
@super_admin_required
def list_organizations():
    try:
        query = Tenant.query.filter_by(is_deleted=False)
        search = request.args.get("search")
        if search:
            query = query.filter(Tenant.name.ilike(f"%{search}%"))
        return success_response(paginate(query))
    except Exception as err:
        # Fallback SQL query for robust rendering
        try:
            rows = db.session.execute(db.text(
                "SELECT id, name, code, domain, is_active, created_at FROM iam.tenants WHERE is_deleted=false"
            )).fetchall()
            orgs = [
                {"id": str(r[0]), "name": r[1], "code": r[2], "domain": r[3], "is_active": bool(r[4]), "created_at": str(r[5])}
                for r in rows
            ]
            return success_response({"items": orgs, "total": len(orgs), "page": 1, "pages": 1})
        except Exception as err2:
            return success_response({"items": [], "total": 0, "page": 1, "pages": 1})


@super_admin_bp.route("/organizations", methods=["POST"])
@super_admin_required
def create_organization():
    data = request.get_json()
    identity = get_jwt_identity()
    tenant = Tenant(
        name=data["name"], code=data["code"], domain=data.get("domain"),
        settings=data.get("settings", {}), tenant_id=data["code"]
    )
    db.session.add(tenant)
    db.session.commit()
    log_admin_action(identity["user_id"], "create_organization", "tenant", tenant.id,
                     {"name": data["name"], "code": data["code"]})
    return success_response(tenant.to_dict(), "Organization created", 201)


@super_admin_bp.route("/organizations/<tenant_id>", methods=["PUT"])
@super_admin_required
def update_organization(tenant_id):
    data = request.get_json()
    identity = get_jwt_identity()
    tenant = Tenant.query.get_or_404(tenant_id)
    for key in ["name", "domain", "is_active", "settings"]:
        if key in data:
            setattr(tenant, key, data[key])
    db.session.commit()
    log_admin_action(identity["user_id"], "update_organization", "tenant", tenant_id, data)
    return success_response(tenant.to_dict(), "Organization updated")


@super_admin_bp.route("/organizations/<tenant_id>/suspend", methods=["POST"])
@super_admin_required
def suspend_organization(tenant_id):
    identity = get_jwt_identity()
    tenant = Tenant.query.get_or_404(tenant_id)
    tenant.is_active = False
    db.session.commit()
    log_admin_action(identity["user_id"], "suspend_organization", "tenant", tenant_id)
    return success_response(None, "Organization suspended")


# ============================================
# MODULE MANAGEMENT
# ============================================
@super_admin_bp.route("/modules", methods=["GET"])
@super_admin_required
def list_modules():
    modules = ModuleRegistry.query.all()
    return success_response([m.to_dict() for m in modules])


@super_admin_bp.route("/modules", methods=["POST"])
@super_admin_required
def register_module():
    data = request.get_json()
    identity = get_jwt_identity()
    module = ModuleRegistry(
        name=data["name"], code=data["code"], category=data.get("category"),
        description=data.get("description"), requires_license=data.get("requires_license"),
        dependencies=data.get("dependencies", [])
    )
    db.session.add(module)
    db.session.commit()
    log_admin_action(identity["user_id"], "register_module", "module", module.id,
                     {"code": data["code"]})
    return success_response(module.to_dict(), "Module registered", 201)


@super_admin_bp.route("/organizations/<tenant_id>/modules", methods=["GET"])
@super_admin_required
def list_tenant_modules(tenant_id):
    modules = TenantModule.query.filter_by(tenant_id=tenant_id).all()
    return success_response([m.to_dict() for m in modules])


@super_admin_bp.route("/organizations/<tenant_id>/modules", methods=["POST"])
@super_admin_required
def enable_module(tenant_id):
    data = request.get_json()
    identity = get_jwt_identity()
    tm = TenantModule(
        tenant_id=tenant_id, module_code=data["module_code"],
        enabled_by=identity["user_id"], config=data.get("config", {})
    )
    db.session.add(tm)
    db.session.commit()
    log_admin_action(identity["user_id"], "enable_module", "tenant_module", tm.id,
                     {"tenant_id": tenant_id, "module": data["module_code"]})
    return success_response(tm.to_dict(), "Module enabled", 201)


@super_admin_bp.route("/organizations/<tenant_id>/modules/<module_code>", methods=["DELETE"])
@super_admin_required
def disable_module(tenant_id, module_code):
    identity = get_jwt_identity()
    tm = TenantModule.query.filter_by(tenant_id=tenant_id, module_code=module_code).first_or_404()
    tm.is_enabled = False
    db.session.commit()
    log_admin_action(identity["user_id"], "disable_module", "tenant_module", tm.id,
                     {"tenant_id": tenant_id, "module": module_code})
    return success_response(None, "Module disabled")


# ============================================
# COMPANY MODULE REGISTRY (Future-Proof)
# Enable/disable modules per company. No code changes required.
# Example:
#   ABC Ltd -> ✓ Inventory, ✓ Finance, ✓ HR
#   XYZ Ltd -> ✓ Inventory, ✓ Quality
# ============================================
@super_admin_bp.route("/companies/<company_id>/modules", methods=["GET"])
@super_admin_required
def list_company_modules(company_id):
    modules = CompanyModule.query.filter_by(company_id=company_id).all()
    return success_response([m.to_dict() for m in modules])


@super_admin_bp.route("/companies/<company_id>/modules", methods=["POST"])
@super_admin_required
def enable_company_module(company_id):
    data = request.get_json()
    identity = get_jwt_identity()
    # Support bulk enable: {"modules": ["inventory", "finance", "hr"]}
    modules = data.get("modules", [data.get("module_code")])
    enabled = []
    for module_code in modules:
        existing = CompanyModule.query.filter_by(company_id=company_id, module_code=module_code).first()
        if existing:
            existing.is_enabled = True
            enabled.append(existing.to_dict())
        else:
            cm = CompanyModule(
                tenant_id=data.get("tenant_id", ""), company_id=company_id,
                module_code=module_code, enabled_by=identity["user_id"],
                config=data.get("config", {})
            )
            db.session.add(cm)
            enabled.append({"company_id": company_id, "module_code": module_code, "is_enabled": True})
    db.session.commit()
    log_admin_action(identity["user_id"], "enable_company_modules", "company_module", company_id,
                     {"company_id": company_id, "modules": modules})
    return success_response(enabled, "Modules enabled for company", 201)


@super_admin_bp.route("/companies/<company_id>/modules/<module_code>", methods=["DELETE"])
@super_admin_required
def disable_company_module(company_id, module_code):
    identity = get_jwt_identity()
    cm = CompanyModule.query.filter_by(company_id=company_id, module_code=module_code).first_or_404()
    cm.is_enabled = False
    db.session.commit()
    log_admin_action(identity["user_id"], "disable_company_module", "company_module", cm.id,
                     {"company_id": company_id, "module": module_code})
    return success_response(None, "Module disabled for company")


@super_admin_bp.route("/companies/<company_id>/modules/status", methods=["GET"])
@super_admin_required
def company_module_status(company_id):
    """Get all modules with enabled/disabled status for a company"""
    all_modules = ModuleRegistry.query.filter_by(is_available=True).all()
    company_modules = {cm.module_code: cm.is_enabled
                       for cm in CompanyModule.query.filter_by(company_id=company_id).all()}
    result = []
    for m in all_modules:
        result.append({
            "module_code": m.code,
            "module_name": m.name,
            "category": m.category,
            "is_enabled": company_modules.get(m.code, False)
        })
    return success_response(result)


# ============================================
# LICENSE MANAGEMENT
# ============================================
@super_admin_bp.route("/licenses", methods=["GET"])
@super_admin_required
def list_licenses():
    query = OrganizationLicense.query
    tenant_id = request.args.get("tenant_id")
    if tenant_id:
        query = query.filter_by(tenant_id=tenant_id)
    return success_response(paginate(query))


@super_admin_bp.route("/licenses", methods=["POST"])
@super_admin_required
def assign_license():
    data = request.get_json()
    identity = get_jwt_identity()
    license = OrganizationLicense(
        tenant_id=data["tenant_id"], license_type=data["license_type"],
        max_users=data["max_users"], modules_enabled=data.get("modules_enabled", []),
        start_date=data["start_date"], end_date=data["end_date"]
    )
    db.session.add(license)
    db.session.commit()
    log_admin_action(identity["user_id"], "assign_license", "license", license.id,
                     {"tenant_id": data["tenant_id"], "type": data["license_type"]})
    return success_response(license.to_dict(), "License assigned", 201)


@super_admin_bp.route("/licenses/<license_id>", methods=["PUT"])
@super_admin_required
def update_license(license_id):
    data = request.get_json()
    identity = get_jwt_identity()
    license = OrganizationLicense.query.get_or_404(license_id)
    for key in ["license_type", "max_users", "modules_enabled", "end_date", "is_active"]:
        if key in data:
            setattr(license, key, data[key])
    db.session.commit()
    log_admin_action(identity["user_id"], "update_license", "license", license_id, data)
    return success_response(license.to_dict(), "License updated")


# ============================================
# SUBSCRIPTION MANAGEMENT
# ============================================
@super_admin_bp.route("/subscriptions", methods=["GET"])
@super_admin_required
def list_subscriptions():
    query = Subscription.query
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    return success_response(paginate(query))


@super_admin_bp.route("/subscriptions", methods=["POST"])
@super_admin_required
def create_subscription():
    data = request.get_json()
    identity = get_jwt_identity()
    sub = Subscription(
        tenant_id=data["tenant_id"], plan=data["plan"],
        billing_cycle=data.get("billing_cycle", "monthly"),
        amount=data.get("amount"), currency=data.get("currency", "INR"),
        next_billing_date=data.get("next_billing_date"),
        auto_renew=data.get("auto_renew", True)
    )
    db.session.add(sub)
    db.session.commit()
    log_admin_action(identity["user_id"], "create_subscription", "subscription", sub.id,
                     {"tenant_id": data["tenant_id"], "plan": data["plan"]})
    return success_response(sub.to_dict(), "Subscription created", 201)


@super_admin_bp.route("/subscriptions/<sub_id>/suspend", methods=["POST"])
@super_admin_required
def suspend_subscription(sub_id):
    identity = get_jwt_identity()
    sub = Subscription.query.get_or_404(sub_id)
    sub.status = "suspended"
    db.session.commit()
    log_admin_action(identity["user_id"], "suspend_subscription", "subscription", sub_id)
    return success_response(None, "Subscription suspended")


# ============================================
# SSO MANAGEMENT
# ============================================
@super_admin_bp.route("/sso", methods=["GET"])
@super_admin_required
def list_sso():
    configs = SSOConfig.query.all()
    return success_response([c.to_dict() for c in configs])


@super_admin_bp.route("/sso", methods=["POST"])
@super_admin_required
def enable_sso():
    data = request.get_json()
    identity = get_jwt_identity()
    sso = SSOConfig(
        tenant_id=data["tenant_id"], provider=data["provider"],
        client_id=data.get("client_id"), issuer_url=data.get("issuer_url"),
        metadata_url=data.get("metadata_url"), config=data.get("config", {}),
        is_enabled=True
    )
    db.session.add(sso)
    db.session.commit()
    log_admin_action(identity["user_id"], "enable_sso", "sso", sso.id,
                     {"tenant_id": data["tenant_id"], "provider": data["provider"]})
    return success_response(sso.to_dict(), "SSO enabled", 201)


@super_admin_bp.route("/sso/<sso_id>", methods=["PUT"])
@super_admin_required
def update_sso(sso_id):
    data = request.get_json()
    identity = get_jwt_identity()
    sso = SSOConfig.query.get_or_404(sso_id)
    for key in ["provider", "client_id", "issuer_url", "metadata_url", "config", "is_enabled"]:
        if key in data:
            setattr(sso, key, data[key])
    db.session.commit()
    log_admin_action(identity["user_id"], "update_sso", "sso", sso_id, data)
    return success_response(sso.to_dict(), "SSO updated")


# ============================================
# TENANT MONITORING
# ============================================
@super_admin_bp.route("/monitoring", methods=["GET"])
@super_admin_required
def monitor_tenants():
    monitors = TenantMonitor.query.order_by(TenantMonitor.recorded_at.desc()).all()
    return success_response([m.to_dict() for m in monitors])


@super_admin_bp.route("/monitoring/<tenant_id>", methods=["GET"])
@super_admin_required
def monitor_tenant(tenant_id):
    monitor = TenantMonitor.query.filter_by(tenant_id=tenant_id).order_by(
        TenantMonitor.recorded_at.desc()).first()
    if not monitor:
        return error_response("No monitoring data", 404)
    # Get user count
    user_count = User.query.filter_by(tenant_id=tenant_id, is_deleted=False).count()
    data = monitor.to_dict()
    data["total_users"] = user_count
    return success_response(data)


@super_admin_bp.route("/monitoring/dashboard", methods=["GET"])
@super_admin_required
def monitoring_dashboard():
    total_tenants = Tenant.query.filter_by(is_deleted=False).count()
    active_tenants = Tenant.query.filter_by(is_active=True, is_deleted=False).count()
    total_users = User.query.filter_by(is_deleted=False).count()
    active_licenses = OrganizationLicense.query.filter_by(is_active=True).count()
    active_subs = Subscription.query.filter_by(status="active").count()
    return success_response({
        "total_tenants": total_tenants,
        "active_tenants": active_tenants,
        "total_users": total_users,
        "active_licenses": active_licenses,
        "active_subscriptions": active_subs,
    })


# ============================================
# GLOBAL AUDIT
# ============================================
@super_admin_bp.route("/audit", methods=["GET"])
@super_admin_required
def global_audit():
    query = GlobalAuditLog.query.order_by(GlobalAuditLog.created_at.desc())
    action = request.args.get("action")
    target_type = request.args.get("target_type")
    if action:
        query = query.filter_by(action=action)
    if target_type:
        query = query.filter_by(target_type=target_type)
    return success_response(paginate(query))


# ============================================
# GLOBAL SETTINGS
# ============================================
@super_admin_bp.route("/settings", methods=["GET"])
@super_admin_required
def list_settings():
    category = request.args.get("category")
    query = GlobalSetting.query
    if category:
        query = query.filter_by(category=category)
    settings = query.all()
    return success_response([s.to_dict() for s in settings])


@super_admin_bp.route("/settings", methods=["POST"])
@super_admin_required
def create_setting():
    data = request.get_json()
    identity = get_jwt_identity()
    setting = GlobalSetting(
        key=data["key"], value=data["value"],
        category=data.get("category"), description=data.get("description"),
        updated_by=identity["user_id"]
    )
    db.session.add(setting)
    db.session.commit()
    log_admin_action(identity["user_id"], "create_setting", "setting", setting.id,
                     {"key": data["key"]})
    return success_response(setting.to_dict(), "Setting created", 201)


@super_admin_bp.route("/settings/<setting_id>", methods=["PUT"])
@super_admin_required
def update_setting(setting_id):
    data = request.get_json()
    identity = get_jwt_identity()
    setting = GlobalSetting.query.get_or_404(setting_id)
    if not setting.is_editable:
        return error_response("Setting is not editable", 403)
    setting.value = data["value"]
    setting.updated_by = identity["user_id"]
    db.session.commit()
    log_admin_action(identity["user_id"], "update_setting", "setting", setting_id,
                     {"key": setting.key, "value": data["value"]})
    return success_response(setting.to_dict(), "Setting updated")
