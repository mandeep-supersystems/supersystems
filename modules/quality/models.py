from extensions import db
from shared.base_model import BaseModel


class QualityInspection(BaseModel):
    __tablename__ = "quality_inspections"
    number = db.Column(db.String(50), nullable=False)
    type = db.Column(db.String(50))  # incoming, in_process, final
    material_id = db.Column(db.String(36))
    reference_type = db.Column(db.String(50))
    reference_id = db.Column(db.String(36))
    inspector_id = db.Column(db.String(36))
    inspection_date = db.Column(db.Date)
    status = db.Column(db.String(50), default="pending")
    result = db.Column(db.String(50))  # pass, fail, conditional
    parameters = db.Column(db.JSON, default=[])


class NonConformance(BaseModel):
    __tablename__ = "non_conformances"
    number = db.Column(db.String(50), nullable=False)
    type = db.Column(db.String(50))
    severity = db.Column(db.String(20))
    description = db.Column(db.Text)
    root_cause = db.Column(db.Text)
    corrective_action = db.Column(db.Text)
    status = db.Column(db.String(50), default="open")
    inspection_id = db.Column(db.String(36))
