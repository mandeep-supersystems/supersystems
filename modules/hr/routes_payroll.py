from flask import Blueprint, request
from extensions import db
import uuid, json

hr_payroll_bp = Blueprint("hr_payroll", __name__)


from modules.hr.audit import log_hr_audit

DEFAULT_TENANT_ID = 'b424df0e-f766-4e94-b3fd-05777e158958'

def _get_tenant_id():
    tid = (request.headers.get("X-Tenant-ID") or "").strip()
    return tid if tid and tid not in ('TEST', '') else DEFAULT_TENANT_ID

def _log(action, etype, eid, old=None, new=None):
    log_hr_audit(action, etype, eid, old_values=old, new_values=new)


def _err(e):
    db.session.rollback()
    return {"success": False, "message": str(e), "data": []}, 500



# ─── SALARY STRUCTURES ───
@hr_payroll_bp.route("/salary-structures", methods=["GET"])
def list_salary_structures():
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        rows = db.session.execute(db.text(
            "SELECT id, name, description, components, is_active, created_at "
            "FROM hr.salary_structures WHERE tenant_id=:tid AND is_deleted=false ORDER BY name"
        ), {"tid": tid}).fetchall()
        def parse(v):
            if isinstance(v, list): return v
            try: return json.loads(v) if v else []
            except: return []
        return {"success": True, "data": [
            {"id": str(r[0]), "name": r[1], "description": r[2] or '',
             "components": parse(r[3]), "is_active": r[4],
             "created_at": str(r[5]) if r[5] else None}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_payroll_bp.route("/salary-structures", methods=["POST"])
def create_salary_structure():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    if not data.get("name"):
        return {"success": False, "message": "Name is required"}, 400
    try:
        sid = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO hr.salary_structures (id, name, description, components, tenant_id) "
            "VALUES (:id, :name, :desc, :comp, :tid)"
        ), {"id": sid, "name": data["name"], "desc": data.get("description", ""),
            "comp": json.dumps(data.get("components", [])), "tid": tid})
        db.session.commit()
        _log('CREATE', 'Salary Structure', data['name'], new=data)
        return {"success": True, "data": {"id": sid}, "message": "Salary structure created"}, 201
    except Exception as e:
        return _err(e)


@hr_payroll_bp.route("/salary-structures/<sid>", methods=["PUT"])
def update_salary_structure(sid):
    data = request.get_json()
    try:
        db.session.execute(db.text(
            "UPDATE hr.salary_structures SET name=:name, description=:desc, components=:comp, updated_at=NOW() WHERE id=:id"
        ), {"id": sid, "name": data.get("name"), "desc": data.get("description", ""),
            "comp": json.dumps(data.get("components", []))})
        db.session.commit()
        _log('UPDATE', 'Salary Structure', sid, new=data)
        return {"success": True, "message": "Salary structure updated"}
    except Exception as e:
        return _err(e)


@hr_payroll_bp.route("/salary-structures/<sid>", methods=["DELETE"])
def delete_salary_structure(sid):
    try:
        row = db.session.execute(db.text("SELECT name FROM hr.salary_structures WHERE id=:id"), {"id": sid}).first()
        db.session.execute(db.text("UPDATE hr.salary_structures SET is_deleted=true, updated_at=NOW() WHERE id=:id"), {"id": sid})
        db.session.commit()
        _log('DELETE', 'Salary Structure', row[0] if row else sid)
        return {"success": True, "message": "Salary structure deleted"}
    except Exception as e:
        return _err(e)


# ─── EMPLOYEE SALARIES ───
@hr_payroll_bp.route("/employee-salaries", methods=["GET"])
def list_employee_salaries():
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        rows = db.session.execute(db.text(
            "SELECT es.id, es.employee_id, e.emp_code, e.first_name, e.last_name, "
            "es.ctc, es.basic, es.hra, es.special_allowance, es.pf_applicable, "
            "es.esi_applicable, es.tax_regime, es.effective_from "
            "FROM hr.employee_salaries es JOIN hr.employees e ON e.id=es.employee_id "
            "WHERE es.tenant_id=:tid AND es.is_deleted=false ORDER BY e.emp_code"
        ), {"tid": tid}).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "employee_id": str(r[1]), "emp_code": r[2],
             "employee_name": f"{r[3]} {r[4] or ''}".strip(),
             "ctc": float(r[5]) if r[5] else 0, "basic": float(r[6]) if r[6] else 0,
             "hra": float(r[7]) if r[7] else 0, "special_allowance": float(r[8]) if r[8] else 0,
             "pf_applicable": r[9], "esi_applicable": r[10],
             "tax_regime": r[11], "effective_from": str(r[12]) if r[12] else None}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_payroll_bp.route("/employee-salaries", methods=["POST"])
