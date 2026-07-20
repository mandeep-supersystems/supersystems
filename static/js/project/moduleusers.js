// ─── PROJECT MODULE: USER MANAGEMENT ───
const PROJECT_SECTIONS = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'projects', label: 'All Projects', icon: 'folder_special' },
    { id: 'addproject', label: 'Add Project', icon: 'add_circle' },
    { id: 'organizations', label: 'Organizations', icon: 'business' },
    { id: 'auditlogs', label: 'Audit Logs', icon: 'history' },
    { id: 'moduleusers', label: 'User Management', icon: 'manage_accounts' }
];
const PROJ_ROLE_SECTIONS = {
    module_admin: ['overview', 'projects', 'addproject', 'organizations', 'auditlogs', 'moduleusers'],
    editor: ['overview', 'projects', 'addproject', 'organizations', 'auditlogs'],
    viewer: ['overview', 'projects', 'organizations']
};
const PROJ_ENTITIES = [
    { id: 'projects', label: 'Projects' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'organizations', label: 'Organizations' },
    { id: 'purchase_orders', label: 'Purchase Orders' },
    { id: 'audit_logs', label: 'Audit Logs' },
    { id: 'user_management', label: 'User Management' }
];
const PROJ_ACTIONS = ['view', 'create', 'edit', 'delete', 'export'];
const PROJ_ROLE_PERMS = {
    module_admin: () => { const p = {}; PROJ_ENTITIES.forEach(e => p[e.id] = [...PROJ_ACTIONS]); return p; },
    editor: () => { const p = {}; PROJ_ENTITIES.forEach(e => p[e.id] = ['view', 'create', 'edit', 'export']); p['user_management'] = ['view']; return p; },
    viewer: () => { const p = {}; PROJ_ENTITIES.forEach(e => p[e.id] = ['view', 'export']); return p; }
};

function renderSectionCheckboxes(containerId, checkedSections) {
    document.getElementById(containerId).innerHTML = PROJECT_SECTIONS.map(s => `<label class="section-check-label"><input type="checkbox" value="${s.id}" ${checkedSections.includes(s.id)?'checked':''}><span class="material-icons-outlined" style="font-size:16px;">${s.icon}</span>${esc(s.label)}</label>`).join('');
}

function renderPermMatrix(containerId, entityPerms) {
    document.getElementById(containerId).innerHTML = `<table class="perm-matrix-table"><thead><tr><th>Entity</th>${PROJ_ACTIONS.map(a => `<th>${a}</th>`).join('')}<th>All</th></tr></thead><tbody>${PROJ_ENTITIES.map(e => { const perms = entityPerms[e.id] || []; return `<tr><td class="entity-label">${esc(e.label)}</td>${PROJ_ACTIONS.map(a => `<td><input type="checkbox" class="perm-cb" data-entity="${e.id}" data-action="${a}" ${perms.includes(a)?'checked':''}></td>`).join('')}<td><input type="checkbox" class="perm-row-toggle" data-entity="${e.id}" ${perms.length===PROJ_ACTIONS.length?'checked':''} onchange="togglePermRow(this,'${containerId}')"></td></tr>`; }).join('')}</tbody></table>`;
}

function togglePermRow(cb, containerId) { document.getElementById(containerId).querySelectorAll(`.perm-cb[data-entity="${cb.dataset.entity}"]`).forEach(c => c.checked = cb.checked); }
function collectPermissions(containerId) { const perms = {}; document.getElementById(containerId).querySelectorAll('.perm-cb:checked').forEach(cb => { if (!perms[cb.dataset.entity]) perms[cb.dataset.entity] = []; perms[cb.dataset.entity].push(cb.dataset.action); }); return perms; }

function onMuRoleChange() { const role = document.getElementById('muRole').value; renderSectionCheckboxes('muSectionCheckboxes', PROJ_ROLE_SECTIONS[role] || []); renderPermMatrix('muPermMatrix', PROJ_ROLE_PERMS[role]()); }
function onEmuRoleChange() { const role = document.getElementById('emuRole').value; renderSectionCheckboxes('emuSectionCheckboxes', PROJ_ROLE_SECTIONS[role] || []); renderPermMatrix('emuPermMatrix', PROJ_ROLE_PERMS[role]()); }

