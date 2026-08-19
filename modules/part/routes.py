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
    if not tenant_id or tenant_id in ('TEST', ''):
        tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958'
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

    cat_count = db.session.execute(db.text(
        "SELECT COUNT(*) FROM part.categories WHERE tenant_id = :tid AND is_deleted = false"
    ), {"tid": tenant_id}).scalar() or 0
    sub_count = db.session.execute(db.text(
        "SELECT COUNT(*) FROM part.subcategories WHERE tenant_id = :tid AND is_deleted = false"
    ), {"tid": tenant_id}).scalar() or 0

    # Count parts and obsolete parts across all dynamic tables + per-category breakdown
    total_parts = 0
    obsolete_count = 0
    category_breakdown = []
    subs = db.session.execute(db.text(
        "SELECT s.name, s.series_prefix, c.name as cat_name, c.series_prefix as cat_series "
        "FROM part.subcategories s JOIN part.categories c ON s.category_id = c.id "
        "WHERE s.tenant_id = :tid AND s.is_deleted = false"
    ), {"tid": tenant_id}).fetchall()

    cat_counts = {}
    cat_tables_queried = set()
    
    for sub in subs:
        table_name = _safe_table_name(sub[2], sub[3])
        if table_name in cat_tables_queried:
            continue
        cat_tables_queried.add(table_name)
        
        try:
            # Check if status column exists
            has_status = False
            try:
                db.session.execute(db.text(f"SELECT status FROM {table_name} LIMIT 0"))
                has_status = True
            except Exception:
                db.session.rollback()

            cnt = db.session.execute(db.text(f"SELECT COUNT(*) FROM {table_name}")).scalar() or 0
            total_parts += cnt

            cat_name = sub[2]
            if cat_name not in cat_counts:
                cat_counts[cat_name] = 0
            cat_counts[cat_name] += cnt

            if has_status:
                obs_cnt = db.session.execute(db.text(
                    f"SELECT COUNT(*) FROM {table_name} WHERE status = 'obsolete'"
                )).scalar() or 0
                obsolete_count += obs_cnt
        except Exception:
            db.session.rollback()

    category_breakdown = sorted(
        [{"category": k, "count": v} for k, v in cat_counts.items()],
        key=lambda x: x["count"], reverse=True
    )

    # Recent audit logs with time filter
    recent_logs = db.session.execute(db.text(
        f"SELECT action, entity_type, entity_id, created_at FROM audit.logs "
        f"WHERE module = 'Part Management' AND tenant_id = :tid {time_filter} ORDER BY created_at DESC LIMIT 20"
    ), {"tid": tenant_id})
    recent_activity = [{"action": r[0], "entity_type": r[1], "entity_id": r[2],
                        "created_at": str(r[3]) if r[3] else None} for r in recent_logs]

    # Action breakdown
    action_rows = db.session.execute(db.text(
        f"SELECT action, COUNT(*) FROM audit.logs "
        f"WHERE module = 'Part Management' AND tenant_id = :tid {time_filter} GROUP BY action"
    ), {"tid": tenant_id}).fetchall()
    action_breakdown = {r[0]: r[1] for r in action_rows}

    return {"success": True, "data": {
        "categories": cat_count, "subcategories": sub_count,
        "total_parts": total_parts, "obsolete_parts": obsolete_count,
        "active_parts": total_parts - obsolete_count,
        "recent_activity": recent_activity,
        "action_breakdown": action_breakdown,
        "category_breakdown": category_breakdown,
        "period": period
    }}

@part_bp.route("/audit-logs", methods=["GET"])
def part_audit_logs():
    """Audit logs for Part Management module."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    if not tenant_id or tenant_id in ('TEST', ''):
        tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958'
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 50, type=int)
    entity_id = request.args.get('entity_id', '')
    offset = (page - 1) * limit
    
    where = "module = 'Part Management' AND tenant_id = :tid"
    params = {"tid": tenant_id, "limit": limit, "offset": offset}
    if entity_id:
        where += " AND entity_id = :entity_id"
        params["entity_id"] = entity_id

    rows = db.session.execute(db.text(
        "SELECT id, action, entity_type, entity_id, ip_address, created_at, user_email, user_name, "
        "old_values, new_values, extra_data "
        f"FROM audit.logs WHERE {where} "
        "ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    ), params)
    
    def load_json(val):
        if not val: return None
        if isinstance(val, (dict, list)): return val
        try: return json.loads(val)
        except Exception: return val
 
    logs = [{"id": r[0], "action": r[1], "entity_type": r[2], "entity_id": r[3],
             "ip_address": r[4], "created_at": str(r[5]) if r[5] else None,
             "user_email": r[6] or '', "user_name": r[7] or '',
             "old_values": load_json(r[8]), "new_values": load_json(r[9]),
             "extra_data": load_json(r[10])} for r in rows]

    count_where = "module = 'Part Management' AND tenant_id = :tid"
    count_params = {"tid": tenant_id}
    if entity_id:
        count_where += " AND entity_id = :entity_id"
        count_params["entity_id"] = entity_id

    total = db.session.execute(db.text(
        f"SELECT COUNT(*) FROM audit.logs WHERE {count_where}"
    ), count_params).scalar() or 0
    return {"success": True, "data": {"items": logs, "total": total, "page": page}}


def _safe_table_name(category_name, cat_series):
    """Generate safe table name: part."{category}_{cat_series}\""""
    def clean(s):
        return re.sub(r'[^a-z0-9]', '_', s.lower().strip()).strip('_')
    tname = f"{clean(category_name)}_{cat_series}"
    return f'part."{tname}"'


def _generate_next_part_number(cat_series, sub_series, category_id, separator='-', subcategory_id=None, table_name=None):
    """Generate next part: {cat_series}{sep}{sub_series}{sep}{seq_str}.
    Finds the lowest unused sequence number to fill gaps left by deleted parts."""
    padding_row = db.session.execute(db.text(
        "SELECT COALESCE(sequence_padding, 4) FROM part.categories WHERE id = :id"
    ), {"id": category_id}).first()
    padding = padding_row[0] if padding_row else 4

    # Get current max sequence from subcategory counter
    if subcategory_id:
        seq_row = db.session.execute(db.text(
            "SELECT current_sequence FROM part.subcategories WHERE id = :id"
        ), {"id": subcategory_id}).first()
        current_max = seq_row[0] if seq_row else 0
    else:
        seq_row = db.session.execute(db.text(
            "SELECT current_sequence FROM part.categories WHERE id = :id"
        ), {"id": category_id}).first()
        current_max = seq_row[0] if seq_row else 0

    # Find lowest unused sequence by checking actual table for gaps
    next_seq = None
    if table_name:
        prefix = f"{cat_series}{separator}{sub_series}{separator}"
        for candidate in range(1, current_max + 2):
            candidate_pn = f"{prefix}{str(candidate).zfill(padding)}"
            exists = db.session.execute(db.text(
                f"SELECT 1 FROM {table_name} WHERE part_number = :pn LIMIT 1"
            ), {"pn": candidate_pn}).first()
            if not exists:
                next_seq = candidate
                break

    if next_seq is None:
        next_seq = current_max + 1

    # Update the sequence counter if next_seq exceeds current max
    if next_seq > current_max:
        if subcategory_id:
            db.session.execute(db.text(
                "UPDATE part.subcategories SET current_sequence = :seq, updated_at = NOW() WHERE id = :id"
            ), {"seq": next_seq, "id": subcategory_id})
        else:
            db.session.execute(db.text(
                "UPDATE part.categories SET current_sequence = :seq, updated_at = NOW() WHERE id = :id"
            ), {"seq": next_seq, "id": category_id})

    seq_str = str(next_seq).zfill(padding)
    return f"{cat_series}{separator}{sub_series}{separator}{seq_str}"


