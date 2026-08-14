// ─── PLANNING MODULE: USER ACCESS MANAGEMENT ───
const PL_SECTIONS = [
    { id: 'overview',          label: 'Overview',          icon: 'dashboard' },
    { id: 'customer-orders',   label: 'Generate PR',       icon: 'shopping_bag' },
    { id: 'purchase-requests', label: 'Purchase Requests', icon: 'add_shopping_cart' },
    { id: 'auditlogs',         label: 'Audit Logs',         icon: 'history' },
    { id: 'moduleusers',       label: 'User Management',   icon: 'people' },
    { id: 'notifications',     label: 'Notifications',     icon: 'notifications' }
];

const PL_ENTITIES = [
    { id: 'overview',          label: 'Overview' },
    { id: 'customer_orders',   label: 'Customer Orders / PR Gen' },
    { id: 'purchase_requests', label: 'Purchase Requests' },
    { id: 'audit_logs',        label: 'Audit Logs' },
    { id: 'user_management',   label: 'User Access Management' },
    { id: 'notifications',     label: 'Notifications' }
];

const PL_ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'import'];

const PL_ROLE_DEFAULT_SECTIONS = {
    module_admin: PL_SECTIONS.map(s => s.id),
    editor:       ['overview', 'customer-orders', 'purchase-requests', 'auditlogs', 'notifications'],
    viewer:       ['overview', 'customer-orders', 'purchase-requests']
};

const PL_ROLE_DEFAULT_PERMS = {
    module_admin: () => { const p = {}; PL_ENTITIES.forEach(e => p[e.id] = [...PL_ACTIONS]); return p; },
    editor: () => { const p = {}; PL_ENTITIES.forEach(e => p[e.id] = ['view', 'create', 'edit', 'export', 'import']); p['user_management'] = ['view']; return p; },
    viewer: () => { const p = {}; PL_ENTITIES.forEach(e => p[e.id] = ['view', 'export']); return p; }
};

function renderSectionCheckboxes(containerId, checkedSections) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = PL_SECTIONS.map(s => `
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
                    ${PL_ACTIONS.map(a => `<th style="text-align:center;">${a}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${PL_ENTITIES.map(e => {
                    const perms = entityPerms[e.id] || [];
                    return `
                        <tr>
                            <td><strong>${e.label}</strong></td>
                            ${PL_ACTIONS.map(a => `
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
    renderSectionCheckboxes('muSectionCheckboxes', PL_ROLE_DEFAULT_SECTIONS[role] || []);
    renderPermMatrix('muPermMatrix', PL_ROLE_DEFAULT_PERMS[role]());
}

function onEmuRoleChange() {
    const role = document.getElementById('emuRole').value;
    renderSectionCheckboxes('emuSectionCheckboxes', PL_ROLE_DEFAULT_SECTIONS[role] || []);
    renderPermMatrix('emuPermMatrix', PL_ROLE_DEFAULT_PERMS[role]());
}

async function loadModuleUsers() {
    const tbody = document.getElementById('moduleUsersBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/users', { headers: H() });
        const data = await res.json();
        if (!data.success || !data.data || data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No users assigned access yet.</td></tr>';
            return;
        }
        tbody.innerHTML = data.data.map(u => {
            const name = ((u.first_name || '') + ' ' + (u.last_name || '')).trim() || u.email;
            const roleLabel = u.role === 'module_admin' ? 'Module Admin' : u.role === 'editor' ? 'Editor' : 'Viewer';
            const perms = typeof u.permissions === 'string' ? JSON.parse(u.permissions || '{}') : (u.permissions || {});
            const sections = (perms && perms.sections) ? perms.sections : PL_ROLE_DEFAULT_SECTIONS[u.role] || [];
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
        const res = await fetch('/api/v1/security/search-employees?q=' + encodeURIComponent(query.trim()), { headers: H() });
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
    fetch('/api/v1/security/import-employee', { method: 'POST', headers: H(), body: JSON.stringify({ employee_id: empId }) })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                document.getElementById('muUserSelect').value = data.data.id;
                document.getElementById('muUserSearch').value = '';
                document.getElementById('muUserResults').innerHTML = '';
                document.getElementById('muUserSelLabel').textContent = label;
                document.getElementById('muUserSelected').style.display = 'flex';
            } else { alert(data.message || 'Failed'); }
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
    if (!userId) { alert('Select a user'); return; }
    const sections = [];
    document.querySelectorAll('#muSectionCheckboxes input:checked').forEach(cb => sections.push(cb.value));
    const permissions = { sections, entity_permissions: collectPermissions('muPermMatrix') };
    try {
        const res = await fetch(API + '/users', { method: 'POST', headers: H(), body: JSON.stringify({ user_id: userId, role, permissions }) });
        const data = await res.json();
        if (data.success) {
            document.getElementById('addModuleUserModal').classList.remove('active');
            alert('User access granted');
            loadModuleUsers();
        } else alert(data.message || 'Failed');
    } catch (err) { alert('Error: ' + err.message); }
}

function openEditModuleUser(uDataEscaped) {
    const u = JSON.parse(decodeURIComponent(uDataEscaped));
    document.getElementById('emuAccessId').value = u.id;
    document.getElementById('emuUserName').textContent = `${u.first_name} ${u.last_name} (${u.email})`;
    document.getElementById('emuRole').value = u.role;
    const sections = u.permissions?.sections || PL_ROLE_DEFAULT_SECTIONS[u.role] || [];
    const entityPerms = u.permissions?.entity_permissions || PL_ROLE_DEFAULT_PERMS[u.role]();
    renderSectionCheckboxes('emuSectionCheckboxes', sections);
    renderPermMatrix('emuPermMatrix', entityPerms);
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
        const res = await fetch(API + '/users/' + accessId, { method: 'PUT', headers: H(), body: JSON.stringify({ role, permissions }) });
        const data = await res.json();
        if (data.success) {
            document.getElementById('editModuleUserModal').classList.remove('active');
            alert('User permissions updated');
            loadModuleUsers();
        } else alert(data.message || 'Failed');
    } catch (err) { alert('Error: ' + err.message); }
}

async function revokeModuleUser(accessId, email) {
    if (!confirm(`Are you sure you want to revoke Planning module access for ${email}?`)) return;
    try {
        const res = await fetch(API + '/users/' + accessId, { method: 'DELETE', headers: H() });
        const data = await res.json();
        if (data.success) {
            alert('Access revoked');
            loadModuleUsers();
        } else alert(data.message || 'Failed');
    } catch (err) { alert('Error: ' + err.message); }
}
