from extensions import db
from shared.base_model import BaseModel


class JournalEntry(BaseModel):
    __tablename__ = "journal_entries"
    number = db.Column(db.String(50), nullable=False)
    entry_date = db.Column(db.Date, nullable=False)
    description = db.Column(db.Text)
    status = db.Column(db.String(50), default="draft")
    total_debit = db.Column(db.Numeric(18, 2))
    total_credit = db.Column(db.Numeric(18, 2))
    posted_by = db.Column(db.String(36))
    lines = db.Column(db.JSON, default=[])


class Invoice(BaseModel):
    __tablename__ = "invoices"
    number = db.Column(db.String(50), nullable=False)
    customer_id = db.Column(db.String(36), nullable=False)
    invoice_date = db.Column(db.Date)
    due_date = db.Column(db.Date)
    subtotal = db.Column(db.Numeric(18, 2))
    tax_amount = db.Column(db.Numeric(18, 2))
    total_amount = db.Column(db.Numeric(18, 2))
    status = db.Column(db.String(50), default="draft")
    payment_status = db.Column(db.String(50), default="unpaid")
    items = db.Column(db.JSON, default=[])


class Payment(BaseModel):
    __tablename__ = "payments"
    number = db.Column(db.String(50), nullable=False)
    type = db.Column(db.String(50))  # incoming, outgoing
    entity_type = db.Column(db.String(50))  # customer, vendor
    entity_id = db.Column(db.String(36))
    amount = db.Column(db.Numeric(18, 2), nullable=False)
    currency = db.Column(db.String(10))
    payment_date = db.Column(db.Date)
    payment_method = db.Column(db.String(50))
    reference = db.Column(db.String(200))
    status = db.Column(db.String(50), default="pending")


class Budget(BaseModel):
    __tablename__ = "budgets"
    name = db.Column(db.String(200), nullable=False)
    fiscal_year = db.Column(db.Integer, nullable=False)
    department_id = db.Column(db.String(36))
    cost_center_id = db.Column(db.String(36))
    total_amount = db.Column(db.Numeric(18, 2))
    spent_amount = db.Column(db.Numeric(18, 2), default=0)
    status = db.Column(db.String(50), default="draft")
    lines = db.Column(db.JSON, default=[])
