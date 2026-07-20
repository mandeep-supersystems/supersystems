from extensions import db
from shared.base_model import BaseModel


class NotificationTemplate(BaseModel):
    __tablename__ = "notification_templates"
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(100), nullable=False)
    channel = db.Column(db.String(50), nullable=False)  # email, sms, push, in_app, webhook
    subject = db.Column(db.String(500))
    body = db.Column(db.Text, nullable=False)
    variables = db.Column(db.JSON, default=[])
    is_active = db.Column(db.Boolean, default=True)


class Notification(BaseModel):
    __tablename__ = "notifications"
    template_id = db.Column(db.String(36), db.ForeignKey("notification_templates.id"))
    channel = db.Column(db.String(50), nullable=False)
    recipient_id = db.Column(db.String(36), nullable=False)
    recipient_email = db.Column(db.String(200))
    subject = db.Column(db.String(500))
    body = db.Column(db.Text)
    status = db.Column(db.String(50), default="pending")  # pending, sent, failed, read
    read_at = db.Column(db.DateTime)
    sent_at = db.Column(db.DateTime)
    extra_data = db.Column(db.JSON)
    module = db.Column(db.String(100))
    entity_type = db.Column(db.String(100))
    entity_id = db.Column(db.String(36))
