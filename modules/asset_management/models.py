from extensions import db
from shared.base_model import BaseModel


class AssetRegister(BaseModel):
    __tablename__ = "asset_register"
    asset_id = db.Column(db.String(36), nullable=False)
    acquisition_date = db.Column(db.Date)
    acquisition_cost = db.Column(db.Numeric(18, 2))
    book_value = db.Column(db.Numeric(18, 2))
    salvage_value = db.Column(db.Numeric(18, 2))
    depreciation_method = db.Column(db.String(50))
    useful_life_months = db.Column(db.Integer)
    accumulated_depreciation = db.Column(db.Numeric(18, 2), default=0)
    status = db.Column(db.String(50), default="active")


class AssetTransfer(BaseModel):
    __tablename__ = "asset_transfers"
    asset_id = db.Column(db.String(36), nullable=False)
    from_location = db.Column(db.String(36))
    to_location = db.Column(db.String(36))
    from_department = db.Column(db.String(36))
    to_department = db.Column(db.String(36))
    transfer_date = db.Column(db.Date)
    reason = db.Column(db.Text)
    status = db.Column(db.String(50), default="pending")


class AssetDisposal(BaseModel):
    __tablename__ = "asset_disposals"
    asset_id = db.Column(db.String(36), nullable=False)
    disposal_date = db.Column(db.Date)
    disposal_method = db.Column(db.String(50))
    sale_amount = db.Column(db.Numeric(18, 2))
    book_value_at_disposal = db.Column(db.Numeric(18, 2))
    gain_loss = db.Column(db.Numeric(18, 2))
    status = db.Column(db.String(50), default="pending")
