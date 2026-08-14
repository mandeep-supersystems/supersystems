from flask import Blueprint, request
from extensions import db
import uuid
import json

supplier_bp = Blueprint("suppliers", __name__)


def _tid():
    return request.headers.get("X-Tenant-ID", "")


def _by():
    return request.headers.get("X-User-Name", "") or request.headers.get("X-User-Email", "")


def _safe_float(v):
    try:
        if v in (None, "", " ", "nan", "NaN", "NAN"):
            return 0.0
        import math
        val = float(v)
        if math.isnan(val) or math.isinf(val):
            return 0.0
        return val
    except Exception:
        return 0.0


def _log(action, entity_type, entity_id, old_value=None, new_value=None):
    try:
        import json
        db.session.execute(db.text(
            "INSERT INTO audit.logs (id, action, module, entity_type, entity_id, ip_address, tenant_id, user_email, user_name, created_at, old_value, new_value) "
            "VALUES (gen_random_uuid(), :action, 'Supplier Management', :etype, :eid, :ip, :tid, :email, :name, NOW(), :old_val, :new_val)"
        ), {
            "action": action,
            "etype": entity_type,
            "eid": str(entity_id),
            "ip": request.remote_addr or "",
            "tid": _tid(),
            "email": request.headers.get("X-User-Email", ""),
            "name": request.headers.get("X-User-Name", ""),
            "old_val": json.dumps(old_value) if old_value else None,
            "new_val": json.dumps(new_value) if new_value else None
        })
    except Exception:
        pass


# ─── OVERVIEW ───
@supplier_bp.route("/overview", methods=["GET"])
def sup_overview():
    tid = _tid()
    period = request.args.get("period", "all")

    time_filter = ""
    if period == "day":
        time_filter = "AND created_at >= NOW() - INTERVAL '1 day'"
    elif period == "week":
        time_filter = "AND created_at >= NOW() - INTERVAL '7 days'"
    elif period == "month":
        time_filter = "AND created_at >= NOW() - INTERVAL '30 days'"
    elif period == "year":
        time_filter = "AND created_at >= NOW() - INTERVAL '365 days'"

    total_suppliers = db.session.execute(db.text(
        "SELECT COUNT(*) FROM supplier.suppliers WHERE tenant_id = :tid AND is_deleted = false"
    ), {"tid": tid}).scalar() or 0
    
    active_suppliers = db.session.execute(db.text(
        "SELECT COUNT(*) FROM supplier.suppliers WHERE tenant_id = :tid AND is_deleted = false AND status = 'active'"
    ), {"tid": tid}).scalar() or 0
    
    total_parts = db.session.execute(db.text(
        "SELECT COUNT(*) FROM supplier.parts WHERE is_deleted = false AND supplier_id IN "
        "(SELECT id FROM supplier.suppliers WHERE tenant_id = :tid)"
    ), {"tid": tid}).scalar() or 0
    
    total_contracts = db.session.execute(db.text(
        "SELECT COUNT(*) FROM supplier.contracts WHERE is_deleted = false AND supplier_id IN "
        "(SELECT id FROM supplier.suppliers WHERE tenant_id = :tid)"
    ), {"tid": tid}).scalar() or 0

    type_rows = db.session.execute(db.text(
        "SELECT company_type, COUNT(*) FROM supplier.suppliers "
        "WHERE tenant_id = :tid AND is_deleted = false GROUP BY company_type"
    ), {"tid": tid}).fetchall()
    type_breakdown = [{"type": r[0] if r[0] else 'Unspecified', "count": r[1]} for r in type_rows]
    type_breakdown = sorted(type_breakdown, key=lambda x: x["count"], reverse=True)

    recent_logs = db.session.execute(db.text(
        f"SELECT action, entity_type, entity_id, created_at FROM audit.logs "
        f"WHERE module = 'Supplier Management' AND tenant_id = :tid {time_filter} ORDER BY created_at DESC LIMIT 20"
    ), {"tid": tid})
    recent_activity = [{"action": r[0], "entity_type": r[1], "entity_id": r[2],
                        "created_at": str(r[3]) if r[3] else None} for r in recent_logs]

    action_rows = db.session.execute(db.text(
        f"SELECT action, COUNT(*) FROM audit.logs "
        f"WHERE module = 'Supplier Management' AND tenant_id = :tid {time_filter} GROUP BY action"
    ), {"tid": tid}).fetchall()
    action_breakdown = {r[0]: r[1] for r in action_rows}

    return {"success": True, "data": {
        "total_suppliers": total_suppliers,
        "active_suppliers": active_suppliers,
        "total_parts": total_parts,
        "total_contracts": total_contracts,
        "type_breakdown": type_breakdown,
        "action_breakdown": action_breakdown,
        "recent_activity": recent_activity
    }}


# ─── SUPPLIERS ───

@supplier_bp.route("/suppliers", methods=["GET"])
def list_suppliers():
    tid = _tid()
    q = request.args.get("q", "").strip()
    where = "(tenant_id = :tid OR tenant_id = '' OR tenant_id IS NULL) AND is_deleted = false"
    params = {"tid": tid}
    if q:
        where += " AND (LOWER(brand_name) LIKE LOWER(:q) OR LOWER(supplier_code) LIKE LOWER(:q) OR LOWER(registered_name) LIKE LOWER(:q) OR LOWER(gst_no) LIKE LOWER(:q))"
        params["q"] = f"%{q}%"

    rows = db.session.execute(db.text(
        "SELECT id, supplier_code, brand_name, company_type, registered_name, gst_no, status, rating, currency, website, notes, created_by, created_at, updated_at "
        "FROM supplier.suppliers WHERE " + where + " ORDER BY created_at DESC"
    ), params).fetchall()

    return {"success": True, "data": [{
        "id": str(r[0]),
        "supplier_code": r[1],
        "brand_name": r[2],
        "company_type": r[3] or "",
        "registered_name": r[4] or "",
        "gst_no": r[5] or "",
        "status": r[6] or "active",
        "rating": _safe_float(r[7]),
        "currency": r[8] or "INR",
        "website": r[9] or "",
        "notes": r[10] or "",
        "created_by": r[11] or "",
        "created_at": str(r[12]) if r[12] else None,
        "updated_at": str(r[13]) if r[13] else None
    } for r in rows]}


