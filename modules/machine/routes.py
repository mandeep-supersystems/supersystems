from flask import Blueprint, request
from extensions import db
import uuid

machine_bp = Blueprint("machine", __name__)


def _tid(): return request.headers.get("X-Tenant-ID", "")
def _by(): return request.headers.get("X-User-Name", "") or request.headers.get("X-User-Email", "")
def _f(v): 
    try: return float(v) if v not in (None, "", " ") else 0
    except: return 0

def _log(action, etype, eid):
    try:
        db.session.execute(db.text(
            "INSERT INTO audit.logs (id,action,module,entity_type,entity_id,ip_address,tenant_id,user_email,user_name,created_at) "
            "VALUES (gen_random_uuid(),:action,'Machine Management',:etype,:eid,:ip,:tid,:email,:name,NOW())"
        ), {"action": action, "etype": etype, "eid": str(eid), "ip": request.remote_addr or "",
            "tid": _tid(), "email": request.headers.get("X-User-Email",""), "name": _by()})
    except: pass


def _calc_mhr(m):
    """Calculate MHR breakdown from machine master data."""
    purchase_cost = _f(m.get("purchase_cost"))
    residual = _f(m.get("residual_value"))
    life_years = _f(m.get("depreciation_life_years")) or 10
    hours_per_day = _f(m.get("max_hours_per_day")) or 8
    shifts = _f(m.get("shifts_per_day")) or 1
    working_days = _f(m.get("working_days_per_year")) or 250
    power_kw = _f(m.get("power_rating_kw"))
    elec_rate = _f(m.get("electricity_rate"))
    amc_cost = _f(m.get("annual_amc_cost"))
    operator_cost = _f(m.get("operator_cost_per_hour"))
    overhead_pct = _f(m.get("overhead_percent"))

    working_hours_year = hours_per_day * shifts * working_days
    if working_hours_year == 0: working_hours_year = 2000

    dep_per_hour = (purchase_cost - residual) / (life_years * working_hours_year) if life_years > 0 else 0
    power_per_hour = power_kw * elec_rate
    maint_per_hour = amc_cost / working_hours_year if working_hours_year > 0 else 0
    subtotal = dep_per_hour + power_per_hour + maint_per_hour + operator_cost
    overhead_per_hour = subtotal * overhead_pct / 100
    mhr = subtotal + overhead_per_hour

    return {
        "working_hours_year": round(working_hours_year, 2),
        "depreciation_per_hour": round(dep_per_hour, 4),
        "power_per_hour": round(power_per_hour, 4),
        "maintenance_per_hour": round(maint_per_hour, 4),
        "operator_per_hour": round(operator_cost, 4),
        "overhead_per_hour": round(overhead_per_hour, 4),
        "mhr": round(mhr, 4)
    }


# ─── STATIONS ───

@machine_bp.route("/stations", methods=["GET"])
def list_stations():
    rows = db.session.execute(db.text(
        "SELECT id,station_code,station_name,plant,description,created_at FROM machine.stations "
        "WHERE (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) AND is_deleted=false ORDER BY station_name"
    ), {"tid": _tid()}).fetchall()
    return {"success": True, "data": [{"id": str(r[0]), "station_code": r[1], "station_name": r[2],
        "plant": r[3] or "", "description": r[4] or "", "created_at": str(r[5]) if r[5] else None} for r in rows]}


@machine_bp.route("/stations", methods=["POST"])
def create_station():
    d = request.get_json() or {}
    if not d.get("station_name"): return {"success": False, "message": "Station name required"}, 400
    sid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO machine.stations (id,station_code,station_name,plant,description,tenant_id,created_by) "
        "VALUES (:id,:code,:name,:plant,:desc,:tid,:by)"
    ), {"id": sid, "code": d.get("station_code",""), "name": d["station_name"],
        "plant": d.get("plant",""), "desc": d.get("description",""), "tid": _tid(), "by": _by()})
    _log("CREATE", "Station", sid)
    db.session.commit()
    return {"success": True, "data": {"id": sid}, "message": "Station created"}, 201


