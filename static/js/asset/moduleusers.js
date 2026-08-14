// ── ASSET MODULE USERS ───────────────────────────────
const ASSET_SECTIONS_DEF = [
    { id: 'overview',     label: 'Overview',            icon: 'dashboard' },
    { id: 'register',     label: 'Asset Register',      icon: 'inventory_2' },
    { id: 'depreciation', label: 'Depreciation',        icon: 'trending_down' },
    { id: 'transfers',    label: 'Asset Transfers',     icon: 'swap_horiz' },
    { id: 'disposal',     label: 'Asset Disposal',      icon: 'delete_forever' },
    { id: 'maintenance',  label: 'Maintenance Schedule',icon: 'build' },
    { id: 'moduleusers',  label: 'Module Users',        icon: 'people' }
];

const ASSET_ENTITIES_DEF = [
    { id: 'asset_register',  label: 'Asset Register' },
    { id: 'depreciation',    label: 'Depreciation' },
    { id: 'transfers',       label: 'Asset Transfers' },
    { id: 'disposal',        label: 'Asset Disposal' },
    { id: 'maintenance',     label: 'Maintenance Schedule' },
    { id: 'user_management', label: 'User Access Management' }
];

const ASSET_ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'import'];

const ASSET_ROLE_SECTIONS = {
    module_admin: ASSET_SECTIONS_DEF.map(s => s.id),
    editor:       ['overview', 'register', 'depreciation', 'transfers', 'disposal', 'maintenance'],
    viewer:       ['overview', 'register']
};

const ASSET_ROLE_PERMS = {
    module_admin: () => { const p = {}; ASSET_ENTITIES_DEF.forEach(e => p[e.id] = [...ASSET_ACTIONS]); return p; },
    editor:       () => { const p = {}; ASSET_ENTITIES_DEF.forEach(e => p[e.id] = ['view','create','edit','export','import']); p['user_management'] = ['view']; return p; },
    viewer:       () => { const p = {}; ASSET_ENTITIES_DEF.forEach(e => p[e.id] = ['view','export']); return p; }
};

function assetRenderSectionCheckboxes(containerId, checked) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = ASSET_SECTIONS_DEF.map(s => `
        <label style="display:inline-flex;align-items:center;gap:6px;margin-right:12px;margin-bottom:6px;">
            <input type="checkbox" value="${s.id}" ${checked.includes(s.id) ? 'checked' : ''}>
            <span class="material-icons-outlined" style="font-size:16px;">${s.icon}</span>${s.label}
        </label>`).join('');
}

function assetRenderPermMatrix(containerId, entityPerms) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `<table class="data-table" style="font-size:12px;">
        <thead><tr><th>Entity</th>${ASSET_ACTIONS.map(a => `<th style="text-align:center;">${a}</th>`).join('')}</tr></thead>
        <tbody>${ASSET_ENTITIES_DEF.map(e => {
            const perms = entityPerms[e.id] || [];
            return `<tr><td><strong>${e.label}</strong></td>${ASSET_ACTIONS.map(a =>
                `<td style="text-align:center;"><input type="checkbox" class="asset-perm-cb" data-entity="${e.id}" data-action="${a}" ${perms.includes(a)?'checked':''}></td>`
            ).join('')}</tr>`;
        }).join('')}</tbody></table>`;
}

function assetCollectPerms(containerId) {
    const perms = {};
    document.getElementById(containerId).querySelectorAll('.asset-perm-cb:checked').forEach(cb => {
        if (!perms[cb.dataset.entity]) perms[cb.dataset.entity] = [];
        perms[cb.dataset.entity].push(cb.dataset.action);
    });
    return perms;
}

function onAssetMuRoleChange() {
    const role = document.getElementById('assetMuRole').value;
    assetRenderSectionCheckboxes('assetMuSections', ASSET_ROLE_SECTIONS[role] || []);
    assetRenderPermMatrix('assetMuPerms', ASSET_ROLE_PERMS[role]());
}

function onAssetEmuRoleChange() {
    const role = document.getElementById('assetEmuRole').value;
    assetRenderSectionCheckboxes('assetEmuSections', ASSET_ROLE_SECTIONS[role] || []);
    assetRenderPermMatrix('assetEmuPerms', ASSET_ROLE_PERMS[role]());
}

