import uuid
import base64
import io
from datetime import datetime
from flask import Blueprint, request, jsonify, render_template
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from extensions import db

warehouse_bp = Blueprint("warehouse", __name__)


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


def _generate_qr_base64(data_str):
    try:
        import qrcode
        qr = qrcode.QRCode(version=1, box_size=8, border=2)
        qr.add_data(data_str)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        return f"data:image/png;base64,{base64.b64encode(buffered.getvalue()).decode()}"
    except Exception:
        # Fallback SVG base64 or placeholder
        encoded_data = base64.b64encode(f"QR-{data_str}".encode()).decode()
        return f"data:image/svg+xml;base64,{base64.b64encode(f'<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"120\" height=\"120\"><rect width=\"120\" height=\"120\" fill=\"#f0f0f0\"/><text x=\"60\" y=\"60\" font-size=\"12\" text-anchor=\"middle\">{data_str}</text></svg>'.encode()).decode()}"


@warehouse_bp.route("/overview-stats", methods=["GET"])
def overview_stats():
    tenant_id = _get_tenant()
    tid_cond = "(tenant_id = :tid OR tenant_id = 'TEST' OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = '' OR tenant_id IS NULL)"
    try:
        total_zones = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM warehouse_zones WHERE is_deleted = false AND {tid_cond}"
        ), {"tid": tenant_id}).scalar() or 0

        total_bins = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM warehouse_bins WHERE is_deleted = false AND {tid_cond}"
        ), {"tid": tenant_id}).scalar() or 0

        open_picks = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM warehouse_pick_lists WHERE status IN ('open', 'in_progress') AND is_deleted = false AND {tid_cond}"
        ), {"tid": tenant_id}).scalar() or 0

        pending_putaways = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM warehouse_putaway_tasks WHERE status = 'pending' AND is_deleted = false AND {tid_cond}"
        ), {"tid": tenant_id}).scalar() or 0

        receipts_today = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM warehouse_receipts WHERE is_deleted = false AND {tid_cond}"
        ), {"tid": tenant_id}).scalar() or 0

        return jsonify({
            "success": True,
            "data": {
                "total_zones": total_zones,
                "total_bins": total_bins,
                "open_picks": open_picks,
                "pending_putaways": pending_putaways,
                "total_receipts": receipts_today
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


# 1. WAREHOUSE ZONES
@warehouse_bp.route("/zones", methods=["GET"])
def list_zones():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, zone_code, name, zone_type, warehouse_code, capacity_units, description, is_active FROM warehouse_zones WHERE is_deleted = false AND tenant_id = :tid ORDER BY zone_code ASC"
    ), {"tid": tenant_id}).fetchall()
    zones = [{
        "id": r[0], "zone_code": r[1], "name": r[2], "zone_type": r[3] or "GENERAL",
        "warehouse_code": r[4] or "MAIN", "capacity_units": r[5] or 1000,
        "description": r[6] or "", "is_active": r[7]
    } for r in rows]
    return jsonify({"success": True, "data": zones})


@warehouse_bp.route("/zones", methods=["POST"])
def create_zone():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    zcode = data.get("zone_code")
    name = data.get("name")
    if not zcode or not name:
        return jsonify({"success": False, "message": "Zone code and name required"}), 400

    zid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO warehouse_zones (id, zone_code, name, zone_type, warehouse_code, capacity_units, description, tenant_id) VALUES (:id, :zcode, :name, :ztype, :wh, :cap, :desc, :tid)"
    ), {
        "id": zid, "zcode": zcode, "name": name, "ztype": data.get("zone_type", "GENERAL"),
        "wh": data.get("warehouse_code", "MAIN"), "cap": int(data.get("capacity_units", 1000)),
        "desc": data.get("description", ""), "tid": tenant_id
    })
    db.session.commit()
    return jsonify({"success": True, "message": "Zone created", "id": zid})


