from flask import Blueprint, request
from extensions import db
import uuid
import json

procurement_bp = Blueprint("procurement", __name__)


# ─── PURCHASE ORDERS ───

@procurement_bp.route("/purchase-orders", methods=["GET"])
def list_purchase_orders():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    project_id = request.args.get("project_id", "")
    where = "(po.tenant_id = :tid OR po.tenant_id = '' OR po.tenant_id IS NULL) AND po.is_deleted = false"
    params = {"tid": tenant_id}
    if project_id:
        where += " AND po.project_id = :pid"
        params["pid"] = project_id
    rows = db.session.execute(db.text(
        f"SELECT po.id, po.doc_no, po.date, po.project_id, po.organization_id, "
        f"po.lines, po.total, po.status, po.remarks, po.created_at, "
        f"p.name as project_name, o.name as org_name "
        f"FROM procurement.purchase_orders po "
        f"LEFT JOIN project.projects p ON po.project_id = p.id "
        f"LEFT JOIN project.organizations o ON po.organization_id = o.id "
        f"WHERE {where} ORDER BY po.created_at DESC"
    ), params)
    items = []
    for r in rows:
        lines = r[5] or []
        if isinstance(lines, str):
            lines = json.loads(lines)
        total = float(r[6] or 0)
        # Enrich lines with mapping data
        for line in lines:
            cpn = line.get("customer_part_number", "")
            if cpn and not line.get("internal_part_number"):
                mapping = db.session.execute(db.text(
                    "SELECT internal_part_number, internal_description FROM part.customer_mappings "
                    "WHERE LOWER(customer_part_number) = LOWER(:cpn) AND (tenant_id = :tid OR tenant_id IS NULL) "
                    "AND is_deleted = false LIMIT 1"
                ), {"cpn": cpn, "tid": tenant_id}).first()
                if mapping:
                    line["internal_part_number"] = mapping[0]
                    line["internal_description"] = mapping[1] or ''
        items.append({
            "id": r[0], "po_number": r[1], "po_date": str(r[2]) if r[2] else '',
            "project_id": r[3] or '', "organization_id": r[4] or '',
            "lines": lines, "total_amount": total,
            "status": r[7] or 'open', "remarks": r[8] or '',
            "created_at": str(r[9]) if r[9] else None,
            "project_name": r[10] or '', "organization_name": r[11] or '',
            "line_count": len(lines)
        })
    return {"success": True, "data": items}


@procurement_bp.route("/purchase-orders", methods=["POST"])
def create_purchase_order():
    data = request.get_json()
    tenant_id = request.headers.get("X-Tenant-ID", "")
    if not data.get("po_number"):
        return {"success": False, "message": "PO Number is required"}, 400
    existing = db.session.execute(db.text(
        "SELECT id FROM procurement.purchase_orders WHERE doc_no = :doc AND is_deleted = false"
    ), {"doc": data["po_number"]}).first()
    if existing:
        return {"success": False, "message": "PO number already exists"}, 409
    po_id = str(uuid.uuid4())
    lines = data.get("lines", [])
    # Calculate total from all lines
    total = sum(float(line.get("quantity", 0)) * float(line.get("price_per_quantity", 0)) for line in lines)
    created_by = request.headers.get('X-User-Name', '') or request.headers.get('X-User-Email', '')
    db.session.execute(db.text(
        "INSERT INTO procurement.purchase_orders (id, doc_no, date, project_id, organization_id, "
        "lines, total, status, remarks, vendor_id, tenant_id, created_by) "
        "VALUES (:id, :doc, :date, :pid, :oid, :lines, :total, :status, :remarks, :vid, :tid, :cb)"
    ), {
        "id": po_id, "doc": data["po_number"],
        "date": data.get("po_date") or None,
        "pid": data.get("project_id") or None,
        "oid": data.get("organization_id") or None,
        "lines": json.dumps(lines), "total": total,
        "status": data.get("status", "open"),
        "remarks": data.get("remarks", ""),
        "vid": data.get("organization_id") or "NONE",
        "tid": tenant_id, "cb": created_by
    })
    db.session.commit()
    return {"success": True, "data": {"id": po_id}, "message": "Purchase Order created"}, 201


@procurement_bp.route("/purchase-orders/<po_id>", methods=["PUT"])
def update_purchase_order(po_id):
    data = request.get_json()
    updates, params = [], {"id": po_id}
    if "po_date" in data:
        updates.append("date=:date")
        params["date"] = data["po_date"] or None
    if "status" in data:
        updates.append("status=:status")
        params["status"] = data["status"]
    if "remarks" in data:
        updates.append("remarks=:remarks")
        params["remarks"] = data["remarks"]
    if "lines" in data:
        lines = data["lines"]
        updates.append("lines=:lines")
        params["lines"] = json.dumps(lines)
        total = sum(float(line.get("quantity", 0)) * float(line.get("price_per_quantity", 0)) for line in lines)
        updates.append("total=:total")
        params["total"] = total
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE procurement.purchase_orders SET {', '.join(updates)} WHERE id=:id"), params)
    db.session.commit()
    return {"success": True, "message": "Purchase Order updated"}


@procurement_bp.route("/purchase-orders/<po_id>", methods=["DELETE"])
def delete_purchase_order(po_id):
    db.session.execute(db.text(
        "UPDATE procurement.purchase_orders SET is_deleted=true, updated_at=NOW() WHERE id=:id"
    ), {"id": po_id})
    db.session.commit()
    return {"success": True, "message": "Purchase Order deleted"}


# ─── SEARCH PROJECTS (for PO creation) ───
@procurement_bp.route("/search-projects", methods=["GET"])
def search_projects():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    q = request.args.get("q", "").strip()
    if not q or len(q) < 2:
        return {"success": True, "data": []}
    search = f"%{q}%"
    rows = db.session.execute(db.text(
        "SELECT id, code, name FROM project.projects "
        "WHERE tenant_id = :tid AND is_deleted = false "
        "AND (LOWER(name) LIKE LOWER(:q) OR LOWER(code) LIKE LOWER(:q)) ORDER BY name LIMIT 15"
    ), {"tid": tenant_id, "q": search})
    return {"success": True, "data": [{"id": r[0], "code": r[1], "name": r[2]} for r in rows]}
