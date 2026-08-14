// ─── SUPPLIER MODULE: USER MANAGEMENT ───

const SUP_SECTIONS = [
    { id: 'overview',     label: 'Overview',           icon: 'dashboard' },
    { id: 'suppliers',    label: 'Suppliers',          icon: 'storefront' },
    { id: 'evaluations',  label: 'Evaluations',        icon: 'fact_check' },
    { id: 'contracts',    label: 'Contracts',          icon: 'description' },
    { id: 'performance',  label: 'Performance',        icon: 'leaderboard' },
    { id: 'auditlogs',    label: 'Audit Logs',         icon: 'history' },
    { id: 'moduleusers',  label: 'User Management',    icon: 'manage_accounts' },
];

const SUP_ENTITIES = [
    { id: 'suppliers',    label: 'Suppliers' },
    { id: 'evaluations',  label: 'Evaluations' },
    { id: 'contracts',    label: 'Contracts' },
    { id: 'performance',  label: 'Performance' },
    { id: 'moduleusers',  label: 'User Management' },
];

const SUP_ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'import'];

const SUP_ROLE_DEFAULT_SECTIONS = {
    module_admin: SUP_SECTIONS.map(s => s.id),
    editor:       ['overview', 'suppliers', 'evaluations', 'contracts', 'performance', 'auditlogs'],
    viewer:       ['overview', 'suppliers']
};

const SUP_ROLE_DEFAULT_PERMS = {
    module_admin: () => { const p = {}; SUP_ENTITIES.forEach(e => p[e.id] = [...SUP_ACTIONS]); return p; },
    editor: () => { const p = {}; SUP_ENTITIES.forEach(e => p[e.id] = ['view', 'create', 'edit', 'export', 'import']); p['moduleusers'] = ['view']; return p; },
    viewer: () => { const p = {}; SUP_ENTITIES.forEach(e => p[e.id] = ['view', 'export']); return p; }
};

