from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from modules.finance.models import JournalEntry, Invoice, Payment, Budget
from shared.utils.helpers import success_response, paginate

finance_bp = Blueprint("finance", __name__)


@finance_bp.route("/journal-entries", methods=["GET"])
@jwt_required()
def list_journals():
    identity = get_jwt_identity()
    query = JournalEntry.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@finance_bp.route("/journal-entries", methods=["POST"])
@jwt_required()
def create_journal():
    data = request.get_json()
    identity = get_jwt_identity()
    je = JournalEntry(
        number=data["number"], entry_date=data["entry_date"],
        description=data.get("description"), total_debit=data.get("total_debit"),
        total_credit=data.get("total_credit"), lines=data.get("lines", []),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(je)
    db.session.commit()
    return success_response(je.to_dict(), "Journal entry created", 201)


@finance_bp.route("/invoices", methods=["GET"])
@jwt_required()
def list_invoices():
    identity = get_jwt_identity()
    query = Invoice.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@finance_bp.route("/invoices", methods=["POST"])
@jwt_required()
def create_invoice():
    data = request.get_json()
    identity = get_jwt_identity()
    inv = Invoice(
        number=data["number"], customer_id=data["customer_id"],
        invoice_date=data.get("invoice_date"), due_date=data.get("due_date"),
        subtotal=data.get("subtotal"), tax_amount=data.get("tax_amount"),
        total_amount=data.get("total_amount"), items=data.get("items", []),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(inv)
    db.session.commit()
    return success_response(inv.to_dict(), "Invoice created", 201)


@finance_bp.route("/payments", methods=["GET"])
@jwt_required()
def list_payments():
    identity = get_jwt_identity()
    query = Payment.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@finance_bp.route("/payments", methods=["POST"])
@jwt_required()
def create_payment():
    data = request.get_json()
    identity = get_jwt_identity()
    payment = Payment(
        number=data["number"], type=data["type"], entity_type=data.get("entity_type"),
        entity_id=data.get("entity_id"), amount=data["amount"],
        currency=data.get("currency"), payment_date=data.get("payment_date"),
        payment_method=data.get("payment_method"), reference=data.get("reference"),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(payment)
    db.session.commit()
    return success_response(payment.to_dict(), "Payment created", 201)


@finance_bp.route("/budgets", methods=["GET"])
@jwt_required()
def list_budgets():
    identity = get_jwt_identity()
    query = Budget.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@finance_bp.route("/budgets", methods=["POST"])
@jwt_required()
def create_budget():
    data = request.get_json()
    identity = get_jwt_identity()
    budget = Budget(
        name=data["name"], fiscal_year=data["fiscal_year"],
        department_id=data.get("department_id"), cost_center_id=data.get("cost_center_id"),
        total_amount=data.get("total_amount"), lines=data.get("lines", []),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(budget)
    db.session.commit()
    return success_response(budget.to_dict(), "Budget created", 201)
