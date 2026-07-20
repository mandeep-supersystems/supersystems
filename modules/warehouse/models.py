from extensions import db
from shared.base_model import BaseModel


class WarehouseZone(BaseModel):
    __tablename__ = "warehouse_zones"
    warehouse_id = db.Column(db.String(36), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    type = db.Column(db.String(50))
    capacity = db.Column(db.Float)
    is_active = db.Column(db.Boolean, default=True)


class WarehouseBin(BaseModel):
    __tablename__ = "warehouse_bins"
    zone_id = db.Column(db.String(36), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    type = db.Column(db.String(50))
    max_weight = db.Column(db.Float)
    max_volume = db.Column(db.Float)
    is_occupied = db.Column(db.Boolean, default=False)


class PickList(BaseModel):
    __tablename__ = "pick_lists"
    number = db.Column(db.String(50), nullable=False)
    warehouse_id = db.Column(db.String(36), nullable=False)
    reference_type = db.Column(db.String(50))
    reference_id = db.Column(db.String(36))
    assigned_to = db.Column(db.String(36))
    status = db.Column(db.String(50), default="pending")
    items = db.Column(db.JSON, default=[])
