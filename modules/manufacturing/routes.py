import uuid
import json
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from extensions import db

manufacturing_bp = Blueprint("manufacturing", __name__)


def _get_tenant():
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if isinstance(identity, dict):
            return identity.get("tenant_id", "TEST")
        elif isinstance(identity, str):
            try:
                data = json.loads(identity)
                return data.get("tenant_id", "TEST")
            except Exception:
                pass
    except Exception:
        pass
    return "TEST"


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
        "SELECT id, bom_no, fg_part_number, fg_description, version, effective_date, status, yield_qty, unit, notes FROM manufacturing_boms WHERE is_deleted = false AND tenant_id = :tid ORDER BY created_at DESC"
    ), {"tid": tenant_id}).fetchall()

    boms = []
    for r in rows:
        lines = db.session.execute(db.text(
            "SELECT id, sequence, component_type, component_no, component_description, qty_per, unit, scrap_factor, operation_ref FROM manufacturing_bom_lines WHERE bom_id = :bid AND is_deleted = false"
        ), {"bid": r[0]}).fetchall()

        boms.append({
            "id": r[0], "bom_no": r[1], "fg_part_number": r[2], "fg_description": r[3] or "",
            "version": r[4] or "1.0", "effective_date": r[5] or "", "status": r[6],
            "yield_qty": float(r[7] or 1), "unit": r[8] or "pcs", "notes": r[9] or "",
            "components": [{
                "id": l[0], "sequence": l[1], "type": l[2] or "PART", "component_no": l[3],
                "description": l[4] or "", "qty_per": float(l[5] or 1), "unit": l[6] or "pcs",
                "scrap_factor": float(l[7] or 0), "operation_ref": l[8] or "-01"
            } for l in lines]
        })
    return jsonify({"success": True, "data": boms})


@manufacturing_bp.route("/boms", methods=["POST"])
def create_bom():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    fg_part = data.get("fg_part_number")
    if not fg_part:
        return jsonify({"success": False, "message": "Finished Good part number required"}), 400

    # Guarantee -99 FG suffix convention
    if not fg_part.endswith("-99"):
        fg_part = f"{fg_part}-99"

    bid = str(uuid.uuid4())
    bno = data.get("bom_no") or f"BOM-{fg_part}"

    db.session.execute(db.text(
        "INSERT INTO manufacturing_boms (id, bom_no, fg_part_number, fg_description, version, effective_date, status, yield_qty, unit, notes, tenant_id) "
        "VALUES (:id, :bno, :fg, :desc, :ver, :eff, 'active', :yield_qty, :unit, :notes, :tid)"
    ), {
        "id": bid, "bno": bno, "fg": fg_part, "desc": data.get("fg_description", ""),
        "ver": data.get("version", "1.0"), "eff": data.get("effective_date", datetime.now().strftime('%Y-%m-%d')),
        "yield_qty": float(data.get("yield_qty", 1)), "unit": data.get("unit", "pcs"),
        "notes": data.get("notes", ""), "tid": tenant_id
    })

    comps = data.get("components", [])
    for idx, c in enumerate(comps, start=1):
        db.session.execute(db.text(
            "INSERT INTO manufacturing_bom_lines (id, bom_id, sequence, component_type, component_no, component_description, qty_per, unit, scrap_factor, operation_ref, tenant_id) "
            "VALUES (:id, :bid, :seq, :ctype, :cno, :desc, :qty, :unit, :scrap, :op, :tid)"
        ), {
            "id": str(uuid.uuid4()), "bid": bid, "seq": idx * 10, "ctype": c.get("type", "PART"),
            "cno": c.get("component_no"), "desc": c.get("description", ""), "qty": float(c.get("qty_per", 1)),
            "unit": c.get("unit", "pcs"), "scrap": float(c.get("scrap_factor", 0)), "op": c.get("operation_ref", "-01"), "tid": tenant_id
        })

    db.session.commit()
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
    rows = db.session.execute(db.text(
        "SELECT id, order_no, fg_part_number, fg_description, planned_qty, produced_qty, rejected_qty, planned_start, planned_end, status, priority, created_at FROM manufacturing_production_orders WHERE is_deleted = false AND tenant_id = :tid ORDER BY created_at DESC"
    ), {"tid": tenant_id}).fetchall()
    orders = [{
        "id": r[0], "order_no": r[1], "fg_part_number": r[2], "fg_description": r[3] or "",
        "planned_qty": float(r[4] or 0), "produced_qty": float(r[5] or 0), "rejected_qty": float(r[6] or 0),
        "planned_start": r[7] or "", "planned_end": r[8] or "", "status": r[9], "priority": r[10] or "normal",
        "created_at": str(r[11])
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

    db.session.execute(db.text(
        "INSERT INTO manufacturing_production_orders (id, order_no, fg_part_number, fg_description, planned_qty, produced_qty, rejected_qty, planned_start, planned_end, status, priority, notes, tenant_id) "
        "VALUES (:id, :ono, :fg, :desc, :pqty, 0, 0, :pstart, :pend, 'released', :prio, :notes, :tid)"
    ), {
        "id": poid, "ono": ono, "fg": fg_part, "desc": data.get("fg_description", ""),
        "pqty": qty, "pstart": data.get("planned_start", datetime.now().strftime('%Y-%m-%d')),
        "pend": data.get("planned_end", (datetime.now() + timedelta(days=3)).strftime('%Y-%m-%d')),
        "prio": data.get("priority", "normal"), "notes": data.get("notes", ""), "tid": tenant_id
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
    limit = request.args.get("limit", 20, type=int)
    try:
        rows = db.session.execute(db.text(
            "SELECT action, entity_type, entity_id, user_name, user_email, ip_address, created_at FROM audit.logs WHERE module IN ('Manufacturing', 'MANUFACTURING') AND tenant_id = :tid ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        ), {"tid": tenant_id, "limit": limit, "offset": (page-1)*limit}).fetchall()
        items = [{
            "action": r[0], "entity_type": r[1] or "ProductionOrder", "entity_id": r[2] or "-",
            "user_name": r[3] or r[4] or "Production Engineer", "user_email": r[4] or "",
            "ip_address": r[5] or "127.0.0.1", "created_at": str(r[6])
        } for r in rows]
        return jsonify({"success": True, "data": {"items": items, "total": len(items)}})
    except Exception:
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


