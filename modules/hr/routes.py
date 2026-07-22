from flask import Blueprint, request
from extensions import db
import uuid
import json

hr_bp = Blueprint("hr", __name__)


def _log_audit(action, entity_type, entity_id, old_values=None, new_values=None):
    """Write to audit.logs with user context, old/new values for full change tracking."""
    try:
        forwarded = request.headers.get('X-Forwarded-For', '')
        ip = forwarded.split(',')[0].strip() if forwarded else (request.remote_addr or '')
        extra = {}
        if old_values:
            extra['old'] = old_values
        if new_values:
            extra['new'] = new_values
        if old_values and new_values:
            extra['changes'] = {k: {'old': old_values.get(k), 'new': v}
                                for k, v in new_values.items() if old_values.get(k) != v}
        db.session.execute(db.text(
            "INSERT INTO audit.logs (id, action, module, entity_type, entity_id, "
            "ip_address, tenant_id, user_email, user_name, extra_data, created_at) "
            "VALUES (gen_random_uuid(), :action, 'HR', :etype, :eid, "
            ":ip, :tid, :email, :name, :extra, NOW())"
        ), {
            "action": action, "etype": entity_type, "eid": str(entity_id),
            "ip": ip,
            "tid": request.headers.get('X-Tenant-ID', ''),
            "email": request.headers.get('X-User-Email', ''),
            "name": request.headers.get('X-User-Name', ''),
            "extra": json.dumps(extra) if extra else None
        })
    except Exception:
        pass


@hr_bp.route("/code-criteria", methods=["GET"])
def list_code_criteria():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    rows = db.session.execute(db.text(
        "SELECT id, name, prefix, prefix_separator, code_start, current_sequence, "
        "suffix_separator, suffix, is_active, created_at "
        "FROM hr.employee_code_criteria WHERE tenant_id = :tid AND is_deleted = false "
        "ORDER BY created_at DESC"
    ), {"tid": tenant_id})
    items = [{"id": str(r[0]), "name": r[1], "prefix": r[2], "prefix_separator": r[3],
              "code_start": r[4], "current_sequence": r[5], "suffix_separator": r[6],
              "suffix": r[7], "is_active": r[8], "created_at": str(r[9]) if r[9] else None} for r in rows]
    return {"success": True, "data": items}


@hr_bp.route("/code-criteria", methods=["POST"])
def create_code_criteria():
    data = request.get_json()
    if not data.get("name") or data.get("code_start") is None:
        return {"success": False, "message": "Name and Code Start are required"}, 400
    tenant_id = request.headers.get("X-Tenant-ID", "")
    # Check duplicate name
    existing = db.session.execute(db.text(
        "SELECT id FROM hr.employee_code_criteria WHERE LOWER(name) = LOWER(:name) AND tenant_id = :tid AND is_deleted = false"
    ), {"name": data["name"], "tid": tenant_id}).first()
    if existing:
        return {"success": False, "message": "Code criteria with this name already exists"}, 409
    cid = str(uuid.uuid4())
    db.session.execute(db.text(
        "INSERT INTO hr.employee_code_criteria (id, name, prefix, prefix_separator, code_start, "
        "current_sequence, suffix_separator, suffix, tenant_id) "
        "VALUES (:id, :name, :prefix, :psep, :start, :seq, :ssep, :suffix, :tid)"
    ), {
        "id": cid, "name": data["name"],
        "prefix": data.get("prefix", ""), "psep": data.get("prefix_separator", ""),
        "start": int(data["code_start"]),
        "seq": int(data["code_start"]) - 1,  # so first generated = code_start
        "ssep": data.get("suffix_separator", ""), "suffix": data.get("suffix", ""),
        "tid": tenant_id
    })
    db.session.commit()
    _log_audit('CREATE', 'Code Criteria', data['name'], new_values={
        'name': data['name'], 'prefix': data.get('prefix', ''),
        'code_start': data['code_start'], 'suffix': data.get('suffix', '')
    })
    return {"success": True, "data": {"id": cid}, "message": "Code criteria created"}, 201


