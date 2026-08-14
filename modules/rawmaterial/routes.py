from flask import Blueprint, request
from extensions import db
import uuid
import json

rawmaterial_bp = Blueprint("rawmaterial", __name__)


# ─── OVERVIEW / STATS ───

@rawmaterial_bp.route("/overview", methods=["GET"])
def rm_overview():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    period = request.args.get("period", "all")

    # Time filter for audit logs
    time_filter = ""
    if period == "day":
        time_filter = "AND created_at >= NOW() - INTERVAL '1 day'"
    elif period == "week":
        time_filter = "AND created_at >= NOW() - INTERVAL '7 days'"
    elif period == "month":
        time_filter = "AND created_at >= NOW() - INTERVAL '30 days'"
    elif period == "year":
        time_filter = "AND created_at >= NOW() - INTERVAL '365 days'"

    criteria_count = db.session.execute(db.text(
        "SELECT COUNT(*) FROM rawmaterial.rm_criteria WHERE tenant_id = :tid AND is_deleted = false"
    ), {"tid": tenant_id}).scalar() or 0
    rm_count = db.session.execute(db.text(
        "SELECT COUNT(*) FROM rawmaterial.rm_master WHERE tenant_id = :tid AND is_deleted = false"
    ), {"tid": tenant_id}).scalar() or 0
    mapping_count = db.session.execute(db.text(
        "SELECT COUNT(*) FROM rawmaterial.rm_part_mapping WHERE tenant_id = :tid AND is_deleted = false"
    ), {"tid": tenant_id}).scalar() or 0
    vendor_count = db.session.execute(db.text(
        "SELECT COUNT(*) FROM rawmaterial.rm_vendors WHERE tenant_id = :tid AND is_deleted = false"
    ), {"tid": tenant_id}).scalar() or 0
    active_rm = db.session.execute(db.text(
        "SELECT COUNT(*) FROM rawmaterial.rm_master WHERE tenant_id = :tid AND is_deleted = false AND is_active = true"
    ), {"tid": tenant_id}).scalar() or 0

    # Category breakdown
    cat_rows = db.session.execute(db.text(
        "SELECT material_category, COUNT(*) FROM rawmaterial.rm_master "
        "WHERE tenant_id = :tid AND is_deleted = false GROUP BY material_category"
    ), {"tid": tenant_id}).fetchall()
    category_breakdown = [{"category": r[0] if r[0] else 'Uncategorized', "count": r[1]} for r in cat_rows]
    category_breakdown = sorted(category_breakdown, key=lambda x: x["count"], reverse=True)

    # Recent audit logs with time filter
    recent_logs = db.session.execute(db.text(
        f"SELECT action, entity_type, entity_id, created_at FROM audit.logs "
        f"WHERE module = 'Raw Material Management' AND tenant_id = :tid {time_filter} ORDER BY created_at DESC LIMIT 20"
    ), {"tid": tenant_id})
    recent_activity = [{"action": r[0], "entity_type": r[1], "entity_id": r[2],
                        "created_at": str(r[3]) if r[3] else None} for r in recent_logs]

    # Action breakdown
    action_rows = db.session.execute(db.text(
        f"SELECT action, COUNT(*) FROM audit.logs "
        f"WHERE module = 'Raw Material Management' AND tenant_id = :tid {time_filter} GROUP BY action"
    ), {"tid": tenant_id}).fetchall()
    action_breakdown = {r[0]: r[1] for r in action_rows}

    return {"success": True, "data": {
        "criteria": criteria_count, "raw_materials": rm_count,
        "active_rm": active_rm, "mappings": mapping_count,
        "vendors": vendor_count, 
        "category_breakdown": category_breakdown,
        "action_breakdown": action_breakdown,
        "recent_activity": recent_activity
    }}
# ─── RM CODE CRITERIA ───

@rawmaterial_bp.route("/criteria", methods=["GET"])
def list_criteria():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    rows = db.session.execute(db.text(
        "SELECT id, material_category, sub_category, series_prefix, separator, "
        "number_format, description, is_active, created_at, current_sequence, columns_config "
        "FROM rawmaterial.rm_criteria WHERE tenant_id = :tid AND is_deleted = false "
        "ORDER BY created_at DESC"
    ), {"tid": tenant_id})
    items = [{"id": r[0], "material_category": r[1], "sub_category": r[2],
              "series_prefix": r[3], "separator": r[4], "number_format": r[5],
              "description": r[6], "is_active": r[7], "created_at": str(r[8]) if r[8] else None,
              "current_sequence": r[9], "columns_config": r[10]} for r in rows]
    return {"success": True, "data": items}