# 2. BIN MANAGEMENT & QR CODES
@warehouse_bp.route("/bins", methods=["GET"])
def list_bins():
    tenant_id = _get_tenant()
    zone = request.args.get("zone", "").strip()
    status = request.args.get("status", "").strip()

    where_clause = "WHERE is_deleted = false AND tenant_id = :tid"
    params = {"tid": tenant_id}
    if zone:
        where_clause += " AND zone_code = :zone"
        params["zone"] = zone
    if status:
        where_clause += " AND status = :status"
        params["status"] = status

    rows = db.session.execute(db.text(
        f"SELECT id, bin_code, zone_code, warehouse_code, aisle, rack, level, capacity_units, current_units, status FROM warehouse_bins {where_clause} ORDER BY bin_code ASC"
    ), params).fetchall()

    bins = []
    for r in rows:
        bin_code = r[1]
        qr_img = _generate_qr_base64(f"/warehouse/bin/{bin_code}")
        bins.append({
            "id": r[0], "bin_code": bin_code, "zone_code": r[2], "warehouse_code": r[3],
            "aisle": r[4] or "A", "rack": r[5] or "01", "level": r[6] or "01",
            "capacity_units": r[7] or 500, "current_units": r[8] or 0,
            "status": r[9] or "active", "qr_code": qr_img
        })
    return jsonify({"success": True, "data": bins})


@warehouse_bp.route("/bins", methods=["POST"])
def create_bin():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    bcode = data.get("bin_code")
    zcode = data.get("zone_code", "Z1")
    wh = data.get("warehouse_code", "MAIN")

    if not bcode:
        return jsonify({"success": False, "message": "Bin code required"}), 400

    bid = str(uuid.uuid4())
    qr_data = f"/warehouse/bin/{bcode}"
    db.session.execute(db.text(
        "INSERT INTO warehouse_bins (id, bin_code, zone_code, warehouse_code, aisle, rack, level, capacity_units, current_units, status, qr_data, tenant_id) "
        "VALUES (:id, :bcode, :zcode, :wh, :aisle, :rack, :level, :cap, 0, 'active', :qr, :tid)"
    ), {
        "id": bid, "bcode": bcode, "zcode": zcode, "wh": wh,
        "aisle": data.get("aisle", "A"), "rack": data.get("rack", "01"), "level": data.get("level", "01"),
        "cap": int(data.get("capacity_units", 500)), "qr": qr_data, "tid": tenant_id
    })
    db.session.commit()
    return jsonify({"success": True, "message": f"Bin {bcode} created", "id": bid})


@warehouse_bp.route("/bins/<bin_code>/qr", methods=["GET"])
def get_bin_qr(bin_code):
    qr_base64 = _generate_qr_base64(f"/warehouse/bin/{bin_code}")
    return jsonify({"success": True, "bin_code": bin_code, "qr_code": qr_base64})


@warehouse_bp.route("/bins/<bin_code>/details", methods=["GET"])
def get_bin_details(bin_code):
    tenant_id = _get_tenant()
    bin_row = db.session.execute(db.text(
        "SELECT id, bin_code, zone_code, warehouse_code, capacity_units, current_units, status FROM warehouse_bins WHERE bin_code = :b AND tenant_id = :tid AND is_deleted = false"
    ), {"b": bin_code, "tid": tenant_id}).first()

    if not bin_row:
        # Return default mock if not seeded yet
        bin_info = {"bin_code": bin_code, "zone_code": "Z1", "warehouse_code": "MAIN", "capacity_units": 500, "current_units": 0, "status": "active"}
    else:
        bin_info = {
            "id": bin_row[0], "bin_code": bin_row[1], "zone_code": bin_row[2],
            "warehouse_code": bin_row[3], "capacity_units": bin_row[4], "current_units": bin_row[5], "status": bin_row[6]
        }

    items = db.session.execute(db.text(
        "SELECT part_number, part_description, qty_on_hand, unit FROM inventory_stock_levels WHERE bin_code = :b AND tenant_id = :tid AND is_deleted = false"
    ), {"b": bin_code, "tid": tenant_id}).fetchall()

    stock_items = [{
        "part_number": i[0], "description": i[1] or "", "qty": float(i[2] or 0), "unit": i[3] or "pcs"
    } for i in items]

    movements = db.session.execute(db.text(
        "SELECT movement_no, movement_type, part_number, qty, created_at FROM inventory_stock_movements WHERE (from_bin_code = :b OR to_bin_code = :b) AND tenant_id = :tid ORDER BY created_at DESC LIMIT 10"
    ), {"b": bin_code, "tid": tenant_id}).fetchall()

    mov_list = [{
        "movement_no": m[0], "type": m[1], "part_number": m[2], "qty": float(m[3]), "time": str(m[4])
    } for m in movements]

    bin_info["stock"] = stock_items
    bin_info["recent_movements"] = mov_list
    bin_info["qr_code"] = _generate_qr_base64(f"/warehouse/bin/{bin_code}")

    return jsonify({"success": True, "data": bin_info})


