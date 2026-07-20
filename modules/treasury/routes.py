from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from modules.treasury.models import BankAccount, CashFlow
from shared.utils.helpers import success_response, paginate

treasury_bp = Blueprint("treasury", __name__)


@treasury_bp.route("/bank-accounts", methods=["GET"])
@jwt_required()
def list_accounts():
    identity = get_jwt_identity()
    query = BankAccount.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@treasury_bp.route("/bank-accounts", methods=["POST"])
@jwt_required()
def create_account():
    data = request.get_json()
    identity = get_jwt_identity()
    account = BankAccount(
        name=data["name"], bank_name=data.get("bank_name"),
        account_number=data.get("account_number"), ifsc_code=data.get("ifsc_code"),
        currency=data.get("currency"), type=data.get("type"),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(account)
    db.session.commit()
    return success_response(account.to_dict(), "Bank account created", 201)


@treasury_bp.route("/cash-flows", methods=["GET"])
@jwt_required()
def list_cash_flows():
    identity = get_jwt_identity()
    query = CashFlow.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@treasury_bp.route("/cash-flows", methods=["POST"])
@jwt_required()
def create_cash_flow():
    data = request.get_json()
    identity = get_jwt_identity()
    cf = CashFlow(
        bank_account_id=data["bank_account_id"], type=data["type"],
        amount=data["amount"], date=data["date"],
        category=data.get("category"), reference=data.get("reference"),
        description=data.get("description"), tenant_id=identity["tenant_id"]
    )
    db.session.add(cf)
    db.session.commit()
    return success_response(cf.to_dict(), "Cash flow recorded", 201)
