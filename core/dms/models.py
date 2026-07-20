from extensions import db
from shared.base_model import BaseModel


class Document(BaseModel):
    __tablename__ = "documents"
    name = db.Column(db.String(500), nullable=False)
    file_path = db.Column(db.String(1000), nullable=False)
    file_type = db.Column(db.String(50))
    file_size = db.Column(db.BigInteger)
    mime_type = db.Column(db.String(100))
    module = db.Column(db.String(100))
    entity_type = db.Column(db.String(100))
    entity_id = db.Column(db.String(36))
    category = db.Column(db.String(100))
    tags = db.Column(db.JSON, default=[])
    description = db.Column(db.Text)
    is_public = db.Column(db.Boolean, default=False)
    download_count = db.Column(db.Integer, default=0)


class DocumentVersion(BaseModel):
    __tablename__ = "document_versions"
    document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), nullable=False)
    version_number = db.Column(db.Integer, nullable=False)
    file_path = db.Column(db.String(1000), nullable=False)
    file_size = db.Column(db.BigInteger)
    change_notes = db.Column(db.Text)
    uploaded_by = db.Column(db.String(36))
