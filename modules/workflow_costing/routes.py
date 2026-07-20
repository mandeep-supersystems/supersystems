from flask import Blueprint, request
from extensions import db
import uuid

workflow_bp = Blueprint("workflow_costing", __name__)


def _tid(): return request.headers.get("X-Tenant-ID", "")
def _by(): return request.headers.get("X-User-Name", "") or request.headers.get("X-User-Email", "")
def _f(v):
    try: return float(v) if v not in (None, "", " ") else 0
    except: return 0

def _log(action, etype, eid):
    try:
        db.session.execute(db.text(
            "INSERT INTO audit.logs (id,action,module,entity_type,entity_id,ip_address,tenant_id,user_email,user_name,created_at) "
            "VALUES (gen_random_uuid(),:action,'Workflow & Costing',:etype,:eid,:ip,:tid,:email,:name,NOW())"
        ), {"action": action, "etype": etype, "eid": str(eid), "ip": request.remote_addr or "",
            "tid": _tid(), "email": request.headers.get("X-User-Email",""), "name": _by()})
    except: pass


def _get_mhr(machine_id):
    """Fetch MHR for a machine from its master data."""
    r = db.session.execute(db.text(
        "SELECT purchase_cost,residual_value,depreciation_life_years,max_hours_per_day,"
        "shifts_per_day,working_days_per_year,power_rating_kw,electricity_rate,"
        "annual_amc_cost,operator_cost_per_hour,overhead_percent "
        "FROM machine.machines WHERE id=:id AND is_deleted=false"
    ), {"id": machine_id}).first()
    if not r: return 0
    keys = ["purchase_cost","residual_value","depreciation_life_years","max_hours_per_day",
            "shifts_per_day","working_days_per_year","power_rating_kw","electricity_rate",
            "annual_amc_cost","operator_cost_per_hour","overhead_percent"]
    m = dict(zip(keys, r))
    wh = _f(m["max_hours_per_day"]) * _f(m["shifts_per_day"]) * _f(m["working_days_per_year"]) or 2000
    life = _f(m["depreciation_life_years"]) or 10
    dep = (_f(m["purchase_cost"]) - _f(m["residual_value"])) / (life * wh)
    power = _f(m["power_rating_kw"]) * _f(m["electricity_rate"])
    maint = _f(m["annual_amc_cost"]) / wh
    sub = dep + power + maint + _f(m["operator_cost_per_hour"])
    overhead = sub * _f(m["overhead_percent"]) / 100
    return round(sub + overhead, 4)


# ─── ROUTINGS ───

@workflow_bp.route("/routings", methods=["GET"])
def list_routings():
    q = request.args.get("q","").strip()
    where = "(tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) AND is_deleted=false"
    p = {"tid": _tid()}
    if q:
        where += " AND (LOWER(part_number) LIKE LOWER(:q) OR LOWER(part_description) LIKE LOWER(:q))"
        p["q"] = f"%{q}%"
    rows = db.session.execute(db.text(
        f"SELECT id,part_number,part_description,revision,status,notes,created_by,created_at,updated_at "
        f"FROM workflow.routings WHERE {where} ORDER BY updated_at DESC"
    ), p).fetchall()
    return {"success": True, "data": [{"id": str(r[0]),"part_number": r[1],"part_description": r[2] or "",
        "revision": r[3] or "1","status": r[4] or "draft","notes": r[5] or "",
        "created_by": r[6] or "","created_at": str(r[7]) if r[7] else None,
        "updated_at": str(r[8]) if r[8] else None} for r in rows]}