def save_employee_salary():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        existing = db.session.execute(db.text(
            "SELECT id FROM hr.employee_salaries WHERE employee_id=:emp AND tenant_id=:tid AND is_deleted=false"
        ), {"emp": data["employee_id"], "tid": tid}).first()
        if existing:
            db.session.execute(db.text(
                "UPDATE hr.employee_salaries SET ctc=:ctc, basic=:basic, hra=:hra, "
                "special_allowance=:sa, pf_applicable=:pf, esi_applicable=:esi, "
                "tax_regime=:regime, effective_from=:eff, updated_at=NOW() WHERE id=:id"
            ), {"id": str(existing[0]), "ctc": data.get("ctc", 0), "basic": data.get("basic", 0),
                "hra": data.get("hra", 0), "sa": data.get("special_allowance", 0),
                "pf": data.get("pf_applicable", True), "esi": data.get("esi_applicable", True),
                "regime": data.get("tax_regime", "new"), "eff": data.get("effective_from")})
        else:
            sid = str(uuid.uuid4())
            db.session.execute(db.text(
                "INSERT INTO hr.employee_salaries (id, employee_id, salary_structure_id, ctc, basic, hra, "
                "special_allowance, pf_applicable, esi_applicable, tax_regime, effective_from, tenant_id) "
                "VALUES (:id, :emp, :struct, :ctc, :basic, :hra, :sa, :pf, :esi, :regime, :eff, :tid)"
            ), {"id": sid, "emp": data["employee_id"], "struct": data.get("salary_structure_id"),
                "ctc": data.get("ctc", 0), "basic": data.get("basic", 0),
                "hra": data.get("hra", 0), "sa": data.get("special_allowance", 0),
                "pf": data.get("pf_applicable", True), "esi": data.get("esi_applicable", True),
                "regime": data.get("tax_regime", "new"), "eff": data.get("effective_from"), "tid": tid})
        db.session.commit()
        _log('SAVE', 'Employee Salary', data.get('employee_id', ''), new=data)
        return {"success": True, "message": "Salary saved"}
    except Exception as e:
        return _err(e)


# ─── PAYROLL RUNS ───
@hr_payroll_bp.route("/payroll-runs", methods=["GET"])
def list_payroll_runs():
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        rows = db.session.execute(db.text(
            "SELECT id, period_month, period_year, status, total_employees, "
            "total_gross, total_deductions, total_net, finalized_by, finalized_at, created_at "
            "FROM hr.payroll_runs WHERE tenant_id=:tid AND is_deleted=false ORDER BY period_year DESC, period_month DESC"
        ), {"tid": tid}).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "period_month": r[1], "period_year": r[2], "status": r[3],
             "total_employees": r[4], "total_gross": float(r[5]) if r[5] else 0,
             "total_deductions": float(r[6]) if r[6] else 0, "total_net": float(r[7]) if r[7] else 0,
             "finalized_by": r[8] or '', "finalized_at": str(r[9]) if r[9] else None,
             "created_at": str(r[10]) if r[10] else None}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_payroll_bp.route("/payroll-runs", methods=["POST"])
def create_payroll_run():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        existing = db.session.execute(db.text(
            "SELECT id FROM hr.payroll_runs WHERE period_month=:m AND period_year=:y AND tenant_id=:tid AND is_deleted=false"
        ), {"m": data["period_month"], "y": data["period_year"], "tid": tid}).first()
        if existing:
            return {"success": False, "message": "Payroll run already exists for this period"}, 409
        rid = str(uuid.uuid4())
        db.session.execute(db.text(
            "INSERT INTO hr.payroll_runs (id, period_month, period_year, status, tenant_id) "
            "VALUES (:id, :m, :y, 'draft', :tid)"
        ), {"id": rid, "m": data["period_month"], "y": data["period_year"], "tid": tid})
        db.session.commit()
        _log('CREATE', 'Payroll Run', f"{data['period_month']}/{data['period_year']}")
        return {"success": True, "data": {"id": rid}, "message": "Payroll run created"}, 201
    except Exception as e:
        return _err(e)


@hr_payroll_bp.route("/payroll-runs/<rid>/finalize", methods=["POST"])
def finalize_payroll_run(rid):
    try:
        row = db.session.execute(db.text(
            "SELECT status FROM hr.payroll_runs WHERE id=:id"
        ), {"id": rid}).first()
        if not row:
            return {"success": False, "message": "Payroll run not found"}, 404
        if row[0] == 'finalized':
            return {"success": False, "message": "Already finalized"}, 409
        db.session.execute(db.text(
            "UPDATE hr.payslips SET status='finalized', updated_at=NOW() WHERE payroll_run_id=:rid AND status='draft'"
        ), {"rid": rid})
        totals = db.session.execute(db.text(
            "SELECT COUNT(*), SUM(gross_salary), SUM(total_deductions), SUM(net_salary) "
            "FROM hr.payslips WHERE payroll_run_id=:rid AND is_deleted=false"
        ), {"rid": rid}).first()
        db.session.execute(db.text(
            "UPDATE hr.payroll_runs SET status='finalized', finalized_by=:by, finalized_at=NOW(), "
            "total_employees=:emp, total_gross=:gross, total_deductions=:ded, total_net=:net, updated_at=NOW() WHERE id=:id"
        ), {"id": rid, "by": request.headers.get('X-User-Name', ''),
            "emp": totals[0] or 0, "gross": totals[1] or 0, "ded": totals[2] or 0, "net": totals[3] or 0})
        db.session.commit()
        _log('FINALIZE', 'Payroll Run', rid)
        return {"success": True, "message": "Payroll run finalized"}
    except Exception as e:
        return _err(e)


