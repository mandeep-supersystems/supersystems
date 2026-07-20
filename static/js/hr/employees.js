// ─── HR MODULE: EMPLOYEES ───
async function loadEmployees() {
    const res = await fetch(API + '/employees', { headers: headers() });
    const data = await res.json();
    employeesList = data.data || [];
    renderEmployeesTable();
}

function renderEmployeesTable() {
    const tbody = document.getElementById('employeesTableBody');
    if (!employeesList.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No employees added yet</td></tr>'; return; }
    tbody.innerHTML = employeesList.map(e => `<tr style="cursor:pointer" onclick="window.location='/hr/employee/${e.id}'">
        <td><a class="emp-code-link" href="/hr/employee/${e.id}" onclick="event.stopPropagation()">${e.emp_code}</a></td>
        <td>${e.first_name} ${e.last_name}</td><td>${e.email}</td><td>${e.phone}</td>
        <td>${e.designation}</td><td>${e.date_of_joining}</td>
        <td><span class="status-badge ${e.status}">${e.status}</span></td>
        <td class="actions-cell">
            <button class="btn-icon" title="View" onclick="event.stopPropagation();window.location='/hr/employee/${e.id}'"><span class="material-icons-outlined">open_in_new</span></button>
            <button class="btn-icon" title="Edit" onclick="event.stopPropagation();openEditEmployee('${e.id}')"><span class="material-icons-outlined">edit</span></button>
            <button class="btn-icon danger" title="Delete" onclick="event.stopPropagation();confirmDeleteEmployee('${e.id}','${e.emp_code}')"><span class="material-icons-outlined">delete</span></button>
        </td>
    </tr>`).join('');
}

function openAddEmployeeModal() {
    document.querySelectorAll('#addEmployeeModal input, #addEmployeeModal select').forEach(el => {
        if (el.type !== 'submit' && el.type !== 'button') {
            if (el.id === 'aeNationality') el.value = 'Indian';
            else if (el.id === 'aeCountry') el.value = 'India';
            else if (el.id === 'aeEmpType') el.value = 'full_time';
            else el.value = '';
        }
    });
    document.getElementById('experienceRows').innerHTML = '';
    const sel = document.getElementById('aeCodeCriteria');
    sel.innerHTML = '<option value="">Select Code Criteria</option>' + criteriaList.map(c => `<option value="${c.id}">${c.name} (Next: ${buildPreview(c.prefix, c.prefix_separator, c.current_sequence+1, c.suffix_separator, c.suffix)})</option>`).join('');
    showEmpTab('personal');
    openModal('addEmployeeModal');
}

function showEmpTab(tab) {
    document.querySelectorAll('.emp-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.emp-tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.querySelectorAll('.emp-tab').forEach(t => { if (t.textContent.toLowerCase().includes(tab.substring(0,4))) t.classList.add('active'); });
}

let expCounter = 0;
function addExperienceRow() {
    expCounter++;
    const div = document.createElement('div'); div.className = 'exp-row'; div.id = 'exp-' + expCounter;
    div.innerHTML = `<div class="exp-row-header"><strong>Experience #${expCounter}</strong><button type="button" class="btn-icon danger" onclick="this.closest('.exp-row').remove()"><span class="material-icons-outlined">close</span></button></div>
        <div class="form-row"><div class="form-group"><label>Company</label><input type="text" class="exp-company"></div><div class="form-group"><label>Designation</label><input type="text" class="exp-designation"></div></div>
        <div class="form-row"><div class="form-group"><label>From</label><input type="date" class="exp-from"></div><div class="form-group"><label>To</label><input type="date" class="exp-to"></div></div>
        <div class="form-group"><label>Notes</label><input type="text" class="exp-notes"></div>`;
    document.getElementById('experienceRows').appendChild(div);
}

function collectExperience() {
    const exp = [];
    document.querySelectorAll('#experienceRows .exp-row').forEach(row => {
        const company = row.querySelector('.exp-company').value.trim();
        if (!company) return;
        exp.push({ company, designation: row.querySelector('.exp-designation').value.trim(), from: row.querySelector('.exp-from').value, to: row.querySelector('.exp-to').value, notes: row.querySelector('.exp-notes').value.trim() });
    });
    return exp;
}

async function saveEmployee(e) {
    e.preventDefault();
    const body = {
        code_criteria_id: document.getElementById('aeCodeCriteria').value,
        first_name: document.getElementById('aeFirstName').value.trim(),
        last_name: document.getElementById('aeLastName').value.trim(),
        email: document.getElementById('aeEmail').value.trim(),
        phone: document.getElementById('aePhone').value.trim(),
        date_of_birth: document.getElementById('aeDOB').value || null,
        gender: document.getElementById('aeGender').value,
        blood_group: document.getElementById('aeBlood').value,
        marital_status: document.getElementById('aeMarital').value,
        nationality: document.getElementById('aeNationality').value.trim(),
        address: { line1: document.getElementById('aeAddr1').value.trim(), line2: document.getElementById('aeAddr2').value.trim(), city: document.getElementById('aeCity').value.trim(), state: document.getElementById('aeState').value.trim(), pincode: document.getElementById('aePincode').value.trim(), country: document.getElementById('aeCountry').value.trim() },
        department: document.getElementById('aeDept').value.trim(),
        designation: document.getElementById('aeDesig').value.trim(),
        date_of_joining: document.getElementById('aeDOJ').value || null,
        employment_type: document.getElementById('aeEmpType').value,
        reporting_to: document.getElementById('aeReporting').value.trim(),
        work_location: document.getElementById('aeLocation').value.trim(),
        previous_experience: collectExperience(),
        bank_details: { bank_name: document.getElementById('aeBankName').value.trim(), account_no: document.getElementById('aeBankAcc').value.trim(), ifsc: document.getElementById('aeIFSC').value.trim() },
        pan_number: document.getElementById('aePAN').value.trim(),
        aadhar_number: document.getElementById('aeAadhar').value.trim(),
        uan_number: document.getElementById('aeUAN').value.trim(),
        esi_number: document.getElementById('aeESI').value.trim(),
        emergency_contact_name: document.getElementById('aeECName').value.trim(),
        emergency_contact_phone: document.getElementById('aeECPhone').value.trim(),
        emergency_contact_relation: document.getElementById('aeECRelation').value.trim()
    };
    if (!body.code_criteria_id) { alert('Please select a Code Criteria'); return; }
    if (!body.first_name) { alert('First name is required'); return; }
    const res = await fetch(API + '/employees', { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('addEmployeeModal'); loadEmployees(); alert(`Employee created: ${data.data.emp_code}`); } else { alert(data.message); }
}

async function viewEmployee(id) {
    const res = await fetch(API + '/employees/' + id, { headers: headers() });
    const data = await res.json();
    if (!data.success) { alert(data.message); return; }
    const e = data.data; const addr = e.address || {}; const bank = e.bank_details || {}; const exp = e.previous_experience || [];
    document.getElementById('viewEmpBody').innerHTML = `<div class="emp-detail-grid">
        <div class="detail-section"><h4>Personal</h4><div class="detail-row"><span>Code:</span><strong>${e.emp_code}</strong></div><div class="detail-row"><span>Name:</span><span>${e.first_name} ${e.last_name}</span></div><div class="detail-row"><span>Email:</span><span>${e.email}</span></div><div class="detail-row"><span>Phone:</span><span>${e.phone}</span></div><div class="detail-row"><span>DOB:</span><span>${e.date_of_birth}</span></div><div class="detail-row"><span>Gender:</span><span>${e.gender}</span></div></div>
        <div class="detail-section"><h4>Employment</h4><div class="detail-row"><span>Department:</span><span>${e.department}</span></div><div class="detail-row"><span>Designation:</span><span>${e.designation}</span></div><div class="detail-row"><span>DOJ:</span><span>${e.date_of_joining}</span></div><div class="detail-row"><span>Type:</span><span>${e.employment_type}</span></div></div>
        <div class="detail-section"><h4>Bank & IDs</h4><div class="detail-row"><span>Bank:</span><span>${bank.bank_name||''}</span></div><div class="detail-row"><span>PAN:</span><span>${e.pan_number}</span></div><div class="detail-row"><span>Aadhar:</span><span>${e.aadhar_number}</span></div></div>
    </div>`;
    openModal('viewEmployeeModal');
}

function confirmDeleteEmployee(id, code) {
    document.getElementById('deleteMsg').textContent = `Delete employee "${code}"?`;
    document.getElementById('deleteConfirmBtn').onclick = async () => {
        const res = await fetch(API + '/employees/' + id, { method: 'DELETE', headers: headers() });
        const data = await res.json();
        if (data.success) { closeModal('deleteConfirmModal'); loadEmployees(); } else { alert(data.message); }
    };
    openModal('deleteConfirmModal');
}

// ─── EDIT EMPLOYEE ───
function showEditEmpTab(tab) {
    document.querySelectorAll('#editEmployeeModal .emp-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#editEmployeeModal .emp-tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('etab-' + tab).classList.add('active');
    document.querySelectorAll('#editEmployeeModal .emp-tab').forEach(t => { if (t.textContent.toLowerCase().includes(tab.substring(0,4))) t.classList.add('active'); });
}

let editExpCounter = 0;
function addEditExperienceRow(data) {
    editExpCounter++;
    const div = document.createElement('div'); div.className = 'exp-row';
    div.innerHTML = `<div class="exp-row-header"><strong>Experience #${editExpCounter}</strong><button type="button" class="btn-icon danger" onclick="this.closest('.exp-row').remove()"><span class="material-icons-outlined">close</span></button></div>
        <div class="form-row"><div class="form-group"><label>Company</label><input type="text" class="exp-company" value="${data?.company||''}"></div><div class="form-group"><label>Designation</label><input type="text" class="exp-designation" value="${data?.designation||''}"></div></div>
        <div class="form-row"><div class="form-group"><label>From</label><input type="date" class="exp-from" value="${data?.from||''}"></div><div class="form-group"><label>To</label><input type="date" class="exp-to" value="${data?.to||''}"></div></div>
        <div class="form-group"><label>Notes</label><input type="text" class="exp-notes" value="${data?.notes||''}"></div>`;
    document.getElementById('editExperienceRows').appendChild(div);
}

function collectEditExperience() {
    const exp = [];
    document.querySelectorAll('#editExperienceRows .exp-row').forEach(row => {
        const company = row.querySelector('.exp-company').value.trim();
        if (!company) return;
        exp.push({ company, designation: row.querySelector('.exp-designation').value.trim(), from: row.querySelector('.exp-from').value, to: row.querySelector('.exp-to').value, notes: row.querySelector('.exp-notes').value.trim() });
    });
    return exp;
}

async function openEditEmployee(id) {
    const res = await fetch(API + '/employees/' + id, { headers: headers() });
    const data = await res.json();
    if (!data.success) { alert(data.message); return; }
    const e = data.data; const addr = e.address || {}; const bank = e.bank_details || {};
    document.getElementById('eeId').value = e.id;
    document.getElementById('eeCode').value = e.emp_code;
    document.getElementById('eeFirstName').value = e.first_name;
    document.getElementById('eeLastName').value = e.last_name;
    document.getElementById('eeEmail').value = e.email;
    document.getElementById('eePhone').value = e.phone;
    document.getElementById('eeDOB').value = e.date_of_birth;
    document.getElementById('eeGender').value = e.gender;
    document.getElementById('eeBlood').value = e.blood_group;
    document.getElementById('eeMarital').value = e.marital_status;
    document.getElementById('eeNationality').value = e.nationality;
    document.getElementById('eeAddr1').value = addr.line1 || '';
    document.getElementById('eeAddr2').value = addr.line2 || '';
    document.getElementById('eeCity').value = addr.city || '';
    document.getElementById('eeState').value = addr.state || '';
    document.getElementById('eePincode').value = addr.pincode || '';
    document.getElementById('eeCountry').value = addr.country || 'India';
    document.getElementById('eeDept').value = e.department;
    document.getElementById('eeDesig').value = e.designation;
    document.getElementById('eeDOJ').value = e.date_of_joining;
    document.getElementById('eeEmpType').value = e.employment_type || 'full_time';
    document.getElementById('eeReporting').value = e.reporting_to;
    document.getElementById('eeLocation').value = e.work_location;
    document.getElementById('eeStatus').value = e.status || 'active';
    document.getElementById('eeBankName').value = bank.bank_name || '';
    document.getElementById('eeBankAcc').value = bank.account_no || '';
    document.getElementById('eeIFSC').value = bank.ifsc || '';
    document.getElementById('eePAN').value = e.pan_number;
    document.getElementById('eeAadhar').value = e.aadhar_number;
    document.getElementById('eeUAN').value = e.uan_number;
    document.getElementById('eeESI').value = e.esi_number;
    document.getElementById('eeECName').value = e.emergency_contact_name;
    document.getElementById('eeECPhone').value = e.emergency_contact_phone;
    document.getElementById('eeECRelation').value = e.emergency_contact_relation;
    editExpCounter = 0; document.getElementById('editExperienceRows').innerHTML = '';
    (e.previous_experience || []).forEach(exp => addEditExperienceRow(exp));
    showEditEmpTab('personal');
    openModal('editEmployeeModal');
}

async function updateEmployee(e) {
    e.preventDefault();
    const id = document.getElementById('eeId').value;
    const body = {
        first_name: document.getElementById('eeFirstName').value.trim(),
        last_name: document.getElementById('eeLastName').value.trim(),
        email: document.getElementById('eeEmail').value.trim(),
        phone: document.getElementById('eePhone').value.trim(),
        date_of_birth: document.getElementById('eeDOB').value || null,
        gender: document.getElementById('eeGender').value,
        blood_group: document.getElementById('eeBlood').value,
        marital_status: document.getElementById('eeMarital').value,
        nationality: document.getElementById('eeNationality').value.trim(),
        address: { line1: document.getElementById('eeAddr1').value.trim(), line2: document.getElementById('eeAddr2').value.trim(), city: document.getElementById('eeCity').value.trim(), state: document.getElementById('eeState').value.trim(), pincode: document.getElementById('eePincode').value.trim(), country: document.getElementById('eeCountry').value.trim() },
        department: document.getElementById('eeDept').value.trim(),
        designation: document.getElementById('eeDesig').value.trim(),
        date_of_joining: document.getElementById('eeDOJ').value || null,
        employment_type: document.getElementById('eeEmpType').value,
        reporting_to: document.getElementById('eeReporting').value.trim(),
        work_location: document.getElementById('eeLocation').value.trim(),
        status: document.getElementById('eeStatus').value,
        previous_experience: collectEditExperience(),
        bank_details: { bank_name: document.getElementById('eeBankName').value.trim(), account_no: document.getElementById('eeBankAcc').value.trim(), ifsc: document.getElementById('eeIFSC').value.trim() },
        pan_number: document.getElementById('eePAN').value.trim(),
        aadhar_number: document.getElementById('eeAadhar').value.trim(),
        uan_number: document.getElementById('eeUAN').value.trim(),
        esi_number: document.getElementById('eeESI').value.trim(),
        emergency_contact_name: document.getElementById('eeECName').value.trim(),
        emergency_contact_phone: document.getElementById('eeECPhone').value.trim(),
        emergency_contact_relation: document.getElementById('eeECRelation').value.trim()
    };
    const res = await fetch(API + '/employees/' + id, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('editEmployeeModal'); loadEmployees(); } else { alert(data.message); }
}
