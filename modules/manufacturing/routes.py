import uuid
import json
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from extensions import db

bom_api_bp = Blueprint("bom_api_bp", __name__)

import os
import io
from werkzeug.utils import secure_filename

# Directory for file attachments
MFG_BOM_FILES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'mfg_bom_files')
os.makedirs(MFG_BOM_FILES_DIR, exist_ok=True)


def _calc_mfg_bom_cost_sql(bom_id, tenant_id, visited=None):
    if visited is None:
        visited = set()
    if bom_id in visited:
        return 0.0
    visited.add(bom_id)

    rows_sel = db.session.execute(db.text(
        "SELECT part_number, unit_cost FROM manufacturing_bom_costing_selections WHERE bom_id = :bid AND tenant_id = :tid"
    ), {"bid": bom_id, "tid": tenant_id}).fetchall()
    selections = {r[0]: float(r[1] or 0) for r in rows_sel}

    items = db.session.execute(db.text(
        "SELECT child_type, child_part_code, quantity, unit_cost, procurement_type FROM manufacturing_bom_items WHERE bom_id = :bid AND tenant_id = :tid AND status = 'Active'"
    ), {"bid": bom_id, "tid": tenant_id}).fetchall()

    total_cost = 0.0
    for child_type, child_part_code, quantity, unit_cost, procurement_type in items:
        qty = float(quantity or 1)
        item_cost = 0.0
        
        proc_type = procurement_type or ('manufacturing' if child_type == 'assembly' else 'bought_out')
        if child_type == 'assembly' and proc_type == 'manufacturing':
            sub_bom = db.session.execute(db.text(
                "SELECT id FROM manufacturing_boms WHERE fg_part_number = :p AND is_deleted = false AND tenant_id = :tid LIMIT 1"
            ), {"p": child_part_code, "tid": tenant_id}).fetchone()
            if sub_bom:
                item_cost = _calc_mfg_bom_cost_sql(sub_bom[0], tenant_id, visited.copy())
            else:
                item_cost = float(unit_cost or 0)
        else:
            if child_part_code in selections and selections[child_part_code] > 0:
                item_cost = selections[child_part_code]
            else:
                stock_cost = db.session.execute(db.text(
                    "SELECT unit_cost FROM inventory_stock_levels WHERE part_number = :p AND is_deleted = false AND tenant_id = :tid ORDER BY updated_at DESC LIMIT 1"
                ), {"p": child_part_code, "tid": tenant_id}).scalar()
                if stock_cost is not None and float(stock_cost) > 0:
                    item_cost = float(stock_cost)
                else:
                    item_cost = float(unit_cost or 0)

        total_cost += item_cost * qty

    return total_cost


def _count_mfg_bom_items_sql(bom_id, tenant_id, visited=None):
    if visited is None:
        visited = set()
    if bom_id in visited:
        return 0
    visited.add(bom_id)

    items = db.session.execute(db.text(
        "SELECT child_type, child_part_code FROM manufacturing_bom_items WHERE bom_id = :bid AND tenant_id = :tid AND status = 'Active'"
    ), {"bid": bom_id, "tid": tenant_id}).fetchall()

    total = len(items)
    for child_type, child_part_code in items:
        if child_type == 'assembly':
            sub_bom = db.session.execute(db.text(
                "SELECT id FROM manufacturing_boms WHERE fg_part_number = :p AND is_deleted = false AND tenant_id = :tid LIMIT 1"
            ), {"p": child_part_code, "tid": tenant_id}).fetchone()
            if sub_bom:
                total += _count_mfg_bom_items_sql(sub_bom[0], tenant_id, visited.copy())
    return total


def _expand_mfg_bom_items_sql(bom_id, tenant_id, base_level=1, visited=None):
    if visited is None:
        visited = set()
    if bom_id in visited:
        return []
    visited.add(bom_id)

    rows = db.session.execute(db.text(
        "SELECT id, parent_item_id, child_type, child_part_code, quantity, unit, level, reference, notes, material, unit_cost, status, revision, scrap_factor, operation_ref, procurement_type, pinned_version "
        "FROM manufacturing_bom_items WHERE bom_id = :bid AND tenant_id = :tid ORDER BY level, id"
    ), {"bid": bom_id, "tid": tenant_id}).fetchall()

    rows_sel = db.session.execute(db.text(
        "SELECT part_number, unit_cost FROM manufacturing_bom_costing_selections WHERE bom_id = :bid AND tenant_id = :tid"
    ), {"bid": bom_id, "tid": tenant_id}).fetchall()
    selections = {r[0]: float(r[1] or 0) for r in rows_sel}

    expanded_items = []
    for r in rows:
        item_id = str(r[0])
        parent_id = str(r[1]) if r[1] else None
        child_type = r[2]
        part_code = r[3]
        qty = float(r[4] or 1)
        unit = r[5] or "Nos"
        lvl = int(r[6] or 1)
        ref = r[7] or ""
        notes = r[8] or ""
        mat = r[9] or ""
        manual_cost = float(r[10] or 0)
        status = r[11] or "Active"
        rev = r[12] or ""
        scrap = float(r[13] or 0)
        op_ref = r[14] or ""
        proc_type = r[15] or ('manufacturing' if child_type == 'assembly' else 'bought_out')
        pinned = r[16] or ""

        desc = db.session.execute(db.text(
            "SELECT name FROM part.masters WHERE part_number = :p AND is_deleted = false AND tenant_id = :tid LIMIT 1"
        ), {"p": part_code, "tid": tenant_id}).scalar() or ""

        cost = 0.0
        sub_bom_id = None
        sub_bom_version = ""
        sub_bom_status = ""

        if child_type == 'assembly':
            sub_bom = db.session.execute(db.text(
                "SELECT id, current_version, status FROM manufacturing_boms WHERE fg_part_number = :p AND is_deleted = false AND tenant_id = :tid LIMIT 1"
            ), {"p": part_code, "tid": tenant_id}).fetchone()
            if sub_bom:
                sub_bom_id = str(sub_bom[0])
                sub_bom_version = sub_bom[1] or "V1"
                sub_bom_status = sub_bom[2] or "Draft"

            if proc_type == 'manufacturing' and sub_bom_id:
                cost = _calc_mfg_bom_cost_sql(sub_bom_id, tenant_id, visited.copy())
            else:
                if part_code in selections and selections[part_code] > 0:
                    cost = selections[part_code]
                else:
                    stock_cost = db.session.execute(db.text(
                        "SELECT unit_cost FROM inventory_stock_levels WHERE part_number = :p AND is_deleted = false AND tenant_id = :tid ORDER BY updated_at DESC LIMIT 1"
                    ), {"p": part_code, "tid": tenant_id}).scalar()
                    cost = float(stock_cost) if stock_cost is not None and float(stock_cost) > 0 else manual_cost
        else:
            if part_code in selections and selections[part_code] > 0:
                cost = selections[part_code]
            else:
                stock_cost = db.session.execute(db.text(
                    "SELECT unit_cost FROM inventory_stock_levels WHERE part_number = :p AND is_deleted = false AND tenant_id = :tid ORDER BY updated_at DESC LIMIT 1"
                ), {"p": part_code, "tid": tenant_id}).scalar()
                cost = float(stock_cost) if stock_cost is not None and float(stock_cost) > 0 else manual_cost

        item_data = {
            "id": item_id,
            "parent_item_id": parent_id,
            "child_type": child_type,
            "child_part_code": part_code,
            "quantity": qty,
            "unit": unit,
            "level": base_level + lvl - 1,
            "reference": ref,
            "notes": notes,
            "description": desc,
            "material": mat,
            "unit_cost": cost,
            "status": status,
            "revision": rev,
            "scrap_factor": scrap,
            "operation_ref": op_ref,
            "procurement_type": proc_type,
            "pinned_version": pinned
        }
        if sub_bom_id:
            item_data["sub_bom_id"] = sub_bom_id
            item_data["sub_bom_version"] = sub_bom_version
            item_data["sub_bom_status"] = sub_bom_status

        expanded_items.append(item_data)

        if child_type == 'assembly' and proc_type == 'manufacturing' and sub_bom_id:
            expanded_items.extend(_expand_mfg_bom_items_sql(sub_bom_id, tenant_id, base_level + lvl, visited.copy()))

    return expanded_items


def _expand_mfg_bom_snapshots_sql(bom_id, version, tenant_id, base_level=1, visited=None):
    if visited is None:
        visited = set()
    if bom_id in visited:
        return []
    visited.add(bom_id)

    rows = db.session.execute(db.text(
        "SELECT original_item_id, parent_item_id, child_type, child_part_code, quantity, unit, level, reference, notes, material, unit_cost, status, revision, scrap_factor, operation_ref, procurement_type "
        "FROM manufacturing_bom_item_snapshots WHERE bom_id = :bid AND version = :v AND tenant_id = :tid ORDER BY level, original_item_id"
    ), {"bid": bom_id, "v": version, "tid": tenant_id}).fetchall()

    expanded_items = []
    for r in rows:
        item_id = str(r[0]) if r[0] else None
        parent_id = str(r[1]) if r[1] else None
        child_type = r[2]
        part_code = r[3]
        qty = float(r[4] or 1)
        unit = r[5] or "Nos"
        lvl = int(r[6] or 1)
        ref = r[7] or ""
        notes = r[8] or ""
        mat = r[9] or ""
        manual_cost = float(r[10] or 0)
        status = r[11] or "Active"
        rev = r[12] or ""
        scrap = float(r[13] or 0)
        op_ref = r[14] or ""
        proc_type = r[15] or ('manufacturing' if child_type == 'assembly' else 'bought_out')

        desc = db.session.execute(db.text(
            "SELECT name FROM part.masters WHERE part_number = :p AND is_deleted = false AND tenant_id = :tid LIMIT 1"
        ), {"p": part_code, "tid": tenant_id}).scalar() or ""

        if not desc:
            # Try dynamic category tables
            cats = db.session.execute(db.text(
                "SELECT name, series_prefix FROM part.categories WHERE is_deleted = false"
            )).fetchall()
            import re as _re
            for cat in cats:
                tbl = f'part."{_re.sub(chr(91)+"^a-z0-9"+chr(93), "_", cat[0].lower().strip()).strip("_")}_{cat[1]}"'
                try:
                    row = db.session.execute(db.text(
                        f"SELECT COALESCE(description, name, '') FROM {tbl} WHERE part_number = :p LIMIT 1"
                    ), {"p": part_code}).scalar()
                    if row:
                        desc = row
                        break
                except Exception:
                    db.session.rollback()

        item_data = {
            "id": item_id,
            "parent_item_id": parent_id,
            "child_type": child_type,
            "child_part_code": part_code,
            "quantity": qty,
            "unit": unit,
            "level": base_level + lvl - 1,
            "reference": ref,
            "notes": notes,
            "description": desc,
            "material": mat,
            "unit_cost": manual_cost,
            "status": status,
            "revision": rev,
            "scrap_factor": scrap,
            "operation_ref": op_ref,
            "procurement_type": proc_type
        }

        sub_bom_id = None
        if child_type == 'assembly':
            sub_bom = db.session.execute(db.text(
                "SELECT id FROM manufacturing_boms WHERE fg_part_number = :p AND is_deleted = false AND tenant_id = :tid LIMIT 1"
            ), {"p": part_code, "tid": tenant_id}).fetchone()
            if sub_bom:
                sub_bom_id = str(sub_bom[0])
                item_data["sub_bom_id"] = sub_bom_id

        expanded_items.append(item_data)

        if child_type == 'assembly' and proc_type == 'manufacturing' and sub_bom_id:
            expanded_items.extend(_expand_mfg_bom_snapshots_sql(sub_bom_id, version, tenant_id, base_level + lvl, visited.copy()))

    return expanded_items


