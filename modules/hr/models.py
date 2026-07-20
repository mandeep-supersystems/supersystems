from extensions import db
from shared.base_model import BaseModel


class LeaveRequest(BaseModel):
    __tablename__ = "leave_requests"
    employee_id = db.Column(db.String(36), nullable=False)
    leave_type = db.Column(db.String(50), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    days = db.Column(db.Float)
    reason = db.Column(db.Text)
    status = db.Column(db.String(50), default="pending")
    approved_by = db.Column(db.String(36))


class Attendance(BaseModel):
    __tablename__ = "attendance"
    employee_id = db.Column(db.String(36), nullable=False)
    date = db.Column(db.Date, nullable=False)
    check_in = db.Column(db.DateTime)
    check_out = db.Column(db.DateTime)
    hours_worked = db.Column(db.Float)
    status = db.Column(db.String(50), default="present")


class Payroll(BaseModel):
    __tablename__ = "payroll"
    employee_id = db.Column(db.String(36), nullable=False)
    period_month = db.Column(db.Integer, nullable=False)
    period_year = db.Column(db.Integer, nullable=False)
    basic_salary = db.Column(db.Numeric(18, 2))
    allowances = db.Column(db.Numeric(18, 2))
    deductions = db.Column(db.Numeric(18, 2))
    net_salary = db.Column(db.Numeric(18, 2))
    status = db.Column(db.String(50), default="draft")
    components = db.Column(db.JSON, default=[])


class Recruitment(BaseModel):
    __tablename__ = "recruitments"
    position = db.Column(db.String(200), nullable=False)
    department_id = db.Column(db.String(36))
    vacancies = db.Column(db.Integer, default=1)
    status = db.Column(db.String(50), default="open")
    description = db.Column(db.Text)
    requirements = db.Column(db.JSON, default=[])
    applications_count = db.Column(db.Integer, default=0)
