from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from modules.asset_management.models import AssetRegister, AssetTransfer, AssetDisposal
from shared.utils.helpers import success_response, paginate

asset_bp = Blueprint("assets", __name__)


@asset_bp.route("/register", methods=["GET"])
@jwt_required()
def list_assets():
    identity = get_jwt_identity()
    query = AssetRegister.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@asset_bp.route("/register", methods=["POST"])
@jwt_required()
def register_asset():
    data = request.get_json()
    identity = get_jwt_identity()
    asset = AssetRegister(
        asset_id=data["asset_id"], acquisition_date=data.get("acquisition_date"),
        acquisition_cost=data.get("acquisition_cost"), book_value=data.get("book_value"),
        salvage_value=data.get("salvage_value"),
        depreciation_method=data.get("depreciation_method"),
        useful_life_months=data.get("useful_life_months"),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(asset)
    db.session.commit()
    return success_response(asset.to_dict(), "Asset registered", 201)


@asset_bp.route("/transfers", methods=["POST"])
@jwt_required()
def create_transfer():
    data = request.get_json()
    identity = get_jwt_identity()
    transfer = AssetTransfer(
        asset_id=data["asset_id"], from_location=data.get("from_location"),
        to_location=data.get("to_location"), from_department=data.get("from_department"),
        to_department=data.get("to_department"), transfer_date=data.get("transfer_date"),
        reason=data.get("reason"), tenant_id=identity["tenant_id"]
    )
    db.session.add(transfer)
    db.session.commit()
    return success_response(transfer.to_dict(), "Transfer created", 201)


@asset_bp.route("/disposals", methods=["POST"])
@jwt_required()
def create_disposal():
    data = request.get_json()
    identity = get_jwt_identity()
    disposal = AssetDisposal(
        asset_id=data["asset_id"], disposal_date=data.get("disposal_date"),
        disposal_method=data.get("disposal_method"), sale_amount=data.get("sale_amount"),
        book_value_at_disposal=data.get("book_value_at_disposal"),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(disposal)
    db.session.commit()
    return success_response(disposal.to_dict(), "Disposal created", 201)