def _build_description(columns_config, col_values, desc_columns, cat_name, sub_name, cat_code=None):
    """Build description: cat_code + selected column values (comma separated)."""
    parts = [cat_code or cat_name]
    if desc_columns:
        for col_name in desc_columns:
            val = col_values.get(col_name, '')
            if val and str(val).strip():
                parts.append(str(val).strip())
    return ', '.join(parts)


# ─── CATEGORIES ───

@part_bp.route("/categories", methods=["GET"])
def list_categories():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    if not tenant_id or tenant_id in ('TEST', ''):
        tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958'
    rows = db.session.execute(db.text(
        "SELECT id, name, code, series_prefix, description, is_active, created_at, COALESCE(separator, '-'), columns_config, description_columns, COALESCE(sequence_padding, 4) "
        "FROM part.categories WHERE tenant_id = :tid AND is_deleted = false ORDER BY created_at DESC"
    ), {"tid": tenant_id})
    items = [{"id": r[0], "name": r[1], "code": r[2], "series_prefix": r[3],
              "description": r[4], "is_active": r[5], "created_at": str(r[6]) if r[6] else None,
              "separator": r[7], 
              "columns": r[8] if isinstance(r[8], list) else (json.loads(r[8]) if r[8] else []),
              "description_columns": r[9] if isinstance(r[9], list) else (json.loads(r[9]) if r[9] else []),
              "sequence_padding": r[10]} for r in rows]
    return {"success": True, "data": items}


@part_bp.route("/categories", methods=["POST"])
def create_category():
    data = request.get_json()
    if not data.get("name") or not data.get("series_prefix"):
        return {"success": False, "message": "Name and Series Prefix required"}, 400
    separator = data.get("separator", "-")
    if separator not in ("-", ".", "/"):
        separator = "-"
        
    columns_config = data.get("columns", [])
    description_columns = data.get("description_columns", [])
    sequence_padding = data.get("sequence_padding", 4)
    
    cat_id = str(uuid.uuid4())
    tenant_id = request.headers.get("X-Tenant-ID", "")
    
    # Check duplicate series_prefix
    existing = db.session.execute(db.text(
        "SELECT id FROM part.categories WHERE series_prefix = :p AND tenant_id = :tid AND is_deleted = false"
    ), {"p": data["series_prefix"], "tid": tenant_id}).first()
    if existing:
        return {"success": False, "message": "Series prefix already exists"}, 409
        
    # Create the Category table
    table_name = _safe_table_name(data["name"], data["series_prefix"])
    
    col_defs = [
        "id VARCHAR(36) PRIMARY KEY",
        "part_number VARCHAR(100) NOT NULL UNIQUE",
        "subcategory_id VARCHAR(36) NOT NULL",
        "status VARCHAR(20) DEFAULT 'Active'",
        "created_at TIMESTAMP DEFAULT NOW()",
        "updated_at TIMESTAMP DEFAULT NOW()"
    ]
    
    type_map = {
        "varchar": "VARCHAR(255)",
        "numeric": "NUMERIC(14,4)",
        "boolean": "BOOLEAN",
        "date": "DATE",
        "text": "TEXT"
    }
    for col in columns_config:
        cname = col["name"]
        ctype = type_map.get(col.get("type", "varchar"), "VARCHAR(255)")
        col_defs.append(f'"{cname}" {ctype}')
        
    create_sql = f"CREATE TABLE IF NOT EXISTS {table_name} ({', '.join(col_defs)})"
    
    try:
        db.session.execute(db.text(create_sql))
        db.session.execute(db.text(
            "INSERT INTO part.categories (id, name, code, series_prefix, separator, description, columns_config, description_columns, sequence_padding, current_sequence, tenant_id) "
            "VALUES (:id, :name, :code, :prefix, :sep, :desc, :cols, :desc_cols, :pad, 0, :tid)"
        ), {"id": cat_id, "name": data["name"], "code": data.get("code", data["name"][:3].upper()),
            "prefix": data["series_prefix"], "sep": separator, "desc": data.get("description", ""), 
            "cols": json.dumps(columns_config), "desc_cols": json.dumps(description_columns), "pad": sequence_padding, "tid": tenant_id})
        _log_audit('CREATE', 'Category', data["name"], details=f"Category '{data['name']}' created", new_values={"name": data["name"], "series_prefix": data["series_prefix"], "code": data.get("code", ""), "separator": separator, "description": data.get("description", ""), "columns": columns_config})
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": f"Failed to create category: {str(e)}"}, 500
        
    return {"success": True, "data": {"id": cat_id}, "message": "Category created"}, 201


@part_bp.route("/categories/<cat_id>", methods=["PUT"])
def update_category(cat_id):
    data = request.get_json()
    
    old_cat = db.session.execute(db.text(
        "SELECT name, series_prefix, separator, description FROM part.categories WHERE id=:id"
    ), {"id": cat_id}).first()
    old_values = {"name": old_cat[0], "series_prefix": old_cat[1], "separator": old_cat[2], "description": old_cat[3]} if old_cat else {}
    
    updates = []
    params = {"id": cat_id}
    if "name" in data:
        updates.append("name=:name")
        params["name"] = data["name"]
    if "description" in data:
        updates.append("description=:desc")
        params["desc"] = data["description"]
    if "separator" in data:
        sep = data["separator"]
        if sep in ("-", ".", "/"):
            updates.append("separator=:sep")
            params["sep"] = sep
    if "columns" in data:
        updates.append("columns_config=:columns_config")
        params["columns_config"] = json.dumps(data["columns"])
    if "description_columns" in data:
        updates.append("description_columns=:description_columns")
        params["description_columns"] = json.dumps(data["description_columns"])
    if "sequence_padding" in data:
        updates.append("sequence_padding=:sequence_padding")
        params["sequence_padding"] = int(data["sequence_padding"])
            
    if not updates:
        return {"success": False, "message": "No fields to update"}, 400
        
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(
        f"UPDATE part.categories SET {', '.join(updates)} WHERE id=:id"
    ), params)
    
    # If columns were updated, try to add them to the table
    if "columns" in data and old_cat:
        table_name = _safe_table_name(old_cat[0], old_cat[1])
        type_map = {
            "varchar": "VARCHAR(255)",
            "numeric": "NUMERIC(14,4)",
            "boolean": "BOOLEAN",
            "date": "DATE",
            "text": "TEXT"
        }
        for col in data["columns"]:
            cname = col["name"]
            ctype = type_map.get(col.get("type", "varchar"), "VARCHAR(255)")
            try:
                db.session.execute(db.text(f'ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS "{cname}" {ctype}'))
            except Exception as e:
                db.session.rollback()
                pass # Ignore if column already exists

    
    new_values = {
        "name": data.get("name", old_values.get("name")),
        "series_prefix": old_values.get("series_prefix"),
        "separator": data.get("separator", old_values.get("separator")),
        "description": data.get("description", old_values.get("description"))
    }
    
    _log_audit('UPDATE', 'Category', old_values.get("name", cat_id), details=f"Category '{cat_id}' updated", old_values=old_values, new_values=new_values)
    db.session.commit()

    # Sync columns_config and description_columns to ALL subcategories of this category
    if "columns" in data or "description_columns" in data:
        updated_cat = db.session.execute(db.text(
            "SELECT columns_config, description_columns FROM part.categories WHERE id=:id"
        ), {"id": cat_id}).first()
        if updated_cat:
            db.session.execute(db.text(
                "UPDATE part.subcategories SET columns_config=:cc, description_columns=:dc, updated_at=NOW() "
                "WHERE category_id=:cid AND is_deleted=false"
            ), {"cc": json.dumps(updated_cat[0] if isinstance(updated_cat[0], list) else (json.loads(updated_cat[0]) if updated_cat[0] else [])),
                "dc": json.dumps(updated_cat[1] if isinstance(updated_cat[1], list) else (json.loads(updated_cat[1]) if updated_cat[1] else [])),
                "cid": cat_id})
            db.session.commit()

    return {"success": True, "message": "Category updated"}


