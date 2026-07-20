from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from modules.inventory.models import InventoryItem, StockMovement, StockCount
from shared.utils.helpers import success_response, error_response, paginate

inventory_bp = Blueprint("inventory", __name__)


@inventory_bp.route("/items", methods=["GET"])
@jwt_required()
def list_items():
    identity = get_jwt_identity()
    query = InventoryItem.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    warehouse_id = request.args.get("warehouse_id")
    if warehouse_id:
        query = query.filter_by(warehouse_id=warehouse_id)
    return success_response(paginate(query))


@inventory_bp.route("/items", methods=["POST"])
@jwt_required()
def create_item():
    data = request.get_json()
    identity = get_jwt_identity()
    item = InventoryItem(
        material_id=data["material_id"], warehouse_id=data["warehouse_id"],
        batch_number=data.get("batch_number"), quantity=data.get("quantity", 0),
        uom=data.get("uom"), location_bin=data.get("location_bin"),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(item)
    db.session.commit()
    return success_response(item.to_dict(), "Item created", 201)


@inventory_bp.route("/movements", methods=["GET"])
@jwt_required()
def list_movements():
    identity = get_jwt_identity()
    query = StockMovement.query.filter_by(tenant_id=identity["tenant_id"]).order_by(
        StockMovement.created_at.desc())
    return success_response(paginate(query))


@inventory_bp.route("/movements", methods=["POST"])
@jwt_required()
def create_movement():
    data = request.get_json()
    identity = get_jwt_identity()
    movement = StockMovement(
        material_id=data["material_id"], movement_type=data["movement_type"],
        from_warehouse=data.get("from_warehouse"), to_warehouse=data.get("to_warehouse"),
        quantity=data["quantity"], uom=data.get("uom"),
        reference_type=data.get("reference_type"), reference_id=data.get("reference_id"),
        reason=data.get("reason"), tenant_id=identity["tenant_id"]
    )
    db.session.add(movement)
    db.session.commit()
    return success_response(movement.to_dict(), "Movement recorded", 201)


@inventory_bp.route("/stock-counts", methods=["POST"])
@jwt_required()
def create_stock_count():
    data = request.get_json()
    identity = get_jwt_identity()
    count = StockCount(
        warehouse_id=data["warehouse_id"], count_date=data["count_date"],
        counted_by=identity["user_id"], items=data.get("items", []),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(count)
    db.session.commit()
    return success_response(count.to_dict(), "Stock count created", 201)
