from flask import Blueprint, request
from extensions import db
import uuid

supplier_bp = Blueprint("suppliers", __name__)


def _tid():
    return request.headers.get("X-Tenant-ID", "")


def _by():
    return request.headers.get("X-User-Name", "") or request.headers.get("X-User-Email", "")


def _safe_float(v):
    try:
        return float(v) if v not in (None, "", " ") else 0
    except Exception:
        return 0


def _log(action, entity_type, entity_id):
    try:
        db.session.execute(db.text(
            "INSERT INTO audit.logs (id, action, module, entity_type, entity_id, ip_address, tenant_id, user_email, user_name, created_at) "
            "VALUES (gen_random_uuid(), :action, 'Supplier Management', :etype, :eid, :ip, :tid, :email, :name, NOW())"
        ), {
            "action": action,
            "etype": entity_type,
            "eid": str(entity_id),
            "ip": request.remote_addr or "",
            "tid": _tid(),
            "email": request.headers.get("X-User-Email", ""),
            "name": request.headers.get("X-User-Name", "")
        })
    except Exception:
        pass


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
        "SELECT id, action, entity_type, user_email, user_name, ip_address, created_at "
        "FROM audit.logs WHERE entity_id = :eid AND module = 'Supplier Management' "
        "ORDER BY created_at DESC LIMIT 100"
    ), {"eid": sid}).fetchall()

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
            "created_at": str(a[6]) if a[6] else None
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
    db.session.execute(db.text(f"UPDATE supplier.suppliers SET {', '.join(updates)} WHERE id=:id"), params)
    _log("UPDATE", "Supplier", sid)
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
        db.session.execute(db.text(f"UPDATE supplier.addresses SET {', '.join(updates)} WHERE id=:id"), params)
    _log("UPDATE", "Supplier Address", aid)
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
    db.session.execute(db.text(f"UPDATE supplier.contacts SET {', '.join(updates)} WHERE id=:id"), params)
    _log("UPDATE", "Supplier Contact", cid)
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
        "item_type": str(data.get("item_type", "part")).lower(),
        "pc": data.get("part_code", ""),
        "mpn": data.get("mpn", ""),
        "make": data.get("make", ""),
        "unit": data.get("unit", ""),
        "moq": data.get("moq", 0) or 0,
        "moqp": data.get("moq_price", 0) or 0,
        "spq": data.get("spq", 0) or 0,
        "spqp": data.get("spq_price", 0) or 0,
        "sq": data.get("sample_qty", 0) or 0,
        "sp": data.get("sample_price", 0) or 0,
        "notes": data.get("notes", ""),
        "tid": _tid()
    })
    _log("CREATE", "Supplier Item", pid)
    db.session.commit()
    return {"success": True, "data": {"id": pid}, "message": "Item added"}, 201


@supplier_bp.route("/suppliers/<sid>/items/<pid>", methods=["PUT"])
def update_item(sid, pid):
    data = request.get_json() or {}
    updates, params = [], {"id": pid}
    for f in ["item_type", "part_code", "mpn", "make", "unit", "moq", "moq_price", "spq", "spq_price", "sample_qty", "sample_price", "notes"]:
        if f in data:
            updates.append(f"{f}=:{f}")
            params[f] = data[f] if data[f] != "" else None
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE supplier.parts SET {', '.join(updates)} WHERE id=:id"), params)
    _log("UPDATE", "Supplier Item", pid)
    db.session.commit()
    return {"success": True, "message": "Item updated"}


@supplier_bp.route("/suppliers/<sid>/items/<pid>", methods=["DELETE"])
def delete_item(sid, pid):
    db.session.execute(db.text(
        "UPDATE supplier.parts SET is_deleted=true, updated_at=NOW() WHERE id=:id"
    ), {"id": pid})
    _log("DELETE", "Supplier Item", pid)
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
    _log("CREATE", "Supplier History", hid)
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
    db.session.execute(db.text(f"UPDATE supplier.evaluations SET {', '.join(updates)} WHERE id=:id"), params)
    _log("UPDATE", "Supplier Evaluation", eid)
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
    db.session.execute(db.text(f"UPDATE supplier.contracts SET {', '.join(updates)} WHERE id=:id"), params)
    _log("UPDATE", "Supplier Contract", cid)
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
    db.session.execute(db.text(f"UPDATE supplier.performance SET {', '.join(updates)} WHERE id=:id"), params)
    _log("UPDATE", "Supplier Performance", pid)
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
        "SELECT id, supplier_code, brand_name, status FROM supplier.suppliers "
        "WHERE (tenant_id = :tid OR tenant_id = '' OR tenant_id IS NULL) AND is_deleted = false "
        "AND (LOWER(brand_name) LIKE LOWER(:q) OR LOWER(supplier_code) LIKE LOWER(:q)) ORDER BY brand_name LIMIT 20"
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