@supplier_bp.route("/suppliers/<sid>", methods=["GET"])
def get_supplier(sid):
    supplier = db.session.execute(db.text(
        "SELECT id, supplier_code, brand_name, company_type, registered_name, gst_no, status, rating, currency, website, notes, created_by, created_at, updated_at "
        "FROM supplier.suppliers WHERE id = :id AND is_deleted = false"
    ), {"id": sid}).first()
    if not supplier:
        return {"success": False, "message": "Supplier not found"}, 404

    addrs = db.session.execute(db.text(
        "SELECT id, label, billing_address, shipping_address, is_default, created_at "
        "FROM supplier.addresses WHERE supplier_id = :sid AND is_deleted = false ORDER BY is_default DESC, created_at"
    ), {"sid": sid}).fetchall()

    contacts = db.session.execute(db.text(
        "SELECT id, designation, name, mobile1, mobile2, email, status, about, remarks, created_at "
        "FROM supplier.contacts WHERE supplier_id = :sid AND is_deleted = false ORDER BY created_at"
    ), {"sid": sid}).fetchall()

    items = db.session.execute(db.text(
        "SELECT id, item_type, part_code, mpn, make, unit, moq, moq_price, spq, spq_price, sample_qty, sample_price, notes, created_at "
        "FROM supplier.parts WHERE supplier_id = :sid AND is_deleted = false ORDER BY item_type, created_at"
    ), {"sid": sid}).fetchall()

    price_history = db.session.execute(db.text(
        "SELECT id, supplier_id, item_code, item_type, price, currency, unit, reference_no, event_date, notes, created_at "
        "FROM supplier.price_history WHERE supplier_id = :sid AND is_deleted = false ORDER BY event_date DESC, created_at DESC"
    ), {"sid": sid}).fetchall()

    history = db.session.execute(db.text(
        "SELECT id, part_code, event_type, description, amount, quantity, unit, reference_no, event_date, created_by, created_at "
        "FROM supplier.history WHERE supplier_id = :sid ORDER BY created_at DESC LIMIT 100"
    ), {"sid": sid}).fetchall()

    audit = db.session.execute(db.text(
        "SELECT id, action, entity_type, user_email, user_name, ip_address, created_at, old_value, new_value "
        "FROM audit.logs "
        "WHERE module = 'Supplier Management' AND ("
        "  entity_id = :sid "
        "  OR entity_id IN (SELECT id::text FROM supplier.addresses WHERE supplier_id = :sid) "
        "  OR entity_id IN (SELECT id::text FROM supplier.contacts WHERE supplier_id = :sid) "
        "  OR entity_id IN (SELECT id::text FROM supplier.parts WHERE supplier_id = :sid) "
        "  OR entity_id IN (SELECT id::text FROM supplier.evaluations WHERE supplier_id = :sid) "
        "  OR entity_id IN (SELECT id::text FROM supplier.contracts WHERE supplier_id = :sid) "
        "  OR entity_id IN (SELECT id::text FROM supplier.performance WHERE supplier_id = :sid)"
        "  OR entity_id IN (SELECT id::text FROM supplier.history WHERE supplier_id = :sid)"
        ") ORDER BY created_at DESC LIMIT 200"
    ), {"sid": str(sid)}).fetchall()

    evaluations = db.session.execute(db.text(
        "SELECT id, supplier_id, evaluation_date, period, document_verification_status, workflow_stage, quality_score, price_score, delivery_score, capacity_score, financial_stability_score, experience_score, technical_support_score, overall_score, approval_status, evaluator_id, comments, created_at "
        "FROM supplier.evaluations WHERE supplier_id = :sid AND is_deleted = false ORDER BY evaluation_date DESC, created_at DESC"
    ), {"sid": sid}).fetchall()

    contracts = db.session.execute(db.text(
        "SELECT id, supplier_id, contract_number, contract_type, start_date, end_date, contract_value, payment_terms, delivery_terms, attachment_path, status, auto_renew, lifecycle_stage, notes, created_at "
        "FROM supplier.contracts WHERE supplier_id = :sid AND is_deleted = false ORDER BY start_date DESC, created_at DESC"
    ), {"sid": sid}).fetchall()

    performance = db.session.execute(db.text(
        "SELECT id, supplier_id, period, po_count, grn_count, inspection_pass_rate, ncr_count, quality_defect_rate, on_time_delivery_rate, overall_score, performance_grade, created_at "
        "FROM supplier.performance WHERE supplier_id = :sid AND is_deleted = false ORDER BY period DESC, created_at DESC LIMIT 20"
    ), {"sid": sid}).fetchall()

    return {"success": True, "data": {
        "supplier": {
            "id": str(supplier[0]),
            "supplier_code": supplier[1],
            "brand_name": supplier[2],
            "company_type": supplier[3] or "",
            "registered_name": supplier[4] or "",
            "gst_no": supplier[5] or "",
            "status": supplier[6] or "active",
            "rating": _safe_float(supplier[7]),
            "currency": supplier[8] or "INR",
            "website": supplier[9] or "",
            "notes": supplier[10] or "",
            "created_by": supplier[11] or "",
            "created_at": str(supplier[12]) if supplier[12] else None,
            "updated_at": str(supplier[13]) if supplier[13] else None
        },
        "addresses": [{
            "id": str(a[0]),
            "label": a[1] or "",
            "billing_address": a[2] or "",
            "shipping_address": a[3] or "",
            "is_default": bool(a[4]) if a[4] is not None else False,
            "created_at": str(a[5]) if a[5] else None
        } for a in addrs],
        "contacts": [{
            "id": str(c[0]),
            "designation": c[1] or "",
            "name": c[2],
            "mobile1": c[3] or "",
            "mobile2": c[4] or "",
            "email": c[5] or "",
            "status": c[6] or "active",
            "about": c[7] or "",
            "remarks": c[8] or "",
            "created_at": str(c[9]) if c[9] else None
        } for c in contacts],
        "items": [{
            "id": str(i[0]),
            "item_type": i[1] or "part",
            "part_code": i[2] or "",
            "mpn": i[3] or "",
            "make": i[4] or "",
            "unit": i[5] or "",
            "moq": _safe_float(i[6]),
            "moq_price": _safe_float(i[7]),
            "spq": _safe_float(i[8]),
            "spq_price": _safe_float(i[9]),
            "sample_qty": _safe_float(i[10]),
            "sample_price": _safe_float(i[11]),
            "notes": i[12] or "",
            "created_at": str(i[13]) if i[13] else None
        } for i in items],
        "price_history": [{
            "id": str(ph[0]),
            "supplier_id": str(ph[1]),
            "item_code": ph[2] or "",
            "item_type": ph[3] or "part",
            "price": _safe_float(ph[4]),
            "currency": ph[5] or "INR",
            "unit": ph[6] or "",
            "reference_no": ph[7] or "",
            "event_date": str(ph[8]) if ph[8] else None,
            "notes": ph[9] or "",
            "created_at": str(ph[10]) if ph[10] else None
        } for ph in price_history],
        "history": [{
            "id": str(h[0]),
            "part_code": h[1] or "",
            "event_type": h[2] or "",
            "description": h[3] or "",
            "amount": _safe_float(h[4]),
            "quantity": _safe_float(h[5]),
            "unit": h[6] or "",
            "reference_no": h[7] or "",
            "event_date": str(h[8]) if h[8] else None,
            "created_by": h[9] or "",
            "created_at": str(h[10]) if h[10] else None
        } for h in history],
        "evaluations": [{
            "id": str(e[0]),
            "supplier_id": str(e[1]),
            "evaluation_date": str(e[2]) if e[2] else None,
            "period": e[3] or "",
            "document_verification_status": e[4] or "pending",
            "workflow_stage": e[5] or "registration",
            "quality_score": _safe_float(e[6]),
            "price_score": _safe_float(e[7]),
            "delivery_score": _safe_float(e[8]),
            "capacity_score": _safe_float(e[9]),
            "financial_stability_score": _safe_float(e[10]),
            "experience_score": _safe_float(e[11]),
            "technical_support_score": _safe_float(e[12]),
            "overall_score": _safe_float(e[13]),
            "approval_status": e[14] or "pending",
            "evaluator_id": e[15] or "",
            "comments": e[16] or "",
            "created_at": str(e[17]) if e[17] else None
        } for e in evaluations],
        "contracts": [{
            "id": str(c[0]),
            "supplier_id": str(c[1]),
            "contract_number": c[2] or "",
            "contract_type": c[3] or "",
            "start_date": str(c[4]) if c[4] else None,
            "end_date": str(c[5]) if c[5] else None,
            "contract_value": _safe_float(c[6]),
            "payment_terms": c[7] or "",
            "delivery_terms": c[8] or "",
            "attachment_path": c[9] or "",
            "status": c[10] or "draft",
            "auto_renew": bool(c[11]) if c[11] is not None else False,
            "lifecycle_stage": c[12] or "draft",
            "notes": c[13] or "",
            "created_at": str(c[14]) if c[14] else None
        } for c in contracts],
        "performance": [{
            "id": str(p[0]),
            "supplier_id": str(p[1]),
            "period": p[2] or "",
            "po_count": _safe_float(p[3]),
            "grn_count": _safe_float(p[4]),
            "inspection_pass_rate": _safe_float(p[5]),
            "ncr_count": _safe_float(p[6]),
            "quality_defect_rate": _safe_float(p[7]),
            "on_time_delivery_rate": _safe_float(p[8]),
            "overall_score": _safe_float(p[9]),
            "performance_grade": p[10] or "",
            "created_at": str(p[11]) if p[11] else None
        } for p in performance],
        "audit_logs": [{
            "id": str(a[0]),
            "action": a[1],
            "entity_type": a[2] or "",
            "user_email": a[3] or "",
            "user_name": a[4] or "",
            "ip_address": a[5] or "",
            "created_at": str(a[6]) if a[6] else None,
            "old_value": a[7] if isinstance(a[7], (dict, list)) else (json.loads(a[7]) if (isinstance(a[7], str) and a[7].strip()) else None),
            "new_value": a[8] if isinstance(a[8], (dict, list)) else (json.loads(a[8]) if (isinstance(a[8], str) and a[8].strip()) else None)
        } for a in audit]
    }}