def _sync_bom_lines(bom_id, tenant_id):
    db.session.execute(db.text(
        "DELETE FROM manufacturing_bom_lines WHERE bom_id = :bid AND tenant_id = :tid"
    ), {"bid": bom_id, "tid": tenant_id})

    items = db.session.execute(db.text(
        "SELECT child_type, child_part_code, quantity, unit, scrap_factor, operation_ref "
        "FROM manufacturing_bom_items WHERE bom_id = :bid AND tenant_id = :tid AND status = 'Active'"
    ), {"bid": bom_id, "tid": tenant_id}).fetchall()

    for idx, (ctype, cno, qty, unit, scrap, op) in enumerate(items, start=1):
        desc = db.session.execute(db.text(
            "SELECT name FROM part.masters WHERE part_number = :p AND is_deleted = false AND tenant_id = :tid LIMIT 1"
        ), {"p": cno, "tid": tenant_id}).scalar() or ""
        
        db.session.execute(db.text(
            "INSERT INTO manufacturing_bom_lines (id, bom_id, sequence, component_type, component_no, component_description, qty_per, unit, scrap_factor, operation_ref, tenant_id) "
            "VALUES (:id, :bid, :seq, :ctype, :cno, :desc, :qty, :unit, :scrap, :op, :tid)"
        ), {
            "id": str(uuid.uuid4()), "bid": bom_id, "seq": idx * 10, "ctype": ctype.upper(),
            "cno": cno, "desc": desc, "qty": qty, "unit": unit or "pcs", "scrap": scrap or 0.0, "op": op or "-01", "tid": tenant_id
        })
    db.session.commit()


def _log_mfg_bom_history(bom_id, action, detail, user_name, tenant_id):
    db.session.execute(db.text(
        "INSERT INTO manufacturing_bom_history (id, bom_id, action, detail, performed_by, tenant_id, performed_at) "
        "VALUES (:id, :bid, :action, :detail, :user, :tid, NOW())"
    ), {
        "id": str(uuid.uuid4()), "bid": bom_id, "action": action, "detail": detail, "user": user_name, "tid": tenant_id
    })
    db.session.commit()


manufacturing_bp = Blueprint("manufacturing", __name__)


def _get_tenant():
    tid = "TEST"
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if isinstance(identity, dict):
            tid = identity.get("tenant_id", "TEST")
        elif isinstance(identity, str):
            try:
                data = json.loads(identity)
                tid = data.get("tenant_id", "TEST")
            except Exception:
                pass
    except Exception:
        pass
    
    header_tid = request.headers.get("X-Tenant-ID")
    if header_tid:
        tid = header_tid
        
    if not tid or tid in ("TEST", ""):
        tid = "b424df0e-f766-4e94-b3fd-05777e158958"
    return tid


@manufacturing_bp.route("/overview-stats", methods=["GET"])
def overview_stats():
    tenant_id = _get_tenant()
    tid_cond = "(tenant_id = :tid OR tenant_id = 'TEST' OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = '' OR tenant_id IS NULL)"
    try:
        total_boms = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM manufacturing_boms WHERE is_deleted = false AND {tid_cond}"
        ), {"tid": tenant_id}).scalar() or 0

        active_orders = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM manufacturing_production_orders WHERE status IN ('released', 'in_progress') AND is_deleted = false AND {tid_cond}"
        ), {"tid": tenant_id}).scalar() or 0

        work_centers = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM manufacturing_work_centers WHERE is_deleted = false AND {tid_cond}"
        ), {"tid": tenant_id}).scalar() or 0

        routings_count = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM manufacturing_routings WHERE is_deleted = false AND {tid_cond}"
        ), {"tid": tenant_id}).scalar() or 0

        completed_today = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM manufacturing_production_orders WHERE status = 'completed' AND is_deleted = false AND {tid_cond}"
        ), {"tid": tenant_id}).scalar() or 0

        return jsonify({
            "success": True,
            "data": {
                "total_boms": total_boms,
                "active_orders": active_orders,
                "work_centers": work_centers,
                "total_routings": routings_count,
                "completed_today": completed_today
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


# 1. BILL OF MATERIALS (BOM)
@manufacturing_bp.route("/boms", methods=["GET"])
def list_boms():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, bom_no, fg_part_number, fg_description, current_version, effective_date, status, yield_qty, unit, notes, name FROM manufacturing_boms WHERE is_deleted = false AND tenant_id = :tid ORDER BY created_at DESC"
    ), {"tid": tenant_id}).fetchall()

    boms = []
    for r in rows:
        bid = str(r[0])
        item_count = _count_mfg_bom_items_sql(bid, tenant_id)
        cost = _calc_mfg_bom_cost_sql(bid, tenant_id)

        boms.append({
            "id": bid,
            "bom_no": r[1],
            "fg_part_number": r[2],
            "fg_description": r[3] or "",
            "version": r[4] or "V1",
            "effective_date": str(r[5]) if r[5] else "",
            "status": r[6] or "Draft",
            "yield_qty": float(r[7] or 1),
            "unit": r[8] or "pcs",
            "notes": r[9] or "",
            "name": r[10] or r[1] or "",
            "item_count": item_count,
            "cost": cost
        })
    return jsonify({"success": True, "data": boms})


@manufacturing_bp.route("/boms", methods=["POST"])
def create_bom():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    fg_part = data.get("fg_part_number")
    name = (data.get("name") or "").strip()
    if not fg_part:
        return jsonify({"success": False, "message": "Finished Good part number required"}), 400

    # Check if a BOM already exists for this FG Part
    existing = db.session.execute(db.text(
        "SELECT id FROM manufacturing_boms WHERE fg_part_number = :fg AND is_deleted = false AND tenant_id = :tid LIMIT 1"
    ), {"fg": fg_part, "tid": tenant_id}).fetchone()
    if existing:
        return jsonify({"success": False, "message": f"A BOM already exists for Finished Good {fg_part}"}), 400

    bid = str(uuid.uuid4())
    bno = data.get("bom_no") or f"BOM-{fg_part}"

    db.session.execute(db.text(
        "INSERT INTO manufacturing_boms (id, bom_no, fg_part_number, fg_description, current_version, effective_date, status, yield_qty, unit, notes, name, tenant_id) "
        "VALUES (:id, :bno, :fg, :desc, 'V1', :eff, 'Draft', :yield_qty, :unit, :notes, :name, :tid)"
    ), {
        "id": bid, "bno": bno, "fg": fg_part, "desc": data.get("fg_description", ""),
        "eff": datetime.now().strftime('%Y-%m-%d'),
        "yield_qty": float(data.get("yield_qty", 1)), "unit": data.get("unit", "pcs"),
        "notes": data.get("notes", ""), "name": name or bno, "tid": tenant_id
    })

    # Create Draft Version V1 record
    ver_id = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO manufacturing_bom_versions (id, bom_id, version, version_type, status, tenant_id, created_at) "
        "VALUES (:id, :bid, 'V1', 'minor', 'Draft', :tid, NOW())"
    ), {"id": ver_id, "bid": bid, "tid": tenant_id})

    # Add items to live working items table (manufacturing_bom_items)
    comps = data.get("components", [])
    for idx, c in enumerate(comps, start=1):
        item_id = str(uuid.uuid4())
        ctype = c.get("type", "component")
        cno = c.get("component_no")
        qty = float(c.get("qty_per", 1))
        unit = c.get("unit", "pcs")
        scrap = float(c.get("scrap_factor", 0))
        op = c.get("operation_ref", "-01")
        proc_type = c.get("procurement_type") or ('manufacturing' if ctype == 'assembly' else 'bought_out')
        
        db.session.execute(db.text(
            "INSERT INTO manufacturing_bom_items (id, bom_id, child_type, child_part_code, quantity, unit, level, scrap_factor, operation_ref, procurement_type, tenant_id, created_at) "
            "VALUES (:id, :bid, :ctype, :cno, :qty, :unit, 1, :scrap, :op, :proc_type, :tid, NOW())"
        ), {
            "id": item_id, "bid": bid, "ctype": ctype, "cno": cno, "qty": qty, "unit": unit, "scrap": scrap, "op": op, "proc_type": proc_type, "tid": tenant_id
        })

    # Create Mock CAD Drawing File on disk & DB
    file_id = str(uuid.uuid4())
    filename = f"BOM-{fg_part}-CAD-Template.pdf"
    stored_name = f"{file_id}_{filename}"
    filepath = os.path.join(MFG_BOM_FILES_DIR, stored_name)
    
    try:
        with open(filepath, "w", encoding="utf-8") as mock_f:
            mock_f.write(f"%PDF-1.4 Mock CAD Drawing Template for Assembly {fg_part} - BOM {bno}")
        
        db.session.execute(db.text(
            "INSERT INTO manufacturing_bom_files (id, bom_id, filename, filepath, file_type, file_size, doc_type, revision, description, uploaded_by, tenant_id) "
            "VALUES (:id, :bid, :fname, :fpath, 'pdf', :fsize, 'CAD Drawing', 'A', 'Initial CAD drawing placeholder generated upon BOM creation.', 'System', :tid)"
        ), {
            "id": file_id, "bid": bid, "fname": filename, "fpath": stored_name,
            "fsize": len(filename), "tid": tenant_id
        })
        _log_mfg_bom_history(bid, "Upload File", f"System generated initial drawing: {filename}", "System", tenant_id)
    except Exception as file_err:
        pass

    db.session.commit()
    
    # Synchronize manufacturing_bom_lines
    _sync_bom_lines(bid, tenant_id)
    _log_mfg_bom_history(bid, "Create", f"Initial draft created with version V1", "System", tenant_id)

    return jsonify({"success": True, "message": f"BOM {bno} created for {fg_part}", "id": bid})


# 2. ROUTING & OPERATION STEPS (-01 to -80)
@manufacturing_bp.route("/routings", methods=["GET"])
def list_routings():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, routing_no, part_number, part_description, version, status, notes FROM manufacturing_routings WHERE is_deleted = false AND tenant_id = :tid ORDER BY created_at DESC"
    ), {"tid": tenant_id}).fetchall()

    routings = []
    for r in rows:
        steps = db.session.execute(db.text(
            "SELECT id, sequence, operation_code, operation_name, work_center_code, work_center_name, setup_time_min, run_time_min_per_unit, sub_operations FROM manufacturing_routing_steps WHERE routing_id = :rid AND is_deleted = false ORDER BY sequence ASC"
        ), {"rid": r[0]}).fetchall()

        routings.append({
            "id": r[0], "routing_no": r[1], "part_number": r[2], "part_description": r[3] or "",
            "version": r[4] or "1.0", "status": r[5], "notes": r[6] or "",
            "steps": [{
                "id": s[0], "sequence": s[1], "operation_code": s[2], "operation_name": s[3] or "",
                "work_center_code": s[4] or "", "work_center_name": s[5] or "",
                "setup_time_min": float(s[6] or 0), "run_time_min_per_unit": float(s[7] or 0),
                "sub_operations": json.loads(s[8]) if s[8] and isinstance(s[8], str) and s[8].startswith("[") else []
            } for s in steps]
        })
    return jsonify({"success": True, "data": routings})


