from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from modules.analytics.models import KPI, AnalyticsQuery
from shared.utils.helpers import success_response, paginate

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/kpis", methods=["GET"])
@jwt_required()
def list_kpis():
    identity = get_jwt_identity()
    query = KPI.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@analytics_bp.route("/kpis", methods=["POST"])
@jwt_required()
def create_kpi():
    data = request.get_json()
    identity = get_jwt_identity()
    kpi = KPI(
        name=data["name"], code=data["code"], module=data.get("module"),
        formula=data.get("formula"), target_value=data.get("target_value"),
        unit=data.get("unit"), frequency=data.get("frequency"),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(kpi)
    db.session.commit()
    return success_response(kpi.to_dict(), "KPI created", 201)


@analytics_bp.route("/queries", methods=["GET"])
@jwt_required()
def list_queries():
    identity = get_jwt_identity()
    query = AnalyticsQuery.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@analytics_bp.route("/queries", methods=["POST"])
@jwt_required()
def create_query():
    data = request.get_json()
    identity = get_jwt_identity()
    aq = AnalyticsQuery(
        name=data["name"], description=data.get("description"),
        query_text=data["query_text"], parameters=data.get("parameters", []),
        visualization=data.get("visualization"), module=data.get("module"),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(aq)
    db.session.commit()
    return success_response(aq.to_dict(), "Query created", 201)
