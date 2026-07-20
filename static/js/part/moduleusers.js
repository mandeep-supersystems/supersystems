// ─── PART MODULE: USER MANAGEMENT ───
const ROLE_DEFAULT_SECTIONS = {
    module_admin: ['overview', 'categories', 'subcategories', 'generate', 'allparts', 'partmapping', 'auditlogs', 'obsolete', 'moduleusers'],
    editor:       ['overview', 'categories', 'subcategories', 'generate', 'allparts', 'partmapping', 'auditlogs', 'obsolete'],
    viewer:       ['overview', 'allparts', 'obsolete']
};
const PART_ENTITIES = [
    { id: 'categories',         label: 'Categories' },
    { id: 'subcategories',      label: 'Subcategories' },
    { id: 'parts',              label: 'Parts (Generate)' },
    { id: 'generate_part_code', label: 'Generate Part Code' },
    { id: 'part_mapping',       label: 'Part Mapping' },
    { id: 'obsolete_parts',     label: 'Obsolete Parts' },
    { id: 'audit_logs',         label: 'Audit Logs' },
    { id: 'user_management',    label: 'User Management' }
];
const PART_ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'import'];
const ROLE_DEFAULT_PERMS = {
    module_admin: () => { const p = {}; PART_ENTITIES.forEach(e => p[e.id] = [...PART_ACTIONS]); return p; },
    editor: () => { const p = {}; PART_ENTITIES.forEach(e => p[e.id] = ['view', 'create', 'edit', 'export', 'import']); p['user_management'] = ['view']; return p; },
    viewer: () => { const p = {}; PART_ENTITIES.forEach(e => p[e.id] = ['view', 'export']); return p; }
};

function renderSectionCheckboxes(containerId, checkedSections) {
    document.getElementById(containerId).innerHTML = PART_SECTIONS.map(s => `<label class="section-check-label"><input type="checkbox" value="${s.id}" ${checkedSections.includes(s.id)?'checked':''}><span class="material-icons-outlined" style="font-size:16px;">${s.icon}</span>${esc(s.label)}</label>`).join('');
}

function renderPermMatrix(containerId, entityPerms) {
    document.getElementById(containerId).innerHTML = `<table class="perm-matrix-table"><thead><tr><th>Entity</th>${PART_ACTIONS.map(a => `<th>${a}</th>`).join('')}<th>All</th></tr></thead><tbody>${PART_ENTITIES.map(e => { const perms = entityPerms[e.id] || []; return `<tr><td class="entity-label">${esc(e.label)}</td>${PART_ACTIONS.map(a => `<td><input type="checkbox" class="perm-cb" data-entity="${e.id}" data-action="${a}" ${perms.includes(a)?'checked':''}></td>`).join('')}<td><input type="checkbox" class="perm-row-toggle" data-entity="${e.id}" ${perms.length===PART_ACTIONS.length?'checked':''} onchange="togglePermRow(this,'${containerId}')"></td></tr>`; }).join('')}</tbody></table>`;
}

