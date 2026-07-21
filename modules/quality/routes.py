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
            f"iqc_elapsed_min, iqc_remarks, iqc_inspector, location_code, bin_code, qr_code_data "
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
            "location_code": r[19] or "", "bin_code": r[20] or "", "qr_code_data": r[21] or ""
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
        f"iqc_elapsed_min, iqc_remarks, iqc_inspector, location_code, bin_code, qr_code_data "
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
        "location_code": r[19] or "", "bin_code": r[20] or "", "qr_code_data": r[21] or "",
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
    return jsonify({"success": True, "message": f"IQC Inspection completed. Status: {iqc_status}. OK: {passed_qty}, NG: {rejected_qty}"})


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
    code = data.get("part_or_rm_code")
    cname = data.get("criterion_name")

    if not code or not cname:
        return jsonify({"success": False, "message": "Part/RM Code and Criterion Name required"}), 400

    cid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO quality_iqc_criteria (id, part_or_rm_code, criterion_name, spec_target, "
        "tolerance_min, tolerance_max, inspection_method, is_mandatory, tenant_id) "
        "VALUES (:id, :code, :cname, :target, :tmin, :tmax, :method, :mand, :tid)"
    ), {
        "id": cid, "code": code, "cname": cname, "target": data.get("spec_target", ""),
        "tmin": data.get("tolerance_min", ""), "tmax": data.get("tolerance_max", ""),
        "method": data.get("inspection_method", "Vernier Caliper"),
        "mand": bool(data.get("is_mandatory", True)), "tid": tenant_id
    })
    db.session.commit()
    return jsonify({"success": True, "message": f"Inspection criterion '{cname}' created for {code}"})


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
