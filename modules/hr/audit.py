from flask import request
from extensions import db
import uuid
import json
from datetime import date, datetime

def _serialize_val(val):
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
        return str(val)
    if isinstance(val, (int, float, bool, str)):
        return val
    try:
        return str(val)
    except Exception:
        return None

def _clean_dict(d):
    if not isinstance(d, dict):
        return {}
    clean = {}
    for k, v in d.items():
        if k in ('created_at', 'updated_at', 'id', 'tenant_id', 'is_deleted'):
            continue
        clean[k] = _serialize_val(v)
    return clean

def log_hr_audit(action, entity_type, entity_id, old_values=None, new_values=None, extra_info=None):
    """
    Central, reliable audit logging for all HR events.
    Computes field-level changes, captures user identity, and commits to audit.logs.
    """
    try:
        forwarded = request.headers.get('X-Forwarded-For', '')
        ip = forwarded.split(',')[0].strip() if forwarded else (request.remote_addr or '')

        user_email = (request.headers.get('X-User-Email') or '').strip()
        user_name = (request.headers.get('X-User-Name') or '').strip()
        tenant_id = (request.headers.get('X-Tenant-ID') or '').strip()
        if not tenant_id or tenant_id in ('TEST', ''):
            tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958'

        old_clean = _clean_dict(old_values) if old_values else {}
        new_clean = _clean_dict(new_values) if new_values else {}

        extra = {}
        if old_clean:
            extra['old'] = old_clean
        if new_clean:
            extra['new'] = new_clean

        if old_clean and new_clean:
            changes = {}
            for k, v in new_clean.items():
                old_v = old_clean.get(k)
                if str(old_v) != str(v) and (old_v is not None or v is not None):
                    changes[k] = {"old": old_v, "new": v}
            if changes:
                extra['changes'] = changes

        if extra_info:
            extra['info'] = extra_info

        log_id = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO audit.logs (id, action, module, entity_type, entity_id, "
            "ip_address, tenant_id, user_email, user_name, extra_data, created_at) "
            "VALUES (:id, :action, 'HR', :etype, :eid, :ip, :tid, :email, :name, :extra, NOW())"
        ), {
            "id": log_id,
            "action": action.upper(),
            "etype": entity_type,
            "eid": str(entity_id),
            "ip": ip,
            "tid": tenant_id,
            "email": user_email,
            "name": user_name,
            "extra": json.dumps(extra) if extra else None
        })
        db.session.commit()
    except Exception as e:
        try:
            db.session.rollback()
        except Exception:
            pass
