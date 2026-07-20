// ─── AUTH & SECURITY: MODULE ACCESS ───

let allModules = [];

async function loadModuleAccess() {
    if (allModules.length === 0) {
        try {
            const mRes = await fetch(SEC_API + '/modules', { headers: SEC_HEADERS });
            const mData = await mRes.json();
            allModules = mData.data || [];
            const filterSel = document.getElementById('moduleFilter');
            filterSel.innerHTML = '<option value="">All Modules</option>' +
                allModules.map(m => `<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('');
        } catch (e) {}
    }

    const module = document.getElementById('moduleFilter').value;
    const tbody = document.getElementById('moduleAccessBody');
    try {
        let url = SEC_API + '/module-access';
        if (module) url += '?module=' + encodeURIComponent(module);
        const res = await fetch(url, { headers: SEC_HEADERS });
        const data = await res.json();
        if (!data.success || !data.data || data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty">No module assignments found. Click "Assign User to Module" to get started.</td></tr>';
            return;
        }
        tbody.innerHTML = data.data.map(a => {
            const name = ((a.first_name || '') + ' ' + (a.last_name || '')).trim() || a.email;
            const roleClass = a.role === 'module_admin' ? 'role-admin' : a.role === 'editor' ? 'role-editor' : 'role-viewer';
            const roleLabel = a.role === 'module_admin' ? 'Module Admin' : a.role === 'editor' ? 'Editor' : 'Viewer';
            const statusClass = a.is_active ? 'status-active' : 'status-inactive';

            // Parse permissions for detail row
            let perms = a.permissions || {};
            if (typeof perms === 'string') { try { perms = JSON.parse(perms); } catch(e) { perms = {}; } }
            const sections = perms.sections || [];
            const entityPerms = perms.entity_permissions || {};
            const hasPerms = sections.length > 0 || Object.keys(entityPerms).length > 0;

            const sectionsHtml = sections.length
                ? `<div class="ma-detail-row"><span class="ma-detail-label">Sections:</span><div class="ma-chips">${sections.map(s => `<span class="ma-chip">${esc(s)}</span>`).join('')}</div></div>`
                : '';

            const entityHtml = Object.keys(entityPerms).length
                ? `<div class="ma-detail-row"><span class="ma-detail-label">Permissions:</span><div class="ma-entity-list">${
                    Object.entries(entityPerms).map(([entity, actions]) =>
                        `<div class="ma-entity-item">
                            <span class="ma-entity-name">${esc(entity.replace(/_/g,' '))}</span>
                            <span class="ma-entity-actions">${(actions||[]).map(ac => `<span class="perm-action-chip action-${ac}">${ac}</span>`).join('')}</span>
                        </div>`
                    ).join('')
                }</div></div>`
                : '';

            const metaHtml = `<div class="ma-detail-row ma-detail-meta">
                ${a.granted_by ? `<span><span class="material-icons-outlined" style="font-size:13px;vertical-align:middle">person_add</span> Granted by: <strong>${esc(a.granted_by)}</strong></span>` : ''}
                <span><span class="material-icons-outlined" style="font-size:13px;vertical-align:middle">schedule</span> Assigned: <strong>${formatTime(a.created_at)}</strong></span>
                ${a.updated_at ? `<span><span class="material-icons-outlined" style="font-size:13px;vertical-align:middle">update</span> Updated: <strong>${formatTime(a.updated_at)}</strong></span>` : ''}
            </div>`;

            const detailHtml = `<tr class="ma-detail-tr" id="ma-detail-${a.id}" style="display:none">
                <td colspan="7" class="ma-detail-cell">
                    ${metaHtml}
                    ${sectionsHtml}
                    ${entityHtml}
                    ${!hasPerms ? '<div class="ma-detail-row" style="color:var(--text-muted);font-size:12px">No custom permissions — using role defaults</div>' : ''}
                </td>
            </tr>`;

            return `<tr class="ma-main-tr" onclick="toggleMaDetail('${a.id}')" style="cursor:pointer">
                <td>
                    <div class="cell-main">${esc(name)}</div>
                    <div class="cell-sub">${esc(a.email)}</div>
                </td>
                <td><strong>${esc(a.module)}</strong></td>
                <td><span class="role-badge ${roleClass}">${roleLabel}</span></td>
                <td><span class="status-badge ${statusClass}">${a.is_active ? 'Active' : 'Inactive'}</span></td>
                <td style="font-size:12px;color:var(--text-muted)">${formatTime(a.created_at)}</td>
                <td style="font-size:12px;color:var(--text-muted)">${a.granted_by ? esc(a.granted_by) : '—'}</td>
                <td class="actions-cell" onclick="event.stopPropagation()">
                    <button class="btn-action" onclick="openEditAccessModal('${a.id}','${esc(a.role)}','${esc(a.module)}',${JSON.stringify(perms).replace(/"/g,'&quot;')})" title="Edit">
                        <span class="material-icons-outlined">edit</span>
                    </button>
                    <button class="btn-action btn-danger" onclick="confirmSecDelete('revoke_access','${a.id}','Revoke ${esc(name)} access from ${esc(a.module)}?')" title="Revoke">
                        <span class="material-icons-outlined">person_remove</span>
                    </button>
                </td>
            </tr>${detailHtml}`;
        }).join('');

        // Update thead to add Granted By column
        const thead = document.querySelector('#moduleAccessBody').closest('table').querySelector('thead tr');
        if (thead && thead.children.length < 7) {
            thead.innerHTML = '<th>User</th><th>Module</th><th>Role</th><th>Status</th><th>Assigned</th><th>Granted By</th><th>Actions</th>';
        }
    } catch (e) { tbody.innerHTML = '<tr><td colspan="7" class="empty">Error loading module access</td></tr>'; }
}

function toggleMaDetail(id) {
    const row = document.getElementById('ma-detail-' + id);
    if (!row) return;
    row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
}

// ─── EDIT ACCESS MODAL (inline, no prompt) ───
let _editAccessId = null;

function openEditAccessModal(accessId, currentRole, moduleName, currentPerms) {
    _editAccessId = accessId;
    document.getElementById('eaAccessId').value = accessId;
    document.getElementById('eaModule').textContent = moduleName;
    document.getElementById('eaRole').value = currentRole;

    // Pre-fill permissions matrix
    _renderEaMatrix(moduleName, currentRole, currentPerms);
    secOpenModal('editAccessModal');
}

async function _renderEaMatrix(moduleName, role, existingPerms) {
    const container = document.getElementById('eaPermMatrix');
    container.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:8px">Loading...</div>';

    const BASE = {
        module_admin: ['view','create','edit','delete','export','import'],
        editor:       ['view','create','edit','export'],
        viewer:       ['view','export']
    };

    try {
        const res = await fetch(SEC_API + '/modules/entities?module=' + encodeURIComponent(moduleName), { headers: SEC_HEADERS });
        const data = await res.json();
        const entities = data.data.entities || [];
        const actions = data.data.actions || [];
        if (!entities.length) { container.innerHTML = '<p style="color:var(--text-muted);font-size:12px">No entities for this module</p>'; return; }

        const hasCustomEp = (existingPerms && existingPerms.entity_permissions !== undefined && existingPerms.entity_permissions !== null);
        const ep = hasCustomEp ? existingPerms.entity_permissions : {};
        const baseActions = BASE[role] || [];

        container.innerHTML = entities.map(entity => {
            const granted = hasCustomEp ? (ep[entity] || []) : baseActions;
            const allChecked = granted.length >= actions.length;
            const anyChecked = granted.length > 0;
            const label = entity.replace(/_/g, ' ');
            return `<div class="ea-entity-block">
                <div class="ea-entity-header" onclick="eaToggleBlock(this)">
                    <span class="material-icons-outlined ea-entity-arrow">chevron_right</span>
                    <span class="ea-entity-label">${esc(label)}</span>
                    <span class="ea-entity-summary">${anyChecked ? granted.map(a => `<span class="perm-action-chip action-${a}">${a}</span>`).join('') : '<span style="color:var(--text-muted);font-size:11px">no access</span>'}</span>
                </div>
                <div class="ea-entity-body" style="display:none">
                    <label class="ea-all-label">
                        <input type="checkbox" ${allChecked ? 'checked' : ''} onchange="eaToggleRow(this,'${entity}')">
                        <span>All permissions</span>
                    </label>
                    <div class="ea-actions-row">
                        ${actions.map(a => `<label class="ea-action-label">
                            <input type="checkbox" class="ea-perm-cb" data-entity="${entity}" data-action="${a}" ${granted.includes(a) ? 'checked' : ''} onchange="eaUpdateSummary(this,'${entity}')">
                            <span>${a}</span>
                        </label>`).join('')}
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch(e) { container.innerHTML = '<p style="color:var(--text-muted)">Error loading entities</p>'; }
}