# ─── PAYSLIPS ───
@hr_payroll_bp.route("/payslips", methods=["GET"])
def list_payslips():
    tid = request.headers.get("X-Tenant-ID", "")
    emp_id = request.args.get("employee_id")
    run_id = request.args.get("payroll_run_id")
    where = "WHERE p.tenant_id=:tid AND p.is_deleted=false"
    params = {"tid": tid}
    if emp_id:
        where += " AND p.employee_id=:emp"
        params["emp"] = emp_id
    if run_id:
        where += " AND p.payroll_run_id=:run"
        params["run"] = run_id
    try:
        rows = db.session.execute(db.text(
            f"SELECT p.id, p.employee_id, p.emp_code, e.first_name, e.last_name, "
            f"p.period_month, p.period_year, p.gross_salary, p.total_deductions, p.net_salary, p.status, p.created_at "
            f"FROM hr.payslips p JOIN hr.employees e ON e.id=p.employee_id {where} "
            f"ORDER BY p.period_year DESC, p.period_month DESC"
        ), params).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "employee_id": str(r[1]), "emp_code": r[2],
             "employee_name": f"{r[3]} {r[4] or ''}".strip(),
             "period_month": r[5], "period_year": r[6],
             "gross_salary": float(r[7]) if r[7] else 0,
             "total_deductions": float(r[8]) if r[8] else 0,
             "net_salary": float(r[9]) if r[9] else 0,
             "status": r[10], "created_at": str(r[11]) if r[11] else None}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_payroll_bp.route("/payslips/<pid>", methods=["GET"])
def get_payslip(pid):
    try:
        row = db.session.execute(db.text(
            "SELECT p.id, p.employee_id, p.emp_code, e.first_name, e.last_name, e.designation, "
            "e.department_id, p.period_month, p.period_year, p.basic, p.hra, p.special_allowance, "
            "p.other_earnings, p.gross_salary, p.pf_employee, p.pf_employer, p.eps_employer, "
            "p.esi_employee, p.esi_employer, p.tds, p.professional_tax, p.lop_days, p.lop_amount, "
            "p.other_deductions, p.total_deductions, p.net_salary, p.working_days, p.present_days, p.status "
            "FROM hr.payslips p JOIN hr.employees e ON e.id=p.employee_id WHERE p.id=:id"
        ), {"id": pid}).first()
        if not row:
            return {"success": False, "message": "Payslip not found"}, 404
        def parse(v):
            if isinstance(v, dict): return v
            try: return json.loads(v) if v else {}
            except: return {}
        return {"success": True, "data": {
            "id": str(row[0]), "employee_id": str(row[1]), "emp_code": row[2],
            "employee_name": f"{row[3]} {row[4] or ''}".strip(),
            "designation": row[5] or '', "department": row[6] or '',
            "period_month": row[7], "period_year": row[8],
            "basic": float(row[9]) if row[9] else 0, "hra": float(row[10]) if row[10] else 0,
            "special_allowance": float(row[11]) if row[11] else 0,
            "other_earnings": parse(row[12]),
            "gross_salary": float(row[13]) if row[13] else 0,
            "pf_employee": float(row[14]) if row[14] else 0,
            "pf_employer": float(row[15]) if row[15] else 0,
            "eps_employer": float(row[16]) if row[16] else 0,
            "esi_employee": float(row[17]) if row[17] else 0,
            "esi_employer": float(row[18]) if row[18] else 0,
            "tds": float(row[19]) if row[19] else 0,
            "professional_tax": float(row[20]) if row[20] else 0,
            "lop_days": float(row[21]) if row[21] else 0,
            "lop_amount": float(row[22]) if row[22] else 0,
            "other_deductions": parse(row[23]),
            "total_deductions": float(row[24]) if row[24] else 0,
            "net_salary": float(row[25]) if row[25] else 0,
            "working_days": row[26] or 0, "present_days": float(row[27]) if row[27] else 0,
            "status": row[28]
        }}
    except Exception as e:
        return _err(e)


@hr_payroll_bp.route("/payslips", methods=["POST"])
def create_payslip():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        existing = db.session.execute(db.text(
            "SELECT id, status FROM hr.payslips WHERE employee_id=:emp AND period_month=:m AND period_year=:y AND tenant_id=:tid AND is_deleted=false"
        ), {"emp": data["employee_id"], "m": data["period_month"], "y": data["period_year"], "tid": tid}).first()
        if existing and existing[1] == 'finalized':
            return {"success": False, "message": "Finalized payslip cannot be modified"}, 409
        pid = str(uuid.uuid4())
        emp_row = db.session.execute(db.text("SELECT emp_code FROM hr.employees WHERE id=:id"), {"id": data["employee_id"]}).first()
        emp_code = emp_row[0] if emp_row else ''
        gross = float(data.get("basic", 0)) + float(data.get("hra", 0)) + float(data.get("special_allowance", 0))
        pf_emp = round(min(float(data.get("basic", 0)), 15000) * 0.12, 2)
        pf_total = round(min(float(data.get("basic", 0)), 15000) * 0.12, 2)
        eps = round(min(float(data.get("basic", 0)), 15000) * 0.0833, 2)
        epf_employer = round(pf_total - eps, 2)
        esi_emp = round(gross * 0.0075, 2) if gross <= 21000 else 0
        esi_er = round(gross * 0.0325, 2) if gross <= 21000 else 0
        total_ded = pf_emp + esi_emp + float(data.get("tds", 0)) + float(data.get("professional_tax", 0)) + float(data.get("lop_amount", 0))
        net = gross - total_ded
        db.session.execute(db.text(
            "INSERT INTO hr.payslips (id, payroll_run_id, employee_id, emp_code, period_month, period_year, "
            "basic, hra, special_allowance, gross_salary, pf_employee, pf_employer, eps_employer, "
            "esi_employee, esi_employer, tds, professional_tax, lop_days, lop_amount, "
            "total_deductions, net_salary, working_days, present_days, tenant_id) "
            "VALUES (:id, :run, :emp, :code, :m, :y, :basic, :hra, :sa, :gross, :pf_emp, :pf_er, :eps, "
            ":esi_emp, :esi_er, :tds, :pt, :lop_d, :lop_a, :total_ded, :net, :wd, :pd, :tid)"
        ), {"id": pid, "run": data.get("payroll_run_id"), "emp": data["employee_id"], "code": emp_code,
            "m": data["period_month"], "y": data["period_year"],
            "basic": data.get("basic", 0), "hra": data.get("hra", 0), "sa": data.get("special_allowance", 0),
            "gross": gross, "pf_emp": pf_emp, "pf_er": epf_employer, "eps": eps,
            "esi_emp": esi_emp, "esi_er": esi_er, "tds": data.get("tds", 0),
            "pt": data.get("professional_tax", 0), "lop_d": data.get("lop_days", 0),
            "lop_a": data.get("lop_amount", 0), "total_ded": total_ded, "net": net,
            "wd": data.get("working_days", 26), "pd": data.get("present_days", 26), "tid": tid})
        db.session.commit()
        _log('CREATE', 'Payslip', emp_code)
        return {"success": True, "data": {"id": pid, "net_salary": net}, "message": "Payslip generated"}, 201
    except Exception as e:
        return _err(e)


