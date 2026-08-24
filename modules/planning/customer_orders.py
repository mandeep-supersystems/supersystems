from flask import Blueprint, request
from extensions import db
import uuid
import json
from datetime import datetime

# Common functions (we should ideally put these in a utils file, but for now we'll duplicate or import)
def _tid():
    return request.headers.get("X-Tenant-ID", "")

def _user():
    return request.headers.get("X-User-Name", "") or request.headers.get("X-User-Email", "")

def _tid_cond():
    return "(tenant_id = :tid OR tenant_id = '' OR tenant_id IS NULL)"

def _notify(tenant_id, module, event_type, ref_no, ref_id, title, message, role):
    try:
        db.session.execute(db.text(
            "INSERT INTO planning.notifications (id, module, event_type, reference_no, reference_id, "
            "title, message, recipient_role, tenant_id, created_at) "
            "VALUES (:id, :mod, :evt, :ref_no, :ref_id, :title, :msg, :role, :tid, NOW())"
        ), {
            "id": str(uuid.uuid4()),
            "mod": module, "evt": event_type, "ref_no": ref_no,
            "ref_id": str(ref_id) if ref_id else None,
            "title": title, "msg": message, "role": role, "tid": tenant_id
        })
        db.session.commit()
    except Exception:
        db.session.rollback()

customer_orders_bp = Blueprint('customer_orders', __name__)