@supplier_bp.route("/suppliers", methods=["POST"])
def create_supplier():
    data = request.get_json() or {}
    if not data.get("brand_name"):
        return {"success": False, "message": "Brand Name is required"}, 400

    supplier_code = str(data.get("supplier_code", "")).strip()
    if not supplier_code:
        count = db.session.execute(db.text(
            "SELECT COUNT(*) FROM supplier.suppliers WHERE (tenant_id = :tid OR tenant_id = '' OR tenant_id IS NULL)"
        ), {"tid": _tid()}).scalar() or 0
        supplier_code = f"SUP{count + 1:04d}"

    existing = db.session.execute(db.text(
        "SELECT id FROM supplier.suppliers WHERE supplier_code = :code AND is_deleted = false"
    ), {"code": supplier_code}).first()
    if existing:
        return {"success": False, "message": "Supplier code already exists"}, 409

    sid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO supplier.suppliers (id, supplier_code, brand_name, company_type, registered_name, gst_no, status, rating, currency, website, notes, tenant_id, created_by) "
        "VALUES (:id, :code, :brand, :ctype, :rname, :gst, :status, :rating, :currency, :website, :notes, :tid, :by)"
    ), {
        "id": sid,
        "code": supplier_code,
        "brand": data.get("brand_name"),
        "ctype": data.get("company_type", ""),
        "rname": data.get("registered_name", ""),
        "gst": data.get("gst_no", ""),
        "status": data.get("status", "active"),
        "rating": data.get("rating", 0),
        "currency": data.get("currency", "INR"),
        "website": data.get("website", ""),
        "notes": data.get("notes", ""),
        "tid": _tid(),
        "by": _by()
    })
    _log("CREATE", "Supplier", sid)
    db.session.commit()
    return {"success": True, "data": {"id": sid, "supplier_code": supplier_code}, "message": "Supplier created"}, 201


@supplier_bp.route("/suppliers/<sid>", methods=["PUT"])
def update_supplier(sid):
    data = request.get_json() or {}
    updates, params = [], {"id": sid}
    for f in ["brand_name", "company_type", "registered_name", "gst_no", "status", "rating", "currency", "website", "notes"]:
        if f in data:
            updates.append(f"{f}=:{f}")
            params[f] = data[f]
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    old_row = db.session.execute(db.text("SELECT * FROM supplier.suppliers WHERE id=:id"), {"id": sid}).mappings().first()
    old_val = dict(old_row) if old_row else None
    if old_val:
        for k, v in old_val.items():
            if hasattr(v, 'isoformat'): old_val[k] = v.isoformat()
            
    db.session.execute(db.text(f"UPDATE supplier.suppliers SET {', '.join(updates)} WHERE id=:id"), params)
    _log("UPDATE", "Supplier", sid)
    
    new_row = db.session.execute(db.text("SELECT * FROM supplier.suppliers WHERE id=:id"), {"id": sid}).mappings().first()
    new_val = dict(new_row) if new_row else None
    if new_val:
        for k, v in new_val.items():
            if hasattr(v, 'isoformat'): new_val[k] = v.isoformat()
            
    _log("UPDATE", "Supplier", sid, old_val, new_val)
    db.session.commit()
    return {"success": True, "message": "Supplier updated"}


@supplier_bp.route("/suppliers/<sid>", methods=["DELETE"])
def delete_supplier(sid):
    db.session.execute(db.text(
        "UPDATE supplier.suppliers SET is_deleted=true, updated_at=NOW() WHERE id=:id"
    ), {"id": sid})
    _log("DELETE", "Supplier", sid)
    db.session.commit()
    return {"success": True, "message": "Supplier deleted"}


# ─── ADDRESSES ───

@supplier_bp.route("/suppliers/<sid>/addresses", methods=["POST"])
def add_address(sid):
    data = request.get_json() or {}
    aid = str(uuid.uuid4())
    if data.get("is_default"):
        db.session.execute(db.text(
            "UPDATE supplier.addresses SET is_default=false WHERE supplier_id=:sid"
        ), {"sid": sid})
    db.session.execute(db.text(
        "INSERT INTO supplier.addresses (id, supplier_id, label, billing_address, shipping_address, is_default, tenant_id) "
        "VALUES (:id, :sid, :label, :bill, :ship, :def, :tid)"
    ), {
        "id": aid,
        "sid": sid,
        "label": data.get("label", ""),
        "bill": data.get("billing_address", ""),
        "ship": data.get("shipping_address", ""),
        "def": data.get("is_default", False),
        "tid": _tid()
    })
    _log("CREATE", "Supplier Address", aid)
    db.session.commit()
    return {"success": True, "data": {"id": aid}, "message": "Address added"}, 201


@supplier_bp.route("/suppliers/<sid>/addresses/<aid>", methods=["PUT"])
def update_address(sid, aid):
    data = request.get_json() or {}
    updates, params = [], {"id": aid}
    for f in ["label", "billing_address", "shipping_address", "is_default"]:
        if f in data:
            updates.append(f"{f}=:{f}")
            params[f] = data[f]
    if data.get("is_default"):
        db.session.execute(db.text(
            "UPDATE supplier.addresses SET is_default=false WHERE supplier_id=:sid"
        ), {"sid": sid})
    if updates:
        old_row = db.session.execute(db.text("SELECT * FROM supplier.addresses WHERE id=:id"), {"id": aid}).mappings().first()
    old_val = dict(old_row) if old_row else None
    if old_val:
        for k, v in old_val.items():
            if hasattr(v, 'isoformat'): old_val[k] = v.isoformat()
            
    db.session.execute(db.text(f"UPDATE supplier.addresses SET {', '.join(updates)} WHERE id=:id"), params)
    _log("UPDATE", "Supplier Address", aid)
    
    new_row = db.session.execute(db.text("SELECT * FROM supplier.addresses WHERE id=:id"), {"id": aid}).mappings().first()
    new_val = dict(new_row) if new_row else None
    if new_val:
        for k, v in new_val.items():
            if hasattr(v, 'isoformat'): new_val[k] = v.isoformat()
            
    _log("UPDATE", "Supplier Address", aid, old_val, new_val)
    db.session.commit()
    return {"success": True, "message": "Address updated"}


@supplier_bp.route("/suppliers/<sid>/addresses/<aid>", methods=["DELETE"])
def delete_address(sid, aid):
    db.session.execute(db.text(
        "UPDATE supplier.addresses SET is_deleted=true WHERE id=:id"
    ), {"id": aid})
    _log("DELETE", "Supplier Address", aid)
    db.session.commit()
    return {"success": True, "message": "Address deleted"}


# ─── CONTACTS ───

@supplier_bp.route("/suppliers/<sid>/contacts", methods=["POST"])
def add_contact(sid):
    data = request.get_json() or {}
    if not data.get("name"):
        return {"success": False, "message": "Contact name required"}, 400
    cid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO supplier.contacts (id, supplier_id, designation, name, mobile1, mobile2, email, status, about, remarks, tenant_id) "
        "VALUES (:id, :sid, :desig, :name, :m1, :m2, :email, :status, :about, :remarks, :tid)"
    ), {
        "id": cid,
        "sid": sid,
        "desig": data.get("designation", ""),
        "name": data.get("name", ""),
        "m1": data.get("mobile1", ""),
        "m2": data.get("mobile2", ""),
        "email": data.get("email", ""),
        "status": data.get("status", "active"),
        "about": data.get("about", ""),
        "remarks": data.get("remarks", ""),
        "tid": _tid()
    })
    _log("CREATE", "Supplier Contact", cid)
    db.session.commit()
    return {"success": True, "data": {"id": cid}, "message": "Contact added"}, 201


