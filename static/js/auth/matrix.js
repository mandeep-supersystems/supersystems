// ─── AUTH & SECURITY: PERMISSION MATRIX ───

let matrixRoles = [];
let matrixEntities = [];
let matrixActions = [];

async function initMatrix() {
    // Populate module dropdown
    if (allModules.length === 0) {
        try {
            const mRes = await fetch(SEC_API + '/modules', { headers: SEC_HEADERS });
            allModules = (await mRes.json()).data || [];
        } catch (e) {}
    }
    const modSel = document.getElementById('matrixModule');
    modSel.innerHTML = '<option value="">— Select Module —</option>' + allModules.map(m => `<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('');
    document.getElementById('matrixRole').innerHTML = '<option value="">— Select Role —</option>';
    document.getElementById('matrixContainer').innerHTML = '<div class="empty">Select a module and role to view/edit the permission matrix</div>';
    document.getElementById('matrixActions').style.display = 'none';
}

async function loadMatrix() {
    const module = document.getElementById('matrixModule').value;
    const roleSel = document.getElementById('matrixRole');
    const container = document.getElementById('matrixContainer');

    if (!module) {
        roleSel.innerHTML = '<option value="">— Select Role —</option>';
        container.innerHTML = '<div class="empty">Select a module first</div>';
        document.getElementById('matrixActions').style.display = 'none';
        return;
    }

    // Load roles for this module
    try {
        const res = await fetch(SEC_API + '/roles?module=' + encodeURIComponent(module), { headers: SEC_HEADERS });
        const data = await res.json();
        matrixRoles = data.data || [];
        roleSel.innerHTML = '<option value="">— Select Role —</option>' + matrixRoles.map(r => `<option value="${r.id}" data-code="${esc(r.code)}">${esc(r.name)}${r.is_system ? ' (System)' : ''}</option>`).join('');
    } catch (e) { roleSel.innerHTML = '<option value="">Error</option>'; }

    // Load entities
    try {
        const res = await fetch(SEC_API + '/modules/entities?module=' + encodeURIComponent(module), { headers: SEC_HEADERS });
        const data = await res.json();
        matrixEntities = data.data.entities || [];
        matrixActions = data.data.actions || [];
    } catch (e) { matrixEntities = []; matrixActions = []; }

    container.innerHTML = '<div class="empty">Now select a role to see its permissions</div>';
    document.getElementById('matrixActions').style.display = 'none';
}

function renderMatrix() {
    const roleSel = document.getElementById('matrixRole');
    const roleId = roleSel.value;
    const container = document.getElementById('matrixContainer');

    if (!roleId || matrixEntities.length === 0) {
        container.innerHTML = '<div class="empty">Select a role to view permissions</div>';
        document.getElementById('matrixActions').style.display = 'none';
        return;
    }

    // Find role permissions
    const role = matrixRoles.find(r => r.id === roleId);
    const perms = role ? (role.permissions || {}) : {};

    container.innerHTML = `
        <table class="matrix-table">
            <thead>
                <tr>
                    <th style="text-align:left;min-width:160px;">Entity / Section</th>
                    ${matrixActions.map(a => `<th>${esc(a.charAt(0).toUpperCase() + a.slice(1))}</th>`).join('')}
                    <th>Select All</th>
                </tr>
            </thead>
            <tbody>
                ${matrixEntities.map(entity => {
                    const entityPerms = perms[entity] || [];
                    return `<tr>
                        <td style="text-align:left;font-weight:600;text-transform:capitalize;">${esc(entity.replace(/_/g, ' '))}</td>
                        ${matrixActions.map(action => {
                            const checked = entityPerms.includes(action) ? 'checked' : '';
                            return `<td><input type="checkbox" class="matrix-cb" data-entity="${entity}" data-action="${action}" ${checked} ${role && role.is_system ? 'disabled' : ''}></td>`;
                        }).join('')}
                        <td><input type="checkbox" class="matrix-select-all-row" data-entity="${entity}" onchange="toggleMatrixRow(this)" ${entityPerms.length === matrixActions.length ? 'checked' : ''} ${role && role.is_system ? 'disabled' : ''}></td>
                    </tr>`;
                }).join('')}
                <tr style="background:var(--bg-secondary);">
                    <td style="text-align:left;font-weight:700;">Select All</td>
                    ${matrixActions.map(action => {
                        const allChecked = matrixEntities.every(e => (perms[e] || []).includes(action));
                        return `<td><input type="checkbox" class="matrix-select-all-col" data-action="${action}" onchange="toggleMatrixCol(this)" ${allChecked ? 'checked' : ''} ${role && role.is_system ? 'disabled' : ''}></td>`;
                    }).join('')}
                    <td><input type="checkbox" class="matrix-select-all" onchange="toggleMatrixAll(this)" ${role && role.is_system ? 'disabled' : ''}></td>
                </tr>
            </tbody>
        </table>
    `;

    document.getElementById('matrixActions').style.display = (role && role.is_system) ? 'none' : 'flex';
}

function toggleMatrixRow(cb) {
    const entity = cb.dataset.entity;
    const checked = cb.checked;
    document.querySelectorAll(`.matrix-cb[data-entity="${entity}"]`).forEach(c => { c.checked = checked; });
}

function toggleMatrixCol(cb) {
    const action = cb.dataset.action;
    const checked = cb.checked;
    document.querySelectorAll(`.matrix-cb[data-action="${action}"]`).forEach(c => { c.checked = checked; });
}

function toggleMatrixAll(cb) {
    const checked = cb.checked;
    document.querySelectorAll('.matrix-cb').forEach(c => { c.checked = checked; });
    document.querySelectorAll('.matrix-select-all-row, .matrix-select-all-col').forEach(c => { c.checked = checked; });
}

async function saveMatrix() {
    const roleSel = document.getElementById('matrixRole');
    const roleId = roleSel.value;
    if (!roleId) { secToast('Select a role first', 'error'); return; }

    // Collect permissions from checkboxes
    const permissions = {};
    document.querySelectorAll('.matrix-cb:checked').forEach(cb => {
        const entity = cb.dataset.entity;
        const action = cb.dataset.action;
        if (!permissions[entity]) permissions[entity] = [];
        permissions[entity].push(action);
    });

    try {
        const res = await fetch(SEC_API + '/roles/' + roleId, {
            method: 'PUT', headers: SEC_HEADERS,
            body: JSON.stringify({ permissions })
        });
        const data = await res.json();
        if (data.success) { secToast('Permissions saved successfully'); loadRoles(); }
        else secToast(data.message || 'Failed to save', 'error');
    } catch (e) { secToast('Network error', 'error'); }
}

function resetMatrix() {
    document.querySelectorAll('.matrix-cb, .matrix-select-all-row, .matrix-select-all-col, .matrix-select-all').forEach(cb => { cb.checked = false; });
    secToast('Matrix reset. Click "Save Permissions" to apply.');
}