@customer_orders_bp.route("/customer-orders/procurement-view", methods=["GET"])
def procurement_view():
    """Enriched view: all customer PO lines with stock, mapping, and part info in one call."""
    tid = _tid()

    # All projects with customer POs
    rows = db.session.execute(db.text(
        "SELECT id, name, customer_pos, purchase_orders FROM project.projects "
        "WHERE is_deleted = false AND (tenant_id = :tid OR tenant_id = '' OR tenant_id IS NULL)"
    ), {"tid": tid}).fetchall()

    # Part mappings: customer_part_number -> internal_part_number
    try:
        mapping_rows = db.session.execute(db.text(
            "SELECT customer_part_number, internal_part_number, internal_description "
            "FROM part.customer_mappings WHERE (tenant_id = :tid OR tenant_id IS NULL) AND is_deleted = false"
        ), {"tid": tid}).fetchall()
    except Exception:
        db.session.rollback()
        mapping_rows = []
    cust_to_internal = {r[0]: {"internal": r[1], "desc": r[2] or ""} for r in mapping_rows}

    # Stock levels: part_number -> {on_hand, available, reserved}
    try:
        stock_rows = db.session.execute(db.text(
            "SELECT part_number, COALESCE(SUM(qty_on_hand),0), COALESCE(SUM(qty_available),0), COALESCE(SUM(qty_reserved),0) "
            "FROM inventory_stock_levels WHERE is_deleted = false GROUP BY part_number"
        ), {}).fetchall()
    except Exception:
        db.session.rollback()
        stock_rows = []
    stock_map = {r[0]: {"on_hand": float(r[1]), "available": float(r[2]), "reserved": float(r[3])} for r in stock_rows}

    # Valid internal parts with type info: part_number -> {is_bought_out, is_manufactured}
    part_type_map = {}  # part_number -> 'bop' | 'manufactured' | 'both' | 'unknown'
    try:
        import re as _re
        subs = db.session.execute(db.text(
            "SELECT c.name, c.series_prefix FROM part.subcategories s "
            "JOIN part.categories c ON s.category_id = c.id "
            "WHERE s.tenant_id = :tid AND s.is_deleted = false"
        ), {"tid": tid}).fetchall()
        for sub in subs:
            tname = 'part."' + _re.sub(r'[^a-z0-9]','_',sub[0].lower().strip()).strip('_') + '_' + sub[1] + '"'
            try:
                prows = db.session.execute(db.text(
                    f"SELECT part_number, "
                    f"COALESCE(is_bought_out, true) as ibo, "
                    f"COALESCE(is_manufactured, false) as imf "
                    f"FROM {tname} WHERE status != 'obsolete' OR status IS NULL"
                ), {}).fetchall()
                for r in prows:
                    ibo, imf = bool(r[1]), bool(r[2])
                    if ibo and imf:
                        part_type_map[r[0]] = 'both'
                    elif imf:
                        part_type_map[r[0]] = 'manufactured'
                    else:
                        part_type_map[r[0]] = 'bop'
            except Exception:
                db.session.rollback()
    except Exception:
        db.session.rollback()
    valid_parts = set(part_type_map.keys())

    # Active PRs: item_code -> total qty already requested
    try:
        pr_rows = db.session.execute(db.text(
            "SELECT item_code, COALESCE(SUM(required_qty),0) FROM planning.purchase_requests "
            "WHERE status NOT IN ('cancelled','rejected') AND is_deleted = false "
            "AND (tenant_id = :tid OR tenant_id = '' OR tenant_id IS NULL) GROUP BY item_code"
        ), {"tid": tid}).fetchall()
    except Exception:
        db.session.rollback()
        pr_rows = []
    pr_map = {r[0]: float(r[1]) for r in pr_rows}

    # Lines that already had a PR generated (by source_line_keys OR by item_code match)
    pr_generated_keys = set()
    pr_generated_item_codes = set()  # fallback: item codes from PRs with no source_line_keys
    try:
        slk_rows = db.session.execute(db.text(
            "SELECT source_line_keys, item_code FROM planning.purchase_requests "
            "WHERE is_deleted = false AND status NOT IN ('cancelled','rejected') "
            "AND (tenant_id = :tid OR tenant_id = '' OR tenant_id IS NULL)"
        ), {"tid": tid}).fetchall()
        for r in slk_rows:
            slk = (r[0] or "").strip()
            if slk:
                for k in slk.split(","):
                    k = k.strip()
                    if k:
                        pr_generated_keys.add(k)
            else:
                # Fallback: track item_code so we can mark lines whose internal_pn matches
                if r[1]:
                    pr_generated_item_codes.add(r[1])
    except Exception:
        db.session.rollback()

    projects = []
    for row in rows:
        proj_id = str(row[0])
        proj_name = row[1]  # column is 'name'
        # customer_pos is stored in 'customer_pos' column; purchase_orders in 'purchase_orders'
        pos = row[2] or row[3] or []
        if isinstance(pos, str):
            try: pos = json.loads(pos)
            except: pos = []
        if not isinstance(pos, list): pos = []
        if isinstance(pos, str):
            try: pos = json.loads(pos)
            except: pos = []
        if not pos:
            continue

        po_list = []
        for po in pos:
            lines_out = []
            for line in po.get("lines", []):
                cust_pn = (line.get("part_number") or "").strip()
                qty = float(line.get("qty", 0))
                cost = float(line.get("cost", 0))

                # Resolve internal part
                mapping = cust_to_internal.get(cust_pn)
                internal_pn = mapping["internal"] if mapping else (cust_pn if cust_pn in valid_parts else None)
                internal_desc = mapping["desc"] if mapping else line.get("description", "")
                is_mapped = bool(mapping)
                is_internal = internal_pn in valid_parts if internal_pn else False

                # Part type
                part_type = part_type_map.get(internal_pn or "", "unknown") if internal_pn else "unknown"

                # Stock
                stk = stock_map.get(internal_pn or cust_pn, {"on_hand": 0, "available": 0, "reserved": 0})
                avail = stk["available"]
                shortage = max(0.0, qty - avail)
                can_fulfill_from_stock = avail >= qty

                # PR already raised
                pr_qty = pr_map.get(internal_pn or cust_pn, 0.0)
                still_needed = max(0.0, shortage - pr_qty)

                # Check if PR was already generated for this specific line
                line_key = f"{proj_id}|{po.get('id','')}|{len(lines_out)}"
                pr_generated = line_key in pr_generated_keys

                # Status tag
                if not cust_pn:
                    status = "no_part"
                elif not is_mapped and not is_internal:
                    status = "unmapped"
                elif pr_generated:
                    status = "pr_raised"
                elif can_fulfill_from_stock:
                    status = "in_stock"
                elif pr_qty >= shortage:
                    status = "pr_raised"
                elif shortage > 0:
                    status = "needs_pr"
                else:
                    status = "ready"

                lines_out.append({
                    "customer_part_number": cust_pn,
                    "description": line.get("description", "") or internal_desc,
                    "qty": qty,
                    "cost": cost,
                    "line_total": qty * cost,
                    "internal_part_number": internal_pn or "",
                    "internal_description": internal_desc,
                    "is_mapped": is_mapped,
                    "is_internal_part": is_internal,
                    "stock_on_hand": stk["on_hand"],
                    "stock_available": avail,
                    "stock_reserved": stk["reserved"],
                    "shortage_qty": shortage,
                    "pr_qty_raised": pr_qty,
                    "still_needed_qty": still_needed,
                    "can_fulfill_from_stock": can_fulfill_from_stock,
                    "status": status,
                    "part_type": part_type,
                    "pr_generated": pr_generated,
                    "line_key": line_key
                })

            total_lines = len(lines_out)
            unmapped = sum(1 for l in lines_out if l["status"] == "unmapped")
            in_stock = sum(1 for l in lines_out if l["status"] == "in_stock")
            needs_pr = sum(1 for l in lines_out if l["status"] == "needs_pr")
            pr_raised = sum(1 for l in lines_out if l["status"] == "pr_raised")

            po_list.append({
                "id": po.get("id", ""),
                "po_number": po.get("po_number", ""),
                "version": po.get("version", 1),
                "customer_name": po.get("customer_name", ""),
                "po_date": po.get("po_date", ""),
                "delivery_date": po.get("delivery_date", ""),
                "amount": po.get("amount", 0),
                "currency": po.get("currency", "INR"),
                "status": po.get("status", "received"),
                "lines": lines_out,
                "summary": {
                    "total_lines": total_lines,
                    "unmapped": unmapped,
                    "in_stock": in_stock,
                    "needs_pr": needs_pr,
                    "pr_raised": pr_raised,
                    "ready": total_lines - unmapped - needs_pr
                }
            })

        if po_list:
            projects.append({
                "project_id": proj_id,
                "project_name": proj_name,
                "pos": po_list
            })

    return {"success": True, "data": projects}


