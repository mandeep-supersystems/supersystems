// ─── HR USER MANAGEMENT JS ───
let usersList = [];
let allEmployees = [];

async function safeJson(res) {
    try { return await res.json(); } catch(e) { return { success: false, message: 'Server error', data: [] }; }
}

function updateUserKPIs() {
    const kpiTot = document.getElementById('kpiTotalUsers');
    if (kpiTot) kpiTot.textContent = usersList.length;

    const adminCount = usersList.filter(u => u.hr_role === 'hr_admin' || u.hr_role === 'hr_manager').length;
    const kpiAdm = document.getElementById('kpiAdminCount');
    if (kpiAdm) kpiAdm.textContent = adminCount;

    const activeCount = usersList.filter(u => u.is_active).length;
    const inactiveCount = usersList.length - activeCount;
    const kpiAct = document.getElementById('kpiActiveUsers');
    if (kpiAct) kpiAct.textContent = activeCount;
    const kpiInact = document.getElementById('kpiInactiveUsers');
    if (kpiInact) kpiInact.textContent = `${inactiveCount} Inactive`;
}

async function loadEmployeesForDropdown() {
    try {
        const res = await fetch(`${API}/employees`, { headers: headers() });
        const d = await safeJson(res);
        allEmployees = d.data || [];
    } catch(e) { allEmployees = []; }
}

async function loadUsers() {
    try {
        const res = await fetch(`${API}/module-users`, { headers: headers() });
        const d = await safeJson(res);
        usersList = d.data || [];
        updateUserKPIs();
        renderUsers(usersList);
    } catch (e) {
        const tbody = document.getElementById('usersBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="empty">Failed to load users. Please run the HR migration SQL first.</td></tr>';
    }
}

function filterUsers() {
    const q = (document.getElementById('userSearchInput')?.value || '').toLowerCase().trim();
    const role = document.getElementById('userRoleFilter')?.value || '';
    const st = document.getElementById('userStatusFilter')?.value || '';

    const filtered = usersList.filter(u => {
        const matchesQ = !q || 
            (u.user_name && u.user_name.toLowerCase().includes(q)) ||
            (u.user_email && u.user_email.toLowerCase().includes(q)) ||
            (u.emp_code && u.emp_code.toLowerCase().includes(q)) ||
            (u.emp_full_name && u.emp_full_name.toLowerCase().includes(q)) ||
            (u.designation && u.designation.toLowerCase().includes(q)) ||
            (u.department && u.department.toLowerCase().includes(q));
        const matchesRole = !role || u.hr_role === role;
        const matchesSt = !st || (st === 'active' ? u.is_active : !u.is_active);
        return matchesQ && matchesRole && matchesSt;
    });
    renderUsers(filtered);
}

function renderUsers(list) {
    const tbody = document.getElementById('usersBody');
    if (!tbody) return;
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">No matching HR users found</td></tr>';
        return;
    }

    const rolePill = (role) => {
        if (role === 'hr_admin') return '<span class="hr-pill danger">HR Admin</span>';
        if (role === 'hr_manager') return '<span class="hr-pill warning">HR Manager</span>';
        if (role === 'rm') return '<span class="hr-pill info">Reporting Manager</span>';
        if (role === 'manager') return '<span class="hr-pill info">Manager</span>';
        return '<span class="hr-pill neutral">Employee (ESS)</span>';
    };

    tbody.innerHTML = list.map(u => {
        const empDisplay = u.emp_code
            ? `<div style="font-weight:600">${u.emp_full_name || u.emp_code}</div><div style="font-size:11px;color:var(--text-secondary)">${u.emp_code}</div>`
            : '<span style="color:var(--text-secondary)">—</span>';
        const deptDisplay = (u.designation || u.department)
            ? `<div>${u.designation || '—'}</div><div style="font-size:11px;color:var(--text-secondary)">${u.department || ''}</div>`
            : '<span style="color:var(--text-secondary)">—</span>';
        return `<tr>
            <td><strong>${u.user_name || '—'}</strong></td>
            <td>${u.user_email}</td>
            <td>${rolePill(u.hr_role)}</td>
            <td>${empDisplay}</td>
            <td>${deptDisplay}</td>
            <td>${u.is_active ? '<span class="hr-pill success">Active</span>' : '<span class="hr-pill neutral">Inactive</span>'}</td>
            <td>${u.created_at ? u.created_at.substring(0, 10) : '—'}</td>
            <td style="text-align:right">
                <div style="display:inline-flex;gap:4px">
                    <button class="btn-icon" title="Edit User" onclick="editUser('${u.id}')"><span class="material-icons-outlined">edit</span></button>
                    <button class="btn-icon danger" title="Remove User" onclick="removeUser('${u.id}','${u.user_email}')"><span class="material-icons-outlined">delete</span></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function _populateEmployeeDropdown(currentEmpId) {
    const sel = document.getElementById('userEmployeeLink');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Not linked to an employee —</option>'
        + allEmployees.map(e => `<option value="${e.id}" ${currentEmpId && e.id === currentEmpId ? 'selected' : ''}>${e.first_name} ${e.last_name || ''} (${e.emp_code})</option>`).join('');
}

function openUserModal() {
    document.getElementById('userId').value = '';
    document.getElementById('userModalTitle').textContent = 'Add HR User';
    document.getElementById('userEmail').value = '';
    document.getElementById('userName').value = '';
    document.getElementById('userRole').value = 'employee';
    document.getElementById('userActive').value = 'true';
    _populateEmployeeDropdown(null);
    openModal('userModal');
}

function editUser(id) {
    const u = usersList.find(x => x.id === id);
    if (!u) return;
    document.getElementById('userId').value = u.id;
    document.getElementById('userModalTitle').textContent = 'Edit HR User';
    document.getElementById('userEmail').value = u.user_email || '';
    document.getElementById('userName').value = u.user_name || '';
    document.getElementById('userRole').value = u.hr_role || 'employee';
    document.getElementById('userActive').value = String(u.is_active);
    _populateEmployeeDropdown(u.employee_id);
    openModal('userModal');
}

async function saveUser() {
    const id = document.getElementById('userId').value;
    const empLink = document.getElementById('userEmployeeLink')?.value || '';
    const body = {
        user_email: document.getElementById('userEmail').value.trim(),
        user_name: document.getElementById('userName').value.trim(),
        hr_role: document.getElementById('userRole').value,
        is_active: document.getElementById('userActive').value === 'true',
        employee_id: empLink || null
    };
    if (!body.user_email) { alert('Email is required'); return; }
    try {
        const url = id ? `${API}/module-users/${id}` : `${API}/module-users`;
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
        const d = await safeJson(res);
        if (d.success) { 
            closeModal('userModal'); 
            loadUsers(); 
        } else { 
            alert(d.message); 
        }
    } catch(e) { alert('Error: ' + e.message); }
}

async function removeUser(id, email) {
    if (!confirm(`Remove "${email}" from HR module?`)) return;
    try {
        const res = await fetch(`${API}/module-users/${id}`, { method: 'DELETE', headers: headers() });
        const d = await safeJson(res);
        if (d.success) loadUsers(); else alert(d.message);
    } catch(e) { alert('Error: ' + e.message); }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadEmployeesForDropdown();
    loadUsers();
});