# ─── PF CONTRIBUTIONS ───
@hr_payroll_bp.route("/pf-contributions", methods=["GET"])
def list_pf_contributions():
    tid = request.headers.get("X-Tenant-ID", "")
    emp_id = request.args.get("employee_id")
    where = "WHERE pc.tenant_id=:tid"
    params = {"tid": tid}
    if emp_id:
        where += " AND pc.employee_id=:emp"
        params["emp"] = emp_id
    try:
        rows = db.session.execute(db.text(
            f"SELECT pc.id, pc.employee_id, pc.emp_code, pc.uan_number, "
            f"pc.period_month, pc.period_year, pc.pf_wage, pc.employee_contribution, "
            f"pc.employer_epf, pc.employer_eps, pc.total_contribution "
            f"FROM hr.pf_contributions pc {where} ORDER BY pc.period_year DESC, pc.period_month DESC"
        ), params).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "employee_id": str(r[1]), "emp_code": r[2], "uan_number": r[3] or '',
             "period_month": r[4], "period_year": r[5],
             "pf_wage": float(r[6]) if r[6] else 0,
             "employee_contribution": float(r[7]) if r[7] else 0,
             "employer_epf": float(r[8]) if r[8] else 0,
             "employer_eps": float(r[9]) if r[9] else 0,
             "total_contribution": float(r[10]) if r[10] else 0}
            for r in rows]}
    except Exception as e:
        return _err(e)


# ─── TAX DECLARATIONS ───
@hr_payroll_bp.route("/tax-declarations", methods=["GET"])
def list_tax_declarations():
    tid = request.headers.get("X-Tenant-ID", "")
    emp_id = request.args.get("employee_id")
    where = "WHERE td.tenant_id=:tid"
    params = {"tid": tid}
    if emp_id:
        where += " AND td.employee_id=:emp"
        params["emp"] = emp_id
    try:
        rows = db.session.execute(db.text(
            f"SELECT td.id, td.employee_id, e.emp_code, e.first_name, e.last_name, "
            f"td.financial_year, td.tax_regime, td.section_80c, td.section_80d, "
            f"td.hra_exemption, td.total_declared, td.status, td.created_at "
            f"FROM hr.tax_declarations td JOIN hr.employees e ON e.id=td.employee_id "
            f"{where} ORDER BY td.financial_year DESC"
        ), params).fetchall()
        return {"success": True, "data": [
            {"id": str(r[0]), "employee_id": str(r[1]), "emp_code": r[2],
             "employee_name": f"{r[3]} {r[4] or ''}".strip(),
             "financial_year": r[5], "tax_regime": r[6],
             "section_80c": float(r[7]) if r[7] else 0,
             "section_80d": float(r[8]) if r[8] else 0,
             "hra_exemption": float(r[9]) if r[9] else 0,
             "total_declared": float(r[10]) if r[10] else 0,
             "status": r[11], "created_at": str(r[12]) if r[12] else None}
            for r in rows]}
    except Exception as e:
        return _err(e)


@hr_payroll_bp.route("/tax-declarations", methods=["POST"])
def save_tax_declaration():
    data = request.get_json()
    tid = request.headers.get("X-Tenant-ID", "")
    try:
        existing = db.session.execute(db.text(
            "SELECT id FROM hr.tax_declarations WHERE employee_id=:emp AND financial_year=:fy AND tenant_id=:tid"
        ), {"emp": data["employee_id"], "fy": data["financial_year"], "tid": tid}).first()
        total = float(data.get("section_80c", 0)) + float(data.get("section_80d", 0)) + float(data.get("hra_exemption", 0))
        if existing:
            db.session.execute(db.text(
                "UPDATE hr.tax_declarations SET tax_regime=:regime, section_80c=:c80, section_80d=:d80, "
                "hra_exemption=:hra, total_declared=:total, status='submitted', updated_at=NOW() WHERE id=:id"
            ), {"id": str(existing[0]), "regime": data.get("tax_regime", "new"),
                "c80": data.get("section_80c", 0), "d80": data.get("section_80d", 0),
                "hra": data.get("hra_exemption", 0), "total": total})
        else:
            did = str(uuid.uuid4())
            db.session.execute(db.text(
                "INSERT INTO hr.tax_declarations (id, employee_id, financial_year, tax_regime, "
                "section_80c, section_80d, hra_exemption, total_declared, status, tenant_id, created_by) "
                "VALUES (:id, :emp, :fy, :regime, :c80, :d80, :hra, :total, 'submitted', :tid, :by)"
            ), {"id": did, "emp": data["employee_id"], "fy": data["financial_year"],
                "regime": data.get("tax_regime", "new"), "c80": data.get("section_80c", 0),
                "d80": data.get("section_80d", 0), "hra": data.get("hra_exemption", 0),
                "total": total, "tid": tid, "by": request.headers.get('X-User-Name', '')})
        db.session.commit()
        _log('SAVE', 'Tax Declaration', data.get('employee_id', ''), new=data)
        return {"success": True, "message": "Tax declaration saved"}
    except Exception as e:
        return _err(e)