# 3. PICK LISTS
@warehouse_bp.route("/pick-lists", methods=["GET"])
def list_pick_lists():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, list_no, reference_type, reference_no, warehouse_code, assigned_to, due_date, status, notes FROM warehouse_pick_lists WHERE is_deleted = false AND tenant_id = :tid ORDER BY created_at DESC"
    ), {"tid": tenant_id}).fetchall()

    lists = []
    for r in rows:
        items = db.session.execute(db.text(
            "SELECT id, part_number, part_description, bin_code, qty_required, qty_picked, status FROM warehouse_pick_list_items WHERE pick_list_id = :pid"
        ), {"pid": r[0]}).fetchall()

        lists.append({
            "id": r[0], "list_no": r[1], "reference_type": r[2] or "PRODUCTION_ORDER",
            "reference_no": r[3] or "", "warehouse_code": r[4] or "MAIN", "assigned_to": r[5] or "Picker 1",
            "due_date": r[6] or "", "status": r[7], "notes": r[8] or "",
            "items": [{
                "id": i[0], "part_number": i[1], "description": i[2] or "", "bin_code": i[3] or "A-01-01",
                "qty_required": float(i[4] or 0), "qty_picked": float(i[5] or 0), "status": i[6]
            } for i in items]
        })
    return jsonify({"success": True, "data": lists})


@warehouse_bp.route("/pick-lists", methods=["POST"])
def create_pick_list():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    pid = str(uuid.uuid4())
    lno = f"PKL-{datetime.now().strftime('%Y%m%d%H%M')}"

    db.session.execute(db.text(
        "INSERT INTO warehouse_pick_lists (id, list_no, reference_type, reference_no, warehouse_code, assigned_to, due_date, status, notes, tenant_id) "
        "VALUES (:id, :lno, :reftype, :refno, :wh, :assigned, :due, 'open', :notes, :tid)"
    ), {
        "id": pid, "lno": lno, "reftype": data.get("reference_type", "PRODUCTION_ORDER"),
        "refno": data.get("reference_no", "ORD-1001"), "wh": data.get("warehouse_code", "MAIN"),
        "assigned": data.get("assigned_to", "Warehouse Picker"), "due": data.get("due_date", ""),
        "notes": data.get("notes", ""), "tid": tenant_id
    })

    items = data.get("items", [])
    for it in items:
        db.session.execute(db.text(
            "INSERT INTO warehouse_pick_list_items (id, pick_list_id, part_number, part_description, bin_code, qty_required, qty_picked, status, tenant_id) "
            "VALUES (:id, :pid, :p, :desc, :bin, :req, 0, 'pending', :tid)"
        ), {
            "id": str(uuid.uuid4()), "pid": pid, "p": it.get("part_number"), "desc": it.get("part_description", ""),
            "bin": it.get("bin_code", "A-01-01"), "req": float(it.get("qty_required", 1)), "tid": tenant_id
        })

    db.session.commit()
    return jsonify({"success": True, "message": f"Pick list {lno} created", "id": pid})