@rawmaterial_bp.route("/criteria", methods=["POST"])
def create_criteria():
    data = request.get_json()
    tenant_id = request.headers.get("X-Tenant-ID", "")
    if not data.get("material_category") or not data.get("series_prefix"):
        return {"success": False, "message": "Material Category and Series Prefix required"}, 400
    separator = data.get("separator", "-")
    if separator not in ("-", ".", "/"):
        return {"success": False, "message": "Separator must be one of: - . /"}, 400
    # Check duplicate
    existing = db.session.execute(db.text(
        "SELECT id FROM rawmaterial.rm_criteria WHERE series_prefix = :p AND tenant_id = :tid AND is_deleted = false"
    ), {"p": data["series_prefix"], "tid": tenant_id}).first()
    if existing:
        return {"success": False, "message": "Series prefix already exists"}, 409
    cid = str(uuid.uuid4())
    columns_config = data.get("columns_config", [])
    db.session.execute(db.text(
        "INSERT INTO rawmaterial.rm_criteria (id, material_category, sub_category, series_prefix, "
        "separator, number_format, description, columns_config, tenant_id) "
        "VALUES (:id, :cat, :sub, :prefix, :sep, :fmt, :desc, :cols, :tid)"
    ), {"id": cid, "cat": data["material_category"], "sub": data.get("sub_category", ""),
        "prefix": data["series_prefix"], "sep": separator,
        "fmt": data.get("number_format", "4"), "desc": data.get("description", ""),
        "cols": json.dumps(columns_config), "tid": tenant_id})
    _log_audit('CREATE', 'RM Criteria', cid)
    db.session.commit()
    return {"success": True, "data": {"id": cid}, "message": "RM Code Criteria created"}, 201


@rawmaterial_bp.route("/criteria/<cid>", methods=["PUT"])
def update_criteria(cid):
    data = request.get_json()
    updates, params = [], {"id": cid}
    for f in ["material_category", "sub_category", "series_prefix", "separator", "number_format", "description", "is_active"]:
        if f in data:
            if f == "separator" and data[f] not in ("-", ".", "/"):
                return {"success": False, "message": "Separator must be one of: - . /"}, 400
            updates.append(f"{f}=:{f}")
            params[f] = data[f]
    if "columns_config" in data:
        updates.append("columns_config=:columns_config")
        params["columns_config"] = json.dumps(data["columns_config"])
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE rawmaterial.rm_criteria SET {', '.join(updates)} WHERE id=:id"), params)
    _log_audit('UPDATE', 'RM Criteria', cid)
    db.session.commit()
    return {"success": True, "message": "Criteria updated"}


@rawmaterial_bp.route("/criteria/<cid>", methods=["DELETE"])
def delete_criteria(cid):
    db.session.execute(db.text(
        "UPDATE rawmaterial.rm_criteria SET is_deleted=true, updated_at=NOW() WHERE id=:id"
    ), {"id": cid})
    _log_audit('DELETE', 'RM Criteria', cid)
    db.session.commit()
    return {"success": True, "message": "Criteria deleted"}


# ─── RM MASTER ───

@rawmaterial_bp.route("/master", methods=["GET"])
def list_rm_master():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    rows = db.session.execute(db.text(
        "SELECT id, rm_code, rm_description, material_category, sub_category, specification, "
        "unit, hsn_code, standard_size, weight_per_unit, reorder_level, notes, is_active, created_at, col_values "
        "FROM rawmaterial.rm_master WHERE tenant_id = :tid AND is_deleted = false "
        "ORDER BY created_at DESC"
    ), {"tid": tenant_id})
    items = [{"id": r[0], "rm_code": r[1], "rm_description": r[2], "material_category": r[3],
              "sub_category": r[4], "specification": r[5], "unit": r[6], "hsn_code": r[7],
              "standard_size": r[8], "weight_per_unit": float(r[9]) if r[9] else None,
              "reorder_level": float(r[10]) if r[10] else None, "notes": r[11],
              "is_active": r[12], "created_at": str(r[13]) if r[13] else None,
              "col_values": r[14]} for r in rows]
    return {"success": True, "data": items}


