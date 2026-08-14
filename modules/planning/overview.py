from flask import Blueprint, request
from extensions import db
import uuid
import json
from datetime import datetime

# Common functions (we should ideally put these in a utils file, but for now we'll duplicate or import)
def _tid():
    return request.headers.get("X-Tenant-ID", "")

def _user():
    return request.headers.get("X-User-Name", "") or request.headers.get("X-User-Email", "")

def _tid_cond():
    return "(tenant_id = :tid OR tenant_id = '' OR tenant_id IS NULL)"

def _notify(tenant_id, module, event_type, ref_no, ref_id, title, message, role):
    try:
        db.session.execute(db.text(
            "INSERT INTO planning.notifications (id, module, event_type, reference_no, reference_id, "
            "title, message, recipient_role, tenant_id, created_at) "
            "VALUES (:id, :mod, :evt, :ref_no, :ref_id, :title, :msg, :role, :tid, NOW())"
        ), {
            "id": str(uuid.uuid4()),
            "mod": module, "evt": event_type, "ref_no": ref_no,
            "ref_id": str(ref_id) if ref_id else None,
            "title": title, "msg": message, "role": role, "tid": tenant_id
        })
        db.session.commit()
    except Exception:
        db.session.rollback()

overview_bp = Blueprint('overview', __name__)



