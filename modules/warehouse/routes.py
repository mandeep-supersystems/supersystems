from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from modules.warehouse.models import WarehouseZone, WarehouseBin, PickList
from shared.utils.helpers import success_response, paginate

warehouse_bp = Blueprint("warehouse", __name__)


@warehouse_bp.route("/zones", methods=["GET"])
@jwt_required()
def list_zones():
    identity = get_jwt_identity()
    query = WarehouseZone.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@warehouse_bp.route("/zones", methods=["POST"])
@jwt_required()
def create_zone():
    data = request.get_json()
    identity = get_jwt_identity()
    zone = WarehouseZone(
        warehouse_id=data["warehouse_id"], name=data["name"], code=data["code"],
        type=data.get("type"), capacity=data.get("capacity"),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(zone)
    db.session.commit()
    return success_response(zone.to_dict(), "Zone created", 201)


@warehouse_bp.route("/bins", methods=["GET"])
@jwt_required()
def list_bins():
    identity = get_jwt_identity()
    query = WarehouseBin.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@warehouse_bp.route("/pick-lists", methods=["GET"])
@jwt_required()
def list_pick_lists():
    identity = get_jwt_identity()
    query = PickList.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@warehouse_bp.route("/pick-lists", methods=["POST"])
@jwt_required()
def create_pick_list():
    data = request.get_json()
    identity = get_jwt_identity()
    pl = PickList(
        number=data["number"], warehouse_id=data["warehouse_id"],
        reference_type=data.get("reference_type"), reference_id=data.get("reference_id"),
        assigned_to=data.get("assigned_to"), items=data.get("items", []),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(pl)
    db.session.commit()
    return success_response(pl.to_dict(), "Pick list created", 201)