async function loadModuleUsers() {
    const tbody = document.getElementById('moduleUsersBody');
    try {
        const res = await fetch(API + '/users', { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data || data.data.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No users assigned yet.</td></tr>'; return; }
        tbody.innerHTML = data.data.map(u => {
            const name = (u.first_name + ' ' + u.last_name).trim() || u.email;
            const roleLabel = u.role === 'module_admin' ? 'Module Admin' : u.role === 'editor' ? 'Editor' : 'Viewer';
            const perms = typeof u.permissions === 'string' ? JSON.parse(u.permissions || '{}') : (u.permissions || {});
            const sections = (perms && perms.sections) ? perms.sections : PROJ_ROLE_SECTIONS[u.role] || [];
            const sectionTags = sections.map(s => { const sec = PROJECT_SECTIONS.find(ps => ps.id === s); return sec ? `<span class="section-tag">${sec.label}</span>` : ''; }).join('');
            const uData = encodeURIComponent(JSON.stringify({ id: u.id, email: u.email, first_name: u.first_name, last_name: u.last_name, role: u.role, permissions: perms }));
            return `<tr><td><strong>${esc(name)}</strong><div class="cell-sub">${esc(u.email)}</div></td><td><span class="role-badge role-${u.role === 'module_admin' ? 'admin' : u.role}">${roleLabel}</span></td><td><div class="section-tags-cell">${sectionTags}</div></td><td><span class="status-badge ${u.is_active?'status-active':'status-obsolete'}">${u.is_active?'Active':'Inactive'}</span></td><td>${formatTime(u.created_at)}</td><td class="actions-cell"><button class="btn-icon" onclick="openEditModuleUser('${uData}')"><span class="material-icons-outlined">edit</span></button><button class="btn-icon danger" onclick="revokeModuleUser('${u.id}','${esc(u.email)}')"><span class="material-icons-outlined">person_remove</span></button></td></tr>`;
        }).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="6" class="empty">Error loading users</td></tr>'; }
}

function openAddUserModal() { document.getElementById('muUserSearch').value = ''; document.getElementById('muUserSelect').value = ''; document.getElementById('muUserResults').innerHTML = ''; document.getElementById('muUserSelected').style.display = 'none'; document.getElementById('muRole').value = 'viewer'; onMuRoleChange(); openModal('addModuleUserModal'); }

async function searchEmployeesForProject(query) {
    const resultsDiv = document.getElementById('muUserResults');
    if (!query || query.trim().length < 2) { resultsDiv.innerHTML = ''; return; }
    try {
        const res = await fetch('/api/v1/security/search-employees?q=' + encodeURIComponent(query.trim()), { headers: HEADERS });
        const data = await res.json();
        if (!data.data || data.data.length === 0) { resultsDiv.innerHTML = '<div class="emp-search-empty">No employees found</div>'; return; }
        resultsDiv.innerHTML = data.data.map(e => `<div class="emp-search-item" onclick="selectEmployeeForProject('${e.id}','${esc(e.emp_code)} - ${esc(e.first_name)} ${esc(e.last_name)} (${esc(e.email || 'no email')})')"><div class="emp-search-main"><strong>${esc(e.emp_code)}</strong> — ${esc(e.first_name)} ${esc(e.last_name)}</div><div class="emp-search-sub">${esc(e.email || 'No email')}</div></div>`).join('');
    } catch (e) { resultsDiv.innerHTML = ''; }
}

function selectEmployeeForProject(empId, label) {
    fetch('/api/v1/security/import-employee', { method: 'POST', headers: HEADERS, body: JSON.stringify({ employee_id: empId }) }).then(r => r.json()).then(data => {
        if (data.success) { document.getElementById('muUserSelect').value = data.data.id; document.getElementById('muUserSearch').value = ''; document.getElementById('muUserResults').innerHTML = ''; document.getElementById('muUserSelLabel').textContent = label; document.getElementById('muUserSelected').style.display = 'flex'; }
        else { alert(data.message || 'Failed'); }
    });
}
function clearMuUser() { document.getElementById('muUserSelect').value = ''; document.getElementById('muUserSelected').style.display = 'none'; }

async function saveModuleUser(e) {
    e.preventDefault();
    const userId = document.getElementById('muUserSelect').value;
    const role = document.getElementById('muRole').value;
    if (!userId) { alert('Select a user'); return; }
    const sections = []; document.querySelectorAll('#muSectionCheckboxes input:checked').forEach(cb => sections.push(cb.value));
    const permissions = { sections, entity_permissions: collectPermissions('muPermMatrix') };
    const res = await fetch(API + '/users', { method: 'POST', headers: HEADERS, body: JSON.stringify({ user_id: userId, role, permissions }) });
    const data = await res.json();
    if (data.success) { closeModal('addModuleUserModal'); loadModuleUsers(); } else { alert(data.message); }
}

function openEditModuleUser(encodedData) {
    const u = JSON.parse(decodeURIComponent(encodedData));
    document.getElementById('emuAccessId').value = u.id;
    document.getElementById('emuUserName').textContent = `${u.first_name || ''} ${u.last_name || ''} (${u.email})`.trim();
    document.getElementById('emuRole').value = u.role;
    const perms = u.permissions || {};
    renderSectionCheckboxes('emuSectionCheckboxes', perms.sections || PROJ_ROLE_SECTIONS[u.role] || []);
    renderPermMatrix('emuPermMatrix', perms.entity_permissions || PROJ_ROLE_PERMS[u.role]());
    openModal('editModuleUserModal');
}

async function saveEditModuleUser(e) {
    e.preventDefault();
    const accessId = document.getElementById('emuAccessId').value;
    const role = document.getElementById('emuRole').value;
    const sections = []; document.querySelectorAll('#emuSectionCheckboxes input:checked').forEach(cb => sections.push(cb.value));
    const permissions = { sections, entity_permissions: collectPermissions('emuPermMatrix') };
    const res = await fetch(API + '/users/' + accessId, { method: 'PUT', headers: HEADERS, body: JSON.stringify({ role, permissions }) });
    const data = await res.json();
    if (data.success) { closeModal('editModuleUserModal'); loadModuleUsers(); } else { alert(data.message); }
}

async function revokeModuleUser(accessId, email) {
    if (!confirm(`Revoke access for "${email}"?`)) return;
    const res = await fetch(API + '/users/' + accessId, { method: 'DELETE', headers: HEADERS });
    const data = await res.json();
    if (data.success) loadModuleUsers(); else alert(data.message);
}