@hr_bp.route("/code-criteria/<cid>", methods=["PUT"])
def update_code_criteria(cid):
    data = request.get_json()
    # Fetch old values before update
    old = db.session.execute(db.text(
        "SELECT name, prefix, prefix_separator, suffix_separator, suffix, code_start "
        "FROM hr.employee_code_criteria WHERE id=:id"
    ), {"id": cid}).first()
    old_values = {"name": old[0], "prefix": old[1], "prefix_separator": old[2],
                  "suffix_separator": old[3], "suffix": old[4], "code_start": old[5]} if old else {}
    updates, params = [], {"id": cid}
    for field in ["name", "prefix", "prefix_separator", "suffix_separator", "suffix"]:
        if field in data:
            updates.append(f"{field}=:{field}")
            params[field] = data[field]
    if "code_start" in data:
        updates.append("code_start=:code_start")
        params["code_start"] = int(data["code_start"])
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(
        f"UPDATE hr.employee_code_criteria SET {', '.join(updates)} WHERE id=:id"
    ), params)
    db.session.commit()
    new_values = {k: v for k, v in params.items() if k != 'id'}
    _log_audit('UPDATE', 'Code Criteria', old_values.get('name', cid), old_values=old_values, new_values=new_values)
    return {"success": True, "message": "Code criteria updated"}


@hr_bp.route("/code-criteria/<cid>", methods=["DELETE"])
def delete_code_criteria(cid):
    row = db.session.execute(db.text(
        "SELECT name FROM hr.employee_code_criteria WHERE id=:id"
    ), {"id": cid}).first()
    name = row[0] if row else cid
    db.session.execute(db.text(
        "UPDATE hr.employee_code_criteria SET is_deleted=true, updated_at=NOW() WHERE id=:id"
    ), {"id": cid})
    db.session.commit()
    _log_audit('DELETE', 'Code Criteria', name, old_values={'name': name, 'id': cid})
    return {"success": True, "message": "Code criteria deleted"}


# ─── EMPLOYEES ───

def _generate_employee_code(criteria_id):
    """Atomic increment and build employee code from criteria."""
    row = db.session.execute(db.text(
        "UPDATE hr.employee_code_criteria SET current_sequence = current_sequence + 1, updated_at = NOW() "
        "WHERE id = :id RETURNING current_sequence, prefix, prefix_separator, suffix_separator, suffix"
    ), {"id": criteria_id}).first()
    if not row:
        return None
    seq, prefix, psep, ssep, suffix = row[0], row[1] or '', row[2] or '', row[3] or '', row[4] or ''
    code = str(seq)
    if prefix:
        code = prefix + psep + code
    if suffix:
        code = code + ssep + suffix
    return code


@hr_bp.route("/employees", methods=["GET"])
def list_employees():
    tenant_id = request.headers.get("X-Tenant-ID", "")
    rows = db.session.execute(db.text(
        "SELECT id, emp_code, first_name, last_name, email, phone, designation, "
        "department_id, date_of_joining, status, gender, employment_type, work_location, created_at "
        "FROM hr.employees WHERE (tenant_id = :tid OR tenant_id = '' OR tenant_id IS NULL) AND is_deleted = false ORDER BY created_at DESC"
    ), {"tid": tenant_id})
    items = [{"id": r[0], "emp_code": r[1], "first_name": r[2], "last_name": r[3] or '',
              "email": r[4] or '', "phone": r[5] or '', "designation": r[6] or '',
              "department": r[7] or '', "date_of_joining": str(r[8]) if r[8] else '',
              "status": r[9] or 'active', "gender": r[10] or '', "employment_type": r[11] or '',
              "work_location": r[12] or '', "created_at": str(r[13]) if r[13] else None} for r in rows]
    return {"success": True, "data": items}


