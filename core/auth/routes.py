from flask import Blueprint, request
from flask_jwt_extended import (
    create_access_token, create_refresh_token, jwt_required, get_jwt_identity
)
from extensions import db
from core.auth.models import User, Role, Permission, Tenant, Policy
from shared.utils.helpers import success_response, error_response, paginate, get_identity
import bcrypt
import uuid
import json
from datetime import datetime

auth_bp = Blueprint("auth", __name__)


# ─── SUPER ADMIN LOGIN ───
@auth_bp.route("/super-admin/login", methods=["POST"])
def super_admin_login():
    """Login for platform super admin with org user fallback."""
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return error_response("Email and password required", 400)

    from core.super_admin.models import SuperAdmin
    admin = SuperAdmin.query.filter(db.func.lower(SuperAdmin.email) == email, SuperAdmin.is_active == True).first()
    if admin and bcrypt.checkpw(password.encode(), admin.password_hash.encode()):
        admin.last_login = datetime.utcnow()
        db.session.execute(db.text(
            "INSERT INTO audit.login_history (user_id, email, tenant_id, ip_address, user_agent, login_type, login_at) "
            "VALUES (:uid, :email, 'platform', :ip, :ua, 'super_admin', NOW())"
        ), {"uid": admin.id, "email": admin.email, "ip": request.remote_addr, "ua": request.headers.get('User-Agent', '')[:500]})
        db.session.commit()
        identity = {"user_id": admin.id, "email": admin.email, "is_super_admin": True, "role": "super_admin"}
        access_token = create_access_token(identity=identity)
        refresh_token = create_refresh_token(identity=identity)
        return success_response({
            "access_token": access_token, "refresh_token": refresh_token,
            "user_type": "super_admin", "user": admin.to_dict()
        })

    # Fallback to org user login if not found in super_admin
    return org_login()


# ─── ORGANIZATION USER LOGIN ───
@auth_bp.route("/login", methods=["POST"])
def org_login():
    """Login for organization users (iam.users) with fallback to super admin."""
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return error_response("Email and password required", 400)

    user = User.query.filter(db.func.lower(User.email) == email, User.is_deleted == False).first()
    
    # If not found in org users, try super admin
    if not user:
        from core.super_admin.models import SuperAdmin
        admin = SuperAdmin.query.filter(db.func.lower(SuperAdmin.email) == email, SuperAdmin.is_active == True).first()
        if admin and bcrypt.checkpw(password.encode(), admin.password_hash.encode()):
            admin.last_login = datetime.utcnow()
            db.session.execute(db.text(
                "INSERT INTO audit.login_history (user_id, email, tenant_id, ip_address, user_agent, login_type, login_at) "
                "VALUES (:uid, :email, 'platform', :ip, :ua, 'super_admin', NOW())"
            ), {"uid": admin.id, "email": admin.email, "ip": request.remote_addr, "ua": request.headers.get('User-Agent', '')[:500]})
            db.session.commit()
            identity = {"user_id": admin.id, "email": admin.email, "is_super_admin": True, "role": "super_admin"}
            access_token = create_access_token(identity=identity)
            refresh_token = create_refresh_token(identity=identity)
            return success_response({
                "access_token": access_token, "refresh_token": refresh_token,
                "user_type": "super_admin", "user": admin.to_dict()
            })
        return error_response("Invalid credentials", 401)

    if not bcrypt.checkpw(password.encode(), user.password_hash.encode()):
        return error_response("Invalid credentials", 401)
    if not user.is_active:
        return error_response("Account disabled", 403)
    if user.is_locked:
        return error_response("Account locked", 403)

    # Check if tenant/org is active
    tenant = Tenant.query.filter_by(id=user.tenant_id, is_active=True).first()
    if not tenant:
        # Fallback to test tenant if missing
        tenant = Tenant.query.filter_by(code="TEST").first()

    identity = {"user_id": user.id, "tenant_id": user.tenant_id or (tenant.id if tenant else ''), "email": user.email, "role": "org_user"}
    access_token = create_access_token(identity=identity)
    refresh_token = create_refresh_token(identity=identity)
    user.last_login = datetime.utcnow()
    
    # 1. Record login history
    db.session.execute(db.text(
        "INSERT INTO audit.login_history (user_id, email, tenant_id, ip_address, user_agent, login_type, login_at) "
        "VALUES (:uid, :email, :tid, :ip, :ua, 'organization', NOW())"
    ), {"uid": user.id, "email": user.email, "tid": user.tenant_id or '', "ip": request.remote_addr, "ua": request.headers.get('User-Agent', '')[:500]})
    
    # 2. Record LOGIN event in audit logs
    db.session.execute(db.text(
        "INSERT INTO audit.logs (id, action, module, entity_type, entity_id, ip_address, user_agent, tenant_id, user_email, user_name, created_at, extra_data) "
        "VALUES (:id, 'LOGIN', 'Auth & Security', 'User Session', :uid, :ip, :ua, :tid, :email, :name, NOW(), :extra)"
    ), {
        "id": str(uuid.uuid4()),
        "uid": str(user.id),
        "ip": request.remote_addr or '',
        "ua": request.headers.get('User-Agent', '')[:500],
        "tid": user.tenant_id or '',
        "email": user.email,
        "name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
        "extra": json.dumps({"login_type": "organization", "status": "SUCCESS"})
    })
    
    db.session.commit()
    return success_response({
        "access_token": access_token, "refresh_token": refresh_token,
        "user_type": "organization",
        "user": user.to_dict(),
        "tenant": {"id": tenant.id, "name": tenant.name, "code": tenant.code} if tenant else {"id": user.tenant_id, "name": "SUPERSYSTEMS", "code": "MAIN"}
    })


