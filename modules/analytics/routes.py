from flask import Blueprint, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from extensions import db
import json

analytics_bp = Blueprint("analytics", __name__)


def _tid():
    tid = request.headers.get("X-Tenant-ID", "").strip()
    if tid:
        return tid
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if isinstance(identity, str):
            try:
                identity = json.loads(identity)
            except Exception:
                pass
        if isinstance(identity, dict):
            return identity.get("tenant_id", "")
    except Exception:
        pass
    return ""


def _tc():
    return "(tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL)"


# ─── OVERVIEW DASHBOARD ───

@analytics_bp.route("/overview", methods=["GET"])
def overview():
    tid = _tid()
    tc = _tc()
    try:
        # Inventory value
        inv_value = db.session.execute(db.text(
            f"SELECT COALESCE(SUM(total_value),0) FROM inventory_stock_levels "
            f"WHERE is_deleted=false AND {tc}"
        ), {"tid": tid}).scalar() or 0.0

        # Total dispatched value (outbound)
        try:
            dispatched_value = db.session.execute(db.text(
                f"SELECT COALESCE(SUM(selling_price_total),0) FROM logistics.shipments "
                f"WHERE status='dispatched' AND is_deleted=false AND {tc}"
            ), {"tid": tid}).scalar() or 0.0
            total_profit = db.session.execute(db.text(
                f"SELECT COALESCE(SUM(gross_profit),0) FROM logistics.shipments "
                f"WHERE status='dispatched' AND is_deleted=false AND {tc}"
            ), {"tid": tid}).scalar() or 0.0
            total_shipments = db.session.execute(db.text(
                f"SELECT COUNT(*) FROM logistics.shipments WHERE is_deleted=false AND {tc}"
            ), {"tid": tid}).scalar() or 0
        except Exception:
            db.session.rollback()
            dispatched_value = total_profit = total_shipments = 0

        # Quality yield
        try:
            iqc_total = db.session.execute(db.text(
                "SELECT COALESCE(SUM(qty_inspected),0), COALESCE(SUM(qty_accepted),0) "
                "FROM quality.inspections WHERE is_deleted=false "
                f"AND {tc}"
            ), {"tid": tid}).first()
            iqc_yield = round((float(iqc_total[1]) / float(iqc_total[0]) * 100) if iqc_total[0] else 0, 1)
        except Exception:
            db.session.rollback()
            iqc_yield = 0

        # Stock movements this month
        movements = db.session.execute(db.text(
            "SELECT COUNT(*) FROM inventory_stock_movements "
            "WHERE created_at >= date_trunc('month', NOW()) "
            f"AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL)"
        ), {"tid": tid}).scalar() or 0

        # Active POs
        try:
            active_pos = db.session.execute(db.text(
                "SELECT COUNT(*) FROM procurement.purchase_orders "
                "WHERE po_status IN ('sent_to_supplier','acknowledged','partially_received') "
                f"AND is_deleted=false AND {tc}"
            ), {"tid": tid}).scalar() or 0
        except Exception:
            db.session.rollback()
            active_pos = 0

        return {"success": True, "data": {
            "inventory_value": float(inv_value),
            "dispatched_value": float(dispatched_value),
            "gross_profit": float(total_profit),
            "total_shipments": int(total_shipments),
            "iqc_yield_pct": iqc_yield,
            "stock_movements_this_month": int(movements),
            "active_purchase_orders": int(active_pos)
        }}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e)}, 500


# ─── PER CUSTOMER PO — P&L ───

@analytics_bp.route("/po-pl", methods=["GET"])
def po_profit_loss():
    """Profit & Loss per customer PO."""
    tid = _tid()
    tc = _tc()
    customer = request.args.get("customer", "").strip()
    try:
        params = {"tid": tid}
        where = f"is_deleted=false AND {tc}"
        if customer:
            where += " AND customer_name ILIKE :cust"
            params["cust"] = f"%{customer}%"

        rows = db.session.execute(db.text(
            f"SELECT customer_po_no, customer_name, "
            f"COUNT(*) as shipment_count, "
            f"SUM(selling_price_total) as total_revenue, "
            f"SUM(cost_price_total) as total_cost, "
            f"SUM(gross_profit) as total_profit, "
            f"SUM(customer_invoice_amount) as total_invoiced "
            f"FROM logistics.shipments WHERE {where} "
            f"GROUP BY customer_po_no, customer_name ORDER BY total_profit DESC"
        ), params).fetchall()

        return {"success": True, "data": [{
            "customer_po_no": r[0], "customer_name": r[1],
            "shipment_count": int(r[2] or 0),
            "total_revenue": float(r[3] or 0),
            "total_cost": float(r[4] or 0),
            "gross_profit": float(r[5] or 0),
            "margin_pct": round((float(r[5] or 0) / float(r[3] or 1) * 100), 2),
            "total_invoiced": float(r[6] or 0)
        } for r in rows]}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e)}, 500


