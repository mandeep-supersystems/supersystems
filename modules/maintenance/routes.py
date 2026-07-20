from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from modules.maintenance.models import WorkOrder, MaintenanceSchedule
from shared.utils.helpers import success_response, paginate

maintenance_bp = Blueprint("maintenance", __name__)


@maintenance_bp.route("/work-orders", methods=["GET"])
@jwt_required()
def list_work_orders():
    identity = get_jwt_identity()
    query = WorkOrder.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@maintenance_bp.route("/work-orders", methods=["POST"])
@jwt_required()
def create_work_order():
    data = request.get_json()
    identity = get_jwt_identity()
    wo = WorkOrder(
        number=data["number"], asset_id=data["asset_id"], type=data.get("type"),
        priority=data.get("priority"), description=data.get("description"),
        assigned_to=data.get("assigned_to"), scheduled_date=data.get("scheduled_date"),
        estimated_hours=data.get("estimated_hours"), tenant_id=identity["tenant_id"]
    )
    db.session.add(wo)
    db.session.commit()
    return success_response(wo.to_dict(), "Work order created", 201)


@maintenance_bp.route("/schedules", methods=["GET"])
@jwt_required()
def list_schedules():
    identity = get_jwt_identity()
    query = MaintenanceSchedule.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@maintenance_bp.route("/schedules", methods=["POST"])
@jwt_required()
def create_schedule():
    data = request.get_json()
    identity = get_jwt_identity()
    schedule = MaintenanceSchedule(
        asset_id=data["asset_id"], name=data["name"], frequency=data.get("frequency"),
        next_due=data.get("next_due"), checklist=data.get("checklist", []),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(schedule)
    db.session.commit()
    return success_response(schedule.to_dict(), "Schedule created", 201)
