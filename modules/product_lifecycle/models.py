from extensions import db
from shared.base_model import BaseModel


class ProductDesign(BaseModel):
    __tablename__ = "product_designs"
    product_id = db.Column(db.String(36), nullable=False)
    version = db.Column(db.String(20), nullable=False)
    stage = db.Column(db.String(50), default="concept")  # concept, design, prototype, production
    specifications = db.Column(db.JSON, default={})
    designer_id = db.Column(db.String(36))
    status = db.Column(db.String(50), default="draft")
    release_date = db.Column(db.Date)


class ChangeRequest(BaseModel):
    __tablename__ = "change_requests"
    number = db.Column(db.String(50), nullable=False)
    product_id = db.Column(db.String(36))
    type = db.Column(db.String(50))  # engineering, manufacturing, design
    description = db.Column(db.Text)
    reason = db.Column(db.Text)
    impact = db.Column(db.Text)
    priority = db.Column(db.String(20))
    status = db.Column(db.String(50), default="submitted")
    requested_by = db.Column(db.String(36))