# ─── PER PART — COST vs SELLING vs PROFIT ───

@analytics_bp.route("/part-costing", methods=["GET"])
def part_costing():
    """Per part: cost price, selling price, profit, total dispatched."""
    tid = _tid()
    tc = _tc()
    try:
        rows = db.session.execute(db.text(
            f"SELECT sl.part_number, sl.part_description, "
            f"SUM(sl.qty_dispatched) as total_dispatched, "
            f"AVG(sl.unit_cost) as avg_cost, "
            f"AVG(sl.unit_selling) as avg_selling, "
            f"SUM(sl.total_cost) as total_cost, "
            f"SUM(sl.total_selling) as total_revenue, "
            f"SUM(sl.profit) as total_profit "
            f"FROM logistics.shipment_lines sl "
            f"JOIN logistics.shipments s ON s.id=sl.shipment_id "
            f"WHERE s.is_deleted=false AND (s.tenant_id=:tid OR s.tenant_id='' OR s.tenant_id IS NULL) "
            f"GROUP BY sl.part_number, sl.part_description ORDER BY total_profit DESC"
        ), {"tid": tid}).fetchall()

        return {"success": True, "data": [{
            "part_number": r[0], "part_description": r[1] or "",
            "total_dispatched": float(r[2] or 0),
            "avg_cost": float(r[3] or 0),
            "avg_selling": float(r[4] or 0),
            "total_cost": float(r[5] or 0),
            "total_revenue": float(r[6] or 0),
            "total_profit": float(r[7] or 0),
            "margin_pct": round((float(r[7] or 0) / float(r[6] or 1) * 100), 2)
        } for r in rows]}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e)}, 500


# ─── INVENTORY MOVEMENT SUMMARY ───

@analytics_bp.route("/inventory-movements", methods=["GET"])
def inventory_movements():
    """Stock movement summary — receipts, dispatches, transfers, adjustments."""
    tid = _tid()
    period = request.args.get("period", "month")
    interval = {"day": "1 day", "week": "7 days", "month": "30 days", "year": "365 days"}.get(period, "30 days")
    try:
        rows = db.session.execute(db.text(
            "SELECT movement_type, COUNT(*), COALESCE(SUM(qty),0), COALESCE(SUM(qty*unit_cost),0) "
            "FROM inventory_stock_movements "
            "WHERE created_at >= NOW() - INTERVAL :interval "
            "AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) "
            "GROUP BY movement_type ORDER BY COUNT(*) DESC"
        ), {"tid": tid, "interval": interval}).fetchall()

        # Top moving parts
        top_parts = db.session.execute(db.text(
            "SELECT part_number, COUNT(*), SUM(qty) FROM inventory_stock_movements "
            "WHERE created_at >= NOW() - INTERVAL :interval "
            "AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) "
            "GROUP BY part_number ORDER BY SUM(qty) DESC LIMIT 10"
        ), {"tid": tid, "interval": interval}).fetchall()

        return {"success": True, "data": {
            "by_type": [{
                "movement_type": r[0], "count": int(r[1]),
                "total_qty": float(r[2]), "total_value": float(r[3])
            } for r in rows],
            "top_moving_parts": [{
                "part_number": p[0], "movement_count": int(p[1]), "total_qty": float(p[2])
            } for p in top_parts]
        }}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e)}, 500


# ─── QUALITY ANALYTICS ───

@analytics_bp.route("/quality", methods=["GET"])
def quality_analytics():
    """IQC pass/fail rates, NCR counts, per-part quality yield."""
    tid = _tid()
    tc = _tc()
    try:
        # Overall IQC stats
        iqc = db.session.execute(db.text(
            f"SELECT status, COUNT(*), COALESCE(SUM(qty_accepted),0), COALESCE(SUM(qty_rejected),0) "
            f"FROM quality.inspections WHERE type='IQC' AND is_deleted=false AND {tc} "
            f"GROUP BY status"
        ), {"tid": tid}).fetchall()

        # Per part yield
        part_yield = db.session.execute(db.text(
            f"SELECT item_id, SUM(qty_accepted), SUM(qty_rejected), "
            f"ROUND(SUM(qty_accepted)*100.0/NULLIF(SUM(qty_accepted)+SUM(qty_rejected),0),1) "
            f"FROM quality.inspections WHERE type='IQC' AND is_deleted=false AND {tc} "
            f"GROUP BY item_id ORDER BY SUM(qty_rejected) DESC LIMIT 20"
        ), {"tid": tid}).fetchall()

        # NCR count
        try:
            ncr_count = db.session.execute(db.text(
                f"SELECT COUNT(*) FROM quality.ncr WHERE is_deleted=false AND {tc}"
            ), {"tid": tid}).scalar() or 0
        except Exception:
            db.session.rollback()
            ncr_count = 0

        return {"success": True, "data": {
            "iqc_by_status": [{
                "status": r[0], "count": int(r[1]),
                "qty_accepted": float(r[2]), "qty_rejected": float(r[3])
            } for r in iqc],
            "per_part_yield": [{
                "part_number": p[0], "qty_accepted": float(p[1] or 0),
                "qty_rejected": float(p[2] or 0), "yield_pct": float(p[3] or 0)
            } for p in part_yield],
            "total_ncrs": int(ncr_count)
        }}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e)}, 500