@workflow_bp.route("/routings/<rid>", methods=["GET"])
def get_routing(rid):
    r = db.session.execute(db.text(
        "SELECT id,part_number,part_description,revision,status,notes,created_by,created_at,updated_at "
        "FROM workflow.routings WHERE id=:id AND is_deleted=false"
    ), {"id": rid}).first()
    if not r: return {"success": False, "message": "Routing not found"}, 404

    steps = db.session.execute(db.text(
        "SELECT id,process_no,subprocess_no,step_code,step_name,description,created_at "
        "FROM workflow.routing_steps WHERE routing_id=:rid AND is_deleted=false "
        "ORDER BY process_no, COALESCE(subprocess_no,0)"
    ), {"rid": rid}).fetchall()

    step_list = []
    for s in steps:
        step_id = str(s[0])
        machines = db.session.execute(db.text(
            "SELECT sm.id,sm.machine_id,m.machine_code,m.machine_name,m.machine_type,"
            "sm.cycle_time_minutes,sm.is_preferred,sm.notes,"
            "m.purchase_cost,m.residual_value,m.depreciation_life_years,m.max_hours_per_day,"
            "m.shifts_per_day,m.working_days_per_year,m.power_rating_kw,m.electricity_rate,"
            "m.annual_amc_cost,m.operator_cost_per_hour,m.overhead_percent "
            "FROM workflow.step_machines sm JOIN machine.machines m ON sm.machine_id=m.id "
            "WHERE sm.step_id=:sid AND sm.is_deleted=false"
        ), {"sid": step_id}).fetchall()

        machine_list = []
        for mc in machines:
            mhr = _get_mhr(str(mc[1]))
            ct = _f(mc[5])
            cost = round(mhr * ct / 60, 4)
            machine_list.append({
                "id": str(mc[0]), "machine_id": str(mc[1]),
                "machine_code": mc[2], "machine_name": mc[3], "machine_type": mc[4] or "",
                "cycle_time_minutes": ct, "is_preferred": bool(mc[6]),
                "notes": mc[7] or "", "mhr": mhr, "cost_per_cycle": cost
            })

        subprocess_no = s[2]
        step_code = f"{s[1]:02d}" + (f".{subprocess_no:02d}" if subprocess_no else "")
        step_list.append({
            "id": step_id, "process_no": s[1], "subprocess_no": subprocess_no,
            "step_code": step_code, "step_name": s[4], "description": s[5] or "",
            "created_at": str(s[6]) if s[6] else None, "machines": machine_list
        })

    return {"success": True, "data": {
        "routing": {"id": str(r[0]),"part_number": r[1],"part_description": r[2] or "",
            "revision": r[3] or "1","status": r[4] or "draft","notes": r[5] or "",
            "created_by": r[6] or "","created_at": str(r[7]) if r[7] else None},
        "steps": step_list
    }}


@workflow_bp.route("/routings", methods=["POST"])
def create_routing():
    d = request.get_json() or {}
    if not d.get("part_number"): return {"success": False, "message": "part_number required"}, 400
    # Check uniqueness
    existing = db.session.execute(db.text(
        "SELECT id FROM workflow.routings WHERE part_number=:pn AND (tenant_id=:tid OR tenant_id='' OR tenant_id IS NULL) AND is_deleted=false"
    ), {"pn": d["part_number"], "tid": _tid()}).first()
    if existing: return {"success": False, "message": "Routing already exists for this part", "data": {"id": str(existing[0])}}, 409
    rid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO workflow.routings (id,part_number,part_description,revision,status,notes,tenant_id,created_by) "
        "VALUES (:id,:pn,:desc,:rev,:status,:notes,:tid,:by)"
    ), {"id": rid, "pn": d["part_number"], "desc": d.get("part_description",""),
        "rev": d.get("revision","1"), "status": d.get("status","draft"),
        "notes": d.get("notes",""), "tid": _tid(), "by": _by()})
    _log("CREATE", "Routing", rid); db.session.commit()
    return {"success": True, "data": {"id": rid}, "message": "Routing created"}, 201


@workflow_bp.route("/routings/<rid>", methods=["PUT"])
def update_routing(rid):
    d = request.get_json() or {}
    upd, p = [], {"id": rid}
    for f in ["part_description","revision","status","notes"]:
        if f in d: upd.append(f"{f}=:{f}"); p[f] = d[f]
    if not upd: return {"success": False, "message": "Nothing to update"}, 400
    upd.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE workflow.routings SET {','.join(upd)} WHERE id=:id"), p)
    _log("UPDATE", "Routing", rid); db.session.commit()
    return {"success": True, "message": "Routing updated"}


@workflow_bp.route("/routings/<rid>", methods=["DELETE"])
def delete_routing(rid):
    db.session.execute(db.text("UPDATE workflow.routings SET is_deleted=true,updated_at=NOW() WHERE id=:id"), {"id": rid})
    _log("DELETE", "Routing", rid); db.session.commit()
    return {"success": True, "message": "Routing deleted"}


# ─── ROUTING STEPS ───