function togglePermRow(cb, containerId) { document.getElementById(containerId).querySelectorAll(`.perm-cb[data-entity="${cb.dataset.entity}"]`).forEach(c => c.checked = cb.checked); }
function collectPermissions(containerId) { const perms = {}; document.getElementById(containerId).querySelectorAll('.perm-cb:checked').forEach(cb => { if (!perms[cb.dataset.entity]) perms[cb.dataset.entity] = []; perms[cb.dataset.entity].push(cb.dataset.action); }); return perms; }
function onMuRoleChange() { const role = document.getElementById('muRole').value; renderSectionCheckboxes('muSectionCheckboxes', ROLE_DEFAULT_SECTIONS[role] || []); renderPermMatrix('muPermMatrix', ROLE_DEFAULT_PERMS[role]()); }
function onEmuRoleChange() { const role = document.getElementById('emuRole').value; renderSectionCheckboxes('emuSectionCheckboxes', ROLE_DEFAULT_SECTIONS[role] || []); renderPermMatrix('emuPermMatrix', ROLE_DEFAULT_PERMS[role]()); }

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
            const sections = (perms && perms.sections) ? perms.sections : ROLE_DEFAULT_SECTIONS[u.role] || [];
            const sectionTags = sections.map(s => { const sec = PART_SECTIONS.find(ps => ps.id === s); return sec ? `<span class="section-tag">${sec.label}</span>` : ''; }).join('');
            const uData = encodeURIComponent(JSON.stringify({ id: u.id, email: u.email, first_name: u.first_name, last_name: u.last_name, role: u.role, permissions: perms }));
            return `<tr><td><strong>${esc(name)}</strong><div class="cell-sub">${esc(u.email)}</div></td><td><span class="role-badge role-${u.role === 'module_admin' ? 'admin' : u.role}">${roleLabel}</span></td><td><div class="section-tags-cell">${sectionTags}</div></td><td><span class="status-badge ${u.is_active?'status-active':'status-obsolete'}">${u.is_active?'Active':'Inactive'}</span></td><td>${formatTime(u.created_at)}</td><td class="actions-cell"><button class="btn-action" onclick="openEditModuleUser('${uData}')"><span class="material-icons-outlined">edit</span></button><button class="btn-action btn-danger" onclick="revokeModuleUser('${u.id}','${esc(u.email)}')"><span class="material-icons-outlined">person_remove</span></button></td></tr>`;
        }).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="6" class="empty">Error loading users</td></tr>'; }
}

async function openAddUserModal() {
    document.getElementById('muUserSearch').value = ''; document.getElementById('muUserSelect').value = '';
    document.getElementById('muUserResults').innerHTML = ''; document.getElementById('muUserSelected').style.display = 'none';
    document.getElementById('muRole').value = 'viewer'; onMuRoleChange(); partOpenModal('addModuleUserModal');
}

async function searchEmployeesForPart(query) {
    const resultsDiv = document.getElementById('muUserResults');
    if (!query || query.trim().length < 2) { resultsDiv.innerHTML = ''; return; }
    try {
        const res = await fetch('/api/v1/security/search-employees?q=' + encodeURIComponent(query.trim()), { headers: HEADERS });
        const data = await res.json();
        if (!data.data || data.data.length === 0) { resultsDiv.innerHTML = '<div class="emp-search-empty">No employees found</div>'; return; }
        resultsDiv.innerHTML = data.data.map(e => `<div class="emp-search-item" onclick="selectEmployeeForPart('${e.id}','${esc(e.emp_code)} - ${esc(e.first_name)} ${esc(e.last_name)} (${esc(e.email || 'no email')})')"><div class="emp-search-main"><strong>${esc(e.emp_code)}</strong> — ${esc(e.first_name)} ${esc(e.last_name)}</div><div class="emp-search-sub">${esc(e.email || 'No email')}</div></div>`).join('');
    } catch (e) { resultsDiv.innerHTML = ''; }
}

function selectEmployeeForPart(empId, label) {
    fetch('/api/v1/security/import-employee', { method: 'POST', headers: HEADERS, body: JSON.stringify({ employee_id: empId }) }).then(r => r.json()).then(data => {
        if (data.success) { document.getElementById('muUserSelect').value = data.data.id; document.getElementById('muUserSearch').value = ''; document.getElementById('muUserResults').innerHTML = ''; document.getElementById('muUserSelLabel').textContent = label; document.getElementById('muUserSelected').style.display = 'flex'; }
        else { showToast(data.message || 'Failed', 'error'); }
    });
}

function clearMuUser() { document.getElementById('muUserSelect').value = ''; document.getElementById('muUserSelected').style.display = 'none'; }

