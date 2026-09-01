from flask import Blueprint, request
from extensions import db
import uuid, json

hr_recruitment_bp = Blueprint("hr_recruitment", __name__)


def _log(action, etype, eid, new=None):
    try:
        ip = (request.headers.get('X-Forwarded-For', '') or request.remote_addr or '').split(',')[0].strip()
        db.session.execute(db.text(
            "INSERT INTO audit.logs (id, action, module, entity_type, entity_id, ip_address, "
            "tenant_id, user_email, user_name, extra_data, created_at) "
            "VALUES (gen_random_uuid(), :action, 'HR', :etype, :eid, :ip, :tid, :email, :name, :extra, NOW())"
        ), {"action": action, "etype": etype, "eid": str(eid), "ip": ip,
            "tid": request.headers.get('X-Tenant-ID', ''),
            "email": request.headers.get('X-User-Email', ''),
            "name": request.headers.get('X-User-Name', ''),
            "extra": json.dumps({"new": new}) if new else None})
    except Exception:
        pass


def _err(e):
    db.session.rollback()
    return {"success": False, "message": str(e), "data": []}, 500


# ─── JOB REQUISITIONS ───
@hr_recruitment_bp.route("/job-requisitions", methods=["GET"])
def list_requisitions():
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        rows = db.session.execute(db.text(
            "SELECT id, title, department, vacancies, employment_type, location, status, "
            "requested_by, target_date, created_at FROM hr.job_requisitions "
            "WHERE tenant_id=:tid AND is_deleted=false ORDER BY created_at DESC"
        ), {"tid": tid}).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "title": r[1], "department": r[2] or '', "vacancies": r[3],
             "employment_type": r[4], "location": r[5] or '', "status": r[6],
             "requested_by": r[7] or '', "target_date": str(r[8]) if r[8] else None,
             "created_at": str(r[9]) if r[9] else None}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_recruitment_bp.route("/job-requisitions", methods=["POST"])
def create_requisition():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    if not data.get("title"):
        return {"success": False, "message": "Title is required"}, 400
    try:
        rid = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO hr.job_requisitions (id, title, department, vacancies, employment_type, "
            "location, description, requirements, status, requested_by, target_date, tenant_id) "
            "VALUES (:id, :title, :dept, :vac, :etype, :loc, :desc, :req, 'open', :by, :target, :tid)"
        ), {"id": rid, "title": data["title"], "dept": data.get("department", ""),
            "vac": data.get("vacancies", 1), "etype": data.get("employment_type", "full_time"),
            "loc": data.get("location", ""), "desc": data.get("description", ""),
            "req": json.dumps(data.get("requirements", [])),
            "by": request.headers.get('X-User-Name', ''),
            "target": data.get("target_date"), "tid": tid})
        db.session.commit()
        _log('CREATE', 'Job Requisition', data['title'], new=data)
        return {"success": True, "data": {"id": rid}, "message": "Job requisition created"}, 201
    except Exception as e:
        return _err(e)


@hr_recruitment_bp.route("/job-requisitions/<rid>", methods=["PUT"])
def update_requisition(rid):
    data = request.get_json()
    try:
        db.session.execute(db.text(
            "UPDATE hr.job_requisitions SET title=:title, department=:dept, vacancies=:vac, "
            "employment_type=:etype, location=:loc, description=:desc, status=:status, "
            "target_date=:target, updated_at=NOW() WHERE id=:id"
        ), {"id": rid, "title": data.get("title"), "dept": data.get("department", ""),
            "vac": data.get("vacancies", 1), "etype": data.get("employment_type", "full_time"),
            "loc": data.get("location", ""), "desc": data.get("description", ""),
            "status": data.get("status", "open"), "target": data.get("target_date")})
        db.session.commit()
        _log('UPDATE', 'Job Requisition', rid, new=data)
        return {"success": True, "message": "Requisition updated"}
    except Exception as e:
        return _err(e)


@hr_recruitment_bp.route("/job-requisitions/<rid>", methods=["DELETE"])
def delete_requisition(rid):
    try:
        db.session.execute(db.text(
            "UPDATE hr.job_requisitions SET is_deleted=true, updated_at=NOW() WHERE id=:id"
        ), {"id": rid})
        db.session.commit()
        _log('DELETE', 'Job Requisition', rid)
        return {"success": True, "message": "Requisition deleted"}
    except Exception as e:
        return _err(e)


# ─── CANDIDATES ───
@hr_recruitment_bp.route("/candidates", methods=["GET"])
def list_candidates():
    tid = request.headers.get("X-Tenant-ID", "")
    req_id = request.args.get("requisition_id")
    stage = request.args.get("stage")
    where = "WHERE tenant_id=:tid AND is_deleted=false"
    params = {"tid": tid}
    if req_id:
        where += " AND requisition_id=:req"
        params["req"] = req_id
    if stage:
        where += " AND stage=:stage"
        params["stage"] = stage
    try:
        rows = db.session.execute(db.text(
            f"SELECT id, requisition_id, first_name, last_name, email, phone, "
            f"current_company, current_designation, experience_years, source, stage, rating, created_at "
            f"FROM hr.candidates {where} ORDER BY created_at DESC"
        ), params).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "requisition_id": str(r[1]) if r[1] else None,
             "first_name": r[2], "last_name": r[3] or '', "email": r[4] or '', "phone": r[5] or '',
             "current_company": r[6] or '', "current_designation": r[7] or '',
             "experience_years": float(r[8]) if r[8] else 0,
             "source": r[9] or '', "stage": r[10], "rating": r[11],
             "created_at": str(r[12]) if r[12] else None}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_recruitment_bp.route("/candidates", methods=["POST"])