@workflow_bp.route("/routings/<rid>/steps", methods=["POST"])
def add_step(rid):
    d = request.get_json() or {}
    pno = int(d.get("process_no", 0))
    sno = d.get("subprocess_no")
    sno = int(sno) if sno else None
    if not (1 <= pno <= 80): return {"success": False, "message": "process_no must be 1–80"}, 400
    if sno is not None and not (1 <= sno <= 80): return {"success": False, "message": "subprocess_no must be 1–80"}, 400
    if not d.get("step_name"): return {"success": False, "message": "step_name required"}, 400
    # Check uniqueness
    existing = db.session.execute(db.text(
        "SELECT id FROM workflow.routing_steps WHERE routing_id=:rid AND process_no=:pno AND subprocess_no IS NOT DISTINCT FROM :sno AND is_deleted=false"
    ), {"rid": rid, "pno": pno, "sno": sno}).first()
    if existing: return {"success": False, "message": f"Step {pno}.{sno or '-'} already exists"}, 409
    step_code = f"{pno:02d}" + (f".{sno:02d}" if sno else "")
    sid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO workflow.routing_steps (id,routing_id,process_no,subprocess_no,step_code,step_name,description) "
        "VALUES (:id,:rid,:pno,:sno,:code,:name,:desc)"
    ), {"id": sid, "rid": rid, "pno": pno, "sno": sno, "code": step_code,
        "name": d["step_name"], "desc": d.get("description","")})
    db.session.execute(db.text("UPDATE workflow.routings SET updated_at=NOW() WHERE id=:id"), {"id": rid})
    _log("CREATE", "Routing Step", sid); db.session.commit()
    return {"success": True, "data": {"id": sid, "step_code": step_code}, "message": "Step added"}, 201


@workflow_bp.route("/routings/<rid>/steps/<sid>", methods=["PUT"])
def update_step(rid, sid):
    d = request.get_json() or {}
    upd, p = [], {"id": sid}
    for f in ["step_name","description"]:
        if f in d: upd.append(f"{f}=:{f}"); p[f] = d[f]
    if not upd: return {"success": False, "message": "Nothing to update"}, 400
    upd.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE workflow.routing_steps SET {','.join(upd)} WHERE id=:id"), p)
    _log("UPDATE", "Routing Step", sid); db.session.commit()
    return {"success": True, "message": "Step updated"}


@workflow_bp.route("/routings/<rid>/steps/<sid>", methods=["DELETE"])
def delete_step(rid, sid):
    db.session.execute(db.text("UPDATE workflow.routing_steps SET is_deleted=true,updated_at=NOW() WHERE id=:id"), {"id": sid})
    _log("DELETE", "Routing Step", sid); db.session.commit()
    return {"success": True, "message": "Step deleted"}


# ─── STEP MACHINES ───

@workflow_bp.route("/steps/<sid>/machines", methods=["POST"])
def add_step_machine(sid):
    d = request.get_json() or {}
    if not d.get("machine_id"): return {"success": False, "message": "machine_id required"}, 400
    existing = db.session.execute(db.text(
        "SELECT id FROM workflow.step_machines WHERE step_id=:sid AND machine_id=:mid AND is_deleted=false"
    ), {"sid": sid, "mid": d["machine_id"]}).first()
    if existing: return {"success": False, "message": "This machine is already assigned to this step"}, 409
    smid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO workflow.step_machines (id,step_id,machine_id,cycle_time_minutes,is_preferred,notes) "
        "VALUES (:id,:sid,:mid,:ct,:pref,:notes)"
    ), {"id": smid, "sid": sid, "mid": d["machine_id"],
        "ct": d.get("cycle_time_minutes") or 0, "pref": d.get("is_preferred", False),
        "notes": d.get("notes","")})
    _log("CREATE", "Step Machine", smid); db.session.commit()
    return {"success": True, "data": {"id": smid}, "message": "Machine assigned to step"}, 201


@workflow_bp.route("/steps/<sid>/machines/<smid>", methods=["PUT"])
def update_step_machine(sid, smid):
    d = request.get_json() or {}
    upd, p = [], {"id": smid}
    for f in ["cycle_time_minutes","is_preferred","notes"]:
        if f in d: upd.append(f"{f}=:{f}"); p[f] = d[f]
    if not upd: return {"success": False, "message": "Nothing to update"}, 400
    upd.append("updated_at=NOW()")
    db.session.execute(db.text(f"UPDATE workflow.step_machines SET {','.join(upd)} WHERE id=:id"), p)
    _log("UPDATE", "Step Machine", smid); db.session.commit()
    return {"success": True, "message": "Updated"}