@manufacturing_bp.route("/routings", methods=["POST"])
def create_routing():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    part_num = data.get("part_number")
    if not part_num:
        return jsonify({"success": False, "message": "Base part number required"}), 400

    rid = str(uuid.uuid4())
    rno = data.get("routing_no") or f"RTG-{part_num}"

    db.session.execute(db.text(
        "INSERT INTO manufacturing_routings (id, routing_no, part_number, part_description, version, status, notes, tenant_id) "
        "VALUES (:id, :rno, :p, :desc, :ver, 'active', :notes, :tid)"
    ), {
        "id": rid, "rno": rno, "p": part_num, "desc": data.get("part_description", ""),
        "ver": data.get("version", "1.0"), "notes": data.get("notes", ""), "tid": tenant_id
    })

    # Default process steps -01, -02 if none provided
    steps = data.get("steps") or [
        {"operation_code": "-01", "operation_name": "Cutting & Blanking", "work_center_code": "WC-CUT", "setup_time_min": 15, "run_time_min_per_unit": 2, "sub_operations": [{"code": "-01-01", "name": "Raw Material Inspection"}, {"code": "-01-02", "name": "Precision Cutting"}]},
        {"operation_code": "-02", "operation_name": "CNC Machining", "work_center_code": "WC-CNC", "setup_time_min": 30, "run_time_min_per_unit": 5, "sub_operations": [{"code": "-02-01", "name": "Facing"}, {"code": "-02-02", "name": "Drilling & Tapping"}]}
    ]

    for idx, st in enumerate(steps, start=1):
        op_code = st.get("operation_code", f"-{idx:02d}")
        sub_ops_json = json.dumps(st.get("sub_operations", []))

        db.session.execute(db.text(
            "INSERT INTO manufacturing_routing_steps (id, routing_id, sequence, operation_code, operation_name, work_center_code, work_center_name, setup_time_min, run_time_min_per_unit, sub_operations, tenant_id) "
            "VALUES (:id, :rid, :seq, :op_code, :op_name, :wc_code, :wc_name, :setup, :run, :sub, :tid)"
        ), {
            "id": str(uuid.uuid4()), "rid": rid, "seq": idx * 10, "op_code": op_code,
            "op_name": st.get("operation_name", f"Process Step {op_code}"),
            "wc_code": st.get("work_center_code", "WC-MAIN"),
            "wc_name": st.get("work_center_name", "Main Station"),
            "setup": float(st.get("setup_time_min", 0)),
            "run": float(st.get("run_time_min_per_unit", 0)),
            "sub": sub_ops_json, "tid": tenant_id
        })

    db.session.commit()
    return jsonify({"success": True, "message": f"Routing {rno} created with operations", "id": rid})


# 3. WORK CENTERS & MHR
@manufacturing_bp.route("/work-centers", methods=["GET"])
def list_work_centers():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, code, name, machine_id, machine_name, capacity_hours_per_day, efficiency_pct, cost_rate_per_hour, mhr_rate, status FROM manufacturing_work_centers WHERE is_deleted = false AND tenant_id = :tid ORDER BY code ASC"
    ), {"tid": tenant_id}).fetchall()
    wcs = [{
        "id": r[0], "code": r[1], "name": r[2], "machine_id": r[3] or "",
        "machine_name": r[4] or "", "capacity_hours_per_day": float(r[5] or 8),
        "efficiency_pct": float(r[6] or 100), "cost_rate_per_hour": float(r[7] or 0),
        "mhr_rate": float(r[8] or (float(r[7] or 0) * (100.0 / max(1.0, float(r[6] or 100))))), "status": r[9]
    } for r in rows]
    return jsonify({"success": True, "data": wcs})


@manufacturing_bp.route("/work-centers", methods=["POST"])
def create_work_center():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    code = data.get("code")
    name = data.get("name")

    if not code or not name:
        return jsonify({"success": False, "message": "Work center code and name required"}), 400

    wcid = str(uuid.uuid4())
    cap = float(data.get("capacity_hours_per_day", 8))
    eff = float(data.get("efficiency_pct", 100))
    cost = float(data.get("cost_rate_per_hour", 50))
    mhr = cost * (100.0 / max(1.0, eff))  # Machine Hour Rate formula

    db.session.execute(db.text(
        "INSERT INTO manufacturing_work_centers (id, code, name, machine_id, machine_name, capacity_hours_per_day, efficiency_pct, cost_rate_per_hour, mhr_rate, status, tenant_id) "
        "VALUES (:id, :code, :name, :mid, :mname, :cap, :eff, :cost, :mhr, 'active', :tid)"
    ), {
        "id": wcid, "code": code, "name": name, "mid": data.get("machine_id", ""),
        "mname": data.get("machine_name", ""), "cap": cap, "eff": eff, "cost": cost, "mhr": round(mhr, 2), "tid": tenant_id
    })
    db.session.commit()
    return jsonify({"success": True, "message": f"Work center {code} created with MHR ₹{round(mhr,2)}/hr", "id": wcid})


# 4. PRODUCTION ORDERS
@manufacturing_bp.route("/production-orders", methods=["GET"])
def list_production_orders():
    tenant_id = _get_tenant()
    project_id = request.args.get("project_id", "").strip()
    where = "is_deleted = false AND tenant_id = :tid"
    params = {"tid": tenant_id}
    if project_id:
        where += " AND project_id = :pid"
        params["pid"] = project_id
    rows = db.session.execute(db.text(
        f"SELECT id, order_no, fg_part_number, fg_description, planned_qty, produced_qty, rejected_qty, planned_start, planned_end, status, priority, created_at, project_id FROM manufacturing_production_orders WHERE {where} ORDER BY created_at DESC"
    ), params).fetchall()
    orders = [{
        "id": r[0], "order_no": r[1], "fg_part_number": r[2], "fg_description": r[3] or "",
        "planned_qty": float(r[4] or 0), "produced_qty": float(r[5] or 0), "rejected_qty": float(r[6] or 0),
        "planned_start": r[7] or "", "planned_end": r[8] or "", "status": r[9], "priority": r[10] or "normal",
        "created_at": str(r[11]), "project_id": r[12] or ""
    } for r in rows]
    return jsonify({"success": True, "data": orders})


@manufacturing_bp.route("/production-orders", methods=["POST"])
def create_production_order():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    fg_part = data.get("fg_part_number")
    qty = float(data.get("planned_qty", 10))

    if not fg_part or qty <= 0:
        return jsonify({"success": False, "message": "FG Part number and valid planned qty required"}), 400

    if not fg_part.endswith("-99"):
        fg_part = f"{fg_part}-99"

    poid = str(uuid.uuid4())
    ono = f"PRD-{datetime.now().strftime('%Y%m%d%H%M')}"
    project_id = data.get("project_id") or None

    db.session.execute(db.text(
        "INSERT INTO manufacturing_production_orders (id, order_no, fg_part_number, fg_description, planned_qty, produced_qty, rejected_qty, planned_start, planned_end, status, priority, notes, project_id, tenant_id) "
        "VALUES (:id, :ono, :fg, :desc, :pqty, 0, 0, :pstart, :pend, 'released', :prio, :notes, :pid, :tid)"
    ), {
        "id": poid, "ono": ono, "fg": fg_part, "desc": data.get("fg_description", ""),
        "pqty": qty, "pstart": data.get("planned_start", datetime.now().strftime('%Y-%m-%d')),
        "pend": data.get("planned_end", (datetime.now() + timedelta(days=3)).strftime('%Y-%m-%d')),
        "prio": data.get("priority", "normal"), "notes": data.get("notes", ""),
        "pid": project_id, "tid": tenant_id
    })

    # Auto generate pick list for materials in Warehouse
    pkl_id = str(uuid.uuid4())
    lno = f"PKL-{ono}"
    db.session.execute(db.text(
        "INSERT INTO warehouse_pick_lists (id, list_no, reference_type, reference_no, warehouse_code, assigned_to, status, tenant_id) VALUES (:id, :lno, 'PRODUCTION_ORDER', :ono, 'MAIN', 'Shop Floor Team', 'open', :tid)"
    ), {"id": pkl_id, "lno": lno, "ono": ono, "tid": tenant_id})

    base_part = fg_part.replace("-99", "")
    db.session.execute(db.text(
        "INSERT INTO warehouse_pick_list_items (id, pick_list_id, part_number, part_description, bin_code, qty_required, qty_picked, status, tenant_id) VALUES (:id, :pid, :p, 'Raw component for FG', 'A-01-01', :qty, 0, 'pending', :tid)"
    ), {"id": str(uuid.uuid4()), "pid": pkl_id, "p": f"{base_part}-01", "qty": qty, "tid": tenant_id})

    db.session.commit()
    return jsonify({"success": True, "message": f"Production Order {ono} created & Pick List {lno} auto-generated", "order_no": ono, "id": poid})


# 5. SHOP FLOOR CONTROL
@manufacturing_bp.route("/shop-floor/log-op", methods=["POST"])
def shop_floor_log_op():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    order_no = data.get("production_order_no")
    base_part = data.get("part_number")
    op_code = data.get("operation_code", "-01")
    produced = float(data.get("qty_produced", 0))
    rejected = float(data.get("qty_rejected", 0))
    operator = data.get("operator", "Operator 1")

    if not order_no or not base_part:
        return jsonify({"success": False, "message": "Production order no and part number required"}), 400

    log_id = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO manufacturing_shop_floor_logs (id, production_order_no, part_number, operation_code, work_center_code, operator, start_time, end_time, qty_produced, qty_rejected, rejection_reason, actual_time_min, status, tenant_id) "
        "VALUES (:id, :ono, :p, :op, :wc, :operator, CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP, :prod, :rej, :reason, :atime, 'completed', :tid)"
    ), {
        "id": log_id, "ono": order_no, "p": base_part, "op": op_code,
        "wc": data.get("work_center_code", "WC-CNC"), "operator": operator,
        "prod": produced, "rej": rejected, "reason": data.get("rejection_reason", ""),
        "atime": float(data.get("actual_time_min", 30)), "tid": tenant_id
    })

    # Update production order progress
    db.session.execute(db.text(
        "UPDATE manufacturing_production_orders SET produced_qty = produced_qty + :prod, rejected_qty = rejected_qty + :rej, status = CASE WHEN produced_qty + :prod >= planned_qty THEN 'completed' ELSE 'in_progress' END WHERE order_no = :ono AND tenant_id = :tid"
    ), {"prod": produced, "rej": rejected, "ono": order_no, "tid": tenant_id})

    # If produced FG (-99), log stock receipt in inventory
    if produced > 0:
        fg_part = f"{base_part}-99" if not base_part.endswith("-99") else base_part
        db.session.execute(db.text(
            "INSERT INTO inventory_stock_movements (id, movement_no, movement_type, part_number, item_type, to_warehouse_code, to_bin_code, qty, reference_type, reference_no, performed_by, tenant_id) "
            "VALUES (:id, :mno, 'RECEIPT', :fg, 'FG', 'FG-WH', 'FG-A-01', :qty, 'PRODUCTION_ORDER', :ono, :operator, :tid)"
        ), {
            "id": str(uuid.uuid4()), "mno": f"FG-{datetime.now().strftime('%Y%m%d%H%M')}",
            "fg": fg_part, "qty": produced, "ono": order_no, "operator": operator, "tid": tenant_id
        })

    # If rejected (-88), log NG stock receipt in inventory
    if rejected > 0:
        ng_part = f"{base_part}-88" if not base_part.endswith("-88") else base_part
        db.session.execute(db.text(
            "INSERT INTO inventory_stock_movements (id, movement_no, movement_type, part_number, item_type, to_warehouse_code, to_bin_code, qty, reference_type, reference_no, reason, performed_by, tenant_id) "
            "VALUES (:id, :mno, 'SCRAP', :ng, 'NG', 'QC-WH', 'QUARANTINE', :qty, 'PRODUCTION_ORDER', :ono, 'Quality Rejection', :operator, :tid)"
        ), {
            "id": str(uuid.uuid4()), "mno": f"NG-{datetime.now().strftime('%Y%m%d%H%M')}",
            "ng": ng_part, "qty": rejected, "ono": order_no, "operator": operator, "tid": tenant_id
        })

    db.session.commit()
    return jsonify({"success": True, "message": f"Logged operation {op_code}: {produced} produced, {rejected} rejected (NG)"})