@supplier_bp.route("/suppliers/<sid>/contacts/<cid>", methods=["PUT"])
def update_contact(sid, cid):
    data = request.get_json() or {}
    updates, params = [], {"id": cid}
    for f in ["designation", "name", "mobile1", "mobile2", "email", "status", "about", "remarks"]:
        if f in data:
            updates.append(f"{f}=:{f}")
            params[f] = data[f]
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    old_row = db.session.execute(db.text("SELECT * FROM supplier.contacts WHERE id=:id"), {"id": cid}).mappings().first()
    old_val = dict(old_row) if old_row else None
    if old_val:
        for k, v in old_val.items():
            if hasattr(v, 'isoformat'): old_val[k] = v.isoformat()
            
    db.session.execute(db.text(f"UPDATE supplier.contacts SET {', '.join(updates)} WHERE id=:id"), params)
    _log("UPDATE", "Supplier Contact", cid)
    
    new_row = db.session.execute(db.text("SELECT * FROM supplier.contacts WHERE id=:id"), {"id": cid}).mappings().first()
    new_val = dict(new_row) if new_row else None
    if new_val:
        for k, v in new_val.items():
            if hasattr(v, 'isoformat'): new_val[k] = v.isoformat()
            
    _log("UPDATE", "Supplier Contact", cid, old_val, new_val)
    db.session.commit()
    return {"success": True, "message": "Contact updated"}


@supplier_bp.route("/suppliers/<sid>/contacts/<cid>", methods=["DELETE"])
def delete_contact(sid, cid):
    db.session.execute(db.text(
        "UPDATE supplier.contacts SET is_deleted=true WHERE id=:id"
    ), {"id": cid})
    _log("DELETE", "Supplier Contact", cid)
    db.session.commit()
    return {"success": True, "message": "Contact deleted"}


# ─── ITEMS ───

@supplier_bp.route("/suppliers/<sid>/items", methods=["POST"])
def add_item(sid):
    data = request.get_json() or {}
    pid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO supplier.parts (id, supplier_id, item_type, part_code, mpn, make, unit, moq, moq_price, spq, spq_price, sample_qty, sample_price, notes, tenant_id) "
        "VALUES (:id, :sid, :item_type, :pc, :mpn, :make, :unit, :moq, :moqp, :spq, :spqp, :sq, :sp, :notes, :tid)"
    ), {
        "id": pid,
        "sid": sid,
        "item_type": str(data.get("item_type") or "part").lower(),
        "pc": data.get("part_code") or "",
        "mpn": data.get("mpn") or "",
        "make": data.get("make") or "",
        "unit": data.get("unit") or "",
        "moq": _safe_float(data.get("moq")),
        "moqp": _safe_float(data.get("moq_price")),
        "spq": _safe_float(data.get("spq")),
        "spqp": _safe_float(data.get("spq_price")),
        "sq": _safe_float(data.get("sample_qty")),
        "sp": _safe_float(data.get("sample_price")),
        "notes": data.get("notes") or "",
        "tid": _tid()
    })
    _log("CREATE", "Supplier Item", pid, new_value={"part_code": data.get("part_code") or "", "mpn": data.get("mpn") or "", "make": data.get("make") or ""})
    
    # Auto-add to part.manufacturers if it's a new combination
    _item_type = str(data.get("item_type") or "part").lower()
    _pc = data.get("part_code") or ""
    _mpn = data.get("mpn") or ""
    _make = data.get("make") or ""
    
    if _item_type == "part" and _pc and (_mpn or _make):
        _exists = db.session.execute(db.text(
            "SELECT 1 FROM part.manufacturers WHERE part_number = :pn AND (mpn = :mpn OR (mpn IS NULL AND :mpn = '')) AND (make = :make OR (make IS NULL AND :make = ''))"
        ), {"pn": _pc, "mpn": _mpn, "make": _make}).fetchone()
        if not _exists:
            db.session.execute(db.text(
                "INSERT INTO part.manufacturers (part_number, mpn, make) VALUES (:pn, :mpn, :make)"
            ), {"pn": _pc, "mpn": _mpn, "make": _make})

    db.session.commit()
    return {"success": True, "data": {"id": pid}, "message": "Item added"}, 201


@supplier_bp.route("/suppliers/<sid>/items/<pid>", methods=["PUT"])
def update_item(sid, pid):
    data = request.get_json() or {}
    updates, params = [], {"id": pid}
    for f in ["item_type", "part_code", "mpn", "make", "unit", "moq", "moq_price", "spq", "spq_price", "sample_qty", "sample_price", "notes"]:
        if f in data:
            updates.append(f"{f}=:{f}")
            if f in ("unit", "item_type", "part_code", "mpn", "make", "notes"):
                params[f] = data[f] if data[f] is not None else ""
            elif f in ("moq", "moq_price", "spq", "spq_price", "sample_qty", "sample_price"):
                params[f] = _safe_float(data[f])
            else:
                params[f] = data[f] if data[f] != "" else None
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    old_row = db.session.execute(db.text("SELECT * FROM supplier.parts WHERE id=:id"), {"id": pid}).mappings().first()
    old_val = dict(old_row) if old_row else None
    if old_val:
        for k, v in old_val.items():
            if hasattr(v, 'isoformat'): old_val[k] = v.isoformat()
            
    db.session.execute(db.text(f"UPDATE supplier.parts SET {', '.join(updates)} WHERE id=:id"), params)
    _log("UPDATE", "Supplier Item", pid)
    
    new_row = db.session.execute(db.text("SELECT * FROM supplier.parts WHERE id=:id"), {"id": pid}).mappings().first()
    new_val = dict(new_row) if new_row else None
    if new_val:
        for k, v in new_val.items():
            if hasattr(v, 'isoformat'): new_val[k] = v.isoformat()
            
    _log("UPDATE", "Supplier Item", pid, old_val, new_val)
    db.session.commit()
    return {"success": True, "message": "Item updated"}


@supplier_bp.route("/suppliers/<sid>/items/<pid>", methods=["DELETE"])
def delete_item(sid, pid):
    item = db.session.execute(db.text("SELECT part_code, mpn, make FROM supplier.parts WHERE id=:id"), {"id": pid}).fetchone()
    db.session.execute(db.text(
        "UPDATE supplier.parts SET is_deleted=true, updated_at=NOW() WHERE id=:id"
    ), {"id": pid})
    _log("DELETE", "Supplier Item", pid, old_value={"part_code": item[0], "mpn": item[1], "make": item[2]} if item else None)
    db.session.commit()
    return {"success": True, "message": "Item deleted"}


# ─── PRICE HISTORY ───

@supplier_bp.route("/suppliers/<sid>/price-history", methods=["GET"])
def list_price_history(sid):
    rows = db.session.execute(db.text(
        "SELECT id, supplier_id, item_code, item_type, price, currency, unit, reference_no, event_date, notes, created_at "
        "FROM supplier.price_history WHERE supplier_id = :sid AND is_deleted = false ORDER BY event_date DESC, created_at DESC"
    ), {"sid": sid}).fetchall()
    return {"success": True, "data": [{
        "id": str(r[0]),
        "supplier_id": str(r[1]),
        "item_code": r[2] or "",
        "item_type": r[3] or "part",
        "price": _safe_float(r[4]),
        "currency": r[5] or "INR",
        "unit": r[6] or "",
        "reference_no": r[7] or "",
        "event_date": str(r[8]) if r[8] else None,
        "notes": r[9] or "",
        "created_at": str(r[10]) if r[10] else None
    } for r in rows]}


