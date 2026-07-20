// ─── AUTH & SECURITY: ROLES & PERMISSIONS ───

const BASE_ROLE_PERMISSIONS = {
    module_admin: ['view', 'create', 'edit', 'delete', 'export', 'import'],
    editor:       ['view', 'create', 'edit', 'export'],
    viewer:       ['view', 'export']
};

// ─── LOAD ROLES ───
async function loadRoles() {
    if (allModules.length === 0) {
        try {
            const mRes = await fetch(SEC_API + '/modules', { headers: SEC_HEADERS });
            allModules = (await mRes.json()).data || [];
        } catch (e) {}
    }
    const filterSel = document.getElementById('roleModuleFilter');
    if (filterSel.options.length <= 1) {
        filterSel.innerHTML = '<option value="">All Modules</option>' +
            allModules.map(m => `<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('');
    }

    const module = filterSel.value;
    const container = document.getElementById('rolesContainer');
    try {
        let url = SEC_API + '/roles';
        if (module) url += '?module=' + encodeURIComponent(module);
        const res = await fetch(url, { headers: SEC_HEADERS });
        const data = await res.json();
        if (!data.success || !data.data || !data.data.length) {
            container.innerHTML = '<div class="empty" style="text-align:center;padding:40px;color:var(--text-muted);">No roles found. Click "Create Role" to define custom roles.</div>';
            return;
        }
        container.innerHTML = data.data.map(r => {
            const perms = r.permissions || {};
            const entityCount = Object.keys(perms).length;
            const totalPerms = Object.values(perms).reduce((s, a) => s + (a ? a.length : 0), 0);
            const entityCards = Object.entries(perms).map(([entity, actions]) => {
                const badges = (actions || []).map(a => {
                    const cls = a === 'delete' ? 'action-delete' : a === 'create' ? 'action-create' : a === 'edit' ? 'action-edit' : (a === 'export' || a === 'import') ? 'action-io' : 'action-view';
                    return `<span class="action-badge ${cls}">${a}</span>`;
                }).join('');
                return `<div class="entity-perm-card"><div class="entity-name">${esc(entity.replace(/_/g,' '))}</div><div class="entity-actions">${badges}</div></div>`;
            }).join('');
            const baseType = r.code === 'module_admin' ? 'Module Admin' : r.code === 'editor' ? 'Editor' : r.code === 'viewer' ? 'Viewer' : r.code;
            return `<div class="role-card">
                <div class="role-card-header">
                    <div class="role-title-group">
                        <h4>${esc(r.name)} ${r.is_system ? '<span class="system-badge">System</span>' : ''}</h4>
                        <span class="role-meta">${entityCount} entities · ${totalPerms} permissions</span>
                    </div>
                    <div class="actions-cell">
                        <button class="btn-action" onclick="openEditRoleModal('${r.id}')" title="${r.is_system ? 'View' : 'Edit'}"><span class="material-icons-outlined">${r.is_system ? 'visibility' : 'edit'}</span></button>
                        ${!r.is_system ? `<button class="btn-action btn-danger" onclick="confirmSecDelete('role','${r.id}','Delete role ${esc(r.name)}?')" title="Delete"><span class="material-icons-outlined">delete</span></button>` : ''}
                    </div>
                </div>
                <div class="role-card-meta">
                    <span class="role-badge ${r.code === 'module_admin' ? 'role-admin' : r.code === 'editor' ? 'role-editor' : 'role-viewer'}">${esc(baseType)}</span>
                    <span class="role-module-tag"><span class="material-icons-outlined" style="font-size:14px">apps</span> ${esc(r.module)}</span>
                </div>
                <div class="entity-perms-list">${entityCards || '<span style="color:var(--text-muted);font-size:11px">No permissions defined</span>'}</div>
            </div>`;
        }).join('');
    } catch (e) { container.innerHTML = '<div class="empty">Error loading roles</div>'; }
}

// ─── CREATE ROLE MODAL (multi-module) ───
async function openCreateRoleModal() {
    document.getElementById('crName').value = '';
    document.getElementById('crCode').value = '';
    document.getElementById('crBaseRole').value = '';
    document.getElementById('crModuleBlocks').innerHTML = '';
    document.getElementById('crBaseRoleSection').style.display = 'none';

    if (allModules.length === 0) {
        try {
            const mRes = await fetch(SEC_API + '/modules', { headers: SEC_HEADERS });
            allModules = (await mRes.json()).data || [];
        } catch (e) {}
    }

    document.getElementById('crModuleList').innerHTML = allModules.map(m =>
        `<label class="cr-mod-check">
            <input type="checkbox" value="${esc(m.name)}" onchange="onCrModuleToggle()">
            <span class="material-icons-outlined" style="font-size:14px">${esc(m.icon || 'apps')}</span>
            ${esc(m.name)}
        </label>`
    ).join('');

    secOpenModal('createRoleModal');
}

function onCrModuleToggle() {
    const selected = _crSelectedModules();
    document.getElementById('crBaseRoleSection').style.display = selected.length ? 'block' : 'none';
    const baseRole = document.getElementById('crBaseRole').value;
    if (baseRole && selected.length) _renderCrBlocks();
    else if (!selected.length) document.getElementById('crModuleBlocks').innerHTML = '';
}

async function onBaseRoleSelected() {
    const selected = _crSelectedModules();
    if (!selected.length) { secToast('Select at least one module first', 'error'); return; }
    await _renderCrBlocks();
}

function _crSelectedModules() {
    return Array.from(document.querySelectorAll('#crModuleList input:checked')).map(cb => cb.value);
}

async function _renderCrBlocks() {
    const baseRole = document.getElementById('crBaseRole').value;
    const selected = _crSelectedModules();
    const baseActions = BASE_ROLE_PERMISSIONS[baseRole] || [];
    const container = document.getElementById('crModuleBlocks');
    container.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:12px">Loading...</div>';

    const blocks = await Promise.all(selected.map(async (moduleName) => {
        try {
            const res = await fetch(SEC_API + '/modules/entities?module=' + encodeURIComponent(moduleName), { headers: SEC_HEADERS });
            const data = await res.json();
            const entities = data.data.entities || [];
            const actions = data.data.actions || [];
            const safeId = moduleName.replace(/\W+/g, '_');

            if (!entities.length) return `<div class="cr-mod-block">
                <div class="cr-mod-block-title"><span class="material-icons-outlined">apps</span><strong>${esc(moduleName)}</strong></div>
                <p style="color:var(--text-muted);font-size:12px;padding:8px 16px">No entities defined for this module</p>
            </div>`;

            const rows = entities.map(entity => `<tr>
                <td class="perm-matrix-entity">${esc(entity.replace(/_/g,' '))}</td>
                ${actions.map(a => `<td class="perm-matrix-cell"><input type="checkbox" class="cr-perm-cb" data-module="${esc(moduleName)}" data-entity="${entity}" data-action="${a}" ${baseActions.includes(a) ? 'checked' : ''}></td>`).join('')}
                <td class="perm-matrix-cell"><input type="checkbox" ${baseActions.length === actions.length ? 'checked' : ''} onchange="crToggleRow(this,'${esc(moduleName)}','${entity}')"></td>
            </tr>`).join('');

            return `<div class="cr-mod-block" id="crBlock_${safeId}">
                <div class="cr-mod-block-title">
                    <span class="material-icons-outlined">apps</span>
                    <strong>${esc(moduleName)}</strong>
                    <div style="margin-left:auto;display:flex;gap:6px">
                        <button type="button" class="btn-xs" onclick="crSelectAllModule('${esc(moduleName)}')">All</button>
                        <button type="button" class="btn-xs" onclick="crDeselectAllModule('${esc(moduleName)}')">None</button>
                    </div>
                </div>
                <div class="ep-matrix-wrap">
                    <table class="ep-perm-matrix">
                        <thead><tr>
                            <th>Entity</th>
                            ${actions.map(a => `<th>${a}</th>`).join('')}
                            <th>All</th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
        } catch (e) { return ''; }
    }));

    container.innerHTML = blocks.join('');
}