# 6. PLANNING & CAPACITY
@manufacturing_bp.route("/planning", methods=["GET"])
def production_planning():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT order_no, fg_part_number, planned_qty, produced_qty, planned_start, planned_end, status, priority FROM manufacturing_production_orders WHERE is_deleted = false AND tenant_id = :tid ORDER BY planned_start ASC"
    ), {"tid": tenant_id}).fetchall()
    plan = [{
        "order_no": r[0], "fg_part_number": r[1], "planned_qty": float(r[2] or 0),
        "produced_qty": float(r[3] or 0), "planned_start": r[4] or "", "planned_end": r[5] or "",
        "status": r[6], "priority": r[7]
    } for r in rows]
    return jsonify({"success": True, "data": plan})


@manufacturing_bp.route("/capacity", methods=["GET"])
def capacity_planning():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT code, name, capacity_hours_per_day, efficiency_pct, mhr_rate FROM manufacturing_work_centers WHERE is_deleted = false AND tenant_id = :tid"
    ), {"tid": tenant_id}).fetchall()
    capacity = [{
        "work_center": r[0], "name": r[1], "available_hours_per_day": float(r[2] or 8),
        "efficiency_pct": float(r[3] or 100), "allocated_hours": 6.5,
        "load_pct": round((6.5 / max(1.0, float(r[2] or 8))) * 100, 1), "mhr_rate": float(r[4] or 50)
    } for r in rows]
    return jsonify({"success": True, "data": capacity})


# AUDIT LOGS & USER MANAGEMENT FOR MANUFACTURING
@manufacturing_bp.route("/audit-logs", methods=["GET"])
def get_audit_logs():
    tenant_id = _get_tenant()
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 50, type=int)
    try:
        rows = db.session.execute(db.text(
            "SELECT h.action, h.detail, h.performed_by, h.performed_at, b.fg_part_number, b.bom_no "
            "FROM manufacturing_bom_history h "
            "JOIN manufacturing_boms b ON b.id = h.bom_id "
            "WHERE h.tenant_id = :tid "
            "ORDER BY h.performed_at DESC LIMIT :limit OFFSET :offset"
        ), {"tid": tenant_id, "limit": limit, "offset": (page - 1) * limit}).fetchall()
        items = [{
            "action": r[0],
            "detail": r[1] or "-",
            "performed_by": r[2] or "System",
            "performed_at": str(r[3]),
            "fg_part_number": r[4] or "-",
            "bom_no": r[5] or "-"
        } for r in rows]
        return jsonify({"success": True, "data": {"items": items, "total": len(items)}})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": True, "data": {"items": [], "total": 0}})


@manufacturing_bp.route("/users", methods=["GET"])
def get_module_users():
    tenant_id = _get_tenant()
    try:
        rows = db.session.execute(db.text(
            "SELECT ma.id, ma.user_id, ma.role, ma.permissions, ma.is_active, ma.created_at, "
            "u.email, u.first_name, u.last_name "
            "FROM iam.module_access ma JOIN iam.users u ON ma.user_id = u.id "
            "WHERE ma.module IN ('Manufacturing', 'Manufacturing Management') "
            "ORDER BY ma.created_at DESC"
        )).fetchall()
        items = [{
            "id": r[0], "user_id": r[1], "role": r[2], "permissions": r[3] or {},
            "is_active": r[4], "created_at": str(r[5]) if r[5] else None,
            "email": r[6], "first_name": r[7] or '', "last_name": r[8] or ''
        } for r in rows]
        return jsonify({"success": True, "data": items})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e), "data": []})


@manufacturing_bp.route("/users", methods=["POST"])
def add_module_user():
    data = request.get_json() or {}
    tenant_id = _get_tenant()
    user_id = data.get("user_id")
    role = data.get("role", "viewer")
    permissions = data.get("permissions", {})

    if not user_id:
        return jsonify({"success": False, "message": "user_id required"}), 400

    user = db.session.execute(db.text("SELECT id, email FROM iam.users WHERE id = :id AND is_deleted = false"), {"id": user_id}).first()
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404

    existing = db.session.execute(db.text("SELECT id FROM iam.module_access WHERE user_id = :uid AND module IN ('Manufacturing', 'Manufacturing Management')"), {"uid": user_id}).first()
    if existing:
        return jsonify({"success": False, "message": "User already has access to this module"}), 409

    access_id = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO iam.module_access (id, user_id, module, role, permissions, granted_by, tenant_id) "
        "VALUES (:id, :uid, 'Manufacturing', :role, :perms, 'system', :tid)"
    ), {"id": access_id, "uid": user_id, "role": role, "perms": json.dumps(permissions), "tid": tenant_id})
    db.session.commit()
    return jsonify({"success": True, "message": f"Access granted to {user[1]}"}), 201


@manufacturing_bp.route("/users/<access_id>", methods=["PUT"])
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
        return jsonify({"success": False, "message": "Nothing to update"}), 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE iam.module_access SET {', '.join(updates)} WHERE id=:id"), params)
    db.session.commit()
    return jsonify({"success": True, "message": "Access updated"})


@manufacturing_bp.route("/users/<access_id>", methods=["DELETE"])
def revoke_module_user(access_id):
    db.session.execute(db.text("DELETE FROM iam.module_access WHERE id = :id"), {"id": access_id})
    db.session.commit()
    return jsonify({"success": True, "message": "Access revoked"})

# ── ADDITIONAL DETAILED MANUFACTURING BOM ROUTES ──

@manufacturing_bp.route("/boms/by-part/<path:part_code>", methods=["GET"])
def get_bom_details_by_part(part_code):
    tenant_id = _get_tenant()
    bom = db.session.execute(db.text(
        "SELECT id FROM manufacturing_boms WHERE fg_part_number = :p AND is_deleted = false AND tenant_id = :tid LIMIT 1"
    ), {"p": part_code, "tid": tenant_id}).fetchone()
    
    if not bom:
        return jsonify({"success": False, "message": f"Manufacturing BOM not found for part {part_code}"}), 404
        
    return get_bom_details(str(bom[0]))


@manufacturing_bp.route("/boms/<bom_id>", methods=["GET"])
def get_bom_details(bom_id):
    tenant_id = _get_tenant()
    bom = db.session.execute(db.text(
        "SELECT id, bom_no, fg_part_number, fg_description, current_version, status, yield_qty, unit, notes, name, effective_date FROM manufacturing_boms WHERE id = :id AND is_deleted = false AND tenant_id = :tid"
    ), {"id": bom_id, "tid": tenant_id}).fetchone()
    
    if not bom:
        return jsonify({"success": False, "message": "Manufacturing BOM not found"}), 404

    viewing_version = request.args.get("version", "").strip()

    # Determine status of viewing version
    viewing_status = "Draft"
    if viewing_version:
        ver_status = db.session.execute(db.text(
            "SELECT status FROM manufacturing_bom_versions WHERE bom_id = :bid AND version = :v AND tenant_id = :tid LIMIT 1"
        ), {"bid": bom_id, "v": viewing_version, "tid": tenant_id}).scalar()
        if ver_status:
            viewing_status = ver_status
    else:
        viewing_status = bom[5] or "Draft"

    # Load items (snapshots if viewing old version, else live working items)
    if viewing_version and viewing_version != bom[4]:
        items = _expand_mfg_bom_snapshots_sql(bom_id, viewing_version, tenant_id)
    else:
        items = _expand_mfg_bom_items_sql(bom_id, tenant_id)

    # Cost rollup
    cost = _calc_mfg_bom_cost_sql(bom_id, tenant_id)

    # File attachments count
    files_count = db.session.execute(db.text(
        "SELECT COUNT(*) FROM manufacturing_bom_files WHERE bom_id = :bid AND tenant_id = :tid"
    ), {"bid": bom_id, "tid": tenant_id}).scalar() or 0

    return jsonify({
        "success": True,
        "data": {
            "id": str(bom[0]),
            "bom_no": bom[1],
            "fg_part_number": bom[2],
            "fg_description": bom[3] or "",
            "current_version": bom[4] or "V1",
            "status": bom[5] or "Draft",
            "yield_qty": float(bom[6] or 1),
            "unit": bom[7] or "pcs",
            "notes": bom[8] or "",
            "name": bom[9] or bom[1] or "",
            "effective_date": str(bom[10]) if bom[10] else "",
            "cost": cost,
            "files_count": files_count,
            "items": items,
            "viewing_version": viewing_version,
            "viewing_status": viewing_status
        }
    })


@manufacturing_bp.route("/boms/<bom_id>/add-item", methods=["POST"])
def add_bom_item(bom_id):
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    
    ctype = data.get("child_type")
    cno = data.get("child_part_code")
    qty = float(data.get("quantity") or 1)
    unit = data.get("unit") or "Nos"
    lvl = int(data.get("level") or 1)
    ref = data.get("reference") or ""
    notes = data.get("notes") or ""
    mat = data.get("material") or ""
    cost = float(data.get("unit_cost") or 0)
    rev = data.get("revision") or ""
    scrap = float(data.get("scrap_factor") or 0)
    op = data.get("operation_ref") or "-01"
    proc_type = data.get("procurement_type") or ('manufacturing' if ctype == 'assembly' else 'bought_out')
    parent_id = data.get("parent_item_id")

    if not ctype or not cno:
        return jsonify({"success": False, "message": "Part code and type are required"}), 400

    item_id = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO manufacturing_bom_items (id, bom_id, parent_item_id, child_type, child_part_code, quantity, unit, level, reference, notes, material, unit_cost, status, revision, scrap_factor, operation_ref, procurement_type, tenant_id, created_at) "
        "VALUES (:id, :bid, :parent_id, :ctype, :cno, :qty, :unit, :lvl, :ref, :notes, :mat, :cost, 'Active', :rev, :scrap, :op, :proc_type, :tid, NOW())"
    ), {
        "id": item_id, "bid": bom_id, "parent_id": parent_id, "ctype": ctype, "cno": cno, "qty": qty, "unit": unit,
        "lvl": lvl, "ref": ref, "notes": notes, "mat": mat, "cost": cost, "rev": rev, "scrap": scrap, "op": op, "proc_type": proc_type, "tid": tenant_id
    })
    db.session.commit()

    _sync_bom_lines(bom_id, tenant_id)
    _log_mfg_bom_history(bom_id, "Add Item", f"Added item {cno} ({ctype}) to tree level {lvl}", "User", tenant_id)

    return jsonify({"success": True, "message": "Item added successfully", "id": item_id})


