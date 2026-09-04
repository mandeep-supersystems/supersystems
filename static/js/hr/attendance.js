// ─── ATTENDANCE JS ───
let shiftsList = [], employeesList = [];

async function safeJson(res) {
    try { return await res.json(); } catch(e) { return { success: false, message: 'Server error (run HR migration SQL)', data: [] }; }
}

function showTab(name) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.section-actions button').forEach(b => {
        if (b.getAttribute('onclick') && b.getAttribute('onclick').includes(`'${name}'`)) {
            b.classList.remove('btn-outline');
            b.classList.add('btn-primary');
        } else if (b.getAttribute('onclick') && b.getAttribute('onclick').includes('showTab')) {
            b.classList.remove('btn-primary');
            b.classList.add('btn-outline');
        }
    });
    const panel = document.getElementById('tab-' + name);
    if (panel) panel.classList.add('active');
    if (name === 'attendance') loadAttendance();
    if (name === 'shifts') loadShifts();
    if (name === 'roster') loadRoster();
    if (name === 'regularization') loadRegularization();
    if (name === 'summary') loadSummary();
}

function initMonthYearSelects() {
    const now = new Date();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    ['attMonth','rosterMonth','sumMonth'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = months.map((m, i) => `<option value="${i+1}" ${i+1===now.getMonth()+1?'selected':''}>${m}</option>`).join('');
    });
    ['attYear','rosterYear','sumYear'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = [now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1]
            .map(y => `<option value="${y}" ${y===now.getFullYear()?'selected':''}>${y}</option>`).join('');
    });
}

async function loadEmployeesForSelects() {
    try {
        const res = await fetch(API + '/employees', { headers: headers() });
        const data = await safeJson(res);
        employeesList = data.data || [];
        const opts = '<option value="">Select Employee</option>' + employeesList.map(e => `<option value="${e.id}">${e.emp_code} - ${e.first_name} ${e.last_name||''}</option>`).join('');
        ['ciEmp','rosterEmp','regEmp'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = opts; });
    } catch(e) { console.warn('loadEmployeesForSelects:', e.message); }
}

async function loadShifts() {
    try {
        const res = await fetch(API + '/shifts', { headers: headers() });
        const data = await safeJson(res);
        shiftsList = data.data || [];
        const tbody = document.getElementById('shiftsBody');
        if (!shiftsList.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No shifts defined</td></tr>'; return; }
        tbody.innerHTML = shiftsList.map(s => `<tr>
            <td><strong>${s.name}</strong></td>
            <td>${s.start_time}</td><td>${s.end_time}</td>
            <td>${s.break_minutes}</td>
            <td>${s.is_night_shift ? '<span class="status-badge active">Yes</span>' : 'No'}</td>
            <td class="actions-cell">
                <button class="btn-icon" onclick="editShift('${s.id}')"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-icon danger" onclick="deleteShift('${s.id}','${s.name}')"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>`).join('');
        const rSel = document.getElementById('rosterShift');
        if (rSel) rSel.innerHTML = '<option value="">Select Shift</option>' + shiftsList.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    } catch(e) {
        const tbody = document.getElementById('shiftsBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="empty">Failed to load. Run HR migration SQL first.</td></tr>';
    }
}

function openShiftModal() {
    document.getElementById('shiftId').value = '';
    document.getElementById('shiftModalTitle').textContent = 'New Shift';
    ['shiftName','shiftStart','shiftEnd'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('shiftBreak').value = 30;
    document.getElementById('shiftNight').value = 'false';
    openModal('shiftModal');
}

function editShift(id) {
    const s = shiftsList.find(x => x.id === id);
    if (!s) return;
    document.getElementById('shiftId').value = s.id;
    document.getElementById('shiftModalTitle').textContent = 'Edit Shift';
    document.getElementById('shiftName').value = s.name;
    document.getElementById('shiftStart').value = s.start_time;
    document.getElementById('shiftEnd').value = s.end_time;
    document.getElementById('shiftBreak').value = s.break_minutes;
    document.getElementById('shiftNight').value = String(s.is_night_shift);
    openModal('shiftModal');
}

async function saveShift() {
    const id = document.getElementById('shiftId').value;
    const body = {
        name: document.getElementById('shiftName').value.trim(),
        start_time: document.getElementById('shiftStart').value,
        end_time: document.getElementById('shiftEnd').value,
        break_minutes: parseInt(document.getElementById('shiftBreak').value) || 30,
        is_night_shift: document.getElementById('shiftNight').value === 'true'
    };
    if (!body.name || !body.start_time || !body.end_time) { alert('Name, start and end time required'); return; }
    try {
        const url = id ? `${API}/shifts/${id}` : `${API}/shifts`;
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) });
        const data = await safeJson(res);
        if (data.success) { closeModal('shiftModal'); loadShifts(); } else { alert(data.message); }
    } catch(e) { alert('Error: ' + e.message); }
}