function renderSectionCheckboxes(containerId, checkedSections) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = SUP_SECTIONS.map(s => `
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
                    ${SUP_ACTIONS.map(a => `<th style="text-align:center;">${a}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${SUP_ENTITIES.map(e => {
                    const perms = entityPerms[e.id] || [];
                    return `
                        <tr>
                            <td><strong>${e.label}</strong></td>
                            ${SUP_ACTIONS.map(a => `
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
    renderSectionCheckboxes('muSectionCheckboxes', SUP_ROLE_DEFAULT_SECTIONS[role] || []);
    renderPermMatrix('muPermMatrix', SUP_ROLE_DEFAULT_PERMS[role]());
}

function onEmuRoleChange() {
    const role = document.getElementById('emuRole').value;
    renderSectionCheckboxes('emuSectionCheckboxes', SUP_ROLE_DEFAULT_SECTIONS[role] || []);
    renderPermMatrix('emuPermMatrix', SUP_ROLE_DEFAULT_PERMS[role]());
}

let allModuleUsers = [];

async function loadModuleUsers() {
    const tbody = document.getElementById('moduleUsersBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/users', { headers: getHeaders() });
        const data = await res.json();
        allModuleUsers = data.success ? data.data : [];
        if (!data.success || !data.data || data.data.length === 0) { 
            tbody.innerHTML = '<tr><td colspan="6" class="empty">No users assigned yet.</td></tr>'; 
            return; 
        }
        
        tbody.innerHTML = data.data.map(u => {
            const roleName = u.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            const roleClass = u.role === 'module_admin' ? 'role-admin' : (u.role === 'editor' ? 'role-editor' : 'role-viewer');
            
            const pText = typeof u.permissions === 'object' ? Object.keys(u.permissions).map(k => `${k}: ${u.permissions[k].length}`).join(', ') : 'Standard';
            
            return `
                <tr>
                    <td>
                        <div style="font-weight:600">${esc(u.first_name)} ${esc(u.last_name)}</div>
                        <div style="font-size:12px;color:var(--text-secondary)">${esc(u.email)}</div>
                    </td>
                    <td><span class="role-chip ${roleClass}">${esc(roleName)}</span></td>
                    <td style="font-size:11px;color:var(--text-secondary);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${pText}">${pText}</td>
                    <td>
                        <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${u.is_active?'rgba(16,185,129,0.1)':'rgba(244,63,94,0.1)'};color:${u.is_active?'var(--success)':'var(--danger)'}">
                            ${u.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>${fmtDateTime(u.created_at)}</td>
                    <td>
                        <button class="btn-icon" title="Edit Access" onclick="openEditUserModal('${u.id}')"><span class="material-icons-outlined">edit</span></button>
                        <button class="btn-icon" title="Revoke Access" onclick="revokeUser('${u.id}', '${esc(u.email)}')"><span class="material-icons-outlined" style="color:var(--danger)">person_remove</span></button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch(e) { 
        console.error(e); 
        tbody.innerHTML = `<tr><td colspan="6" class="empty" style="color:var(--danger)">Error loading users</td></tr>`; 
    }
}

async function openAddUserModal() {
    try {
        const res = await fetch(API + '/users/available', { headers: getHeaders() });
        const data = await res.json();
        const select = document.getElementById('muUserId');
        if (data.success && data.data && data.data.length > 0) {
            select.innerHTML = '<option value="">-- Select User --</option>' + data.data.map(u => `<option value="${u.id}">${esc(u.first_name)} ${esc(u.last_name)} (${esc(u.email)})</option>`).join('');
        } else {
            select.innerHTML = '<option value="">No available users found</option>';
        }
    } catch(e) { console.error(e); }
    
    document.getElementById('muRole').value = 'viewer';
    onMuRoleChange();
    openModal('addUserModal');
}

async function saveModuleUser(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
        const res = await fetch(API + '/users', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                user_id: document.getElementById('muUserId').value,
                role: document.getElementById('muRole').value,
                permissions: collectPermissions('muPermMatrix')
            })
        });
        const data = await res.json();
        if (data.success) {
            showToast('User access granted successfully');
            closeModal('addUserModal');
            loadModuleUsers();
        } else {
            showToast(data.message || 'Error granting access', 'error');
        }
    } catch(err) {
        showToast('Request failed', 'error');
    }
    btn.disabled = false;
}

function openEditUserModal(accessId) {
    const user = allModuleUsers.find(u => u.id === accessId);
    if (!user) return;
    
    document.getElementById('emuId').value = user.id;
    document.getElementById('emuEmail').value = user.email;
    document.getElementById('emuRole').value = user.role;
    document.getElementById('emuStatus').value = user.is_active ? 'true' : 'false';
    
    openModal('editModuleUserModal');
}

async function updateModuleUser(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
        const id = document.getElementById('emuId').value;
        const res = await fetch(API + '/users/' + id, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({
                role: document.getElementById('emuRole').value,
                is_active: document.getElementById('emuStatus').value === 'true',
                permissions: collectPermissions('emuPermMatrix')
            })
        });
        const data = await res.json();
        if (data.success) {
            showToast('User access updated');
            closeModal('editModuleUserModal');
            loadModuleUsers();
        } else {
            showToast(data.message || 'Error updating access', 'error');
        }
    } catch(err) {
        showToast('Request failed', 'error');
    }
    btn.disabled = false;
}

async function revokeUser(accessId, email) {
    if (!confirm(`Are you sure you want to revoke Supplier Management access for ${email}?`)) return;
    try {
        const res = await fetch(API + '/users/' + accessId, {
            method: 'DELETE',
            headers: getHeaders()
        });
        const data = await res.json();
        if (data.success) {
            showToast('User access revoked');
            loadModuleUsers();
        } else {
            showToast(data.message || 'Error revoking access', 'error');
        }
    } catch(e) {
        showToast('Request failed', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadModuleUsers();
});
