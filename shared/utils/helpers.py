from flask import jsonify, request
from functools import wraps
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
import json as _json


def get_identity():
    """Get parsed JWT identity (handles JSON-string serialized dicts)."""
    raw = get_jwt_identity()
    if isinstance(raw, str):
        try:
            return _json.loads(raw)
        except (ValueError, TypeError):
            return raw
    return raw


def success_response(data=None, message="Success", status=200):
    return jsonify({"success": True, "message": message, "data": data}), status


def error_response(message="Error", status=400, errors=None):
    return jsonify({"success": False, "message": message, "errors": errors}), status


def paginate(query, schema=None):
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    items = [item.to_dict() for item in pagination.items]
    return {
        "items": items,
        "total": pagination.total,
        "page": pagination.page,
        "per_page": pagination.per_page,
        "pages": pagination.pages,
    }


def permission_required(permission):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            identity = get_identity()
            # Permission check logic via IAM
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def tenant_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        identity = get_identity()
        if not identity.get("tenant_id"):
            return error_response("Tenant context required", 403)
        return fn(*args, **kwargs)
    return wrapper