@overview_bp.route("/overview", methods=["GET"])
def overview():
    tid = _tid()
    cond = _tid_cond()
    try:
        # Projects:
        proj_rows = db.session.execute(db.text(
            "SELECT id, customer_pos, purchase_orders FROM project.projects "
            "WHERE is_deleted = false AND (tenant_id = :tid OR tenant_id = '' OR tenant_id IS NULL)"
        ), {"tid": tid}).fetchall()

        # Part mappings: customer_part_number -> internal_part_number
        try:
            mapping_rows = db.session.execute(db.text(
                "SELECT customer_part_number, internal_part_number FROM part.customer_mappings WHERE (tenant_id = :tid OR tenant_id IS NULL) AND is_deleted = false"
            ), {"tid": tid}).fetchall()
        except Exception:
            db.session.rollback()
            mapping_rows = []
        cust_to_internal = {r[0]: r[1] for r in mapping_rows}

        # Stock levels: part_number -> available
        try:
            stock_rows = db.session.execute(db.text(
                "SELECT part_number, COALESCE(SUM(qty_available),0) FROM inventory_stock_levels WHERE is_deleted = false GROUP BY part_number"
            ), {}).fetchall()
        except Exception:
            db.session.rollback()
            stock_rows = []
        stock_map = {r[0]: float(r[1]) for r in stock_rows}

        # Valid internal parts
        import re as _re
        part_type_map = {}
        try:
            subs = db.session.execute(db.text(
                "SELECT c.name, c.series_prefix FROM part.subcategories s "
                "JOIN part.categories c ON s.category_id = c.id "
                "WHERE s.tenant_id = :tid AND s.is_deleted = false"
            ), {"tid": tid}).fetchall()
            for sub in subs:
                tname = 'part."' + _re.sub(r'[^a-z0-9]','_',sub[0].lower().strip()).strip('_') + '_' + sub[1] + '"'
                try:
                    prows = db.session.execute(db.text(
                        f"SELECT part_number FROM {tname} WHERE status != 'obsolete' OR status IS NULL"
                    ), {}).fetchall()
                    for r in prows:
                        part_type_map[r[0]] = True
                except Exception:
                    db.session.rollback()
        except Exception:
            db.session.rollback()
        valid_parts = set(part_type_map.keys())

        # PRs
        try:
            pr_rows = db.session.execute(db.text(
                "SELECT item_code, COALESCE(SUM(required_qty),0) FROM planning.purchase_requests "
                "WHERE status NOT IN ('cancelled','rejected') AND is_deleted = false "
                "AND (tenant_id = :tid OR tenant_id = '' OR tenant_id IS NULL) GROUP BY item_code"
            ), {"tid": tid}).fetchall()
        except Exception:
            db.session.rollback()
            pr_rows = []
        pr_map = {r[0]: float(r[1]) for r in pr_rows}

        pr_generated_keys = set()
        try:
            slk_rows = db.session.execute(db.text(
                "SELECT source_line_keys FROM planning.purchase_requests "
                "WHERE is_deleted = false AND status NOT IN ('cancelled','rejected') "
                "AND (tenant_id = :tid OR tenant_id = '' OR tenant_id IS NULL)"
            ), {"tid": tid}).fetchall()
            for r in slk_rows:
                slk = (r[0] or "").strip()
                if slk:
                    for k in slk.split(","):
                        k = k.strip()
                        if k:
                            pr_generated_keys.add(k)
        except Exception:
            db.session.rollback()

        total_co_lines = 0
        needs_pr_lines = 0

        for row in proj_rows:
            proj_id = str(row[0])
            pos = row[1] or row[2] or []
            if isinstance(pos, str):
                try: pos = json.loads(pos)
                except: pos = []
            if not isinstance(pos, list): pos = []
            for po in pos:
                lines = po.get("lines", [])
                for idx, line in enumerate(lines):
                    total_co_lines += 1
                    cust_pn = (line.get("part_number") or "").strip()
                    qty = float(line.get("qty", 0))

                    internal_pn = cust_to_internal.get(cust_pn) if cust_pn else None
                    if not internal_pn and cust_pn in valid_parts:
                        internal_pn = cust_pn
                    is_mapped = bool(cust_to_internal.get(cust_pn))
                    is_internal = internal_pn in valid_parts if internal_pn else False

                    avail = stock_map.get(internal_pn or cust_pn, 0.0)
                    shortage = max(0.0, qty - avail)
                    can_fulfill_from_stock = avail >= qty

                    pr_qty = pr_map.get(internal_pn or cust_pn, 0.0)
                    line_key = f"{proj_id}|{po.get('id','')}|{idx}"
                    pr_generated = line_key in pr_generated_keys

                    if not cust_pn:
                        pass
                    elif not is_mapped and not is_internal:
                        pass
                    elif pr_generated:
                        pass
                    elif can_fulfill_from_stock:
                        pass
                    elif pr_qty >= shortage:
                        pass
                    elif shortage > 0:
                        needs_pr_lines += 1

        total_prs = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM planning.purchase_requests WHERE is_deleted=false AND {cond}"
        ), {"tid": tid}).scalar() or 0
        pending_prs = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM planning.purchase_requests WHERE status='draft' AND is_deleted=false AND {cond}"
        ), {"tid": tid}).scalar() or 0
        sent_prs = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM planning.purchase_requests WHERE status='sent_to_purchaser' AND is_deleted=false AND {cond}"
        ), {"tid": tid}).scalar() or 0
        converted_prs = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM planning.purchase_requests WHERE status='converted_to_po' AND is_deleted=false AND {cond}"
        ), {"tid": tid}).scalar() or 0
        
        unread_notifs = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM planning.notifications WHERE is_read=false AND tenant_id=:tid"
        ), {"tid": tid}).scalar() or 0

        # Delayed POs and Reschedules
        try:
            total_delay_days = db.session.execute(db.text(
                "SELECT COALESCE(SUM(delay_days), 0) FROM procurement.purchase_orders "
                "WHERE pr_no IN (SELECT pr_no FROM planning.purchase_requests WHERE is_deleted=false AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL)) AND is_deleted=false"
            ), {"tid": tid}).scalar() or 0
            
            active_pos = db.session.execute(db.text(
                "SELECT COUNT(DISTINCT doc_no) FROM procurement.purchase_orders "
                "WHERE pr_no IN (SELECT pr_no FROM planning.purchase_requests WHERE is_deleted=false AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL)) AND is_deleted=false AND po_status NOT IN ('draft', 'cancelled', 'received')"
            ), {"tid": tid}).scalar() or 0

            total_rescheduled = db.session.execute(db.text(
                "SELECT COUNT(*) FROM purchase_lead_time_history "
                "WHERE po_no IN (SELECT doc_no FROM procurement.purchase_orders WHERE pr_no IN (SELECT pr_no FROM planning.purchase_requests WHERE is_deleted=false AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL)) AND is_deleted=false)"
            ), {"tid": tid}).scalar() or 0
        except Exception:
            db.session.rollback()
            total_delay_days = 0
            active_pos = 0
            total_rescheduled = 0

        return {"success": True, "data": {
            "total_co_lines": total_co_lines, "needs_pr_lines": needs_pr_lines,
            "total_prs": total_prs, "pending_prs": pending_prs,
            "sent_prs": sent_prs, "converted_prs": converted_prs,
            "unread_notifications": unread_notifs,
            "total_delay_days": total_delay_days,
            "active_pos": active_pos,
            "total_rescheduled": total_rescheduled
        }}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e)}, 500


