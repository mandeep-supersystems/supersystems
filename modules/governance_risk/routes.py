from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from modules.governance_risk.models import Risk, Compliance
from shared.utils.helpers import success_response, paginate

governance_bp = Blueprint("governance", __name__)


@governance_bp.route("/risks", methods=["GET"])
@jwt_required()
def list_risks():
    identity = get_jwt_identity()
    query = Risk.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@governance_bp.route("/risks", methods=["POST"])
@jwt_required()
def create_risk():
    data = request.get_json()
    identity = get_jwt_identity()
    risk = Risk(
        name=data["name"], category=data.get("category"),
        description=data.get("description"), likelihood=data.get("likelihood"),
        impact=data.get("impact"), owner_id=data.get("owner_id"),
        mitigation=data.get("mitigation"), tenant_id=identity["tenant_id"]
    )
    if risk.likelihood and risk.impact:
        risk.risk_score = risk.likelihood * risk.impact
    db.session.add(risk)
    db.session.commit()
    return success_response(risk.to_dict(), "Risk created", 201)


@governance_bp.route("/compliance", methods=["GET"])
@jwt_required()
def list_compliance():
    identity = get_jwt_identity()
    query = Compliance.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@governance_bp.route("/compliance", methods=["POST"])
@jwt_required()
def create_compliance():
    data = request.get_json()
    identity = get_jwt_identity()
    comp = Compliance(
        name=data["name"], regulation=data.get("regulation"),
        description=data.get("description"), due_date=data.get("due_date"),
        owner_id=data.get("owner_id"), evidence=data.get("evidence", []),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(comp)
    db.session.commit()
    return success_response(comp.to_dict(), "Compliance item created", 201)
