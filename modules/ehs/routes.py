from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from modules.ehs.models import Incident, SafetyInspection
from shared.utils.helpers import success_response, paginate

ehs_bp = Blueprint("ehs", __name__)


@ehs_bp.route("/incidents", methods=["GET"])
@jwt_required()
def list_incidents():
    identity = get_jwt_identity()
    query = Incident.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@ehs_bp.route("/incidents", methods=["POST"])
@jwt_required()
def create_incident():
    data = request.get_json()
    identity = get_jwt_identity()
    incident = Incident(
        number=data["number"], type=data.get("type"), severity=data.get("severity"),
        description=data.get("description"), location=data.get("location"),
        reported_by=identity["user_id"], incident_date=data.get("incident_date"),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(incident)
    db.session.commit()
    return success_response(incident.to_dict(), "Incident reported", 201)


@ehs_bp.route("/inspections", methods=["GET"])
@jwt_required()
def list_inspections():
    identity = get_jwt_identity()
    query = SafetyInspection.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@ehs_bp.route("/inspections", methods=["POST"])
@jwt_required()
def create_inspection():
    data = request.get_json()
    identity = get_jwt_identity()
    inspection = SafetyInspection(
        number=data["number"], location=data.get("location"),
        inspector_id=data.get("inspector_id"), inspection_date=data.get("inspection_date"),
        checklist=data.get("checklist", []), tenant_id=identity["tenant_id"]
    )
    db.session.add(inspection)
    db.session.commit()
    return success_response(inspection.to_dict(), "Inspection created", 201)