@part_bp.route("/categories/<cat_id>", methods=["DELETE"])
def delete_category(cat_id):
    cat = db.session.execute(db.text(
        "SELECT name, series_prefix FROM part.categories WHERE id=:id"
    ), {"id": cat_id}).first()
    cat_label = f"{cat[0]} ({cat[1]})" if cat else cat_id
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
        table_name = _safe_table_name(sub[2], sub[3])
        try:
            part_count = db.session.execute(db.text(f"SELECT COUNT(*) FROM {table_name}")).scalar() or 0
            if part_count > 0:
                return {"success": False, "message": f"Cannot delete: parts exist in subcategory '{sub[0]}'. Delete all parts first."}, 409
        except Exception:
            db.session.rollback()

    db.session.execute(db.text(
        "UPDATE part.categories SET is_deleted=true WHERE id=:id"
    ), {"id": cat_id})
    _log_audit('DELETE', 'Category', cat_label, old_values={"name": cat[0], "series_prefix": cat[1]} if cat else {})
    db.session.commit()
    return {"success": True, "message": "Category deleted"}


# ─── SUBCATEGORIES ───

@part_bp.route("/subcategories", methods=["GET"])
def list_subcategories():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    if not tenant_id or tenant_id in ('TEST', ''):
        tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958'
    cat_id = request.args.get("category_id", "")
    cat_ids = request.args.get("category_ids", "")
    where = "s.tenant_id = :tid AND s.is_deleted = false"
    params = {"tid": tenant_id}
    if cat_ids:
        cids = [c.strip() for c in cat_ids.split(",") if c.strip()]
        if cids:
            where += f" AND s.category_id IN ({','.join([':cid_'+str(i) for i in range(len(cids))])})"
            for i, cid in enumerate(cids):
                params[f"cid_{i}"] = cid
    elif cat_id:
        where += " AND s.category_id = :cid"
        params["cid"] = cat_id
    rows = db.session.execute(db.text(
        f"SELECT s.id, s.name, s.code, s.series_prefix, s.category_id, c.name as category_name, "
        f"c.series_prefix as cat_series, s.columns_config, s.description_columns, s.current_sequence "
        f"FROM part.subcategories s LEFT JOIN part.categories c ON s.category_id = c.id "
        f"WHERE {where} ORDER BY s.created_at DESC"
    ), params)
    items = [{"id": r[0], "name": r[1], "code": r[2], "series_prefix": r[3],
              "category_id": r[4], "category_name": r[5], "cat_series": r[6],
              "columns_config": r[7], "description_columns": r[8], "current_sequence": r[9] or 0} for r in rows]
    return {"success": True, "data": items}


@part_bp.route("/subcategories", methods=["POST"])
def create_subcategory():
    data = request.get_json()
    if not data.get("name") or not data.get("series_prefix") or not data.get("category_id"):
        return {"success": False, "message": "Name, Series Prefix, and Category required"}, 400

    sub_id = str(uuid.uuid4())
    tenant_id = request.headers.get("X-Tenant-ID", "")
    columns_config = json.dumps(data.get("columns") or data.get("columns_config") or [])
    description_columns = json.dumps(data.get("description_columns", []))

    # Get category info
    cat = db.session.execute(db.text(
        "SELECT name, series_prefix, columns_config, description_columns FROM part.categories WHERE id = :id AND is_deleted = false"
    ), {"id": data["category_id"]}).first()
    if not cat:
        return {"success": False, "message": "Category not found"}, 404

    cat_name, cat_series = cat[0], cat[1]
    # Always inherit columns_config and description_columns from category
    cat_cols = cat[2] if isinstance(cat[2], list) else (json.loads(cat[2]) if cat[2] else [])
    cat_desc_cols = cat[3] if isinstance(cat[3], list) else (json.loads(cat[3]) if cat[3] else [])
    columns_config = json.dumps(cat_cols)
    description_columns = json.dumps(cat_desc_cols)
    sub_series = data["series_prefix"]

    # Check duplicate series_prefix within same category
    existing = db.session.execute(db.text(
        "SELECT id FROM part.subcategories WHERE series_prefix = :p AND category_id = :cid AND is_deleted = false"
    ), {"p": sub_series, "cid": data["category_id"]}).first()
    if existing:
        return {"success": False, "message": "Series prefix already exists in this category"}, 409

    # Create subcategory record
    db.session.execute(db.text(
        "INSERT INTO part.subcategories (id, name, code, series_prefix, category_id, tenant_id, columns_config, description_columns) "
        "VALUES (:id, :name, :code, :prefix, :cat_id, :tid, :cc, :dc)"
    ), {"id": sub_id, "name": data["name"], "code": data.get("code", data["name"][:3].upper()),
        "prefix": sub_series, "cat_id": data["category_id"], "tid": tenant_id, "cc": columns_config, "dc": description_columns})
    _log_audit('CREATE', 'Subcategory', data["name"], details=f"Subcategory '{data['name']}' created", new_values={"name": data["name"], "series_prefix": sub_series, "code": data.get("code", "")})

    db.session.commit()
    return {"success": True, "data": {"id": sub_id}, "message": "Subcategory created"}, 201


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
    if "columns_config" in data:
        updates.append("columns_config=:columns_config")
        params["columns_config"] = json.dumps(data["columns_config"])
    if "description_columns" in data:
        updates.append("description_columns=:description_columns")
        params["description_columns"] = json.dumps(data["description_columns"])

    old_sub = db.session.execute(db.text("SELECT name, code, series_prefix, category_id FROM part.subcategories WHERE id=:id"), {"id": sub_id}).first()
    old_values = {}
    if old_sub:
        old_values = {
            "name": old_sub[0], "code": old_sub[1], "series_prefix": old_sub[2],
            "category_id": old_sub[3]
        }
        
    if not updates:
        return {"success": False, "message": "No fields to update"}, 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(
        f"UPDATE part.subcategories SET {', '.join(updates)} WHERE id=:id"
    ), params)
    
    new_values = {
        "name": data.get("name", old_values.get("name")),
        "code": data.get("code", old_values.get("code")),
        "series_prefix": data.get("series_prefix", old_values.get("series_prefix")),
        "category_id": data.get("category_id", old_values.get("category_id"))
    }
    _log_audit('UPDATE', 'Subcategory', old_values.get("name", sub_id), details=f"Subcategory '{sub_id}' updated", old_values=old_values, new_values=new_values)
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
    sub_label = f"{row[2]}/{row[0]} ({row[3]}-{row[1]})"

    # Block if any parts exist in the part_masters table for this subcategory
    try:
        part_count = db.session.execute(db.text(f"SELECT COUNT(*) FROM part.masters WHERE subcategory_id = :id"), {"id": sub_id}).scalar() or 0
        if part_count > 0:
            return {"success": False, "message": f"Cannot delete: {part_count} part(s) exist in this subcategory. Delete or obsolete all parts first."}, 409
    except Exception:
        db.session.rollback()

    db.session.execute(db.text(
        "UPDATE part.subcategories SET is_deleted=true WHERE id=:id"
    ), {"id": sub_id})
    _log_audit('DELETE', 'Subcategory', sub_label, old_values={"name": row[0], "category": row[2], "series_prefix": row[1]})
    db.session.commit()
    return {"success": True, "message": "Subcategory deleted"}


