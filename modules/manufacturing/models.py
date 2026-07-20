from extensions import db
from shared.base_model import BaseModel


class BillOfMaterial(BaseModel):
    __tablename__ = "bill_of_materials"
    product_id = db.Column(db.String(36), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    version = db.Column(db.Integer, default=1)
    status = db.Column(db.String(50), default="draft")
    components = db.Column(db.JSON, default=[])
    yield_qty = db.Column(db.Numeric(18, 4))
    uom = db.Column(db.String(20))


class ProductionOrder(BaseModel):
    __tablename__ = "production_orders"
    number = db.Column(db.String(50), nullable=False)
    product_id = db.Column(db.String(36), nullable=False)
    bom_id = db.Column(db.String(36))
    planned_qty = db.Column(db.Numeric(18, 4))
    produced_qty = db.Column(db.Numeric(18, 4), default=0)
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    status = db.Column(db.String(50), default="planned")
    plant_id = db.Column(db.String(36))


class WorkCenter(BaseModel):
    __tablename__ = "work_centers"
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    plant_id = db.Column(db.String(36))
    capacity = db.Column(db.Float)
    efficiency = db.Column(db.Float, default=100)
    status = db.Column(db.String(50), default="active")