def create_candidate():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    if not data.get("first_name"):
        return {"success": False, "message": "First name is required"}, 400
    try:
        cid = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO hr.candidates (id, requisition_id, first_name, last_name, email, phone, "
            "current_company, current_designation, experience_years, source, stage, notes, tenant_id) "
            "VALUES (:id, :req, :fn, :ln, :email, :phone, :company, :desig, :exp, :src, 'applied', :notes, :tid)"
        ), {"id": cid, "req": data.get("requisition_id"), "fn": data["first_name"],
            "ln": data.get("last_name", ""), "email": data.get("email", ""),
            "phone": data.get("phone", ""), "company": data.get("current_company", ""),
            "desig": data.get("current_designation", ""), "exp": data.get("experience_years", 0),
            "src": data.get("source", ""), "notes": data.get("notes", ""), "tid": tid})
        db.session.commit()
        _log('CREATE', 'Candidate', data['first_name'], new=data)
        return {"success": True, "data": {"id": cid}, "message": "Candidate added"}, 201
    except Exception as e:
        return _err(e)


@hr_recruitment_bp.route("/candidates/<cid>", methods=["PUT"])
def update_candidate(cid):
    data = request.get_json()
    try:
        db.session.execute(db.text(
            "UPDATE hr.candidates SET first_name=:fn, last_name=:ln, email=:email, phone=:phone, "
            "current_company=:company, current_designation=:desig, experience_years=:exp, "
            "source=:src, stage=:stage, rating=:rating, notes=:notes, updated_at=NOW() WHERE id=:id"
        ), {"id": cid, "fn": data.get("first_name"), "ln": data.get("last_name", ""),
            "email": data.get("email", ""), "phone": data.get("phone", ""),
            "company": data.get("current_company", ""), "desig": data.get("current_designation", ""),
            "exp": data.get("experience_years", 0), "src": data.get("source", ""),
            "stage": data.get("stage", "applied"), "rating": data.get("rating"),
            "notes": data.get("notes", "")})
        db.session.commit()
        _log('UPDATE', 'Candidate', cid, new=data)
        return {"success": True, "message": "Candidate updated"}
    except Exception as e:
        return _err(e)


@hr_recruitment_bp.route("/candidates/<cid>", methods=["DELETE"])
def delete_candidate(cid):
    try:
        db.session.execute(db.text(
            "UPDATE hr.candidates SET is_deleted=true, updated_at=NOW() WHERE id=:id"
        ), {"id": cid})
        db.session.commit()
        _log('DELETE', 'Candidate', cid)
        return {"success": True, "message": "Candidate deleted"}
    except Exception as e:
        return _err(e)


# ─── INTERVIEWS ───
@hr_recruitment_bp.route("/interviews", methods=["GET"])
def list_interviews():
    tid = request.headers.get("X-Tenant-ID", "")
    cid = request.args.get("candidate_id")
    where = "WHERE i.tenant_id=:tid AND i.is_deleted=false"
    params = {"tid": tid}
    if cid:
        where += " AND i.candidate_id=:cid"
        params["cid"] = cid
    try:
        rows = db.session.execute(db.text(
            f"SELECT i.id, i.candidate_id, c.first_name, c.last_name, i.interview_type, "
            f"i.scheduled_at, i.interviewer, i.mode, i.status, i.result, i.feedback, i.created_at "
            f"FROM hr.interviews i JOIN hr.candidates c ON c.id=i.candidate_id "
            f"{where} ORDER BY i.scheduled_at DESC"
        ), params).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "candidate_id": str(r[1]),
             "candidate_name": f"{r[2]} {r[3] or ''}".strip(),
             "interview_type": r[4], "scheduled_at": str(r[5]) if r[5] else None,
             "interviewer": r[6] or '', "mode": r[7], "status": r[8],
             "result": r[9] or '', "feedback": r[10] or '',
             "created_at": str(r[11]) if r[11] else None}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_recruitment_bp.route("/interviews", methods=["POST"])
def create_interview():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        iid = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO hr.interviews (id, candidate_id, requisition_id, interview_type, "
            "scheduled_at, interviewer, mode, status, tenant_id) "
            "VALUES (:id, :cid, :req, :type, :sched, :interviewer, :mode, 'scheduled', :tid)"
        ), {"id": iid, "cid": data["candidate_id"], "req": data.get("requisition_id"),
            "type": data.get("interview_type", "technical"),
            "sched": data.get("scheduled_at"), "interviewer": data.get("interviewer", ""),
            "mode": data.get("mode", "in_person"), "tid": tid})
        db.session.commit()
        _log('CREATE', 'Interview', data.get('candidate_id', ''), new=data)
        return {"success": True, "data": {"id": iid}, "message": "Interview scheduled"}, 201
    except Exception as e:
        return _err(e)


@hr_recruitment_bp.route("/interviews/<iid>", methods=["PUT"])
def update_interview(iid):
    data = request.get_json()
    try:
        db.session.execute(db.text(
            "UPDATE hr.interviews SET status=:status, result=:result, feedback=:feedback, "
            "scorecard=:scorecard, updated_at=NOW() WHERE id=:id"
        ), {"id": iid, "status": data.get("status", "scheduled"),
            "result": data.get("result", ""), "feedback": data.get("feedback", ""),
            "scorecard": json.dumps(data.get("scorecard", {}))})
        db.session.commit()
        _log('UPDATE', 'Interview', iid, new=data)
        return {"success": True, "message": "Interview updated"}
    except Exception as e:
        return _err(e)