@manufacturing_bp.route("/boms/<bom_id>/update-item/<item_id>", methods=["POST"])
def update_bom_item(bom_id, item_id):
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    
    updates = []
    params = {"id": item_id, "bid": bom_id, "tid": tenant_id}

    fields = ["quantity", "unit", "level", "reference", "notes", "material", "unit_cost", "status", "revision", "scrap_factor", "operation_ref", "procurement_type", "pinned_version"]
    for f in fields:
        if f in data:
            updates.append(f"{f}=:{f}")
            if f in ["quantity", "unit_cost", "scrap_factor"]:
                params[f] = float(data[f] or 0)
            elif f == "level":
                params[f] = int(data[f] or 1)
            else:
                params[f] = data[f]

    if not updates:
        return jsonify({"success": False, "message": "Nothing to update"}), 400

    db.session.execute(db.text(
        f"UPDATE manufacturing_bom_items SET {', '.join(updates)} WHERE id = :id AND bom_id = :bid AND tenant_id = :tid"
    ), params)
    db.session.commit()

    _sync_bom_lines(bom_id, tenant_id)
    _log_mfg_bom_history(bom_id, "Update Item", f"Updated item {item_id} fields: {', '.join(data.keys())}", "User", tenant_id)

    return jsonify({"success": True, "message": "Item updated successfully"})


@manufacturing_bp.route("/boms/<bom_id>/remove-item/<item_id>", methods=["POST"])
def remove_bom_item(bom_id, item_id):
    tenant_id = _get_tenant()
    
    # Recursively delete item children
    def delete_child_nodes(parent_id):
        rows = db.session.execute(db.text(
            "SELECT id FROM manufacturing_bom_items WHERE parent_item_id = :pid AND bom_id = :bid AND tenant_id = :tid"
        ), {"pid": parent_id, "bid": bom_id, "tid": tenant_id}).fetchall()
        for r in rows:
            delete_child_nodes(str(r[0]))
        db.session.execute(db.text(
            "DELETE FROM manufacturing_bom_items WHERE id = :id AND bom_id = :bid AND tenant_id = :tid"
        ), {"id": parent_id, "bid": bom_id, "tid": tenant_id})

    delete_child_nodes(item_id)
    db.session.commit()

    _sync_bom_lines(bom_id, tenant_id)
    _log_mfg_bom_history(bom_id, "Remove Item", f"Deleted item {item_id} and its tree descendants", "User", tenant_id)

    return jsonify({"success": True, "message": "Item removed successfully"})


@manufacturing_bp.route("/boms/<bom_id>/move-item/<item_id>", methods=["POST"])
def move_bom_item(bom_id, item_id):
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    new_parent = data.get("parent_item_id")
    new_level = int(data.get("level") or 1)

    db.session.execute(db.text(
        "UPDATE manufacturing_bom_items SET parent_item_id = :parent, level = :level WHERE id = :id AND bom_id = :bid AND tenant_id = :tid"
    ), {"id": item_id, "parent": new_parent, "level": new_level, "bid": bom_id, "tid": tenant_id})
    db.session.commit()

    _sync_bom_lines(bom_id, tenant_id)
    _log_mfg_bom_history(bom_id, "Move Item", f"Moved item {item_id} to new parent {new_parent} level {new_level}", "User", tenant_id)

    return jsonify({"success": True, "message": "Item moved successfully"})


def get_unreleased_sub_assemblies(bom_id, tenant_id, visited_parts=None):
    if visited_parts is None:
        visited_parts = set()
        
    unreleased = []
    
    # Get all active items in the current BOM
    items = db.session.execute(db.text(
        "SELECT child_part_code, child_type FROM manufacturing_bom_items "
        "WHERE bom_id = :bid AND tenant_id = :tid AND status = 'Active'"
    ), {"bid": bom_id, "tid": tenant_id}).fetchall()
    
    for item in items:
        part_code, child_type = item[0], item[1]
        if child_type == 'assembly':
            if part_code in visited_parts:
                continue
            visited_parts.add(part_code)
            
            # Look up BOM for this part
            sub_bom = db.session.execute(db.text(
                "SELECT id, status FROM manufacturing_boms WHERE fg_part_number = :part AND is_deleted = false AND tenant_id = :tid LIMIT 1"
            ), {"part": part_code, "tid": tenant_id}).fetchone()
            
            if not sub_bom:
                unreleased.append({"part_code": part_code, "status": "No BOM"})
            elif sub_bom[1] != 'Released':
                unreleased.append({"part_code": part_code, "status": sub_bom[1]})
                unreleased.extend(get_unreleased_sub_assemblies(sub_bom[0], tenant_id, visited_parts))
            else:
                unreleased.extend(get_unreleased_sub_assemblies(sub_bom[0], tenant_id, visited_parts))
                
    return unreleased


@manufacturing_bp.route("/boms/<bom_id>/enter-edit", methods=["POST"])
def enter_edit(bom_id):
    tenant_id = _get_tenant()

    # Clear old temporary edits under version '_edit_'
    db.session.execute(db.text(
        "DELETE FROM manufacturing_bom_item_snapshots WHERE bom_id = :bid AND version = '_edit_' AND tenant_id = :tid"
    ), {"bid": bom_id, "tid": tenant_id})

    # Save live items into '_edit_' snapshot
    items = db.session.execute(db.text(
        "SELECT id, parent_item_id, child_type, child_part_code, quantity, unit, level, reference, notes, material, unit_cost, status, revision, scrap_factor, operation_ref, procurement_type "
        "FROM manufacturing_bom_items WHERE bom_id = :bid AND tenant_id = :tid"
    ), {"bid": bom_id, "tid": tenant_id}).fetchall()

    for item in items:
        desc = db.session.execute(db.text(
            "SELECT name FROM part.masters WHERE part_number = :p AND is_deleted = false AND tenant_id = :tid LIMIT 1"
        ), {"p": item[3], "tid": tenant_id}).scalar() or ""

        db.session.execute(db.text(
            "INSERT INTO manufacturing_bom_item_snapshots (id, bom_id, version, original_item_id, parent_item_id, child_type, child_part_code, description, quantity, unit, level, reference, notes, material, unit_cost, status, revision, scrap_factor, operation_ref, procurement_type, tenant_id) "
            "VALUES (:id, :bid, '_edit_', :orig, :parent, :ctype, :cno, :desc, :qty, :unit, :lvl, :ref, :notes, :mat, :cost, :status, :rev, :scrap, :op, :proc_type, :tid)"
        ), {
            "id": str(uuid.uuid4()), "bid": bom_id, "orig": str(item[0]), "parent": str(item[1]) if item[1] else None,
            "ctype": item[2], "cno": item[3], "desc": desc, "qty": float(item[4] or 1), "unit": item[5], "lvl": int(item[6] or 1),
            "ref": item[7], "notes": item[8], "mat": item[9], "cost": float(item[10] or 0), "status": item[11], "rev": item[12],
            "scrap": float(item[13] or 0), "op": item[14], "proc_type": item[15], "tid": tenant_id
        })
    db.session.commit()

    _log_mfg_bom_history(bom_id, "Enter Edit", "BOM entered edit mode (checkpoint saved)", "User", tenant_id)
    return jsonify({"success": True, "message": "Edit mode entered"})


@manufacturing_bp.route("/boms/<bom_id>/cancel-edit", methods=["POST"])
def cancel_edit(bom_id):
    tenant_id = _get_tenant()

    # Clear current working copies
    db.session.execute(db.text(
        "DELETE FROM manufacturing_bom_items WHERE bom_id = :bid AND tenant_id = :tid"
    ), {"bid": bom_id, "tid": tenant_id})

    # Restore from '_edit_' snapshot
    snaps = db.session.execute(db.text(
        "SELECT original_item_id, parent_item_id, child_type, child_part_code, quantity, unit, level, reference, notes, material, unit_cost, status, revision, scrap_factor, operation_ref, procurement_type "
        "FROM manufacturing_bom_item_snapshots WHERE bom_id = :bid AND version = '_edit_' AND tenant_id = :tid"
    ), {"bid": bom_id, "tid": tenant_id}).fetchall()

    for s in snaps:
        db.session.execute(db.text(
            "INSERT INTO manufacturing_bom_items (id, bom_id, parent_item_id, child_type, child_part_code, quantity, unit, level, reference, notes, material, unit_cost, status, revision, scrap_factor, operation_ref, procurement_type, tenant_id, created_at) "
            "VALUES (:id, :bid, :parent, :ctype, :cno, :qty, :unit, :lvl, :ref, :notes, :mat, :cost, :status, :rev, :scrap, :op, :proc_type, :tid, NOW())"
        ), {
            "id": str(s[0]), "bid": bom_id, "parent": str(s[1]) if s[1] else None, "ctype": s[2], "cno": s[3],
            "qty": float(s[4] or 1), "unit": s[5], "lvl": int(s[6] or 1), "ref": s[7], "notes": s[8], "mat": s[9],
            "cost": float(s[10] or 0), "status": s[11], "rev": s[12], "scrap": float(s[13] or 0), "op": s[14], "proc_type": s[15], "tid": tenant_id
        })

    # Clear '_edit_' snapshot
    db.session.execute(db.text(
        "DELETE FROM manufacturing_bom_item_snapshots WHERE bom_id = :bid AND version = '_edit_' AND tenant_id = :tid"
    ), {"bid": bom_id, "tid": tenant_id})
    db.session.commit()

    _sync_bom_lines(bom_id, tenant_id)
    _log_mfg_bom_history(bom_id, "Cancel Edit", "Edits cancelled; rolled back to previous checkpoint", "User", tenant_id)
    return jsonify({"success": True, "message": "Edits reverted"})


@manufacturing_bp.route("/boms/<bom_id>/save-edit", methods=["POST"])
def save_edit(bom_id):
    tenant_id = _get_tenant()

    # Clear '_edit_' snapshot
    db.session.execute(db.text(
        "DELETE FROM manufacturing_bom_item_snapshots WHERE bom_id = :bid AND version = '_edit_' AND tenant_id = :tid"
    ), {"bid": bom_id, "tid": tenant_id})
    db.session.commit()

    _sync_bom_lines(bom_id, tenant_id)
    _log_mfg_bom_history(bom_id, "Save Edit", "BOM edits saved.", "User", tenant_id)

    return jsonify({"success": True, "message": "Edits saved successfully"})