function eaToggleBlock(header) {
    const body = header.nextElementSibling;
    const arrow = header.querySelector('.ea-entity-arrow');
    const open = body.style.display === 'none';
    body.style.display = open ? 'block' : 'none';
    arrow.textContent = open ? 'expand_more' : 'chevron_right';
}

function eaUpdateSummary(cb, entity) {
    const block = cb.closest('.ea-entity-block');
    const header = block.querySelector('.ea-entity-header');
    const summary = header.querySelector('.ea-entity-summary');
    const checked = [...block.querySelectorAll('.ea-perm-cb:checked')].map(c => c.dataset.action);
    summary.innerHTML = checked.length ? checked.map(a => `<span class="perm-action-chip action-${a}">${a}</span>`).join('') : '<span style="color:var(--text-muted);font-size:11px">no access</span>';
    // sync all-checkbox
    const allCb = block.querySelector('.ea-all-label input');
    const total = block.querySelectorAll('.ea-perm-cb').length;
    allCb.checked = checked.length >= total;
}

document.addEventListener('DOMContentLoaded', () => {
    const roleEl = document.getElementById('eaRole');
    if (roleEl) roleEl.addEventListener('change', function() {
        const mod = document.getElementById('eaModule').textContent;
        _renderEaMatrix(mod, this.value, {});
    });
});

