import uuid
import json
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from extensions import db

quality_bp = Blueprint("quality", __name__)


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


def _tid_cond():
    return "(tenant_id = :tid OR tenant_id = 'TEST' OR tenant_id = 'b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id = '' OR tenant_id IS NULL)"

def _tid():
    """Return tenant_id from header (preferred) or JWT fallback."""
    hdr = request.headers.get("X-Tenant-ID", "").strip()
    if hdr:
        return hdr
    return _get_tenant()


@quality_bp.route("/overview-stats", methods=["GET"])
def overview_stats():
    tenant_id = _get_tenant()
    cond = _tid_cond()
    try:
        pending_iqc = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM inventory_stock_checkins WHERE iqc_status = 'pending_iqc' AND is_deleted = false AND {cond}"
        ), {"tid": tenant_id}).scalar() or 0

        passed_iqc = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM inventory_stock_checkins WHERE iqc_status = 'passed' AND is_deleted = false AND {cond}"
        ), {"tid": tenant_id}).scalar() or 0

        total_ncrs = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM quality_ncrs WHERE is_deleted = false AND {cond}"
        ), {"tid": tenant_id}).scalar() or 0

        active_criteria = db.session.execute(db.text(
            f"SELECT COUNT(*) FROM quality_iqc_criteria WHERE is_deleted = false AND {cond}"
        ), {"tid": tenant_id}).scalar() or 0

        return jsonify({
            "success": True,
            "data": {
                "pending_iqc": pending_iqc,
                "passed_iqc": passed_iqc,
                "total_ncrs": total_ncrs,
                "active_criteria": active_criteria
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


# ─── INCOMING QUALITY CONTROL (IQC) ───
@quality_bp.route("/iqc", methods=["GET"])
def list_iqc_inspections():
    tenant_id = _get_tenant()
    cond = _tid_cond()
    try:
        rows = db.session.execute(db.text(
            f"SELECT id, checkin_no, po_no, supplier_code, supplier_name, part_or_rm_code, "
            f"item_description, ordered_qty, received_qty, checkin_time, checked_in_by, "
            f"iqc_status, iqc_passed_qty, iqc_rejected_qty, iqc_scrap_qty, iqc_time, "
            f"iqc_elapsed_min, iqc_remarks, iqc_inspector, warehouse_code, location_code, bin_code, qr_code_data "
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
            "warehouse_code": r[19] or "", "location_code": r[20] or "", "bin_code": r[21] or "", "qr_code_data": r[22] or ""
        } for r in rows]
        return jsonify({"success": True, "data": items})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@quality_bp.route("/iqc/<cid>", methods=["GET"])
def get_iqc_detail(cid):
    tenant_id = _get_tenant()
    cond = _tid_cond()
    r = db.session.execute(db.text(
        f"SELECT id, checkin_no, po_no, supplier_code, supplier_name, part_or_rm_code, "
        f"item_description, ordered_qty, received_qty, checkin_time, checked_in_by, "
        f"iqc_status, iqc_passed_qty, iqc_rejected_qty, iqc_scrap_qty, iqc_time, "
        f"iqc_elapsed_min, iqc_remarks, iqc_inspector, warehouse_code, location_code, bin_code, qr_code_data "
        f"FROM inventory_stock_checkins WHERE id = :id AND is_deleted = false AND {cond}"
    ), {"id": cid, "tid": tenant_id}).first()
    if not r:
        return jsonify({"success": False, "message": "IQC Inspection record not found"}), 404

    # Fetch applicable IQC Criteria for this part/RM
    code = r[5]
    crit_rows = db.session.execute(db.text(
        f"SELECT id, criterion_name, spec_target, tolerance_min, tolerance_max, inspection_method, is_mandatory "
        f"FROM quality_iqc_criteria WHERE (part_or_rm_code = :code OR part_or_rm_code = 'ALL') AND is_deleted = false AND {cond}"
    ), {"code": code, "tid": tenant_id}).fetchall()

    criteria = [{
        "id": c[0], "criterion_name": c[1], "spec_target": c[2],
        "tolerance_min": c[3], "tolerance_max": c[4],
        "inspection_method": c[5], "is_mandatory": c[6]
    } for c in crit_rows]

    data = {
        "id": r[0], "checkin_no": r[1], "po_no": r[2], "supplier_code": r[3],
        "supplier_name": r[4], "part_or_rm_code": r[5], "item_description": r[6] or "",
        "ordered_qty": float(r[7] or 0), "received_qty": float(r[8] or 0),
        "checkin_time": str(r[9]) if r[9] else "", "checked_in_by": r[10] or "",
        "iqc_status": r[11] or "pending_iqc", "iqc_passed_qty": float(r[12] or 0),
        "iqc_rejected_qty": float(r[13] or 0), "iqc_scrap_qty": float(r[14] or 0),
        "iqc_time": str(r[15]) if r[15] else "", "iqc_elapsed_min": int(r[16] or 0),
        "iqc_remarks": r[17] or "", "iqc_inspector": r[18] or "",
        "warehouse_code": r[19] or "", "location_code": r[20] or "", "bin_code": r[21] or "", "qr_code_data": r[22] or "",
        "applicable_criteria": criteria
    }
    return jsonify({"success": True, "data": data})


@quality_bp.route("/iqc/<cid>/inspect", methods=["POST"])
def perform_iqc_inspection(cid):
    tenant_id = _get_tenant()
    data = request.get_json() or {}

    passed_qty = float(data.get("passed_qty", 0))
    rejected_qty = float(data.get("rejected_qty", 0))
    scrap_qty = float(data.get("scrap_qty", 0))
    remarks = data.get("remarks", "IQC Inspection evaluated against criteria")
    inspector = request.headers.get("X-User-Name") or data.get("inspector", "Vikram Singh (EMP-1005)")
    elapsed_min = int(data.get("elapsed_min", 15))

    checkin = db.session.execute(db.text("SELECT checkin_no, part_or_rm_code, supplier_name, received_qty FROM inventory_stock_checkins WHERE id = :id"), {"id": cid}).first()
    if not checkin:
        return jsonify({"success": False, "message": "Check-in record not found"}), 404

    cno, code, sname, rec_qty = checkin[0], checkin[1], checkin[2], float(checkin[3] or 0)
    iqc_status = "passed" if (rejected_qty == 0 and scrap_qty == 0) else "partial_pass" if passed_qty > 0 else "rejected"

    db.session.execute(db.text(
        "UPDATE inventory_stock_checkins SET iqc_status = :status, iqc_passed_qty = :pqty, "
        "iqc_rejected_qty = :rqty, iqc_scrap_qty = :sqty, iqc_time = NOW(), iqc_elapsed_min = :emin, "
        "iqc_remarks = :rem, iqc_inspector = :insp, updated_at = NOW() WHERE id = :id"
    ), {
        "status": iqc_status, "pqty": passed_qty, "rqty": rejected_qty, "sqty": scrap_qty,
        "emin": elapsed_min, "rem": remarks, "insp": inspector, "id": cid
    })

    # Update Inventory Available Stock for OK Passed Qty
    if passed_qty > 0:
        db.session.execute(db.text(
            f"UPDATE inventory_stock_levels SET qty_on_hand = qty_on_hand + :pqty, qty_available = qty_available + :pqty, total_value = (qty_on_hand + :pqty)*unit_cost "
            f"WHERE part_number = :code AND is_deleted = false AND {_tid_cond()}"
        ), {"pqty": passed_qty, "code": code, "tid": tenant_id})

    # Create Non-Conformance Report (NCR) if any units rejected
    if rejected_qty > 0:
        nid = str(uuid.uuid4())
        nno = f"NCR-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        db.session.execute(db.text(
            "INSERT INTO quality_ncrs (id, ncr_no, checkin_no, part_or_rm_code, supplier_name, "
            "rejected_qty, defect_type, severity, root_cause, corrective_action, disposition, status, raised_by, tenant_id) "
            "VALUES (:id, :nno, :cno, :code, :sname, :rqty, 'IQC Inspection Defect', 'Major', :rem, 'Supplier CAPA required', 'Return to Vendor (RTV)', 'open', :insp, :tid)"
        ), {
            "id": nid, "nno": nno, "cno": cno, "code": code, "sname": sname,
            "rqty": rejected_qty, "rem": remarks, "insp": inspector, "tid": tenant_id
        })

    db.session.commit()

    # Notify Planning when IQC is passed or partially passed
    if iqc_status in ("passed", "partial_pass"):
        _quality_notify(
            tenant_id, "Quality", "IQC_PASSED",
            cno, cid,
            f"IQC Passed: {cno}",
            f"Part {code} (Supplier: {sname}) passed IQC. "
            f"Accepted: {passed_qty} | Rejected: {rejected_qty} | Scrapped: {scrap_qty}. "
            f"Stock updated. Status: {iqc_status}.",
            "planner"
        )
    elif iqc_status == "rejected":
        _quality_notify(
            tenant_id, "Quality", "IQC_REJECTED",
            cno, cid,
            f"IQC Rejected: {cno}",
            f"Part {code} (Supplier: {sname}) failed IQC. "
            f"All {rejected_qty} units rejected. Remarks: {remarks}.",
            "planner"
        )

    return jsonify({"success": True, "message": f"IQC Inspection completed. Status: {iqc_status}. OK: {passed_qty}, NG: {rejected_qty}"})


# ─── IQC ON GRN (triggered from Logistics GRN) ───

@quality_bp.route("/grn-pending-iqc", methods=["GET"])
def grn_pending_iqc():
    tenant_id = _tid()
    rows = db.session.execute(db.text(
        "SELECT g.id, g.grn_no, g.po_id, g.item_code, g.item_description, "
        "g.received_qty, g.supplier_name, g.discrepancy_notes, g.created_at, p.doc_no, "
        "g.grn_status, g.assigned_location_code, g.handover_warehouse, "
        "COALESCE((SELECT qty_accepted FROM quality.inspections WHERE reference_id=g.id AND type='IQC' AND is_deleted=false ORDER BY created_at DESC LIMIT 1), 0), "
        "COALESCE((SELECT qty_rejected FROM quality.inspections WHERE reference_id=g.id AND type='IQC' AND is_deleted=false ORDER BY created_at DESC LIMIT 1), 0), "
        "(SELECT remarks FROM quality.inspections WHERE reference_id=g.id AND type='IQC' AND is_deleted=false ORDER BY created_at DESC LIMIT 1) "
        "FROM procurement.grn g "
        "LEFT JOIN procurement.purchase_orders p ON g.po_id = p.id "
        "WHERE g.grn_status IN ('handed_over','partially_handed_over','pending_iqc','iqc_passed','iqc_partial','iqc_rejected') "
        "AND g.is_deleted=false "
        "AND (g.tenant_id=:tid OR g.tenant_id='' OR g.tenant_id IS NULL) "
        "ORDER BY g.created_at DESC"
    ), {"tid": tenant_id}).fetchall()
    return jsonify({"success": True, "data": [{
        "id": str(r[0]), "grn_no": r[1] or "", "po_id": str(r[2]) if r[2] else "",
        "item_code": r[3] or "", "item_description": r[4] or "",
        "received_qty": float(r[5] or 0), "supplier_name": r[6] or "",
        "discrepancy_notes": r[7] or "",
        "created_at": str(r[8]) if r[8] else None, "po_no": r[9] or "",
        "grn_status": r[10] or "",
        "location_code": r[11] or "", "warehouse_code": r[12] or "",
        "ok_qty": float(r[13] or 0), "ng_qty": float(r[14] or 0),
        "remarks": r[15] or ""
    } for r in rows]})


def _get_criteria_results(inspection_id):
    if not inspection_id:
        return []
    rows = db.session.execute(db.text(
        "SELECT criterion_id, criterion_name, spec_target, tolerance_min, tolerance_max, "
        "inspection_method, is_mandatory, result, remarks "
        "FROM quality.inspection_criteria_results WHERE inspection_id=:id ORDER BY created_at"
    ), {"id": inspection_id}).fetchall()
    return [{
        "criterion_id": str(r[0]) if r[0] else None,
        "criterion_name": r[1], "spec_target": r[2] or "",
        "tolerance_min": r[3] or "", "tolerance_max": r[4] or "",
        "inspection_method": r[5] or "", "is_mandatory": r[6],
        "result": r[7], "remarks": r[8] or ""
    } for r in rows]


@quality_bp.route("/grn-iqc/<grn_id>/criteria-results", methods=["GET"])
def get_grn_criteria_results(grn_id):
    insp = db.session.execute(db.text(
        "SELECT id FROM quality.inspections WHERE reference_id=:gid AND type='IQC' AND is_deleted=false ORDER BY created_at DESC LIMIT 1"
    ), {"gid": grn_id}).first()
    return jsonify({"success": True, "data": _get_criteria_results(str(insp[0])) if insp else []})


@quality_bp.route("/grn-iqc/<grn_id>/inspect", methods=["POST"])
def inspect_grn(grn_id):
    tenant_id = _tid()
    data = request.get_json() or {}
    accepted_qty  = float(data.get("accepted_qty", 0))
    rejected_qty  = float(data.get("rejected_qty", 0))
    failure_reason = data.get("failure_reason", "")
    inspector = request.headers.get("X-User-Name") or data.get("inspector", "QC Inspector")

    grn = db.session.execute(db.text(
        "SELECT grn_no, item_code, item_description, received_qty, supplier_name, po_id, "
        "assigned_location_code, handover_warehouse, lines "
        "FROM procurement.grn WHERE id=:id AND is_deleted=false"
    ), {"id": grn_id}).first()
    if not grn:
        return jsonify({"success": False, "message": "GRN not found"}), 404

    total = accepted_qty + rejected_qty
    if total > float(grn[3] or 0):
        return jsonify({"success": False, "message": "Accepted + Rejected cannot exceed received qty"}), 400

    result     = "passed" if rejected_qty == 0 else "partial_pass" if accepted_qty > 0 else "rejected"
    grn_status = "iqc_passed" if result == "passed" else "iqc_partial" if result == "partial_pass" else "iqc_rejected"
    iqc_no     = f"IQC-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    iqc_id     = str(uuid.uuid4())

    # UPSERT: update existing inspection if one exists for this GRN, else insert
    existing_insp = db.session.execute(db.text(
        "SELECT id FROM quality.inspections WHERE reference_id=:gid AND type='IQC' AND is_deleted=false LIMIT 1"
    ), {"gid": grn_id}).first()

    if existing_insp:
        iqc_id = str(existing_insp[0])
        db.session.execute(db.text(
            "UPDATE quality.inspections SET "
            "qty_inspected=:rqty, qty_accepted=:aqty, qty_rejected=:rjqty, "
            "status=:result, inspector_id=:insp, remarks=:reason, updated_at=NOW() "
            "WHERE id=:id"
        ), {
            "rqty": grn[3], "aqty": accepted_qty, "rjqty": rejected_qty,
            "result": result, "insp": inspector,
            "reason": failure_reason or "IQC inspection", "id": iqc_id
        })
        # Delete old criteria results so we can re-insert fresh ones
        db.session.execute(db.text(
            "DELETE FROM quality.inspection_criteria_results WHERE inspection_id=:id"
        ), {"id": iqc_id})
    else:
        db.session.execute(db.text(
            "INSERT INTO quality.inspections "
            "(id, doc_no, date, type, reference_type, reference_id, item_id, "
            "qty_inspected, qty_accepted, qty_rejected, status, inspector_id, "
            "remarks, tenant_id, created_by, is_deleted, created_at) "
            "VALUES (:id, :ino, CURRENT_DATE, 'IQC', 'GRN', :gid, :code, "
            ":rqty, :aqty, :rjqty, :result, :insp, "
            ":reason, :tid, :by, false, NOW())"
        ), {
            "id": iqc_id, "ino": iqc_no, "gid": grn_id, "code": grn[1],
            "rqty": grn[3], "aqty": accepted_qty, "rjqty": rejected_qty,
            "result": result, "reason": failure_reason or "IQC inspection",
            "insp": inspector, "tid": tenant_id,
            "by": request.headers.get("X-User-Email", inspector)
        })

    # Save per-criterion results
    criteria_results = data.get("criteria_results", [])
    for cr in criteria_results:
        db.session.execute(db.text(
            "INSERT INTO quality.inspection_criteria_results "
            "(inspection_id, criterion_id, criterion_name, spec_target, tolerance_min, "
            "tolerance_max, inspection_method, is_mandatory, result, remarks, tenant_id) "
            "VALUES (:iid, :cid, :cname, :target, :tmin, :tmax, :method, :mand, :result, :rem, :tid)"
        ), {
            "iid": iqc_id,
            "cid": cr.get("criterion_id") or None,
            "cname": cr.get("criterion_name", ""),
            "target": cr.get("spec_target", ""),
            "tmin": cr.get("tolerance_min", ""),
            "tmax": cr.get("tolerance_max", ""),
            "method": cr.get("inspection_method", ""),
            "mand": bool(cr.get("is_mandatory", True)),
            "result": cr.get("result", "pass"),
            "rem": cr.get("remarks", ""),
            "tid": tenant_id
        })

    # Update GRN status
    db.session.execute(db.text(
        "UPDATE procurement.grn SET grn_status=:status, updated_at=NOW() WHERE id=:id"
    ), {"status": grn_status, "id": grn_id})

    # Parse GRN lines to get per-item location assignments
    grn_lines = grn[8]
    if isinstance(grn_lines, str):
        try: grn_lines = json.loads(grn_lines)
        except Exception: grn_lines = []
    if not grn_lines:
        grn_lines = [{"item_code": grn[1], "item_description": grn[2],
                      "received_qty": float(grn[3] or 0), "assignments": []}]

    # Update inventory stock levels with location info from handover assignments
    if accepted_qty > 0:
        loc_code = grn[6] or ""
        wh_code  = grn[7] or "MAIN"

        # Try to update per-line using assignments stored in GRN lines
        for line in grn_lines:
            code = line.get("item_code") or grn[1]
            line_assignments = line.get("assignments") or []

            if line_assignments:
                # Update each specific bin/location slot
                for ass in line_assignments:
                    a_loc  = ass.get("location_code") or loc_code
                    a_bin  = ass.get("bin_code") or ""
                    a_wh   = ass.get("warehouse_code") or wh_code
                    a_qty  = float(ass.get("qty") or 0)
                    if a_qty <= 0:
                        continue
                    bin_cond = "bin_code=:bin" if a_bin else "(bin_code IS NULL OR bin_code='')"
                    params = {"code": code, "wh": a_wh, "tid": tenant_id}
                    if a_bin: params["bin"] = a_bin
                    existing = db.session.execute(db.text(
                        f"SELECT id FROM inventory_stock_levels "
                        f"WHERE part_number=:code AND warehouse_code=:wh AND {bin_cond} "
                        f"AND is_deleted=false AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) LIMIT 1"
                    ), params).first()
                    if existing:
                        db.session.execute(db.text(
                            "UPDATE inventory_stock_levels SET "
                            "qty_available=qty_available+:qty, updated_at=NOW() WHERE id=:id"
                        ), {"qty": a_qty, "id": existing[0]})
            else:
                # Fallback: update by part_number + warehouse
                existing = db.session.execute(db.text(
                    "SELECT id FROM inventory_stock_levels "
                    "WHERE part_number=:code AND warehouse_code=:wh AND is_deleted=false "
                    "AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) LIMIT 1"
                ), {"code": code, "wh": wh_code, "tid": tenant_id}).first()
                if existing:
                    db.session.execute(db.text(
                        "UPDATE inventory_stock_levels SET "
                        "qty_available=qty_available+:qty, updated_at=NOW() WHERE id=:id"
                    ), {"qty": accepted_qty, "id": existing[0]})

    # Create NCR if rejected
    if rejected_qty > 0:
        db.session.execute(db.text(
            "INSERT INTO quality.ncr "
            "(id, doc_no, date, type, source, item_id, description, "
            "root_cause, corrective_action, status, severity, tenant_id, created_by, is_deleted, created_at) "
            "VALUES (gen_random_uuid(), :nno, CURRENT_DATE, 'IQC', 'GRN', :code, :desc, "
            ":reason, 'Supplier CAPA required', 'open', 'Major', :tid, :by, false, NOW())"
        ), {
            "nno": f"NCR-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "code": grn[1], "desc": failure_reason or f"IQC rejection for GRN {grn[0]}",
            "reason": failure_reason or "IQC inspection failure",
            "tid": tenant_id, "by": inspector
        })

    db.session.commit()

    _quality_notify(tenant_id, "Planning", "IQC_DONE", iqc_no, iqc_id,
        f"IQC Complete: {iqc_no} — {result.upper()}",
        f"IQC for {grn[1]} (GRN: {grn[0]}) | Accepted: {accepted_qty} | Rejected: {rejected_qty} | Result: {result}.",
        "planner")
    _quality_notify(tenant_id, "Purchase", "IQC_DONE", iqc_no, iqc_id,
        f"IQC Complete: {iqc_no} — {result.upper()}",
        f"IQC for {grn[1]} (GRN: {grn[0]}) | Accepted: {accepted_qty} | Rejected: {rejected_qty}.",
        "purchaser")
    if rejected_qty > 0:
        _quality_notify(tenant_id, "Supplier", "IQC_REJECTION", iqc_no, iqc_id,
            f"IQC Rejection Notice: {iqc_no}",
            f"{rejected_qty} units of {grn[1]} rejected. Reason: {failure_reason}. Return to vendor required.",
            "supplier")

    return jsonify({"success": True, "data": {"iqc_no": iqc_no, "result": result,
            "accepted_qty": accepted_qty, "rejected_qty": rejected_qty},
            "message": f"IQC {iqc_no} completed: {result}"})


@quality_bp.route("/iqc-inspections", methods=["GET"])
def list_iqc_inspections_new():
    tenant_id = _tid()
    rows = db.session.execute(db.text(
        "SELECT i.id, i.doc_no, g.grn_no, i.item_id, '', "
        "i.qty_inspected, i.qty_accepted, i.qty_rejected, i.status, "
        "i.remarks, i.inspector_id, i.created_at, false, i.created_at "
        "FROM quality.inspections i "
        "LEFT JOIN procurement.grn g ON g.id = i.reference_id "
        "WHERE i.type='IQC' AND i.is_deleted=false "
        "AND (i.tenant_id=:tid OR i.tenant_id='' OR i.tenant_id IS NULL) "
        "ORDER BY i.created_at DESC"
    ), {"tid": tenant_id}).fetchall()
    return jsonify({"success": True, "data": [{
        "id": str(r[0]), "iqc_no": r[1], "grn_no": r[2] or "",
        "item_code": r[3], "item_description": r[4] or "",
        "received_qty": float(r[5] or 0), "accepted_qty": float(r[6] or 0),
        "rejected_qty": float(r[7] or 0), "inspection_result": r[8] or "pending",
        "failure_reason": r[9] or "", "inspector": r[10] or "",
        "inspected_at": str(r[11]) if r[11] else None,
        "checkin_done": r[12] or False,
        "created_at": str(r[13]) if r[13] else None
    } for r in rows]})


def _quality_notify(tenant_id, module, event_type, ref_no, ref_id, title, message, role):
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


# ─── IQC INSPECTION CRITERIA MASTER ───
@quality_bp.route("/criteria", methods=["GET"])
def list_criteria():
    tenant_id = _get_tenant()
    cond = _tid_cond()
    try:
        rows = db.session.execute(db.text(
            f"SELECT id, part_or_rm_code, criterion_name, spec_target, tolerance_min, "
            f"tolerance_max, inspection_method, is_mandatory, created_at FROM quality_iqc_criteria "
            f"WHERE is_deleted = false AND {cond} ORDER BY part_or_rm_code ASC"
        ), {"tid": tenant_id}).fetchall()
        items = [{
            "id": r[0], "part_or_rm_code": r[1], "criterion_name": r[2],
            "spec_target": r[3] or "", "tolerance_min": r[4] or "",
            "tolerance_max": r[5] or "", "inspection_method": r[6] or "",
            "is_mandatory": r[7], "created_at": str(r[8]) if r[8] else ""
        } for r in rows]
        return jsonify({"success": True, "data": items})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@quality_bp.route("/criteria", methods=["POST"])
def create_criterion():
    tenant_id = _get_tenant()
    data = request.get_json() or {}

    # Support both single object and array
    items = data if isinstance(data, list) else [data]
    created = 0
    for item in items:
        code  = item.get("part_or_rm_code")
        cname = item.get("criterion_name")
        if not code or not cname:
            continue
        db.session.execute(db.text(
            "INSERT INTO quality_iqc_criteria (id, part_or_rm_code, criterion_name, spec_target, "
            "tolerance_min, tolerance_max, inspection_method, is_mandatory, tenant_id) "
            "VALUES (:id, :code, :cname, :target, :tmin, :tmax, :method, :mand, :tid)"
        ), {
            "id": str(uuid.uuid4()), "code": code, "cname": cname,
            "target": item.get("spec_target", ""),
            "tmin": item.get("tolerance_min", ""),
            "tmax": item.get("tolerance_max", ""),
            "method": item.get("inspection_method", "Vernier Caliper"),
            "mand": bool(item.get("is_mandatory", True)),
            "tid": tenant_id
        })
        created += 1
    if not created:
        return jsonify({"success": False, "message": "Part/RM Code and Criterion Name required for each row"}), 400
    db.session.commit()
    return jsonify({"success": True, "message": f"{created} criterion{'a' if created > 1 else ''} saved"})


# ─── NON-CONFORMANCE REPORTS (NCR) ───
@quality_bp.route("/ncr", methods=["GET"])
def list_ncrs():
    tenant_id = _get_tenant()
    cond = _tid_cond()
    try:
        rows = db.session.execute(db.text(
            f"SELECT id, ncr_no, checkin_no, part_or_rm_code, supplier_name, rejected_qty, "
            f"defect_type, severity, root_cause, corrective_action, disposition, status, raised_by, created_at "
            f"FROM quality_ncrs WHERE is_deleted = false AND {cond} ORDER BY created_at DESC"
        ), {"tid": tenant_id}).fetchall()
        items = [{
            "id": r[0], "ncr_no": r[1], "checkin_no": r[2] or "-", "part_or_rm_code": r[3],
            "supplier_name": r[4] or "-", "rejected_qty": float(r[5] or 0),
            "defect_type": r[6] or "", "severity": r[7] or "Major",
            "root_cause": r[8] or "", "corrective_action": r[9] or "",
            "disposition": r[10] or "RTV", "status": r[11] or "open",
            "raised_by": r[12] or "", "created_at": str(r[13]) if r[13] else ""
        } for r in rows]
        return jsonify({"success": True, "data": items})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


# ─── IN-PROCESS QUALITY CONTROL (IPQC) ───
@quality_bp.route("/ipqc", methods=["GET"])
def list_ipqc():
    tenant_id = _get_tenant()
    return jsonify({
        "success": True,
        "data": [
            {
                "id": "ipqc-1",
                "inspection_no": "IPQC-20260721-01",
                "production_order_no": "PRD-20260721-01",
                "part_number": "601-0-000001-99",
                "work_center": "CNC Turning Center 01 (WC-CNC-01)",
                "operation_sequence": "Op-10 (Rough Turning)",
                "sample_qty": 5,
                "status": "passed",
                "inspector": "Vikram Singh (EMP-1005)"
            }
        ]
    })


# ─── FINAL QUALITY ASSURANCE (FQA) ───
@quality_bp.route("/fqa", methods=["GET"])
def list_fqa():
    tenant_id = _get_tenant()
    return jsonify({
        "success": True,
        "data": [
            {
                "id": "fqa-1",
                "fqa_no": "FQA-20260721-01",
                "production_order_no": "PRD-20260721-01",
                "part_number": "601-0-000001-99",
                "inspected_qty": 50,
                "passed_qty": 50,
                "rejected_qty": 0,
                "status": "passed",
                "cert_status": "Quality Certificate Issued (QC-PASS-1001)"
            }
        ]
    })


# ─── MODULE USERS & ACCESS MANAGEMENT ───
@quality_bp.route("/users", methods=["GET"])
def get_module_users():
    try:
        rows = db.session.execute(db.text(
            "SELECT ma.id, ma.user_id, ma.role, ma.permissions, ma.is_active, ma.created_at, "
            "u.email, u.first_name, u.last_name "
            "FROM iam.module_access ma JOIN iam.users u ON ma.user_id = u.id "
            "WHERE ma.module IN ('Quality Management', 'Quality') "
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


@quality_bp.route("/users", methods=["POST"])
def add_module_user():
    data = request.get_json() or {}
    tenant_id = _get_tenant()
    user_id = data.get("user_id")
    role = data.get("role", "viewer")
    permissions = data.get("permissions", {})

    if not user_id:
        return jsonify({"success": False, "message": "user_id required"}), 400

    access_id = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO iam.module_access (id, user_id, module, role, permissions, granted_by, tenant_id) "
        "VALUES (:id, :uid, 'Quality Management', :role, :perms, 'system', :tid)"
    ), {"id": access_id, "uid": user_id, "role": role, "perms": json.dumps(permissions), "tid": tenant_id})
    db.session.commit()
    return jsonify({"success": True, "message": "Quality Management Access granted"}), 201
