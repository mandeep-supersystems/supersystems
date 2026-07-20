from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from modules.quality.models import QualityInspection, NonConformance
from shared.utils.helpers import success_response, paginate

quality_bp = Blueprint("quality", __name__)


@quality_bp.route("/inspections", methods=["GET"])
@jwt_required()
def list_inspections():
    identity = get_jwt_identity()
    query = QualityInspection.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@quality_bp.route("/inspections", methods=["POST"])
@jwt_required()
def create_inspection():
    data = request.get_json()
    identity = get_jwt_identity()
    insp = QualityInspection(
        number=data["number"], type=data.get("type"), material_id=data.get("material_id"),
        reference_type=data.get("reference_type"), reference_id=data.get("reference_id"),
        inspector_id=data.get("inspector_id"), inspection_date=data.get("inspection_date"),
        parameters=data.get("parameters", []), tenant_id=identity["tenant_id"]
    )
    db.session.add(insp)
    db.session.commit()
    return success_response(insp.to_dict(), "Inspection created", 201)


@quality_bp.route("/non-conformances", methods=["GET"])
@jwt_required()
def list_ncrs():
    identity = get_jwt_identity()
    query = NonConformance.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@quality_bp.route("/non-conformances", methods=["POST"])
@jwt_required()
def create_ncr():
    data = request.get_json()
    identity = get_jwt_identity()
    ncr = NonConformance(
        number=data["number"], type=data.get("type"), severity=data.get("severity"),
        description=data.get("description"), inspection_id=data.get("inspection_id"),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(ncr)
    db.session.commit()
    return success_response(ncr.to_dict(), "NCR created", 201)