@supplier_bp.route("/suppliers/<sid>/price-history", methods=["POST"])
def add_price_history(sid):
    data = request.get_json() or {}
    phid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO supplier.price_history (id, supplier_id, item_code, item_type, price, currency, unit, reference_no, event_date, notes, tenant_id, created_by) "
        "VALUES (:id, :sid, :item_code, :item_type, :price, :currency, :unit, :ref, :event_date, :notes, :tid, :by)"
    ), {
        "id": phid,
        "sid": sid,
        "item_code": data.get("item_code", ""),
        "item_type": str(data.get("item_type", "part")).lower(),
        "price": data.get("price") or 0,
        "currency": data.get("currency", "INR"),
        "unit": data.get("unit", ""),
        "ref": data.get("reference_no", ""),
        "event_date": data.get("event_date") or None,
        "notes": data.get("notes", ""),
        "tid": _tid(),
        "by": _by()
    })
    _log("CREATE", "Supplier Price History", phid)
    db.session.commit()
    return {"success": True, "data": {"id": phid}, "message": "Price history entry added"}, 201


@supplier_bp.route("/suppliers/<sid>/items/<item_code>/price-history", methods=["GET"])
def item_price_history(sid, item_code):
    rows = db.session.execute(db.text(
        "SELECT id, supplier_id, item_code, item_type, price, currency, unit, reference_no, event_date, notes, created_at "
        "FROM supplier.price_history WHERE supplier_id = :sid AND LOWER(item_code) = LOWER(:item_code) AND is_deleted = false ORDER BY event_date DESC, created_at DESC"
    ), {"sid": sid, "item_code": item_code}).fetchall()
    return {"success": True, "data": [{
        "id": str(r[0]),
        "supplier_id": str(r[1]),
        "item_code": r[2] or "",
        "item_type": r[3] or "part",
        "price": _safe_float(r[4]),
        "currency": r[5] or "INR",
        "unit": r[6] or "",
        "reference_no": r[7] or "",
        "event_date": str(r[8]) if r[8] else None,
        "notes": r[9] or "",
        "created_at": str(r[10]) if r[10] else None
    } for r in rows]}


# ─── HISTORY ───

@supplier_bp.route("/suppliers/<sid>/history", methods=["POST"])
def add_history(sid):
    data = request.get_json() or {}
    hid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO supplier.history (id, supplier_id, part_code, event_type, description, amount, quantity, unit, reference_no, event_date, created_by, tenant_id) "
        "VALUES (:id, :sid, :pc, :etype, :desc, :amt, :qty, :unit, :ref, :edate, :by, :tid)"
    ), {
        "id": hid,
        "sid": sid,
        "pc": data.get("part_code", ""),
        "etype": data.get("event_type", ""),
        "desc": data.get("description", ""),
        "amt": data.get("amount") or None,
        "qty": data.get("quantity") or None,
        "unit": data.get("unit", ""),
        "ref": data.get("reference_no", ""),
        "edate": data.get("event_date") or None,
        "by": _by(),
        "tid": _tid()
    })
    _log("CREATE", "Supplier History", hid, new_value={
        "part_code": data.get("part_code", ""),
        "event_type": data.get("event_type", ""),
        "description": data.get("description", ""),
        "quantity": data.get("quantity", ""),
        "unit": data.get("unit", ""),
        "amount": data.get("amount", ""),
        "reference_no": data.get("reference_no", "")
    })
    db.session.commit()
    return {"success": True, "data": {"id": hid}, "message": "History entry added"}, 201


# ─── EVALUATIONS CRUD ───

@supplier_bp.route("/suppliers/<sid>/evaluations", methods=["GET"])
def list_evaluations(sid):
    rows = db.session.execute(db.text(
        "SELECT id, supplier_id, evaluation_date, period, document_verification_status, workflow_stage, quality_score, price_score, delivery_score, capacity_score, financial_stability_score, experience_score, technical_support_score, overall_score, approval_status, evaluator_id, comments, created_at "
        "FROM supplier.evaluations WHERE supplier_id = :sid AND is_deleted = false ORDER BY evaluation_date DESC, created_at DESC"
    ), {"sid": sid}).fetchall()
    return {"success": True, "data": [{
        "id": str(r[0]),
        "supplier_id": str(r[1]),
        "evaluation_date": str(r[2]) if r[2] else None,
        "period": r[3] or "",
        "document_verification_status": r[4] or "pending",
        "workflow_stage": r[5] or "registration",
        "quality_score": _safe_float(r[6]),
        "price_score": _safe_float(r[7]),
        "delivery_score": _safe_float(r[8]),
        "capacity_score": _safe_float(r[9]),
        "financial_stability_score": _safe_float(r[10]),
        "experience_score": _safe_float(r[11]),
        "technical_support_score": _safe_float(r[12]),
        "overall_score": _safe_float(r[13]),
        "approval_status": r[14] or "pending",
        "evaluator_id": r[15] or "",
        "comments": r[16] or "",
        "created_at": str(r[17]) if r[17] else None
    } for r in rows]}


@supplier_bp.route("/suppliers/<sid>/evaluations", methods=["POST"])
def add_evaluation(sid):
    data = request.get_json() or {}
    quality = _safe_float(data.get("quality_score"))
    price = _safe_float(data.get("price_score"))
    delivery = _safe_float(data.get("delivery_score"))
    capacity = _safe_float(data.get("capacity_score"))
    financial = _safe_float(data.get("financial_stability_score"))
    experience = _safe_float(data.get("experience_score"))
    technical = _safe_float(data.get("technical_support_score"))
    overall = _safe_float(data.get("overall_score"))
    if overall == 0:
        overall = round((quality + price + delivery + capacity + financial + experience + technical) / 7, 2)

    eid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO supplier.evaluations (id, supplier_id, evaluation_date, period, document_verification_status, workflow_stage, quality_score, price_score, delivery_score, capacity_score, financial_stability_score, experience_score, technical_support_score, overall_score, approval_status, evaluator_id, comments, tenant_id, created_by) "
        "VALUES (:id, :sid, :edate, :period, :doc_status, :stage, :q, :p, :d, :c, :f, :e, :t, :overall, :status, :evaluator, :comments, :tid, :by)"
    ), {
        "id": eid,
        "sid": sid,
        "edate": data.get("evaluation_date") or None,
        "period": data.get("period", ""),
        "doc_status": data.get("document_verification_status", "verified"),
        "stage": data.get("workflow_stage", "evaluation"),
        "q": quality,
        "p": price,
        "d": delivery,
        "c": capacity,
        "f": financial,
        "e": experience,
        "t": technical,
        "overall": overall,
        "status": data.get("approval_status", "pending"),
        "evaluator": data.get("evaluator_id", _by()),
        "comments": data.get("comments", ""),
        "tid": _tid(),
        "by": _by()
    })
    _log("CREATE", "Supplier Evaluation", eid)
    db.session.commit()
    return {"success": True, "data": {"id": eid}, "message": "Evaluation saved"}, 201


@supplier_bp.route("/suppliers/<sid>/evaluations/<eid>", methods=["PUT"])
def update_evaluation(sid, eid):
    data = request.get_json() or {}
    updates, params = [], {"id": eid}
    for f in ["evaluation_date", "period", "document_verification_status", "workflow_stage", "quality_score", "price_score", "delivery_score", "capacity_score", "financial_stability_score", "experience_score", "technical_support_score", "overall_score", "approval_status", "evaluator_id", "comments"]:
        if f in data:
            updates.append(f"{f}=:{f}")
            params[f] = data[f]
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    old_row = db.session.execute(db.text("SELECT * FROM supplier.evaluations WHERE id=:id"), {"id": eid}).mappings().first()
    old_val = dict(old_row) if old_row else None
    if old_val:
        for k, v in old_val.items():
            if hasattr(v, 'isoformat'): old_val[k] = v.isoformat()
            
    db.session.execute(db.text(f"UPDATE supplier.evaluations SET {', '.join(updates)} WHERE id=:id"), params)
    _log("UPDATE", "Supplier Evaluation", eid)
    
    new_row = db.session.execute(db.text("SELECT * FROM supplier.evaluations WHERE id=:id"), {"id": eid}).mappings().first()
    new_val = dict(new_row) if new_row else None
    if new_val:
        for k, v in new_val.items():
            if hasattr(v, 'isoformat'): new_val[k] = v.isoformat()
            
    _log("UPDATE", "Supplier Evaluation", eid, old_val, new_val)
    db.session.commit()
    return {"success": True, "message": "Evaluation updated"}