@manufacturing_bp.route("/boms/<bom_id>/release", methods=["POST"])
def release_bom(bom_id):
    tenant_id = _get_tenant()

    # Recursive Validation for unreleased sub-assemblies
    unreleased = get_unreleased_sub_assemblies(bom_id, tenant_id)
    if unreleased:
        return jsonify({
            "success": False,
            "message": "Cannot release BOM: One or more nested sub-assemblies are not released.",
            "blocking_assemblies": unreleased
        }), 400

    current_ver = db.session.execute(db.text(
        "SELECT current_version FROM manufacturing_boms WHERE id = :id AND tenant_id = :tid"
    ), {"id": bom_id, "tid": tenant_id}).scalar() or "V1"

    # Update version status to Released
    db.session.execute(db.text(
        "UPDATE manufacturing_bom_versions SET status = 'Released', released_at = NOW() WHERE bom_id = :bid AND version = :v AND tenant_id = :tid"
    ), {"bid": bom_id, "v": current_ver, "tid": tenant_id})

    # Update BOM status to Released
    db.session.execute(db.text(
        "UPDATE manufacturing_boms SET status = 'Released' WHERE id = :id AND tenant_id = :tid"
    ), {"id": bom_id, "tid": tenant_id})

    # Check if a snapshot exists for the current version, if not, write a permanent snapshot to BomItemSnapshot
    snap_exists = db.session.execute(db.text(
        "SELECT 1 FROM manufacturing_bom_item_snapshots WHERE bom_id = :bid AND version = :v AND tenant_id = :tid LIMIT 1"
    ), {"bid": bom_id, "v": current_ver, "tid": tenant_id}).fetchone()

    if not snap_exists:
        items = db.session.execute(db.text(
            "SELECT id, parent_item_id, child_type, child_part_code, quantity, unit, level, reference, notes, material, unit_cost, status, revision, scrap_factor, operation_ref, procurement_type "
            "FROM manufacturing_bom_items WHERE bom_id = :bid AND tenant_id = :tid"
        ), {"bid": bom_id, "tid": tenant_id}).fetchall()

        for item in items:
            part_desc = db.session.execute(db.text(
                "SELECT name FROM part.masters WHERE part_number = :p AND is_deleted = false AND tenant_id = :tid LIMIT 1"
            ), {"p": item[3], "tid": tenant_id}).scalar() or ""

            db.session.execute(db.text(
                "INSERT INTO manufacturing_bom_item_snapshots (id, bom_id, version, original_item_id, parent_item_id, child_type, child_part_code, description, quantity, unit, level, reference, notes, material, unit_cost, status, revision, scrap_factor, operation_ref, procurement_type, tenant_id) "
                "VALUES (:id, :bid, :v, :orig, :parent, :ctype, :cno, :desc, :qty, :unit, :lvl, :ref, :notes, :mat, :cost, :status, :rev, :scrap, :op, :proc_type, :tid)"
            ), {
                "id": str(uuid.uuid4()), "bid": bom_id, "v": current_ver, "orig": str(item[0]), "parent": str(item[1]) if item[1] else None,
                "ctype": item[2], "cno": item[3], "desc": part_desc, "qty": float(item[4] or 1), "unit": item[5], "lvl": int(item[6] or 1),
                "ref": item[7], "notes": item[8], "mat": item[9], "cost": float(item[10] or 0), "status": item[11], "rev": item[12],
                "scrap": float(item[13] or 0), "op": item[14], "proc_type": item[15], "tid": tenant_id
            })

    db.session.commit()

    _sync_bom_lines(bom_id, tenant_id)
    _log_mfg_bom_history(bom_id, "Release", f"BOM version {current_ver} officially released.", "User", tenant_id)

    return jsonify({"success": True, "message": f"BOM version {current_ver} released successfully"})


@bom_api_bp.route("/<bom_id>/version_increment", methods=["POST"])
def version_increment(bom_id):
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    bump_type = data.get("bump_type") # major / minor
    desc = data.get("change_description") or ""

    if bump_type not in ["minor", "major"]:
        return jsonify({"success": False, "message": "Invalid version bump type. Must be 'major' or 'minor'"}), 400

    # Retrieve current version
    current_ver = db.session.execute(db.text(
        "SELECT current_version FROM manufacturing_boms WHERE id = :id AND tenant_id = :tid"
    ), {"id": bom_id, "tid": tenant_id}).scalar() or "V1"

    # 1. Snapshot the current state under the old version code (e.g. 'V1') if not already snapshotted
    snap_exists = db.session.execute(db.text(
        "SELECT 1 FROM manufacturing_bom_item_snapshots WHERE bom_id = :bid AND version = :v AND tenant_id = :tid LIMIT 1"
    ), {"bid": bom_id, "v": current_ver, "tid": tenant_id}).fetchone()

    if not snap_exists:
        items = db.session.execute(db.text(
            "SELECT id, parent_item_id, child_type, child_part_code, quantity, unit, level, reference, notes, material, unit_cost, status, revision, scrap_factor, operation_ref, procurement_type "
            "FROM manufacturing_bom_items WHERE bom_id = :bid AND tenant_id = :tid"
        ), {"bid": bom_id, "tid": tenant_id}).fetchall()

        for item in items:
            part_desc = db.session.execute(db.text(
                "SELECT name FROM part.masters WHERE part_number = :p AND is_deleted = false AND tenant_id = :tid LIMIT 1"
            ), {"p": item[3], "tid": tenant_id}).scalar() or ""

            db.session.execute(db.text(
                "INSERT INTO manufacturing_bom_item_snapshots (id, bom_id, version, original_item_id, parent_item_id, child_type, child_part_code, description, quantity, unit, level, reference, notes, material, unit_cost, status, revision, scrap_factor, operation_ref, procurement_type, tenant_id) "
                "VALUES (:id, :bid, :v, :orig, :parent, :ctype, :cno, :desc, :qty, :unit, :lvl, :ref, :notes, :mat, :cost, :status, :rev, :scrap, :op, :proc_type, :tid)"
            ), {
                "id": str(uuid.uuid4()), "bid": bom_id, "v": current_ver, "orig": str(item[0]), "parent": str(item[1]) if item[1] else None,
                "ctype": item[2], "cno": item[3], "desc": part_desc, "qty": float(item[4] or 1), "unit": item[5], "lvl": int(item[6] or 1),
                "ref": item[7], "notes": item[8], "mat": item[9], "cost": float(item[10] or 0), "status": item[11], "rev": item[12],
                "scrap": float(item[13] or 0), "op": item[14], "proc_type": item[15], "tid": tenant_id
            })

    # 2. Increment version label
    new_ver = current_ver
    try:
        ver_clean = current_ver.replace("V", "").strip()
        if "." in ver_clean:
            parts = ver_clean.split(".")
            major = int(parts[0])
            minor = int(parts[1]) if len(parts) > 1 else 0
        else:
            major = int(ver_clean)
            minor = 0

        if bump_type == "major":
            major += 1
            minor = 0
        else:
            minor += 1
        new_ver = f"V{major}.{minor}" if minor > 0 else f"V{major}"
    except Exception:
        new_ver = current_ver + ".1"

    # 3. Create a new BomVersion record with user supplied change description in Draft
    ver_id = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO manufacturing_bom_versions (id, bom_id, version, version_type, status, change_description, released_at, created_by, tenant_id, created_at) "
        "VALUES (:id, :bid, :v, :vtype, 'Draft', :desc, NULL, 'User', :tid, NOW())"
    ), {"id": ver_id, "bid": bom_id, "v": new_ver, "vtype": bump_type, "desc": desc, "tid": tenant_id})

    # 4. Set BOM status back to 'Draft' and update current version code
    db.session.execute(db.text(
        "UPDATE manufacturing_boms SET current_version = :ver, status = 'Draft' WHERE id = :id AND tenant_id = :tid"
    ), {"ver": new_ver, "id": bom_id, "tid": tenant_id})

    db.session.commit()

    _sync_bom_lines(bom_id, tenant_id)
    _log_mfg_bom_history(bom_id, "Version Increment", f"BOM version incremented from {current_ver} to {new_ver}. Status set to Draft.", "User", tenant_id)

    return jsonify({"success": True, "message": "Version incremented successfully", "new_version": new_ver})


@bom_api_bp.route("/<bom_id>/copy", methods=["POST"])
def copy_bom(bom_id):
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    new_part_code = (data.get("new_assembly_part_code") or "").strip()
    new_name = (data.get("new_name") or "").strip()

    if not new_part_code:
        return jsonify({"success": False, "message": "New assembly part code is required"}), 400

    # Verify if a BOM already exists for the target part code
    existing = db.session.execute(db.text(
        "SELECT id FROM manufacturing_boms WHERE fg_part_number = :fg AND is_deleted = false AND tenant_id = :tid LIMIT 1"
    ), {"fg": new_part_code, "tid": tenant_id}).fetchone()
    if existing:
        return jsonify({"success": False, "message": f"A BOM already exists for part code {new_part_code}"}), 400

    # Retrieve target part info from part master to get description
    part_row = db.session.execute(db.text(
        "SELECT name, description FROM part.masters WHERE part_number = :p AND is_deleted = false AND tenant_id = :tid LIMIT 1"
    ), {"p": new_part_code, "tid": tenant_id}).fetchone()
    
    # Relaxed tenant check if not found
    if not part_row:
        part_row = db.session.execute(db.text(
            "SELECT name, description FROM part.masters WHERE part_number = :p AND is_deleted = false LIMIT 1"
        ), {"p": new_part_code}).fetchone()

    part_desc = part_row[1] or part_row[0] if part_row else ""
    if not new_name:
        new_name = f"BOM for {new_part_code}"

    # 1. Create a new BOM header row
    new_bom_id = str(uuid.uuid4())
    bom_no = f"BOM-{new_part_code}"

    db.session.execute(db.text(
        "INSERT INTO manufacturing_boms (id, bom_no, fg_part_number, fg_description, current_version, effective_date, status, yield_qty, unit, notes, name, tenant_id) "
        "VALUES (:id, :bno, :fg, :desc, 'V1', :eff, 'Draft', 1, 'pcs', :notes, :name, :tid)"
    ), {
        "id": new_bom_id, "bno": bom_no, "fg": new_part_code, "desc": part_desc,
        "eff": datetime.now().strftime('%Y-%m-%d'), "notes": f"Copied from BOM ID {bom_id}",
        "name": new_name, "tid": tenant_id
    })

    # Create Draft Version V1 record for the new BOM
    ver_id = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO manufacturing_bom_versions (id, bom_id, version, version_type, status, change_description, tenant_id, created_at) "
        "VALUES (:id, :bid, 'V1', 'minor', 'Draft', 'Initial copied version', :tid, NOW())"
    ), {"id": ver_id, "bid": new_bom_id, "tid": tenant_id})

    # 2. Duplicate the entire BOM hierarchy (deep copy of all active BomItem records)
    items = db.session.execute(db.text(
        "SELECT id, parent_item_id, child_type, child_part_code, quantity, unit, level, reference, notes, material, unit_cost, status, revision, scrap_factor, operation_ref, procurement_type "
        "FROM manufacturing_bom_items WHERE bom_id = :bid AND tenant_id = :tid"
    ), {"bid": bom_id, "tid": tenant_id}).fetchall()

    # Generate mapping of old item ID to new item ID
    id_map = {}
    for item in items:
        id_map[str(item[0])] = str(uuid.uuid4())

    # Insert copied items mapping parent item IDs appropriately
    for item in items:
        old_id = str(item[0])
        old_parent_id = str(item[1]) if item[1] else None
        new_parent_id = id_map.get(old_parent_id) if old_parent_id else None

        db.session.execute(db.text(
            "INSERT INTO manufacturing_bom_items (id, bom_id, parent_item_id, child_type, child_part_code, quantity, unit, level, reference, notes, material, unit_cost, status, revision, scrap_factor, operation_ref, procurement_type, tenant_id, created_at) "
            "VALUES (:id, :bid, :parent, :ctype, :cno, :qty, :unit, :lvl, :ref, :notes, :mat, :cost, :status, :rev, :scrap, :op, :proc_type, :tid, NOW())"
        ), {
            "id": id_map[old_id], "bid": new_bom_id, "parent": new_parent_id, "ctype": item[2], "cno": item[3],
            "qty": float(item[4] or 1), "unit": item[5], "lvl": int(item[6] or 1), "ref": item[7], "notes": item[8], "mat": item[9],
            "cost": float(item[10] or 0), "status": item[11], "rev": item[12], "scrap": float(item[13] or 0), "op": item[14], "proc_type": item[15], "tid": tenant_id
        })

    db.session.commit()
    


    _sync_bom_lines(new_bom_id, tenant_id)
    _log_mfg_bom_history(new_bom_id, "Create", f"BOM created via Copy from BOM ID {bom_id}", "User", tenant_id)
    _log_mfg_bom_history(bom_id, "Copy BOM", f"BOM copied to new assembly part code {new_part_code}", "User", tenant_id)

    return jsonify({"success": True, "message": "BOM copied successfully", "new_bom_id": new_bom_id})