@rawmaterial_bp.route("/master", methods=["POST"])
def create_rm():
    data = request.get_json()
    tenant_id = request.headers.get("X-Tenant-ID", "")
    criteria_id = data.get("criteria_id")
    if not criteria_id:
        return {"success": False, "message": "criteria_id required to generate RM code"}, 400

    # Get criteria for code generation
    crit = db.session.execute(db.text(
        "SELECT id, series_prefix, separator, number_format, material_category, sub_category "
        "FROM rawmaterial.rm_criteria WHERE id = :id AND is_deleted = false"
    ), {"id": criteria_id}).first()
    if not crit:
        return {"success": False, "message": "Criteria not found"}, 404

    # Atomic sequence increment
    row = db.session.execute(db.text(
        "UPDATE rawmaterial.rm_criteria SET current_sequence = current_sequence + 1, updated_at = NOW() "
        "WHERE id = :id RETURNING current_sequence"
    ), {"id": criteria_id}).first()
    seq = row[0] if row else 1
    fmt_len = int(crit[3]) if crit[3] else 4
    sep = crit[2] or "-"
    prefix = crit[1]

    # Build RM code: PREFIX{sep}SEQUENCE
    rm_code = f"{prefix}{sep}{str(seq).zfill(fmt_len)}"

    rm_id = str(uuid.uuid4())
    created_by = request.headers.get('X-User-Name', '') or request.headers.get('X-User-Email', '')
    col_values = data.get("col_values", {})
    db.session.execute(db.text(
        "INSERT INTO rawmaterial.rm_master (id, rm_code, rm_description, material_category, sub_category, "
        "specification, unit, hsn_code, standard_size, weight_per_unit, reorder_level, notes, "
        "col_values, tenant_id, created_by) "
        "VALUES (:id, :code, :desc, :cat, :sub, :spec, :unit, :hsn, :size, :weight, :reorder, :notes, :cols, :tid, :cb)"
    ), {"id": rm_id, "code": rm_code, "desc": data.get("rm_description", ""),
        "cat": crit[4], "sub": crit[5] or "", "spec": data.get("specification", ""),
        "unit": data.get("unit", ""), "hsn": data.get("hsn_code", ""),
        "size": data.get("standard_size", ""), "weight": data.get("weight_per_unit") or None,
        "reorder": data.get("reorder_level") or None, "notes": data.get("notes", ""),
        "cols": json.dumps(col_values), "tid": tenant_id, "cb": created_by})
    _log_audit('CREATE', 'Raw Material', rm_code)
    db.session.commit()
    return {"success": True, "data": {"id": rm_id, "rm_code": rm_code}, "message": "Raw Material created"}, 201


@rawmaterial_bp.route("/master/<rm_id>", methods=["PUT"])
def update_rm(rm_id):
    data = request.get_json()
    updates, params = [], {"id": rm_id}
    for f in ["rm_description", "specification", "unit", "hsn_code", "standard_size",
              "weight_per_unit", "reorder_level", "notes", "is_active"]:
        if f in data:
            updates.append(f"{f}=:{f}")
            params[f] = data[f] if data[f] != "" else None
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE rawmaterial.rm_master SET {', '.join(updates)} WHERE id=:id"), params)
    _log_audit('UPDATE', 'Raw Material', rm_id)
    db.session.commit()
    return {"success": True, "message": "Raw Material updated"}


@rawmaterial_bp.route("/master/<rm_id>", methods=["DELETE"])
def delete_rm(rm_id):
    db.session.execute(db.text(
        "UPDATE rawmaterial.rm_master SET is_deleted=true, updated_at=NOW() WHERE id=:id"
    ), {"id": rm_id})
    _log_audit('DELETE', 'Raw Material', rm_id)
    db.session.commit()
    return {"success": True, "message": "Raw Material deleted"}


