from extensions import db
from shared.base_model import BaseModel


class PurchaseRequisition(BaseModel):
    __tablename__ = "purchase_requisitions"
    number = db.Column(db.String(50), nullable=False)
    requester_id = db.Column(db.String(36), nullable=False)
    department_id = db.Column(db.String(36))
    required_date = db.Column(db.Date)
    status = db.Column(db.String(50), default="draft")
    total_amount = db.Column(db.Numeric(18, 2))
    notes = db.Column(db.Text)
    items = db.Column(db.JSON, default=[])


class PurchaseOrder(BaseModel):
    __tablename__ = "purchase_orders"
    number = db.Column(db.String(50), nullable=False)
    vendor_id = db.Column(db.String(36), nullable=False)
    requisition_id = db.Column(db.String(36))
    order_date = db.Column(db.Date)
    delivery_date = db.Column(db.Date)
    status = db.Column(db.String(50), default="draft")
    total_amount = db.Column(db.Numeric(18, 2))
    tax_amount = db.Column(db.Numeric(18, 2))
    currency = db.Column(db.String(10))
    payment_terms = db.Column(db.String(50))
    items = db.Column(db.JSON, default=[])


class GoodsReceipt(BaseModel):
    __tablename__ = "goods_receipts"
    number = db.Column(db.String(50), nullable=False)
    po_id = db.Column(db.String(36), db.ForeignKey("purchase_orders.id"))
    vendor_id = db.Column(db.String(36))
    receipt_date = db.Column(db.Date)
    warehouse_id = db.Column(db.String(36))
    status = db.Column(db.String(50), default="draft")
    items = db.Column(db.JSON, default=[])


class VendorInvoice(BaseModel):
    __tablename__ = "vendor_invoices"
    number = db.Column(db.String(50), nullable=False)
    vendor_id = db.Column(db.String(36), nullable=False)
    po_id = db.Column(db.String(36))
    invoice_date = db.Column(db.Date)
    due_date = db.Column(db.Date)
    total_amount = db.Column(db.Numeric(18, 2))
    tax_amount = db.Column(db.Numeric(18, 2))
    status = db.Column(db.String(50), default="pending")
    payment_status = db.Column(db.String(50), default="unpaid")