function eaToggleRow(cb, entity) {
    const block = cb.closest('.ea-entity-block');
    block.querySelectorAll(`.ea-perm-cb[data-entity="${entity}"]`).forEach(c => { c.checked = cb.checked; });
    eaUpdateSummary(cb, entity);
}

async function saveEditAccess(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const origText = btn ? btn.textContent : 'Save';
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    const accessId = document.getElementById('eaAccessId').value;
    const role = document.getElementById('eaRole').value;
    const entityPerms = {};
    
    // Initialize all entity keys to empty array
    document.querySelectorAll('.ea-perm-cb').forEach(cb => {
        if (!entityPerms[cb.dataset.entity]) entityPerms[cb.dataset.entity] = [];
        if (cb.checked) {
            entityPerms[cb.dataset.entity].push(cb.dataset.action);
        }
    });

    try {
        const res = await fetch(SEC_API + '/module-access/' + accessId, {
            method: 'PUT', headers: SEC_HEADERS,
            body: JSON.stringify({ role, permissions: { entity_permissions: entityPerms } })
        });
        const data = await res.json();
        if (data.success) {
            secCloseModal('editAccessModal');
            secToast('Access updated');
            loadModuleAccess();
            if (typeof loadPermUsers === 'function') loadPermUsers();
            if (typeof loadSecOverview === 'function') loadSecOverview();
        } else {
            secToast(data.message || 'Failed to update access', 'error');
        }
    } catch(e) {
        secToast('Network error', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = origText; }
    }
}

