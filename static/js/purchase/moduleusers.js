// ─── PURCHASE MODULE: USER ACCESS MANAGEMENT ───
const PUR_SECTIONS = [
    { id: 'overview',     label: 'Overview',                icon: 'dashboard' },
    { id: 'demand',       label: 'Demand & Stock',          icon: 'calculate' },
    { id: 'suppliers',    label: 'Supplier SOP & SQP',      icon: 'storefront' },
    { id: 'requisitions', label: 'Req Orders (Requisitions)',icon: 'request_quote' },
    { id: 'orders',       label: 'Purchase Orders & Lead Time',icon: 'shopping_bag' },
    { id: 'auditlogs',    label: 'Audit Logs',              icon: 'history' },
    { id: 'moduleusers',  label: 'Module Users',            icon: 'people' }
];

const PUR_ENTITIES = [
    { id: 'customer_demands', label: 'Customer Demands & Stock Reservation' },
    { id: 'supplier_rules',   label: 'Supplier SOP & SQP Rules' },
    { id: 'requisitions',     label: 'Requisition Orders' },
    { id: 'purchase_orders',  label: 'Purchase Orders & Lead Time Tracking' },
    { id: 'user_management',  label: 'User Access Management' }
];

const PUR_ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'import'];

const PUR_ROLE_DEFAULT_SECTIONS = {
    module_admin: PUR_SECTIONS.map(s => s.id),
    editor:       ['overview', 'demand', 'suppliers', 'requisitions', 'orders', 'auditlogs'],
    viewer:       ['overview', 'orders']
};

const PUR_ROLE_DEFAULT_PERMS = {
    module_admin: () => { const p = {}; PUR_ENTITIES.forEach(e => p[e.id] = [...PUR_ACTIONS]); return p; },
    editor: () => { const p = {}; PUR_ENTITIES.forEach(e => p[e.id] = ['view', 'create', 'edit', 'export', 'import']); p['user_management'] = ['view']; return p; },
    viewer: () => { const p = {}; PUR_ENTITIES.forEach(e => p[e.id] = ['view', 'export']); return p; }
};

function renderSectionCheckboxes(containerId, checkedSections) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = PUR_SECTIONS.map(s => `
        <label class="section-check-label" style="display:inline-flex; align-items:center; gap:6px; margin-right:12px; margin-bottom:6px;">
            <input type="checkbox" value="${s.id}" ${checkedSections.includes(s.id)?'checked':''}>
            <span class="material-icons-outlined" style="font-size:16px;">${s.icon}</span>${s.label}
        </label>
    `).join('');
}