@auth_bp.route("/logout", methods=["POST"])
@jwt_required(optional=True)
def logout_endpoint():
    user_email = request.headers.get("X-User-Email", "").strip()
    user_id = request.headers.get("X-User-ID", "").strip()
    tenant_id = request.headers.get("X-Tenant-ID", "").strip()

    try:
        raw = get_jwt_identity()
        if raw:
            identity = _deserialize_identity(raw) if isinstance(raw, str) else raw
            user_id = identity.get("user_id", user_id)
            user_email = identity.get("email", user_email)
            tenant_id = identity.get("tenant_id", tenant_id)
    except Exception:
        pass

    if user_email or user_id:
        try:
            # Update logout_at in login_history for active session
            db.session.execute(db.text(
                "UPDATE audit.login_history SET logout_at = NOW() "
                "WHERE (email = :email OR user_id = :uid) AND logout_at IS NULL"
            ), {"email": user_email, "uid": user_id})

            # Record LOGOUT event in audit logs
            db.session.execute(db.text(
                "INSERT INTO audit.logs (id, action, module, entity_type, entity_id, ip_address, user_agent, tenant_id, user_email, created_at, extra_data) "
                "VALUES (:id, 'LOGOUT', 'Auth & Security', 'User Session', :uid, :ip, :ua, :tid, :email, NOW(), :extra)"
            ), {
                "id": str(uuid.uuid4()),
                "uid": str(user_id or ''),
                "ip": request.remote_addr or '',
                "ua": request.headers.get('User-Agent', '')[:500],
                "tid": tenant_id or '',
                "email": user_email,
                "extra": json.dumps({"status": "SUCCESS"})
            })
            db.session.commit()
        except Exception as e:
            db.session.rollback()

    return success_response({}, "Logged out successfully")


@auth_bp.route("/register", methods=["POST"])
@jwt_required()
def register():
    """Organization admin creates users under their tenant (iam.users)."""
    identity = get_identity()
    data = request.get_json()

    if not data.get("email") or not data.get("password"):
        return error_response("Email and password required", 400)

    if User.query.filter_by(email=data["email"]).first():
        return error_response("Email already exists", 409)

    password_hash = bcrypt.hashpw(data["password"].encode(), bcrypt.gensalt()).decode()
    user = User(
        email=data["email"], password_hash=password_hash,
        first_name=data.get("first_name"), last_name=data.get("last_name"),
        phone=data.get("phone"),
        tenant_id=identity["tenant_id"]  # user belongs to the org of whoever created them
    )
    db.session.add(user)
    db.session.commit()
    return success_response(user.to_dict(), "User created", 201)


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    access_token = create_access_token(identity=identity)  # already a string
    return success_response({"access_token": access_token})


@auth_bp.route("/users", methods=["GET"])
@jwt_required()
def list_users():
    identity = get_identity()
    query = User.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@auth_bp.route("/users/<user_id>", methods=["GET"])
@jwt_required()
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return success_response(user.to_dict())


@auth_bp.route("/users/<user_id>/roles", methods=["PUT"])
@jwt_required()
def assign_roles(user_id):
    data = request.get_json()
    user = User.query.get_or_404(user_id)
    roles = Role.query.filter(Role.id.in_(data.get("role_ids", []))).all()
    user.roles = roles
    db.session.commit()
    return success_response(user.to_dict(), "Roles assigned")


# Roles CRUD
@auth_bp.route("/roles", methods=["GET"])
@jwt_required()
def list_roles():
    identity = get_identity()
    query = Role.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@auth_bp.route("/roles", methods=["POST"])
