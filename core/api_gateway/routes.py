from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from core.api_gateway.models import APIKey, APILog, Webhook
from shared.utils.helpers import success_response, paginate
import secrets

gateway_bp = Blueprint("gateway", __name__)


@gateway_bp.route("/keys", methods=["GET"])
@jwt_required()
def list_keys():
    identity = get_identity()
    query = APIKey.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@gateway_bp.route("/keys", methods=["POST"])
@jwt_required()
def create_key():
    data = request.get_json()
    identity = get_identity()
    key = secrets.token_urlsafe(32)
    secret = secrets.token_urlsafe(48)
    api_key = APIKey(
        name=data["name"], key=key, secret_hash=secret,
        scopes=data.get("scopes", []), rate_limit=data.get("rate_limit", 1000),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(api_key)
    db.session.commit()
    return success_response({"id": api_key.id, "key": key, "secret": secret}, "API Key created", 201)


@gateway_bp.route("/logs", methods=["GET"])
@jwt_required()
def list_logs():
    identity = get_identity()
    query = APILog.query.filter_by(tenant_id=identity["tenant_id"]).order_by(APILog.created_at.desc())
    return success_response(paginate(query))


@gateway_bp.route("/webhooks", methods=["GET"])
@jwt_required()
def list_webhooks():
    identity = get_identity()
    query = Webhook.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@gateway_bp.route("/webhooks", methods=["POST"])
@jwt_required()
def create_webhook():
    data = request.get_json()
    identity = get_identity()
    webhook = Webhook(
        name=data["name"], url=data["url"], events=data.get("events", []),
        headers=data.get("headers", {}), secret=data.get("secret"),
        retry_count=data.get("retry_count", 3), tenant_id=identity["tenant_id"]
    )
    db.session.add(webhook)
    db.session.commit()
    return success_response(webhook.to_dict(), "Webhook created", 201)
