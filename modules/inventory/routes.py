import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from extensions import db

inventory_bp = Blueprint("inventory", __name__)


def _get_tenant():
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if isinstance(identity, dict):
            return identity.get("tenant_id", "TEST")
        elif isinstance(identity, str):
            import json
            try:
                data = json.loads(identity)
                return data.get("tenant_id", "TEST")
            except Exception:
                pass
    except Exception:
        pass
    return "TEST"


def _tid_cond():
    return "(tenant_id = :tid OR tenant_id = 'TEST' OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = '' OR tenant_id IS NULL)"


@inventory_bp.route("/overview-stats", methods=["GET"])
def overview_stats():
    tenant_id = _get_tenant()
    tid_cond = _tid_cond()
    try:
        total_items = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM inventory_stock_levels WHERE is_deleted = false AND {tid_cond}"
        ), {"tid": tenant_id}).scalar() or 0

        total_value = db.session.execute(db.text(
            f"SELECT COALESCE(SUM(total_value), 0) FROM inventory_stock_levels WHERE is_deleted = false AND {tid_cond}"
        ), {"tid": tenant_id}).scalar() or 0

        low_stock = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM inventory_stock_levels WHERE qty_available <= reorder_point AND reorder_point > 0 AND is_deleted = false AND {tid_cond}"
        ), {"tid": tenant_id}).scalar() or 0

        total_movements = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM inventory_stock_movements WHERE is_deleted = false AND {tid_cond}"
        ), {"tid": tenant_id}).scalar() or 0

        active_batches = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM inventory_batches WHERE status = 'active' AND is_deleted = false AND {tid_cond}"
        ), {"tid": tenant_id}).scalar() or 0

        return jsonify({
            "success": True,
            "data": {
                "total_items": total_items,
                "total_value": float(total_value),
                "low_stock_count": low_stock,
                "total_movements": total_movements,
                "active_batches": active_batches
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


# 1. STOCK LEVELS
@inventory_bp.route("/stock-levels", methods=["GET"])
def list_stock_levels():
    tenant_id = _get_tenant()
    search = request.args.get("search", "").strip()
    warehouse = request.args.get("warehouse", "").strip()
    item_type = request.args.get("item_type", "").strip()
    status = request.args.get("status", "").strip()

    where_clause = "WHERE is_deleted = false AND (tenant_id = :tid OR tenant_id = 'TEST' OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = '' OR tenant_id IS NULL)"
    params = {"tid": tenant_id}

    if search:
        where_clause += " AND (part_number LIKE :search OR part_description LIKE :search OR bin_code LIKE :search)"
        params["search"] = f"%{search}%"
    if warehouse:
        where_clause += " AND warehouse_code = :wh"
        params["wh"] = warehouse
    if item_type:
        where_clause += " AND item_type = :itype"
        params["itype"] = item_type
    if status == "low_stock":
        where_clause += " AND qty_available <= reorder_point AND reorder_point > 0"
    elif status == "out_of_stock":
        where_clause += " AND qty_available <= 0"

    sql = f"""
        SELECT id, part_number, part_description, item_type, warehouse_code, zone_code, bin_code,
               qty_on_hand, qty_reserved, qty_available, reorder_point, reorder_qty, unit,
               unit_cost, total_value, last_movement_at
        FROM inventory_stock_levels
        {where_clause}
        ORDER BY part_number ASC
    """
    rows = db.session.execute(db.text(sql), params).fetchall()
    items = []
    for r in rows:
        items.append({
            "id": r[0],
            "part_number": r[1],
            "part_description": r[2] or "",
            "item_type": r[3] or "PART",
            "warehouse_code": r[4] or "",
            "zone_code": r[5] or "",
            "bin_code": r[6] or "",
            "qty_on_hand": float(r[7] or 0),
            "qty_reserved": float(r[8] or 0),
            "qty_available": float(r[9] or 0),
            "reorder_point": float(r[10] or 0),
            "reorder_qty": float(r[11] or 0),
            "unit": r[12] or "pcs",
            "unit_cost": float(r[13] or 0),
            "total_value": float(r[14] or 0),
            "last_movement_at": str(r[15]) if r[15] else None
        })

    return jsonify({"success": True, "data": items})


@inventory_bp.route("/stock-levels/<slid>", methods=["GET"])
def get_stock_level(slid):
    tenant_id = _get_tenant()
    cond = _tid_cond()
    try:
        r = db.session.execute(db.text(
            f"SELECT id, part_number, part_description, item_type, warehouse_code, zone_code, bin_code, "
            f"qty_on_hand, qty_reserved, qty_available, reorder_point, reorder_qty, unit, "
            f"unit_cost, total_value, last_movement_at "
            f"FROM inventory_stock_levels WHERE id = :id AND is_deleted = false AND {cond}"
        ), {"id": slid, "tid": tenant_id}).first()
        if not r:
            return jsonify({"success": False, "message": "Stock level record not found"}), 404
        return jsonify({"success": True, "data": {
            "id": r[0], "part_number": r[1], "part_description": r[2] or "",
            "item_type": r[3] or "PART", "warehouse_code": r[4] or "",
            "zone_code": r[5] or "", "bin_code": r[6] or "",
            "qty_on_hand": float(r[7] or 0), "qty_reserved": float(r[8] or 0),
            "qty_available": float(r[9] or 0), "reorder_point": float(r[10] or 0),
            "reorder_qty": float(r[11] or 0), "unit": r[12] or "pcs",
            "unit_cost": float(r[13] or 0), "total_value": float(r[14] or 0),
            "last_movement_at": str(r[15]) if r[15] else None
        }})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@inventory_bp.route("/stock-levels", methods=["POST"])
def create_stock_level():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    part_number = data.get("part_number")
    if not part_number:
        return jsonify({"success": False, "message": "Part number is required"}), 400

    item_id = str(uuid.uuid4())
    qty_on_hand = float(data.get("qty_on_hand", 0))
    qty_reserved = float(data.get("qty_reserved", 0))
    qty_available = qty_on_hand - qty_reserved
    unit_cost = float(data.get("unit_cost", 0))
    total_value = qty_on_hand * unit_cost

    sql = """
        INSERT INTO inventory_stock_levels (
            id, part_number, part_description, item_type, warehouse_code, zone_code, bin_code,
            qty_on_hand, qty_reserved, qty_available, reorder_point, reorder_qty, unit,
            unit_cost, total_value, tenant_id, created_at, updated_at
        ) VALUES (
            :id, :part_number, :desc, :item_type, :wh, :zone, :bin,
            :qty_on_hand, :qty_reserved, :qty_available, :reorder_point, :reorder_qty, :unit,
            :unit_cost, :total_value, :tid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
    """
    db.session.execute(db.text(sql), {
        "id": item_id,
        "part_number": part_number,
        "desc": data.get("part_description", ""),
        "item_type": data.get("item_type", "PART"),
        "wh": data.get("warehouse_code", "MAIN"),
        "zone": data.get("zone_code", "Z1"),
        "bin": data.get("bin_code", "A-01-01"),
        "qty_on_hand": qty_on_hand,
        "qty_reserved": qty_reserved,
        "qty_available": qty_available,
        "reorder_point": float(data.get("reorder_point", 10)),
        "reorder_qty": float(data.get("reorder_qty", 50)),
        "unit": data.get("unit", "pcs"),
        "unit_cost": unit_cost,
        "total_value": total_value,
        "tid": tenant_id
    })
    db.session.commit()
    return jsonify({"success": True, "message": "Stock level record created", "id": item_id})


# 2. STOCK MOVEMENTS
@inventory_bp.route("/stock-movements", methods=["GET"])
def list_stock_movements():
    tenant_id = _get_tenant()
    search = request.args.get("search", "").strip()
    movement_type = request.args.get("movement_type", "").strip()

    where_clause = "WHERE is_deleted = false AND tenant_id = :tid"
    params = {"tid": tenant_id}

    if search:
        where_clause += " AND (part_number LIKE :search OR movement_no LIKE :search OR reference_no LIKE :search)"
        params["search"] = f"%{search}%"
    if movement_type:
        where_clause += " AND movement_type = :mtype"
        params["mtype"] = movement_type

    sql = f"""
        SELECT id, movement_no, movement_type, part_number, part_description, item_type,
               from_warehouse_code, from_bin_code, to_warehouse_code, to_bin_code,
               qty, unit, unit_cost, reference_type, reference_no, reason, performed_by, created_at
        FROM inventory_stock_movements
        {where_clause}
        ORDER BY created_at DESC LIMIT 100
    """
    rows = db.session.execute(db.text(sql), params).fetchall()
    movements = []
    for r in rows:
        movements.append({
            "id": r[0],
            "movement_no": r[1] or "",
            "movement_type": r[2],
            "part_number": r[3],
            "part_description": r[4] or "",
            "item_type": r[5] or "PART",
            "from_warehouse_code": r[6] or "-",
            "from_bin_code": r[7] or "-",
            "to_warehouse_code": r[8] or "-",
            "to_bin_code": r[9] or "-",
            "qty": float(r[10]),
            "unit": r[11] or "pcs",
            "unit_cost": float(r[12] or 0),
            "reference_type": r[13] or "",
            "reference_no": r[14] or "",
            "reason": r[15] or "",
            "performed_by": r[16] or "System",
            "created_at": str(r[17]) if r[17] else None
        })

    return jsonify({"success": True, "data": movements})


@inventory_bp.route("/stock-movements", methods=["POST"])
def create_stock_movement():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    part_number = data.get("part_number")
    mtype = data.get("movement_type")
    qty = float(data.get("qty", 0))

    if not part_number or not mtype or qty <= 0:
        return jsonify({"success": False, "message": "Part number, movement type, and valid quantity required"}), 400

    mov_id = str(uuid.uuid4())
    mov_no = f"MOV-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    sql = """
        INSERT INTO inventory_stock_movements (
            id, movement_no, movement_type, part_number, part_description, item_type,
            from_warehouse_code, from_bin_code, to_warehouse_code, to_bin_code,
            qty, unit, unit_cost, reference_type, reference_no, reason, performed_by, tenant_id, created_at
        ) VALUES (
            :id, :mov_no, :mtype, :part_number, :desc, :item_type,
            :from_wh, :from_bin, :to_wh, :to_bin,
            :qty, :unit, :unit_cost, :ref_type, :ref_no, :reason, :performed_by, :tid, CURRENT_TIMESTAMP
        )
    """
    db.session.execute(db.text(sql), {
        "id": mov_id,
        "mov_no": mov_no,
        "mtype": mtype,
        "part_number": part_number,
        "desc": data.get("part_description", ""),
        "item_type": data.get("item_type", "PART"),
        "from_wh": data.get("from_warehouse_code"),
        "from_bin": data.get("from_bin_code"),
        "to_wh": data.get("to_warehouse_code"),
        "to_bin": data.get("to_bin_code"),
        "qty": qty,
        "unit": data.get("unit", "pcs"),
        "unit_cost": float(data.get("unit_cost", 0)),
        "ref_type": data.get("reference_type", "MANUAL"),
        "ref_no": data.get("reference_no", ""),
        "reason": data.get("reason", ""),
        "performed_by": data.get("performed_by", "Inventory Officer"),
        "tid": tenant_id
    })

    # Update stock level if exists or insert
    wh_target = data.get("to_warehouse_code") or data.get("from_warehouse_code") or "MAIN"
    bin_target = data.get("to_bin_code") or data.get("from_bin_code") or "A-01-01"

    existing = db.session.execute(db.text(
        "SELECT id, qty_on_hand, unit_cost FROM inventory_stock_levels WHERE part_number = :p AND warehouse_code = :wh AND tenant_id = :tid"
    ), {"p": part_number, "wh": wh_target, "tid": tenant_id}).first()

    if existing:
        current_qty = float(existing[1] or 0)
        new_qty = current_qty + qty if mtype in ["RECEIPT", "ADJUSTMENT_POS", "RETURN"] else max(0.0, current_qty - qty)
        cost = float(existing[2] or 0)
        db.session.execute(db.text(
            "UPDATE inventory_stock_levels SET qty_on_hand = :nq, qty_available = :nq - qty_reserved, total_value = :nq * :cost, last_movement_at = CURRENT_TIMESTAMP WHERE id = :id"
        ), {"nq": new_qty, "cost": cost, "id": existing[0]})
    else:
        new_id = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO inventory_stock_levels (id, part_number, part_description, item_type, warehouse_code, bin_code, qty_on_hand, qty_available, tenant_id) "
            "VALUES (:id, :p, :desc, :itype, :wh, :bin, :qty, :qty, :tid)"
        ), {"id": new_id, "p": part_number, "desc": data.get("part_description", ""), "itype": data.get("item_type", "PART"), "wh": wh_target, "bin": bin_target, "qty": qty, "tid": tenant_id})

    db.session.commit()
    return jsonify({"success": True, "message": "Movement recorded & stock updated", "movement_no": mov_no})


# 3. STOCK TRANSFERS
@inventory_bp.route("/transfers", methods=["POST"])
def stock_transfer():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    part_number = data.get("part_number")
    qty = float(data.get("qty", 0))
    from_wh = data.get("from_warehouse_code")
    from_bin = data.get("from_bin_code")
    to_wh = data.get("to_warehouse_code")
    to_bin = data.get("to_bin_code")

    if not part_number or qty <= 0 or not from_wh or not to_wh:
        return jsonify({"success": False, "message": "Missing transfer details"}), 400

    mov_id = str(uuid.uuid4())
    mov_no = f"TRF-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    # Log movement
    sql_mov = """
        INSERT INTO inventory_stock_movements (
            id, movement_no, movement_type, part_number, from_warehouse_code, from_bin_code,
            to_warehouse_code, to_bin_code, qty, reference_type, reason, performed_by, tenant_id
        ) VALUES (
            :id, :mno, 'TRANSFER', :p, :fwh, :fbin, :twh, :tbin, :qty, 'TRANSFER_ORDER', :reason, :by, :tid
        )
    """
    db.session.execute(db.text(sql_mov), {
        "id": mov_id, "mno": mov_no, "p": part_number, "fwh": from_wh, "fbin": from_bin,
        "twh": to_wh, "tbin": to_bin, "qty": qty, "reason": data.get("reason", "Stock relocation"),
        "by": data.get("performed_by", "Transfer Officer"), "tid": tenant_id
    })

    # Deduct source
    db.session.execute(db.text(
        "UPDATE inventory_stock_levels SET qty_on_hand = MAX(0, qty_on_hand - :qty), qty_available = MAX(0, qty_available - :qty), last_movement_at = CURRENT_TIMESTAMP WHERE part_number = :p AND warehouse_code = :wh AND tenant_id = :tid"
    ), {"qty": qty, "p": part_number, "wh": from_wh, "tid": tenant_id})

    # Add destination
    dest = db.session.execute(db.text(
        "SELECT id, qty_on_hand FROM inventory_stock_levels WHERE part_number = :p AND warehouse_code = :wh AND tenant_id = :tid"
    ), {"p": part_number, "wh": to_wh, "tid": tenant_id}).first()

    if dest:
        db.session.execute(db.text(
            "UPDATE inventory_stock_levels SET qty_on_hand = qty_on_hand + :qty, qty_available = qty_available + :qty, last_movement_at = CURRENT_TIMESTAMP WHERE id = :id"
        ), {"qty": qty, "id": dest[0]})
    else:
        db.session.execute(db.text(
            "INSERT INTO inventory_stock_levels (id, part_number, warehouse_code, bin_code, qty_on_hand, qty_available, tenant_id) VALUES (:id, :p, :wh, :bin, :qty, :qty, :tid)"
        ), {"id": str(uuid.uuid4()), "p": part_number, "wh": to_wh, "bin": to_bin or "A-01-01", "qty": qty, "tid": tenant_id})

    db.session.commit()
    return jsonify({"success": True, "message": f"Transferred {qty} units of {part_number}", "transfer_no": mov_no})


# 4. STOCK ADJUSTMENTS
@inventory_bp.route("/adjustments", methods=["POST"])
def stock_adjustment():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    part_number = data.get("part_number")
    wh = data.get("warehouse_code", "MAIN")
    adj_qty = float(data.get("adjustment_qty", 0))
    reason = data.get("reason", "Cycle count adjustment")
    approver = data.get("approver", "Inventory Manager")

    if not part_number or adj_qty == 0:
        return jsonify({"success": False, "message": "Part number and non-zero adjustment required"}), 400

    mov_type = "ADJUSTMENT"
    mov_no = f"ADJ-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    db.session.execute(db.text(
        "INSERT INTO inventory_stock_movements (id, movement_no, movement_type, part_number, to_warehouse_code, qty, reason, performed_by, tenant_id) VALUES (:id, :mno, :mtype, :p, :wh, :qty, :reason, :by, :tid)"
    ), {
        "id": str(uuid.uuid4()), "mno": mov_no, "mtype": mov_type, "p": part_number, "wh": wh, "qty": abs(adj_qty),
        "reason": f"{reason} (Approved by: {approver})", "by": approver, "tid": tenant_id
    })

    db.session.execute(db.text(
        "UPDATE inventory_stock_levels SET qty_on_hand = MAX(0, qty_on_hand + :adj), qty_available = MAX(0, qty_available + :adj), total_value = MAX(0, qty_on_hand + :adj) * unit_cost, last_movement_at = CURRENT_TIMESTAMP WHERE part_number = :p AND warehouse_code = :wh AND tenant_id = :tid"
    ), {"adj": adj_qty, "p": part_number, "wh": wh, "tid": tenant_id})

    db.session.commit()
    return jsonify({"success": True, "message": f"Adjustment of {adj_qty} recorded for {part_number}"})


# 5. STOCK COUNTS
@inventory_bp.route("/stock-counts", methods=["GET"])
def list_stock_counts():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, count_no, warehouse_code, count_date, status, assigned_to, notes, created_at FROM inventory_stock_counts WHERE is_deleted = false AND tenant_id = :tid ORDER BY created_at DESC"
    ), {"tid": tenant_id}).fetchall()
    counts = []
    for r in rows:
        lines = db.session.execute(db.text(
            "SELECT id, part_number, bin_code, book_qty, counted_qty, variance, status FROM inventory_stock_count_lines WHERE count_id = :cid"
        ), {"cid": r[0]}).fetchall()

        counts.append({
            "id": r[0],
            "count_no": r[1],
            "warehouse_code": r[2] or "MAIN",
            "count_date": r[3],
            "status": r[4],
            "assigned_to": r[5] or "",
            "notes": r[6] or "",
            "created_at": str(r[7]),
            "lines": [{
                "id": l[0], "part_number": l[1], "bin_code": l[2] or "",
                "book_qty": float(l[3] or 0), "counted_qty": float(l[4]) if l[4] is not None else None,
                "variance": float(l[5] or 0), "status": l[6]
            } for l in lines]
        })
    return jsonify({"success": True, "data": counts})


@inventory_bp.route("/stock-counts", methods=["POST"])
def create_stock_count():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    cid = str(uuid.uuid4())
    cno = f"CNT-{datetime.now().strftime('%Y%m%d%H%M')}"
    wh = data.get("warehouse_code", "MAIN")
    cdate = data.get("count_date", datetime.now().strftime('%Y-%m-%d'))
    assigned = data.get("assigned_to", "Warehouse Operator")

    db.session.execute(db.text(
        "INSERT INTO inventory_stock_counts (id, count_no, warehouse_code, count_date, status, assigned_to, notes, tenant_id) VALUES (:id, :cno, :wh, :cdate, 'in_progress', :assigned, :notes, :tid)"
    ), {"id": cid, "cno": cno, "wh": wh, "cdate": cdate, "assigned": assigned, "notes": data.get("notes", ""), "tid": tenant_id})

    # Auto generate count lines from current stock levels
    stocks = db.session.execute(db.text(
        "SELECT part_number, bin_code, qty_on_hand FROM inventory_stock_levels WHERE warehouse_code = :wh AND tenant_id = :tid"
    ), {"wh": wh, "tid": tenant_id}).fetchall()

    for s in stocks:
        db.session.execute(db.text(
            "INSERT INTO inventory_stock_count_lines (id, count_id, part_number, bin_code, book_qty, counted_qty, variance, status, tenant_id) VALUES (:lid, :cid, :p, :bin, :bqty, :bqty, 0, 'pending', :tid)"
        ), {"lid": str(uuid.uuid4()), "cid": cid, "p": s[0], "bin": s[1] or "A-01-01", "bqty": float(s[2] or 0), "tid": tenant_id})

    db.session.commit()
    return jsonify({"success": True, "message": "Stock count sheet created", "count_no": cno, "id": cid})


# 6. BATCH TRACKING
@inventory_bp.route("/batches", methods=["GET"])
def list_batches():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, batch_no, part_number, supplier_lot, manufacture_date, expiry_date, qty_received, qty_remaining, warehouse_code, bin_code, status FROM inventory_batches WHERE is_deleted = false AND tenant_id = :tid ORDER BY created_at DESC"
    ), {"tid": tenant_id}).fetchall()
    batches = [{
        "id": r[0], "batch_no": r[1], "part_number": r[2], "supplier_lot": r[3] or "",
        "manufacture_date": r[4] or "", "expiry_date": r[5] or "", "qty_received": float(r[6] or 0),
        "qty_remaining": float(r[7] or 0), "warehouse_code": r[8] or "", "bin_code": r[9] or "", "status": r[10]
    } for r in rows]
    return jsonify({"success": True, "data": batches})


@inventory_bp.route("/batches", methods=["POST"])
def create_batch():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    bid = str(uuid.uuid4())
    bno = data.get("batch_no") or f"BAT-{datetime.now().strftime('%Y%m%d%H%M')}"
    qty = float(data.get("qty_received", 100))

    db.session.execute(db.text(
        "INSERT INTO inventory_batches (id, batch_no, part_number, supplier_lot, manufacture_date, expiry_date, qty_received, qty_remaining, warehouse_code, bin_code, status, tenant_id) "
        "VALUES (:id, :bno, :p, :lot, :mdate, :edate, :qty, :qty, :wh, :bin, 'active', :tid)"
    ), {
        "id": bid, "bno": bno, "p": data.get("part_number"), "lot": data.get("supplier_lot", ""),
        "mdate": data.get("manufacture_date", ""), "edate": data.get("expiry_date", ""),
        "qty": qty, "wh": data.get("warehouse_code", "MAIN"), "bin": data.get("bin_code", "A-01-01"), "tid": tenant_id
    })
    db.session.commit()
    return jsonify({"success": True, "message": f"Batch {bno} created"})


# 7. SERIAL NUMBERS
@inventory_bp.route("/serials", methods=["GET"])
def list_serials():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, serial_no, part_number, batch_no, warehouse_code, bin_code, status, production_order_no, notes FROM inventory_serial_numbers WHERE is_deleted = false AND tenant_id = :tid ORDER BY created_at DESC"
    ), {"tid": tenant_id}).fetchall()
    serials = [{
        "id": r[0], "serial_no": r[1], "part_number": r[2], "batch_no": r[3] or "",
        "warehouse_code": r[4] or "", "bin_code": r[5] or "", "status": r[6],
        "production_order_no": r[7] or "", "notes": r[8] or ""
    } for r in rows]
    return jsonify({"success": True, "data": serials})


@inventory_bp.route("/serials", methods=["POST"])
def register_serials():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    part_number = data.get("part_number")
    serials_list = data.get("serials", [])

    if not part_number or not serials_list:
        return jsonify({"success": False, "message": "Part number and serial list required"}), 400

    for s_no in serials_list:
        db.session.execute(db.text(
            "INSERT INTO inventory_serial_numbers (id, serial_no, part_number, batch_no, warehouse_code, bin_code, status, tenant_id) VALUES (:id, :sno, :p, :batch, :wh, :bin, 'in_stock', :tid)"
        ), {
            "id": str(uuid.uuid4()), "sno": s_no, "p": part_number, "batch": data.get("batch_no", ""),
            "wh": data.get("warehouse_code", "MAIN"), "bin": data.get("bin_code", "A-01-01"), "tid": tenant_id
        })
    db.session.commit()
    return jsonify({"success": True, "message": f"Registered {len(serials_list)} serial numbers"})


# 8. REORDER MANAGEMENT
@inventory_bp.route("/reorder-rules", methods=["GET"])
def list_reorder_rules():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, part_number, warehouse_code, reorder_point, reorder_qty, lead_time_days, preferred_supplier, is_active FROM inventory_reorder_rules WHERE is_deleted = false AND tenant_id = :tid"
    ), {"tid": tenant_id}).fetchall()
    rules = [{
        "id": r[0], "part_number": r[1], "warehouse_code": r[2] or "MAIN",
        "reorder_point": float(r[3] or 0), "reorder_qty": float(r[4] or 0),
        "lead_time_days": r[5] or 0, "preferred_supplier": r[6] or "", "is_active": r[7]
    } for r in rows]
    return jsonify({"success": True, "data": rules})


@inventory_bp.route("/reorder-alerts", methods=["GET"])
def reorder_alerts():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT part_number, part_description, warehouse_code, qty_on_hand, qty_reserved, qty_available, reorder_point, reorder_qty, unit_cost "
        "FROM inventory_stock_levels WHERE qty_available <= reorder_point AND reorder_point > 0 AND is_deleted = false AND tenant_id = :tid"
    ), {"tid": tenant_id}).fetchall()
    alerts = [{
        "part_number": r[0], "part_description": r[1] or "", "warehouse_code": r[2] or "MAIN",
        "qty_on_hand": float(r[3] or 0), "qty_reserved": float(r[4] or 0), "qty_available": float(r[5] or 0),
        "reorder_point": float(r[6] or 0), "suggested_po_qty": float(r[7] or 50), "unit_cost": float(r[8] or 0)
    } for r in rows]
    return jsonify({"success": True, "data": alerts})


# 9. VALUATION & 10. REPORTS
@inventory_bp.route("/valuation", methods=["GET"])
def inventory_valuation():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT item_type, COUNT(*), SUM(qty_on_hand), SUM(total_value) FROM inventory_stock_levels WHERE is_deleted = false AND tenant_id = :tid GROUP BY item_type"
    ), {"tid": tenant_id}).fetchall()
    summary = [{
        "item_type": r[0] or "PART", "item_count": r[1], "total_qty": float(r[2] or 0), "total_value": float(r[3] or 0)
    } for r in rows]
    return jsonify({"success": True, "data": summary})


@inventory_bp.route("/reports/aging", methods=["GET"])
def report_aging():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT part_number, part_description, qty_on_hand, unit_cost, total_value, last_movement_at FROM inventory_stock_levels WHERE is_deleted = false AND tenant_id = :tid ORDER BY last_movement_at ASC LIMIT 50"
    ), {"tid": tenant_id}).fetchall()
    data = [{
        "part_number": r[0], "description": r[1] or "", "qty_on_hand": float(r[2] or 0),
        "unit_cost": float(r[3] or 0), "total_value": float(r[4] or 0), "last_movement": str(r[5]) if r[5] else "30+ Days"
    } for r in rows]
    return jsonify({"success": True, "data": data})


# 11. AUDIT LOGS & USER MANAGEMENT
@inventory_bp.route("/audit-logs", methods=["GET"])
def get_audit_logs():
    tenant_id = _get_tenant()
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 20, type=int)
    try:
        rows = db.session.execute(db.text(
            "SELECT action, entity_type, entity_id, user_name, user_email, ip_address, created_at FROM audit.logs WHERE module IN ('Inventory', 'INVENTORY') AND tenant_id = :tid ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        ), {"tid": tenant_id, "limit": limit, "offset": (page-1)*limit}).fetchall()
        items = [{
            "action": r[0], "entity_type": r[1] or "Stock", "entity_id": r[2] or "-",
            "user_name": r[3] or r[4] or "Inventory Spec", "user_email": r[4] or "",
            "ip_address": r[5] or "127.0.0.1", "created_at": str(r[6])
        } for r in rows]
        return jsonify({"success": True, "data": {"items": items, "total": len(items)}})
    except Exception:
        db.session.rollback()
        # Fallback list from stock movements
        movs = db.session.execute(db.text(
            "SELECT movement_type, part_number, movement_no, performed_by, created_at FROM inventory_stock_movements WHERE tenant_id = :tid ORDER BY created_at DESC LIMIT 20"
        ), {"tid": tenant_id}).fetchall()
        items = [{
            "action": m[0], "entity_type": "StockMovement", "entity_id": m[1],
            "user_name": m[3] or "Inventory Officer", "user_email": "inv@acme.com",
            "ip_address": "127.0.0.1", "created_at": str(m[4])
        } for m in movs]
        return jsonify({"success": True, "data": {"items": items, "total": len(items)}})


@inventory_bp.route("/users", methods=["GET"])
def get_module_users():
    tenant_id = _get_tenant()
    try:
        rows = db.session.execute(db.text(
            "SELECT ma.id, ma.user_id, ma.role, ma.permissions, ma.is_active, ma.created_at, "
            "u.email, u.first_name, u.last_name "
            "FROM iam.module_access ma JOIN iam.users u ON ma.user_id = u.id "
            "WHERE ma.module IN ('Inventory Management', 'Inventory') "
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


@inventory_bp.route("/users", methods=["POST"])
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

    existing = db.session.execute(db.text("SELECT id FROM iam.module_access WHERE user_id = :uid AND module IN ('Inventory Management', 'Inventory')"), {"uid": user_id}).first()
    if existing:
        return jsonify({"success": False, "message": "User already has access to this module"}), 409

    access_id = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO iam.module_access (id, user_id, module, role, permissions, granted_by, tenant_id) "
        "VALUES (:id, :uid, 'Inventory Management', :role, :perms, 'system', :tid)"
    ), {"id": access_id, "uid": user_id, "role": role, "perms": json.dumps(permissions), "tid": tenant_id})
    db.session.commit()
    return jsonify({"success": True, "message": f"Access granted to {user[1]}"}), 201


@inventory_bp.route("/users/<access_id>", methods=["PUT"])
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


# ─── CHECK-IN STOCK & IQC QUALITY INSPECTION ───
@inventory_bp.route("/checkins", methods=["GET"])
def list_checkins():
    tenant_id = _get_tenant()
    cond = _tid_cond()
    try:
        rows = db.session.execute(db.text(
            f"SELECT id, checkin_no, po_no, supplier_code, supplier_name, part_or_rm_code, "
            f"item_description, ordered_qty, received_qty, checkin_time, checked_in_by, "
            f"iqc_status, iqc_passed_qty, iqc_rejected_qty, iqc_scrap_qty, iqc_time, "
            f"iqc_elapsed_min, iqc_remarks, iqc_inspector, location_code, warehouse_code, bin_code, qr_code_data "
            f"FROM inventory_stock_checkins WHERE is_deleted = false AND {cond} ORDER BY checkin_time DESC"
        ), {"tid": tenant_id}).fetchall()
        items = [{
            "id": r[0], "checkin_no": r[1], "po_no": r[2], "supplier_code": r[3],
            "supplier_name": r[4], "part_or_rm_code": r[5], "item_description": r[6] or "",
            "ordered_qty": float(r[7] or 0), "received_qty": float(r[8] or 0),
            "checkin_time": str(r[9]) if r[9] else "", "checked_in_by": r[10] or "",
            "iqc_status": r[11] or "pending_iqc", "iqc_passed_qty": float(r[12] or 0),
            "iqc_rejected_qty": float(r[13] or 0), "iqc_scrap_qty": float(r[14] or 0),
            "iqc_time": str(r[15]) if r[15] else "", "iqc_elapsed_min": int(r[16] or 0),
            "iqc_remarks": r[17] or "", "iqc_inspector": r[18] or "",
            "location_code": r[19] or "", "warehouse_code": r[20] or "MAIN",
            "bin_code": r[21] or "", "qr_code_data": r[22] or ""
        } for r in rows]
        return jsonify({"success": True, "data": items})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@inventory_bp.route("/checkins/<cid>", methods=["GET"])
def get_checkin_detail(cid):
    tenant_id = _get_tenant()
    cond = _tid_cond()
    r = db.session.execute(db.text(
        f"SELECT id, checkin_no, po_no, supplier_code, supplier_name, part_or_rm_code, "
        f"item_description, ordered_qty, received_qty, checkin_time, checked_in_by, "
        f"iqc_status, iqc_passed_qty, iqc_rejected_qty, iqc_scrap_qty, iqc_time, "
        f"iqc_elapsed_min, iqc_remarks, iqc_inspector, location_code, warehouse_code, bin_code, qr_code_data "
        f"FROM inventory_stock_checkins WHERE id = :id AND is_deleted = false AND {cond}"
    ), {"id": cid, "tid": tenant_id}).first()
    if not r:
        return jsonify({"success": False, "message": "Check-in record not found"}), 404
    data = {
        "id": r[0], "checkin_no": r[1], "po_no": r[2], "supplier_code": r[3],
        "supplier_name": r[4], "part_or_rm_code": r[5], "item_description": r[6] or "",
        "ordered_qty": float(r[7] or 0), "received_qty": float(r[8] or 0),
        "checkin_time": str(r[9]) if r[9] else "", "checked_in_by": r[10] or "",
        "iqc_status": r[11] or "pending_iqc", "iqc_passed_qty": float(r[12] or 0),
        "iqc_rejected_qty": float(r[13] or 0), "iqc_scrap_qty": float(r[14] or 0),
        "iqc_time": str(r[15]) if r[15] else "", "iqc_elapsed_min": int(r[16] or 0),
        "iqc_remarks": r[17] or "", "iqc_inspector": r[18] or "",
        "location_code": r[19] or "", "warehouse_code": r[20] or "MAIN",
        "bin_code": r[21] or "", "qr_code_data": r[22] or ""
    }
    return jsonify({"success": True, "data": data})


@inventory_bp.route("/checkins", methods=["POST"])
def create_checkin():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    po_no = data.get("po_no")
    code = data.get("part_or_rm_code")
    rec_qty = float(data.get("received_qty", 0))

    if not po_no or not code or rec_qty <= 0:
        return jsonify({"success": False, "message": "PO No, Part/RM Code, and received quantity required"}), 400

    cid = str(uuid.uuid4())
    cno = f"CHK-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    sname = data.get("supplier_name", "Supplier")
    scode = data.get("supplier_code", "SUP-101")
    performer = request.headers.get("X-User-Name") or data.get("checked_in_by", "Rajesh Kumar (EMP-1002)")
    qr_data = f"QR-{po_no}|{code}|QTY:{rec_qty}|SUP:{scode}|TIME:{datetime.now().strftime('%Y-%m-%d %H:%M')}"

    db.session.execute(db.text(
        "INSERT INTO inventory_stock_checkins (id, checkin_no, po_no, supplier_code, supplier_name, "
        "part_or_rm_code, item_description, ordered_qty, received_qty, checked_in_by, iqc_status, "
        "warehouse_code, bin_code, qr_code_data, tenant_id) VALUES (:id, :cno, :po, :scode, :sname, :code, :desc, :oqty, :rqty, :by, 'pending_iqc', :wh, :bin, :qr, :tid)"
    ), {
        "id": cid, "cno": cno, "po": po_no, "scode": scode, "sname": sname, "code": code,
        "desc": data.get("item_description", code), "oqty": float(data.get("ordered_qty", rec_qty)),
        "rqty": rec_qty, "by": performer, "wh": data.get("warehouse_code", "MAIN"),
        "bin": data.get("bin_code", "RM-A-01"), "qr": qr_data, "tid": tenant_id
    })
    db.session.commit()
    return jsonify({"success": True, "message": f"Check-In {cno} verified & registered. Pending IQC Inspection.", "checkin_no": cno, "qr_code_data": qr_data})


@inventory_bp.route("/checkins/<cid>/iqc-inspect", methods=["POST"])
def iqc_inspect_checkin(cid):
    tenant_id = _get_tenant()
    data = request.get_json() or {}

    passed_qty = float(data.get("passed_qty", 0))
    rejected_qty = float(data.get("rejected_qty", 0))
    scrap_qty = float(data.get("scrap_qty", 0))
    remarks = data.get("remarks", "IQC Inspection completed")
    inspector = request.headers.get("X-User-Name") or data.get("inspector", "Vikram Singh (EMP-1005)")
    elapsed_min = int(data.get("elapsed_min", 15))

    checkin = db.session.execute(db.text("SELECT part_or_rm_code, item_description, warehouse_code, bin_code FROM inventory_stock_checkins WHERE id = :id"), {"id": cid}).first()
    if not checkin:
        return jsonify({"success": False, "message": "Check-in record not found"}), 404

    code, desc, wh, bin_c = checkin[0], checkin[1], checkin[2], checkin[3]
    iqc_status = "passed" if (rejected_qty == 0 and scrap_qty == 0) else "partial_pass" if passed_qty > 0 else "rejected"

    db.session.execute(db.text(
        "UPDATE inventory_stock_checkins SET iqc_status = :status, iqc_passed_qty = :pqty, "
        "iqc_rejected_qty = :rqty, iqc_scrap_qty = :sqty, iqc_time = NOW(), iqc_elapsed_min = :emin, "
        "iqc_remarks = :rem, iqc_inspector = :insp, updated_at = NOW() WHERE id = :id"
    ), {
        "status": iqc_status, "pqty": passed_qty, "rqty": rejected_qty, "sqty": scrap_qty,
        "emin": elapsed_min, "rem": remarks, "insp": inspector, "id": cid
    })

    # Add PASSED OK Stock to Stock Levels & Available Stock
    if passed_qty > 0:
        db.session.execute(db.text(
            f"UPDATE inventory_stock_levels SET qty_on_hand = qty_on_hand + :pqty, qty_available = qty_available + :pqty, total_value = (qty_on_hand + :pqty)*unit_cost "
            f"WHERE part_number = :code AND is_deleted = false AND {_tid_cond()}"
        ), {"pqty": passed_qty, "code": code, "tid": tenant_id})

    # Transfer REJECTED NG Stock to Quarantine / QC Warehouse
    if rejected_qty > 0:
        ng_code = f"{code}-88" if not code.endswith("-88") else code
        db.session.execute(db.text(
            f"UPDATE inventory_stock_levels SET qty_on_hand = qty_on_hand + :rqty, qty_available = qty_available + :rqty "
            f"WHERE part_number = :ng AND is_deleted = false AND {_tid_cond()}"
        ), {"rqty": rejected_qty, "ng": ng_code, "tid": tenant_id})

    db.session.commit()
    return jsonify({"success": True, "message": f"IQC Inspection saved. Status: {iqc_status}. Passed: {passed_qty}, Rejected: {rejected_qty}"})


# ─── LOCATION DETAIL: current stock + full movement history ───
@inventory_bp.route("/locations/<lid>/detail", methods=["GET"])
def location_detail(lid):
    tenant_id = _get_tenant()
    cond = _tid_cond()
    try:
        loc = db.session.execute(db.text(
            f"SELECT id, location_code, plant, floor_name, shelf_name, row_name, column_name, "
            f"bin_code, warehouse_code, capacity, current_occupancy, is_active "
            f"FROM inventory_locations WHERE id = :id AND {cond}"
        ), {"id": lid, "tid": tenant_id}).first()
        if not loc:
            return jsonify({"success": False, "message": "Location not found"}), 404

        bin_code = loc[7]
        warehouse_code = loc[8]

        # Current stock at this bin — only rows with qty_on_hand > 0
        stock_rows = db.session.execute(db.text(
            f"SELECT part_number, part_description, item_type, qty_on_hand, qty_reserved, "
            f"qty_available, unit, unit_cost, total_value, last_movement_at "
            f"FROM inventory_stock_levels "
            f"WHERE bin_code = :bin AND warehouse_code = :wh "
            f"AND qty_on_hand > 0 AND is_deleted = false AND {cond} "
            f"ORDER BY part_number ASC"
        ), {"bin": bin_code, "wh": warehouse_code, "tid": tenant_id}).fetchall()

        current_stock = [{
            "part_number": r[0], "part_description": r[1] or "",
            "item_type": r[2] or "PART",
            "qty_on_hand": float(r[3] or 0), "qty_reserved": float(r[4] or 0),
            "qty_available": float(r[5] or 0), "unit": r[6] or "pcs",
            "unit_cost": float(r[7] or 0), "total_value": float(r[8] or 0),
            "last_movement_at": str(r[9]) if r[9] else "-"
        } for r in stock_rows]

        # Movements strictly referencing this bin with a non-null, non-empty bin code
        mov_rows = db.session.execute(db.text(
            f"SELECT movement_no, movement_type, part_number, qty, unit, "
            f"from_bin_code, to_bin_code, from_warehouse_code, to_warehouse_code, "
            f"reference_no, performed_by, created_at "
            f"FROM inventory_stock_movements "
            f"WHERE (from_bin_code = :bin OR to_bin_code = :bin) "
            f"AND from_bin_code IS NOT NULL AND from_bin_code != '' "
            f"AND to_bin_code IS NOT NULL AND to_bin_code != '' "
            f"AND is_deleted = false AND {cond} "
            f"ORDER BY created_at DESC LIMIT 200"
        ), {"bin": bin_code, "tid": tenant_id}).fetchall()

        movements = [{
            "movement_no": r[0] or "-", "movement_type": r[1],
            "part_number": r[2], "qty": float(r[3] or 0), "unit": r[4] or "pcs",
            "from_bin": r[5], "to_bin": r[6],
            "from_wh": r[7] or "-", "to_wh": r[8] or "-",
            "reference_no": r[9] or "-",
            "performed_by": r[10] or "System",
            "created_at": str(r[11]) if r[11] else "-",
            "direction": "IN" if r[6] == bin_code else "OUT"
        } for r in mov_rows]

        # Check-ins assigned to this bin
        checkin_rows = db.session.execute(db.text(
            f"SELECT checkin_no, po_no, supplier_name, part_or_rm_code, "
            f"received_qty, iqc_status, iqc_passed_qty, iqc_rejected_qty, "
            f"checked_in_by, checkin_time "
            f"FROM inventory_stock_checkins "
            f"WHERE bin_code = :bin AND is_deleted = false AND {cond} "
            f"ORDER BY checkin_time DESC"
        ), {"bin": bin_code, "tid": tenant_id}).fetchall()

        checkins = [{
            "checkin_no": r[0], "po_no": r[1], "supplier_name": r[2],
            "part_or_rm_code": r[3], "received_qty": float(r[4] or 0),
            "iqc_status": r[5] or "pending_iqc",
            "iqc_passed_qty": float(r[6] or 0), "iqc_rejected_qty": float(r[7] or 0),
            "checked_in_by": r[8] or "-", "checkin_time": str(r[9]) if r[9] else "-"
        } for r in checkin_rows]

        total_value = sum(s["total_value"] for s in current_stock)
        total_qty = sum(s["qty_on_hand"] for s in current_stock)

        return jsonify({"success": True, "data": {
            "location": {
                "id": loc[0], "location_code": loc[1], "plant": loc[2],
                "floor_name": loc[3], "shelf_name": loc[4],
                "row_name": loc[5], "column_name": loc[6],
                "bin_code": loc[7], "warehouse_code": loc[8],
                "capacity": float(loc[9] or 0), "current_occupancy": float(loc[10] or 0),
                "is_active": loc[11]
            },
            "current_stock": current_stock,
            "movements": movements,
            "checkins": checkins,
            "summary": {
                "total_parts": len(current_stock),
                "total_qty": total_qty,
                "total_value": total_value,
                "total_movements": len(movements),
                "total_checkins": len(checkins)
            }
        }})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


# ─── HIERARCHICAL LOCATIONS ───
@inventory_bp.route("/locations", methods=["GET"])
def list_locations():
    tenant_id = _get_tenant()
    cond = _tid_cond()
    try:
        rows = db.session.execute(db.text(
            f"SELECT id, location_code, plant, floor_name, shelf_name, row_name, column_name, "
            f"bin_code, warehouse_code, capacity, current_occupancy, is_active FROM inventory_locations "
            f"WHERE is_deleted = false AND {cond} ORDER BY location_code ASC"
        ), {"tid": tenant_id}).fetchall()
        items = [{
            "id": r[0], "location_code": r[1], "plant": r[2], "floor_name": r[3],
            "shelf_name": r[4], "row_name": r[5], "column_name": r[6], "bin_code": r[7],
            "warehouse_code": r[8], "capacity": float(r[9] or 0), "current_occupancy": float(r[10] or 0),
            "is_active": r[11]
        } for r in rows]
        return jsonify({"success": True, "data": items})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@inventory_bp.route("/locations", methods=["POST"])
def create_location():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    plant = data.get("plant", "Plant 1")
    floor = data.get("floor_name", "Ground Floor")
    shelf = data.get("shelf_name", "Shelf A")
    row_name = data.get("row_name", "Row 01")
    col_name = data.get("column_name", "Col 01")
    bin_code = data.get("bin_code", "RM-A-01")
    wh_code = data.get("warehouse_code", "MAIN")

    loc_code = f"P{plant[-1] if plant[-1].isdigit() else '1'}-F{floor[0]}-S{shelf[-1] if shelf[-1].isdigit() else '1'}-{row_name.replace(' ', '')}-{col_name.replace(' ', '')}"
    lid = str(uuid.uuid4())

    db.session.execute(db.text(
        "INSERT INTO inventory_locations (id, location_code, plant, floor_name, shelf_name, row_name, column_name, "
        "bin_code, warehouse_code, capacity, tenant_id) VALUES (:id, :lcode, :plant, :floor, :shelf, :row, :col, :bin, :wh, :cap, :tid)"
    ), {
        "id": lid, "lcode": loc_code, "plant": plant, "floor": floor, "shelf": shelf,
        "row": row_name, "col": col_name, "bin": bin_code, "wh": wh_code,
        "cap": float(data.get("capacity", 1000)), "tid": tenant_id
    })
    db.session.commit()
    return jsonify({"success": True, "message": f"Location {loc_code} created", "location_code": loc_code})


