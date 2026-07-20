from extensions import db
from shared.base_model import BaseModel


class KPI(BaseModel):
    __tablename__ = "kpis"
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(100), nullable=False)
    module = db.Column(db.String(100))
    formula = db.Column(db.Text)
    target_value = db.Column(db.Float)
    current_value = db.Column(db.Float)
    unit = db.Column(db.String(50))
    frequency = db.Column(db.String(50))
    is_active = db.Column(db.Boolean, default=True)


class AnalyticsQuery(BaseModel):
    __tablename__ = "analytics_queries"
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    query_text = db.Column(db.Text, nullable=False)
    parameters = db.Column(db.JSON, default=[])
    visualization = db.Column(db.String(50))
    module = db.Column(db.String(100))
    is_public = db.Column(db.Boolean, default=False)