@hr_bp.route("/employees/<emp_id>", methods=["GET"])
def get_employee(emp_id):
    r = db.session.execute(db.text(
        "SELECT id, emp_code, first_name, last_name, email, phone, designation, "
        "department_id, date_of_joining, date_of_birth, status, gender, blood_group, "
        "marital_status, nationality, address, bank_details, employment_type, "
        "reporting_to, work_location, previous_experience, qualifications, "
        "pan_number, aadhar_number, uan_number, esi_number, "
        "emergency_contact_name, emergency_contact_phone, emergency_contact_relation, "
        "code_criteria_id, created_by, created_at "
        "FROM hr.employees WHERE id = :id AND is_deleted = false"
    ), {"id": emp_id}).first()
    if not r:
        return {"success": False, "message": "Employee not found"}, 404
    emp = {
        "id": r[0], "emp_code": r[1], "first_name": r[2], "last_name": r[3] or '',
        "email": r[4] or '', "phone": r[5] or '', "designation": r[6] or '',
        "department": r[7] or '', "date_of_joining": str(r[8]) if r[8] else '',
        "date_of_birth": str(r[9]) if r[9] else '', "status": r[10] or 'active',
        "gender": r[11] or '', "blood_group": r[12] or '', "marital_status": r[13] or '',
        "nationality": r[14] or '', "address": r[15] or {}, "bank_details": r[16] or {},
        "employment_type": r[17] or '', "reporting_to": r[18] or '',
        "work_location": r[19] or '', "previous_experience": r[20] or [],
        "qualifications": r[21] or [], "pan_number": r[22] or '',
        "aadhar_number": r[23] or '', "uan_number": r[24] or '', "esi_number": r[25] or '',
        "emergency_contact_name": r[26] or '', "emergency_contact_phone": r[27] or '',
        "emergency_contact_relation": r[28] or '', "code_criteria_id": str(r[29]) if r[29] else '',
        "created_by": r[30] or '', "created_at": str(r[31]) if r[31] else None
    }
    return {"success": True, "data": emp}


@hr_bp.route("/employees", methods=["POST"])
def create_employee():
    data = request.get_json()
    tenant_id = request.headers.get("X-Tenant-ID", "")
    criteria_id = data.get("code_criteria_id")
    if not criteria_id:
        return {"success": False, "message": "Code criteria is required"}, 400
    if not data.get("first_name"):
        return {"success": False, "message": "First name is required"}, 400

    # Generate employee code
    emp_code = _generate_employee_code(criteria_id)
    if not emp_code:
        return {"success": False, "message": "Invalid code criteria"}, 400

    emp_id = str(uuid.uuid4())
    created_by = request.headers.get('X-User-Name', '') or request.headers.get('X-User-Email', '')

    db.session.execute(db.text(
        "INSERT INTO hr.employees (id, emp_code, code_criteria_id, first_name, last_name, email, phone, "
        "date_of_birth, gender, blood_group, marital_status, nationality, "
        "address, department_id, designation, date_of_joining, employment_type, "
        "reporting_to, work_location, previous_experience, qualifications, "
        "bank_details, pan_number, aadhar_number, uan_number, esi_number, "
        "emergency_contact_name, emergency_contact_phone, emergency_contact_relation, "
        "tenant_id, created_by, status) "
        "VALUES (:id, :emp_code, :crit_id, :fname, :lname, :email, :phone, "
        ":dob, :gender, :blood, :marital, :nationality, "
        ":address, :dept, :desig, :doj, :emp_type, "
        ":reporting, :location, :prev_exp, :quals, "
        ":bank, :pan, :aadhar, :uan, :esi, "
        ":ec_name, :ec_phone, :ec_relation, "
        ":tid, :created_by, 'active')"
    ), {
        "id": emp_id, "emp_code": emp_code, "crit_id": criteria_id,
        "fname": data["first_name"], "lname": data.get("last_name", ""),
        "email": data.get("email", ""), "phone": data.get("phone", ""),
        "dob": data.get("date_of_birth") or None, "gender": data.get("gender", ""),
        "blood": data.get("blood_group", ""), "marital": data.get("marital_status", ""),
        "nationality": data.get("nationality", "Indian"),
        "address": json.dumps(data.get("address", {})),
        "dept": data.get("department", ""), "desig": data.get("designation", ""),
        "doj": data.get("date_of_joining") or None,
        "emp_type": data.get("employment_type", "full_time"),
        "reporting": data.get("reporting_to", ""), "location": data.get("work_location", ""),
        "prev_exp": json.dumps(data.get("previous_experience", [])),
        "quals": json.dumps(data.get("qualifications", [])),
        "bank": json.dumps(data.get("bank_details", {})),
        "pan": data.get("pan_number", ""), "aadhar": data.get("aadhar_number", ""),
        "uan": data.get("uan_number", ""), "esi": data.get("esi_number", ""),
        "ec_name": data.get("emergency_contact_name", ""),
        "ec_phone": data.get("emergency_contact_phone", ""),
        "ec_relation": data.get("emergency_contact_relation", ""),
        "tid": tenant_id, "created_by": created_by
    })
    db.session.commit()
    _log_audit('CREATE', 'Employee', emp_code, new_values={
        'emp_code': emp_code, 'name': f"{data['first_name']} {data.get('last_name','')}".strip(),
        'email': data.get('email', ''), 'designation': data.get('designation', ''),
        'department': data.get('department', ''), 'employment_type': data.get('employment_type', '')
    })
    return {"success": True, "data": {"id": emp_id, "emp_code": emp_code}, "message": f"Employee created: {emp_code}"}, 201