# 4. PUTAWAY TASKS
@warehouse_bp.route("/putaway", methods=["GET"])
def list_putaway():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, task_no, receipt_ref, part_number, part_description, qty, suggested_bin, actual_bin, warehouse_code, status, performed_by FROM warehouse_putaway_tasks WHERE is_deleted = false AND tenant_id = :tid ORDER BY created_at DESC"
    ), {"tid": tenant_id}).fetchall()
    tasks = [{
        "id": r[0], "task_no": r[1], "receipt_ref": r[2] or "", "part_number": r[3],
        "part_description": r[4] or "", "qty": float(r[5] or 0), "suggested_bin": r[6] or "A-01-01",
        "actual_bin": r[7] or "", "warehouse_code": r[8] or "MAIN", "status": r[9], "performed_by": r[10] or ""
    } for r in rows]
    return jsonify({"success": True, "data": tasks})


# 5. RECEIVING (PO RECEIPT & QC)
@warehouse_bp.route("/receipts", methods=["GET"])
def list_receipts():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, receipt_no, po_number, supplier_name, warehouse_code, receipt_date, status, notes FROM warehouse_receipts WHERE is_deleted = false AND tenant_id = :tid ORDER BY created_at DESC"
    ), {"tid": tenant_id}).fetchall()
    receipts = [{
        "id": r[0], "receipt_no": r[1], "po_number": r[2] or "", "supplier_name": r[3] or "",
        "warehouse_code": r[4] or "MAIN", "receipt_date": r[5], "status": r[6], "notes": r[7] or ""
    } for r in rows]
    return jsonify({"success": True, "data": receipts})


@warehouse_bp.route("/receipts", methods=["POST"])
def create_receipt():
    tenant_id = _get_tenant()
    data = request.get_json() or {}
    rid = str(uuid.uuid4())
    rno = f"REC-{datetime.now().strftime('%Y%m%d%H%M')}"
    po = data.get("po_number", "PO-2026-001")
    supplier = data.get("supplier_name", "Acme Components")

    db.session.execute(db.text(
        "INSERT INTO warehouse_receipts (id, receipt_no, po_number, supplier_name, warehouse_code, receipt_date, status, notes, tenant_id) "
        "VALUES (:id, :rno, :po, :supplier, :wh, :rdate, 'received', :notes, :tid)"
    ), {
        "id": rid, "rno": rno, "po": po, "supplier": supplier, "wh": data.get("warehouse_code", "MAIN"),
        "rdate": data.get("receipt_date", datetime.now().strftime('%Y-%m-%d')), "notes": data.get("notes", ""), "tid": tenant_id
    })

    # Auto generate Putaway task for received item
    part_num = data.get("part_number", "601-0-000001")
    qty_rec = float(data.get("qty_received", 100))

    db.session.execute(db.text(
        "INSERT INTO warehouse_putaway_tasks (id, task_no, receipt_ref, part_number, qty, suggested_bin, warehouse_code, status, tenant_id) "
        "VALUES (:id, :tno, :rref, :p, :qty, 'A-01-01', 'MAIN', 'pending', :tid)"
    ), {
        "id": str(uuid.uuid4()), "tno": f"PUT-{datetime.now().strftime('%Y%m%d%H%M')}", "rref": rno,
        "p": part_num, "qty": qty_rec, "tid": tenant_id
    })

    db.session.commit()
    return jsonify({"success": True, "message": f"Goods Receipt {rno} logged & putaway task generated", "receipt_no": rno})


# 6. PACKING & SHIPPING
@warehouse_bp.route("/packing", methods=["GET"])
def list_packing():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, packing_no, customer_ref, fg_part_number, qty, box_pallet_details, weight_kg, dimensions, status FROM warehouse_packing_lists WHERE is_deleted = false AND tenant_id = :tid"
    ), {"tid": tenant_id}).fetchall()
    packs = [{
        "id": r[0], "packing_no": r[1], "customer_ref": r[2] or "", "fg_part_number": r[3],
        "qty": float(r[4] or 0), "box_pallet_details": r[5] or "", "weight_kg": float(r[6] or 0),
        "dimensions": r[7] or "", "status": r[8]
    } for r in rows]
    return jsonify({"success": True, "data": packs})


