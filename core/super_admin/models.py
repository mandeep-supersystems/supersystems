from extensions import db
from datetime import datetime
import uuid


class SuperAdmin(db.Model):
    """Platform Super Admin - ERP Owner level access"""
    __tablename__ = "super_admins"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(200), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    phone = db.Column(db.String(20))
    is_active = db.Column(db.Boolean, default=True)
    last_login = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns
                if c.name != "password_hash"}


class OrganizationLicense(db.Model):
    """License management per organization"""
    __tablename__ = "organization_licenses"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = db.Column(db.String(36), nullable=False)
    license_type = db.Column(db.String(50), nullable=False)  # starter, professional, enterprise
    max_users = db.Column(db.Integer, nullable=False)
    current_users = db.Column(db.Integer, default=0)
    modules_enabled = db.Column(db.JSON, default=[])
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class Subscription(db.Model):
    """Subscription management"""
    __tablename__ = "subscriptions"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = db.Column(db.String(36), nullable=False)
    plan = db.Column(db.String(50), nullable=False)  # free, starter, pro, enterprise
    billing_cycle = db.Column(db.String(20), default="monthly")  # monthly, yearly
    amount = db.Column(db.Numeric(18, 2))
    currency = db.Column(db.String(10), default="INR")
    status = db.Column(db.String(50), default="active")  # active, suspended, cancelled, expired
    next_billing_date = db.Column(db.Date)
    auto_renew = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class SSOConfig(db.Model):
    """SSO configuration per tenant"""
    __tablename__ = "sso_configs"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = db.Column(db.String(36), nullable=False, unique=True)
    provider = db.Column(db.String(50), nullable=False)  # saml, oidc, azure_ad, google
    client_id = db.Column(db.String(500))
    issuer_url = db.Column(db.String(500))
    metadata_url = db.Column(db.String(500))
    certificate = db.Column(db.Text)
    config = db.Column(db.JSON, default={})
    is_enabled = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns
                if c.name != "certificate"}


class ModuleRegistry(db.Model):
    """All available modules in the platform"""
    __tablename__ = "module_registry"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(50), unique=True, nullable=False)
    category = db.Column(db.String(50))  # core, business, integration, ai
    description = db.Column(db.Text)
    is_available = db.Column(db.Boolean, default=True)
    requires_license = db.Column(db.String(50))  # starter, pro, enterprise
    dependencies = db.Column(db.JSON, default=[])

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class TenantModule(db.Model):
    """Modules enabled per tenant"""
    __tablename__ = "tenant_modules"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = db.Column(db.String(36), nullable=False)
    module_code = db.Column(db.String(50), nullable=False)
    is_enabled = db.Column(db.Boolean, default=True)
    enabled_at = db.Column(db.DateTime, default=datetime.utcnow)
    enabled_by = db.Column(db.String(36))
    config = db.Column(db.JSON, default={})

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class CompanyModule(db.Model):
    """Modules enabled per company (within a tenant). No code changes needed to enable/disable."""
    __tablename__ = "company_modules"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = db.Column(db.String(36), nullable=False)
    company_id = db.Column(db.String(36), nullable=False)
    module_code = db.Column(db.String(50), nullable=False)
    is_enabled = db.Column(db.Boolean, default=True)
    enabled_at = db.Column(db.DateTime, default=datetime.utcnow)
    enabled_by = db.Column(db.String(36))
    config = db.Column(db.JSON, default={})

    __table_args__ = (
        db.UniqueConstraint('company_id', 'module_code', name='uq_company_module'),
    )

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class GlobalSetting(db.Model):
    """Platform-wide global settings"""
    __tablename__ = "global_settings"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    key = db.Column(db.String(200), unique=True, nullable=False)
    value = db.Column(db.Text)
    category = db.Column(db.String(100))
    description = db.Column(db.Text)
    is_editable = db.Column(db.Boolean, default=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = db.Column(db.String(36))

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class GlobalAuditLog(db.Model):
    """Global audit log for super admin actions"""
    __tablename__ = "global_audit_logs"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    admin_id = db.Column(db.String(36), nullable=False)
    action = db.Column(db.String(100), nullable=False)
    target_type = db.Column(db.String(100))  # tenant, license, module, subscription, sso
    target_id = db.Column(db.String(36))
    details = db.Column(db.JSON)
    ip_address = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class TenantMonitor(db.Model):
    """Tenant health and usage monitoring"""
    __tablename__ = "tenant_monitors"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = db.Column(db.String(36), nullable=False)
    active_users = db.Column(db.Integer, default=0)
    storage_used_mb = db.Column(db.Float, default=0)
    api_calls_today = db.Column(db.Integer, default=0)
    last_activity = db.Column(db.DateTime)
    health_status = db.Column(db.String(20), default="healthy")  # healthy, warning, critical
    alerts = db.Column(db.JSON, default=[])
    recorded_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}
