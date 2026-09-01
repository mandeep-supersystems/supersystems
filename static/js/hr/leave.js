// ─── LEAVE JS ───
let leaveTypesList = [], empList = [];

async function safeJson(res) {
    try { return await res.json(); } catch(e) { return { success: false, message: 'Server error (migration may not be run yet)', data: [] }; }
}

function showTab(name) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    if (name === 'requests') loadRequests();
    if (name === 'types') loadLeaveTypes();
    if (name === 'balances') loadBalances();
    if (name === 'calendar') loadCalendar();
    if (name === 'holidays') loadHolidays();
}

function initYearSelects() {
    const y = new Date().getFullYear();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const now = new Date();
    ['calMonth'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = months.map((m,i) => `<option value="${i+1}" ${i+1===now.getMonth()+1?'selected':''}>${m}</option>`).join('');
    });
    ['balYear','calYear','holYear'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = [y-1,y,y+1].map(yr => `<option value="${yr}" ${yr===y?'selected':''}>${yr}</option>`).join('');
    });
    const byInput = document.getElementById('balYearInput');
    if (byInput) byInput.value = y;
    const hy2 = document.getElementById('holYear2');
    if (hy2) hy2.value = y;
}

async function loadEmpAndTypes() {
    try {
        const [eRes, tRes] = await Promise.all([
            fetch(API + '/employees', { headers: headers() }),
            fetch(API + '/leave-types', { headers: headers() })
        ]);
        const eData = await safeJson(eRes);
        const tData = await safeJson(tRes);
        empList = eData.data || [];
        leaveTypesList = tData.data || [];
        const empOpts = '<option value="">Select Employee</option>' + empList.map(e => `<option value="${e.id}">${e.emp_code} - ${e.first_name} ${e.last_name||''}</option>`).join('');
        const typeOpts = '<option value="">Select Leave Type</option>' + leaveTypesList.map(t => `<option value="${t.id}" data-code="${t.code}">${t.name}</option>`).join('');
        ['lrEmp','balEmp'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = empOpts; });
        ['lrType','balType'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = typeOpts; });
    } catch(e) { console.warn('loadEmpAndTypes:', e.message); }
}

