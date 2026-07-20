from extensions import db
from shared.base_model import BaseModel


user_roles = db.Table(
    "user_roles",
    db.Column("user_id", db.String(36), db.ForeignKey("iam.users.id")),
    db.Column("role_id", db.String(36), db.ForeignKey("iam.roles.id")),
    schema="iam"
)

role_permissions = db.Table(
    "role_permissions",
    db.Column("role_id", db.String(36), db.ForeignKey("iam.roles.id")),
    db.Column("permission_id", db.String(36), db.ForeignKey("iam.permissions.id")),
    schema="iam"
)


class Tenant(BaseModel):
    __tablename__ = "tenants"
    __table_args__ = {"schema": "iam"}
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(50), unique=True, nullable=False)
    domain = db.Column(db.String(200))
    is_active = db.Column(db.Boolean, default=True)


class User(BaseModel):
    __tablename__ = "users"
    __table_args__ = {"schema": "iam"}
    email = db.Column(db.String(200), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    first_name = db.Column(db.String(100))
    last_name = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    is_active = db.Column(db.Boolean, default=True)
    is_locked = db.Column(db.Boolean, default=False)
    last_login = db.Column(db.DateTime)
    failed_attempts = db.Column(db.Integer, default=0)
    roles = db.relationship("Role", secondary=user_roles, backref="users")
    attributes = db.Column(db.JSON, default={})

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns
                if c.name != "password_hash"}


class Role(BaseModel):
    __tablename__ = "roles"
    __table_args__ = {"schema": "iam"}
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text)
    is_system = db.Column(db.Boolean, default=False)
    permissions = db.relationship("Permission", secondary=role_permissions, backref="roles")


class Permission(BaseModel):
    __tablename__ = "permissions"
    __table_args__ = {"schema": "iam"}
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(100), unique=True, nullable=False)
    module = db.Column(db.String(50))
    action = db.Column(db.String(50))
    resource = db.Column(db.String(100))


class Policy(BaseModel):
    __tablename__ = "policies"
    __table_args__ = {"schema": "iam"}
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    effect = db.Column(db.String(10), default="allow")
    conditions = db.Column(db.JSON, nullable=False)
    resource = db.Column(db.String(200))
    action = db.Column(db.String(50))
    priority = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)


class Session(BaseModel):
    __tablename__ = "sessions"
    __table_args__ = {"schema": "iam"}
    user_id = db.Column(db.String(36), db.ForeignKey("iam.users.id"), nullable=False)
    token = db.Column(db.String(500), nullable=False)
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.String(500))
    expires_at = db.Column(db.DateTime, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