async function saveModuleUser(e) {
    e.preventDefault();
    const userId = document.getElementById('muUserSelect').value;
    const role = document.getElementById('muRole').value;
    if (!userId) { showToast('Select a user', 'error'); return; }
    const sections = []; document.querySelectorAll('#muSectionCheckboxes input:checked').forEach(cb => sections.push(cb.value));
    const permissions = { sections, entity_permissions: collectPermissions('muPermMatrix') };
    try {
        const res = await fetch(API + '/users', { method: 'POST', headers: HEADERS, body: JSON.stringify({ user_id: userId, role, permissions }) });
        const data = await res.json();
        if (data.success) { partCloseModal('addModuleUserModal'); showToast('User access granted'); loadModuleUsers(); }
        else showToast(data.message || 'Failed', 'error');
    } catch (e) { showToast('Network error', 'error'); }
}

function openEditModuleUser(encodedData) {
    const u = JSON.parse(decodeURIComponent(encodedData));
    document.getElementById('emuAccessId').value = u.id;
    document.getElementById('emuUserName').textContent = `${u.first_name || ''} ${u.last_name || ''} (${u.email})`.trim();
    document.getElementById('emuRole').value = u.role;
    const perms = u.permissions || {};
    renderSectionCheckboxes('emuSectionCheckboxes', perms.sections || ROLE_DEFAULT_SECTIONS[u.role] || []);
    renderPermMatrix('emuPermMatrix', perms.entity_permissions || ROLE_DEFAULT_PERMS[u.role]());
    partOpenModal('editModuleUserModal');
}

async function saveEditModuleUser(e) {
    e.preventDefault();
    const accessId = document.getElementById('emuAccessId').value;
    const role = document.getElementById('emuRole').value;
    const sections = []; document.querySelectorAll('#emuSectionCheckboxes input:checked').forEach(cb => sections.push(cb.value));
    const permissions = { sections, entity_permissions: collectPermissions('emuPermMatrix') };
    try {
        const res = await fetch(API + '/users/' + accessId, { method: 'PUT', headers: HEADERS, body: JSON.stringify({ role, permissions }) });
        const data = await res.json();
        if (data.success) { partCloseModal('editModuleUserModal'); showToast('User access updated'); loadModuleUsers(); }
        else showToast(data.message || 'Failed', 'error');
    } catch (e) { showToast('Network error', 'error'); }
}

function revokeModuleUser(accessId, email) {
    pendingDelete = { type: 'revoke_access', id: accessId, email };
    document.getElementById('deleteConfirmMsg').textContent = `Revoke access for "${email}" from Part Management?`;
    document.getElementById('deleteConfirmPassword').value = '';
    document.getElementById('deleteError').style.display = 'none';
    partOpenModal('deleteConfirmModal');
}

// ─── EXPORT / IMPORT ───
let importTarget = '';
function exportData(section) {
    let csv = '', filename = '';
    if (section === 'categories') { if (!categories.length) { showToast('No data', 'error'); return; } csv = 'Name,Code,Series Prefix,Description\n' + categories.map(c => `"${c.name}","${c.code||''}","${c.series_prefix}","${c.description||''}"`).join('\n'); filename = 'categories_export.csv'; }
    else if (section === 'subcategories') { if (!subcategories.length) { showToast('No data', 'error'); return; } csv = 'Name,Code,Category,Series Prefix,Parts,Columns\n' + subcategories.map(s => `"${s.name}","${s.code||''}","${s.category_name||''}","${s.series_prefix}","${s.current_sequence||0}","${parseCols(s.columns_config).map(c=>c.name).join('; ')}"`).join('\n'); filename = 'subcategories_export.csv'; }
    if (csv) { const blob = new Blob([csv], { type: 'text/csv' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); showToast(`Exported ${filename}`); }
}
function downloadTemplate(section) { showToast('Template downloaded'); }
function importData(section) { importTarget = section; document.getElementById('importFileInput').value = ''; document.getElementById('importFileInput').click(); }
async function handleImportFile(input) { showToast('Import processing...'); }
