from extensions import db
from shared.base_model import BaseModel


class WorkflowDefinition(BaseModel):
    __tablename__ = "workflow_definitions"
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(100), nullable=False)
    module = db.Column(db.String(100))
    entity_type = db.Column(db.String(100))
    description = db.Column(db.Text)
    steps = db.Column(db.JSON, nullable=False)  # [{step, name, type, assignee, conditions}]
    is_active = db.Column(db.Boolean, default=True)
    sla_hours = db.Column(db.Integer)


class WorkflowInstance(BaseModel):
    __tablename__ = "workflow_instances"
    definition_id = db.Column(db.String(36), db.ForeignKey("workflow_definitions.id"), nullable=False)
    entity_id = db.Column(db.String(36), nullable=False)
    entity_type = db.Column(db.String(100), nullable=False)
    current_step = db.Column(db.Integer, default=1)
    status = db.Column(db.String(50), default="pending")  # pending, in_progress, approved, rejected, cancelled
    initiated_by = db.Column(db.String(36), nullable=False)
    completed_at = db.Column(db.DateTime)
    data = db.Column(db.JSON, default={})


class WorkflowStep(BaseModel):
    __tablename__ = "workflow_steps"
    instance_id = db.Column(db.String(36), db.ForeignKey("workflow_instances.id"), nullable=False)
    step_number = db.Column(db.Integer, nullable=False)
    name = db.Column(db.String(200))
    assignee_id = db.Column(db.String(36))
    assignee_type = db.Column(db.String(50))  # user, role, group
    status = db.Column(db.String(50), default="pending")
    action = db.Column(db.String(50))  # approve, reject, return, escalate
    comments = db.Column(db.Text)
    acted_at = db.Column(db.DateTime)
    due_date = db.Column(db.DateTime)


class ApprovalMatrix(BaseModel):
    __tablename__ = "approval_matrix"
    module = db.Column(db.String(100), nullable=False)
    entity_type = db.Column(db.String(100), nullable=False)
    condition_field = db.Column(db.String(100))
    condition_operator = db.Column(db.String(20))
    condition_value = db.Column(db.String(200))
    approver_id = db.Column(db.String(36))
    approver_role = db.Column(db.String(100))
    level = db.Column(db.Integer, default=1)
    is_active = db.Column(db.Boolean, default=True)