async function deleteShift(id, name) {
    if (!confirm(`Delete shift "${name}"?`)) return;
    try {
        const res = await fetch(`${API}/shifts/${id}`, { method: 'DELETE', headers: headers() });
        const data = await safeJson(res);
        if (data.success) loadShifts(); else alert(data.message);
    } catch(e) { alert('Error: ' + e.message); }
}

async function loadAttendance() {
    const month = document.getElementById('attMonth').value;
    const year = document.getElementById('attYear').value;
    const empFilter = document.getElementById('attEmpFilter')?.value.toLowerCase() || '';
    try {
        const res = await fetch(`${API}/attendance?month=${month}&year=${year}`, { headers: headers() });
        const data = await safeJson(res);
        let rows = data.data || [];
        if (empFilter) rows = rows.filter(r => r.employee_name.toLowerCase().includes(empFilter) || r.emp_code.toLowerCase().includes(empFilter));
        const tbody = document.getElementById('attendanceBody');
        if (!rows.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No attendance records</td></tr>'; return; }
        tbody.innerHTML = rows.map(r => `<tr>
            <td><strong>${r.emp_code}</strong> ${r.employee_name}</td>
            <td>${r.date}</td>
            <td>${r.check_in ? r.check_in.replace('T',' ').substring(0,16) : '—'}</td>
            <td>${r.check_out ? r.check_out.replace('T',' ').substring(0,16) : '—'}</td>
            <td>${r.hours_worked ? r.hours_worked.toFixed(1)+'h' : '—'}</td>
            <td>${r.check_in_method || 'web'}</td>
            <td><span class="status-badge ${r.status}">${r.status}</span></td>
            <td class="actions-cell">
                <button class="btn-icon" title="Edit Status" onclick="editAttStatus('${r.id}','${r.status}')"><span class="material-icons-outlined">edit</span></button>
            </td>
        </tr>`).join('');
    } catch(e) {
        const tbody = document.getElementById('attendanceBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="empty">Failed to load. Run HR migration SQL first.</td></tr>';
    }
}

async function editAttStatus(id, currentStatus) {
    const status = prompt('Update status (present/absent/half_day/holiday/leave):', currentStatus);
    if (!status) return;
    try {
        const res = await fetch(`${API}/attendance/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify({ status }) });
        const data = await safeJson(res);
        if (data.success) loadAttendance(); else alert(data.message);
    } catch(e) { alert('Error: ' + e.message); }
}

function openCheckinModal() {
    document.getElementById('ciDate').value = new Date().toISOString().split('T')[0];
    openModal('checkinModal');
}

async function submitCheckin() {
    const emp = document.getElementById('ciEmp').value;
    const date = document.getElementById('ciDate').value;
    const action = document.getElementById('ciAction').value;
    if (!emp || !date) { alert('Select employee and date'); return; }
    try {
        const res = await fetch(`${API}/attendance/${action}`, { method: 'POST', headers: headers(), body: JSON.stringify({ employee_id: emp, date }) });
        const data = await safeJson(res);
        if (data.success) { closeModal('checkinModal'); loadAttendance(); alert(data.message); } else { alert(data.message); }
    } catch(e) { alert('Error: ' + e.message); }
}

async function loadRoster() {
    const month = document.getElementById('rosterMonth').value;
    const year = document.getElementById('rosterYear').value;
    try {
        const res = await fetch(`${API}/roster?month=${month}&year=${year}`, { headers: headers() });
        const data = await safeJson(res);
        const rows = data.data || [];
        const tbody = document.getElementById('rosterBody');
        if (!rows.length) { tbody.innerHTML = '<tr><td colspan="3" class="empty">No roster assigned</td></tr>'; return; }
        tbody.innerHTML = rows.map(r => `<tr>
            <td><strong>${r.emp_code}</strong> ${r.employee_name}</td>
            <td>${r.roster_date}</td><td>${r.shift_name}</td>
        </tr>`).join('');
    } catch(e) {
        const tbody = document.getElementById('rosterBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="empty">Failed to load.</td></tr>';
    }
}

function openRosterModal() {
    document.getElementById('rosterDate').value = new Date().toISOString().split('T')[0];
    openModal('rosterModal');
}

async function saveRoster() {
    const body = {
        employee_id: document.getElementById('rosterEmp').value,
        shift_id: document.getElementById('rosterShift').value,
        roster_date: document.getElementById('rosterDate').value
    };
    if (!body.employee_id || !body.shift_id || !body.roster_date) { alert('All fields required'); return; }
    try {
        const res = await fetch(`${API}/roster`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
        const data = await safeJson(res);
        if (data.success) { closeModal('rosterModal'); loadRoster(); } else { alert(data.message); }
    } catch(e) { alert('Error: ' + e.message); }
}

async function loadRegularization() {
    try {
        const res = await fetch(`${API}/regularization`, { headers: headers() });
        const data = await safeJson(res);
        const rows = data.data || [];
        const tbody = document.getElementById('regBody');
        if (!rows.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No requests</td></tr>'; return; }
        tbody.innerHTML = rows.map(r => `<tr>
            <td><strong>${r.emp_code}</strong> ${r.employee_name}</td>
            <td>${r.attendance_date}</td>
            <td>${r.requested_check_in ? r.requested_check_in.replace('T',' ').substring(0,16) : '—'}</td>
            <td>${r.requested_check_out ? r.requested_check_out.replace('T',' ').substring(0,16) : '—'}</td>
            <td>${r.reason}</td>
            <td><span class="status-badge ${r.status}">${r.status}</span></td>
            <td class="actions-cell">
                ${r.status === 'pending' ? `
                <button class="btn-icon" title="Approve" onclick="approveReg('${r.id}')"><span class="material-icons-outlined" style="color:#4caf50">check_circle</span></button>
                <button class="btn-icon danger" title="Reject" onclick="rejectReg('${r.id}')"><span class="material-icons-outlined">cancel</span></button>
                ` : '—'}
            </td>
        </tr>`).join('');
    } catch(e) {
        const tbody = document.getElementById('regBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="empty">Failed to load.</td></tr>';
    }
}

function openRegModal() {
    document.getElementById('regDate').value = new Date().toISOString().split('T')[0];
    openModal('regModal');
}

async function saveReg() {
    const body = {
        employee_id: document.getElementById('regEmp').value,
        attendance_date: document.getElementById('regDate').value,
        requested_check_in: document.getElementById('regCI').value || null,
        requested_check_out: document.getElementById('regCO').value || null,
        reason: document.getElementById('regReason').value.trim()
    };
    if (!body.employee_id || !body.attendance_date || !body.reason) { alert('Employee, date and reason required'); return; }
    try {
        const res = await fetch(`${API}/regularization`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
        const data = await safeJson(res);
        if (data.success) { closeModal('regModal'); loadRegularization(); } else { alert(data.message); }
    } catch(e) { alert('Error: ' + e.message); }
}

async function approveReg(id) {
    if (!confirm('Approve this regularization request?')) return;
    try {
        const res = await fetch(`${API}/regularization/${id}/approve`, { method: 'POST', headers: headers() });
        const data = await safeJson(res);
        if (data.success) loadRegularization(); else alert(data.message);
    } catch(e) { alert('Error: ' + e.message); }
}

async function rejectReg(id) {
    if (!confirm('Reject this request?')) return;
    try {
        const res = await fetch(`${API}/regularization/${id}/reject`, { method: 'POST', headers: headers() });
        const data = await safeJson(res);
        if (data.success) loadRegularization(); else alert(data.message);
    } catch(e) { alert('Error: ' + e.message); }
}

async function loadSummary() {
    const month = document.getElementById('sumMonth').value;
    const year = document.getElementById('sumYear').value;
    try {
        const res = await fetch(`${API}/attendance/summary?month=${month}&year=${year}`, { headers: headers() });
        const data = await safeJson(res);
        const rows = data.data || [];
        const tbody = document.getElementById('summaryBody');
        if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No data</td></tr>'; return; }
        tbody.innerHTML = rows.map(r => `<tr>
            <td><strong>${r.emp_code}</strong> ${r.name}</td>
            <td>${r.present}</td><td>${r.absent}</td><td>${r.half_day}</td>
            <td>${r.on_leave}</td><td>${r.avg_hours}h</td>
        </tr>`).join('');
    } catch(e) {
        const tbody = document.getElementById('summaryBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="empty">Failed to load.</td></tr>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initMonthYearSelects();
    loadEmployeesForSelects();
    loadShifts();
    loadAttendance();
});