@workflow_bp.route("/steps/<sid>/machines/<smid>", methods=["DELETE"])
def delete_step_machine(sid, smid):
    db.session.execute(db.text("UPDATE workflow.step_machines SET is_deleted=true,updated_at=NOW() WHERE id=:id"), {"id": smid})
    _log("DELETE", "Step Machine", smid); db.session.commit()
    return {"success": True, "message": "Machine removed from step"}


# ─── COSTING ───

@workflow_bp.route("/routings/<rid>/cost", methods=["GET"])
def get_routing_cost(rid):
    """Full cost breakdown for a routing — per step, per machine option."""
    r = db.session.execute(db.text(
        "SELECT id,part_number,part_description FROM workflow.routings WHERE id=:id AND is_deleted=false"
    ), {"id": rid}).first()
    if not r: return {"success": False, "message": "Routing not found"}, 404

    steps = db.session.execute(db.text(
        "SELECT id,process_no,subprocess_no,step_code,step_name FROM workflow.routing_steps "
        "WHERE routing_id=:rid AND is_deleted=false ORDER BY process_no,COALESCE(subprocess_no,0)"
    ), {"rid": rid}).fetchall()

    total_preferred = 0
    step_costs = []
    for s in steps:
        machines = db.session.execute(db.text(
            "SELECT sm.id,sm.machine_id,m.machine_code,m.machine_name,sm.cycle_time_minutes,sm.is_preferred "
            "FROM workflow.step_machines sm JOIN machine.machines m ON sm.machine_id=m.id "
            "WHERE sm.step_id=:sid AND sm.is_deleted=false"
        ), {"sid": str(s[0])}).fetchall()
        mc_costs = []
        preferred_cost = None
        for mc in machines:
            mhr = _get_mhr(str(mc[1]))
            ct = _f(mc[4])
            cost = round(mhr * ct / 60, 4)
            mc_costs.append({"machine_id": str(mc[1]),"machine_code": mc[2],"machine_name": mc[3],
                "cycle_time_minutes": ct,"mhr": mhr,"cost": cost,"is_preferred": bool(mc[5])})
            if mc[5]: preferred_cost = cost
        if preferred_cost is None and mc_costs:
            preferred_cost = min(c["cost"] for c in mc_costs)
        total_preferred += preferred_cost or 0
        step_costs.append({"step_id": str(s[0]),"step_code": s[3],"step_name": s[4],
            "machine_options": mc_costs,"preferred_cost": preferred_cost or 0})

    return {"success": True, "data": {
        "part_number": r[1], "part_description": r[2] or "",
        "steps": step_costs, "total_manufacturing_cost": round(total_preferred, 4)
    }}


# ─── PART SEARCH (for routing creation) ───

@workflow_bp.route("/search-parts", methods=["GET"])
def search_manufactured_parts():
    """Search parts with part_type = manufactured across all part tables."""
    tid = _tid()
    q = request.args.get("q","").strip()
    if not q or len(q) < 2: return {"success": True, "data": []}
    import re as _re
    subs = db.session.execute(db.text(
        "SELECT s.name,s.series_prefix,c.name as cat_name,c.series_prefix as cat_series "
        "FROM part.subcategories s JOIN part.categories c ON s.category_id=c.id "
        "WHERE s.tenant_id=:tid AND s.is_deleted=false"
    ), {"tid": tid}).fetchall()
    results = []
    for sub in subs:
        def clean(s): return _re.sub(r'[^a-z0-9]','_',s.lower().strip()).strip('_')
        tname = f'part."{clean(sub[2])}_{clean(sub[0])}_{sub[3]}_{sub[1]}"'
        try:
            rows = db.session.execute(db.text(
                f"SELECT part_number,COALESCE(description,''),COALESCE(part_type,'bought_out') FROM {tname} "
                f"WHERE (LOWER(part_number) LIKE LOWER(:q) OR LOWER(COALESCE(description,'')) LIKE LOWER(:q)) "
                f"AND status='active' AND COALESCE(part_type,'bought_out')='manufactured' LIMIT 10"
            ), {"q": f"%{q}%"})
            for r in rows:
                results.append({"part_number": r[0],"description": r[1],"part_type": r[2]})
        except: db.session.rollback()
    return {"success": True, "data": results[:20]}