@machine_bp.route("/stations/<sid>", methods=["PUT"])
def update_station(sid):
    d = request.get_json() or {}
    upd, p = [], {"id": sid}
    for f in ["station_code","station_name","plant","description"]:
        if f in d: upd.append(f"{f}=:{f}"); p[f] = d[f]
    if not upd: return {"success": False, "message": "Nothing to update"}, 400
    upd.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE machine.stations SET {','.join(upd)} WHERE id=:id"), p)
    _log("UPDATE", "Station", sid); db.session.commit()
    return {"success": True, "message": "Station updated"}


@machine_bp.route("/stations/<sid>", methods=["DELETE"])
def delete_station(sid):
    db.session.execute(db.text("UPDATE machine.stations SET is_deleted=true WHERE id=:id"), {"id": sid})
    _log("DELETE", "Station", sid); db.session.commit()
    return {"success": True, "message": "Station deleted"}


# ─── MACHINES ───

MACHINE_FIELDS = ["machine_code","machine_name","machine_type","make","model",
    "purchase_cost","buying_date","vendor","invoice_ref","warranty_expiry","amc_expiry",
    "depreciation_life_years","residual_value","installation_date","current_status",
    "plant","station_id","rated_capacity","capacity_unit","power_rating_kw",
    "max_hours_per_day","shifts_per_day","working_days_per_year",
    "electricity_rate","annual_amc_cost","operator_cost_per_hour","overhead_percent","notes"]

def _row_to_dict(r):
    keys = ["id","machine_code","machine_name","machine_type","make","model",
            "purchase_cost","buying_date","vendor","invoice_ref","warranty_expiry","amc_expiry",
            "depreciation_life_years","residual_value","installation_date","current_status",
            "plant","station_id","rated_capacity","capacity_unit","power_rating_kw",
            "max_hours_per_day","shifts_per_day","working_days_per_year",
            "electricity_rate","annual_amc_cost","operator_cost_per_hour","overhead_percent",
            "notes","created_by","created_at","updated_at","station_name"]
    d = {}
    for i, k in enumerate(keys):
        v = r[i] if i < len(r) else None
        if hasattr(v, "isoformat"): d[k] = v.isoformat()
        elif hasattr(v, "__str__") and k == "id": d[k] = str(v)
        elif hasattr(v, "__str__") and k == "station_id": d[k] = str(v) if v else None
        else: d[k] = v
    return d


@machine_bp.route("/machines", methods=["GET"])
def list_machines():
    rows = db.session.execute(db.text(
        "SELECT m.id,m.machine_code,m.machine_name,m.machine_type,m.make,m.model,"
        "m.purchase_cost,m.buying_date,m.vendor,m.invoice_ref,m.warranty_expiry,m.amc_expiry,"
        "m.depreciation_life_years,m.residual_value,m.installation_date,m.current_status,"
        "m.plant,m.station_id,m.rated_capacity,m.capacity_unit,m.power_rating_kw,"
        "m.max_hours_per_day,m.shifts_per_day,m.working_days_per_year,"
        "m.electricity_rate,m.annual_amc_cost,m.operator_cost_per_hour,m.overhead_percent,"
        "m.notes,m.created_by,m.created_at,m.updated_at,s.station_name "
        "FROM machine.machines m LEFT JOIN machine.stations s ON m.station_id=s.id "
        "WHERE (m.tenant_id=:tid OR m.tenant_id='' OR m.tenant_id IS NULL) AND m.is_deleted=false "
        "ORDER BY m.machine_name"
    ), {"tid": _tid()}).fetchall()
    result = []
    for r in rows:
        d = _row_to_dict(r)
        d["mhr"] = _calc_mhr(d)["mhr"]
        result.append(d)
    return {"success": True, "data": result}