@supplier_bp.route("/suppliers/<sid>/evaluations/<eid>", methods=["DELETE"])
def delete_evaluation(sid, eid):
    db.session.execute(db.text(
        "UPDATE supplier.evaluations SET is_deleted=true, updated_at=NOW() WHERE id=:id"
    ), {"id": eid})
    _log("DELETE", "Supplier Evaluation", eid)
    db.session.commit()
    return {"success": True, "message": "Evaluation deleted"}


# ─── CONTRACTS CRUD ───

@supplier_bp.route("/suppliers/<sid>/contracts", methods=["GET"])
def list_contracts(sid):
    rows = db.session.execute(db.text(
        "SELECT id, supplier_id, contract_number, contract_type, start_date, end_date, contract_value, payment_terms, delivery_terms, attachment_path, status, auto_renew, lifecycle_stage, notes, created_at "
        "FROM supplier.contracts WHERE supplier_id = :sid AND is_deleted = false ORDER BY start_date DESC, created_at DESC"
    ), {"sid": sid}).fetchall()
    return {"success": True, "data": [{
        "id": str(r[0]),
        "supplier_id": str(r[1]),
        "contract_number": r[2] or "",
        "contract_type": r[3] or "",
        "start_date": str(r[4]) if r[4] else None,
        "end_date": str(r[5]) if r[5] else None,
        "contract_value": _safe_float(r[6]),
        "payment_terms": r[7] or "",
        "delivery_terms": r[8] or "",
        "attachment_path": r[9] or "",
        "status": r[10] or "draft",
        "auto_renew": bool(r[11]) if r[11] is not None else False,
        "lifecycle_stage": r[12] or "draft",
        "notes": r[13] or "",
        "created_at": str(r[14]) if r[14] else None
    } for r in rows]}


@supplier_bp.route("/suppliers/<sid>/contracts", methods=["POST"])
def add_contract(sid):
    data = request.get_json() or {}
    cid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO supplier.contracts (id, supplier_id, contract_number, contract_type, start_date, end_date, contract_value, payment_terms, delivery_terms, attachment_path, status, auto_renew, lifecycle_stage, notes, tenant_id, created_by) "
        "VALUES (:id, :sid, :num, :ctype, :start, :end, :value, :pt, :dt, :att, :status, :auto_renew, :stage, :notes, :tid, :by)"
    ), {
        "id": cid,
        "sid": sid,
        "num": data.get("contract_number", ""),
        "ctype": data.get("contract_type", "framework"),
        "start": data.get("start_date") or None,
        "end": data.get("end_date") or None,
        "value": data.get("contract_value") or 0,
        "pt": data.get("payment_terms", ""),
        "dt": data.get("delivery_terms", ""),
        "att": data.get("attachment_path", ""),
        "status": data.get("status", "draft"),
        "auto_renew": data.get("auto_renew", False),
        "stage": data.get("lifecycle_stage", "draft"),
        "notes": data.get("notes", ""),
        "tid": _tid(),
        "by": _by()
    })
    _log("CREATE", "Supplier Contract", cid)
    db.session.commit()
    return {"success": True, "data": {"id": cid}, "message": "Contract saved"}, 201


@supplier_bp.route("/suppliers/<sid>/contracts/<cid>", methods=["PUT"])
def update_contract(sid, cid):
    data = request.get_json() or {}
    updates, params = [], {"id": cid}
    for f in ["contract_number", "contract_type", "start_date", "end_date", "contract_value", "payment_terms", "delivery_terms", "attachment_path", "status", "auto_renew", "lifecycle_stage", "notes"]:
        if f in data:
            updates.append(f"{f}=:{f}")
            params[f] = data[f]
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    old_row = db.session.execute(db.text("SELECT * FROM supplier.contracts WHERE id=:id"), {"id": cid}).mappings().first()
    old_val = dict(old_row) if old_row else None
    if old_val:
        for k, v in old_val.items():
            if hasattr(v, 'isoformat'): old_val[k] = v.isoformat()
            
    db.session.execute(db.text(f"UPDATE supplier.contracts SET {', '.join(updates)} WHERE id=:id"), params)
    _log("UPDATE", "Supplier Contract", cid)
    
    new_row = db.session.execute(db.text("SELECT * FROM supplier.contracts WHERE id=:id"), {"id": cid}).mappings().first()
    new_val = dict(new_row) if new_row else None
    if new_val:
        for k, v in new_val.items():
            if hasattr(v, 'isoformat'): new_val[k] = v.isoformat()
            
    _log("UPDATE", "Supplier Contract", cid, old_val, new_val)
    db.session.commit()
    return {"success": True, "message": "Contract updated"}


@supplier_bp.route("/suppliers/<sid>/contracts/<cid>", methods=["DELETE"])
def delete_contract(sid, cid):
    db.session.execute(db.text(
        "UPDATE supplier.contracts SET is_deleted=true, updated_at=NOW() WHERE id=:id"
    ), {"id": cid})
    _log("DELETE", "Supplier Contract", cid)
    db.session.commit()
    return {"success": True, "message": "Contract deleted"}


# ─── PERFORMANCE CRUD ───

@supplier_bp.route("/suppliers/<sid>/performance", methods=["GET"])
def list_performance(sid):
    rows = db.session.execute(db.text(
        "SELECT id, supplier_id, period, po_count, grn_count, inspection_pass_rate, ncr_count, quality_defect_rate, on_time_delivery_rate, overall_score, performance_grade, created_at "
        "FROM supplier.performance WHERE supplier_id = :sid AND is_deleted = false ORDER BY period DESC, created_at DESC LIMIT 20"
    ), {"sid": sid}).fetchall()
    return {"success": True, "data": [{
        "id": str(r[0]),
        "supplier_id": str(r[1]),
        "period": r[2] or "",
        "po_count": _safe_float(r[3]),
        "grn_count": _safe_float(r[4]),
        "inspection_pass_rate": _safe_float(r[5]),
        "ncr_count": _safe_float(r[6]),
        "quality_defect_rate": _safe_float(r[7]),
        "on_time_delivery_rate": _safe_float(r[8]),
        "overall_score": _safe_float(r[9]),
        "performance_grade": r[10] or "",
        "created_at": str(r[11]) if r[11] else None
    } for r in rows]}


@supplier_bp.route("/suppliers/<sid>/performance", methods=["POST"])
def add_performance(sid):
    data = request.get_json() or {}
    overall = _safe_float(data.get("overall_score"))
    if overall == 0:
        overall = round(((_safe_float(data.get("inspection_pass_rate")) * 0.35) + (_safe_float(data.get("on_time_delivery_rate")) * 0.35) + ((100 - _safe_float(data.get("quality_defect_rate"))) * 0.30)), 2)
    grade = "A" if overall >= 90 else "B" if overall >= 75 else "C" if overall >= 60 else "D"
    pid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO supplier.performance (id, supplier_id, period, po_count, grn_count, inspection_pass_rate, ncr_count, quality_defect_rate, on_time_delivery_rate, overall_score, performance_grade, tenant_id, created_by) "
        "VALUES (:id, :sid, :period, :po_count, :grn_count, :inspection_pass_rate, :ncr_count, :quality_defect_rate, :on_time_delivery_rate, :overall_score, :performance_grade, :tid, :by)"
    ), {
        "id": pid,
        "sid": sid,
        "period": data.get("period", ""),
        "po_count": data.get("po_count") or 0,
        "grn_count": data.get("grn_count") or 0,
        "inspection_pass_rate": data.get("inspection_pass_rate") or 0,
        "ncr_count": data.get("ncr_count") or 0,
        "quality_defect_rate": data.get("quality_defect_rate") or 0,
        "on_time_delivery_rate": data.get("on_time_delivery_rate") or 0,
        "overall_score": overall,
        "performance_grade": grade,
        "tid": _tid(),
        "by": _by()
    })
    _log("CREATE", "Supplier Performance", pid)
    db.session.commit()
    return {"success": True, "data": {"id": pid}, "message": "Performance review saved"}, 201