@manufacturing_bp.route("/boms/<bom_id>/rename", methods=["POST"])
def rename_bom(bom_id):
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    new_name = (data.get("name") or "").strip()

    if not new_name:
        return jsonify({"success": False, "message": "New name cannot be empty"}), 400

    db.session.execute(db.text(
        "UPDATE manufacturing_boms SET name = :name WHERE id = :id AND tenant_id = :tid"
    ), {"name": new_name, "id": bom_id, "tid": tenant_id})
    db.session.commit()

    _log_mfg_bom_history(bom_id, "Rename", f"Renamed BOM to {new_name}", "User", tenant_id)
    return jsonify({"success": True, "message": "BOM renamed successfully"})


@manufacturing_bp.route("/boms/<bom_id>/delete", methods=["POST"])
def delete_bom(bom_id):
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    password = (data.get("password") or "").strip()

    if not password:
        return jsonify({"success": False, "message": "Password is required to delete a BOM"}), 400

    # 1. Fetch current BOM status to ensure it's a Draft
    bom_row = db.session.execute(db.text(
        "SELECT status FROM manufacturing_boms WHERE id = :id AND is_deleted = false AND tenant_id = :tid"
    ), {"id": bom_id, "tid": tenant_id}).fetchone()

    if not bom_row:
        return jsonify({"success": False, "message": "BOM not found"}), 404

    bom_status = bom_row[0]
    if bom_status != 'Draft':
        return jsonify({"success": False, "message": "Only Draft BOMs can be deleted."}), 400

    # 2. Verify password via iam.users for the current tenant/user
    user_id = None
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if isinstance(identity, str):
            identity = json.loads(identity)
        if isinstance(identity, dict):
            user_id = identity.get("user_id")
    except Exception:
        pass

    valid = False
    if user_id:
        user_row = db.session.execute(db.text(
            "SELECT password_hash FROM iam.users WHERE id = :uid AND tenant_id = :tid AND is_deleted = false AND is_active = true"
        ), {"uid": user_id, "tid": tenant_id}).fetchone()
        if user_row and user_row[0]:
            ph = user_row[0]
            try:
                import bcrypt as _bcrypt
                valid = _bcrypt.checkpw(password.encode('utf-8'), ph.encode('utf-8') if isinstance(ph, str) else ph)
            except Exception:
                pass
    else:
        # Fallback to checking all active users of this tenant
        hashes = db.session.execute(db.text(
            "SELECT email, password_hash FROM iam.users WHERE tenant_id = :tid AND is_deleted = false AND is_active = true"
        ), {"tid": tenant_id}).fetchall()
        
        import bcrypt as _bcrypt
        for row in hashes:
            if row[1]:
                ph = row[1]
                try:
                    if _bcrypt.checkpw(password.encode('utf-8'), ph.encode('utf-8') if isinstance(ph, str) else ph):
                        valid = True
                        break
                except Exception:
                    pass

    if not valid:
        return jsonify({"success": False, "message": "Incorrect password. BOM not deleted."}), 403

    # 3. Perform a complete hard delete of all BOM related data
    db.session.execute(db.text(
        "DELETE FROM manufacturing_bom_items WHERE bom_id = :bid AND tenant_id = :tid"
    ), {"bid": bom_id, "tid": tenant_id})

    db.session.execute(db.text(
        "DELETE FROM manufacturing_bom_item_snapshots WHERE bom_id = :bid AND tenant_id = :tid"
    ), {"bid": bom_id, "tid": tenant_id})

    db.session.execute(db.text(
        "DELETE FROM manufacturing_bom_versions WHERE bom_id = :bid AND tenant_id = :tid"
    ), {"bid": bom_id, "tid": tenant_id})

    db.session.execute(db.text(
        "DELETE FROM manufacturing_bom_files WHERE bom_id = :bid AND tenant_id = :tid"
    ), {"bid": bom_id, "tid": tenant_id})

    db.session.execute(db.text(
        "DELETE FROM manufacturing_bom_history WHERE bom_id = :bid AND tenant_id = :tid"
    ), {"bid": bom_id, "tid": tenant_id})

    db.session.execute(db.text(
        "DELETE FROM manufacturing_bom_costing_selections WHERE bom_id = :bid AND tenant_id = :tid"
    ), {"bid": bom_id, "tid": tenant_id})

    db.session.execute(db.text(
        "DELETE FROM manufacturing_boms WHERE id = :id AND tenant_id = :tid"
    ), {"id": bom_id, "tid": tenant_id})

    db.session.commit()
    return jsonify({"success": True, "message": "BOM and all associated data deleted successfully"})


@manufacturing_bp.route("/boms/<bom_id>/versions", methods=["GET"])
def get_bom_versions(bom_id):
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, version, version_type, status, change_description, released_at, created_by, created_at "
        "FROM manufacturing_bom_versions WHERE bom_id = :bid AND tenant_id = :tid ORDER BY created_at DESC"
    ), {"bid": bom_id, "tid": tenant_id}).fetchall()

    versions = [{
        "id": str(r[0]), "version": r[1], "version_type": r[2], "status": r[3],
        "change_description": r[4] or "", "released_at": str(r[5]) if r[5] else "",
        "created_by": r[6], "created_at": str(r[7])
    } for r in rows]

    return jsonify({"success": True, "data": versions})


@manufacturing_bp.route("/boms/<bom_id>/history", methods=["GET"])
def get_bom_history(bom_id):
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, action, detail, performed_by, performed_at "
        "FROM manufacturing_bom_history WHERE bom_id = :bid AND tenant_id = :tid ORDER BY performed_at DESC LIMIT 100"
    ), {"bid": bom_id, "tid": tenant_id}).fetchall()

    history = [{
        "id": str(r[0]), "action": r[1], "detail": r[2] or "",
        "performed_by": r[3], "performed_at": str(r[4])
    } for r in rows]

    return jsonify({"success": True, "data": history})


@manufacturing_bp.route("/boms/<bom_id>/costing", methods=["GET"])
def get_bom_costing_prices(bom_id):
    tenant_id = _get_tenant()
    
    # Retrieve all unique parts in this BOM
    items = db.session.execute(db.text(
        "SELECT DISTINCT child_part_code FROM manufacturing_bom_items WHERE bom_id = :bid AND tenant_id = :tid AND child_type = 'component'"
    ), {"bid": bom_id, "tid": tenant_id}).fetchall()

    parts_list = [r[0] for r in items]
    if not parts_list:
        return jsonify({"success": True, "data": []})

    # Fetch vendor selections
    rows_sel = db.session.execute(db.text(
        "SELECT part_number, pvp_id, unit_cost FROM manufacturing_bom_costing_selections WHERE bom_id = :bid AND tenant_id = :tid"
    ), {"bid": bom_id, "tid": tenant_id}).fetchall()
    selections = {r[0]: {"vendor_id": r[1], "unit_cost": float(r[2] or 0)} for r in rows_sel}

    costing_data = []
    for part in parts_list:
        desc = db.session.execute(db.text(
            "SELECT name FROM part.masters WHERE part_number = :p AND is_deleted = false AND tenant_id = :tid LIMIT 1"
        ), {"p": part, "tid": tenant_id}).scalar() or ""

        # Fetch vendors list (from master.vendors)
        vendors_rows = db.session.execute(db.text(
            "SELECT id, code, name FROM master.vendors WHERE is_deleted = false AND tenant_id = :tid"
        ), {"tid": tenant_id}).fetchall()

        vendors_options = [{
            "vendor_id": str(v[0]),
            "vendor_code": v[1],
            "vendor_name": v[2]
        } for v in vendors_rows]

        sel = selections.get(part, {"vendor_id": None, "unit_cost": 0.0})

        # Fetch default cost from inventory stock levels
        stock_cost = db.session.execute(db.text(
            "SELECT unit_cost FROM inventory_stock_levels WHERE part_number = :p AND is_deleted = false AND tenant_id = :tid ORDER BY updated_at DESC LIMIT 1"
        ), {"p": part, "tid": tenant_id}).scalar()
        default_cost = float(stock_cost) if stock_cost is not None else 0.0

        costing_data.append({
            "part_number": part,
            "description": desc,
            "vendors": vendors_options,
            "selected_vendor_id": sel["vendor_id"],
            "selected_cost": sel["unit_cost"],
            "default_cost": default_cost
        })

    return jsonify({"success": True, "data": costing_data})


@manufacturing_bp.route("/boms/<bom_id>/costing-select", methods=["POST"])
def select_bom_costing_vendor(bom_id):
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    part = data.get("part_number")
    vendor_id = data.get("vendor_id")
    cost = float(data.get("unit_cost") or 0)

    if not part:
        return jsonify({"success": False, "message": "Part number is required"}), 400

    # Upsert costing selection
    existing = db.session.execute(db.text(
        "SELECT id FROM manufacturing_bom_costing_selections WHERE bom_id = :bid AND part_number = :p AND tenant_id = :tid"
    ), {"bid": bom_id, "p": part, "tid": tenant_id}).fetchone()

    if existing:
        db.session.execute(db.text(
            "UPDATE manufacturing_bom_costing_selections SET pvp_id = :vid, unit_cost = :cost, selected_at = NOW() WHERE bom_id = :bid AND part_number = :p AND tenant_id = :tid"
        ), {"vid": vendor_id, "cost": cost, "bid": bom_id, "p": part, "tid": tenant_id})
    else:
        db.session.execute(db.text(
            "INSERT INTO manufacturing_bom_costing_selections (id, bom_id, part_number, pvp_id, unit_cost, tenant_id) "
            "VALUES (:id, :bid, :p, :vid, :cost, :tid)"
        ), {"id": str(uuid.uuid4()), "bid": bom_id, "p": part, "vid": vendor_id, "cost": cost, "tid": tenant_id})
    db.session.commit()

    _sync_bom_lines(bom_id, tenant_id)
    _log_mfg_bom_history(bom_id, "Costing Selection", f"Set cost selection for component {part} to Vendor ID {vendor_id} at price {cost}", "User", tenant_id)

    return jsonify({"success": True, "message": "Costing selection saved"})


# ─── BOM API CLEAN BLUEPRINT WRAPPERS ───

