from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from modules.customer_service.models import Ticket, TicketComment
from shared.utils.helpers import success_response, paginate

customer_service_bp = Blueprint("customer_service", __name__)


@customer_service_bp.route("/tickets", methods=["GET"])
@jwt_required()
def list_tickets():
    identity = get_jwt_identity()
    query = Ticket.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    return success_response(paginate(query))


@customer_service_bp.route("/tickets", methods=["POST"])
@jwt_required()
def create_ticket():
    data = request.get_json()
    identity = get_jwt_identity()
    ticket = Ticket(
        number=data["number"], customer_id=data["customer_id"],
        subject=data["subject"], description=data.get("description"),
        category=data.get("category"), priority=data.get("priority", "medium"),
        assigned_to=data.get("assigned_to"), tenant_id=identity["tenant_id"]
    )
    db.session.add(ticket)
    db.session.commit()
    return success_response(ticket.to_dict(), "Ticket created", 201)


@customer_service_bp.route("/tickets/<ticket_id>/comments", methods=["POST"])
@jwt_required()
def add_comment(ticket_id):
    data = request.get_json()
    identity = get_jwt_identity()
    comment = TicketComment(
        ticket_id=ticket_id, user_id=identity["user_id"],
        comment=data["comment"], is_internal=data.get("is_internal", False),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(comment)
    db.session.commit()
    return success_response(comment.to_dict(), "Comment added", 201)