@rawmaterial_bp.route("/search-rm", methods=["GET"])
def search_rm():
    """Search RM by code or description."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    q = request.args.get("q", "").strip()
    if not q or len(q) < 2:
        return {"success": True, "data": []}
    rows = db.session.execute(db.text(
        "SELECT id, rm_code, rm_description, unit FROM rawmaterial.rm_master "
        "WHERE tenant_id = :tid AND is_deleted = false AND is_active = true "
        "AND (LOWER(rm_code) LIKE LOWER(:q) OR LOWER(rm_description) LIKE LOWER(:q)) "
        "ORDER BY rm_code LIMIT 20"
    ), {"tid": tenant_id, "q": f"%{q}%"})
    items = [{"id": r[0], "rm_code": r[1], "rm_description": r[2], "unit": r[3]} for r in rows]
    return {"success": True, "data": items}


# ─── RM-PART MAPPING ───

@rawmaterial_bp.route("/part-mappings", methods=["GET"])
def list_part_mappings():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    rows = db.session.execute(db.text(
        "SELECT id, rm_code, rm_description, part_number, part_description, "
        "quantity_required, unit, wastage_percent, effective_quantity, process_notes, created_at "
        "FROM rawmaterial.rm_part_mapping WHERE tenant_id = :tid AND is_deleted = false "
        "ORDER BY created_at DESC"
    ), {"tid": tenant_id})
    items = [{"id": r[0], "rm_code": r[1], "rm_description": r[2], "part_number": r[3],
              "part_description": r[4], "quantity_required": float(r[5]) if r[5] else None,
              "unit": r[6], "wastage_percent": float(r[7]) if r[7] else None,
              "effective_quantity": float(r[8]) if r[8] else None,
              "process_notes": r[9], "created_at": str(r[10]) if r[10] else None} for r in rows]
    return {"success": True, "data": items}


@rawmaterial_bp.route("/part-mappings", methods=["POST"])
def create_part_mapping():
    data = request.get_json()
    tenant_id = request.headers.get("X-Tenant-ID", "")
    if not data.get("rm_code") or not data.get("part_number"):
        return {"success": False, "message": "RM Code and Part Number required"}, 400
    # Check duplicate
    existing = db.session.execute(db.text(
        "SELECT id FROM rawmaterial.rm_part_mapping WHERE rm_code = :rm AND part_number = :pn "
        "AND tenant_id = :tid AND is_deleted = false"
    ), {"rm": data["rm_code"], "pn": data["part_number"], "tid": tenant_id}).first()
    if existing:
        return {"success": False, "message": "This RM-Part mapping already exists"}, 409

    qty = float(data.get("quantity_required", 0)) if data.get("quantity_required") else 0
    wastage = float(data.get("wastage_percent", 0)) if data.get("wastage_percent") else 0
    effective = qty * (1 + wastage / 100) if qty else 0

    mid = str(uuid.uuid4())
    created_by = request.headers.get('X-User-Name', '') or request.headers.get('X-User-Email', '')
    db.session.execute(db.text(
        "INSERT INTO rawmaterial.rm_part_mapping (id, rm_code, rm_description, part_number, part_description, "
        "quantity_required, unit, wastage_percent, effective_quantity, process_notes, tenant_id, created_by) "
        "VALUES (:id, :rm, :rmd, :pn, :pd, :qty, :unit, :wastage, :eff, :notes, :tid, :cb)"
    ), {"id": mid, "rm": data["rm_code"], "rmd": data.get("rm_description", ""),
        "pn": data["part_number"], "pd": data.get("part_description", ""),
        "qty": qty or None, "unit": data.get("unit", ""), "wastage": wastage or None,
        "eff": effective or None, "notes": data.get("process_notes", ""),
        "tid": tenant_id, "cb": created_by})
    _log_audit('CREATE', 'RM-Part Mapping', f"{data['rm_code']} -> {data['part_number']}")
    db.session.commit()
    return {"success": True, "data": {"id": mid}, "message": "RM-Part Mapping created"}, 201


@rawmaterial_bp.route("/part-mappings/<mid>", methods=["PUT"])
def update_part_mapping(mid):
    data = request.get_json()
    updates, params = [], {"id": mid}
    for f in ["rm_code", "rm_description", "part_number", "part_description",
              "quantity_required", "unit", "wastage_percent", "process_notes"]:
        if f in data:
            updates.append(f"{f}=:{f}")
            params[f] = data[f] if data[f] != "" else None
    # Recalculate effective_quantity
    if "quantity_required" in data or "wastage_percent" in data:
        qty = float(data.get("quantity_required", 0)) if data.get("quantity_required") else 0
        wastage = float(data.get("wastage_percent", 0)) if data.get("wastage_percent") else 0
        effective = qty * (1 + wastage / 100) if qty else 0
        updates.append("effective_quantity=:effective_quantity")
        params["effective_quantity"] = effective or None
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE rawmaterial.rm_part_mapping SET {', '.join(updates)} WHERE id=:id"), params)
    _log_audit('UPDATE', 'RM-Part Mapping', mid)
    db.session.commit()
    return {"success": True, "message": "Mapping updated"}


@rawmaterial_bp.route("/part-mappings/<mid>", methods=["DELETE"])
def delete_part_mapping(mid):
    db.session.execute(db.text(
        "UPDATE rawmaterial.rm_part_mapping SET is_deleted=true, updated_at=NOW() WHERE id=:id"
    ), {"id": mid})
    _log_audit('DELETE', 'RM-Part Mapping', mid)
    db.session.commit()
    return {"success": True, "message": "Mapping deleted"}


# ─── RM VENDORS ───

@rawmaterial_bp.route("/vendors", methods=["GET"])
def list_vendors():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    rows = db.session.execute(db.text(
        "SELECT id, rm_code, rm_description, vendor_name, vendor_code, price_per_unit, currency, "
        "moq, lead_time_days, payment_terms, is_preferred, last_purchase_date, rating, created_at "
        "FROM rawmaterial.rm_vendors WHERE tenant_id = :tid AND is_deleted = false "
        "ORDER BY created_at DESC"
    ), {"tid": tenant_id})
    items = [{"id": r[0], "rm_code": r[1], "rm_description": r[2], "vendor_name": r[3],
              "vendor_code": r[4], "price_per_unit": float(r[5]) if r[5] else None,
              "currency": r[6], "moq": float(r[7]) if r[7] else None,
              "lead_time_days": r[8], "payment_terms": r[9], "is_preferred": r[10],
              "last_purchase_date": str(r[11]) if r[11] else None,
              "rating": r[12], "created_at": str(r[13]) if r[13] else None} for r in rows]
    return {"success": True, "data": items}


@rawmaterial_bp.route("/vendors", methods=["POST"])
def create_vendor():
    data = request.get_json()
    tenant_id = request.headers.get("X-Tenant-ID", "")
    if not data.get("rm_code") or not data.get("vendor_name"):
        return {"success": False, "message": "RM Code and Vendor Name required"}, 400
    vid = str(uuid.uuid4())
    created_by = request.headers.get('X-User-Name', '') or request.headers.get('X-User-Email', '')
    db.session.execute(db.text(
        "INSERT INTO rawmaterial.rm_vendors (id, rm_code, rm_description, vendor_name, vendor_code, "
        "price_per_unit, currency, moq, lead_time_days, payment_terms, is_preferred, "
        "last_purchase_date, rating, tenant_id, created_by) "
        "VALUES (:id, :rm, :rmd, :vname, :vcode, :price, :curr, :moq, :lead, :terms, :pref, :lpd, :rating, :tid, :cb)"
    ), {"id": vid, "rm": data["rm_code"], "rmd": data.get("rm_description", ""),
        "vname": data["vendor_name"], "vcode": data.get("vendor_code", ""),
        "price": data.get("price_per_unit") or None, "curr": data.get("currency", "INR"),
        "moq": data.get("moq") or None, "lead": data.get("lead_time_days") or None,
        "terms": data.get("payment_terms", ""), "pref": data.get("is_preferred", False),
        "lpd": data.get("last_purchase_date") or None, "rating": data.get("rating") or None,
        "tid": tenant_id, "cb": created_by})
    _log_audit('CREATE', 'RM Vendor', f"{data['rm_code']} - {data['vendor_name']}")
    db.session.commit()
    return {"success": True, "data": {"id": vid}, "message": "RM Vendor added"}, 201


@rawmaterial_bp.route("/vendors/<vid>", methods=["PUT"])
def update_vendor(vid):
    data = request.get_json()
    updates, params = [], {"id": vid}
    for f in ["rm_code", "rm_description", "vendor_name", "vendor_code", "price_per_unit",
              "currency", "moq", "lead_time_days", "payment_terms", "is_preferred",
              "last_purchase_date", "rating"]:
        if f in data:
            updates.append(f"{f}=:{f}")
            params[f] = data[f] if data[f] != "" else None
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE rawmaterial.rm_vendors SET {', '.join(updates)} WHERE id=:id"), params)
    _log_audit('UPDATE', 'RM Vendor', vid)
    db.session.commit()
    return {"success": True, "message": "Vendor updated"}


@rawmaterial_bp.route("/vendors/<vid>", methods=["DELETE"])
def delete_vendor(vid):
    db.session.execute(db.text(
        "UPDATE rawmaterial.rm_vendors SET is_deleted=true, updated_at=NOW() WHERE id=:id"
    ), {"id": vid})
    _log_audit('DELETE', 'RM Vendor', vid)
    db.session.commit()
    return {"success": True, "message": "Vendor deleted"}


# ─── MY ACCESS ───

@rawmaterial_bp.route("/my-access", methods=["GET"])
def get_my_access():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    user_email = request.headers.get("X-User-Email", "")
    all_sections = ['overview', 'criteria', 'master', 'partmapping', 'vendors', 'inventory']
    if not user_email:
        return {"success": True, "data": {"role": "module_admin", "sections": all_sections}}
    user = db.session.execute(db.text(
        "SELECT id FROM iam.users WHERE email = :email AND tenant_id = :tid"
    ), {"email": user_email, "tid": tenant_id}).first()
    if not user:
        return {"success": True, "data": {"role": "module_admin", "sections": all_sections}}
    access = db.session.execute(db.text(
        "SELECT role, permissions FROM iam.module_access "
        "WHERE user_id = :uid AND module = 'Raw Material Management' AND tenant_id = :tid AND is_active = true"
    ), {"uid": user[0], "tid": tenant_id}).first()
    if not access:
        return {"success": True, "data": {"role": "module_admin", "sections": all_sections}}
    role = access[0]
    if role == 'module_admin':
        sections = all_sections
    elif role == 'editor':
        sections = ['overview', 'criteria', 'master', 'partmapping', 'vendors']
    else:
        sections = ['overview', 'master', 'vendors']
    return {"success": True, "data": {"role": role, "sections": sections}}

# ─── MODULE USER MANAGEMENT ───

@rawmaterial_bp.route("/users", methods=["GET"])
def list_module_users():
    """List users with access to Raw Material Management module."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    if not tenant_id or tenant_id == 'TEST':
        tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958'
    rows = db.session.execute(db.text(
        "SELECT ma.id, ma.user_id, ma.role, ma.permissions, ma.is_active, ma.created_at, "
        "u.email, u.first_name, u.last_name "
        "FROM iam.module_access ma JOIN iam.users u ON ma.user_id = u.id "
        "WHERE ma.module = 'Raw Material Management' "
        "AND (ma.tenant_id = :tid OR ma.tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR ma.tenant_id = 'TEST' OR ma.tenant_id = '' OR ma.tenant_id IS NULL) "
        "ORDER BY ma.created_at DESC"
    ), {"tid": tenant_id})
    items = [{
        "id": r[0], "user_id": r[1], "role": r[2], "permissions": r[3] or [],
        "is_active": r[4], "created_at": str(r[5]) if r[5] else None,
        "email": r[6], "first_name": r[7] or '', "last_name": r[8] or ''
    } for r in rows]
    return {"success": True, "data": items}