@bom_api_bp.route("/<bom_id>/enter_edit", methods=["POST"])
def enter_edit_clean(bom_id):
    return enter_edit(bom_id)

@bom_api_bp.route("/<bom_id>/cancel_edit", methods=["POST", "GET"])
def cancel_edit_clean(bom_id):
    return cancel_edit(bom_id)

@bom_api_bp.route("/<bom_id>/save_edit", methods=["POST"])
def save_edit_clean(bom_id):
    return save_edit(bom_id)

@bom_api_bp.route("/<bom_id>/release", methods=["POST"])
def release_bom_clean(bom_id):
    return release_bom(bom_id)

@bom_api_bp.route("/<bom_id>/rename", methods=["POST"])
def rename_bom_clean(bom_id):
    return rename_bom(bom_id)

@bom_api_bp.route("/<bom_id>/delete", methods=["POST"])
def delete_bom_clean(bom_id):
    return delete_bom(bom_id)


@manufacturing_bp.route("/assembly-boms-list", methods=["GET"])
def api_mfg_assembly_boms_list():
    tenant_id = _get_tenant()
    q = (request.args.get("q") or "").strip().lower()

    tid_cond = "(tenant_id = :tid OR tenant_id = 'TEST' OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = '' OR tenant_id IS NULL)"

    # Find all categories named 'Assembly' (case-insensitive) — same tenant relaxation as part store
    asm_cats = db.session.execute(db.text(
        "SELECT id, name, series_prefix FROM part.categories "
        "WHERE LOWER(name) = 'assembly' AND is_deleted = false"
    )).fetchall()

    all_parts = []  # list of (part_number, description)

    for cat in asm_cats:
        cat_name, cat_series = cat[1], cat[2]
        # Build dynamic table name exactly as part store does
        import re as _re
        def _clean(s):
            return _re.sub(r'[^a-z0-9]', '_', s.lower().strip()).strip('_')
        table_name = f'part."{_clean(cat_name)}_{cat_series}"'

        try:
            rows = db.session.execute(db.text(
                f"SELECT part_number, COALESCE(description, '') FROM {table_name} "
                f"ORDER BY part_number ASC"
            )).fetchall()
            for r in rows:
                all_parts.append((r[0], r[1]))
        except Exception:
            db.session.rollback()

    # Sort latest (highest part number) first
    all_parts.sort(key=lambda x: x[0], reverse=True)

    res = []
    for part_no, name in all_parts:
        if q and q not in part_no.lower() and q not in name.lower():
            continue

        # Check both raw part_no and with -99 suffix (legacy BOM creation appended -99)
        bom = db.session.execute(db.text(
            f"SELECT id, current_version, status FROM manufacturing_boms "
            f"WHERE (fg_part_number = :p OR fg_part_number = :p99) AND is_deleted = false AND {tid_cond} LIMIT 1"
        ), {"p": part_no, "p99": part_no + "-99", "tid": tenant_id}).fetchone()

        has_bom = bom is not None
        bom_id = str(bom[0]) if has_bom else None
        version = bom[1] if has_bom else ""
        status = bom[2] if has_bom else ""
        item_count = _count_mfg_bom_items_sql(bom_id, tenant_id) if has_bom else 0

        res.append({
            "part_code": part_no,
            "description": name,
            "has_bom": has_bom,
            "bom_id": bom_id,
            "version": version,
            "status": status,
            "item_count": item_count
        })
    return jsonify(res)


@manufacturing_bp.route("/search-assemblies", methods=["GET"])
def search_assemblies():
    q = (request.args.get("q") or "").strip()
    if not q:
        return jsonify({"success": True, "data": []})
    import re as _re
    def _clean(s):
        return _re.sub(r'[^a-z0-9]', '_', s.lower().strip()).strip('_')
    asm_cats = db.session.execute(db.text(
        "SELECT name, series_prefix FROM part.categories WHERE LOWER(name) = 'assembly' AND is_deleted = false"
    )).fetchall()
    results = []
    for cat in asm_cats:
        table_name = f'part."{_clean(cat[0])}_{cat[1]}"'
        try:
            rows = db.session.execute(db.text(
                f"SELECT part_number, COALESCE(description,'') FROM {table_name} "
                f"WHERE LOWER(part_number) LIKE :q OR LOWER(COALESCE(description,'')) LIKE :q "
                f"ORDER BY part_number LIMIT 20"
            ), {"q": f"%{q.lower()}%"}).fetchall()
            results.extend([{"part_number": r[0], "description": r[1]} for r in rows])
        except Exception:
            db.session.rollback()
    return jsonify({"success": True, "data": results[:20]})


@manufacturing_bp.route("/search-parts", methods=["GET"])
def search_parts():
    tenant_id = _get_tenant()
    q = (request.args.get("q") or "").strip()
    if not q:
        return jsonify({"success": True, "data": []})
    import re as _re
    def _clean(s):
        return _re.sub(r'[^a-z0-9]', '_', s.lower().strip()).strip('_')
    # Get all categories (not just Assembly) for component search
    all_cats = db.session.execute(db.text(
        "SELECT name, series_prefix FROM part.categories WHERE is_deleted = false"
    )).fetchall()
    results = []
    seen = set()
    for cat in all_cats:
        table_name = f'part."{_clean(cat[0])}_{cat[1]}"'
        try:
            rows = db.session.execute(db.text(
                f"SELECT part_number, COALESCE(description,'') FROM {table_name} "
                f"WHERE LOWER(part_number) LIKE :q OR LOWER(COALESCE(description,'')) LIKE :q "
                f"ORDER BY part_number LIMIT 15"
            ), {"q": f"%{q.lower()}%"}).fetchall()
            for r in rows:
                if r[0] not in seen:
                    results.append({"part_number": r[0], "description": r[1]})
                    seen.add(r[0])
        except Exception:
            db.session.rollback()
    return jsonify({"success": True, "data": results[:30]})



def debug_assembly_parts():
    """Temporary debug: shows what part.masters has for Assembly category and what tenant_ids exist."""
    try:
        tenant_id = _get_tenant()
        # All distinct categories in part.masters
        cats = db.session.execute(db.text(
            "SELECT DISTINCT category, tenant_id, COUNT(*) as cnt FROM part.masters WHERE is_deleted = false GROUP BY category, tenant_id ORDER BY category"
        )).fetchall()
        # Assembly parts specifically
        asm = db.session.execute(db.text(
            "SELECT part_number, name, category, tenant_id FROM part.masters WHERE is_deleted = false AND LOWER(category) = 'assembly' LIMIT 20"
        )).fetchall()
        return jsonify({
            "jwt_tenant": tenant_id,
            "all_categories": [{"category": r[0], "tenant_id": r[1], "count": r[2]} for r in cats],
            "assembly_parts_sample": [{"part_number": r[0], "name": r[1], "category": r[2], "tenant_id": r[3]} for r in asm]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@manufacturing_bp.route("/boms/<bom_id>/files", methods=["GET"])
def get_bom_files(bom_id):
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, filename, filepath, file_type, file_size, doc_type, revision, description, uploaded_by, uploaded_at "
        "FROM manufacturing_bom_files WHERE bom_id = :bid AND tenant_id = :tid ORDER BY uploaded_at DESC"
    ), {"bid": bom_id, "tid": tenant_id}).fetchall()

    files = [{
        "id": str(r[0]), "filename": r[1], "filepath": r[2], "file_type": r[3] or "",
        "file_size": r[4] or 0, "doc_type": r[5] or "", "revision": r[6] or "",
        "description": r[7] or "", "uploaded_by": r[8], "uploaded_at": str(r[9])
    } for r in rows]

    return jsonify({"success": True, "data": files})


@manufacturing_bp.route("/boms/<bom_id>/upload-file", methods=["POST"])
def upload_bom_file(bom_id):
    tenant_id = _get_tenant()
    if 'file' not in request.files:
        return jsonify({"success": False, "message": "No file uploaded"}), 400
        
    f = request.files['file']
    if f.filename == '':
        return jsonify({"success": False, "message": "Empty filename"}), 400

    filename = secure_filename(f.filename)
    # Generate unique storage filename
    file_id = str(uuid.uuid4())
    stored_name = f"{file_id}_{filename}"
    filepath = os.path.join(MFG_BOM_FILES_DIR, stored_name)
    
    # Save file
    f.save(filepath)

    doc_type = request.form.get("doc_type") or "CAD Drawing"
    revision = request.form.get("revision") or "A"
    description = request.form.get("description") or ""
    size = os.path.getsize(filepath)

    db.session.execute(db.text(
        "INSERT INTO manufacturing_bom_files (id, bom_id, filename, filepath, file_type, file_size, doc_type, revision, description, uploaded_by, tenant_id) "
        "VALUES (:id, :bid, :fname, :fpath, :ftype, :fsize, :dtype, :rev, :desc, 'User', :tid)"
    ), {
        "id": file_id, "bid": bom_id, "fname": filename, "fpath": stored_name,
        "ftype": filename.split(".")[-1] if "." in filename else "", "fsize": size,
        "dtype": doc_type, "rev": revision, "desc": description, "tid": tenant_id
    })
    db.session.commit()

    _log_mfg_bom_history(bom_id, "Upload File", f"Uploaded drawing/attachment: {filename}", "User", tenant_id)
    return jsonify({"success": True, "message": "File uploaded successfully"})


@manufacturing_bp.route("/boms/<bom_id>/download-file/<file_id>", methods=["GET"])
def download_bom_file(bom_id, file_id):
    tenant_id = _get_tenant()
    file_record = db.session.execute(db.text(
        "SELECT filename, filepath FROM manufacturing_bom_files WHERE id = :id AND bom_id = :bid AND tenant_id = :tid"
    ), {"id": file_id, "bid": bom_id, "tid": tenant_id}).fetchone()
    
    if not file_record:
        return jsonify({"success": False, "message": "File not found"}), 404

    filename, filepath = file_record
    full_path = os.path.join(MFG_BOM_FILES_DIR, filepath)
    if not os.path.exists(full_path):
        return jsonify({"success": False, "message": "Physical file does not exist on disk"}), 404

    return send_file(full_path, as_attachment=True, download_name=filename)


@manufacturing_bp.route("/boms/<bom_id>/delete-file/<file_id>", methods=["POST"])
def delete_bom_file(bom_id, file_id):
    tenant_id = _get_tenant()
    file_record = db.session.execute(db.text(
        "SELECT filename, filepath FROM manufacturing_bom_files WHERE id = :id AND bom_id = :bid AND tenant_id = :tid"
    ), {"id": file_id, "bid": bom_id, "tid": tenant_id}).fetchone()
    
    if not file_record:
        return jsonify({"success": False, "message": "File record not found"}), 404

    filename, filepath = file_record
    full_path = os.path.join(MFG_BOM_FILES_DIR, filepath)

    # Delete from DB
    db.session.execute(db.text(
        "DELETE FROM manufacturing_bom_files WHERE id = :id AND bom_id = :bid AND tenant_id = :tid"
    ), {"id": file_id, "bid": bom_id, "tid": tenant_id})
    db.session.commit()

    # Attempt to delete from disk
    try:
        if os.path.exists(full_path):
            os.remove(full_path)
    except:
        pass

    _log_mfg_bom_history(bom_id, "Delete File", f"Removed attachment: {filename}", "User", tenant_id)
    return jsonify({"success": True, "message": "Attachment deleted"})
