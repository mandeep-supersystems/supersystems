from extensions import db
from shared.base_model import BaseModel


class InventoryItem(BaseModel):
    __tablename__ = "inventory_items"
    material_id = db.Column(db.String(36), nullable=False)
    warehouse_id = db.Column(db.String(36), nullable=False)
    batch_number = db.Column(db.String(100))
    serial_number = db.Column(db.String(100))
    quantity = db.Column(db.Numeric(18, 4), default=0)
    reserved_qty = db.Column(db.Numeric(18, 4), default=0)
    uom = db.Column(db.String(20))
    location_bin = db.Column(db.String(50))
    status = db.Column(db.String(50), default="available")


class StockMovement(BaseModel):
    __tablename__ = "stock_movements"
    material_id = db.Column(db.String(36), nullable=False)
    movement_type = db.Column(db.String(50), nullable=False)  # receipt, issue, transfer, adjustment
    from_warehouse = db.Column(db.String(36))
    to_warehouse = db.Column(db.String(36))
    quantity = db.Column(db.Numeric(18, 4), nullable=False)
    uom = db.Column(db.String(20))
    reference_type = db.Column(db.String(50))
    reference_id = db.Column(db.String(36))
    reason = db.Column(db.Text)
    status = db.Column(db.String(50), default="completed")


class StockCount(BaseModel):
    __tablename__ = "stock_counts"
    warehouse_id = db.Column(db.String(36), nullable=False)
    count_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(50), default="draft")
    counted_by = db.Column(db.String(36))
    approved_by = db.Column(db.String(36))
    items = db.Column(db.JSON, default=[])