function renderPermMatrix(containerId, entityPerms) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
        <table class="data-table" style="font-size:12px;">
            <thead>
                <tr>
                    <th>Entity</th>
                    ${PUR_ACTIONS.map(a => `<th style="text-align:center;">${a}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${PUR_ENTITIES.map(e => {
                    const perms = entityPerms[e.id] || [];
                    return `
                        <tr>
                            <td><strong>${e.label}</strong></td>
                            ${PUR_ACTIONS.map(a => `
                                <td style="text-align:center;">
                                    <input type="checkbox" class="perm-cb" data-entity="${e.id}" data-action="${a}" ${perms.includes(a)?'checked':''}>
                                </td>
                            `).join('')}
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function collectPermissions(containerId) {
    const perms = {};
    document.getElementById(containerId).querySelectorAll('.perm-cb:checked').forEach(cb => {
        if (!perms[cb.dataset.entity]) perms[cb.dataset.entity] = [];
        perms[cb.dataset.entity].push(cb.dataset.action);
    });
    return perms;
}

function onMuRoleChange() {
    const role = document.getElementById('muRole').value;
    renderSectionCheckboxes('muSectionCheckboxes', PUR_ROLE_DEFAULT_SECTIONS[role] || []);
    renderPermMatrix('muPermMatrix', PUR_ROLE_DEFAULT_PERMS[role]());
}

function onEmuRoleChange() {
    const role = document.getElementById('emuRole').value;
    renderSectionCheckboxes('emuSectionCheckboxes', PUR_ROLE_DEFAULT_SECTIONS[role] || []);
    renderPermMatrix('emuPermMatrix', PUR_ROLE_DEFAULT_PERMS[role]());
}

async function loadModuleUsers() {
    const tbody = document.getElementById('moduleUsersBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/users', { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data || data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No users assigned access yet.</td></tr>';
            return;
        }
        tbody.innerHTML = data.data.map(u => {
            const name = (u.first_name + ' ' + u.last_name).trim() || u.email;
            const roleLabel = u.role === 'module_admin' ? 'Module Admin' : u.role === 'editor' ? 'Editor' : 'Viewer';
            const perms = typeof u.permissions === 'string' ? JSON.parse(u.permissions || '{}') : (u.permissions || {});
            const sections = (perms && perms.sections) ? perms.sections : PUR_ROLE_DEFAULT_SECTIONS[u.role] || [];
            const sectionTags = sections.map(s => `<span class="badge badge-info" style="margin-right:4px;">${s}</span>`).join('');
            const uData = encodeURIComponent(JSON.stringify({ id: u.id, email: u.email, first_name: u.first_name, last_name: u.last_name, role: u.role, permissions: perms }));

            return `
                <tr>
                    <td><strong>${name}</strong><div style="font-size:11px; color:var(--text-muted);">${u.email}</div></td>
                    <td><span class="badge ${u.role === 'module_admin' ? 'badge-primary' : 'badge-info'}">${roleLabel}</span></td>
                    <td><div>${sectionTags}</div></td>
                    <td><span class="badge badge-success">${u.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>${u.created_at || 'Just now'}</td>
                    <td>
                        <button class="btn-action" title="Edit Permissions" onclick="openEditModuleUser('${uData}')"><span class="material-icons-outlined">edit</span></button>
                        <button class="btn-action" title="Revoke Access" onclick="revokeModuleUser('${u.id}', '${u.email}')"><span class="material-icons-outlined">person_remove</span></button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error loading module users.</td></tr>';
    }
}

function openAddUserModal() {
    document.getElementById('muUserSearch').value = '';
    document.getElementById('muUserSelect').value = '';
    document.getElementById('muUserResults').innerHTML = '';
    document.getElementById('muUserSelected').style.display = 'none';
    document.getElementById('muRole').value = 'viewer';
    onMuRoleChange();
    document.getElementById('addModuleUserModal').classList.add('active');
}

async function searchEmployeesForModule(query) {
    const resultsDiv = document.getElementById('muUserResults');
    if (!query || query.trim().length < 2) { resultsDiv.innerHTML = ''; return; }
    try {
        const res = await fetch('/api/v1/security/search-employees?q=' + encodeURIComponent(query.trim()), { headers: HEADERS });
        const data = await res.json();
        if (!data.data || data.data.length === 0) {
            resultsDiv.innerHTML = '<div style="padding:8px; color:var(--text-muted);">No employees found</div>';
            return;
        }
        resultsDiv.innerHTML = data.data.map(e => `
            <div style="padding:8px; border-bottom:1px solid var(--border-color); cursor:pointer;" onclick="selectEmployeeForModule('${e.id}','${e.emp_code} - ${e.first_name} ${e.last_name} (${e.email || 'no email'})')">
                <strong>${e.emp_code}</strong> — ${e.first_name} ${e.last_name} (${e.email})
            </div>
        `).join('');
    } catch (e) { resultsDiv.innerHTML = ''; }
}

function selectEmployeeForModule(empId, label) {
    fetch('/api/v1/security/import-employee', { method: 'POST', headers: HEADERS, body: JSON.stringify({ employee_id: empId }) })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                document.getElementById('muUserSelect').value = data.data.id;
                document.getElementById('muUserSearch').value = '';
                document.getElementById('muUserResults').innerHTML = '';
                document.getElementById('muUserSelLabel').textContent = label;
                document.getElementById('muUserSelected').style.display = 'flex';
            } else { showToast(data.message || 'Failed', 'error'); }
        });
}

function clearMuUser() {
    document.getElementById('muUserSelect').value = '';
    document.getElementById('muUserSelected').style.display = 'none';
}

async function saveModuleUser(e) {
    e.preventDefault();
    const userId = document.getElementById('muUserSelect').value;
    const role = document.getElementById('muRole').value;
    if (!userId) { showToast('Select a user', 'error'); return; }
    const sections = [];
    document.querySelectorAll('#muSectionCheckboxes input:checked').forEach(cb => sections.push(cb.value));
    const permissions = { sections, entity_permissions: collectPermissions('muPermMatrix') };
    try {
        const res = await fetch(API + '/users', { method: 'POST', headers: HEADERS, body: JSON.stringify({ user_id: userId, role, permissions }) });
        const data = await res.json();
        if (data.success) {
            document.getElementById('addModuleUserModal').classList.remove('active');
            showToast('User access granted');
            loadModuleUsers();
        } else showToast(data.message || 'Failed', 'error');
    } catch (e) { showToast('Network error', 'error'); }
}

function openEditModuleUser(encodedData) {
    const u = JSON.parse(decodeURIComponent(encodedData));
    document.getElementById('emuAccessId').value = u.id;
    document.getElementById('emuUserName').textContent = `${u.first_name || ''} ${u.last_name || ''} (${u.email})`.trim();
    document.getElementById('emuRole').value = u.role;
    const sections = u.permissions.sections || PUR_ROLE_DEFAULT_SECTIONS[u.role] || [];
    renderSectionCheckboxes('emuSectionCheckboxes', sections);
    renderPermMatrix('emuPermMatrix', u.permissions.entity_permissions || PUR_ROLE_DEFAULT_PERMS[u.role]());
    document.getElementById('editModuleUserModal').classList.add('active');
}

async function saveEditModuleUser(e) {
    e.preventDefault();
    const accessId = document.getElementById('emuAccessId').value;
    const role = document.getElementById('emuRole').value;
    const sections = [];
    document.querySelectorAll('#emuSectionCheckboxes input:checked').forEach(cb => sections.push(cb.value));
    const permissions = { sections, entity_permissions: collectPermissions('emuPermMatrix') };
    try {
        const res = await fetch(API + '/users/' + accessId, { method: 'PUT', headers: HEADERS, body: JSON.stringify({ role, permissions }) });
        const data = await res.json();
        if (data.success) {
            document.getElementById('editModuleUserModal').classList.remove('active');
            showToast('User permissions updated');
            loadModuleUsers();
        } else showToast(data.message || 'Failed', 'error');
    } catch (e) { showToast('Network error', 'error'); }
}

async function revokeModuleUser(accessId, email) {
    if (!confirm(`Revoke access for ${email}?`)) return;
    try {
        const res = await fetch(API + '/users/' + accessId, { method: 'DELETE', headers: HEADERS });
        const data = await res.json();
        if (data.success) {
            showToast('Access revoked');
            loadModuleUsers();
        } else showToast(data.message || 'Failed', 'error');
    } catch (e) { showToast('Network error', 'error'); }
}