@hr_payroll_bp.route("/tax-declarations/<did>/verify", methods=["POST"])
def verify_tax_declaration(did):
    try:
        db.session.execute(db.text(
            "UPDATE hr.tax_declarations SET status='verified', verified_by=:by, verified_at=NOW(), updated_at=NOW() WHERE id=:id"
        ), {"id": did, "by": request.headers.get('X-User-Name', '')})
        db.session.commit()
        _log('VERIFY', 'Tax Declaration', did)
        return {"success": True, "message": "Declaration verified"}
    except Exception as e:
        return _err(e)


# ─── MASTER CONSOLIDATED PAYROLL API ───
@hr_payroll_bp.route("/payroll", methods=["GET"])
@hr_payroll_bp.route("/payroll/summary", methods=["GET"])
def get_payroll_overview():
    """Master consolidated endpoint providing full metrics, runs, payslips, PF, tax, and audit history."""
    tid = _get_tenant_id()
    try:
        # 1. Runs
        runs_raw = db.session.execute(db.text(
            "SELECT id, period_month, period_year, status, total_employees, "
            "total_gross, total_deductions, total_net, finalized_by, finalized_at, created_at "
            "FROM hr.payroll_runs WHERE (tenant_id=:tid OR tenant_id='b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id IS NULL OR tenant_id='') AND is_deleted=false ORDER BY period_year DESC, period_month DESC"
        ), {"tid": tid}).fetchall()
        runs = [
            {"id": str(r[0]), "period_month": r[1], "period_year": r[2], "status": r[3],
             "total_employees": r[4] or 0, "total_gross": float(r[5]) if r[5] else 0.0,
             "total_deductions": float(r[6]) if r[6] else 0.0, "total_net": float(r[7]) if r[7] else 0.0,
             "finalized_by": r[8] or '', "finalized_at": str(r[9]) if r[9] else None,
             "created_at": str(r[10]) if r[10] else None}
            for r in runs_raw
        ]

        # 2. Payslips
        payslips_raw = db.session.execute(db.text(
            "SELECT p.id, p.employee_id, p.emp_code, e.first_name, e.last_name, "
            "p.period_month, p.period_year, p.gross_salary, p.total_deductions, p.net_salary, p.status, p.created_at, e.designation "
            "FROM hr.payslips p JOIN hr.employees e ON e.id=p.employee_id "
            "WHERE (p.tenant_id=:tid OR p.tenant_id='b424df0e-f766-4e94-b3fd-05777e158958' OR p.tenant_id IS NULL OR p.tenant_id='') AND p.is_deleted=false ORDER BY p.period_year DESC, p.period_month DESC LIMIT 100"
        ), {"tid": tid}).fetchall()
        payslips = [
            {"id": str(r[0]), "employee_id": str(r[1]), "emp_code": r[2],
             "employee_name": f"{r[3]} {r[4] or ''}".strip(),
             "period_month": r[5], "period_year": r[6],
             "gross_salary": float(r[7]) if r[7] else 0.0,
             "total_deductions": float(r[8]) if r[8] else 0.0,
             "net_salary": float(r[9]) if r[9] else 0.0,
             "status": r[10], "created_at": str(r[11]) if r[11] else None,
             "designation": r[12] or ''}
            for r in payslips_raw
        ]

        # 3. Salary Structures
        sal_raw = db.session.execute(db.text(
            "SELECT id, name, description, components, is_active, created_at "
            "FROM hr.salary_structures WHERE (tenant_id=:tid OR tenant_id='b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id IS NULL OR tenant_id='') AND is_deleted=false ORDER BY name"
        ), {"tid": tid}).fetchall()
        def parse_comp(v):
            if isinstance(v, list): return v
            try: return json.loads(v) if v else []
            except: return []
        salaries = [
            {"id": str(r[0]), "name": r[1], "description": r[2] or '',
             "components": parse_comp(r[3]), "is_active": r[4],
             "created_at": str(r[5]) if r[5] else None}
            for r in sal_raw
        ]

        # 4. PF Contributions
        pf_raw = db.session.execute(db.text(
            "SELECT pc.id, pc.employee_id, pc.emp_code, pc.uan_number, "
            "pc.period_month, pc.period_year, pc.pf_wage, pc.employee_contribution, "
            "pc.employer_epf, pc.employer_eps, pc.total_contribution, e.first_name, e.last_name "
            "FROM hr.pf_contributions pc LEFT JOIN hr.employees e ON e.id=pc.employee_id "
            "WHERE (pc.tenant_id=:tid OR pc.tenant_id='b424df0e-f766-4e94-b3fd-05777e158958' OR pc.tenant_id IS NULL OR pc.tenant_id='') ORDER BY pc.period_year DESC, pc.period_month DESC LIMIT 100"
        ), {"tid": tid}).fetchall()
        pf_list = [
            {"id": str(r[0]), "employee_id": str(r[1]) if r[1] else '', "emp_code": r[2] or '', "uan_number": r[3] or '—',
             "period_month": r[4], "period_year": r[5],
             "pf_wage": float(r[6]) if r[6] else 0.0,
             "employee_contribution": float(r[7]) if r[7] else 0.0,
             "employer_epf": float(r[8]) if r[8] else 0.0,
             "employer_eps": float(r[9]) if r[9] else 0.0,
             "total_contribution": float(r[10]) if r[10] else 0.0,
             "employee_name": f"{r[11] or ''} {r[12] or ''}".strip()}
            for r in pf_raw
        ]

        # 5. Tax Declarations
        tax_raw = db.session.execute(db.text(
            "SELECT td.id, td.employee_id, e.emp_code, e.first_name, e.last_name, "
            "td.financial_year, td.tax_regime, td.section_80c, td.section_80d, "
            "td.hra_exemption, td.total_declared, td.status, td.created_at "
            "FROM hr.tax_declarations td JOIN hr.employees e ON e.id=td.employee_id "
            "WHERE (td.tenant_id=:tid OR td.tenant_id='b424df0e-f766-4e94-b3fd-05777e158958' OR td.tenant_id IS NULL OR td.tenant_id='') ORDER BY td.financial_year DESC LIMIT 100"
        ), {"tid": tid}).fetchall()
        tax_list = [
            {"id": str(r[0]), "employee_id": str(r[1]), "emp_code": r[2],
             "employee_name": f"{r[3]} {r[4] or ''}".strip(),
             "financial_year": r[5], "tax_regime": r[6],
             "section_80c": float(r[7]) if r[7] else 0.0,
             "section_80d": float(r[8]) if r[8] else 0.0,
             "hra_exemption": float(r[9]) if r[9] else 0.0,
             "total_declared": float(r[10]) if r[10] else 0.0,
             "status": r[11], "created_at": str(r[12]) if r[12] else None}
            for r in tax_raw
        ]

        # 6. Aggregate KPIs
        total_gross = sum(r["total_gross"] for r in runs)
        total_net = sum(r["total_net"] for r in runs)
        active_runs_cnt = sum(1 for r in runs if r["status"] != 'finalized')
        finalized_runs_cnt = sum(1 for r in runs if r["status"] == 'finalized')
        total_pf_ytd = sum(p["total_contribution"] for p in pf_list)
        tax_verified_cnt = sum(1 for t in tax_list if t["status"] == 'verified')
        tax_pending_cnt = sum(1 for t in tax_list if t["status"] != 'verified')
        active_emp_cnt = db.session.execute(db.text(
            "SELECT COUNT(*) FROM hr.employees WHERE tenant_id=:tid AND is_deleted=false"
        ), {"tid": tid}).scalar() or 0

        # 7. Recent History / Audit logs specifically for Payroll
        history_raw = db.session.execute(db.text(
            "SELECT action, entity_type, entity_id, user_email, user_name, ip_address, extra_data, created_at "
            "FROM audit.logs WHERE module='HR' AND entity_type IN ('Salary Structure', 'Employee Salary', 'Payroll Run', 'Payslip', 'Tax Declaration', 'PF Contribution') "
            "ORDER BY created_at DESC LIMIT 15"
        )).fetchall()
        recent_history = [
            {"action": h[0], "entity_type": h[1], "entity_name": h[2],
             "user_email": h[3] or 'system', "user_name": h[4] or '', "ip_address": h[5] or '—',
             "changes": (h[6] or {}).get('changes', {}),
             "created_at": str(h[7]) if h[7] else None}
            for h in history_raw
        ]

        return {
            "success": True,
            "data": {
                "summary": {
                    "total_gross": total_gross,
                    "total_net": total_net,
                    "active_runs": active_runs_cnt,
                    "finalized_runs": finalized_runs_cnt,
                    "total_employees": active_emp_cnt,
                    "total_pf_ytd": total_pf_ytd,
                    "tax_verified": tax_verified_cnt,
                    "tax_pending": tax_pending_cnt
                },
                "runs": runs,
                "payslips": payslips,
                "salary_structures": salaries,
                "pf_contributions": pf_list,
                "tax_declarations": tax_list,
                "recent_history": recent_history
            }
        }
    except Exception as e:
        return _err(e)