@warehouse_bp.route("/shipments", methods=["GET"])
def list_shipments():
    tenant_id = _get_tenant()
    rows = db.session.execute(db.text(
        "SELECT id, shipment_no, customer_name, delivery_address, warehouse_code, dispatch_date, carrier, tracking_no, status FROM warehouse_shipments WHERE is_deleted = false AND tenant_id = :tid ORDER BY created_at DESC"
    ), {"tid": tenant_id}).fetchall()
    shipments = [{
        "id": r[0], "shipment_no": r[1], "customer_name": r[2] or "", "delivery_address": r[3] or "",
        "warehouse_code": r[4] or "MAIN", "dispatch_date": r[5] or "", "carrier": r[6] or "",
        "tracking_no": r[7] or "", "status": r[8]
    } for r in rows]
    return jsonify({"success": True, "data": shipments})


# AUDIT LOGS & USER MANAGEMENT FOR WAREHOUSE
@warehouse_bp.route("/audit-logs", methods=["GET"])
def get_audit_logs():
    tenant_id = _get_tenant()
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 20, type=int)
    try:
        rows = db.session.execute(db.text(
            "SELECT action, entity_type, entity_id, user_name, user_email, ip_address, created_at FROM audit.logs WHERE module IN ('Warehouse', 'WAREHOUSE') AND tenant_id = :tid ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        ), {"tid": tenant_id, "limit": limit, "offset": (page-1)*limit}).fetchall()
        items = [{
            "action": r[0], "entity_type": r[1] or "Bin", "entity_id": r[2] or "-",
            "user_name": r[3] or r[4] or "Warehouse Officer", "user_email": r[4] or "",
            "ip_address": r[5] or "127.0.0.1", "created_at": str(r[6])
        } for r in rows]
        return jsonify({"success": True, "data": {"items": items, "total": len(items)}})
    except Exception:
        db.session.rollback()
        return jsonify({"success": True, "data": {"items": [], "total": 0}})


@warehouse_bp.route("/users", methods=["GET"])
def get_module_users():
    tenant_id = _get_tenant()
    try:
        rows = db.session.execute(db.text(
            "SELECT ma.id, ma.user_id, ma.role, ma.permissions, ma.is_active, ma.created_at, "
            "u.email, u.first_name, u.last_name "
            "FROM iam.module_access ma JOIN iam.users u ON ma.user_id = u.id "
            "WHERE ma.module IN ('Warehouse Management', 'Warehouse') "
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


@warehouse_bp.route("/users", methods=["POST"])
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

    existing = db.session.execute(db.text("SELECT id FROM iam.module_access WHERE user_id = :uid AND module IN ('Warehouse Management', 'Warehouse')"), {"uid": user_id}).first()
    if existing:
        return jsonify({"success": False, "message": "User already has access to this module"}), 409

    access_id = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO iam.module_access (id, user_id, module, role, permissions, granted_by, tenant_id) "
        "VALUES (:id, :uid, 'Warehouse Management', :role, :perms, 'system', :tid)"
    ), {"id": access_id, "uid": user_id, "role": role, "perms": json.dumps(permissions), "tid": tenant_id})
    db.session.commit()
    return jsonify({"success": True, "message": f"Access granted to {user[1]}"}), 201


@warehouse_bp.route("/users/<access_id>", methods=["PUT"])
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


@warehouse_bp.route("/users/<access_id>", methods=["DELETE"])
def revoke_module_user(access_id):
    db.session.execute(db.text("DELETE FROM iam.module_access WHERE id = :id"), {"id": access_id})
    db.session.commit()
    return jsonify({"success": True, "message": "Access revoked"})


