from flask import Blueprint, request
from extensions import db
import uuid
import json

rawmaterial_bp = Blueprint("rawmaterial", __name__)


# ─── OVERVIEW / STATS ───

@rawmaterial_bp.route("/overview", methods=["GET"])
def rm_overview():
    tenant_id = request.headers.get("X-Tenant-ID", "")
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

    recent_logs = db.session.execute(db.text(
        "SELECT action, entity_type, entity_id, created_at FROM audit.logs "
        "WHERE module = 'Raw Material Management' AND tenant_id = :tid ORDER BY created_at DESC LIMIT 10"
    ), {"tid": tenant_id})
    recent_activity = [{"action": r[0], "entity_type": r[1], "entity_id": r[2],
                        "created_at": str(r[3]) if r[3] else None} for r in recent_logs]

    return {"success": True, "data": {
        "criteria": criteria_count, "raw_materials": rm_count,
        "active_rm": active_rm, "mappings": mapping_count,
        "vendors": vendor_count, "recent_activity": recent_activity
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


# ─── AUDIT HELPER ───

def _log_audit(action, entity_type, entity_id, details=''):
    try:
        from flask import request as req
        db.session.execute(db.text(
            "INSERT INTO audit.logs (id, action, module, entity_type, entity_id, ip_address, tenant_id, user_email, user_name, created_at) "
            "VALUES (gen_random_uuid(), :action, 'Raw Material Management', :etype, :eid, :ip, :tid, :email, :name, NOW())"
        ), {
            "action": action, "etype": entity_type, "eid": str(entity_id),
            "ip": req.remote_addr or '', "tid": req.headers.get('X-Tenant-ID', ''),
            "email": req.headers.get('X-User-Email', ''), "name": req.headers.get('X-User-Name', '')
        })
    except Exception:
        pass