@customer_orders_bp.route("/customer-orders", methods=["GET"])
def get_all_customer_orders():
    tid = _tid()
    rows = db.session.execute(db.text(
        "SELECT id, project_name, customer_pos FROM project.projects WHERE is_deleted = false AND " + _tid_cond()
    ), {"tid": tid}).fetchall()
    
    # We also need a set of valid part numbers to check if a part is mapped
    valid_parts = set()
    parts_rows = db.session.execute(db.text(
        "SELECT part_number FROM parts WHERE is_deleted = false AND " + _tid_cond()
    ), {"tid": tid}).fetchall()
    for pr in parts_rows:
        valid_parts.add(pr[0])
        
    # Also valid parts from BOMs (finished goods)
    bom_rows = db.session.execute(db.text(
        "SELECT fg_part_number FROM manufacturing_boms WHERE status IN ('active', 'Released') AND " + _tid_cond()
    ), {"tid": tid}).fetchall()
    for br in bom_rows:
        valid_parts.add(br[0])
        if br[0].endswith('-99'):
            valid_parts.add(br[0][:-3]) # Add without -99
            
    orders = []
    for r in rows:
        proj_id = str(r[0])
        proj_name = r[1]
        pos = r[2]
        if isinstance(pos, str):
            try:
                pos = json.loads(pos)
            except:
                pos = []
        if pos:
            for po in pos:
                po["project_id"] = proj_id
                po["project_name"] = proj_name
                
                # Check lines for mapping
                for line in po.get("lines", []):
                    pn = line.get("part_number") or ""
                    line["is_mapped"] = (pn in valid_parts)
                    
                    # Add planned qty logic (mocked or retrieved if we track PRs linked to POs)
                    # Currently we don't have a direct link from PR to Customer PO line item,
                    # so we'll just mock planned_qty as 0 for now, or if they have PRs with notes = direct buy.
                    line["planned_qty"] = 0
                    line["unplanned_qty"] = float(line.get("qty", 0))
                    
                orders.append(po)
                
    return {"success": True, "data": orders}