@machine_bp.route("/machines/<mid>", methods=["GET"])
def get_machine(mid):
    r = db.session.execute(db.text(
        "SELECT m.id,m.machine_code,m.machine_name,m.machine_type,m.make,m.model,"
        "m.purchase_cost,m.buying_date,m.vendor,m.invoice_ref,m.warranty_expiry,m.amc_expiry,"
        "m.depreciation_life_years,m.residual_value,m.installation_date,m.current_status,"
        "m.plant,m.station_id,m.rated_capacity,m.capacity_unit,m.power_rating_kw,"
        "m.max_hours_per_day,m.shifts_per_day,m.working_days_per_year,"
        "m.electricity_rate,m.annual_amc_cost,m.operator_cost_per_hour,m.overhead_percent,"
        "m.notes,m.created_by,m.created_at,m.updated_at,s.station_name "
        "FROM machine.machines m LEFT JOIN machine.stations s ON m.station_id=s.id "
        "WHERE m.id=:id AND m.is_deleted=false"
    ), {"id": mid}).first()
    if not r: return {"success": False, "message": "Machine not found"}, 404
    d = _row_to_dict(r)
    d["mhr_breakdown"] = _calc_mhr(d)
    # efficiency history
    eff = db.session.execute(db.text(
        "SELECT id,period,availability_pct,performance_pct,quality_pct,oee_pct,notes,created_at "
        "FROM machine.efficiency WHERE machine_id=:mid AND is_deleted=false ORDER BY created_at DESC LIMIT 20"
    ), {"mid": mid}).fetchall()
    d["efficiency_history"] = [{"id": str(e[0]),"period": e[1],"availability_pct": _f(e[2]),
        "performance_pct": _f(e[3]),"quality_pct": _f(e[4]),"oee_pct": _f(e[5]),
        "notes": e[6] or "","created_at": str(e[7]) if e[7] else None} for e in eff]
    return {"success": True, "data": d}


@machine_bp.route("/machines", methods=["POST"])
def create_machine():
    d = request.get_json() or {}
    if not d.get("machine_name"): return {"success": False, "message": "Machine name required"}, 400
    mid = str(uuid.uuid4())
    # Auto-generate code if empty
    if not d.get("machine_code"):
        cnt = db.session.execute(db.text(
            "SELECT COUNT(*) FROM machine.machines WHERE (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL)"
        ), {"tid": _tid()}).scalar() or 0
        d["machine_code"] = f"MCH{cnt+1:04d}"
    db.session.execute(db.text(
        "INSERT INTO machine.machines (id,machine_code,machine_name,machine_type,make,model,"
        "purchase_cost,buying_date,vendor,invoice_ref,warranty_expiry,amc_expiry,"
        "depreciation_life_years,residual_value,installation_date,current_status,"
        "plant,station_id,rated_capacity,capacity_unit,power_rating_kw,"
        "max_hours_per_day,shifts_per_day,working_days_per_year,"
        "electricity_rate,annual_amc_cost,operator_cost_per_hour,overhead_percent,notes,tenant_id,created_by) "
        "VALUES (:id,:code,:name,:mtype,:make,:model,:cost,:bdate,:vendor,:inv,:warr,:amc,"
        ":dep_life,:resid,:inst,:status,:plant,:station,:cap,:cap_unit,:power,"
        ":hrs,:shifts,:days,:elec,:amc_cost,:op_cost,:overhead,:notes,:tid,:by)"
    ), {"id": mid, "code": d.get("machine_code",""), "name": d["machine_name"],
        "mtype": d.get("machine_type",""), "make": d.get("make",""), "model": d.get("model",""),
        "cost": d.get("purchase_cost") or 0, "bdate": d.get("buying_date") or None,
        "vendor": d.get("vendor",""), "inv": d.get("invoice_ref",""),
        "warr": d.get("warranty_expiry") or None, "amc": d.get("amc_expiry") or None,
        "dep_life": d.get("depreciation_life_years") or 10, "resid": d.get("residual_value") or 0,
        "inst": d.get("installation_date") or None, "status": d.get("current_status","active"),
        "plant": d.get("plant",""), "station": d.get("station_id") or None,
        "cap": d.get("rated_capacity") or 0, "cap_unit": d.get("capacity_unit",""),
        "power": d.get("power_rating_kw") or 0, "hrs": d.get("max_hours_per_day") or 8,
        "shifts": d.get("shifts_per_day") or 1, "days": d.get("working_days_per_year") or 250,
        "elec": d.get("electricity_rate") or 0, "amc_cost": d.get("annual_amc_cost") or 0,
        "op_cost": d.get("operator_cost_per_hour") or 0, "overhead": d.get("overhead_percent") or 0,
        "notes": d.get("notes",""), "tid": _tid(), "by": _by()})
    _log("CREATE", "Machine", mid); db.session.commit()
    return {"success": True, "data": {"id": mid, "machine_code": d["machine_code"]}, "message": "Machine created"}, 201