@overview_bp.route("/audit-logs", methods=["GET"])
def get_audit_logs():
    tenant_id = _tid()
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 20, type=int)
    try:
        rows = db.session.execute(db.text(
            "SELECT action, entity_type, entity_id, user_name, user_email, ip_address, created_at, old_value, new_value FROM audit.logs WHERE module IN ('Planning', 'PLANNING') AND tenant_id = :tid ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        ), {"tid": tenant_id, "limit": limit, "offset": (page-1)*limit}).fetchall()
        
        import json
        items = []
        for r in rows:
            items.append({
                "action": r[0], "entity_type": r[1] or "Plan", "entity_id": r[2] or "-",
                "user_name": r[3] or r[4] or "Planning Officer", "user_email": r[4] or "",
                "ip_address": r[5] or "127.0.0.1", "created_at": str(r[6]),
                "old_value": r[7] if isinstance(r[7], (dict, list)) else (json.loads(r[7]) if (isinstance(r[7], str) and r[7].strip()) else None),
                "new_value": r[8] if isinstance(r[8], (dict, list)) else (json.loads(r[8]) if (isinstance(r[8], str) and r[8].strip()) else None)
            })
        return {"success": True, "data": {"items": items, "total": len(items)}}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e), "data": {"items": [], "total": 0}}


@overview_bp.route("/users", methods=["GET"])
def get_module_users():
    tenant_id = _tid()
    try:
        rows = db.session.execute(db.text(
            "SELECT ma.id, ma.user_id, ma.role, ma.permissions, ma.is_active, ma.created_at, "
            "u.email, u.first_name, u.last_name "
            "FROM iam.module_access ma JOIN iam.users u ON ma.user_id = u.id "
            "WHERE ma.module IN ('Planning Management', 'Planning') "
            "ORDER BY ma.created_at DESC"
        )).fetchall()
        items = [{
            "id": r[0], "user_id": r[1], "role": r[2], "permissions": r[3] or {},
            "is_active": r[4], "created_at": str(r[5]) if r[5] else None,
            "email": r[6], "first_name": r[7] or '', "last_name": r[8] or ''
        } for r in rows]
        return {"success": True, "data": items}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e), "data": []}


@overview_bp.route("/users", methods=["POST"])
def add_module_user():
    data = request.get_json() or {}
    tenant_id = _tid()
    user_id = data.get("user_id")
    role = data.get("role", "viewer")
    permissions = data.get("permissions", {})

    if not user_id:
        return {"success": False, "message": "user_id required"}, 400

    user_row = db.session.execute(db.text("SELECT id, email FROM iam.users WHERE id = :id AND is_deleted = false"), {"id": user_id}).first()
    if not user_row:
        return {"success": False, "message": "User not found"}, 404

    existing = db.session.execute(db.text("SELECT id FROM iam.module_access WHERE user_id = :uid AND module IN ('Planning Management', 'Planning')"), {"uid": user_id}).first()
    if existing:
        return {"success": False, "message": "User already has access to this module"}, 409

    access_id = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO iam.module_access (id, user_id, module, role, permissions, granted_by, tenant_id) "
        "VALUES (:id, :uid, 'Planning', :role, :perms, 'system', :tid)"
    ), {"id": access_id, "uid": user_id, "role": role, "perms": json.dumps(permissions), "tid": tenant_id})
    db.session.commit()
    return {"success": True, "message": f"Access granted to {user_row[1]}"}, 201


@overview_bp.route("/users/<access_id>", methods=["PUT"])
def update_module_user(access_id):
    data = request.get_json() or {}
    updates, params = [], {"id": access_id}
    if "role" in data:
        updates.append("role=:role")
        params["role"] = data["role"]
    if "permissions" in data:
        updates.append("permissions=:permissions")
        params["permissions"] = json.dumps(data["permissions"])
    if "is_active" in data:
        updates.append("is_active=:is_active")
        params["is_active"] = data["is_active"]
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE iam.module_access SET {', '.join(updates)} WHERE id=:id"), params)
    db.session.commit()
    return {"success": True, "message": "Access updated"}


@overview_bp.route("/users/<access_id>", methods=["DELETE"])
def revoke_module_user(access_id):
    db.session.execute(db.text("DELETE FROM iam.module_access WHERE id = :id"), {"id": access_id})
    db.session.commit()
    return {"success": True, "message": "Access revoked"}