@customer_orders_bp.route("/bom-analysis/<part_number>", methods=["GET"])
def analyze_bom(part_number):
    tid = _tid()

    # ── Primary source: rawmaterial.rm_part_mapping ──
    rm_rows = []
    try:
        rm_rows = db.session.execute(db.text(
            "SELECT rm_code, COALESCE(rm_description,'') as rm_desc, "
            "COALESCE(quantity_required,1) as qty, COALESCE(unit,'pcs') as unit, "
            "COALESCE(wastage_percent,0) as wastage "
            "FROM rawmaterial.rm_part_mapping "
            "WHERE part_number = :pn AND is_deleted = false "
            "ORDER BY rm_code"
        ), {"pn": part_number}).fetchall()
    except Exception:
        db.session.rollback()

    # ── Fallback: manufacturing_bom_lines (if rm_part_mapping empty) ──
    bom_no = None
    yield_qty = 1.0
    if not rm_rows:
        try:
            fg_part = part_number if part_number.endswith("-99") else f"{part_number}-99"
            bom_row = db.session.execute(db.text(
                "SELECT id, bom_no, COALESCE(yield_qty,1) FROM public.manufacturing_boms "
                "WHERE fg_part_number IN (:fg, :pn) AND status IN ('active', 'Released') "
                "AND (tenant_id = :tid OR tenant_id = '' OR tenant_id IS NULL) LIMIT 1"
            ), {"fg": fg_part, "pn": part_number, "tid": tid}).first()
            if bom_row:
                bom_no    = bom_row[1]
                yield_qty = float(bom_row[2] or 1)
                lines = db.session.execute(db.text(
                    "SELECT component_no, COALESCE(component_description,''), "
                    "COALESCE(qty_per,1), COALESCE(unit,'pcs'), 0 "
                    "FROM public.manufacturing_bom_lines WHERE bom_id = :bid"
                ), {"bid": bom_row[0]}).fetchall()
                rm_rows = lines
        except Exception:
            db.session.rollback()

    # ── Check which RM codes have no mapping in part.customer_mappings / part tables ──
    # We just return them all; frontend will show them
    components = []
    for r in rm_rows:
        components.append({
            "component_no":  r[0],
            "description":   r[1] or "",
            "qty_per":       float(r[2] or 1),
            "unit":          r[3] or "pcs",
            "wastage_pct":   float(r[4]) if len(r) > 4 else 0,
            "lead_time_days": 0
        })

    # ── Check which RM codes exist in rawmaterial.rm_master (same table the RM module uses) ──
    valid_rm_codes = set()
    try:
        rm_master_rows = db.session.execute(db.text(
            "SELECT rm_code FROM rawmaterial.rm_master "
            "WHERE tenant_id = :tid AND is_deleted = false AND is_active = true"
        ), {"tid": tid}).fetchall()
        valid_rm_codes = {r[0] for r in rm_master_rows}
    except Exception:
        db.session.rollback()

    for c in components:
        c["is_mapped"] = c["component_no"] in valid_rm_codes

    # ── Fetch RM stock from inventory_stock_levels ──
    rm_codes = [c["component_no"] for c in components]
    rm_stock_map = {}
    if rm_codes:
        try:
            placeholders = ",".join([f":rm{k}" for k in range(len(rm_codes))])
            params = {f"rm{k}": v for k, v in enumerate(rm_codes)}
            stock_rows = db.session.execute(db.text(
                f"SELECT part_number, COALESCE(SUM(qty_available),0) "
                f"FROM inventory_stock_levels "
                f"WHERE part_number IN ({placeholders}) AND is_deleted=false "
                f"GROUP BY part_number"
            ), params).fetchall()
            rm_stock_map = {r[0]: float(r[1]) for r in stock_rows}
        except Exception:
            db.session.rollback()

    for c in components:
        c["stock_available"] = rm_stock_map.get(c["component_no"], 0.0)

    return {"success": True, "data": {
        "bom_id":           None,
        "bom_no":           bom_no,
        "fg_part_number":   part_number,
        "yield_qty":        yield_qty,
        "fg_lead_time_days": 0,
        "components":       components,
        "has_unmapped_rm":  any(not c["is_mapped"] for c in components)
    }}

