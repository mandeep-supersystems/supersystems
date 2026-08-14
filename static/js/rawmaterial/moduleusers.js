// ─── RM MODULE: USER MANAGEMENT ───
const ROLE_DEFAULT_SECTIONS = {
    module_admin: ['overview', 'criteria', 'master', 'partmapping', 'moduleusers', 'inventory'],
    editor:       ['overview', 'criteria', 'master', 'partmapping', 'inventory'],
    viewer:       ['overview', 'master', 'inventory']
};

const RM_ENTITIES = [
    { id: 'criteria',           label: 'RM Code Criteria' },
    { id: 'rm_master',          label: 'RM Master' },
    { id: 'rm_part_mapping',    label: 'RM-Part Mapping' },
    { id: 'user_management',    label: 'User Management' }
];

const RM_ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'import'];

const ROLE_DEFAULT_PERMS = {
    module_admin: () => { const p = {}; RM_ENTITIES.forEach(e => p[e.id] = [...RM_ACTIONS]); return p; },
    editor: () => { const p = {}; RM_ENTITIES.forEach(e => p[e.id] = ['view', 'create', 'edit', 'export', 'import']); p['user_management'] = ['view']; return p; },
    viewer: () => { const p = {}; RM_ENTITIES.forEach(e => p[e.id] = ['view', 'export']); return p; }
};

const RM_SECTIONS = [
    { id: 'overview',     label: 'Overview', icon: 'dashboard' },
    { id: 'criteria',     label: 'Code Criteria', icon: 'rule' },
    { id: 'master',       label: 'RM Master', icon: 'inventory_2' },
    { id: 'partmapping',  label: 'RM-Part Mapping', icon: 'link' },
    { id: 'inventory',    label: 'RM Inventory', icon: 'warehouse' },
    { id: 'moduleusers',  label: 'User Management', icon: 'group' }
];

function renderSectionCheckboxes(containerId, checkedSections) {
    document.getElementById(containerId).innerHTML = RM_SECTIONS.map(s => 
        `<label class="section-check-label"><input type="checkbox" value="${s.id}" ${checkedSections.includes(s.id)?'checked':''}><span class="material-icons-outlined" style="font-size:16px;">${s.icon}</span>${esc(s.label)}</label>`
    ).join('');
}

function renderPermMatrix(containerId, entityPerms) {
    document.getElementById(containerId).innerHTML = `
        <table class="perm-matrix-table">
            <thead>
                <tr>
                    <th>Entity</th>
                    ${RM_ACTIONS.map(a => `<th>${a}</th>`).join('')}
                    <th>All</th>
                </tr>
            </thead>
            <tbody>
                ${RM_ENTITIES.map(e => { 
                    const perms = entityPerms[e.id] || []; 
                    return `
                        <tr>
                            <td class="entity-label">${esc(e.label)}</td>
                            ${RM_ACTIONS.map(a => `<td><input type="checkbox" class="perm-cb" data-entity="${e.id}" data-action="${a}" ${perms.includes(a)?'checked':''}></td>`).join('')}
                            <td><input type="checkbox" class="perm-row-toggle" data-entity="${e.id}" ${perms.length===RM_ACTIONS.length?'checked':''} onchange="togglePermRow(this,'${containerId}')"></td>
                        </tr>
                    `; 
                }).join('')}
            </tbody>
        </table>
    `;
}

function togglePermRow(cb, containerId) { 
    document.getElementById(containerId).querySelectorAll(`.perm-cb[data-entity="${cb.dataset.entity}"]`).forEach(c => c.checked = cb.checked); 
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
    renderSectionCheckboxes('muSectionCheckboxes', ROLE_DEFAULT_SECTIONS[role] || []); 
    renderPermMatrix('muPermMatrix', ROLE_DEFAULT_PERMS[role]()); 
}

function onEmuRoleChange() { 
    const role = document.getElementById('emuRole').value; 
    renderSectionCheckboxes('emuSectionCheckboxes', ROLE_DEFAULT_SECTIONS[role] || []); 
    renderPermMatrix('emuPermMatrix', ROLE_DEFAULT_PERMS[role]()); 
}

let allModuleUsers = [];

async function loadModuleUsers() {
    const tbody = document.getElementById('moduleUsersBody');
    try {
        const res = await fetch(RM_API + '/users', { headers: RM_HEADERS });
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
                    <td>${formatTime(u.created_at)}</td>
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
        const res = await fetch(RM_API + '/users/available', { headers: RM_HEADERS });
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
    document.getElementById('addUserModal').classList.add('active');
}

async function saveModuleUser(e) {
    e.preventDefault();
    const payload = {
        user_id: document.getElementById('muUserId').value,
        role: document.getElementById('muRole').value,
        permissions: collectPermissions('muPermMatrix')
    };
    if (!payload.user_id) return alert("Select a user");
    
    try {
        const res = await fetch(RM_API + '/users', {
            method: 'POST',
            headers: RM_HEADERS,
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            rmCloseModal('addUserModal');
            loadModuleUsers();
        } else {
            alert("Error: " + data.message);
        }
    } catch(e) { console.error(e); alert("Network error"); }
}

function openEditUserModal(accessId) {
    const user = allModuleUsers.find(u => u.id === accessId);
    if (!user) return;
    
    document.getElementById('emuId').value = user.id;
    document.getElementById('emuEmail').value = user.email;
    document.getElementById('emuRole').value = user.role;
    document.getElementById('emuStatus').value = user.is_active ? 'true' : 'false';
    
    // Set permissions
    renderSectionCheckboxes('emuSectionCheckboxes', ROLE_DEFAULT_SECTIONS[user.role] || []);
    renderPermMatrix('emuPermMatrix', typeof user.permissions === 'object' ? user.permissions : ROLE_DEFAULT_PERMS[user.role]());
    
    document.getElementById('editModuleUserModal').classList.add('active');
}

async function updateModuleUser(e) {
    e.preventDefault();
    const id = document.getElementById('emuId').value;
    const payload = {
        role: document.getElementById('emuRole').value,
        is_active: document.getElementById('emuStatus').value === 'true',
        permissions: collectPermissions('emuPermMatrix')
    };
    
    try {
        const res = await fetch(RM_API + '/users/' + id, {
            method: 'PUT',
            headers: RM_HEADERS,
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            rmCloseModal('editModuleUserModal');
            loadModuleUsers();
        } else {
            alert("Error: " + data.message);
        }
    } catch(e) { console.error(e); alert("Network error"); }
}

async function revokeUser(accessId, email) {
    if (!confirm(`Are you sure you want to completely revoke access for ${email}?`)) return;
    try {
        const res = await fetch(RM_API + '/users/' + accessId, { method: 'DELETE', headers: RM_HEADERS });
        const data = await res.json();
        if (data.success) loadModuleUsers();
        else alert("Error: " + data.message);
    } catch(e) { console.error(e); alert("Network error"); }
}