@machine_bp.route("/machines/<mid>", methods=["PUT"])
def update_machine(mid):
    d = request.get_json() or {}
    upd, p = [], {"id": mid}
    for f in MACHINE_FIELDS:
        if f in d:
            upd.append(f"{f}=:{f}")
            p[f] = d[f] if d[f] != "" else None
    if not upd: return {"success": False, "message": "Nothing to update"}, 400
    upd.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE machine.machines SET {','.join(upd)} WHERE id=:id"), p)
    _log("UPDATE", "Machine", mid); db.session.commit()
    return {"success": True, "message": "Machine updated"}


@machine_bp.route("/machines/<mid>", methods=["DELETE"])
def delete_machine(mid):
    db.session.execute(db.text("UPDATE machine.machines SET is_deleted=true,updated_at=NOW() WHERE id=:id"), {"id": mid})
    _log("DELETE", "Machine", mid); db.session.commit()
    return {"success": True, "message": "Machine deleted"}


@machine_bp.route("/machines/<mid>/mhr", methods=["GET"])
def get_mhr(mid):
    r = db.session.execute(db.text(
        "SELECT purchase_cost,residual_value,depreciation_life_years,max_hours_per_day,"
        "shifts_per_day,working_days_per_year,power_rating_kw,electricity_rate,"
        "annual_amc_cost,operator_cost_per_hour,overhead_percent "
        "FROM machine.machines WHERE id=:id AND is_deleted=false"
    ), {"id": mid}).first()
    if not r: return {"success": False, "message": "Machine not found"}, 404
    keys = ["purchase_cost","residual_value","depreciation_life_years","max_hours_per_day",
            "shifts_per_day","working_days_per_year","power_rating_kw","electricity_rate",
            "annual_amc_cost","operator_cost_per_hour","overhead_percent"]
    m = dict(zip(keys, r))
    return {"success": True, "data": _calc_mhr(m)}


# ─── EFFICIENCY ───

@machine_bp.route("/machines/<mid>/efficiency", methods=["POST"])
def add_efficiency(mid):
    d = request.get_json() or {}
    avail = _f(d.get("availability_pct", 100))
    perf = _f(d.get("performance_pct", 100))
    qual = _f(d.get("quality_pct", 100))
    oee = round(avail * perf * qual / 10000, 2)
    eid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO machine.efficiency (id,machine_id,period,availability_pct,performance_pct,quality_pct,oee_pct,notes,tenant_id,created_by) "
        "VALUES (:id,:mid,:period,:avail,:perf,:qual,:oee,:notes,:tid,:by)"
    ), {"id": eid, "mid": mid, "period": d.get("period",""), "avail": avail, "perf": perf,
        "qual": qual, "oee": oee, "notes": d.get("notes",""), "tid": _tid(), "by": _by()})
    _log("CREATE", "Machine Efficiency", eid); db.session.commit()
    return {"success": True, "data": {"id": eid, "oee_pct": oee}, "message": "Efficiency recorded"}, 201


@machine_bp.route("/machines/<mid>/efficiency/<eid>", methods=["DELETE"])
def delete_efficiency(mid, eid):
    db.session.execute(db.text("UPDATE machine.efficiency SET is_deleted=true WHERE id=:id"), {"id": eid})
    _log("DELETE", "Machine Efficiency", eid); db.session.commit()
    return {"success": True, "message": "Efficiency record deleted"}


# ─── SEARCH (for workflow step machine picker) ───

@machine_bp.route("/search", methods=["GET"])
def search_machines():
    q = request.args.get("q","").strip()
    rows = db.session.execute(db.text(
        "SELECT id,machine_code,machine_name,machine_type,current_status FROM machine.machines "
        "WHERE (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) AND is_deleted=false "
        + ("AND (LOWER(machine_name) LIKE LOWER(:q) OR LOWER(machine_code) LIKE LOWER(:q)) " if q else "")
        + "ORDER BY machine_name LIMIT 30"
    ), {"tid": _tid(), **( {"q": f"%{q}%"} if q else {})}).fetchall()
    return {"success": True, "data": [{"id": str(r[0]),"machine_code": r[1],"machine_name": r[2],
        "machine_type": r[3] or "","current_status": r[4] or "active"} for r in rows]}
