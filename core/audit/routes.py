from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from core.audit.models import AuditLog
from shared.utils.helpers import success_response, paginate, get_identity

audit_bp = Blueprint("audit", __name__)


def log_audit(tenant_id, module, entity_type, entity_id, action, user_id,
              user_email=None, old_values=None, new_values=None, ip=None):
    changes = None
    if old_values and new_values:
        changes = {k: {"old": old_values.get(k), "new": v}
                   for k, v in new_values.items() if old_values.get(k) != v}
    audit = AuditLog(
        tenant_id=tenant_id, module=module, entity_type=entity_type,
        entity_id=entity_id, action=action, user_id=user_id,
        user_email=user_email, old_values=old_values, new_values=new_values,
        changes=changes, ip_address=ip
    )
    db.session.add(audit)
    db.session.commit()
    return audit


@audit_bp.route("/logs", methods=["GET"])
@jwt_required()
def list_logs():
    identity = get_identity()
    query = AuditLog.query.filter_by(tenant_id=identity["tenant_id"])
    module = request.args.get("module")
    entity_type = request.args.get("entity_type")
    entity_id = request.args.get("entity_id")
    user_id = request.args.get("user_id")
    if module:
        query = query.filter_by(module=module)
    if entity_type:
        query = query.filter_by(entity_type=entity_type)
    if entity_id:
        query = query.filter_by(entity_id=entity_id)
    if user_id:
        query = query.filter_by(user_id=user_id)
    query = query.order_by(AuditLog.created_at.desc())
    return success_response(paginate(query))


@audit_bp.route("/logs/<entity_type>/<entity_id>", methods=["GET"])
@jwt_required()
def entity_history(entity_type, entity_id):
    identity = get_identity()
    logs = AuditLog.query.filter_by(
        tenant_id=identity["tenant_id"], entity_type=entity_type, entity_id=entity_id
    ).order_by(AuditLog.created_at.desc()).all()
    return success_response([l.to_dict() for l in logs])
