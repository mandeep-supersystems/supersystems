from extensions import db
from shared.base_model import BaseModel


class BankAccount(BaseModel):
    __tablename__ = "bank_accounts"
    name = db.Column(db.String(200), nullable=False)
    bank_name = db.Column(db.String(200))
    account_number = db.Column(db.String(50))
    ifsc_code = db.Column(db.String(20))
    currency = db.Column(db.String(10))
    balance = db.Column(db.Numeric(18, 2), default=0)
    type = db.Column(db.String(50))
    is_active = db.Column(db.Boolean, default=True)


class CashFlow(BaseModel):
    __tablename__ = "cash_flows"
    bank_account_id = db.Column(db.String(36), nullable=False)
    type = db.Column(db.String(50))  # inflow, outflow
    amount = db.Column(db.Numeric(18, 2), nullable=False)
    date = db.Column(db.Date, nullable=False)
    category = db.Column(db.String(100))
    reference = db.Column(db.String(200))
    description = db.Column(db.Text)