function crToggleRow(cb, moduleName, entity) {
    document.querySelectorAll(`.cr-perm-cb[data-module="${moduleName}"][data-entity="${entity}"]`)
        .forEach(c => c.checked = cb.checked);
}
function crSelectAllModule(moduleName) {
    document.querySelectorAll(`.cr-perm-cb[data-module="${moduleName}"]`).forEach(c => c.checked = true);
}
function crDeselectAllModule(moduleName) {
    document.querySelectorAll(`.cr-perm-cb[data-module="${moduleName}"]`).forEach(c => c.checked = false);
}

async function saveRole(e) {
    e.preventDefault();
    const name = document.getElementById('crName').value.trim();
    const code = document.getElementById('crCode').value.trim().toLowerCase().replace(/\s+/g, '_');
    const selected = _crSelectedModules();

    if (!name || !code) { secToast('Name and code are required', 'error'); return; }
    if (!selected.length) { secToast('Select at least one module', 'error'); return; }

    const modulePerms = {};
    document.querySelectorAll('.cr-perm-cb:checked').forEach(cb => {
        const mod = cb.dataset.module;
        const entity = cb.dataset.entity;
        const action = cb.dataset.action;
        if (!modulePerms[mod]) modulePerms[mod] = {};
        if (!modulePerms[mod][entity]) modulePerms[mod][entity] = [];
        modulePerms[mod][entity].push(action);
    });

    const saves = selected.map(moduleName =>
        fetch(SEC_API + '/roles', {
            method: 'POST', headers: SEC_HEADERS,
            body: JSON.stringify({ name, code, module: moduleName, permissions: modulePerms[moduleName] || {} })
        }).then(r => r.json())
    );

    try {
        const results = await Promise.all(saves);
        const failed = results.filter(r => !r.success);
        if (failed.length && failed.length === results.length) {
            secToast(failed[0].message || 'Failed to create role', 'error');
        } else {
            if (failed.length) secToast(`Role created for ${results.length - failed.length}/${results.length} modules`, 'error');
            else secToast(`Role "${name}" created for ${results.length} module${results.length > 1 ? 's' : ''}`);
            secCloseModal('createRoleModal');
            loadRoles();
        }
    } catch (e) { secToast('Network error', 'error'); }
}

