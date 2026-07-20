from extensions import db
from datetime import datetime
import uuid


class BaseModel(db.Model):
    __abstract__ = True

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.String(36))
    updated_by = db.Column(db.String(36))
    is_deleted = db.Column(db.Boolean, default=False)
    deleted_at = db.Column(db.DateTime)
    deleted_by = db.Column(db.String(36))
    version = db.Column(db.Integer, default=1)
    tenant_id = db.Column(db.String(36), nullable=False, index=True)

    def soft_delete(self, user_id):
        self.is_deleted = True
        self.deleted_at = datetime.utcnow()
        self.deleted_by = user_id

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}