@rawmaterial_bp.route("/users", methods=["POST"])
def add_module_user():
    """Grant a user access to Raw Material Management module."""
    import uuid
    data = request.get_json()
    tenant_id = request.headers.get("X-Tenant-ID", "")
    if not tenant_id or tenant_id == 'TEST':
        tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958'
    user_id = data.get("user_id")
    role = data.get("role", "viewer")
    permissions = data.get("permissions", [])

    if not user_id:
        return {"success": False, "message": "user_id required"}, 400

    user = db.session.execute(db.text(
        "SELECT id, email FROM iam.users WHERE id = :id AND is_deleted = false"
    ), {"id": user_id}).first()
    if not user:
        return {"success": False, "message": "User not found"}, 404

    existing = db.session.execute(db.text(
        "SELECT id FROM iam.module_access WHERE user_id = :uid AND module = 'Raw Material Management'"
    ), {"uid": user_id}).first()
    if existing:
        return {"success": False, "message": "User already has access to this module"}, 409

    access_id = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO iam.module_access (id, user_id, module, role, permissions, granted_by, tenant_id) "
        "VALUES (:id, :uid, 'Raw Material Management', :role, :perms, :granted_by, :tid)"
    ), {
        "id": access_id,
        "uid": user_id, "role": role,
        "perms": json.dumps(permissions),
        "granted_by": request.headers.get('X-User-Email', ''),
        "tid": tenant_id
    })
    db.session.commit()
    _log_audit('GRANT_ACCESS', 'Module User', user[1], details=f"Granted {role} role to {user[1]}", new_values={"email": user[1], "role": role, "permissions": permissions})
    return {"success": True, "message": f"Access granted to {user[1]}"}, 201


