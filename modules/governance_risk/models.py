from extensions import db
from shared.base_model import BaseModel


class Risk(BaseModel):
    __tablename__ = "risks"
    name = db.Column(db.String(300), nullable=False)
    category = db.Column(db.String(100))
    description = db.Column(db.Text)
    likelihood = db.Column(db.Integer)  # 1-5
    impact = db.Column(db.Integer)  # 1-5
    risk_score = db.Column(db.Integer)
    owner_id = db.Column(db.String(36))
    mitigation = db.Column(db.Text)
    status = db.Column(db.String(50), default="identified")


class Compliance(BaseModel):
    __tablename__ = "compliance_items"
    name = db.Column(db.String(300), nullable=False)
    regulation = db.Column(db.String(200))
    description = db.Column(db.Text)
    due_date = db.Column(db.Date)
    owner_id = db.Column(db.String(36))
    status = db.Column(db.String(50), default="pending")
    evidence = db.Column(db.JSON, default=[])
