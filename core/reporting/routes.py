from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from core.reporting.models import ReportDefinition, ReportSchedule, Dashboard
from shared.utils.helpers import success_response, error_response, paginate, get_identity

reporting_bp = Blueprint("reporting", __name__)


@reporting_bp.route("/reports", methods=["GET"])
@jwt_required()
def list_reports():
    identity = get_identity()
    query = ReportDefinition.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    module = request.args.get("module")
    if module:
        query = query.filter_by(module=module)
    return success_response(paginate(query))


@reporting_bp.route("/reports", methods=["POST"])
@jwt_required()
def create_report():
    data = request.get_json()
    identity = get_identity()
    report = ReportDefinition(
        name=data["name"], code=data["code"], module=data.get("module"),
        description=data.get("description"), query_template=data.get("query_template"),
        parameters=data.get("parameters", []), columns=data.get("columns", []),
        filters=data.get("filters", []), chart_type=data.get("chart_type"),
        category=data.get("category"), tenant_id=identity["tenant_id"]
    )
    db.session.add(report)
    db.session.commit()
    return success_response(report.to_dict(), "Report created", 201)


@reporting_bp.route("/dashboards", methods=["GET"])
@jwt_required()
def list_dashboards():
    identity = get_identity()
    query = Dashboard.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@reporting_bp.route("/dashboards", methods=["POST"])
@jwt_required()
def create_dashboard():
    data = request.get_json()
    identity = get_identity()
    dashboard = Dashboard(
        name=data["name"], code=data.get("code"), module=data.get("module"),
        layout=data.get("layout", []), widgets=data.get("widgets", []),
        role_access=data.get("role_access", []), tenant_id=identity["tenant_id"]
    )
    db.session.add(dashboard)
    db.session.commit()
    return success_response(dashboard.to_dict(), "Dashboard created", 201)


@reporting_bp.route("/schedules", methods=["POST"])
@jwt_required()
def create_schedule():
    data = request.get_json()
    identity = get_identity()
    schedule = ReportSchedule(
        report_id=data["report_id"], cron_expression=data["cron_expression"],
        recipients=data.get("recipients", []), format=data.get("format", "pdf"),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(schedule)
    db.session.commit()
    return success_response(schedule.to_dict(), "Schedule created", 201)