# ─── PROCESS / MEMBER TRACKING ───

@analytics_bp.route("/member-activity", methods=["GET"])
def member_activity():
    """Per-member activity — audit actions, IQC inspections, GRN handovers."""
    tid = _tid()
    period = request.args.get("period", "month")
    interval = {"day": "1 day", "week": "7 days", "month": "30 days", "year": "365 days"}.get(period, "30 days")
    try:
        # Audit log activity per user
        audit_rows = db.session.execute(db.text(
            "SELECT user_name, user_email, module, COUNT(*) as actions "
            "FROM audit.logs "
            "WHERE created_at >= NOW() - INTERVAL :interval "
            "AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) "
            "GROUP BY user_name, user_email, module ORDER BY actions DESC LIMIT 50"
        ), {"tid": tid, "interval": interval}).fetchall()

        # IQC inspections per inspector
        try:
            insp_rows = db.session.execute(db.text(
                f"SELECT inspector_id, COUNT(*), SUM(qty_accepted), SUM(qty_rejected) "
                f"FROM quality.inspections "
                f"WHERE created_at >= NOW() - INTERVAL :interval "
                f"AND is_deleted=false AND {_tc()} "
                f"GROUP BY inspector_id ORDER BY COUNT(*) DESC LIMIT 20"
            ), {"tid": tid, "interval": interval}).fetchall()
        except Exception:
            db.session.rollback()
            insp_rows = []

        # GRN handovers per user
        try:
            grn_rows = db.session.execute(db.text(
                f"SELECT handover_by, COUNT(*) FROM procurement.grn "
                f"WHERE handover_at >= NOW() - INTERVAL :interval "
                f"AND is_deleted=false AND {_tc()} "
                f"GROUP BY handover_by ORDER BY COUNT(*) DESC LIMIT 20"
            ), {"tid": tid, "interval": interval}).fetchall()
        except Exception:
            db.session.rollback()
            grn_rows = []

        return {"success": True, "data": {
            "audit_activity": [{
                "user_name": r[0] or r[1] or "Unknown",
                "user_email": r[1] or "",
                "module": r[2] or "",
                "action_count": int(r[3])
            } for r in audit_rows],
            "iqc_by_inspector": [{
                "inspector": r[0] or "Unknown",
                "inspections": int(r[1]),
                "qty_accepted": float(r[2] or 0),
                "qty_rejected": float(r[3] or 0)
            } for r in insp_rows],
            "grn_handovers_by_user": [{
                "user": r[0] or "Unknown",
                "handover_count": int(r[1])
            } for r in grn_rows]
        }}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e)}, 500


# ─── FULL FLOW TRACEABILITY (per part number) ───