// ─── EDIT ROLE MODAL ───
async function openEditRoleModal(roleId) {
    try {
        const res = await fetch(SEC_API + '/roles', { headers: SEC_HEADERS });
        const data = await res.json();
        const role = (data.data || []).find(r => r.id === roleId);
        if (!role) { secToast('Role not found', 'error'); return; }

        document.getElementById('erName').value = role.name;
        document.getElementById('erRoleId').value = role.id;
        document.getElementById('erModule').textContent = role.module;
        document.getElementById('erCode').textContent = role.code;
        document.getElementById('erIsSystem').value = role.is_system ? '1' : '0';
        document.getElementById('erName').disabled = role.is_system;
        document.getElementById('erSaveBtn').style.display = role.is_system ? 'none' : '';

        const entRes = await fetch(SEC_API + '/modules/entities?module=' + encodeURIComponent(role.module), { headers: SEC_HEADERS });
        const entData = await entRes.json();
        const entities = entData.data.entities || [];
        const actions = entData.data.actions || [];
        const perms = role.permissions || {};

        const container = document.getElementById('erPermMatrix');
        if (!entities.length) {
            container.innerHTML = '<p style="color:var(--text-muted);">No entities for this module</p>';
        } else {
            container.innerHTML = `
                <div class="perm-matrix-header">
                    <label>Permissions</label>
                    ${!role.is_system ? `<div class="perm-quick-actions">
                        <button type="button" class="btn-xs" onclick="erSelectAll()">Select All</button>
                        <button type="button" class="btn-xs" onclick="erDeselectAll()">Deselect All</button>
                    </div>` : ''}
                </div>
                <table class="matrix-table er-matrix">
                    <thead><tr>
                        <th style="text-align:left">Entity</th>
                        ${actions.map(a => `<th>${esc(a)}</th>`).join('')}
                        ${!role.is_system ? '<th>All</th>' : ''}
                    </tr></thead>
                    <tbody>${entities.map(entity => {
                        const ep = perms[entity] || [];
                        return `<tr>
                            <td style="text-align:left;font-weight:600;text-transform:capitalize">${esc(entity.replace(/_/g,' '))}</td>
                            ${actions.map(a => `<td><input type="checkbox" class="er-perm-cb" data-entity="${entity}" data-action="${a}" ${ep.includes(a) ? 'checked' : ''} ${role.is_system ? 'disabled' : ''}></td>`).join('')}
                            ${!role.is_system ? `<td><input type="checkbox" class="er-row-toggle" onchange="erToggleRow(this,'${entity}')" ${ep.length === actions.length ? 'checked' : ''}></td>` : ''}
                        </tr>`;
                    }).join('')}</tbody>
                </table>`;
        }
        secOpenModal('editRoleModal');
    } catch (e) { secToast('Error loading role', 'error'); }
}

function erToggleRow(cb, entity) {
    document.querySelectorAll(`.er-perm-cb[data-entity="${entity}"]`).forEach(c => c.checked = cb.checked);
}
function erSelectAll() { document.querySelectorAll('.er-perm-cb,.er-row-toggle').forEach(c => c.checked = true); }
function erDeselectAll() { document.querySelectorAll('.er-perm-cb,.er-row-toggle').forEach(c => c.checked = false); }

async function updateRole(e) {
    e.preventDefault();
    const roleId = document.getElementById('erRoleId').value;
    const name = document.getElementById('erName').value.trim();
    const permissions = {};
    document.querySelectorAll('.er-perm-cb:checked').forEach(cb => {
        if (!permissions[cb.dataset.entity]) permissions[cb.dataset.entity] = [];
        permissions[cb.dataset.entity].push(cb.dataset.action);
    });
    try {
        const res = await fetch(SEC_API + '/roles/' + roleId, {
            method: 'PUT', headers: SEC_HEADERS,
            body: JSON.stringify({ name, permissions })
        });
        const data = await res.json();
        if (data.success) { secCloseModal('editRoleModal'); secToast('Role updated'); loadRoles(); }
        else secToast(data.message || 'Failed', 'error');
    } catch (e) { secToast('Network error', 'error'); }
}
