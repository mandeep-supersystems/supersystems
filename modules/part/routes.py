from flask import Blueprint, request
from extensions import db
import uuid
import re
import json

part_bp = Blueprint("part", __name__)


# ─── OVERVIEW / STATS ───

@part_bp.route("/overview", methods=["GET"])
def part_overview():
    """Dashboard stats for Part Management module."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    cat_count = db.session.execute(db.text(
        "SELECT COUNT(*) FROM part.categories WHERE tenant_id = :tid AND is_deleted = false"
    ), {"tid": tenant_id}).scalar() or 0
    sub_count = db.session.execute(db.text(
        "SELECT COUNT(*) FROM part.subcategories WHERE tenant_id = :tid AND is_deleted = false"
    ), {"tid": tenant_id}).scalar() or 0
    total_parts = db.session.execute(db.text(
        "SELECT COALESCE(SUM(current_sequence), 0) FROM part.subcategories WHERE tenant_id = :tid AND is_deleted = false"
    ), {"tid": tenant_id}).scalar() or 0

    # Count obsolete parts across all tables
    obsolete_count = 0
    subs = db.session.execute(db.text(
        "SELECT s.name, s.series_prefix, c.name as cat_name, c.series_prefix as cat_series "
        "FROM part.subcategories s JOIN part.categories c ON s.category_id = c.id "
        "WHERE s.tenant_id = :tid AND s.is_deleted = false"
    ), {"tid": tenant_id}).fetchall()
    for sub in subs:
        table_name = _safe_table_name(sub[2], sub[0], sub[3], sub[1])
        try:
            cnt = db.session.execute(db.text(
                f"SELECT COUNT(*) FROM {table_name} WHERE status = 'obsolete'"
            )).scalar() or 0
            obsolete_count += cnt
        except Exception:
            db.session.rollback()

    # Recent audit logs for this module
    recent_logs = db.session.execute(db.text(
        "SELECT action, entity_type, entity_id, created_at FROM audit.logs "
        "WHERE module = 'Part Management' AND tenant_id = :tid ORDER BY created_at DESC LIMIT 10"
    ), {"tid": tenant_id})
    recent_activity = [{"action": r[0], "entity_type": r[1], "entity_id": r[2],
                        "created_at": str(r[3]) if r[3] else None} for r in recent_logs]

    return {"success": True, "data": {
        "categories": cat_count, "subcategories": sub_count,
        "total_parts": total_parts, "obsolete_parts": obsolete_count,
        "active_parts": total_parts - obsolete_count,
        "recent_activity": recent_activity
    }}


@part_bp.route("/audit-logs", methods=["GET"])
def part_audit_logs():
    """Audit logs for Part Management module."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 50, type=int)
    offset = (page - 1) * limit
    rows = db.session.execute(db.text(
        "SELECT id, action, entity_type, entity_id, ip_address, created_at, user_email, user_name "
        "FROM audit.logs WHERE module = 'Part Management' AND tenant_id = :tid "
        "ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    ), {"tid": tenant_id, "limit": limit, "offset": offset})
    logs = [{"id": r[0], "action": r[1], "entity_type": r[2], "entity_id": r[3],
             "ip_address": r[4], "created_at": str(r[5]) if r[5] else None,
             "user_email": r[6] or '', "user_name": r[7] or ''} for r in rows]
    total = db.session.execute(db.text(
        "SELECT COUNT(*) FROM audit.logs WHERE module = 'Part Management' AND tenant_id = :tid"
    ), {"tid": tenant_id}).scalar() or 0
    return {"success": True, "data": {"items": logs, "total": total, "page": page}}


def _safe_table_name(category_name, subcategory_name, cat_series, sub_series):
    """Generate safe table name: part.\"{category}_{subcategory}_{cat_series}_{sub_series}\""""
    def clean(s):
        return re.sub(r'[^a-z0-9]', '_', s.lower().strip()).strip('_')
    tname = f"{clean(category_name)}_{clean(subcategory_name)}_{cat_series}_{sub_series}"
    return f'part."{tname}"'


def _generate_next_part_number(cat_series, sub_series, subcategory_id, separator='-'):
    """Generate next part: {cat_series}{sep}{sub_series}{sep}{6 digit seq} using atomic increment."""
    row = db.session.execute(db.text(
        "UPDATE part.subcategories SET current_sequence = current_sequence + 1, updated_at = NOW() "
        "WHERE id = :id RETURNING current_sequence"
    ), {"id": subcategory_id}).first()
    next_seq = row[0] if row else 1
    seq_str = str(next_seq).zfill(6)
    return f"{cat_series}{separator}{sub_series}{separator}{seq_str}"


def _build_description(columns_config, col_values, desc_columns, cat_name, sub_name):
    """Build description: category, subcategory, selected column values (comma separated)."""
    parts = [cat_name, sub_name]
    if desc_columns:
        for col_name in desc_columns:
            val = col_values.get(col_name, '')
            if val:
                parts.append(str(val).strip())
    return ', '.join(parts)


# ─── CATEGORIES ───

@part_bp.route("/categories", methods=["GET"])
def list_categories():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    rows = db.session.execute(db.text(
        "SELECT id, name, code, series_prefix, description, is_active, created_at, COALESCE(separator, '-') "
        "FROM part.categories WHERE tenant_id = :tid AND is_deleted = false ORDER BY created_at DESC"
    ), {"tid": tenant_id})
    items = [{"id": r[0], "name": r[1], "code": r[2], "series_prefix": r[3],
              "description": r[4], "is_active": r[5], "created_at": str(r[6]) if r[6] else None,
              "separator": r[7]} for r in rows]
    return {"success": True, "data": items}


@part_bp.route("/categories", methods=["POST"])
def create_category():
    data = request.get_json()
    if not data.get("name") or not data.get("series_prefix"):
        return {"success": False, "message": "Name and Series Prefix required"}, 400
    separator = data.get("separator", "-")
    if separator not in ("-", ".", "/"):
        separator = "-"
    cat_id = str(uuid.uuid4())
    tenant_id = request.headers.get("X-Tenant-ID", "")
    # Check duplicate series_prefix
    existing = db.session.execute(db.text(
        "SELECT id FROM part.categories WHERE series_prefix = :p AND tenant_id = :tid AND is_deleted = false"
    ), {"p": data["series_prefix"], "tid": tenant_id}).first()
    if existing:
        return {"success": False, "message": "Series prefix already exists"}, 409
    db.session.execute(db.text(
        "INSERT INTO part.categories (id, name, code, series_prefix, separator, description, tenant_id) "
        "VALUES (:id, :name, :code, :prefix, :sep, :desc, :tid)"
    ), {"id": cat_id, "name": data["name"], "code": data.get("code", data["name"][:3].upper()),
        "prefix": data["series_prefix"], "sep": separator, "desc": data.get("description", ""), "tid": tenant_id})
    _log_audit('CREATE', 'Category', cat_id)
    db.session.commit()
    return {"success": True, "data": {"id": cat_id}, "message": "Category created"}, 201


@part_bp.route("/categories/<cat_id>", methods=["PUT"])
def update_category(cat_id):
    data = request.get_json()
    updates = ["name=:name", "description=:desc", "updated_at=NOW()"]
    params = {"id": cat_id, "name": data.get("name", ""), "desc": data.get("description", "")}
    if "separator" in data:
        sep = data["separator"]
        if sep in ("-", ".", "/"):
            updates.append("separator=:sep")
            params["sep"] = sep
    db.session.execute(db.text(
        f"UPDATE part.categories SET {', '.join(updates)} WHERE id=:id"
    ), params)
    db.session.commit()
    return {"success": True, "message": "Category updated"}


@part_bp.route("/categories/<cat_id>", methods=["DELETE"])
def delete_category(cat_id):
    # Block if any subcategories exist
    sub_count = db.session.execute(db.text(
        "SELECT COUNT(*) FROM part.subcategories WHERE category_id = :cid AND is_deleted = false"
    ), {"cid": cat_id}).scalar() or 0
    if sub_count > 0:
        return {"success": False, "message": f"Cannot delete: {sub_count} subcategory(s) exist under this category. Delete all subcategories first."}, 409

    # Block if any parts exist across subcategories (even soft-deleted subs that still have tables)
    subs_all = db.session.execute(db.text(
        "SELECT s.name, s.series_prefix, c.name as cat_name, c.series_prefix as cat_series "
        "FROM part.subcategories s JOIN part.categories c ON s.category_id = c.id "
        "WHERE s.category_id = :cid"
    ), {"cid": cat_id}).fetchall()
    for sub in subs_all:
        table_name = _safe_table_name(sub[2], sub[0], sub[3], sub[1])
        try:
            part_count = db.session.execute(db.text(f"SELECT COUNT(*) FROM {table_name}")).scalar() or 0
            if part_count > 0:
                return {"success": False, "message": f"Cannot delete: parts exist in subcategory '{sub[0]}'. Delete all parts first."}, 409
        except Exception:
            db.session.rollback()

    db.session.execute(db.text(
        "UPDATE part.categories SET is_deleted=true WHERE id=:id"
    ), {"id": cat_id})
    _log_audit('DELETE', 'Category', cat_id)
    db.session.commit()
    return {"success": True, "message": "Category deleted"}


# ─── SUBCATEGORIES ───

@part_bp.route("/subcategories", methods=["GET"])
def list_subcategories():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    cat_id = request.args.get("category_id", "")
    where = "s.tenant_id = :tid AND s.is_deleted = false"
    params = {"tid": tenant_id}
    if cat_id:
        where += " AND s.category_id = :cid"
        params["cid"] = cat_id
    rows = db.session.execute(db.text(
        f"SELECT s.id, s.name, s.code, s.series_prefix, s.category_id, c.name as category_name, "
        f"c.series_prefix as cat_series, s.current_sequence, s.columns_config, s.description_columns "
        f"FROM part.subcategories s LEFT JOIN part.categories c ON s.category_id = c.id "
        f"WHERE {where} ORDER BY s.created_at DESC"
    ), params)
    items = [{"id": r[0], "name": r[1], "code": r[2], "series_prefix": r[3],
              "category_id": r[4], "category_name": r[5], "cat_series": r[6],
              "current_sequence": r[7], "columns_config": r[8],
              "description_columns": r[9] if r[9] else []} for r in rows]
    return {"success": True, "data": items}


@part_bp.route("/subcategories", methods=["POST"])
def create_subcategory():
    data = request.get_json()
    if not data.get("name") or not data.get("series_prefix") or not data.get("category_id"):
        return {"success": False, "message": "Name, Series Prefix, and Category required"}, 400
    if not data.get("columns") or not isinstance(data["columns"], list) or len(data["columns"]) == 0:
        return {"success": False, "message": "At least one column is required"}, 400

    sub_id = str(uuid.uuid4())
    tenant_id = request.headers.get("X-Tenant-ID", "")

    # Get category info
    cat = db.session.execute(db.text(
        "SELECT name, series_prefix FROM part.categories WHERE id = :id AND is_deleted = false"
    ), {"id": data["category_id"]}).first()
    if not cat:
        return {"success": False, "message": "Category not found"}, 404

    cat_name, cat_series = cat[0], cat[1]
    sub_series = data["series_prefix"]

    # Check duplicate series_prefix within same category
    existing = db.session.execute(db.text(
        "SELECT id FROM part.subcategories WHERE series_prefix = :p AND category_id = :cid AND is_deleted = false"
    ), {"p": sub_series, "cid": data["category_id"]}).first()
    if existing:
        return {"success": False, "message": "Series prefix already exists in this category"}, 409

    columns_config = data["columns"]  # [{name: "thickness", type: "varchar", label: "Thickness"}, ...]
    description_columns = data.get("description_columns", [])  # columns to concat for description

    # Create subcategory record
    db.session.execute(db.text(
        "INSERT INTO part.subcategories (id, name, code, series_prefix, category_id, tenant_id, "
        "current_sequence, columns_config, description_columns) "
        "VALUES (:id, :name, :code, :prefix, :cat_id, :tid, 0, :cols, :desc_cols)"
    ), {"id": sub_id, "name": data["name"], "code": data.get("code", data["name"][:3].upper()),
        "prefix": sub_series, "cat_id": data["category_id"], "tid": tenant_id,
        "cols": json.dumps(columns_config), "desc_cols": json.dumps(description_columns)})

    # Create dynamic table with auto description and created_by columns
    table_name = _safe_table_name(cat_name, data["name"], cat_series, sub_series)
    col_defs = ["id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
                "part_number VARCHAR(50) NOT NULL UNIQUE",
                "description TEXT DEFAULT ''",
                "created_by VARCHAR(200) DEFAULT ''",
                "is_bought_out BOOLEAN DEFAULT true",
                "is_manufactured BOOLEAN DEFAULT false",
                "status VARCHAR(20) DEFAULT 'active'",
                "obsoleted_at TIMESTAMP",
                "obsolete_reason TEXT",
                "created_at TIMESTAMP DEFAULT NOW()"]
    for col in columns_config:
        col_name = re.sub(r'[^a-z0-9_]', '_', col["name"].lower().strip())
        col_type = col.get("type", "varchar").upper()
        if col_type in ("VARCHAR", "TEXT", "INTEGER", "NUMERIC", "BOOLEAN", "DATE", "TIMESTAMP"):
            col_defs.append(f"{col_name} {col_type}")
        else:
            col_defs.append(f"{col_name} VARCHAR(500)")

    create_sql = f"CREATE TABLE IF NOT EXISTS {table_name} ({', '.join(col_defs)})"
    db.session.execute(db.text(create_sql))
    _log_audit('CREATE', 'Subcategory', sub_id)
    db.session.commit()
    return {"success": True, "data": {"id": sub_id, "table_name": table_name}, "message": "Subcategory created"}, 201


@part_bp.route("/subcategories/<sub_id>", methods=["PUT"])
def update_subcategory(sub_id):
    data = request.get_json()
    updates = []
    params = {"id": sub_id}
    if "name" in data:
        updates.append("name=:name")
        params["name"] = data["name"]
    if "code" in data:
        updates.append("code=:code")
        params["code"] = data["code"]
    if "series_prefix" in data:
        updates.append("series_prefix=:series_prefix")
        params["series_prefix"] = data["series_prefix"]
    if "category_id" in data:
        updates.append("category_id=:category_id")
        params["category_id"] = data["category_id"]
    if "columns" in data:
        updates.append("columns_config=:columns_config")
        params["columns_config"] = json.dumps(data["columns"])
    if "description_columns" in data:
        updates.append("description_columns=:description_columns")
        params["description_columns"] = json.dumps(data["description_columns"])
    if not updates:
        return {"success": False, "message": "No fields to update"}, 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(
        f"UPDATE part.subcategories SET {', '.join(updates)} WHERE id=:id"
    ), params)
    _log_audit('UPDATE', 'Subcategory', sub_id)
    db.session.commit()
    return {"success": True, "message": "Subcategory updated"}


@part_bp.route("/subcategories/<sub_id>", methods=["DELETE"])
def delete_subcategory(sub_id):
    row = db.session.execute(db.text(
        "SELECT s.name, s.series_prefix, c.name as cat_name, c.series_prefix as cat_series "
        "FROM part.subcategories s JOIN part.categories c ON s.category_id = c.id "
        "WHERE s.id = :id"
    ), {"id": sub_id}).first()
    if not row:
        return {"success": False, "message": "Subcategory not found"}, 404

    # Block if any parts exist in the dynamic table
    table_name = _safe_table_name(row[2], row[0], row[3], row[1])
    try:
        part_count = db.session.execute(db.text(f"SELECT COUNT(*) FROM {table_name}")).scalar() or 0
        if part_count > 0:
            return {"success": False, "message": f"Cannot delete: {part_count} part(s) exist in this subcategory. Delete or obsolete all parts first."}, 409
    except Exception:
        db.session.rollback()

    db.session.execute(db.text(
        "UPDATE part.subcategories SET is_deleted=true WHERE id=:id"
    ), {"id": sub_id})
    _log_audit('DELETE', 'Subcategory', sub_id)
    db.session.commit()
    return {"success": True, "message": "Subcategory deleted"}


# ─── GENERATE PART CODE ───

@part_bp.route("/generate", methods=["POST"])
def generate_part():
    """Generate next part number and insert into dynamic table."""
    data = request.get_json()
    subcategory_id = data.get("subcategory_id")
    if not subcategory_id:
        return {"success": False, "message": "subcategory_id required"}, 400

    # Get subcategory + category info
    row = db.session.execute(db.text(
        "SELECT s.id, s.name, s.series_prefix, s.columns_config, s.current_sequence, "
        "c.name as cat_name, c.series_prefix as cat_series, s.description_columns, "
        "COALESCE(c.separator, '-') as cat_separator "
        "FROM part.subcategories s JOIN part.categories c ON s.category_id = c.id "
        "WHERE s.id = :id AND s.is_deleted = false"
    ), {"id": subcategory_id}).first()
    if not row:
        return {"success": False, "message": "Subcategory not found"}, 404

    sub_name, sub_series = row[1], row[2]
    columns_config = row[3] if isinstance(row[3], list) else (json.loads(row[3]) if row[3] else [])
    cat_name, cat_series = row[5], row[6]
    desc_columns = row[7] if isinstance(row[7], list) else (json.loads(row[7]) if row[7] else [])
    separator = row[8] if row[8] else '-'

    table_name = _safe_table_name(cat_name, sub_name, cat_series, sub_series)
    col_values = data.get("values", {})

    # Build description from selected columns (includes category, subcategory)
    description = _build_description(columns_config, col_values, desc_columns, cat_name, sub_name)

    # Ensure all required columns exist (for tables created before these features were added)
    try:
        db.session.execute(db.text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''"))
        db.session.execute(db.text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS created_by VARCHAR(200) DEFAULT ''"))
        db.session.execute(db.text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS is_bought_out BOOLEAN DEFAULT true"))
        db.session.execute(db.text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS is_manufactured BOOLEAN DEFAULT false"))
        db.session.execute(db.text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'"))
        db.session.execute(db.text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS obsoleted_at TIMESTAMP"))
        db.session.execute(db.text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS obsolete_reason TEXT"))
        db.session.commit()
    except Exception:
        db.session.rollback()

    # Duplicate check: same description = same part (one code per description)
    if description:
        try:
            dup = db.session.execute(db.text(
                f"SELECT part_number FROM {table_name} "
                f"WHERE LOWER(description) = LOWER(:desc) AND status = 'active' LIMIT 1"
            ), {"desc": description}).first()
            if dup:
                return {"success": False, "message": f"Part already exists: {dup[0]}",
                        "data": {"existing_part": dup[0], "description": description}}, 409
        except Exception:
            db.session.rollback()

    # Generate part number (atomic)
    part_number = _generate_next_part_number(cat_series, sub_series, subcategory_id, separator)

    # Insert into dynamic table
    created_by = request.headers.get('X-User-Name', '') or request.headers.get('X-User-Email', '')
    is_bought_out = bool(data.get("is_bought_out", True))
    is_manufactured = bool(data.get("is_manufactured", False))
    if not is_bought_out and not is_manufactured:
        is_bought_out = True  # default fallback

    col_names = ["part_number", "description", "created_by", "is_bought_out", "is_manufactured"]
    col_placeholders = [":part_number", ":description", ":created_by", ":is_bought_out", ":is_manufactured"]
    params = {"part_number": part_number, "description": description, "created_by": created_by,
              "is_bought_out": is_bought_out, "is_manufactured": is_manufactured}

    for col in columns_config:
        col_name = re.sub(r'[^a-z0-9_]', '_', col["name"].lower().strip())
        if col_name in col_values:
            col_names.append(col_name)
            col_placeholders.append(f":{col_name}")
            params[col_name] = col_values[col_name]

    insert_sql = f"INSERT INTO {table_name} ({', '.join(col_names)}) VALUES ({', '.join(col_placeholders)})"
    db.session.execute(db.text(insert_sql), params)

    _log_audit('GENERATE', 'Part', part_number)
    db.session.commit()
    return {"success": True, "data": {"part_number": part_number, "description": description,
            "is_bought_out": is_bought_out, "is_manufactured": is_manufactured, "table": table_name}}


# ─── ALL PARTS (latest 100 across all subcategories, filterable) ───

@part_bp.route("/all-parts", methods=["GET"])
def list_all_parts():
    """List latest 100 parts across all (or filtered) subcategories."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    category_id = request.args.get("category_id", "")
    subcategory_id = request.args.get("subcategory_id", "")

    where = "s.tenant_id = :tid AND s.is_deleted = false"
    params = {"tid": tenant_id}
    if subcategory_id:
        where += " AND s.id = :sid"
        params["sid"] = subcategory_id
    elif category_id:
        where += " AND s.category_id = :cid"
        params["cid"] = category_id

    subs = db.session.execute(db.text(
        f"SELECT s.id, s.name, s.series_prefix, s.columns_config, c.name as cat_name, c.series_prefix as cat_series "
        f"FROM part.subcategories s JOIN part.categories c ON s.category_id = c.id "
        f"WHERE {where}"
    ), params).fetchall()

    all_parts = []
    for sub in subs:
        table_name = _safe_table_name(sub[4], sub[1], sub[5], sub[2])
        try:
            result = db.session.execute(db.text(
                f"SELECT part_number, description, status, created_at, "
                f"COALESCE(created_by, '') as created_by FROM {table_name} ORDER BY created_at DESC LIMIT 100"
            ))
            for r in result:
                all_parts.append({
                    "part_number": r[0], "description": r[1] or '',
                    "status": r[2] or 'active', "created_at": str(r[3]) if r[3] else None,
                    "created_by": r[4] or '', "category": sub[4], "subcategory": sub[1]
                })
        except Exception:
            db.session.rollback()
            continue

    # Sort by created_at desc and limit to 100
    all_parts.sort(key=lambda x: x['created_at'] or '', reverse=True)
    return {"success": True, "data": all_parts[:100]}


# ─── LIST PARTS IN A SUBCATEGORY ───

@part_bp.route("/parts/<subcategory_id>", methods=["GET"])
def list_parts_in_subcategory(subcategory_id):
    """List all parts from the dynamic table of a subcategory."""
    row = db.session.execute(db.text(
        "SELECT s.name, s.series_prefix, s.columns_config, c.name as cat_name, c.series_prefix as cat_series "
        "FROM part.subcategories s JOIN part.categories c ON s.category_id = c.id "
        "WHERE s.id = :id AND s.is_deleted = false"
    ), {"id": subcategory_id}).first()
    if not row:
        return {"success": False, "message": "Subcategory not found"}, 404

    table_name = _safe_table_name(row[3], row[0], row[4], row[1])
    try:
        # Check if status column exists
        has_status = False
        try:
            db.session.execute(db.text(f"SELECT status FROM {table_name} LIMIT 0"))
            has_status = True
        except Exception:
            db.session.rollback()

        result = db.session.execute(db.text(f"SELECT * FROM {table_name} ORDER BY created_at DESC LIMIT 100"))
        columns = result.keys()
        items = [dict(zip(columns, r)) for r in result]
        for item in items:
            for k, v in item.items():
                if hasattr(v, 'isoformat'):
                    item[k] = v.isoformat()
                elif isinstance(v, uuid.UUID):
                    item[k] = str(v)
            if not has_status:
                item['status'] = 'active'
        return {"success": True, "data": items}
    except Exception as e:
        return {"success": False, "message": f"Table error: {str(e)}"}, 500


# ─── OBSOLETE PART ───

@part_bp.route("/obsolete", methods=["POST"])
def obsolete_part():
    """Mark a part as obsolete in its dynamic table."""
    data = request.get_json()
    subcategory_id = data.get("subcategory_id")
    part_number = data.get("part_number")
    reason = data.get("reason", "Marked obsolete by user")

    if not subcategory_id or not part_number:
        return {"success": False, "message": "subcategory_id and part_number required"}, 400

    row = db.session.execute(db.text(
        "SELECT s.name, s.series_prefix, c.name as cat_name, c.series_prefix as cat_series "
        "FROM part.subcategories s JOIN part.categories c ON s.category_id = c.id "
        "WHERE s.id = :id AND s.is_deleted = false"
    ), {"id": subcategory_id}).first()
    if not row:
        return {"success": False, "message": "Subcategory not found"}, 404

    table_name = _safe_table_name(row[2], row[0], row[3], row[1])

    # Add status column if not exists
    try:
        db.session.execute(db.text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'"))
        db.session.execute(db.text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS obsoleted_at TIMESTAMP"))
        db.session.execute(db.text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS obsolete_reason TEXT"))
    except Exception:
        pass

    db.session.execute(db.text(
        f"UPDATE {table_name} SET status = 'obsolete', obsoleted_at = NOW(), obsolete_reason = :reason "
        f"WHERE part_number = :pn"
    ), {"pn": part_number, "reason": reason})

    # Audit log
    _log_audit('OBSOLETE', 'Part', part_number, f'Part {part_number} marked obsolete')
    db.session.commit()
    return {"success": True, "message": f"Part {part_number} marked as obsolete"}


@part_bp.route("/obsolete-parts", methods=["GET"])
def list_obsolete_parts():
    """List all obsolete parts across all subcategories."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    subs = db.session.execute(db.text(
        "SELECT s.id, s.name, s.series_prefix, c.name as cat_name, c.series_prefix as cat_series "
        "FROM part.subcategories s JOIN part.categories c ON s.category_id = c.id "
        "WHERE s.tenant_id = :tid AND s.is_deleted = false"
    ), {"tid": tenant_id}).fetchall()

    all_obsolete = []
    for sub in subs:
        table_name = _safe_table_name(sub[3], sub[1], sub[4], sub[2])
        try:
            result = db.session.execute(db.text(
                f"SELECT part_number, obsoleted_at, obsolete_reason FROM {table_name} WHERE status = 'obsolete' ORDER BY obsoleted_at DESC"
            ))
            for r in result:
                all_obsolete.append({
                    "part_number": r[0],
                    "category": sub[3],
                    "subcategory": sub[1],
                    "obsoleted_at": str(r[1]) if r[1] else None,
                    "reason": r[2]
                })
        except Exception:
            db.session.rollback()
            continue

    return {"success": True, "data": all_obsolete}


# ─── MODULE USER MANAGEMENT ───

@part_bp.route("/users", methods=["GET"])
def list_module_users():
    """List users with access to Part Management module."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    if not tenant_id or tenant_id == 'TEST':
        tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958'
    rows = db.session.execute(db.text(
        "SELECT ma.id, ma.user_id, ma.role, ma.permissions, ma.is_active, ma.created_at, "
        "u.email, u.first_name, u.last_name "
        "FROM iam.module_access ma JOIN iam.users u ON ma.user_id = u.id "
        "WHERE ma.module = 'Part Management' "
        "AND (ma.tenant_id = :tid OR ma.tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR ma.tenant_id = 'TEST' OR ma.tenant_id = '' OR ma.tenant_id IS NULL) "
        "ORDER BY ma.created_at DESC"
    ), {"tid": tenant_id})
    items = [{
        "id": r[0], "user_id": r[1], "role": r[2], "permissions": r[3] or [],
        "is_active": r[4], "created_at": str(r[5]) if r[5] else None,
        "email": r[6], "first_name": r[7] or '', "last_name": r[8] or ''
    } for r in rows]
    return {"success": True, "data": items}


@part_bp.route("/users", methods=["POST"])
def add_module_user():
    """Grant a user access to Part Management module."""
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

    # Check user exists
    user = db.session.execute(db.text(
        "SELECT id, email FROM iam.users WHERE id = :id AND is_deleted = false"
    ), {"id": user_id}).first()
    if not user:
        return {"success": False, "message": "User not found"}, 404

    # Check if already has access
    existing = db.session.execute(db.text(
        "SELECT id FROM iam.module_access WHERE user_id = :uid AND module = 'Part Management'"
    ), {"uid": user_id}).first()
    if existing:
        return {"success": False, "message": "User already has access to this module"}, 409

    access_id = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO iam.module_access (id, user_id, module, role, permissions, granted_by, tenant_id) "
        "VALUES (:id, :uid, 'Part Management', :role, :perms, :granted_by, :tid)"
    ), {
        "id": access_id,
        "uid": user_id, "role": role,
        "perms": json.dumps(permissions),
        "granted_by": request.headers.get('X-User-Email', ''),
        "tid": tenant_id
    })
    db.session.commit()
    _log_audit('GRANT_ACCESS', 'Module User', user[1], f'Role: {role}')
    return {"success": True, "message": f"Access granted to {user[1]}"}, 201


@part_bp.route("/users/<access_id>", methods=["PUT"])
def update_module_user(access_id):
    """Update user's role/permissions in Part Management."""
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
    db.session.execute(db.text(
        f"UPDATE iam.module_access SET {', '.join(updates)} WHERE id=:id"
    ), params)
    db.session.commit()
    _log_audit('UPDATE_ACCESS', 'Module User', access_id)
    return {"success": True, "message": "Access updated"}


@part_bp.route("/users/<access_id>", methods=["DELETE"])
def revoke_module_user(access_id):
    """Revoke user's access to Part Management."""
    row = db.session.execute(db.text(
        "SELECT u.email FROM iam.module_access ma JOIN iam.users u ON ma.user_id = u.id WHERE ma.id = :id"
    ), {"id": access_id}).first()
    db.session.execute(db.text(
        "DELETE FROM iam.module_access WHERE id = :id"
    ), {"id": access_id})
    _log_audit('REVOKE_ACCESS', 'Module User', row[0] if row else access_id)
    db.session.commit()
    return {"success": True, "message": "Access revoked"}


@part_bp.route("/users/available", methods=["GET"])
def list_available_users():
    """List org users who don't yet have Part Management access."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    rows = db.session.execute(db.text(
        "SELECT u.id, u.email, u.first_name, u.last_name FROM iam.users u "
        "WHERE u.tenant_id = :tid AND u.is_deleted = false AND u.is_active = true "
        "AND u.id NOT IN (SELECT user_id FROM iam.module_access WHERE module = 'Part Management' AND tenant_id = :tid) "
        "ORDER BY u.email"
    ), {"tid": tenant_id})
    items = [{"id": r[0], "email": r[1], "first_name": r[2] or '', "last_name": r[3] or ''} for r in rows]
    return {"success": True, "data": items}


@part_bp.route("/check-permission", methods=["POST"])
def check_permission():
    """Check if current user has permission for an action in Part Management."""
    data = request.get_json()
    tenant_id = request.headers.get("X-Tenant-ID", "")
    user_email = request.headers.get("X-User-Email", "")
    action = data.get("action", "")

    if not user_email:
        return {"success": True, "data": {"allowed": True}}  # No auth enforced yet

    # Find user
    user = db.session.execute(db.text(
        "SELECT id FROM iam.users WHERE email = :email AND tenant_id = :tid"
    ), {"email": user_email, "tid": tenant_id}).first()
    if not user:
        return {"success": True, "data": {"allowed": True}}

    # Check module access
    access = db.session.execute(db.text(
        "SELECT role, permissions FROM iam.module_access "
        "WHERE user_id = :uid AND module = 'Part Management' AND tenant_id = :tid AND is_active = true"
    ), {"uid": user[0], "tid": tenant_id}).first()

    if not access:
        return {"success": True, "data": {"allowed": False, "reason": "No module access"}}

    role = access[0]
    permissions = access[1] or []

    # Role hierarchy: module_admin > editor > viewer
    role_actions = {
        "module_admin": ["view", "create", "edit", "delete", "export", "import", "manage_users"],
        "editor": ["view", "create", "edit", "export", "import"],
        "viewer": ["view", "export"]
    }

    allowed_actions = role_actions.get(role, []) + permissions
    allowed = action in allowed_actions

    return {"success": True, "data": {"allowed": allowed, "role": role}}


@part_bp.route("/my-access", methods=["GET"])
def get_my_access():
    """Get current user's allowed sections in Part Management."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    user_email = request.headers.get("X-User-Email", "")

    # All sections available
    all_sections = ['overview', 'categories', 'subcategories', 'generate', 'allparts', 'partmapping', 'auditlogs', 'obsolete', 'moduleusers']

    if not user_email:
        return {"success": True, "data": {"role": "module_admin", "sections": all_sections}}

    user = db.session.execute(db.text(
        "SELECT id FROM iam.users WHERE email = :email AND tenant_id = :tid"
    ), {"email": user_email, "tid": tenant_id}).first()
    if not user:
        return {"success": True, "data": {"role": "module_admin", "sections": all_sections}}

    access = db.session.execute(db.text(
        "SELECT role, permissions FROM iam.module_access "
        "WHERE user_id = :uid AND module = 'Part Management' AND tenant_id = :tid AND is_active = true"
    ), {"uid": user[0], "tid": tenant_id}).first()

    if not access:
        # Check if super admin via JWT
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            try:
                import base64
                token = auth_header.split(' ')[1]
                payload_b64 = token.split('.')[1]
                payload_b64 += '=' * (4 - len(payload_b64) % 4)
                payload = json.loads(base64.b64decode(payload_b64))
                sub = payload.get('sub', '{}')
                identity = json.loads(sub) if isinstance(sub, str) else sub
                if identity.get('is_super_admin'):
                    return {"success": True, "data": {"role": "module_admin", "sections": all_sections, "entity_permissions": {}}}
            except Exception:
                pass
        return {"success": True, "data": {"role": "none", "sections": []}}

    role = access[0]
    perms = access[1]

    # Parse permissions - can be JSONB object or list
    if isinstance(perms, str):
        try:
            perms = json.loads(perms)
        except Exception:
            perms = {}
    if perms is None:
        perms = {}

    # If permissions has 'sections' key, use it; otherwise role-based defaults
    if isinstance(perms, dict) and 'sections' in perms:
        sections = perms['sections']
        entity_permissions = perms.get('entity_permissions', {})
    elif role == 'module_admin':
        sections = all_sections
        entity_permissions = {}
    elif role == 'editor':
        sections = ['overview', 'categories', 'subcategories', 'generate', 'allparts', 'partmapping', 'auditlogs', 'obsolete']
        entity_permissions = {}
    else:  # viewer
        sections = ['overview', 'allparts', 'obsolete']
        entity_permissions = {}

    return {"success": True, "data": {"role": role, "sections": sections, "entity_permissions": entity_permissions}}


# ─── LOG ACTION (for export/import/template audit) ───

@part_bp.route("/log-action", methods=["POST"])
def log_action():
    data = request.get_json()
    action = data.get("action", "UNKNOWN")
    entity_type = data.get("entity_type", "")
    entity_id = data.get("entity_id", "")
    _log_audit(action, entity_type, entity_id)
    db.session.commit()
    return {"success": True}


# ─── PART MAPPING (Cross-Reference) ───

@part_bp.route("/mappings", methods=["GET"])
def list_mappings():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    rows = db.session.execute(db.text(
        "SELECT id, internal_part_number, internal_description, customer_part_number, "
        "customer_description, organization_id, organization_name, created_at, created_by "
        "FROM part.customer_mappings WHERE (tenant_id = :tid OR tenant_id IS NULL) AND is_deleted = false "
        "ORDER BY created_at DESC"
    ), {"tid": tenant_id})
    items = [{"id": r[0], "internal_part_number": r[1], "internal_description": r[2] or '',
              "customer_part_number": r[3], "customer_description": r[4] or '',
              "organization_id": r[5] or '', "organization_name": r[6] or '',
              "created_at": str(r[7]) if r[7] else None, "created_by": r[8] or ''} for r in rows]
    return {"success": True, "data": items}


@part_bp.route("/mappings", methods=["POST"])
def create_mapping():
    data = request.get_json()
    tenant_id = request.headers.get("X-Tenant-ID", "")
    if not data.get("internal_part_number") or not data.get("customer_part_number"):
        return {"success": False, "message": "Both internal and customer part numbers are required"}, 400
    # Check duplicate
    existing = db.session.execute(db.text(
        "SELECT id FROM part.customer_mappings WHERE internal_part_number = :ipn AND customer_part_number = :cpn "
        "AND is_deleted = false AND (tenant_id = :tid OR tenant_id IS NULL)"
    ), {"ipn": data["internal_part_number"], "cpn": data["customer_part_number"], "tid": tenant_id}).first()
    if existing:
        return {"success": False, "message": "This mapping already exists"}, 409
    created_by = request.headers.get('X-User-Name', '') or request.headers.get('X-User-Email', '')
    db.session.execute(db.text(
        "INSERT INTO part.customer_mappings (internal_part_number, internal_description, "
        "customer_part_number, customer_description, organization_id, organization_name, tenant_id, created_by) "
        "VALUES (:ipn, :idesc, :cpn, :cdesc, :oid, :oname, :tid, :cb)"
    ), {
        "ipn": data["internal_part_number"], "idesc": data.get("internal_description", ""),
        "cpn": data["customer_part_number"], "cdesc": data.get("customer_description", ""),
        "oid": data.get("organization_id", ""), "oname": data.get("organization_name", ""),
        "tid": tenant_id, "cb": created_by
    })
    # Auto-sync: update PO lines that have this customer_part_number
    cpn = data["customer_part_number"]
    ipn = data["internal_part_number"]
    idesc = data.get("internal_description", "")
    po_rows = db.session.execute(db.text(
        "SELECT id, lines FROM procurement.purchase_orders "
        "WHERE (tenant_id = :tid OR tenant_id IS NULL) AND is_deleted = false AND lines IS NOT NULL"
    ), {"tid": tenant_id})
    for row in po_rows:
        lines = row[1] if isinstance(row[1], list) else json.loads(row[1]) if row[1] else []
        changed = False
        for line in lines:
            if line.get("customer_part_number", "").lower() == cpn.lower():
                line["internal_part_number"] = ipn
                line["internal_description"] = idesc
                changed = True
        if changed:
            db.session.execute(db.text(
                "UPDATE procurement.purchase_orders SET lines=:lines, updated_at=NOW() WHERE id=:pid"
            ), {"lines": json.dumps(lines), "pid": row[0]})
    _log_audit('CREATE', 'Part Mapping', f"{data['internal_part_number']} -> {data['customer_part_number']}")
    db.session.commit()
    return {"success": True, "message": "Mapping created"}, 201


@part_bp.route("/mappings/<mapping_id>", methods=["PUT"])
def update_mapping(mapping_id):
    data = request.get_json()
    tenant_id = request.headers.get("X-Tenant-ID", "")
    updates, params = [], {"id": mapping_id}
    for f in ["internal_part_number", "internal_description", "customer_part_number",
              "customer_description", "organization_id", "organization_name"]:
        if f in data:
            updates.append(f"{f}=:{f}")
            params[f] = data[f] or ''
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE part.customer_mappings SET {', '.join(updates)} WHERE id=:id"), params)

    # Sync to PO line items if requested
    if data.get("sync_pos"):
        # Get the old customer_part_number to find matching PO lines
        mapping = db.session.execute(db.text(
            "SELECT customer_part_number, internal_part_number, internal_description FROM part.customer_mappings WHERE id=:id"
        ), {"id": mapping_id}).first()
        if mapping:
            cpn = mapping[0]
            ipn = mapping[1] or ''
            idesc = mapping[2] or ''
            # Update all PO lines that have this customer_part_number
            po_rows = db.session.execute(db.text(
                "SELECT id, lines FROM procurement.purchase_orders "
                "WHERE (tenant_id = :tid OR tenant_id IS NULL) AND is_deleted = false AND lines IS NOT NULL"
            ), {"tid": tenant_id})
            for row in po_rows:
                lines = row[1] if isinstance(row[1], list) else json.loads(row[1]) if row[1] else []
                changed = False
                for line in lines:
                    if line.get("customer_part_number", "").lower() == cpn.lower():
                        line["internal_part_number"] = ipn
                        line["internal_description"] = idesc
                        changed = True
                if changed:
                    db.session.execute(db.text(
                        "UPDATE procurement.purchase_orders SET lines=:lines, updated_at=NOW() WHERE id=:pid"
                    ), {"lines": json.dumps(lines), "pid": row[0]})

    _log_audit('UPDATE', 'Part Mapping', mapping_id)
    db.session.commit()
    return {"success": True, "message": "Mapping updated"}


@part_bp.route("/mappings/<mapping_id>", methods=["DELETE"])
def delete_mapping(mapping_id):
    db.session.execute(db.text(
        "UPDATE part.customer_mappings SET is_deleted=true, updated_at=NOW() WHERE id=:id"
    ), {"id": mapping_id})
    _log_audit('DELETE', 'Part Mapping', mapping_id)
    db.session.commit()
    return {"success": True, "message": "Mapping deleted"}


@part_bp.route("/search-parts", methods=["GET"])
def search_internal_parts():
    """Search across all part tables for internal part number + description."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    q = request.args.get("q", "").strip()
    if not q or len(q) < 2:
        return {"success": True, "data": []}
    subs = db.session.execute(db.text(
        "SELECT s.name, s.series_prefix, c.name as cat_name, c.series_prefix as cat_series "
        "FROM part.subcategories s JOIN part.categories c ON s.category_id = c.id "
        "WHERE s.tenant_id = :tid AND s.is_deleted = false"
    ), {"tid": tenant_id}).fetchall()
    results = []
    search = f"%{q}%"
    for sub in subs:
        table_name = _safe_table_name(sub[2], sub[0], sub[3], sub[1])
        try:
            rows = db.session.execute(db.text(
                f"SELECT part_number, COALESCE(description,'') FROM {table_name} "
                f"WHERE (LOWER(part_number) LIKE LOWER(:q) OR LOWER(COALESCE(description,'')) LIKE LOWER(:q)) "
                f"AND status = 'active' LIMIT 10"
            ), {"q": search})
            for r in rows:
                results.append({"part_number": r[0], "description": r[1]})
        except Exception:
            db.session.rollback()
            continue
    return {"success": True, "data": results[:20]}


@part_bp.route("/part-audit/<part_number>", methods=["GET"])
def get_part_audit(part_number):
    """Get audit logs for a specific part number."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    rows = db.session.execute(db.text(
        "SELECT id, action, entity_type, user_email, user_name, ip_address, created_at "
        "FROM audit.logs WHERE entity_id = :pn AND module = 'Part Management' "
        "AND tenant_id = :tid ORDER BY created_at DESC LIMIT 100"
    ), {"pn": part_number, "tid": tenant_id}).fetchall()
    logs = [{"id": r[0], "action": r[1], "entity_type": r[2],
             "user_email": r[3] or '', "user_name": r[4] or '',
             "ip_address": r[5] or '', "created_at": str(r[6]) if r[6] else None} for r in rows]
    return {"success": True, "data": logs}


@part_bp.route("/part-field-update", methods=["POST"])
def update_part_field():
    """Update a single field on a part in its dynamic table."""
    data = request.get_json()
    part_number = data.get("part_number")
    field = data.get("field")
    value = data.get("value")
    subcategory_id = data.get("subcategory_id")
    if not part_number or not field or not subcategory_id:
        return {"success": False, "message": "part_number, field, subcategory_id required"}, 400
    # Sanitize field name
    safe_field = re.sub(r'[^a-z0-9_]', '_', field.lower().strip())
    if safe_field in ('id', 'part_number', 'created_at', 'status'):
        return {"success": False, "message": "Cannot update this field"}, 400
    row = db.session.execute(db.text(
        "SELECT s.name, s.series_prefix, c.name as cat_name, c.series_prefix as cat_series "
        "FROM part.subcategories s JOIN part.categories c ON s.category_id = c.id "
        "WHERE s.id = :id AND s.is_deleted = false"
    ), {"id": subcategory_id}).first()
    if not row:
        return {"success": False, "message": "Subcategory not found"}, 404
    table_name = _safe_table_name(row[2], row[0], row[3], row[1])
    db.session.execute(db.text(
        f"UPDATE {table_name} SET {safe_field} = :val WHERE part_number = :pn"
    ), {"val": value, "pn": part_number})
    _log_audit('UPDATE', 'Part', part_number, f'Field {safe_field} updated')
    db.session.commit()
    return {"success": True, "message": f"Field '{safe_field}' updated"}


@part_bp.route("/part-detail/<part_number>", methods=["GET"])
def get_part_detail(part_number):
    """Full detail for a single part: part data + all POs containing it."""
    tenant_id = request.headers.get("X-Tenant-ID", "")

    # Find which subcategory/table this part belongs to
    subs = db.session.execute(db.text(
        "SELECT s.id, s.name, s.series_prefix, s.columns_config, s.description_columns, "
        "c.name as cat_name, c.series_prefix as cat_series, c.id as cat_id "
        "FROM part.subcategories s JOIN part.categories c ON s.category_id = c.id "
        "WHERE s.tenant_id = :tid AND s.is_deleted = false"
    ), {"tid": tenant_id}).fetchall()

    part_data = None
    for sub in subs:
        table_name = _safe_table_name(sub[5], sub[1], sub[6], sub[2])
        try:
            row = db.session.execute(db.text(
                f"SELECT * FROM {table_name} WHERE part_number = :pn LIMIT 1"
            ), {"pn": part_number}).first()
            if row:
                cols = db.session.execute(db.text(
                    f"SELECT * FROM {table_name} WHERE part_number = :pn LIMIT 1"
                ), {"pn": part_number})
                keys = cols.keys()
                part_data = dict(zip(keys, row))
                for k, v in part_data.items():
                    if hasattr(v, 'isoformat'):
                        part_data[k] = v.isoformat()
                    elif isinstance(v, uuid.UUID):
                        part_data[k] = str(v)
                part_data['category'] = sub[5]
                part_data['category_id'] = sub[7]
                part_data['subcategory'] = sub[1]
                part_data['subcategory_id'] = sub[0]
                cols_config = sub[3] if isinstance(sub[3], list) else (json.loads(sub[3]) if sub[3] else [])
                part_data['columns_config'] = cols_config
                break
        except Exception:
            db.session.rollback()
            continue

    if not part_data:
        return {"success": False, "message": "Part not found"}, 404

    # Get RM-Part mappings for this part
    rm_mappings = db.session.execute(db.text(
        "SELECT id, rm_code, rm_description, quantity_required, unit, wastage_percent, effective_quantity, process_notes, created_at "
        "FROM rawmaterial.rm_part_mapping WHERE part_number = :pn "
        "AND (tenant_id = :tid OR tenant_id IS NULL) AND is_deleted = false ORDER BY created_at DESC"
    ), {"pn": part_number, "tid": tenant_id}).fetchall()
    rm_mapping_list = [{
        "id": r[0], "rm_code": r[1], "rm_description": r[2] or '',
        "quantity_required": float(r[3]) if r[3] else None,
        "unit": r[4] or '', "wastage_percent": float(r[5]) if r[5] else None,
        "effective_quantity": float(r[6]) if r[6] else None,
        "process_notes": r[7] or '', "created_at": str(r[8]) if r[8] else None
    } for r in rm_mappings]

    # Get all customer mappings for this part
    mappings = db.session.execute(db.text(
        "SELECT id, customer_part_number, customer_description, organization_name, organization_id, created_at "
        "FROM part.customer_mappings WHERE internal_part_number = :pn "
        "AND (tenant_id = :tid OR tenant_id IS NULL) AND is_deleted = false ORDER BY created_at DESC"
    ), {"pn": part_number, "tid": tenant_id}).fetchall()
    mapping_list = [{
        "id": r[0], "customer_part_number": r[1], "customer_description": r[2] or '',
        "organization_name": r[3] or '', "organization_id": r[4] or '',
        "created_at": str(r[5]) if r[5] else None
    } for r in mappings]

    # Collect all customer part numbers for this internal part
    customer_pns = [m["customer_part_number"] for m in mapping_list]

    # Find all POs that contain this part (by internal OR customer part number)
    po_rows = db.session.execute(db.text(
        "SELECT po.id, po.doc_no, po.date, po.status, po.total, po.lines, "
        "po.created_at, po.remarks, "
        "p.name as project_name, p.code as project_code, "
        "o.name as org_name "
        "FROM procurement.purchase_orders po "
        "LEFT JOIN project.projects p ON po.project_id = p.id "
        "LEFT JOIN project.organizations o ON po.organization_id = o.id "
        "WHERE (po.tenant_id = :tid OR po.tenant_id = '' OR po.tenant_id IS NULL) "
        "AND po.is_deleted = false AND po.lines IS NOT NULL ORDER BY po.created_at DESC"
    ), {"tid": tenant_id}).fetchall()

    po_appearances = []
    total_ordered_qty = 0
    for po in po_rows:
        lines = po[5] if isinstance(po[5], list) else (json.loads(po[5]) if po[5] else [])
        matched_lines = []
        for line in lines:
            ipn = (line.get("internal_part_number") or "").strip()
            cpn = (line.get("customer_part_number") or "").strip()
            if ipn.lower() == part_number.lower() or cpn.lower() in [c.lower() for c in customer_pns]:
                matched_lines.append(line)
                try:
                    total_ordered_qty += float(line.get("quantity", 0) or 0)
                except Exception:
                    pass
        if matched_lines:
            po_appearances.append({
                "po_id": po[0], "po_number": po[1],
                "po_date": str(po[2]) if po[2] else '',
                "status": po[3] or 'open',
                "po_total": float(po[4] or 0),
                "project_name": po[8] or '', "project_code": po[9] or '',
                "organization_name": po[10] or '',
                "created_at": str(po[6]) if po[6] else None,
                "remarks": po[7] or '',
                "matched_lines": matched_lines
            })

    return {"success": True, "data": {
        "part": part_data,
        "mappings": mapping_list,
        "rm_mappings": rm_mapping_list,
        "purchase_orders": po_appearances,
        "total_ordered_qty": total_ordered_qty,
        "po_count": len(po_appearances)
    }}


@part_bp.route("/search-customer-parts", methods=["GET"])
def search_customer_parts():
    """Search customer part numbers from PO line items."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    q = request.args.get("q", "").strip()
    if not q or len(q) < 2:
        return {"success": True, "data": []}
    # Search from PO lines and existing mappings
    results = []
    # From existing mappings
    rows = db.session.execute(db.text(
        "SELECT DISTINCT customer_part_number, customer_description FROM part.customer_mappings "
        "WHERE (tenant_id = :tid OR tenant_id IS NULL) AND is_deleted = false "
        "AND LOWER(customer_part_number) LIKE LOWER(:q) LIMIT 10"
    ), {"tid": tenant_id, "q": f"%{q}%"})
    for r in rows:
        results.append({"part_number": r[0], "description": r[1] or ''})
    # From PO line items
    po_rows = db.session.execute(db.text(
        "SELECT lines FROM procurement.purchase_orders "
        "WHERE (tenant_id = :tid OR tenant_id IS NULL) AND is_deleted = false AND lines IS NOT NULL"
    ), {"tid": tenant_id})
    seen = {r["part_number"] for r in results}
    for row in po_rows:
        lines = row[0] if isinstance(row[0], list) else json.loads(row[0]) if row[0] else []
        for line in lines:
            cpn = line.get("customer_part_number", "")
            if cpn and q.lower() in cpn.lower() and cpn not in seen:
                results.append({"part_number": cpn, "description": line.get("customer_description", "")})
                seen.add(cpn)
    return {"success": True, "data": results[:20]}


@part_bp.route("/lookup-mapping", methods=["GET"])
def lookup_mapping():
    """Lookup internal part by exact customer_part_number match."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    cpn = request.args.get("customer_part_number", "").strip()
    if not cpn:
        return {"success": False, "data": None}
    row = db.session.execute(db.text(
        "SELECT internal_part_number, internal_description, organization_name FROM part.customer_mappings "
        "WHERE LOWER(customer_part_number) = LOWER(:cpn) AND (tenant_id = :tid OR tenant_id IS NULL) "
        "AND is_deleted = false LIMIT 1"
    ), {"cpn": cpn, "tid": tenant_id}).first()
    if row:
        return {"success": True, "data": {
            "internal_part_number": row[0], "internal_description": row[1] or '',
            "organization_name": row[2] or ''
        }}
    return {"success": False, "data": None}


@part_bp.route("/unmapped-customer-parts", methods=["GET"])
def unmapped_customer_parts():
    """List customer part numbers from POs that have no mapping yet."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    # Get all mapped customer part numbers
    mapped_rows = db.session.execute(db.text(
        "SELECT LOWER(customer_part_number) FROM part.customer_mappings "
        "WHERE (tenant_id = :tid OR tenant_id IS NULL) AND is_deleted = false"
    ), {"tid": tenant_id})
    mapped_set = {r[0] for r in mapped_rows}
    # Get all customer part numbers from PO lines
    po_rows = db.session.execute(db.text(
        "SELECT doc_no, lines FROM procurement.purchase_orders "
        "WHERE (tenant_id = :tid OR tenant_id IS NULL) AND is_deleted = false AND lines IS NOT NULL"
    ), {"tid": tenant_id})
    unmapped = []
    seen = set()
    for row in po_rows:
        lines = row[1] if isinstance(row[1], list) else json.loads(row[1]) if row[1] else []
        for line in lines:
            cpn = line.get("customer_part_number", "").strip()
            if cpn and cpn.lower() not in mapped_set and cpn.lower() not in seen:
                unmapped.append({"customer_part_number": cpn, "po_number": row[0]})
                seen.add(cpn.lower())
    return {"success": True, "data": unmapped}


# ─── AUDIT HELPER ───

def _log_audit(action, entity_type, entity_id, details=''):
    """Log action to audit.logs table with user info."""
    try:
        from flask import request as req
        user_email = req.headers.get('X-User-Email', '')
        user_name = req.headers.get('X-User-Name', '')
        db.session.execute(db.text(
            "INSERT INTO audit.logs (id, action, module, entity_type, entity_id, ip_address, tenant_id, user_email, user_name, created_at) "
            "VALUES (gen_random_uuid(), :action, 'Part Management', :etype, :eid, :ip, :tid, :email, :name, NOW())"
        ), {
            "action": action, "etype": entity_type, "eid": str(entity_id),
            "ip": req.remote_addr or '', "tid": req.headers.get('X-Tenant-ID', ''),
            "email": user_email, "name": user_name
        })
    except Exception:
        pass