@analytics_bp.route("/traceability/<part_number>", methods=["GET"])
def part_traceability(part_number):
    """
    Full lifecycle of a part:
    Purchase PO → GRN → IQC → Inventory → Shipment → Customer
    """
    tid = _tid()
    tc = _tc()
    try:
        # Purchase orders for this part
        pos = db.session.execute(db.text(
            f"SELECT doc_no, supplier_name, order_qty, po_status, created_at "
            f"FROM procurement.purchase_orders "
            f"WHERE item_code=:pn AND is_deleted=false AND {tc} ORDER BY created_at DESC LIMIT 10"
        ), {"pn": part_number, "tid": tid}).fetchall()

        # GRNs
        grns = db.session.execute(db.text(
            f"SELECT g.grn_no, g.received_qty, g.grn_status, g.supplier_name, g.created_at "
            f"FROM procurement.grn g "
            f"WHERE g.item_code=:pn AND g.is_deleted=false AND {tc} ORDER BY g.created_at DESC LIMIT 10"
        ), {"pn": part_number, "tid": tid}).fetchall()

        # IQC results
        try:
            iqc = db.session.execute(db.text(
                f"SELECT doc_no, qty_accepted, qty_rejected, status, created_at "
                f"FROM quality.inspections "
                f"WHERE item_id=:pn AND type='IQC' AND is_deleted=false AND {tc} "
                f"ORDER BY created_at DESC LIMIT 10"
            ), {"pn": part_number, "tid": tid}).fetchall()
        except Exception:
            db.session.rollback()
            iqc = []

        # Current inventory
        inv = db.session.execute(db.text(
            f"SELECT warehouse_code, bin_code, qty_on_hand, qty_available, unit_cost "
            f"FROM inventory_stock_levels "
            f"WHERE part_number=:pn AND is_deleted=false AND {tc}"
        ), {"pn": part_number, "tid": tid}).fetchall()

        # Shipments
        try:
            ships = db.session.execute(db.text(
                f"SELECT s.shipment_no, s.customer_name, s.customer_po_no, "
                f"sl.qty_dispatched, sl.unit_selling, sl.profit, s.status, s.shipment_date "
                f"FROM logistics.shipment_lines sl "
                f"JOIN logistics.shipments s ON s.id=sl.shipment_id "
                f"WHERE sl.part_number=:pn AND s.is_deleted=false "
                f"AND (s.tenant_id=:tid OR s.tenant_id='' OR s.tenant_id IS NULL) "
                f"ORDER BY s.created_at DESC LIMIT 10"
            ), {"pn": part_number, "tid": tid}).fetchall()
        except Exception:
            db.session.rollback()
            ships = []

        return {"success": True, "data": {
            "part_number": part_number,
            "purchase_orders": [{
                "po_no": r[0], "supplier": r[1], "order_qty": float(r[2] or 0),
                "status": r[3], "date": str(r[4]) if r[4] else ""
            } for r in pos],
            "grns": [{
                "grn_no": r[0], "received_qty": float(r[1] or 0),
                "status": r[2], "supplier": r[3], "date": str(r[4]) if r[4] else ""
            } for r in grns],
            "iqc_results": [{
                "iqc_no": r[0], "qty_accepted": float(r[1] or 0),
                "qty_rejected": float(r[2] or 0), "result": r[3],
                "date": str(r[4]) if r[4] else ""
            } for r in iqc],
            "current_inventory": [{
                "warehouse": r[0], "bin": r[1] or "",
                "qty_on_hand": float(r[2] or 0), "qty_available": float(r[3] or 0),
                "unit_cost": float(r[4] or 0)
            } for r in inv],
            "shipments": [{
                "shipment_no": r[0], "customer": r[1], "customer_po_no": r[2],
                "qty_dispatched": float(r[3] or 0), "unit_selling": float(r[4] or 0),
                "profit": float(r[5] or 0), "status": r[6],
                "date": str(r[7]) if r[7] else ""
            } for r in ships]
        }}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e)}, 500


# ─── STOCK SENT VS REMAINING (all parts) ───

@analytics_bp.route("/stock-dispatch-summary", methods=["GET"])
def stock_dispatch_summary():
    """For every part: total received, total dispatched, currently remaining."""
    tid = _tid()
    tc = _tc()
    try:
        rows = db.session.execute(db.text(
            f"SELECT "
            f"  sl.part_number, "
            f"  COALESCE(SUM(sl.qty_dispatched), 0) as total_dispatched, "
            f"  COALESCE(inv.qty_available, 0) as qty_remaining, "
            f"  COALESCE(inv.unit_cost, 0) as unit_cost "
            f"FROM logistics.stock_dispatch_log sl "
            f"LEFT JOIN LATERAL ( "
            f"  SELECT SUM(qty_available) as qty_available, AVG(unit_cost) as unit_cost "
            f"  FROM inventory_stock_levels "
            f"  WHERE part_number=sl.part_number AND is_deleted=false AND {tc} "
            f") inv ON true "
            f"WHERE (sl.tenant_id=:tid OR sl.tenant_id='' OR sl.tenant_id IS NULL) "
            f"GROUP BY sl.part_number, inv.qty_available, inv.unit_cost "
            f"ORDER BY total_dispatched DESC"
        ), {"tid": tid}).fetchall()

        return {"success": True, "data": [{
            "part_number": r[0],
            "total_dispatched": float(r[1] or 0),
            "qty_remaining": float(r[2] or 0),
            "unit_cost": float(r[3] or 0),
            "remaining_value": round(float(r[2] or 0) * float(r[3] or 0), 2)
        } for r in rows]}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": str(e)}, 500
