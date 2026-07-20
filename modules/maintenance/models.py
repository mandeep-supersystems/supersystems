from extensions import db
from shared.base_model import BaseModel


class WorkOrder(BaseModel):
    __tablename__ = "work_orders"
    number = db.Column(db.String(50), nullable=False)
    asset_id = db.Column(db.String(36), nullable=False)
    type = db.Column(db.String(50))  # preventive, corrective, predictive
    priority = db.Column(db.String(20))
    description = db.Column(db.Text)
    assigned_to = db.Column(db.String(36))
    scheduled_date = db.Column(db.Date)
    completed_date = db.Column(db.Date)
    status = db.Column(db.String(50), default="open")
    estimated_hours = db.Column(db.Float)
    actual_hours = db.Column(db.Float)


class MaintenanceSchedule(BaseModel):
    __tablename__ = "maintenance_schedules"
    asset_id = db.Column(db.String(36), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    frequency = db.Column(db.String(50))  # daily, weekly, monthly, quarterly
    last_performed = db.Column(db.Date)
    next_due = db.Column(db.Date)
    checklist = db.Column(db.JSON, default=[])
    is_active = db.Column(db.Boolean, default=True)