@supplier_bp.route("/suppliers/<sid>/performance/<pid>", methods=["PUT"])
def update_performance(sid, pid):
    data = request.get_json() or {}
    updates, params = [], {"id": pid}
    for f in ["period", "po_count", "grn_count", "inspection_pass_rate", "ncr_count", "quality_defect_rate", "on_time_delivery_rate", "overall_score", "performance_grade"]:
        if f in data:
            updates.append(f"{f}=:{f}")
            params[f] = data[f]
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    old_row = db.session.execute(db.text("SELECT * FROM supplier.performance WHERE id=:id"), {"id": pid}).mappings().first()
    old_val = dict(old_row) if old_row else None
    if old_val:
        for k, v in old_val.items():
            if hasattr(v, 'isoformat'): old_val[k] = v.isoformat()
            
    db.session.execute(db.text(f"UPDATE supplier.performance SET {', '.join(updates)} WHERE id=:id"), params)
    _log("UPDATE", "Supplier Performance", pid)
    
    new_row = db.session.execute(db.text("SELECT * FROM supplier.performance WHERE id=:id"), {"id": pid}).mappings().first()
    new_val = dict(new_row) if new_row else None
    if new_val:
        for k, v in new_val.items():
            if hasattr(v, 'isoformat'): new_val[k] = v.isoformat()
            
    _log("UPDATE", "Supplier Performance", pid, old_val, new_val)
    db.session.commit()
    return {"success": True, "message": "Performance review updated"}


@supplier_bp.route("/suppliers/<sid>/performance/<pid>", methods=["DELETE"])
def delete_performance(sid, pid):
    db.session.execute(db.text(
        "UPDATE supplier.performance SET is_deleted=true, updated_at=NOW() WHERE id=:id"
    ), {"id": pid})
    _log("DELETE", "Supplier Performance", pid)
    db.session.commit()
    return {"success": True, "message": "Performance review deleted"}


# ─── SEARCH ───

@supplier_bp.route("/search", methods=["GET"])
def search_suppliers():
    tid = _tid()
    q = request.args.get("q", "").strip()
    if not q or len(q) < 2:
        return {"success": True, "data": []}
    rows = db.session.execute(db.text(
        "SELECT DISTINCT s.id, s.supplier_code, s.brand_name, s.status "
        "FROM supplier.suppliers s "
        "LEFT JOIN supplier.parts p ON p.supplier_id = s.id AND p.is_deleted = false "
        "WHERE (s.tenant_id = :tid OR s.tenant_id = '' OR s.tenant_id IS NULL) AND s.is_deleted = false "
        "AND (LOWER(s.brand_name) LIKE LOWER(:q) OR LOWER(s.supplier_code) LIKE LOWER(:q) OR LOWER(p.part_code) LIKE LOWER(:q) OR LOWER(p.mpn) LIKE LOWER(:q) OR LOWER(p.make) LIKE LOWER(:q)) "
        "ORDER BY s.brand_name LIMIT 20"
    ), {"tid": tid, "q": f"%{q}%"}).fetchall()
    return {"success": True, "data": [{
        "id": str(r[0]),
        "supplier_code": r[1],
        "brand_name": r[2],
        "status": r[3]
    } for r in rows]}


# ─── ITEM HISTORY (cross-supplier view for an item) ───

@supplier_bp.route("/item-history/<item_code>", methods=["GET"])
def item_supplier_history(item_code):
    tid = _tid()
    rows = db.session.execute(db.text(
        "SELECT sp.id, sp.part_code, sp.item_type, sp.mpn, sp.make, sp.moq, sp.moq_price, sp.spq, sp.spq_price, sp.sample_qty, sp.sample_price, s.supplier_code, s.brand_name, s.status, s.rating, s.currency "
        "FROM supplier.parts sp "
        "JOIN supplier.suppliers s ON sp.supplier_id = s.id "
        "WHERE LOWER(sp.part_code) = LOWER(:pc) AND sp.is_deleted = false AND s.is_deleted = false "
        "AND (s.tenant_id = :tid OR s.tenant_id = '' OR s.tenant_id IS NULL)"
    ), {"pc": item_code, "tid": tid}).fetchall()
    return {"success": True, "data": [{
        "id": str(r[0]),
        "part_code": r[1],
        "item_type": r[2] or "part",
        "mpn": r[3] or "",
        "make": r[4] or "",
        "moq": _safe_float(r[5]),
        "moq_price": _safe_float(r[6]),
        "spq": _safe_float(r[7]),
        "spq_price": _safe_float(r[8]),
        "sample_qty": _safe_float(r[9]),
        "sample_price": _safe_float(r[10]),
        "supplier_code": r[11],
        "brand_name": r[12],
        "status": r[13],
        "rating": _safe_float(r[14]),
        "currency": r[15] or "INR"
    } for r in rows]}


# ─── MODULE USER MANAGEMENT ───

@supplier_bp.route("/users", methods=["GET"])
def list_module_users():
    """List users with access to Supplier Management module."""
    tid = _tid()
    if not tid or tid == 'TEST':
        tid = 'b424df0e-f766-4e94-b3fd-05777e158958'
    rows = db.session.execute(db.text(
        "SELECT ma.id, ma.user_id, ma.role, ma.permissions, ma.is_active, ma.created_at, "
        "u.email, u.first_name, u.last_name "
        "FROM iam.module_access ma JOIN iam.users u ON ma.user_id = u.id "
        "WHERE ma.module = 'Supplier Management' "
        "AND (ma.tenant_id = :tid OR ma.tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR ma.tenant_id = 'TEST' OR ma.tenant_id = '' OR ma.tenant_id IS NULL) "
        "ORDER BY ma.created_at DESC"
    ), {"tid": tid})
    items = [{
        "id": r[0], "user_id": r[1], "role": r[2], "permissions": r[3] or [],
        "is_active": r[4], "created_at": str(r[5]) if r[5] else None,
        "email": r[6], "first_name": r[7] or '', "last_name": r[8] or ''
    } for r in rows]
    return {"success": True, "data": items}

@supplier_bp.route("/users", methods=["POST"])
def add_module_user():
    data = request.get_json()
    tid = _tid()
    if not tid or tid == 'TEST':
        tid = 'b424df0e-f766-4e94-b3fd-05777e158958'
    user_id = data.get("user_id")
    role = data.get("role", "viewer")
    permissions = data.get("permissions", [])

    if not user_id: return {"success": False, "message": "user_id required"}, 400

    user = db.session.execute(db.text("SELECT id, email FROM iam.users WHERE id = :id AND is_deleted = false"), {"id": user_id}).first()
    if not user: return {"success": False, "message": "User not found"}, 404

    existing = db.session.execute(db.text("SELECT id FROM iam.module_access WHERE user_id = :uid AND module = 'Supplier Management'"), {"uid": user_id}).first()
    if existing: return {"success": False, "message": "User already has access"}, 409

    access_id = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO iam.module_access (id, user_id, module, role, permissions, granted_by, tenant_id) "
        "VALUES (:id, :uid, 'Supplier Management', :role, :perms, :granted_by, :tid)"
    ), {
        "id": access_id, "uid": user_id, "role": role,
        "perms": json.dumps(permissions),
        "granted_by": request.headers.get('X-User-Email', ''),
        "tid": tid
    })
    db.session.commit()
    _log('GRANT_ACCESS', 'Module User', user[1])
    return {"success": True, "message": f"Access granted to {user[1]}"}, 201

