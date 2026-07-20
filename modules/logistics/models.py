from extensions import db
from shared.base_model import BaseModel


class Shipment(BaseModel):
    __tablename__ = "shipments"
    number = db.Column(db.String(50), nullable=False)
    type = db.Column(db.String(50))  # inbound, outbound
    carrier = db.Column(db.String(200))
    tracking_number = db.Column(db.String(200))
    origin = db.Column(db.JSON)
    destination = db.Column(db.JSON)
    ship_date = db.Column(db.Date)
    delivery_date = db.Column(db.Date)
    status = db.Column(db.String(50), default="pending")
    weight = db.Column(db.Float)
    items = db.Column(db.JSON, default=[])


class DeliveryNote(BaseModel):
    __tablename__ = "delivery_notes"
    number = db.Column(db.String(50), nullable=False)
    shipment_id = db.Column(db.String(36))
    customer_id = db.Column(db.String(36))
    delivery_date = db.Column(db.Date)
    status = db.Column(db.String(50), default="pending")
    items = db.Column(db.JSON, default=[])
    signature = db.Column(db.Text)
