from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from modules.product_lifecycle.models import ProductDesign, ChangeRequest
from shared.utils.helpers import success_response, paginate

plm_bp = Blueprint("plm", __name__)


@plm_bp.route("/designs", methods=["GET"])
@jwt_required()
def list_designs():
    identity = get_jwt_identity()
    query = ProductDesign.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@plm_bp.route("/designs", methods=["POST"])
@jwt_required()
def create_design():
    data = request.get_json()
    identity = get_jwt_identity()
    design = ProductDesign(
        product_id=data["product_id"], version=data["version"],
        stage=data.get("stage", "concept"), specifications=data.get("specifications", {}),
        designer_id=data.get("designer_id"), tenant_id=identity["tenant_id"]
    )
    db.session.add(design)
    db.session.commit()
    return success_response(design.to_dict(), "Design created", 201)


@plm_bp.route("/change-requests", methods=["GET"])
@jwt_required()
def list_change_requests():
    identity = get_jwt_identity()
    query = ChangeRequest.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@plm_bp.route("/change-requests", methods=["POST"])
@jwt_required()
def create_change_request():
    data = request.get_json()
    identity = get_jwt_identity()
    cr = ChangeRequest(
        number=data["number"], product_id=data.get("product_id"),
        type=data.get("type"), description=data.get("description"),
        reason=data.get("reason"), impact=data.get("impact"),
        priority=data.get("priority"), requested_by=identity["user_id"],
        tenant_id=identity["tenant_id"]
    )
    db.session.add(cr)
    db.session.commit()
    return success_response(cr.to_dict(), "Change request created", 201)