# ─── BATCH PAYSLIPS GENERATION ───
@hr_payroll_bp.route("/payroll/batch-payslips", methods=["POST"])
def batch_generate_payslips():
    """Generate payslips for all active employees for a given payroll run."""
    data = request.get_json() or {}
    run_id = data.get("payroll_run_id")
    month = data.get("period_month")
    year = data.get("period_year")
    tid = _get_tenant_id()

    if not month or not year:
        return {"success": False, "message": "period_month and period_year are required"}, 400

    try:
        # Ensure a run exists
        if not run_id:
            existing_run = db.session.execute(db.text(
                "SELECT id FROM hr.payroll_runs WHERE period_month=:m AND period_year=:y AND (tenant_id=:tid OR tenant_id='b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id IS NULL OR tenant_id='') AND is_deleted=false"
            ), {"m": month, "y": year, "tid": tid}).first()
            if existing_run:
                run_id = str(existing_run[0])
            else:
                run_id = str(uuid.uuid4())
                db.session.execute(db.text(
                    "INSERT INTO hr.payroll_runs (id, period_month, period_year, status, tenant_id) "
                    "VALUES (:id, :m, :y, 'draft', :tid)"
                ), {"id": run_id, "m": month, "y": year, "tid": tid})

        # Fetch active employees
        employees = db.session.execute(db.text(
            "SELECT id, emp_code, first_name, last_name FROM hr.employees WHERE (tenant_id=:tid OR tenant_id='b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id IS NULL OR tenant_id='') AND is_deleted=false"
        ), {"tid": tid}).fetchall()

        created_count = 0
        for emp in employees:
            emp_id, emp_code = str(emp[0]), emp[1]
            # Check if payslip already exists
            exist = db.session.execute(db.text(
                "SELECT id FROM hr.payslips WHERE employee_id=:emp AND period_month=:m AND period_year=:y AND (tenant_id=:tid OR tenant_id='b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id IS NULL OR tenant_id='') AND is_deleted=false"
            ), {"emp": emp_id, "m": month, "y": year, "tid": tid}).first()
            if exist:
                continue

            # Fetch salary structure or defaults
            sal = db.session.execute(db.text(
                "SELECT basic, hra, special_allowance FROM hr.employee_salaries WHERE employee_id=:emp AND (tenant_id=:tid OR tenant_id='b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id IS NULL OR tenant_id='') AND is_deleted=false"
            ), {"emp": emp_id, "tid": tid}).first()

            basic = float(sal[0]) if sal and sal[0] else 30000.0
            hra = float(sal[1]) if sal and sal[1] else 15000.0
            sa = float(sal[2]) if sal and sal[2] else 5000.0
            gross = basic + hra + sa

            # PF
            pf_wage = min(basic, 15000.0)
            pf_emp = round(pf_wage * 0.12, 2)
            eps = round(pf_wage * 0.0833, 2)
            pf_er = round(pf_emp - eps, 2)

            # ESI
            esi_emp = round(gross * 0.0075, 2) if gross <= 21000 else 0.0
            esi_er = round(gross * 0.0325, 2) if gross <= 21000 else 0.0

            pt = 200.0
            tds = round(gross * 0.05, 2) if gross > 50000 else 0.0
            total_ded = pf_emp + esi_emp + pt + tds
            net = gross - total_ded

            pid = str(uuid.uuid4())
            db.session.execute(db.text(
                "INSERT INTO hr.payslips (id, payroll_run_id, employee_id, emp_code, period_month, period_year, "
                "basic, hra, special_allowance, gross_salary, pf_employee, pf_employer, eps_employer, "
                "esi_employee, esi_employer, tds, professional_tax, lop_days, lop_amount, "
                "total_deductions, net_salary, working_days, present_days, status, tenant_id) "
                "VALUES (:id, :run, :emp, :code, :m, :y, :basic, :hra, :sa, :gross, :pf_emp, :pf_er, :eps, "
                ":esi_emp, :esi_er, :tds, :pt, 0, 0, :total_ded, :net, 26, 26, 'draft', :tid)"
            ), {"id": pid, "run": run_id, "emp": emp_id, "code": emp_code, "m": month, "y": year,
                "basic": basic, "hra": hra, "sa": sa, "gross": gross, "pf_emp": pf_emp, "pf_er": pf_er,
                "eps": eps, "esi_emp": esi_emp, "esi_er": esi_er, "tds": tds, "pt": pt,
                "total_ded": total_ded, "net": net, "tid": tid})
            created_count += 1

        # Update run aggregates
        totals = db.session.execute(db.text(
            "SELECT COUNT(*), SUM(gross_salary), SUM(total_deductions), SUM(net_salary) "
            "FROM hr.payslips WHERE payroll_run_id=:rid AND is_deleted=false"
        ), {"rid": run_id}).first()
        db.session.execute(db.text(
            "UPDATE hr.payroll_runs SET total_employees=:emp, total_gross=:gross, "
            "total_deductions=:ded, total_net=:net, updated_at=NOW() WHERE id=:id"
        ), {"id": run_id, "emp": totals[0] or 0, "gross": totals[1] or 0, "ded": totals[2] or 0, "net": totals[3] or 0})

        db.session.commit()
        _log('BATCH_GENERATE', 'Payroll Run', f"{month}/{year}", new={'created_count': created_count})
        return {
            "success": True,
            "message": f"Successfully generated {created_count} payslips for {month}/{year}",
            "created_count": created_count,
            "payroll_run_id": run_id
        }
    except Exception as e:
        return _err(e)