@hr_bp.route("/employees/<emp_id>", methods=["PUT"])
def update_employee(emp_id):
    data = request.get_json()
    # Fetch old values
    old_row = db.session.execute(db.text(
        "SELECT emp_code, first_name, last_name, email, phone, designation, "
        "department_id, employment_type, status, work_location "
        "FROM hr.employees WHERE id=:id"
    ), {"id": emp_id}).first()
    old_values = {}
    emp_code = emp_id
    if old_row:
        emp_code = old_row[0] or emp_id
        old_values = {
            'emp_code': old_row[0], 'first_name': old_row[1], 'last_name': old_row[2],
            'email': old_row[3], 'phone': old_row[4], 'designation': old_row[5],
            'department': old_row[6], 'employment_type': old_row[7],
            'status': old_row[8], 'work_location': old_row[9]
        }
    updates, params = [], {"id": emp_id}
    simple_fields = ["first_name", "last_name", "email", "phone", "date_of_birth",
                     "gender", "blood_group", "marital_status", "nationality",
                     "designation", "date_of_joining", "employment_type",
                     "reporting_to", "work_location", "pan_number", "aadhar_number",
                     "uan_number", "esi_number", "emergency_contact_name",
                     "emergency_contact_phone", "emergency_contact_relation", "status"]
    for f in simple_fields:
        if f in data:
            updates.append(f"{f}=:{f}")
            params[f] = data[f] if data[f] else None
    if "department" in data:
        updates.append("department_id=:department_id")
        params["department_id"] = data["department"]
    json_fields = ["address", "bank_details", "previous_experience", "qualifications"]
    for f in json_fields:
        if f in data:
            updates.append(f"{f}=:{f}")
            params[f] = json.dumps(data[f])
    if not updates:
        return {"success": False, "message": "Nothing to update"}, 400
    updates.append("updated_at=NOW()")
    db.session.execute(db.text(
        f"UPDATE hr.employees SET {', '.join(updates)} WHERE id=:id"
    ), params)
    db.session.commit()
    new_values = {k: v for k, v in params.items() if k != 'id' and k in old_values}
    _log_audit('UPDATE', 'Employee', emp_code, old_values=old_values, new_values=new_values)
    return {"success": True, "message": "Employee updated"}