@rawmaterial_bp.route("/users/<access_id>", methods=["PUT"])
def update_module_user(access_id):
    """Update user's role/permissions in Raw Material Management."""
    data = request.get_json()
    updates = []
    params = {"id": access_id}
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
    old_acc = db.session.execute(db.text("SELECT u.email, ma.role, ma.permissions, ma.is_active FROM iam.module_access ma JOIN iam.users u ON ma.user_id = u.id WHERE ma.id=:id"), {"id": access_id}).first()
    old_values = {"email": old_acc[0], "role": old_acc[1], "permissions": json.loads(old_acc[2]) if isinstance(old_acc[2], str) else old_acc[2], "is_active": old_acc[3]} if old_acc else {}
    
    db.session.execute(db.text(
        f"UPDATE iam.module_access SET {', '.join(updates)} WHERE id=:id"
    ), params)
    
    new_values = {
        "email": old_values.get("email"),
        "role": data.get("role", old_values.get("role")),
        "permissions": data.get("permissions", old_values.get("permissions")),
        "is_active": data.get("is_active", old_values.get("is_active"))
    }
    
    _log_audit('UPDATE_ACCESS', 'Module User', old_values.get("email", access_id), details=f"Updated access for {old_values.get('email')}", old_values=old_values, new_values=new_values)
    db.session.commit()
    return {"success": True, "message": "Access updated"}