@jwt_required()
def create_role():
    data = request.get_json()
    identity = get_identity()
    role = Role(name=data["name"], code=data["code"], description=data.get("description"),
                tenant_id=identity["tenant_id"])
    db.session.add(role)
    db.session.commit()
    return success_response(role.to_dict(), "Role created", 201)


# Permissions CRUD
@auth_bp.route("/permissions", methods=["GET"])
@jwt_required()
def list_permissions():
    query = Permission.query.filter_by(is_deleted=False)
    return success_response(paginate(query))


@auth_bp.route("/permissions", methods=["POST"])
@jwt_required()
def create_permission():
    data = request.get_json()
    identity = get_identity()
    perm = Permission(name=data["name"], code=data["code"], module=data.get("module"),
                      action=data.get("action"), resource=data.get("resource"),
                      tenant_id=identity["tenant_id"])
    db.session.add(perm)
    db.session.commit()
    return success_response(perm.to_dict(), "Permission created", 201)


@auth_bp.route("/account", methods=["GET"])
@jwt_required()
def get_account():
    identity = get_identity()
    if identity.get("is_super_admin"):
        from core.super_admin.models import SuperAdmin
        admin = SuperAdmin.query.get(identity["user_id"])
        return success_response(admin.to_dict()) if admin else error_response("Not found", 404)
    user = User.query.get(identity["user_id"])
    return success_response(user.to_dict()) if user else error_response("Not found", 404)


@auth_bp.route("/account", methods=["PUT"])
@jwt_required()
def update_account():
    identity = get_identity()
    data = request.get_json()

    if identity.get("is_super_admin"):
        from core.super_admin.models import SuperAdmin
        admin = SuperAdmin.query.get(identity["user_id"])
        if not admin:
            return error_response("Not found", 404)
        if data.get("name"):
            admin.name = data["name"]
        if data.get("phone"):
            admin.phone = data["phone"]
        if data.get("current_password") and data.get("new_password"):
            if not bcrypt.checkpw(data["current_password"].encode(), admin.password_hash.encode()):
                return error_response("Current password is incorrect", 400)
            admin.password_hash = bcrypt.hashpw(data["new_password"].encode(), bcrypt.gensalt()).decode()
        db.session.commit()
        return success_response(admin.to_dict(), "Account updated")

    user = User.query.get(identity["user_id"])
    if not user:
        return error_response("Not found", 404)
    if data.get("first_name"):
        user.first_name = data["first_name"]
    if data.get("last_name"):
        user.last_name = data["last_name"]
    if data.get("phone"):
        user.phone = data["phone"]
    if data.get("current_password") and data.get("new_password"):
        if not bcrypt.checkpw(data["current_password"].encode(), user.password_hash.encode()):
            return error_response("Current password is incorrect", 400)
        user.password_hash = bcrypt.hashpw(data["new_password"].encode(), bcrypt.gensalt()).decode()
    db.session.commit()
    return success_response(user.to_dict(), "Account updated")


# Tenants
@auth_bp.route("/verify-password", methods=["POST"])
@jwt_required()
def verify_password():
    """Verify user's password for sensitive actions like delete."""
    identity = get_identity()
    data = request.get_json()
    password = data.get("password", "")
    if not password:
        return error_response("Password required", 400)

    if identity.get("is_super_admin"):
        from core.super_admin.models import SuperAdmin
        admin = SuperAdmin.query.get(identity["user_id"])
        if not admin or not bcrypt.checkpw(password.encode(), admin.password_hash.encode()):
            return error_response("Incorrect password", 401)
    else:
        user = User.query.get(identity["user_id"])
        if not user or not bcrypt.checkpw(password.encode(), user.password_hash.encode()):
            return error_response("Incorrect password", 401)

    return success_response({"verified": True})


@auth_bp.route("/tenants", methods=["POST"])
def create_tenant():
    data = request.get_json()
    tenant = Tenant(name=data["name"], code=data["code"], domain=data.get("domain"),
                    tenant_id=data["code"])
    db.session.add(tenant)
    db.session.commit()
    return success_response(tenant.to_dict(), "Tenant created", 201)


# Policies (ABAC)
@auth_bp.route("/policies", methods=["GET"])
@jwt_required()
def list_policies():
    identity = get_identity()
    query = Policy.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@auth_bp.route("/policies", methods=["POST"])
@jwt_required()
def create_policy():
    data = request.get_json()
    identity = get_identity()
    policy = Policy(name=data["name"], description=data.get("description"),
                    effect=data.get("effect", "allow"), conditions=data["conditions"],
                    resource=data.get("resource"), action=data.get("action"),
                    tenant_id=identity["tenant_id"])
    db.session.add(policy)
    db.session.commit()
    return success_response(policy.to_dict(), "Policy created", 201)
