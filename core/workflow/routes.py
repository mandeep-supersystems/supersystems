from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from core.workflow.models import WorkflowDefinition, WorkflowInstance, WorkflowStep, ApprovalMatrix
from shared.utils.helpers import success_response, error_response, paginate, get_identity
from datetime import datetime

workflow_bp = Blueprint("workflow", __name__)


@workflow_bp.route("/definitions", methods=["GET"])
@jwt_required()
def list_definitions():
    identity = get_identity()
    query = WorkflowDefinition.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@workflow_bp.route("/definitions", methods=["POST"])
@jwt_required()
def create_definition():
    data = request.get_json()
    identity = get_identity()
    wf = WorkflowDefinition(
        name=data["name"], code=data["code"], module=data.get("module"),
        entity_type=data.get("entity_type"), steps=data["steps"],
        sla_hours=data.get("sla_hours"), tenant_id=identity["tenant_id"]
    )
    db.session.add(wf)
    db.session.commit()
    return success_response(wf.to_dict(), "Workflow created", 201)


@workflow_bp.route("/initiate", methods=["POST"])
@jwt_required()
def initiate_workflow():
    data = request.get_json()
    identity = get_identity()
    definition = WorkflowDefinition.query.filter_by(
        code=data["workflow_code"], tenant_id=identity["tenant_id"], is_active=True
    ).first()
    if not definition:
        return error_response("Workflow definition not found", 404)

    instance = WorkflowInstance(
        definition_id=definition.id, entity_id=data["entity_id"],
        entity_type=data["entity_type"], initiated_by=identity["user_id"],
        status="in_progress", tenant_id=identity["tenant_id"], data=data.get("data", {})
    )
    db.session.add(instance)

    # Create first step
    first_step = definition.steps[0]
    step = WorkflowStep(
        instance_id=instance.id, step_number=1, name=first_step["name"],
        assignee_id=first_step.get("assignee_id"),
        assignee_type=first_step.get("assignee_type", "role"),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(step)
    db.session.commit()
    return success_response(instance.to_dict(), "Workflow initiated", 201)


@workflow_bp.route("/instances/<instance_id>/action", methods=["POST"])
@jwt_required()
def workflow_action(instance_id):
    data = request.get_json()
    identity = get_identity()
    instance = WorkflowInstance.query.get_or_404(instance_id)
    action = data.get("action")  # approve, reject, return, escalate

    # Update current step
    current_step = WorkflowStep.query.filter_by(
        instance_id=instance_id, step_number=instance.current_step
    ).first()
    current_step.status = action
    current_step.action = action
    current_step.comments = data.get("comments")
    current_step.acted_at = datetime.utcnow()

    definition = WorkflowDefinition.query.get(instance.definition_id)

    if action == "approve":
        if instance.current_step >= len(definition.steps):
            instance.status = "approved"
            instance.completed_at = datetime.utcnow()
        else:
            instance.current_step += 1
            next_def = definition.steps[instance.current_step - 1]
            next_step = WorkflowStep(
                instance_id=instance.id, step_number=instance.current_step,
                name=next_def["name"], assignee_id=next_def.get("assignee_id"),
                assignee_type=next_def.get("assignee_type"),
                tenant_id=identity["tenant_id"]
            )
            db.session.add(next_step)
    elif action == "reject":
        instance.status = "rejected"
        instance.completed_at = datetime.utcnow()

    db.session.commit()
    return success_response(instance.to_dict(), f"Workflow {action}ed")


@workflow_bp.route("/instances", methods=["GET"])
@jwt_required()
def list_instances():
    identity = get_identity()
    query = WorkflowInstance.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    return success_response(paginate(query))


@workflow_bp.route("/my-approvals", methods=["GET"])
@jwt_required()
def my_approvals():
    identity = get_identity()
    steps = WorkflowStep.query.filter_by(
        assignee_id=identity["user_id"], status="pending", is_deleted=False
    ).all()
    return success_response([s.to_dict() for s in steps])


@workflow_bp.route("/approval-matrix", methods=["POST"])
@jwt_required()
def create_approval_matrix():
    data = request.get_json()
    identity = get_identity()
    matrix = ApprovalMatrix(
        module=data["module"], entity_type=data["entity_type"],
        condition_field=data.get("condition_field"),
        condition_operator=data.get("condition_operator"),
        condition_value=data.get("condition_value"),
        approver_id=data.get("approver_id"), approver_role=data.get("approver_role"),
        level=data.get("level", 1), tenant_id=identity["tenant_id"]
    )
    db.session.add(matrix)
    db.session.commit()
    return success_response(matrix.to_dict(), "Approval matrix created", 201)