@rawmaterial_bp.route("/users/<access_id>", methods=["DELETE"])
def revoke_module_user(access_id):
    """Revoke user's access to Raw Material Management."""
    row = db.session.execute(db.text(
        "SELECT u.email FROM iam.module_access ma JOIN iam.users u ON ma.user_id = u.id WHERE ma.id = :id"
    ), {"id": access_id}).first()
    db.session.execute(db.text(
        "DELETE FROM iam.module_access WHERE id = :id"
    ), {"id": access_id})
    _log_audit('REVOKE_ACCESS', 'Module User', row[0] if row else access_id, details=f"Revoked access for {row[0] if row else access_id}")
    db.session.commit()
    return {"success": True, "message": "Access revoked"}


@rawmaterial_bp.route("/users/available", methods=["GET"])
def list_available_users():
    """List org users who don't yet have RM Management access."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    rows = db.session.execute(db.text(
        "SELECT u.id, u.email, u.first_name, u.last_name FROM iam.users u "
        "LEFT JOIN iam.module_access ma ON u.id = ma.user_id AND ma.module = 'Raw Material Management' "
        "WHERE u.is_deleted = false AND ma.id IS NULL AND u.tenant_id = :tid "
        "ORDER BY u.email"
    ), {"tid": tenant_id})
    items = [{"id": r[0], "email": r[1], "first_name": r[2] or '', "last_name": r[3] or ''} for r in rows]
    return {"success": True, "data": items}

# ─── AUDIT HELPER ───

def _log_audit(action, entity_type, entity_id, details='', old_values=None, new_values=None):
    try:
        forwarded = request.headers.get('X-Forwarded-For', '')
        ip = forwarded.split(',')[0].strip() if forwarded else (request.remote_addr or '')
        extra = {}
        if details:
            extra['details'] = details
        if old_values and new_values:
            extra['changes'] = {k: {'old': old_values.get(k), 'new': v}
                                for k, v in new_values.items() if old_values.get(k) != v}
        if old_values:
            extra['old'] = old_values
        if new_values:
            extra['new'] = new_values
        db.session.execute(db.text(
            "INSERT INTO audit.logs (id, action, module, entity_type, entity_id, ip_address, "
            "tenant_id, user_email, user_name, old_values, new_values, extra_data, created_at) "
            "VALUES (gen_random_uuid(), :action, 'Raw Material Management', :etype, :eid, :ip, "
            ":tid, :email, :name, :old_v, :new_v, :extra, NOW())"
        ), {
            "action": action, "etype": entity_type, "eid": str(entity_id),
            "ip": ip, "tid": request.headers.get('X-Tenant-ID', ''),
            "email": request.headers.get('X-User-Email', ''),
            "name": request.headers.get('X-User-Name', ''),
            "old_v": json.dumps(old_values) if old_values else None,
            "new_v": json.dumps(new_values) if new_values else None,
            "extra": json.dumps(extra) if extra else None
        })
    except Exception:
        pass
