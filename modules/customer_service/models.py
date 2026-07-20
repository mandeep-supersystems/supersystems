from extensions import db
from shared.base_model import BaseModel


class Ticket(BaseModel):
    __tablename__ = "tickets"
    number = db.Column(db.String(50), nullable=False)
    customer_id = db.Column(db.String(36), nullable=False)
    subject = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(100))
    priority = db.Column(db.String(20), default="medium")
    status = db.Column(db.String(50), default="open")
    assigned_to = db.Column(db.String(36))
    resolved_at = db.Column(db.DateTime)
    sla_due = db.Column(db.DateTime)


class TicketComment(BaseModel):
    __tablename__ = "ticket_comments"
    ticket_id = db.Column(db.String(36), db.ForeignKey("tickets.id"), nullable=False)
    user_id = db.Column(db.String(36), nullable=False)
    comment = db.Column(db.Text, nullable=False)
    is_internal = db.Column(db.Boolean, default=False)
