from extensions import db
from shared.base_model import BaseModel


class ReportDefinition(BaseModel):
    __tablename__ = "report_definitions"
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(100), nullable=False)
    module = db.Column(db.String(100))
    description = db.Column(db.Text)
    query_template = db.Column(db.Text)
    parameters = db.Column(db.JSON, default=[])
    columns = db.Column(db.JSON, default=[])
    filters = db.Column(db.JSON, default=[])
    chart_type = db.Column(db.String(50))
    is_active = db.Column(db.Boolean, default=True)
    category = db.Column(db.String(100))


class ReportSchedule(BaseModel):
    __tablename__ = "report_schedules"
    report_id = db.Column(db.String(36), db.ForeignKey("report_definitions.id"), nullable=False)
    cron_expression = db.Column(db.String(100), nullable=False)
    recipients = db.Column(db.JSON, default=[])
    format = db.Column(db.String(20), default="pdf")
    is_active = db.Column(db.Boolean, default=True)
    last_run = db.Column(db.DateTime)


class Dashboard(BaseModel):
    __tablename__ = "dashboards"
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(100))
    module = db.Column(db.String(100))
    layout = db.Column(db.JSON, default=[])
    widgets = db.Column(db.JSON, default=[])
    is_default = db.Column(db.Boolean, default=False)
    role_access = db.Column(db.JSON, default=[])