@hr_bp.route("/employee-detail/<emp_id>", methods=["GET"])
def get_employee_detail(emp_id):
    """Full employee detail with audit logs."""
    tenant_id = request.headers.get("X-Tenant-ID", "")
    r = db.session.execute(db.text(
        "SELECT id, emp_code, first_name, last_name, email, phone, designation, "
        "department_id, date_of_joining, date_of_birth, status, gender, blood_group, "
        "marital_status, nationality, address, bank_details, employment_type, "
        "reporting_to, work_location, previous_experience, qualifications, "
        "pan_number, aadhar_number, uan_number, esi_number, "
        "emergency_contact_name, emergency_contact_phone, emergency_contact_relation, "
        "code_criteria_id, created_by, created_at, updated_at "
        "FROM hr.employees WHERE id = :id AND is_deleted = false"
    ), {"id": emp_id}).first()
    if not r:
        return {"success": False, "message": "Employee not found"}, 404

    def parse_json(val):
        if isinstance(val, (dict, list)): return val
        if val:
            try: return json.loads(val)
            except: return val
        return {}

    emp = {
        "id": str(r[0]), "emp_code": r[1], "first_name": r[2], "last_name": r[3] or '',
        "email": r[4] or '', "phone": r[5] or '', "designation": r[6] or '',
        "department": r[7] or '', "date_of_joining": str(r[8]) if r[8] else '',
        "date_of_birth": str(r[9]) if r[9] else '', "status": r[10] or 'active',
        "gender": r[11] or '', "blood_group": r[12] or '', "marital_status": r[13] or '',
        "nationality": r[14] or '', "address": parse_json(r[15]),
        "bank_details": parse_json(r[16]), "employment_type": r[17] or '',
        "reporting_to": r[18] or '', "work_location": r[19] or '',
        "previous_experience": parse_json(r[20]) if r[20] else [],
        "qualifications": parse_json(r[21]) if r[21] else [],
        "pan_number": r[22] or '', "aadhar_number": r[23] or '',
        "uan_number": r[24] or '', "esi_number": r[25] or '',
        "emergency_contact_name": r[26] or '',
        "emergency_contact_phone": r[27] or '',
        "emergency_contact_relation": r[28] or '',
        "code_criteria_id": str(r[29]) if r[29] else '',
        "created_by": r[30] or '',
        "created_at": str(r[31]) if r[31] else None,
        "updated_at": str(r[32]) if r[32] else None
    }

    # Audit logs for this employee
    audit_rows = db.session.execute(db.text(
        "SELECT id, action, entity_type, user_email, user_name, ip_address, created_at "
        "FROM audit.logs WHERE entity_id = :eid AND module = 'HR' "
        "ORDER BY created_at DESC LIMIT 100"
    ), {"eid": emp["emp_code"]}).fetchall()
    # Also try by emp_id
    audit_rows2 = db.session.execute(db.text(
        "SELECT id, action, entity_type, user_email, user_name, ip_address, created_at "
        "FROM audit.logs WHERE entity_id = :eid "
        "ORDER BY created_at DESC LIMIT 100"
    ), {"eid": emp_id}).fetchall()
    seen_ids = set()
    audit_list = []
    for rows in [audit_rows, audit_rows2]:
        for row in rows:
            rid = str(row[0])
            if rid not in seen_ids:
                seen_ids.add(rid)
                audit_list.append({
                    "id": rid, "action": row[1], "entity_type": row[2] or '',
                    "user_email": row[3] or '', "user_name": row[4] or '',
                    "ip_address": row[5] or '',
                    "created_at": str(row[6]) if row[6] else None
                })
    audit_list.sort(key=lambda x: x["created_at"] or '', reverse=True)

    return {"success": True, "data": {"employee": emp, "audit_logs": audit_list[:100]}}


@hr_bp.route("/employees/<emp_id>", methods=["DELETE"])
def delete_employee(emp_id):
    row = db.session.execute(db.text(
        "SELECT emp_code, first_name, last_name, email, designation FROM hr.employees WHERE id=:id"
    ), {"id": emp_id}).first()
    emp_code = row[0] if row else emp_id
    old_values = {'emp_code': row[0], 'name': f"{row[1]} {row[2]}".strip(),
                  'email': row[3], 'designation': row[4]} if row else {}
    db.session.execute(db.text(
        "UPDATE hr.employees SET is_deleted=true, updated_at=NOW() WHERE id=:id"
    ), {"id": emp_id})
    db.session.commit()
    _log_audit('DELETE', 'Employee', emp_code, old_values=old_values)
    return {"success": True, "message": "Employee deleted"}
