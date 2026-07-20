from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from modules.manufacturing.models import BillOfMaterial, ProductionOrder, WorkCenter
from shared.utils.helpers import success_response, paginate

manufacturing_bp = Blueprint("manufacturing", __name__)


@manufacturing_bp.route("/bom", methods=["GET"])
@jwt_required()
def list_bom():
    identity = get_jwt_identity()
    query = BillOfMaterial.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@manufacturing_bp.route("/bom", methods=["POST"])
@jwt_required()
def create_bom():
    data = request.get_json()
    identity = get_jwt_identity()
    bom = BillOfMaterial(
        product_id=data["product_id"], name=data["name"],
        components=data.get("components", []), yield_qty=data.get("yield_qty"),
        uom=data.get("uom"), tenant_id=identity["tenant_id"]
    )
    db.session.add(bom)
    db.session.commit()
    return success_response(bom.to_dict(), "BOM created", 201)


@manufacturing_bp.route("/production-orders", methods=["GET"])
@jwt_required()
def list_production_orders():
    identity = get_jwt_identity()
    query = ProductionOrder.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@manufacturing_bp.route("/production-orders", methods=["POST"])
@jwt_required()
def create_production_order():
    data = request.get_json()
    identity = get_jwt_identity()
    po = ProductionOrder(
        number=data["number"], product_id=data["product_id"], bom_id=data.get("bom_id"),
        planned_qty=data["planned_qty"], start_date=data.get("start_date"),
        end_date=data.get("end_date"), plant_id=data.get("plant_id"),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(po)
    db.session.commit()
    return success_response(po.to_dict(), "Production order created", 201)


@manufacturing_bp.route("/work-centers", methods=["GET"])
@jwt_required()
def list_work_centers():
    identity = get_jwt_identity()
    query = WorkCenter.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@manufacturing_bp.route("/work-centers", methods=["POST"])
@jwt_required()
def create_work_center():
    data = request.get_json()
    identity = get_jwt_identity()
    wc = WorkCenter(
        name=data["name"], code=data["code"], plant_id=data.get("plant_id"),
        capacity=data.get("capacity"), efficiency=data.get("efficiency", 100),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(wc)
    db.session.commit()
    return success_response(wc.to_dict(), "Work center created", 201)
