from extensions import db
from shared.base_model import BaseModel


class SupplierEvaluation(BaseModel):
    __tablename__ = "supplier_evaluations"
    supplier_id = db.Column(db.String(36), nullable=False)
    evaluation_date = db.Column(db.Date)
    quality_score = db.Column(db.Float)
    delivery_score = db.Column(db.Float)
    price_score = db.Column(db.Float)
    service_score = db.Column(db.Float)
    overall_score = db.Column(db.Float)
    evaluator_id = db.Column(db.String(36))
    comments = db.Column(db.Text)
    period = db.Column(db.String(50))


class SupplierContract(BaseModel):
    __tablename__ = "supplier_contracts"
    supplier_id = db.Column(db.String(36), nullable=False)
    number = db.Column(db.String(50), nullable=False)
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    value = db.Column(db.Numeric(18, 2))
    terms = db.Column(db.JSON, default={})
    status = db.Column(db.String(50), default="draft")
    auto_renew = db.Column(db.Boolean, default=False)
