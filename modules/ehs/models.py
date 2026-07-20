from extensions import db
from shared.base_model import BaseModel


class Incident(BaseModel):
    __tablename__ = "incidents"
    number = db.Column(db.String(50), nullable=False)
    type = db.Column(db.String(50))  # safety, environmental, health
    severity = db.Column(db.String(20))
    description = db.Column(db.Text)
    location = db.Column(db.String(200))
    reported_by = db.Column(db.String(36))
    incident_date = db.Column(db.DateTime)
    root_cause = db.Column(db.Text)
    corrective_action = db.Column(db.Text)
    status = db.Column(db.String(50), default="reported")


class SafetyInspection(BaseModel):
    __tablename__ = "safety_inspections"
    number = db.Column(db.String(50), nullable=False)
    location = db.Column(db.String(200))
    inspector_id = db.Column(db.String(36))
    inspection_date = db.Column(db.Date)
    checklist = db.Column(db.JSON, default=[])
    findings = db.Column(db.JSON, default=[])
    status = db.Column(db.String(50), default="scheduled")
    overall_rating = db.Column(db.String(20))