async function loadRequests() {
    const status = document.getElementById('reqStatusFilter')?.value;
    const url = `${API}/leave-requests${status ? '?status=' + status : ''}`;
    try {
        const res = await fetch(url, { headers: headers() });
        const data = await safeJson(res);
        const rows = data.data || [];
        const tbody = document.getElementById('reqBody');
        if (!rows.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No leave requests</td></tr>'; return; }
        tbody.innerHTML = rows.map(r => `<tr>
            <td><strong>${r.emp_code}</strong> ${r.employee_name}</td>
            <td>${r.leave_type}</td><td>${r.start_date}</td><td>${r.end_date}</td>
            <td>${r.days}</td><td>${r.reason}</td>
            <td><span class="status-badge ${r.status}">${r.status}</span></td>
            <td class="actions-cell">
                ${r.status === 'pending' ? `
                <button class="btn-icon" title="Approve" onclick="approveLeave('${r.id}')"><span class="material-icons-outlined" style="color:#4caf50">check_circle</span></button>
                <button class="btn-icon danger" title="Reject" onclick="rejectLeave('${r.id}')"><span class="material-icons-outlined">cancel</span></button>
                ` : ''}
                <button class="btn-icon danger" title="Cancel" onclick="cancelLeave('${r.id}')"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>`).join('');
    } catch(e) {
        const tbody = document.getElementById('reqBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="empty">Failed to load. Run HR migration SQL first.</td></tr>';
    }
}

function openLeaveReqModal() { openModal('leaveReqModal'); }

async function saveLeaveReq() {
    const body = {
        employee_id: document.getElementById('lrEmp').value,
        leave_type_id: document.getElementById('lrType').value,
        leave_type: document.getElementById('lrType').selectedOptions[0]?.dataset.code || '',
        start_date: document.getElementById('lrFrom').value,
        end_date: document.getElementById('lrTo').value,
        days: parseFloat(document.getElementById('lrDays').value) || 1,
        reason: document.getElementById('lrReason').value.trim()
    };
    if (!body.employee_id || !body.start_date || !body.end_date) { alert('Employee, from and to dates required'); return; }
    try {
        const res = await fetch(`${API}/leave-requests`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
        const data = await safeJson(res);
        if (data.success) { closeModal('leaveReqModal'); loadRequests(); } else { alert(data.message); }
    } catch(e) { alert('Error: ' + e.message); }
}

async function approveLeave(id) {
    if (!confirm('Approve this leave?')) return;
    try {
        const res = await fetch(`${API}/leave-requests/${id}/approve`, { method: 'POST', headers: headers() });
        const data = await safeJson(res);
        if (data.success) loadRequests(); else alert(data.message);
    } catch(e) { alert('Error: ' + e.message); }
}

async function rejectLeave(id) {
    const reason = prompt('Rejection reason:');
    if (reason === null) return;
    try {
        const res = await fetch(`${API}/leave-requests/${id}/reject`, { method: 'POST', headers: headers(), body: JSON.stringify({ reason }) });
        const data = await safeJson(res);
        if (data.success) loadRequests(); else alert(data.message);
    } catch(e) { alert('Error: ' + e.message); }
}

async function cancelLeave(id) {
    if (!confirm('Cancel this leave request?')) return;
    try {
        const res = await fetch(`${API}/leave-requests/${id}`, { method: 'DELETE', headers: headers() });
        const data = await safeJson(res);
        if (data.success) loadRequests(); else alert(data.message);
    } catch(e) { alert('Error: ' + e.message); }
}

async function loadLeaveTypes() {
    try {
        const res = await fetch(`${API}/leave-types`, { headers: headers() });
        const data = await safeJson(res);
        leaveTypesList = data.data || [];
        const tbody = document.getElementById('typesBody');
        if (!leaveTypesList.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No leave types</td></tr>'; return; }
        tbody.innerHTML = leaveTypesList.map(t => `<tr>
            <td><strong>${t.name}</strong></td><td>${t.code}</td><td>${t.accrual_type}</td>
            <td>${t.days_per_year}</td>
            <td>${t.carry_forward ? `Yes (max ${t.max_carry_forward})` : 'No'}</td>
            <td>${t.is_paid ? 'Yes' : 'No'}</td>
            <td class="actions-cell">
                <button class="btn-icon" onclick="editLeaveType('${t.id}')"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-icon danger" onclick="deleteLeaveType('${t.id}','${t.name}')"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>`).join('');
    } catch(e) {
        const tbody = document.getElementById('typesBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="empty">Failed to load.</td></tr>';
    }
}

function openLeaveTypeModal() {
    document.getElementById('ltId').value = '';
    document.getElementById('ltModalTitle').textContent = 'New Leave Type';
    ['ltName','ltCode'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('ltDays').value = 0;
    document.getElementById('ltMCF').value = 0;
    openModal('leaveTypeModal');
}

function editLeaveType(id) {
    const t = leaveTypesList.find(x => x.id === id);
    if (!t) return;
    document.getElementById('ltId').value = t.id;
    document.getElementById('ltModalTitle').textContent = 'Edit Leave Type';
    document.getElementById('ltName').value = t.name;
    document.getElementById('ltCode').value = t.code;
    document.getElementById('ltAccrual').value = t.accrual_type;
    document.getElementById('ltDays').value = t.days_per_year;
    document.getElementById('ltCF').value = String(t.carry_forward);
    document.getElementById('ltMCF').value = t.max_carry_forward;
    document.getElementById('ltPaid').value = String(t.is_paid);
    document.getElementById('ltGender').value = t.applicable_gender;
    openModal('leaveTypeModal');
}

async function saveLeaveType() {
    const id = document.getElementById('ltId').value;
    const body = {
        name: document.getElementById('ltName').value.trim(),
        code: document.getElementById('ltCode').value.trim(),
        accrual_type: document.getElementById('ltAccrual').value,
        days_per_year: parseFloat(document.getElementById('ltDays').value) || 0,
        carry_forward: document.getElementById('ltCF').value === 'true',
        max_carry_forward: parseFloat(document.getElementById('ltMCF').value) || 0,
        is_paid: document.getElementById('ltPaid').value === 'true',
        applicable_gender: document.getElementById('ltGender').value
    };
    if (!body.name || !body.code) { alert('Name and code required'); return; }
    try {
        const url = id ? `${API}/leave-types/${id}` : `${API}/leave-types`;
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) });
        const data = await safeJson(res);
        if (data.success) { closeModal('leaveTypeModal'); loadLeaveTypes(); } else { alert(data.message); }
    } catch(e) { alert('Error: ' + e.message); }
}

async function deleteLeaveType(id, name) {
    if (!confirm(`Delete leave type "${name}"?`)) return;
    try {
        const res = await fetch(`${API}/leave-types/${id}`, { method: 'DELETE', headers: headers() });
        const data = await safeJson(res);
        if (data.success) loadLeaveTypes(); else alert(data.message);
    } catch(e) { alert('Error: ' + e.message); }
}

async function loadBalances() {
    const year = document.getElementById('balYear').value;
    try {
        const res = await fetch(`${API}/leave-balances?year=${year}`, { headers: headers() });
        const data = await safeJson(res);
        const rows = data.data || [];
        const tbody = document.getElementById('balBody');
        if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No balances</td></tr>'; return; }
        tbody.innerHTML = rows.map(r => `<tr>
            <td><strong>${r.emp_code}</strong> ${r.employee_name}</td>
            <td>${r.leave_type_name}</td>
            <td>${r.total_days}</td><td>${r.used_days}</td>
            <td>${r.pending_days}</td><td><strong>${r.balance_days}</strong></td>
        </tr>`).join('');
    } catch(e) {
        const tbody = document.getElementById('balBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="empty">Failed to load.</td></tr>';
    }
}

function openBalanceModal() { openModal('balanceModal'); }

async function saveBalance() {
    const body = {
        employee_id: document.getElementById('balEmp').value,
        leave_type_id: document.getElementById('balType').value,
        year: parseInt(document.getElementById('balYearInput').value),
        total_days: parseFloat(document.getElementById('balTotal').value) || 0,
        used_days: parseFloat(document.getElementById('balUsed').value) || 0
    };
    body.balance_days = body.total_days - body.used_days;
    if (!body.employee_id || !body.leave_type_id) { alert('Employee and leave type required'); return; }
    try {
        const res = await fetch(`${API}/leave-balances`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
        const data = await safeJson(res);
        if (data.success) { closeModal('balanceModal'); loadBalances(); } else { alert(data.message); }
    } catch(e) { alert('Error: ' + e.message); }
}

async function loadCalendar() {
    const month = document.getElementById('calMonth').value;
    const year = document.getElementById('calYear').value;
    try {
        const res = await fetch(`${API}/leave-calendar?month=${month}&year=${year}`, { headers: headers() });
        const data = await safeJson(res);
        const rows = data.data || [];
        const tbody = document.getElementById('calBody');
        if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No leaves this month</td></tr>'; return; }
        tbody.innerHTML = rows.map(r => `<tr>
            <td><strong>${r.emp_code}</strong> ${r.employee_name}</td>
            <td>${r.leave_type}</td><td>${r.start_date}</td><td>${r.end_date}</td>
            <td>${r.days}</td><td><span class="status-badge ${r.status}">${r.status}</span></td>
        </tr>`).join('');
    } catch(e) {
        const tbody = document.getElementById('calBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="empty">Failed to load.</td></tr>';
    }
}

async function loadHolidays() {
    const year = document.getElementById('holYear').value;
    try {
        const res = await fetch(`${API}/holidays?year=${year}`, { headers: headers() });
        const data = await safeJson(res);
        const rows = data.data || [];
        const tbody = document.getElementById('holBody');
        if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">No holidays</td></tr>'; return; }
        tbody.innerHTML = rows.map(r => `<tr>
            <td><strong>${r.name}</strong></td><td>${r.date}</td>
            <td>${r.holiday_type}</td><td>${r.location || 'All'}</td>
            <td class="actions-cell">
                <button class="btn-icon danger" onclick="deleteHoliday('${r.id}','${r.name}')"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>`).join('');
    } catch(e) {
        const tbody = document.getElementById('holBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="empty">Failed to load.</td></tr>';
    }
}

function openHolidayModal() { openModal('holidayModal'); }

async function saveHoliday() {
    const body = {
        name: document.getElementById('holName').value.trim(),
        date: document.getElementById('holDate').value,
        holiday_type: document.getElementById('holType').value,
        location: document.getElementById('holLocation').value.trim(),
        year: parseInt(document.getElementById('holYear2').value)
    };
    if (!body.name || !body.date) { alert('Name and date required'); return; }
    try {
        const res = await fetch(`${API}/holidays`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
        const data = await safeJson(res);
        if (data.success) { closeModal('holidayModal'); loadHolidays(); } else { alert(data.message); }
    } catch(e) { alert('Error: ' + e.message); }
}

async function deleteHoliday(id, name) {
    if (!confirm(`Delete holiday "${name}"?`)) return;
    try {
        const res = await fetch(`${API}/holidays/${id}`, { method: 'DELETE', headers: headers() });
        const data = await safeJson(res);
        if (data.success) loadHolidays(); else alert(data.message);
    } catch(e) { alert('Error: ' + e.message); }
}

document.addEventListener('DOMContentLoaded', () => {
    initYearSelects();
    loadEmpAndTypes();
    loadRequests();
});
