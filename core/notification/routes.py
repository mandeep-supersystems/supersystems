from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from core.notification.models import Notification, NotificationTemplate
from shared.utils.helpers import success_response, error_response, paginate, get_identity
from datetime import datetime

notification_bp = Blueprint("notification", __name__)


def send_notification(tenant_id, channel, recipient_id, subject, body,
                      module=None, entity_type=None, entity_id=None, recipient_email=None):
    notif = Notification(
        tenant_id=tenant_id, channel=channel, recipient_id=recipient_id,
        recipient_email=recipient_email, subject=subject, body=body,
        module=module, entity_type=entity_type, entity_id=entity_id, status="sent",
        sent_at=datetime.utcnow()
    )
    db.session.add(notif)
    db.session.commit()
    return notif


@notification_bp.route("/", methods=["GET"])
@jwt_required()
def list_notifications():
    identity = get_identity()
    query = Notification.query.filter_by(
        tenant_id=identity["tenant_id"], recipient_id=identity["user_id"]
    ).order_by(Notification.created_at.desc())
    return success_response(paginate(query))


@notification_bp.route("/unread", methods=["GET"])
@jwt_required()
def unread_count():
    identity = get_identity()
    count = Notification.query.filter_by(
        recipient_id=identity["user_id"], status="sent"
    ).count()
    return success_response({"unread_count": count})


@notification_bp.route("/<notif_id>/read", methods=["PUT"])
@jwt_required()
def mark_read(notif_id):
    notif = Notification.query.get_or_404(notif_id)
    notif.status = "read"
    notif.read_at = datetime.utcnow()
    db.session.commit()
    return success_response(notif.to_dict())


@notification_bp.route("/send", methods=["POST"])
@jwt_required()
def send():
    data = request.get_json()
    identity = get_identity()
    notif = send_notification(
        tenant_id=identity["tenant_id"], channel=data["channel"],
        recipient_id=data["recipient_id"], subject=data.get("subject"),
        body=data["body"], module=data.get("module"),
        entity_type=data.get("entity_type"), entity_id=data.get("entity_id")
    )
    return success_response(notif.to_dict(), "Notification sent", 201)


@notification_bp.route("/templates", methods=["GET"])
@jwt_required()
def list_templates():
    identity = get_identity()
    query = NotificationTemplate.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@notification_bp.route("/templates", methods=["POST"])
@jwt_required()
def create_template():
    data = request.get_json()
    identity = get_identity()
    template = NotificationTemplate(
        name=data["name"], code=data["code"], channel=data["channel"],
        subject=data.get("subject"), body=data["body"],
        variables=data.get("variables", []), tenant_id=identity["tenant_id"]
    )
    db.session.add(template)
    db.session.commit()
    return success_response(template.to_dict(), "Template created", 201)