async function assetLoadModuleUsers() {
    const tbody = document.getElementById('assetModuleUsersBody');
    if (!tbody) return;
    try {
        const res = await fetch(ASSET_API + '/users', { headers: ASSET_HEADERS() });
        const data = await res.json();
        if (!data.success || !data.data || !data.data.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No users assigned yet.</td></tr>';
            return;
        }
        tbody.innerHTML = data.data.map(u => {
            const name = ((u.first_name || '') + ' ' + (u.last_name || '')).trim() || u.email;
            const roleLabel = u.role === 'module_admin' ? 'Module Admin' : u.role === 'editor' ? 'Editor' : 'Viewer';
            const perms = typeof u.permissions === 'string' ? JSON.parse(u.permissions || '{}') : (u.permissions || {});
            const sections = perms.sections || ASSET_ROLE_SECTIONS[u.role] || [];
            const tags = sections.map(s => `<span class="badge badge-info" style="margin-right:3px;">${s}</span>`).join('');
            const enc = encodeURIComponent(JSON.stringify({ id: u.id, email: u.email, first_name: u.first_name, last_name: u.last_name, role: u.role, permissions: perms }));
            return `<tr>
                <td><strong>${name}</strong><div style="font-size:11px;color:var(--text-muted);">${u.email}</div></td>
                <td><span class="badge ${u.role==='module_admin'?'badge-primary':'badge-info'}">${roleLabel}</span></td>
                <td>${tags}</td>
                <td><span class="badge badge-success">${u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td style="font-size:12px;">${u.created_at || '—'}</td>
                <td>
                    <button class="btn-action" onclick="assetOpenEditUser('${enc}')"><span class="material-icons-outlined">edit</span></button>
                    <button class="btn-action" style="color:#c62828;" onclick="assetRevokeUser('${u.id}','${u.email}')"><span class="material-icons-outlined">person_remove</span></button>
                </td>
            </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:red;">Error loading users.</td></tr>';
    }
}

function assetOpenAddUserModal() {
    document.getElementById('assetMuUserSearch').value = '';
    document.getElementById('assetMuUserSelect').value = '';
    document.getElementById('assetMuUserResults').innerHTML = '';
    document.getElementById('assetMuUserSelected').style.display = 'none';
    document.getElementById('assetMuRole').value = 'viewer';
    onAssetMuRoleChange();
    document.getElementById('assetAddUserModal').classList.add('active');
}

async function assetSearchEmployees(query) {
    const el = document.getElementById('assetMuUserResults');
    if (!query || query.trim().length < 2) { el.innerHTML = ''; return; }
    try {
        const res = await fetch('/api/v1/security/search-employees?q=' + encodeURIComponent(query.trim()), { headers: ASSET_HEADERS() });
        const data = await res.json();
        if (!data.data || !data.data.length) { el.innerHTML = '<div style="padding:8px;color:var(--text-muted);">No employees found</div>'; return; }
        el.innerHTML = data.data.map(e => `
            <div style="padding:8px;border-bottom:1px solid var(--border-color);cursor:pointer;"
                 onclick="assetSelectEmployee('${e.id}','${e.emp_code} - ${e.first_name} ${e.last_name} (${e.email || ''})')">
                <strong>${e.emp_code}</strong> — ${e.first_name} ${e.last_name} (${e.email || ''})
            </div>`).join('');
    } catch (e) { el.innerHTML = ''; }
}

function assetSelectEmployee(empId, label) {
    fetch('/api/v1/security/import-employee', { method: 'POST', headers: ASSET_HEADERS(), body: JSON.stringify({ employee_id: empId }) })
        .then(r => r.json()).then(data => {
            if (data.success) {
                document.getElementById('assetMuUserSelect').value = data.data.id;
                document.getElementById('assetMuUserSearch').value = '';
                document.getElementById('assetMuUserResults').innerHTML = '';
                document.getElementById('assetMuUserSelLabel').textContent = label;
                document.getElementById('assetMuUserSelected').style.display = 'flex';
            } else assetShowToast(data.message || 'Failed', 'error');
        });
}

function assetClearMuUser() {
    document.getElementById('assetMuUserSelect').value = '';
    document.getElementById('assetMuUserSelected').style.display = 'none';
}

async function assetSaveModuleUser(e) {
    e.preventDefault();
    const userId = document.getElementById('assetMuUserSelect').value;
    const role   = document.getElementById('assetMuRole').value;
    if (!userId) { assetShowToast('Select a user', 'error'); return; }
    const sections = [...document.querySelectorAll('#assetMuSections input:checked')].map(cb => cb.value);
    const permissions = { sections, entity_permissions: assetCollectPerms('assetMuPerms') };
    const res = await fetch(ASSET_API + '/users', { method: 'POST', headers: ASSET_HEADERS(), body: JSON.stringify({ user_id: userId, role, permissions }) });
    const data = await res.json();
    if (data.success) { assetCloseModal('assetAddUserModal'); assetShowToast('Access granted'); assetLoadModuleUsers(); }
    else assetShowToast(data.message || 'Failed', 'error');
}

function assetOpenEditUser(enc) {
    const u = JSON.parse(decodeURIComponent(enc));
    document.getElementById('assetEmuAccessId').value = u.id;
    document.getElementById('assetEmuUserName').textContent = `${u.first_name || ''} ${u.last_name || ''} (${u.email})`.trim();
    document.getElementById('assetEmuRole').value = u.role;
    const sections = u.permissions.sections || ASSET_ROLE_SECTIONS[u.role] || [];
    assetRenderSectionCheckboxes('assetEmuSections', sections);
    assetRenderPermMatrix('assetEmuPerms', u.permissions.entity_permissions || ASSET_ROLE_PERMS[u.role]());
    document.getElementById('assetEditUserModal').classList.add('active');
}

async function assetSaveEditUser(e) {
    e.preventDefault();
    const accessId = document.getElementById('assetEmuAccessId').value;
    const role     = document.getElementById('assetEmuRole').value;
    const sections = [...document.querySelectorAll('#assetEmuSections input:checked')].map(cb => cb.value);
    const permissions = { sections, entity_permissions: assetCollectPerms('assetEmuPerms') };
    const res = await fetch(`${ASSET_API}/users/${accessId}`, { method: 'PUT', headers: ASSET_HEADERS(), body: JSON.stringify({ role, permissions }) });
    const data = await res.json();
    if (data.success) { assetCloseModal('assetEditUserModal'); assetShowToast('Permissions updated'); assetLoadModuleUsers(); }
    else assetShowToast(data.message || 'Failed', 'error');
}

async function assetRevokeUser(accessId, email) {
    if (!confirm(`Revoke access for ${email}?`)) return;
    const res = await fetch(`${ASSET_API}/users/${accessId}`, { method: 'DELETE', headers: ASSET_HEADERS() });
    const data = await res.json();
    if (data.success) { assetShowToast('Access revoked'); assetLoadModuleUsers(); }
    else assetShowToast(data.message || 'Failed', 'error');
}
