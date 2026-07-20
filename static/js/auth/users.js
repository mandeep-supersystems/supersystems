// ─── AUTH & SECURITY: USERS ───

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    try {
        const res = await fetch(SEC_API + '/users', { headers: SEC_HEADERS });
        const data = await res.json();
        if (!data.success || !data.data || data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty">No users found. Click "Create User" to add one.</td></tr>';
            return;
        }
        tbody.innerHTML = data.data.map(u => {
            const name = ((u.first_name || '') + ' ' + (u.last_name || '')).trim() || '-';
            const statusClass = u.is_active ? 'status-active' : 'status-inactive';
            const statusLabel = u.is_active ? 'Active' : 'Inactive';
            return `<tr>
                <td><strong>${esc(name)}</strong></td>
                <td><code>${esc(u.email)}</code></td>
                <td>${esc(u.phone || '-')}</td>
                <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                <td>${formatTime(u.created_at)}</td>
                <td class="actions-cell">
                    <button class="btn-action" onclick="openEditUserModal('${esc(u.id)}','${esc(u.first_name)}','${esc(u.last_name)}','${esc(u.phone)}','${u.is_active}')" title="Edit">
                        <span class="material-icons-outlined">edit</span>
                    </button>
                    <button class="btn-action btn-danger" onclick="confirmSecDelete('user','${u.id}','Delete user ${esc(u.email)}? This will also revoke all module access.')" title="Delete">
                        <span class="material-icons-outlined">delete</span>
                    </button>
                </td>
            </tr>`;
        }).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="6" class="empty">Error loading users</td></tr>'; }
}

function openCreateUserModal() {
    document.getElementById('cuFirstName').value = '';
    document.getElementById('cuLastName').value = '';
    document.getElementById('cuEmail').value = '';
    document.getElementById('cuPhone').value = '';
    document.getElementById('cuPassword').value = '';
    secOpenModal('createUserModal');
}

async function saveUser(e) {
    e.preventDefault();
    const firstName = document.getElementById('cuFirstName').value.trim();
    const lastName = document.getElementById('cuLastName').value.trim();
    const email = document.getElementById('cuEmail').value.trim().toLowerCase();
    const phone = document.getElementById('cuPhone').value.trim();
    const password = document.getElementById('cuPassword').value;

    if (!email || !password) { secToast('Email and password required', 'error'); return; }

    try {
        const res = await fetch(SEC_API + '/users', {
            method: 'POST', headers: SEC_HEADERS,
            body: JSON.stringify({ first_name: firstName, last_name: lastName, email, phone, password })
        });
        const data = await res.json();
        if (data.success) {
            secCloseModal('createUserModal');
            secToast('User created successfully');
            loadUsers();
            if (typeof loadSecOverview === 'function') loadSecOverview();
            if (typeof loadPermUsers === 'function') loadPermUsers();
        } else {
            secToast(data.message || 'Failed to create user', 'error');
        }
    } catch (e) { secToast('Network error', 'error'); }
}

let selectedEmployeeId = null;

function openImportEmployeeModal() {
    document.getElementById('ieSearch').value = '';
    document.getElementById('ieResults').innerHTML = '';
    document.getElementById('ieSelected').style.display = 'none';
    selectedEmployeeId = null;
    secOpenModal('importEmployeeModal');
}

async function searchEmployeesForImport(query) {
    const resultsDiv = document.getElementById('ieResults');
    if (!query || query.trim().length < 2) { resultsDiv.innerHTML = ''; return; }
    try {
        const res = await fetch(SEC_API + '/search-employees?q=' + encodeURIComponent(query.trim()), { headers: SEC_HEADERS });
        const data = await res.json();
        if (!data.data || data.data.length === 0) {
            resultsDiv.innerHTML = '<div class="emp-search-empty">No employees found</div>';
            return;
        }
        resultsDiv.innerHTML = data.data.map(e => `
            <div class="emp-search-item" onclick="selectEmployeeForImport('${e.id}','${esc(e.first_name)} ${esc(e.last_name)}','${esc(e.emp_code)}','${esc(e.email)}','${esc(e.designation)}')">
                <div class="emp-search-main"><strong>${esc(e.emp_code)}</strong> — ${esc(e.first_name)} ${esc(e.last_name)}</div>
                <div class="emp-search-sub">${esc(e.email || 'No email')} · ${esc(e.designation || '')}</div>
            </div>
        `).join('');
    } catch (e) { resultsDiv.innerHTML = '<div class="emp-search-empty">Error searching</div>'; }
}

function selectEmployeeForImport(id, name, code, email, designation) {
    selectedEmployeeId = id;
    document.getElementById('ieResults').innerHTML = '';
    document.getElementById('ieSearch').value = '';
    document.getElementById('ieSelName').textContent = `${code} — ${name}`;
    document.getElementById('ieSelDetails').textContent = `${email || 'No email'} · ${designation}`;
    document.getElementById('ieSelected').style.display = 'flex';
}

async function confirmImportEmployee() {
    if (!selectedEmployeeId) return;
    try {
        const res = await fetch(SEC_API + '/import-employee', {
            method: 'POST', headers: SEC_HEADERS,
            body: JSON.stringify({ employee_id: selectedEmployeeId })
        });
        const data = await res.json();
        if (data.success) {
            secCloseModal('importEmployeeModal');
            if (data.data.already_exists) {
                secToast('User already exists: ' + data.data.email);
            } else {
                secToast(`User created! Email: ${data.data.email}, Default password: ${data.data.default_password}`);
            }
            loadUsers();
            if (typeof loadSecOverview === 'function') loadSecOverview();
            if (typeof loadPermUsers === 'function') loadPermUsers();
        } else { secToast(data.message || 'Failed', 'error'); }
    } catch (e) { secToast('Network error', 'error'); }
}

function openEditUserModal(id, firstName, lastName, phone, isActive) {
    document.getElementById('euId').value = id;
    document.getElementById('euFirstName').value = firstName || '';
    document.getElementById('euLastName').value = lastName || '';
    document.getElementById('euPhone').value = phone || '';
    document.getElementById('euPassword').value = '';
    document.getElementById('euStatus').value = isActive;
    secOpenModal('editUserModal');
}

async function updateUser(e) {
    e.preventDefault();
    const id = document.getElementById('euId').value;
    const body = {
        first_name: document.getElementById('euFirstName').value.trim(),
        last_name: document.getElementById('euLastName').value.trim(),
        phone: document.getElementById('euPhone').value.trim(),
        is_active: document.getElementById('euStatus').value === 'true'
    };
    const pwd = document.getElementById('euPassword').value;
    if (pwd) body.password = pwd;

    try {
        const res = await fetch(SEC_API + '/users/' + id, { method: 'PUT', headers: SEC_HEADERS, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.success) { secCloseModal('editUserModal'); secToast('User updated'); loadUsers(); }
        else secToast(data.message || 'Update failed', 'error');
    } catch (e) { secToast('Network error', 'error'); }
}

function exportUsers() {
    const rows = document.querySelectorAll('#usersTableBody tr');
    if (!rows.length || rows[0].querySelector('.empty')) { secToast('No data to export', 'error'); return; }
    let csv = 'Name,Email,Phone,Status,Created\n';
    rows.forEach(tr => {
        const tds = tr.querySelectorAll('td');
        if (tds.length >= 5) {
            csv += Array.from(tds).slice(0, 5).map(td => `"${td.textContent.trim()}"`).join(',') + '\n';
        }
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'users_export.csv';
    link.click();
    secToast('Users exported');
}
