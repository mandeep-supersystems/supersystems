from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from core.dms.models import Document, DocumentVersion
from shared.utils.helpers import success_response, error_response, paginate, get_identity

dms_bp = Blueprint("dms", __name__)


@dms_bp.route("/documents", methods=["GET"])
@jwt_required()
def list_documents():
    identity = get_identity()
    query = Document.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    module = request.args.get("module")
    entity_type = request.args.get("entity_type")
    entity_id = request.args.get("entity_id")
    if module:
        query = query.filter_by(module=module)
    if entity_type:
        query = query.filter_by(entity_type=entity_type)
    if entity_id:
        query = query.filter_by(entity_id=entity_id)
    return success_response(paginate(query))


@dms_bp.route("/documents", methods=["POST"])
@jwt_required()
def upload_document():
    identity = get_identity()
    data = request.get_json()
    doc = Document(
        name=data["name"], file_path=data["file_path"], file_type=data.get("file_type"),
        file_size=data.get("file_size"), mime_type=data.get("mime_type"),
        module=data.get("module"), entity_type=data.get("entity_type"),
        entity_id=data.get("entity_id"), category=data.get("category"),
        tags=data.get("tags", []), tenant_id=identity["tenant_id"],
        created_by=identity["user_id"]
    )
    db.session.add(doc)
    # Create version 1
    version = DocumentVersion(
        document_id=doc.id, version_number=1, file_path=data["file_path"],
        file_size=data.get("file_size"), uploaded_by=identity["user_id"],
        tenant_id=identity["tenant_id"]
    )
    db.session.add(version)
    db.session.commit()
    return success_response(doc.to_dict(), "Document uploaded", 201)


@dms_bp.route("/documents/<doc_id>", methods=["GET"])
@jwt_required()
def get_document(doc_id):
    doc = Document.query.get_or_404(doc_id)
    return success_response(doc.to_dict())


@dms_bp.route("/documents/<doc_id>", methods=["DELETE"])
@jwt_required()
def delete_document(doc_id):
    identity = get_identity()
    doc = Document.query.get_or_404(doc_id)
    doc.soft_delete(identity["user_id"])
    db.session.commit()
    return success_response(None, "Document deleted")


@dms_bp.route("/documents/<doc_id>/versions", methods=["GET"])
@jwt_required()
def list_versions(doc_id):
    versions = DocumentVersion.query.filter_by(document_id=doc_id).order_by(
        DocumentVersion.version_number.desc()
    ).all()
    return success_response([v.to_dict() for v in versions])
