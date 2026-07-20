from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from modules.logistics.models import Shipment, DeliveryNote
from shared.utils.helpers import success_response, paginate

logistics_bp = Blueprint("logistics", __name__)


@logistics_bp.route("/shipments", methods=["GET"])
@jwt_required()
def list_shipments():
    identity = get_jwt_identity()
    query = Shipment.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@logistics_bp.route("/shipments", methods=["POST"])
@jwt_required()
def create_shipment():
    data = request.get_json()
    identity = get_jwt_identity()
    shipment = Shipment(
        number=data["number"], type=data.get("type"), carrier=data.get("carrier"),
        tracking_number=data.get("tracking_number"), origin=data.get("origin"),
        destination=data.get("destination"), ship_date=data.get("ship_date"),
        delivery_date=data.get("delivery_date"), weight=data.get("weight"),
        items=data.get("items", []), tenant_id=identity["tenant_id"]
    )
    db.session.add(shipment)
    db.session.commit()
    return success_response(shipment.to_dict(), "Shipment created", 201)


@logistics_bp.route("/delivery-notes", methods=["GET"])
@jwt_required()
def list_delivery_notes():
    identity = get_jwt_identity()
    query = DeliveryNote.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@logistics_bp.route("/delivery-notes", methods=["POST"])
@jwt_required()
def create_delivery_note():
    data = request.get_json()
    identity = get_jwt_identity()
    dn = DeliveryNote(
        number=data["number"], shipment_id=data.get("shipment_id"),
        customer_id=data.get("customer_id"), delivery_date=data.get("delivery_date"),
        items=data.get("items", []), tenant_id=identity["tenant_id"]
    )
    db.session.add(dn)
    db.session.commit()
    return success_response(dn.to_dict(), "Delivery note created", 201)