@supplier_bp.route("/users/<access_id>", methods=["PUT"])
def update_module_user(access_id):
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
    if not updates: return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE iam.module_access SET {', '.join(updates)} WHERE id=:id"), params)
    db.session.commit()
    _log('UPDATE_ACCESS', 'Module User', access_id)
    return {"success": True, "message": "Access updated"}

@supplier_bp.route("/users/<access_id>", methods=["DELETE"])
def revoke_module_user(access_id):
    db.session.execute(db.text("DELETE FROM iam.module_access WHERE id = :id"), {"id": access_id})
    db.session.commit()
    _log('REVOKE_ACCESS', 'Module User', access_id)
    return {"success": True, "message": "Access revoked"}

@supplier_bp.route("/users/available", methods=["GET"])
def list_available_users():
    tid = _tid()
    rows = db.session.execute(db.text(
        "SELECT u.id, u.email, u.first_name, u.last_name FROM iam.users u "
        "LEFT JOIN iam.module_access ma ON u.id = ma.user_id AND ma.module = 'Supplier Management' "
        "WHERE u.is_deleted = false AND ma.id IS NULL AND u.tenant_id = :tid "
        "ORDER BY u.email"
    ), {"tid": tid})
    items = [{"id": r[0], "email": r[1], "first_name": r[2] or '', "last_name": r[3] or ''} for r in rows]
    return {"success": True, "data": items}

@supplier_bp.route("/suppliers/<sid>/detailed-history", methods=["GET"])
def get_detailed_history(sid):
    entity_type = request.args.get('entity_type')
    
    # Map entity_type to the table that holds the supplier_id
    table_map = {
        "Supplier Address": "supplier.addresses",
        "Supplier Contact": "supplier.contacts",
        "Supplier Evaluation": "supplier.evaluations",
        "Supplier Contract": "supplier.contracts",
        "Supplier Performance": "supplier.performance",
        "Supplier Item": "supplier.parts",
        "Supplier History": "supplier.history",
        "Supplier": "supplier.suppliers"
    }
    
    table_name = table_map.get(entity_type)
    if not table_name:
        return {"success": False, "message": "Invalid entity type"}, 400
        
    if entity_type == "Supplier":
        # The entity_id IS the supplier_id
        q = "SELECT id, action, entity_type, entity_id, user_name, user_email, created_at, old_value, new_value FROM audit.logs WHERE entity_type=:etype AND entity_id=:sid ORDER BY created_at DESC"
    else:
        q = f"SELECT id, action, entity_type, entity_id, user_name, user_email, created_at, old_value, new_value FROM audit.logs WHERE entity_type=:etype AND entity_id IN (SELECT id::text FROM {table_name} WHERE supplier_id=:sid) ORDER BY created_at DESC"
        
    logs = db.session.execute(db.text(q), {"etype": entity_type, "sid": sid}).fetchall()
    
    data = []
    import json
    for r in logs:
        data.append({
            "id": str(r[0]),
            "action": r[1],
            "entity_type": r[2],
            "entity_id": str(r[3]),
            "user_name": r[4],
            "user_email": r[5],
            "created_at": str(r[6]),
            "old_value": r[7] if isinstance(r[7], dict) else (json.loads(r[7]) if r[7] else None),
            "new_value": r[8] if isinstance(r[8], dict) else (json.loads(r[8]) if r[8] else None)
        })
        
    return {"success": True, "data": data}

# ─── PURCHASE ORDERS FOR SUPPLIER ───

@supplier_bp.route("/suppliers/<sid>/purchase-orders", methods=["GET"])
def get_supplier_purchase_orders(sid):
    try:
        rows = db.session.execute(db.text(
            "SELECT id, doc_no, pr_no, item_code, item_description, order_qty, unit_price, "
            "total_amount, promised_date, po_status, sent_to_supplier_at, date, "
            "COALESCE(lines::text,'[]') as lines, "
            "COALESCE(notes,'') as notes, COALESCE(created_by,'') as created_by, "
            "COALESCE(supplier_name,'') as supplier_name, "
            "COALESCE(supplier_invoice_no,'') as supplier_invoice_no, "
            "COALESCE(supplier_invoice_amount,0) as supplier_invoice_amount "
            "FROM procurement.purchase_orders "
            "WHERE supplier_id = :sid AND is_deleted = false "
            "ORDER BY date DESC"
        ), {"sid": str(sid)}).fetchall()
        data = []
        for r in rows:
            try:
                raw = r[12]
                lines = raw if isinstance(raw, list) else (json.loads(raw) if raw and raw != '[]' else [])
            except Exception:
                lines = []
            data.append({
                "id": str(r[0]), "po_no": r[1] or "", "pr_no": r[2] or "",
                "item_code": r[3] or "", "item_description": r[4] or "",
                "order_qty": float(r[5] or 0), "unit_price": float(r[6] or 0),
                "total_amount": float(r[7] or 0),
                "promised_date": str(r[8]) if r[8] else "",
                "po_status": r[9] or "draft",
                "sent_to_supplier_at": str(r[10]) if r[10] else None,
                "po_date": str(r[11]) if r[11] else "",
                "lines": lines,
                "notes": r[13] or "",
                "created_by": r[14] or "",
                "supplier_name": r[15] or "",
                "supplier_invoice_no": r[16] or "",
                "supplier_invoice_amount": float(r[17] or 0)
            })
        return {"success": True, "data": data}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e)}, 500


@supplier_bp.route("/suppliers/<sid>/purchase-orders/<po_id>/promised-date", methods=["PUT"])
def update_po_promised_date(sid, po_id):
    data = request.get_json() or {}
    new_date = data.get("promised_date", "").strip()
    reason = data.get("reason", "").strip()
    if not new_date:
        return {"success": False, "message": "promised_date is required"}, 400
    po = db.session.execute(db.text(
        "SELECT doc_no, promised_date FROM procurement.purchase_orders WHERE id=:id AND supplier_id=:sid AND is_deleted=false"
    ), {"id": po_id, "sid": sid}).first()
    if not po:
        return {"success": False, "message": "PO not found"}, 404
    old_date = str(po[1]) if po[1] else ""
    note_append = f" | Date revised {old_date} → {new_date}" + (f": {reason}" if reason else "")
    db.session.execute(db.text(
        "UPDATE procurement.purchase_orders SET promised_date=:d, "
        "notes = COALESCE(notes,'') || :note, updated_at=NOW() WHERE id=:id"
    ), {"d": new_date, "note": note_append, "id": po_id})
    db.session.commit()
    return {"success": True, "message": f"Promised date updated to {new_date}"}


@supplier_bp.route("/audit-logs", methods=["GET"])
def get_supplier_audit_logs():
    tenant_id = _tid()
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 50, type=int)
    try:
        rows = db.session.execute(db.text(
            "SELECT id, action, entity_type, entity_id, user_name, user_email, ip_address, created_at, old_value, new_value "
            "FROM audit.logs "
            "WHERE module = 'Supplier Management' AND tenant_id = :tid "
            "ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        ), {"tid": tenant_id, "limit": limit, "offset": (page-1)*limit}).fetchall()
        
        import json
        items = []
        for r in rows:
            items.append({
                "id": str(r[0]),
                "action": r[1],
                "entity_type": r[2],
                "entity_id": str(r[3]),
                "user_name": r[4],
                "user_email": r[5],
                "ip_address": r[6],
                "created_at": str(r[7]),
                "old_value": r[8] if isinstance(r[8], dict) else (json.loads(r[8]) if r[8] else None),
                "new_value": r[9] if isinstance(r[9], dict) else (json.loads(r[9]) if r[9] else None)
            })
        
        return {"success": True, "data": items}
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return {"success": False, "message": str(e)}, 500
