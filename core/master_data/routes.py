from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from core.master_data.models import (
    Organization, Company, Plant, Warehouse, Department, Employee,
    Customer, Vendor, Supplier, Material, Product, Service, Asset,
    Project, CostCenter, ProfitCenter, GLAccount, Currency, TaxCode,
    UnitOfMeasure, Country, Region, Location, Part
)
from shared.utils.helpers import success_response, error_response, paginate, get_identity

master_data_bp = Blueprint("master_data", __name__)

# Entity registry for generic CRUD
ENTITY_MAP = {
    "organizations": Organization, "companies": Company, "plants": Plant,
    "warehouses": Warehouse, "departments": Department, "employees": Employee,
    "customers": Customer, "vendors": Vendor, "suppliers": Supplier,
    "materials": Material, "products": Product, "services": Service,
    "assets": Asset, "projects": Project, "cost-centers": CostCenter,
    "profit-centers": ProfitCenter, "gl-accounts": GLAccount,
    "currencies": Currency, "tax-codes": TaxCode, "uom": UnitOfMeasure,
    "countries": Country, "regions": Region, "locations": Location, "parts": Part,
}


@master_data_bp.route("/<entity_name>", methods=["GET"])
@jwt_required()
def list_entities(entity_name):
    identity = get_identity()
    model = ENTITY_MAP.get(entity_name)
    if not model:
        return error_response("Entity not found", 404)
    query = model.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    search = request.args.get("search")
    if search and hasattr(model, "name"):
        query = query.filter(model.name.ilike(f"%{search}%"))
    return success_response(paginate(query))


@master_data_bp.route("/<entity_name>", methods=["POST"])
@jwt_required()
def create_entity(entity_name):
    identity = get_identity()
    model = ENTITY_MAP.get(entity_name)
    if not model:
        return error_response("Entity not found", 404)
    data = request.get_json()
    data["tenant_id"] = identity["tenant_id"]
    data["created_by"] = identity["user_id"]
    # Filter only valid columns
    valid_cols = {c.name for c in model.__table__.columns}
    filtered = {k: v for k, v in data.items() if k in valid_cols and k != "id"}
    entity = model(**filtered)
    db.session.add(entity)
    db.session.commit()
    return success_response(entity.to_dict(), f"{entity_name} created", 201)


@master_data_bp.route("/<entity_name>/<entity_id>", methods=["GET"])
@jwt_required()
def get_entity(entity_name, entity_id):
    model = ENTITY_MAP.get(entity_name)
    if not model:
        return error_response("Entity not found", 404)
    entity = model.query.get_or_404(entity_id)
    return success_response(entity.to_dict())


@master_data_bp.route("/<entity_name>/<entity_id>", methods=["PUT"])
@jwt_required()
def update_entity(entity_name, entity_id):
    identity = get_identity()
    model = ENTITY_MAP.get(entity_name)
    if not model:
        return error_response("Entity not found", 404)
    entity = model.query.get_or_404(entity_id)
    data = request.get_json()
    valid_cols = {c.name for c in model.__table__.columns}
    for k, v in data.items():
        if k in valid_cols and k not in ("id", "tenant_id", "created_at", "created_by"):
            setattr(entity, k, v)
    entity.updated_by = identity["user_id"]
    db.session.commit()
    return success_response(entity.to_dict(), f"{entity_name} updated")


@master_data_bp.route("/<entity_name>/<entity_id>", methods=["DELETE"])
@jwt_required()
def delete_entity(entity_name, entity_id):
    identity = get_identity()
    model = ENTITY_MAP.get(entity_name)
    if not model:
        return error_response("Entity not found", 404)
    entity = model.query.get_or_404(entity_id)
    entity.soft_delete(identity["user_id"])
    db.session.commit()
    return success_response(None, f"{entity_name} deleted")
