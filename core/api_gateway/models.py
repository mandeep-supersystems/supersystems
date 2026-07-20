from extensions import db
from shared.base_model import BaseModel


class APIKey(BaseModel):
    __tablename__ = "api_keys"
    name = db.Column(db.String(200), nullable=False)
    key = db.Column(db.String(256), unique=True, nullable=False)
    secret_hash = db.Column(db.String(256), nullable=False)
    scopes = db.Column(db.JSON, default=[])
    rate_limit = db.Column(db.Integer, default=1000)
    is_active = db.Column(db.Boolean, default=True)
    expires_at = db.Column(db.DateTime)
    last_used = db.Column(db.DateTime)


class APILog(BaseModel):
    __tablename__ = "api_logs"
    api_key_id = db.Column(db.String(36))
    method = db.Column(db.String(10), nullable=False)
    path = db.Column(db.String(500), nullable=False)
    status_code = db.Column(db.Integer)
    response_time_ms = db.Column(db.Integer)
    ip_address = db.Column(db.String(50))
    request_body = db.Column(db.JSON)
    error_message = db.Column(db.Text)


class Webhook(BaseModel):
    __tablename__ = "webhooks"
    name = db.Column(db.String(200), nullable=False)
    url = db.Column(db.String(1000), nullable=False)
    events = db.Column(db.JSON, default=[])
    headers = db.Column(db.JSON, default={})
    secret = db.Column(db.String(256))
    is_active = db.Column(db.Boolean, default=True)
    retry_count = db.Column(db.Integer, default=3)
