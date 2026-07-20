from extensions import db
from shared.base_model import BaseModel


class ProjectTask(BaseModel):
    __tablename__ = "project_tasks"
    project_id = db.Column(db.String(36), nullable=False)
    name = db.Column(db.String(300), nullable=False)
    description = db.Column(db.Text)
    assignee_id = db.Column(db.String(36))
    parent_task_id = db.Column(db.String(36))
    start_date = db.Column(db.Date)
    due_date = db.Column(db.Date)
    priority = db.Column(db.String(20))
    status = db.Column(db.String(50), default="todo")
    progress = db.Column(db.Integer, default=0)
    estimated_hours = db.Column(db.Float)
    actual_hours = db.Column(db.Float)


class TimeEntry(BaseModel):
    __tablename__ = "time_entries"
    project_id = db.Column(db.String(36), nullable=False)
    task_id = db.Column(db.String(36))
    employee_id = db.Column(db.String(36), nullable=False)
    date = db.Column(db.Date, nullable=False)
    hours = db.Column(db.Float, nullable=False)
    description = db.Column(db.Text)
    billable = db.Column(db.Boolean, default=True)


class Milestone(BaseModel):
    __tablename__ = "milestones"
    project_id = db.Column(db.String(36), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    due_date = db.Column(db.Date)
    status = db.Column(db.String(50), default="pending")
    deliverables = db.Column(db.JSON, default=[])
