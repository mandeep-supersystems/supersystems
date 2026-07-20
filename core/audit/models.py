from extensions import db
from shared.base_model import BaseModel


class AuditLog(BaseModel):
    __tablename__ = "audit_logs"
    module = db.Column(db.String(100), nullable=False)
    entity_type = db.Column(db.String(100), nullable=False)
    entity_id = db.Column(db.String(36), nullable=False)
    action = db.Column(db.String(50), nullable=False)  # create, update, delete, view, export, approve
    user_id = db.Column(db.String(36), nullable=False)
    user_email = db.Column(db.String(200))
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.String(500))
    old_values = db.Column(db.JSON)
    new_values = db.Column(db.JSON)
    changes = db.Column(db.JSON)
    extra_data = db.Column(db.JSON)