# ─── AUTO GENERATE PF FROM PAYSLIPS ───
@hr_payroll_bp.route("/payroll/auto-pf", methods=["POST"])
def auto_generate_pf():
    """Auto-calculate and record PF contributions for a month/year from payslips."""
    data = request.get_json() or {}
    month = data.get("period_month")
    year = data.get("period_year")
    tid = _get_tenant_id()

    if not month or not year:
        return {"success": False, "message": "period_month and period_year are required"}, 400

    try:
        payslips = db.session.execute(db.text(
            "SELECT p.employee_id, p.emp_code, p.basic, p.pf_employee, p.pf_employer, p.eps_employer "
            "FROM hr.payslips p WHERE p.period_month=:m AND p.period_year=:y AND (p.tenant_id=:tid OR p.tenant_id='b424df0e-f766-4e94-b3fd-05777e158958' OR p.tenant_id IS NULL OR p.tenant_id='') AND p.is_deleted=false"
        ), {"m": month, "y": year, "tid": tid}).fetchall()

        if not payslips:
            return {"success": False, "message": f"No payslips found for {month}/{year}. Generate payslips first."}, 404

        count = 0
        for p in payslips:
            emp_id, emp_code = str(p[0]), p[1]
            basic = float(p[2]) if p[2] else 0.0
            pf_wage = min(basic, 15000.0)
            emp_pf = float(p[3]) if p[3] else round(pf_wage * 0.12, 2)
            er_pf = float(p[4]) if p[4] else round(pf_wage * 0.0367, 2)
            er_eps = float(p[5]) if p[5] else round(pf_wage * 0.0833, 2)
            total = emp_pf + er_pf + er_eps

            # Check existing PF entry
            exist = db.session.execute(db.text(
                "SELECT id FROM hr.pf_contributions WHERE employee_id=:emp AND period_month=:m AND period_year=:y AND (tenant_id=:tid OR tenant_id='b424df0e-f766-4e94-b3fd-05777e158958' OR tenant_id IS NULL OR tenant_id='')"
            ), {"emp": emp_id, "m": month, "y": year, "tid": tid}).first()

            if exist:
                db.session.execute(db.text(
                    "UPDATE hr.pf_contributions SET pf_wage=:wage, employee_contribution=:ee, "
                    "employer_epf=:er, employer_eps=:eps, total_contribution=:tot WHERE id=:id"
                ), {"id": str(exist[0]), "wage": pf_wage, "ee": emp_pf, "er": er_pf, "eps": er_eps, "tot": total})
            else:
                pf_id = str(uuid.uuid4())
                db.session.execute(db.text(
                    "INSERT INTO hr.pf_contributions (id, employee_id, emp_code, period_month, period_year, "
                    "pf_wage, employee_contribution, employer_epf, employer_eps, total_contribution, tenant_id) "
                    "VALUES (:id, :emp, :code, :m, :y, :wage, :ee, :er, :eps, :tot, :tid)"
                ), {"id": pf_id, "emp": emp_id, "code": emp_code, "m": month, "y": year,
                    "wage": pf_wage, "ee": emp_pf, "er": er_pf, "eps": er_eps, "tot": total, "tid": tid})
            count += 1

        db.session.commit()
        _log('AUTO_PF', 'PF Contribution', f"{month}/{year}", new={'recorded_count': count})
        return {"success": True, "message": f"Successfully processed PF contributions for {count} employees", "count": count}
    except Exception as e:
        return _err(e)