# ─── SYNC SUBCATEGORY COLUMNS FROM CATEGORY ───

@part_bp.route("/categories/<cat_id>/sync-subcategories", methods=["POST"])
def sync_subcategory_columns(cat_id):
    """Sync columns_config and description_columns from category to all its subcategories."""
    cat = db.session.execute(db.text(
        "SELECT name, columns_config, description_columns FROM part.categories WHERE id=:id AND is_deleted=false"
    ), {"id": cat_id}).first()
    if not cat:
        return {"success": False, "message": "Category not found"}, 404
    cc = json.dumps(cat[1] if isinstance(cat[1], list) else (json.loads(cat[1]) if cat[1] else []))
    dc = json.dumps(cat[2] if isinstance(cat[2], list) else (json.loads(cat[2]) if cat[2] else []))
    result = db.session.execute(db.text(
        "UPDATE part.subcategories SET columns_config=:cc, description_columns=:dc, updated_at=NOW() "
        "WHERE category_id=:cid AND is_deleted=false"
    ), {"cc": cc, "dc": dc, "cid": cat_id})
    db.session.commit()
    return {"success": True, "message": f"Synced columns to all subcategories of '{cat[0]}'"}


# ─── GENERATE PART CODE ───

@part_bp.route("/generate", methods=["POST"])
def generate_part():
    """Generate next part number and insert into dynamic table."""
    data = request.get_json()
    subcategory_id = data.get("subcategory_id")
    if not subcategory_id:
        return {"success": False, "message": "subcategory_id required"}, 400

    # Get subcategory + category info
    # Get subcategory + category info
    row = db.session.execute(db.text(
        "SELECT s.id, s.name, s.series_prefix, s.columns_config, c.current_sequence, "
        "c.name as cat_name, c.series_prefix as cat_series, s.description_columns, "
        "COALESCE(c.separator, '-') as cat_separator, c.id as cat_id, COALESCE(c.code, c.name) as cat_code "
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
    category_id = row[9]
    cat_code = row[10]

    table_name = _safe_table_name(cat_name, cat_series)
    col_values = data.get("values", {})

    # Build description from selected columns
    description = _build_description(columns_config, col_values, desc_columns, cat_name, sub_name, cat_code)

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

    # System columns that should never be treated as custom columns
    SYSTEM_COLS = {'id', 'part_number', 'subcategory_id', 'description', 'created_by',
                   'is_bought_out', 'is_manufactured', 'status', 'created_at', 'updated_at',
                   'obsoleted_at', 'obsolete_reason'}

    # Use category-level columns_config for duplicate check (authoritative source)
    cat_cols_row = db.session.execute(db.text(
        "SELECT columns_config FROM part.categories WHERE id = :id"
    ), {"id": category_id}).first()
    cat_columns_config = cat_cols_row[0] if cat_cols_row else []
    if not isinstance(cat_columns_config, list):
        try: cat_columns_config = json.loads(cat_columns_config) if cat_columns_config else []
        except: cat_columns_config = []
    # Fall back to subcategory columns_config if category has none
    dup_cols = cat_columns_config if cat_columns_config else columns_config

    # Duplicate check using the per-category field combination
    try:
        dup_wheres = ["LOWER(COALESCE(status,'active')) != 'obsolete'"]
        dup_params = {}
        for col in dup_cols:
            col_name = re.sub(r'[^a-z0-9_]', '_', col["name"].lower().strip())
            if col_name in SYSTEM_COLS:
                continue
            val = col_values.get(col["name"]) or col_values.get(col_name)
            if val is not None and str(val).strip() != "":
                dup_wheres.append(f"LOWER(COALESCE(CAST(\"{col_name}\" AS TEXT), '')) = LOWER(:{col_name}_val)")
                dup_params[f"{col_name}_val"] = str(val).strip()
            else:
                dup_wheres.append(f"(COALESCE(CAST(\"{col_name}\" AS TEXT), '') = '')")

        if dup_cols and len(dup_wheres) > 1:
            dup_query = f"SELECT part_number FROM {table_name} WHERE {' AND '.join(dup_wheres)} LIMIT 1"
            dup = db.session.execute(db.text(dup_query), dup_params).first()
            if dup:
                return {"success": False, "message": f"Part already exists: {dup[0]}",
                        "data": {"existing_part": dup[0], "description": description},
                        "already_exists": True}
    except Exception as e:
        print(f"Error checking duplicate: {e}")
        db.session.rollback()

    # Generate or use specified part number
    specified_part_number = data.get("part_number")
    if specified_part_number and str(specified_part_number).strip():
        part_number = str(specified_part_number).strip()
        try:
            parts_split = re.split(r'[-./]', part_number)
            if parts_split:
                seq_num = int(parts_split[-1])
                db.session.execute(db.text(
                    "UPDATE part.subcategories SET current_sequence = :seq "
                    "WHERE id = :id AND current_sequence < :seq"
                ), {"seq": seq_num, "id": subcategory_id})
        except Exception:
            pass
    else:
        part_number = _generate_next_part_number(cat_series, sub_series, category_id, separator, subcategory_id, table_name)

    # Insert into dynamic table
    created_by = request.headers.get('X-User-Name', '') or request.headers.get('X-User-Email', '')
    is_bought_out = bool(data.get("is_bought_out", True))
    is_manufactured = bool(data.get("is_manufactured", False))
    if not is_bought_out and not is_manufactured:
        is_bought_out = True  # default fallback

    col_names = ["id", "part_number", "subcategory_id", "description", "created_by", "is_bought_out", "is_manufactured"]
    col_placeholders = [":id", ":part_number", ":subcategory_id", ":description", ":created_by", ":is_bought_out", ":is_manufactured"]
    params = {"id": str(uuid.uuid4()), "part_number": part_number, "subcategory_id": subcategory_id, "description": description, "created_by": created_by,
              "is_bought_out": is_bought_out, "is_manufactured": is_manufactured}

    # Use category columns for insert (authoritative), fall back to subcategory
    insert_cols = cat_columns_config if cat_columns_config else columns_config
    for col in insert_cols:
        col_name = re.sub(r'[^a-z0-9_]', '_', col["name"].lower().strip())
        # Skip system columns to avoid duplicate column in INSERT
        if col_name in SYSTEM_COLS:
            continue
        if col_name in col_values:
            col_names.append(f'"{col_name}"')
            col_placeholders.append(f":{col_name}")
            params[col_name] = col_values[col_name]

    insert_sql = f"INSERT INTO {table_name} ({', '.join(col_names)}) VALUES ({', '.join(col_placeholders)})"
    db.session.execute(db.text(insert_sql), params)

    manufacturers = data.get("manufacturers", [])
    if isinstance(manufacturers, list) and len(manufacturers) > 0:
        for m in manufacturers:
            mpn = str(m.get("mpn", "")).strip()
            make = str(m.get("make", "")).strip()
            if mpn or make:
                db.session.execute(db.text(
                    "INSERT INTO part.manufacturers (part_number, mpn, make) VALUES (:pn, :mpn, :make)"
                ), {"pn": part_number, "mpn": mpn, "make": make})

    _log_audit('GENERATE', 'Part', part_number, details=f"Part {part_number} generated", new_values={"part_number": part_number, "description": description, "is_bought_out": is_bought_out, "is_manufactured": is_manufactured, "attributes": col_values})
    db.session.commit()
    return {"success": True, "data": {"part_number": part_number, "description": description,
            "is_bought_out": is_bought_out, "is_manufactured": is_manufactured, "table": table_name}}


# ─── ALL PARTS (latest 100 across all subcategories, filterable) ───

@part_bp.route("/all-parts", methods=["GET"])
def list_all_parts():
    """List latest 100 parts across all (or filtered) subcategories."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    if not tenant_id or tenant_id in ('TEST', ''):
        tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958'
    category_id = request.args.get("category_id", "")
    subcategory_id = request.args.get("subcategory_id", "")
    category_ids = request.args.get("category_ids", "")
    subcategory_ids = request.args.get("subcategory_ids", "")
    search_q = request.args.get("q", "").strip()

    where = "s.tenant_id = :tid AND s.is_deleted = false"
    params = {"tid": tenant_id}
    if subcategory_ids:
        sids = [s.strip() for s in subcategory_ids.split(",") if s.strip()]
        if sids:
            where += f" AND s.id IN ({','.join([':sid_'+str(i) for i in range(len(sids))])})"
            for i, sid in enumerate(sids):
                params[f"sid_{i}"] = sid
    elif subcategory_id:
        where += " AND s.id = :sid"
        params["sid"] = subcategory_id
    elif category_ids:
        cids = [c.strip() for c in category_ids.split(",") if c.strip()]
        if cids:
            where += f" AND s.category_id IN ({','.join([':cid_'+str(i) for i in range(len(cids))])})"
            for i, cid in enumerate(cids):
                params[f"cid_{i}"] = cid
    elif category_id:
        where += " AND s.category_id = :cid"
        params["cid"] = category_id

    subs = db.session.execute(db.text(
        f"SELECT s.id, s.name, s.series_prefix, c.name as cat_name, c.series_prefix as cat_series "
        f"FROM part.subcategories s JOIN part.categories c ON s.category_id = c.id "
        f"WHERE {where}"
    ), params).fetchall()

    all_parts = []

    # Build a map: table_name -> list of (sub_id, sub_name) for fast lookup
    table_subs = {}
    for sub in subs:
        tname = _safe_table_name(sub[3], sub[4])
        if tname not in table_subs:
            table_subs[tname] = []
        table_subs[tname].append((sub[0], sub[1], sub[3]))  # (sub_id, sub_name, cat_name)

    for table_name, sub_list in table_subs.items():
        # Build subcategory_id filter for this table
        sub_ids = [s[0] for s in sub_list]
        sub_id_placeholders = ','.join([f':sub_id_{i}' for i in range(len(sub_ids))])
        sub_id_params = {f'sub_id_{i}': sid for i, sid in enumerate(sub_ids)}

        try:
            where_parts = [f"subcategory_id IN ({sub_id_placeholders})"]
            q_params = {**sub_id_params}

            if search_q:
                where_parts.append("(LOWER(part_number) LIKE LOWER(:q) OR LOWER(COALESCE(description,'')) LIKE LOWER(:q))")
                q_params["q"] = f"%{search_q}%"

            where_clause = " AND ".join(where_parts)
            # Try to fetch value column if it exists
            has_value = False
            try:
                db.session.execute(db.text(f"SELECT value FROM {table_name} LIMIT 0"))
                has_value = True
            except Exception:
                db.session.rollback()

            value_col = ", COALESCE(value::text, '') as value" if has_value else ", '' as value"
            result = db.session.execute(db.text(
                f"SELECT part_number, description, status, created_at, "
                f"COALESCE(created_by, '') as created_by, subcategory_id{value_col} FROM {table_name} "
                f"WHERE {where_clause} ORDER BY created_at DESC"
            ), q_params)

            sub_lookup = {s[0]: (s[1], s[2]) for s in sub_list}  # sub_id -> (sub_name, cat_name)
            for r in result:
                sid = r[5]
                sub_name, cat_name = sub_lookup.get(sid, ('', sub_list[0][2]))
                all_parts.append({
                    "part_number": r[0], "description": r[1] or '',
                    "status": r[2] or 'active', "created_at": str(r[3]) if r[3] else None,
                    "created_by": r[4] or '', "category": cat_name, "subcategory": sub_name,
                    "value": r[6] or ''
                })
        except Exception:
            db.session.rollback()
            continue
    all_parts.sort(key=lambda x: x['created_at'] or '', reverse=True)
    return {"success": True, "data": all_parts}


@part_bp.route("/delete-part", methods=["POST"])
def delete_part():
    """Permanently delete a part from its dynamic table and manufacturers."""
    data = request.get_json()
    part_number = data.get("part_number")
    subcategory_id = data.get("subcategory_id")
    if not part_number or not subcategory_id:
        return {"success": False, "message": "part_number and subcategory_id required"}, 400

    row = db.session.execute(db.text(
        "SELECT s.name, s.series_prefix, c.name as cat_name, c.series_prefix as cat_series "
        "FROM part.subcategories s JOIN part.categories c ON s.category_id = c.id "
        "WHERE s.id = :id AND s.is_deleted = false"
    ), {"id": subcategory_id}).first()
    if not row:
        return {"success": False, "message": "Subcategory not found"}, 404

    table_name = _safe_table_name(row[2], row[3])
    try:
        db.session.execute(db.text(f"DELETE FROM {table_name} WHERE part_number = :pn"), {"pn": part_number})
        db.session.execute(db.text("DELETE FROM part.manufacturers WHERE part_number = :pn"), {"pn": part_number})
        _log_audit('DELETE', 'Part', part_number, details=f"Part {part_number} permanently deleted")
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": f"Delete failed: {str(e)}"}, 500
    return {"success": True, "message": f"Part {part_number} deleted"}



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

    table_name = _safe_table_name(row[3], row[4])
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

    table_name = _safe_table_name(row[2], row[3])

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
    if not tenant_id or tenant_id in ('TEST', ''):
        tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958'
    subs = db.session.execute(db.text(
        "SELECT s.id, s.name, s.series_prefix, c.name as cat_name, c.series_prefix as cat_series "
        "FROM part.subcategories s JOIN part.categories c ON s.category_id = c.id "
        "WHERE s.tenant_id = :tid AND s.is_deleted = false"
    ), {"tid": tenant_id}).fetchall()

    all_obsolete = []
    for sub in subs:
        table_name = _safe_table_name(sub[3], sub[4])
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
    _log_audit('GRANT_ACCESS', 'Module User', user[1], details=f"Granted {role} role to {user[1]}", new_values={"email": user[1], "role": role, "permissions": permissions})
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


@part_bp.route("/users/<access_id>", methods=["DELETE"])
def revoke_module_user(access_id):
    """Revoke user's access to Part Management."""
    row = db.session.execute(db.text(
        "SELECT u.email FROM iam.module_access ma JOIN iam.users u ON ma.user_id = u.id WHERE ma.id = :id"
    ), {"id": access_id}).first()
    db.session.execute(db.text(
        "DELETE FROM iam.module_access WHERE id = :id"
    ), {"id": access_id})
    _log_audit('REVOKE_ACCESS', 'Module User', row[0] if row else access_id, details=f"Revoked access for {row[0] if row else access_id}")
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
    # Auto-sync: update Project Customer PO lines that have this customer_part_number
    cpn = data["customer_part_number"]
    ipn = data["internal_part_number"]
    idesc = data.get("internal_description", "")
    proj_rows = db.session.execute(db.text(
        "SELECT id, customer_pos FROM project.projects "
        "WHERE tenant_id = :tid AND is_deleted = false AND customer_pos IS NOT NULL"
    ), {"tid": tenant_id}).fetchall()
    for row in proj_rows:
        pos = row[1] if isinstance(row[1], list) else json.loads(row[1]) if row[1] else []
        changed = False
        for po in pos:
            for line in po.get("lines", []):
                if (line.get("part_number") or "").strip().lower() == cpn.lower():
                    line["internal_part_number"] = ipn
                    line["internal_description"] = idesc
                    changed = True
        if changed:
            db.session.execute(db.text(
                "UPDATE project.projects SET customer_pos=:pos, updated_at=NOW() WHERE id=:pid"
            ), {"pos": json.dumps(pos), "pid": row[0]})
    _log_audit('CREATE', 'Part Mapping', f"{data['internal_part_number']} -> {data['customer_part_number']}", details=f"Mapping created: {data['internal_part_number']} -> {data['customer_part_number']}", new_values={"internal_part_number": data["internal_part_number"], "customer_part_number": data["customer_part_number"], "internal_description": data.get("internal_description", ""), "customer_description": data.get("customer_description", ""), "organization_name": data.get("organization_name", "")})
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

    # Sync to Project Customer PO line items if requested
    if data.get("sync_pos"):
        # Get the old customer_part_number to find matching PO lines
        mapping = db.session.execute(db.text(
            "SELECT customer_part_number, internal_part_number, internal_description FROM part.customer_mappings WHERE id=:id"
        ), {"id": mapping_id}).first()
        if mapping:
            cpn = mapping[0]
            ipn = mapping[1] or ''
            idesc = mapping[2] or ''
            # Update all Project customer PO lines that have this customer_part_number
            proj_rows = db.session.execute(db.text(
                "SELECT id, customer_pos FROM project.projects "
                "WHERE tenant_id = :tid AND is_deleted = false AND customer_pos IS NOT NULL"
            ), {"tid": tenant_id}).fetchall()
            for row in proj_rows:
                pos = row[1] if isinstance(row[1], list) else json.loads(row[1]) if row[1] else []
                changed = False
                for po in pos:
                    for line in po.get("lines", []):
                        if (line.get("part_number") or "").strip().lower() == cpn.lower():
                            line["internal_part_number"] = ipn
                            line["internal_description"] = idesc
                            changed = True
                if changed:
                    db.session.execute(db.text(
                        "UPDATE project.projects SET customer_pos=:pos, updated_at=NOW() WHERE id=:pid"
                    ), {"pos": json.dumps(pos), "pid": row[0]})

    old_map = db.session.execute(db.text("SELECT internal_part_number, internal_description, customer_part_number, customer_description, organization_id, organization_name FROM part.customer_mappings WHERE id=:id"), {"id": mapping_id}).first()
    old_values = {}
    if old_map:
        old_values = {
            "internal_part_number": old_map[0], "internal_description": old_map[1],
            "customer_part_number": old_map[2], "customer_description": old_map[3],
            "organization_id": old_map[4], "organization_name": old_map[5]
        }
    new_values = {k: data.get(k, old_values.get(k)) for k in old_values.keys()}
    _log_audit('UPDATE', 'Part Mapping', mapping_id, details=f"Mapping updated: {mapping_id}", old_values=old_values, new_values=new_values)
    db.session.commit()
    return {"success": True, "message": "Mapping updated"}


@part_bp.route("/mappings/<mapping_id>", methods=["DELETE"])
def delete_mapping(mapping_id):
    row = db.session.execute(db.text("SELECT internal_part_number, customer_part_number FROM part.customer_mappings WHERE id=:id"), {"id": mapping_id}).first()
    
    db.session.execute(db.text(
        "UPDATE part.customer_mappings SET is_deleted=true, updated_at=NOW() WHERE id=:id"
    ), {"id": mapping_id})
    
    if row:
        ipn, cpn = row[0] or "", row[1] or ""
        if cpn and ipn:
            tenant_id = request.headers.get("X-Tenant-ID", "")
            # Sync to remove internal_part_number from matching PO lines
            proj_rows = db.session.execute(db.text(
                "SELECT id, customer_pos FROM project.projects "
                "WHERE tenant_id = :tid AND is_deleted = false AND customer_pos IS NOT NULL"
            ), {"tid": tenant_id}).fetchall()
            for p_row in proj_rows:
                pos = p_row[1] if isinstance(p_row[1], list) else json.loads(p_row[1]) if p_row[1] else []
                changed = False
                for po in pos:
                    for line in po.get("lines", []):
                        line_cpn = (line.get("part_number") or "").strip().lower()
                        line_ipn = (line.get("internal_part_number") or "").strip().lower()
                        if line_cpn == cpn.lower() and line_ipn == ipn.lower():
                            line["internal_part_number"] = ""
                            line["internal_description"] = ""
                            changed = True
                if changed:
                    db.session.execute(db.text(
                        "UPDATE project.projects SET customer_pos=:pos, updated_at=NOW() WHERE id=:pid"
                    ), {"pos": json.dumps(pos), "pid": p_row[0]})

    lbl = f"{row[0]} -> {row[1]}" if row else mapping_id
    _log_audit('DELETE', 'Part Mapping', lbl, details=f"Mapping {lbl} deleted")
    db.session.commit()
    return {"success": True, "message": "Mapping deleted"}


@part_bp.route("/search-parts", methods=["GET"])
def search_internal_parts():
    """Search across all part tables for internal part number + description."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    if not tenant_id or tenant_id in ('TEST', ''):
        tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958'
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
        table_name = _safe_table_name(sub[2], sub[3])
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
    table_name = _safe_table_name(row[2], row[3])
    try:
        if value == "":
            value = None
        if safe_field in ('is_bought_out', 'is_manufactured'):
            if isinstance(value, str):
                value = value.lower() in ('true', '1', 'yes', 't')
            else:
                value = bool(value)
        db.session.execute(db.text(
            f"UPDATE {table_name} SET {safe_field} = :val WHERE part_number = :pn"
        ), {"val": value, "pn": part_number})
        _log_audit('UPDATE', 'Part', part_number, f'Field {safe_field} updated')
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": f"Database error: {str(e)}"}, 500
    return {"success": True, "message": f"Field '{safe_field}' updated"}


@part_bp.route("/part-detail/<part_number>", methods=["GET"])
def get_part_detail(part_number):
    """Full detail for a single part: part data + all POs containing it."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    if not tenant_id or tenant_id in ('TEST', ''):
        tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958'

    # Find which table this part belongs to by scanning category tables
    # Build a map of table_name -> (cat_name, cat_series, cat_id) — one entry per unique table
    cats = db.session.execute(db.text(
        "SELECT id, name, series_prefix FROM part.categories WHERE is_deleted = false"
    )).fetchall()

    # Build subcategory lookup by id
    all_subs = db.session.execute(db.text(
        "SELECT s.id, s.name, c.name as cat_name, c.series_prefix as cat_series, c.id as cat_id, s.columns_config "
        "FROM part.subcategories s JOIN part.categories c ON s.category_id = c.id "
        "WHERE s.tenant_id = :tid AND s.is_deleted = false"
    ), {"tid": tenant_id}).fetchall()
    sub_by_id = {s[0]: {"sub_name": s[1], "cat_name": s[2], "cat_series": s[3], "cat_id": s[4], "columns_config": s[5]} for s in all_subs}

    SYSTEM_COLS = {'id','part_number','subcategory_id','status','created_at','updated_at',
                   'description','created_by','is_bought_out','is_manufactured',
                   'obsoleted_at','obsolete_reason'}

    part_data = None
    seen_tables = set()
    for cat in cats:
        table_name = _safe_table_name(cat[1], cat[2])
        if table_name in seen_tables:
            continue
        seen_tables.add(table_name)
        try:
            result = db.session.execute(db.text(
                f"SELECT * FROM {table_name} WHERE part_number = :pn LIMIT 1"
            ), {"pn": part_number})
            row = result.first()
            if row:
                keys = result.keys() if hasattr(result, 'keys') else []
                # Re-query to get keys
                result2 = db.session.execute(db.text(
                    f"SELECT * FROM {table_name} WHERE part_number = :pn LIMIT 1"
                ), {"pn": part_number})
                keys = result2.keys()
                row2 = result2.first()
                part_data = dict(zip(keys, row2))
                for k, v in part_data.items():
                    if hasattr(v, 'isoformat'):
                        part_data[k] = v.isoformat()
                    elif isinstance(v, uuid.UUID):
                        part_data[k] = str(v)
                # Resolve subcategory from the part's own subcategory_id
                sid = str(part_data.get('subcategory_id', ''))
                sub_info = sub_by_id.get(sid, {})
                part_data['category'] = sub_info.get('cat_name', cat[1])
                part_data['category_id'] = sub_info.get('cat_id', cat[0])
                part_data['subcategory'] = sub_info.get('sub_name', '')
                part_data['subcategory_id'] = sid
                # Use columns_config from subcategory record (properly set)
                sub_cols_cfg = sub_info.get('columns_config')
                if sub_cols_cfg:
                    part_data['columns_config'] = sub_cols_cfg if isinstance(sub_cols_cfg, list) else (json.loads(sub_cols_cfg) if sub_cols_cfg else [])
                else:
                    part_data['columns_config'] = [
                        {"name": k, "label": k.replace('_', ' ').title(), "type": "varchar"}
                        for k in part_data.keys()
                        if k not in SYSTEM_COLS
                        and k not in ('category','category_id','subcategory','subcategory_id','columns_config')
                    ]
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
    customer_pns = [m["customer_part_number"] for m in mapping_list if (m.get("customer_part_number") or "").strip()]

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
            
            is_match = False
            if ipn:
                is_match = (ipn.lower() == part_number.lower())
            else:
                is_match = (cpn and cpn.lower() in [c.lower() for c in customer_pns])

            if is_match:
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

    # Collect all customer POs containing this part
    customer_pos_appearances = []
    try:
        cust_po_rows = db.session.execute(db.text(
            "SELECT id, name, customer_pos FROM project.projects "
            "WHERE tenant_id = :tid AND is_deleted = false AND customer_pos IS NOT NULL"
        ), {"tid": tenant_id}).fetchall()
        for row in cust_po_rows:
            proj_id, proj_name, pos_json = row[0], row[1], row[2]
            pos = pos_json if isinstance(pos_json, list) else (json.loads(pos_json) if pos_json else [])
            for po in pos:
                matched_lines = []
                po_number = po.get("po_number") or po.get("doc_no") or "PO"
                po_date = po.get("po_date") or po.get("date") or ""
                po_status = po.get("status") or "open"
                po_total = po.get("amount") or po.get("total") or 0
                
                for line in po.get("lines", []):
                    ipn = (line.get("internal_part_number") or "").strip()
                    cpn = (line.get("part_number") or "").strip()
                    
                    is_match = False
                    if (cpn and cpn.lower() in [c.lower() for c in customer_pns]) or (cpn and cpn.lower() == part_number.lower()):
                        is_match = True
                        
                    if is_match:
                        matched_lines.append({
                            "customer_part_number": cpn,
                            "internal_part_number": ipn,
                            "description": line.get("internal_description") or line.get("description") or "",
                            "quantity": line.get("qty") or line.get("quantity") or 0,
                            "price": line.get("cost") or line.get("price") or line.get("price_per_quantity") or 0,
                            "unit": line.get("unit") or ""
                        })
                if matched_lines:
                    customer_pos_appearances.append({
                        "po_number": po_number,
                        "po_date": po_date,
                        "status": po_status,
                        "total": po_total,
                        "project_id": str(proj_id),
                        "project_name": proj_name,
                        "matched_lines": matched_lines
                    })
    except Exception as e:
        print(f"Error reading customer POs: {e}")
        db.session.rollback()

    # Sort Customer POs by date descending
    customer_pos_appearances.sort(key=lambda x: x.get("po_date") or "", reverse=True)

    # Get manufacturer parts (AML)
    aml_rows = db.session.execute(db.text(
        "SELECT id, mpn, make, created_at FROM part.manufacturers WHERE part_number = :pn ORDER BY created_at ASC"
    ), {"pn": part_number}).fetchall()
    
    aml_list = []
    for r in aml_rows:
        aml_dict = {"id": str(r[0]), "mpn": r[1], "make": r[2], "created_at": str(r[3]), "suppliers": []}
        
        # Fetch suppliers for this MPN/Make from supplier.parts
        # We need supplier name, ID, and prices
        sup_rows = db.session.execute(db.text(
            "SELECT s.id, s.brand_name as name, sp.moq, sp.moq_price, sp.spq, sp.spq_price, sp.sample_qty, sp.sample_price, sp.id as item_id "
            "FROM supplier.parts sp "
            "JOIN supplier.suppliers s ON sp.supplier_id = s.id "
            "WHERE sp.part_code = :pn AND sp.mpn = :mpn AND sp.make = :make AND sp.is_deleted = false"
        ), {"pn": part_number, "mpn": r[1], "make": r[2]}).fetchall()
        
        for sr in sup_rows:
            aml_dict["suppliers"].append({
                "supplier_id": str(sr[0]),
                "supplier_name": sr[1],
                "moq": float(sr[2] or 0),
                "moq_price": float(sr[3] or 0),
                "spq": float(sr[4] or 0),
                "spq_price": float(sr[5] or 0),
                "sample_qty": float(sr[6] or 0),
                "sample_price": float(sr[7] or 0),
                "item_id": str(sr[8])
            })
            
        aml_list.append(aml_dict)

    # Inventory from inventory_stock_levels + inventory_locations
    inv_rows = db.session.execute(db.text(
        "SELECT sl.bin_code, sl.manufacturer, sl.qty_on_hand, "
        "COALESCE(il.location_code,'') as location_code, "
        "COALESCE(il.plant,'') as plant, "
        "COALESCE(il.floor_name,'') as floor_name, "
        "COALESCE(il.shelf_name,'') as shelf_name "
        "FROM inventory_stock_levels sl "
        "LEFT JOIN inventory_locations il ON il.bin_code = sl.bin_code "
        "WHERE sl.part_number = :pn AND sl.is_deleted = false "
        "ORDER BY sl.bin_code, sl.manufacturer"
    ), {"pn": part_number}).fetchall()
    inventory_items = [{
        "bin_code": r[0], "manufacturer": r[1] or '',
        "qty": float(r[2] or 0),
        "location_code": r[3], "plant": r[4],
        "floor": r[5], "shelf": r[6]
    } for r in inv_rows]
    total_inventory_qty = sum(i["qty"] for i in inventory_items)

    return {"success": True, "data": {
        "part": part_data,
        "manufacturers": aml_list,
        "mappings": mapping_list,
        "rm_mappings": rm_mapping_list,
        "purchase_orders": po_appearances,
        "customer_purchase_orders": customer_pos_appearances,
        "total_ordered_qty": total_ordered_qty,
        "po_count": len(po_appearances),
        "inventory": inventory_items,
        "total_inventory_qty": total_inventory_qty
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
    """List customer part numbers from Project CPOs that have no mapping yet."""
    tenant_id = request.headers.get("X-Tenant-ID", "")

    # All already-mapped customer part numbers
    mapped_rows = db.session.execute(db.text(
        "SELECT LOWER(customer_part_number) FROM part.customer_mappings "
        "WHERE (tenant_id = :tid OR tenant_id IS NULL) AND is_deleted = false"
    ), {"tid": tenant_id})
    mapped_set = {r[0] for r in mapped_rows}

    unmapped = []
    seen = set()

    # ── Source: project.projects.customer_pos (JSONB) ────────────────
    proj_rows = db.session.execute(db.text(
        "SELECT code, customer_pos FROM project.projects "
        "WHERE tenant_id = :tid AND is_deleted = false AND customer_pos IS NOT NULL"
    ), {"tid": tenant_id}).fetchall()
    for row in proj_rows:
        pos = row[1] if isinstance(row[1], list) else (json.loads(row[1]) if row[1] else [])
        for po in pos:
            po_ref = po.get("po_number") or row[0] or "Project PO"
            for line in (po.get("lines") or []):
                # lines have: part_number, description, qty, cost
                cpn = (line.get("part_number") or "").strip()
                if cpn and cpn.lower() not in mapped_set and cpn.lower() not in seen:
                    unmapped.append({"customer_part_number": cpn, "po_number": po_ref, "source": "project"})
                    seen.add(cpn.lower())

    return {"success": True, "data": unmapped}


# ─── AUDIT HELPER ───

def _log_audit(action, entity_type, entity_id, details='', old_values=None, new_values=None):
    """Log action to audit.logs table with user info, real client IP, and change details."""
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
            "VALUES (gen_random_uuid(), :action, 'Part Management', :etype, :eid, :ip, "
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


# ─── NOTIFY PROCUREMENT AFTER MAPPING (called after create/update mapping) ───

@part_bp.route("/mappings/<mapping_id>/notify-procurement", methods=["POST"])
def notify_procurement_after_mapping(mapping_id):
    """After mapping a part, notify Procurement so they can re-check PO mapping status."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    data = request.get_json() or {}

    mapping = db.session.execute(db.text(
        "SELECT internal_part_number, customer_part_number FROM part.customer_mappings WHERE id=:id"
    ), {"id": mapping_id}).first()
    if not mapping:
        return {"success": False, "message": "Mapping not found"}, 404

    cpn = mapping[1]
    ipn = mapping[0]

    # Find all POs with this customer_part_number that are in approved_pending_mapping status
    po_rows = db.session.execute(db.text(
        "SELECT id, doc_no FROM procurement.purchase_orders "
        "WHERE status = 'approved_pending_mapping' AND is_deleted = false "
        "AND (tenant_id = :tid OR tenant_id IS NULL) AND lines IS NOT NULL"
    ), {"tid": tenant_id}).fetchall()

    notified_pos = []
    for po in po_rows:
        lines = db.session.execute(db.text(
            "SELECT lines FROM procurement.purchase_orders WHERE id=:id"
        ), {"id": po[0]}).scalar()
        lines = lines if isinstance(lines, list) else (json.loads(lines) if lines else [])
        has_cpn = any((l.get("customer_part_number") or "").lower() == cpn.lower() for l in lines)
        if has_cpn:
            # Notify Procurement
            try:
                db.session.execute(db.text(
                    "INSERT INTO planning.notifications (id, module, event_type, reference_no, reference_id, "
                    "title, message, recipient_role, tenant_id, created_at) "
                    "VALUES (gen_random_uuid(), 'Part Management', 'MAPPING_DONE', :ref_no, :ref_id, "
                    ":title, :msg, 'purchaser', :tid, NOW())"
                ), {
                    "ref_no": po[1], "ref_id": po[0],
                    "title": f"Part Mapped: {cpn} → {ipn}",
                    "msg": f"Customer part '{cpn}' has been mapped to internal part '{ipn}'. "
                           f"PO {po[1]} can now be fully approved. Please re-check mapping status.",
                    "tid": tenant_id
                })
            except Exception:
                pass
            notified_pos.append(po[1])

    db.session.commit()
    return {"success": True, "message": f"Procurement notified for POs: {', '.join(notified_pos) or 'none'}",
            "notified_pos": notified_pos}

# ─── MANUFACTURERS (AML) ───

@part_bp.route("/manufacturers/<part_number>", methods=["GET"])
def get_part_manufacturers(part_number):
    try:
        rows = db.session.execute(db.text(
            "SELECT id, mpn, make FROM part.manufacturers WHERE part_number = :pn ORDER BY created_at ASC"
        ), {"pn": part_number}).fetchall()
        
        aml_list = [{"id": str(r[0]), "mpn": r[1], "make": r[2]} for r in rows]
        return {"success": True, "data": aml_list}
    except Exception as e:
        print(f"Error fetching part manufacturers: {e}")
        return {"success": False, "message": "Failed to fetch manufacturers"}, 500

@part_bp.route("/manufacturers", methods=["POST"])
def add_manufacturer():
    data = request.get_json()
    part_number = data.get("part_number")
    mpn = str(data.get("mpn", "")).strip()
    make = str(data.get("make", "")).strip()
    
    if not part_number or (not mpn and not make):
        return {"success": False, "message": "Part number and either MPN or Make are required"}, 400
        
    new_id = db.session.execute(db.text(
        "INSERT INTO part.manufacturers (part_number, mpn, make) VALUES (:pn, :mpn, :make) RETURNING id"
    ), {"pn": part_number, "mpn": mpn, "make": make}).scalar()
    
    _log_audit('CREATE', 'Manufacturer', part_number, details=f"Added MPN: {mpn}, Make: {make}")
    db.session.commit()
    return {"success": True, "data": {"id": str(new_id)}, "message": "Manufacturer combination added"}

@part_bp.route("/manufacturers/<mid>", methods=["DELETE"])
def delete_manufacturer(mid):
    row = db.session.execute(db.text("SELECT part_number FROM part.manufacturers WHERE id = :id"), {"id": mid}).first()
    if not row:
        return {"success": False, "message": "Record not found"}, 404
        
    db.session.execute(db.text("DELETE FROM part.manufacturers WHERE id = :id"), {"id": mid})
    _log_audit('DELETE', 'Manufacturer', row[0], details=f"Deleted manufacturer record {mid}")
    db.session.commit()
    return {"success": True, "message": "Manufacturer combination deleted"}