// ─── ASSIGN MODULE MODAL ───
async function openAssignModuleModal() {
    secOpenModal('assignModuleModal');
    document.getElementById('amUserSearch').value = '';
    document.getElementById('amUser').value = '';
    document.getElementById('amUserResults').innerHTML = '';
    document.getElementById('amUserSelected').style.display = 'none';

    const userSel = document.getElementById('amUserSelect');
    if (userSel) {
        userSel.innerHTML = '<option value="">Loading users...</option>';
        try {
            const uRes = await fetch(SEC_API + '/users', { headers: SEC_HEADERS });
            const uData = await uRes.json();
            const users = uData.data || [];
            userSel.innerHTML = '<option value="">— Select User from System —</option>' +
                users.map(u => {
                    const name = ((u.first_name || '') + ' ' + (u.last_name || '')).trim() || u.email;
                    return `<option value="${u.id}">${esc(name)} (${esc(u.email)})</option>`;
                }).join('');
        } catch (e) {
            userSel.innerHTML = '<option value="">— Select User from System —</option>';
        }
    }

    if (allModules.length === 0) {
        try {
            const mRes = await fetch(SEC_API + '/modules', { headers: SEC_HEADERS });
            allModules = (await mRes.json()).data || [];
        } catch (e) {}
    }
    document.getElementById('amModule').innerHTML = '<option value="">— Select Module —</option>' +
        allModules.map(m => `<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('');
    document.getElementById('amRole').innerHTML = '<option value="">Select module first</option>';
    document.getElementById('amPermMatrix').style.display = 'none';
}

function onAmUserSelectChange(val) {
    document.getElementById('amUser').value = val;
    if (val) {
        const sel = document.getElementById('amUserSelect');
        const optText = sel.options[sel.selectedIndex].text;
        document.getElementById('amUserSelLabel').textContent = optText;
        document.getElementById('amUserSelected').style.display = 'flex';
        document.getElementById('amUserSearch').value = '';
        document.getElementById('amUserResults').innerHTML = '';
    } else {
        clearAmUser();
    }
}

async function searchUsersForAssign(query) {
    const resultsDiv = document.getElementById('amUserResults');
    if (!query || query.trim().length < 2) { resultsDiv.innerHTML = ''; return; }
    try {
        const res = await fetch(SEC_API + '/search-employees?q=' + encodeURIComponent(query.trim()), { headers: SEC_HEADERS });
        const data = await res.json();
        if (!data.data || data.data.length === 0) {
            resultsDiv.innerHTML = '<div class="emp-search-empty">No users found</div>';
            return;
        }
        resultsDiv.innerHTML = data.data.map(e => {
            const displayName = ((e.first_name || '') + ' ' + (e.last_name || '')).trim() || e.email;
            const codePrefix = e.emp_code ? `${e.emp_code} — ` : '';
            const subLabel = `${e.email || 'No email'}${e.designation ? ' · ' + e.designation : ''}`;
            const fullLabel = `${codePrefix}${displayName} (${e.email || 'no email'})`;
            const isUserFlag = e.is_user ? 'true' : 'false';
            return `
                <div class="emp-search-item" onclick="selectUserForAssign('${e.id}','${esc(fullLabel)}',${isUserFlag})">
                    <div class="emp-search-main"><strong>${esc(codePrefix)}${esc(displayName)}</strong></div>
                    <div class="emp-search-sub">${esc(subLabel)}</div>
                </div>
            `;
        }).join('');
    } catch (e) { resultsDiv.innerHTML = ''; }
}

function selectUserForAssign(id, label, isUser) {
    if (isUser) {
        document.getElementById('amUser').value = id;
        document.getElementById('amUserSearch').value = '';
        document.getElementById('amUserResults').innerHTML = '';
        document.getElementById('amUserSelLabel').textContent = label;
        document.getElementById('amUserSelected').style.display = 'flex';
        const userSel = document.getElementById('amUserSelect');
        if (userSel) userSel.value = id;
    } else {
        fetch(SEC_API + '/import-employee', {
            method: 'POST', headers: SEC_HEADERS,
            body: JSON.stringify({ employee_id: id })
        }).then(r => r.json()).then(data => {
            if (data.success) {
                document.getElementById('amUser').value = data.data.id;
                document.getElementById('amUserSearch').value = '';
                document.getElementById('amUserResults').innerHTML = '';
                document.getElementById('amUserSelLabel').textContent = label;
                document.getElementById('amUserSelected').style.display = 'flex';
                const userSel = document.getElementById('amUserSelect');
                if (userSel) userSel.value = data.data.id;
            } else { secToast(data.message || 'Failed to link employee', 'error'); }
        });
    }
}

function clearAmUser() {
    document.getElementById('amUser').value = '';
    document.getElementById('amUserSelected').style.display = 'none';
    const userSel = document.getElementById('amUserSelect');
    if (userSel) userSel.value = '';
}

async function loadRolesForModule() {
    const module = document.getElementById('amModule').value;
    const roleSel = document.getElementById('amRole');
    const permDiv = document.getElementById('amPermMatrix');
    const permGrid = document.getElementById('amPermCheckboxes');

    if (!module) {
        roleSel.innerHTML = '<option value="">Select module first</option>';
        permDiv.style.display = 'none';
        return;
    }

    try {
        const res = await fetch(SEC_API + '/roles?module=' + encodeURIComponent(module), { headers: SEC_HEADERS });
        const data = await res.json();
        const roles = data.data || [];
        roleSel.innerHTML = '<option value="">— Select Role —</option>' +
            roles.map(r => `<option value="${esc(r.code)}">${esc(r.name)}${r.is_system ? ' (System)' : ''}</option>`).join('');
    } catch (e) { roleSel.innerHTML = '<option value="">Error loading roles</option>'; }

    try {
        const res = await fetch(SEC_API + '/modules/entities?module=' + encodeURIComponent(module), { headers: SEC_HEADERS });
        const data = await res.json();
        const entities = data.data.entities || [];
        const actions = data.data.actions || [];
        if (entities.length > 0) {
            permDiv.style.display = 'block';
            permGrid.innerHTML = `<table class="ep-perm-matrix">
                <thead><tr><th>Entity</th>${actions.map(a=>`<th>${a}</th>`).join('')}<th>All</th></tr></thead>
                <tbody>${entities.map(entity => `<tr>
                    <td class="perm-matrix-entity">${esc(entity.replace(/_/g,' '))}</td>
                    ${actions.map(a => `<td class="perm-matrix-cell"><input type="checkbox" class="am-perm-cb" data-entity="${entity}" data-action="${a}"></td>`).join('')}
                    <td class="perm-matrix-cell"><input type="checkbox" onchange="amToggleRow(this,'${entity}')"></td>
                </tr>`).join('')}</tbody>
            </table>`;
        } else {
            permDiv.style.display = 'none';
        }
    } catch (e) { permDiv.style.display = 'none'; }
}

// When role changes in assign modal, pre-fill checkboxes
document.addEventListener('DOMContentLoaded', () => {
    const amRole = document.getElementById('amRole');
    if (amRole) amRole.addEventListener('change', function() {
        const BASE = { module_admin: ['view','create','edit','delete','export','import'], editor: ['view','create','edit','export'], viewer: ['view','export'] };
        const baseActions = BASE[this.value] || [];
        document.querySelectorAll('.am-perm-cb').forEach(cb => {
            cb.checked = baseActions.includes(cb.dataset.action);
        });
        document.querySelectorAll('#amPermCheckboxes input[type="checkbox"]:not(.am-perm-cb)').forEach(cb => {
            const entity = cb.dataset && cb.dataset.entity;
            if (!entity) cb.checked = baseActions.length === 6;
        });
    });
});

function amToggleRow(cb, entity) {
    document.querySelectorAll(`.am-perm-cb[data-entity="${entity}"]`).forEach(c => c.checked = cb.checked);
}

async function saveModuleAssignment(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const origText = btn ? btn.textContent : 'Assign Access';
    if (btn) { btn.disabled = true; btn.textContent = 'Assigning...'; }

    const userId = document.getElementById('amUser').value || (document.getElementById('amUserSelect') ? document.getElementById('amUserSelect').value : '');
    const module = document.getElementById('amModule').value;
    const role = document.getElementById('amRole').value;
    
    if (!userId || !module || !role) {
        if (!userId) secToast('Please select a user', 'error');
        else if (!module) secToast('Please select a module', 'error');
        else if (!role) secToast('Please select a role', 'error');
        if (btn) { btn.disabled = false; btn.textContent = origText; }
        return;
    }

    const entityPerms = {};
    document.querySelectorAll('.am-perm-cb:checked').forEach(cb => {
        if (!entityPerms[cb.dataset.entity]) entityPerms[cb.dataset.entity] = [];
        entityPerms[cb.dataset.entity].push(cb.dataset.action);
    });

    try {
        const res = await fetch(SEC_API + '/module-access', {
            method: 'POST', headers: SEC_HEADERS,
            body: JSON.stringify({ user_id: userId, module, role, permissions: { entity_permissions: entityPerms } })
        });
        const data = await res.json();
        if (data.success) {
            secCloseModal('assignModuleModal');
            secToast('Module access granted');
            const filterSel = document.getElementById('moduleFilter');
            if (filterSel) filterSel.value = ''; // Reset table filter to All Modules so newly assigned user is visible!
            loadModuleAccess();
            if (typeof loadSecOverview === 'function') loadSecOverview();
            if (typeof loadPermUsers === 'function') loadPermUsers();
        } else {
            secToast(data.message || 'Failed', 'error');
        }
    } catch (err) {
        secToast('Network error', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = origText; }
    }
}

function editModuleAccess(accessId, currentRole, isActive) {
    // Legacy — now handled by openEditAccessModal
    secToast('Use the edit button on the row', 'error');
}