# ─── EXPORT PAYROLL CSV ───
@hr_payroll_bp.route("/payroll/export", methods=["GET"])
def export_payroll_csv():
    """Export runs, payslips, PF, or tax declarations as CSV."""
    from flask import Response
    import io, csv
    export_type = request.args.get("type", "payslips")
    tid = request.headers.get("X-Tenant-ID", "")
    output = io.StringIO()
    writer = csv.writer(output)

    try:
        if export_type == "runs":
            writer.writerow(["Period Month", "Period Year", "Status", "Employees", "Gross Salary", "Deductions", "Net Salary", "Finalized By"])
            rows = db.session.execute(db.text(
                "SELECT period_month, period_year, status, total_employees, total_gross, total_deductions, total_net, finalized_by "
                "FROM hr.payroll_runs WHERE tenant_id=:tid AND is_deleted=false ORDER BY period_year DESC, period_month DESC"
            ), {"tid": tid}).fetchall()
            for r in rows:
                writer.writerow(list(r))
        elif export_type == "pf":
            writer.writerow(["Employee Code", "UAN", "Month", "Year", "PF Wage", "Employee Share (12%)", "Employer EPF", "Employer EPS", "Total PF"])
            rows = db.session.execute(db.text(
                "SELECT emp_code, uan_number, period_month, period_year, pf_wage, employee_contribution, employer_epf, employer_eps, total_contribution "
                "FROM hr.pf_contributions WHERE tenant_id=:tid ORDER BY period_year DESC, period_month DESC"
            ), {"tid": tid}).fetchall()
            for r in rows:
                writer.writerow(list(r))
        elif export_type == "tax":
            writer.writerow(["Employee Code", "Financial Year", "Tax Regime", "80C", "80D", "HRA Exemption", "Total Declared", "Status"])
            rows = db.session.execute(db.text(
                "SELECT e.emp_code, td.financial_year, td.tax_regime, td.section_80c, td.section_80d, td.hra_exemption, td.total_declared, td.status "
                "FROM hr.tax_declarations td JOIN hr.employees e ON e.id=td.employee_id WHERE td.tenant_id=:tid"
            ), {"tid": tid}).fetchall()
            for r in rows:
                writer.writerow(list(r))
        else:
            # payslips
            writer.writerow(["Employee Code", "Employee Name", "Month", "Year", "Gross Salary", "PF", "TDS", "Total Deductions", "Net Salary", "Status"])
            rows = db.session.execute(db.text(
                "SELECT p.emp_code, CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')), p.period_month, p.period_year, "
                "p.gross_salary, p.pf_employee, p.tds, p.total_deductions, p.net_salary, p.status "
                "FROM hr.payslips p JOIN hr.employees e ON e.id=p.employee_id WHERE p.tenant_id=:tid AND p.is_deleted=false"
            ), {"tid": tid}).fetchall()
            for r in rows:
                writer.writerow(list(r))

        output.seek(0)
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment;filename=hr_{export_type}_{request.args.get('period_year','2026')}.csv"}
        )
    except Exception as e:
        return _err(e)

