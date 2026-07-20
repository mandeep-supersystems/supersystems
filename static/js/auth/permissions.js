// ─── AUTH & SECURITY: USER PERMISSIONS ───

let _permUsers = [];
let _allModules = [];
let _editPermUser = null;

const ROLE_OPTIONS = [
    { value: 'module_admin', label: 'Module Admin' },
    { value: 'editor',       label: 'Editor' },
    { value: 'viewer',       label: 'Viewer' },
];
const COMMON_ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'import'];

// ─── MODULE METADATA ───
const MODULE_SECTIONS = {
    'Part Management': [
        { id: 'overview',     label: 'Overview',           icon: 'dashboard' },
        { id: 'categories',   label: 'Categories',         icon: 'folder' },
        { id: 'subcategories',label: 'Subcategories',      icon: 'folder_open' },
        { id: 'generate',     label: 'Generate Part Code', icon: 'bolt' },
        { id: 'allparts',     label: 'All Parts',          icon: 'view_list' },
        { id: 'partmapping',  label: 'Part Mapping',       icon: 'account_tree' },
        { id: 'auditlogs',    label: 'Audit Logs',         icon: 'history' },
        { id: 'obsolete',     label: 'Obsolete Parts',     icon: 'block' },
        { id: 'moduleusers',  label: 'User Management',    icon: 'manage_accounts' },
    ],
    'Auth & Security': [
        { id: 'overview',    label: 'Overview',          icon: 'dashboard' },
        { id: 'users',       label: 'Users',             icon: 'people' },
        { id: 'permissions', label: 'User Permissions',  icon: 'manage_accounts' },
        { id: 'modules',     label: 'Module Access',     icon: 'apps' },
        { id: 'roles',       label: 'Roles',             icon: 'admin_panel_settings' },
        { id: 'matrix',      label: 'Permission Matrix', icon: 'grid_on' },
        { id: 'auditlogs',   label: 'Audit Logs',        icon: 'history' },
    ],
};

const MODULE_ENTITIES = {
    'Part Management':      ['categories', 'subcategories', 'parts', 'generate_part_code', 'part_mapping', 'audit_logs', 'obsolete_parts', 'user_management'],
    'Auth & Security':      ['users', 'roles', 'modules', 'permissions', 'audit_logs'],
    'Inventory Management': ['stock_levels', 'stock_movements', 'transfers', 'adjustments', 'counts'],
    'Procurement':          ['requisitions', 'purchase_orders', 'goods_receipt', 'vendor_invoices', 'contracts'],
    'Finance':              ['general_ledger', 'accounts_payable', 'accounts_receivable', 'invoicing', 'payments'],
    'Manufacturing':        ['bom', 'production_orders', 'work_centers', 'routing', 'shop_floor'],
    'Warehouse Management': ['zones', 'bins', 'pick_lists', 'putaway', 'shipping', 'receiving'],
    'Quality Management':   ['inspections', 'non_conformances', 'capa', 'quality_plans', 'certificates'],
    'Human Resources':      ['employees', 'leave', 'attendance', 'payroll', 'recruitment', 'performance'],
    'Project Management':   ['projects', 'tasks', 'milestones', 'resources', 'reports'],
    'Supplier Management':  ['suppliers', 'contacts', 'contracts', 'evaluations', 'reports'],
};

// Default sections per role for Part Management
const PART_ROLE_SECTIONS = {
    module_admin: ['overview','categories','subcategories','generate','allparts','partmapping','auditlogs','obsolete','moduleusers'],
    editor:       ['overview','categories','subcategories','generate','allparts','partmapping','auditlogs','obsolete'],
    viewer:       ['overview','allparts','obsolete'],
};

async function loadPermUsers() {
    const container = document.getElementById('permUsersContainer');
    container.innerHTML = '<div class="perm-loading">Loading...</div>';
    try {
        const [usersRes, modulesRes] = await Promise.all([
            fetch(SEC_API + '/user-permissions', { headers: SEC_HEADERS }),
            fetch(SEC_API + '/modules', { headers: SEC_HEADERS })
        ]);
        const usersData = await usersRes.json();
        const modulesData = await modulesRes.json();
        _permUsers = usersData.data || [];
        _allModules = modulesData.data || [];
        renderPermUsers(_permUsers);
    } catch (e) {
        document.getElementById('permUsersContainer').innerHTML = '<div class="perm-loading">Error loading permissions</div>';
    }
}

function filterPermUsers(q) {
    const lq = q.toLowerCase();
    renderPermUsers(!lq ? _permUsers : _permUsers.filter(u =>
        (u.email || '').toLowerCase().includes(lq) ||
        ((u.first_name || '') + ' ' + (u.last_name || '')).toLowerCase().includes(lq) ||
        (u.emp_code || '').toLowerCase().includes(lq)
    ));
}

function renderPermUsers(users) {
    const container = document.getElementById('permUsersContainer');
    if (!users.length) { container.innerHTML = '<div class="perm-loading">No users found</div>'; return; }
    container.innerHTML = users.map(u => {
        const name = ((u.first_name || '') + ' ' + (u.last_name || '')).trim() || u.email;
        const moduleChips = u.modules.length
            ? u.modules.map(m => {
                const rc = m.role === 'module_admin' ? 'role-admin' : m.role === 'editor' ? 'role-editor' : 'role-viewer';
                return `<span class="pu-mod-chip ${m.is_active ? '' : 'chip-inactive'}">
                    <span class="pu-mod-name">${esc(m.module)}</span>
                    <span class="role-badge ${rc}">${esc(m.role.replace('_',' '))}</span>
                </span>`;
            }).join('')
            : '<span class="pu-no-mod">No modules assigned</span>';

        return `<div class="pu-row" onclick="togglePermRow('${u.id}')">
            <div class="pu-row-main">
                <div class="pu-avatar">${name.slice(0,2).toUpperCase()}</div>
                <div class="pu-info">
                    <div class="pu-name">${esc(name)}</div>
                    <div class="pu-meta">
                        <span>${esc(u.email)}</span>
                        ${u.emp_code ? `<span class="pu-sep">·</span><span>${esc(u.emp_code)}</span>` : ''}
                        ${u.phone ? `<span class="pu-sep">·</span><span>${esc(u.phone)}</span>` : ''}
                    </div>
                </div>
                <div class="pu-chips">${moduleChips}</div>
                <div class="pu-row-actions">
                    <span class="status-badge ${u.is_active ? 'status-active' : 'status-inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span>
                    <button class="btn-primary btn-sm" onclick="event.stopPropagation(); openEditPermModal('${u.id}')">
                        <span class="material-icons-outlined">edit</span> Edit
                    </button>
                    <span class="pu-expand-icon material-icons-outlined" id="pu-expand-${u.id}">expand_more</span>
                </div>
            </div>
            <div class="pu-detail" id="pu-detail-${u.id}" style="display:none">${renderPermDetail(u)}</div>
        </div>`;
    }).join('');
}

function renderPermDetail(u) {
    if (!u.modules.length) return '<div class="pu-detail-empty">No module access assigned</div>';
    return u.modules.map(m => {
        const perms = _parsePerms(m.permissions);
        const entityPerms = perms.entity_permissions || {};
        const sections = perms.sections || [];
        const rc = m.role === 'module_admin' ? 'role-admin' : m.role === 'editor' ? 'role-editor' : 'role-viewer';

        const sectionHtml = sections.length
            ? `<div class="pu-detail-sections"><strong>Sections:</strong> ${sections.map(s => `<span class="section-chip">${s}</span>`).join('')}</div>`
            : '';

        const entityRows = Object.entries(entityPerms).map(([entity, actions]) =>
            `<div class="pu-entity-row">
                <span class="pu-entity-name">${esc(entity.replace(/_/g,' '))}</span>
                <span class="pu-entity-actions">${(actions||[]).map(a => `<span class="perm-action-chip">${a}</span>`).join('')}</span>
            </div>`
        ).join('') || '<span class="pu-no-perms">No entity permissions set</span>';

        return `<div class="pu-mod-detail ${m.is_active ? '' : 'perm-module-inactive'}">
            <div class="pu-mod-detail-header">
                <span class="material-icons-outlined">apps</span>
                <strong>${esc(m.module)}</strong>
                <span class="role-badge ${rc}">${esc(m.role.replace('_',' '))}</span>
                ${!m.is_active ? '<span class="status-badge status-inactive">Inactive</span>' : ''}
            </div>
            ${sectionHtml}
            <div class="pu-entity-list">${entityRows}</div>
        </div>`;
    }).join('');
}

function togglePermRow(uid) {
    const detail = document.getElementById('pu-detail-' + uid);
    const icon = document.getElementById('pu-expand-' + uid);
    if (!detail) return;
    const open = detail.style.display !== 'none';
    detail.style.display = open ? 'none' : 'block';
    if (icon) icon.textContent = open ? 'expand_more' : 'expand_less';
}

// ─── EDIT MODAL ───
function openEditPermModal(uid) {
    const u = _permUsers.find(x => x.id === uid);
    if (!u) return;
    _editPermUser = u;

    const name = ((u.first_name || '') + ' ' + (u.last_name || '')).trim() || u.email;
    document.getElementById('epUserLabel').textContent = `${name} · ${u.email}${u.emp_code ? ' · ' + u.emp_code : ''}`;

    const assignedNames = new Set(u.modules.map(m => m.module));
    const assignedBlocks = u.modules.map((m, i) => _buildAssignedBlock(m, i)).join('');
    const unassigned = _allModules.filter(mod => !assignedNames.has(mod.name));
    const addSection = unassigned.length ? `
        <div class="ep-add-section">
            <div class="ep-add-header"><span class="material-icons-outlined">add_circle_outline</span><strong>Add Module Access</strong></div>
            ${unassigned.map(mod => _buildNewModuleBlock(mod)).join('')}
        </div>` : '';

    document.getElementById('epModalBody').innerHTML =
        (assignedBlocks || '<div class="pu-detail-empty" style="margin-bottom:16px">No modules assigned yet</div>') + addSection;
    secOpenModal('editPermModal');
}

function _parsePerms(p) {
    if (!p) return {};
    if (typeof p === 'string') { try { return JSON.parse(p); } catch(e) { return {}; } }
    return p;
}

function _buildAssignedBlock(m, i) {
    const perms = _parsePerms(m.permissions);
    const entityPerms = perms.entity_permissions || {};
    const savedSections = perms.sections || [];
    const moduleSections = MODULE_SECTIONS[m.module] || [];
    const moduleEntities = MODULE_ENTITIES[m.module] || Object.keys(entityPerms);
    const allEntities = [...new Set([...moduleEntities, ...Object.keys(entityPerms)])];
    if (!allEntities.length) allEntities.push('general');

    const sectionsHtml = moduleSections.length ? `
        <div class="ep-sections-wrap">
            <div class="ep-sections-label">
                <span>Accessible Sections</span>
                <label class="ep-check-all-label">
                    <input type="checkbox" onchange="toggleAllSections(this, ${i})" ${savedSections.length === moduleSections.length ? 'checked' : ''}> All
                </label>
            </div>
            <div class="ep-sections-grid" id="epSections_${i}">
                ${moduleSections.map(s => `
                    <label class="section-check-label">
                        <input type="checkbox" class="ep-sec-cb" data-idx="${i}" value="${s.id}" ${savedSections.includes(s.id) ? 'checked' : ''}>
                        <span class="material-icons-outlined" style="font-size:14px">${s.icon}</span>
                        ${esc(s.label)}
                    </label>`).join('')}
            </div>
        </div>` : '';

    const accordionRows = allEntities.map(entity => {
        const granted = entityPerms[entity] || [];
        const allChecked = granted.length >= COMMON_ACTIONS.length;
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
                    <input type="checkbox" ${allChecked ? 'checked' : ''} onchange="toggleEpRow(this,${i},'${entity}'); epUpdateSummary(this,'${entity}',${ i},'ep-perm-cb')"> All permissions
                </label>
                <div class="ea-actions-row">
                    ${COMMON_ACTIONS.map(a => `<label class="ea-action-label">
                        <input type="checkbox" class="ep-perm-cb" data-idx="${i}" data-entity="${entity}" data-action="${a}" ${granted.includes(a) ? 'checked' : ''} onchange="epUpdateSummary(this,'${entity}',${i},'ep-perm-cb')">
                        <span>${a}</span>
                    </label>`).join('')}
                </div>
            </div>
        </div>`;
    }).join('');

    const roleLabel = ROLE_OPTIONS.find(r => r.value === m.role)?.label || m.role;
    const rc = m.role === 'module_admin' ? 'role-admin' : m.role === 'editor' ? 'role-editor' : 'role-viewer';
    return `<div class="ep-module-block" data-idx="${i}" data-access-id="${m.access_id}" data-mode="edit">
        <div class="ep-module-title ep-module-toggle" onclick="epToggleModule(this)">
            <span class="material-icons-outlined ep-mod-arrow">chevron_right</span>
            <span class="material-icons-outlined" style="font-size:16px;color:var(--accent)">apps</span>
            <strong>${esc(m.module)}</strong>
            <span class="role-badge ${rc} ep-mod-role-badge">${roleLabel}</span>
            <label class="ep-active-toggle" onclick="event.stopPropagation()">
                <input type="checkbox" id="epActive_${i}" ${m.is_active ? 'checked' : ''}> Active
            </label>
        </div>
        <div class="ep-module-body" style="display:none">
            <div class="ep-role-row">
                <label>Role:</label>
                <select id="epRole_${i}" class="ep-role-sel" onchange="onEpRoleChange(${i},'${esc(m.module)}')">
                    ${ROLE_OPTIONS.map(r => `<option value="${r.value}" ${m.role === r.value ? 'selected' : ''}>${r.label}</option>`).join('')}
                </select>
            </div>
            ${sectionsHtml}
            <div class="ep-matrix-wrap">${accordionRows}</div>
        </div>
    </div>`;
}

function _buildNewModuleBlock(mod) {
    const entities = MODULE_ENTITIES[mod.name] || ['general'];
    const sections = MODULE_SECTIONS[mod.name] || [];
    const safeId = mod.name.replace(/\W+/g, '_');

    const sectionsHtml = sections.length ? `
        <div class="ep-sections-wrap" id="epnewSec_${safeId}">
            <div class="ep-sections-label">
                <span>Accessible Sections</span>
                <label class="ep-check-all-label"><input type="checkbox" onchange="toggleAllNewSections(this,'${safeId}')"> All</label>
            </div>
            <div class="ep-sections-grid">
                ${sections.map(s => `
                    <label class="section-check-label">
                        <input type="checkbox" class="ep-new-sec-cb" data-module="${esc(mod.name)}" value="${s.id}">
                        <span class="material-icons-outlined" style="font-size:14px">${s.icon}</span>
                        ${esc(s.label)}
                    </label>`).join('')}
            </div>
        </div>` : '';

    const accordionRows = entities.map(entity => {
        const label = entity.replace(/_/g, ' ');
        return `<div class="ea-entity-block">
            <div class="ea-entity-header" onclick="eaToggleBlock(this)">
                <span class="material-icons-outlined ea-entity-arrow">chevron_right</span>
                <span class="ea-entity-label">${esc(label)}</span>
                <span class="ea-entity-summary"><span style="color:var(--text-muted);font-size:11px">no access</span></span>
            </div>
            <div class="ea-entity-body" style="display:none">
                <label class="ea-all-label">
                    <input type="checkbox" onchange="toggleNewRow(this,'${esc(mod.name)}','${entity}'); epUpdateSummaryNew(this,'${entity}','${esc(mod.name)}')"> All permissions
                </label>
                <div class="ea-actions-row">
                    ${COMMON_ACTIONS.map(a => `<label class="ea-action-label">
                        <input type="checkbox" class="ep-new-cb" data-module="${esc(mod.name)}" data-entity="${entity}" data-action="${a}" onchange="epUpdateSummaryNew(this,'${entity}','${esc(mod.name)}')">
                        <span>${a}</span>
                    </label>`).join('')}
                </div>
            </div>
        </div>`;
    }).join('');

    return `<div class="ep-new-module-block" data-module="${esc(mod.name)}">
        <div class="ep-module-title ep-new-title">
            <input type="checkbox" class="ep-new-enable" id="epnewEnable_${safeId}" onchange="toggleNewModuleBlock('${safeId}')" onclick="event.stopPropagation()">
            <span class="material-icons-outlined" style="font-size:16px;color:var(--text-muted)">${esc(mod.icon || 'apps')}</span>
            <strong>${esc(mod.name)}</strong>
            <span class="ep-new-label">Check to assign</span>
        </div>
        <div class="ep-new-body" id="epnewBody_${safeId}" style="display:none">
            <div class="ep-role-row">
                <label>Role:</label>
                <select id="epnewRole_${safeId}" class="ep-role-sel" onchange="onNewRoleChange('${safeId}','${esc(mod.name)}')">
                    ${ROLE_OPTIONS.map(r => `<option value="${r.value}">${r.label}</option>`).join('')}
                </select>
            </div>
            ${sectionsHtml}
            <div class="ep-matrix-wrap">${accordionRows}</div>
        </div>
    </div>`;
}

function epToggleModule(header) {
    const body = header.nextElementSibling;
    const arrow = header.querySelector('.ep-mod-arrow');
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    arrow.textContent = open ? 'chevron_right' : 'expand_more';
}

const DEFAULT_ROLE_ACTIONS = {
    module_admin: ['view', 'create', 'edit', 'delete', 'export', 'import'],
    editor:       ['view', 'create', 'edit', 'export'],
    viewer:       ['view', 'export']
};

function onEpRoleChange(idx, moduleName) {
    const role = document.getElementById(`epRole_${idx}`).value;
    const baseActions = DEFAULT_ROLE_ACTIONS[role] || [];

    // Update section checkboxes
    const secCbs = document.querySelectorAll(`.ep-sec-cb[data-idx="${idx}"]`);
    if (moduleName === 'Part Management' && PART_ROLE_SECTIONS[role]) {
        const defaults = PART_ROLE_SECTIONS[role];
        secCbs.forEach(cb => cb.checked = defaults.includes(cb.value));
    } else {
        secCbs.forEach(cb => cb.checked = (role === 'module_admin' || role === 'editor'));
    }
    const wrap = document.querySelector(`.ep-module-block[data-idx="${idx}"] .ep-sections-wrap`);
    if (wrap) {
        const allSecCb = wrap.querySelector('.ep-check-all-label input');
        if (allSecCb) {
            const allSecs = wrap.querySelectorAll('.ep-sec-cb');
            allSecCb.checked = allSecs.length > 0 && Array.from(allSecs).every(c => c.checked);
        }
    }

    // Sync role badge in collapsed header
    const block = document.querySelector(`.ep-module-block[data-idx="${idx}"]`);
    if (block) {
        const badge = block.querySelector('.ep-mod-role-badge');
        const roleLabel = ROLE_OPTIONS.find(r => r.value === role)?.label || role;
        const rc = role === 'module_admin' ? 'role-admin' : role === 'editor' ? 'role-editor' : 'role-viewer';
        if (badge) { badge.textContent = roleLabel; badge.className = `role-badge ${rc} ep-mod-role-badge`; }
        block.querySelectorAll('.ep-perm-cb').forEach(cb => { cb.checked = baseActions.includes(cb.dataset.action); });
        block.querySelectorAll('.ea-entity-block').forEach(entityBlock => {
            const summary = entityBlock.querySelector('.ea-entity-summary');
            const checked = [...entityBlock.querySelectorAll('.ep-perm-cb:checked')].map(c => c.dataset.action);
            summary.innerHTML = checked.length ? checked.map(a => `<span class="perm-action-chip action-${a}">${a}</span>`).join('') : '<span style="color:var(--text-muted);font-size:11px">no access</span>';
            const allCb = entityBlock.querySelector('.ea-all-label input');
            if (allCb) allCb.checked = checked.length >= COMMON_ACTIONS.length;
        });
    }
}

function onNewRoleChange(safeId, moduleName) {
    const role = document.getElementById(`epnewRole_${safeId}`).value;
    const baseActions = DEFAULT_ROLE_ACTIONS[role] || [];

    const secCbs = document.querySelectorAll(`.ep-new-sec-cb[data-module="${moduleName}"]`);
    if (moduleName === 'Part Management' && PART_ROLE_SECTIONS[role]) {
        const defaults = PART_ROLE_SECTIONS[role];
        secCbs.forEach(cb => cb.checked = defaults.includes(cb.value));
    } else {
        secCbs.forEach(cb => cb.checked = (role === 'module_admin' || role === 'editor'));
    }

    const body = document.getElementById(`epnewBody_${safeId}`);
    if (body) {
        body.querySelectorAll('.ep-new-cb').forEach(cb => { cb.checked = baseActions.includes(cb.dataset.action); });
        body.querySelectorAll('.ea-entity-block').forEach(entityBlock => {
            const summary = entityBlock.querySelector('.ea-entity-summary');
            const checked = [...entityBlock.querySelectorAll('.ep-new-cb:checked')].map(c => c.dataset.action);
            summary.innerHTML = checked.length ? checked.map(a => `<span class="perm-action-chip action-${a}">${a}</span>`).join('') : '<span style="color:var(--text-muted);font-size:11px">no access</span>';
            const allCb = entityBlock.querySelector('.ea-all-label input');
            if (allCb) allCb.checked = checked.length >= COMMON_ACTIONS.length;
        });
    }
}

function toggleAllSections(cb, idx) {
    document.querySelectorAll(`.ep-sec-cb[data-idx="${idx}"]`).forEach(c => c.checked = cb.checked);
}

function toggleAllNewSections(cb, safeId) {
    cb.closest('.ep-sections-wrap').querySelectorAll('.ep-new-sec-cb').forEach(c => c.checked = cb.checked);
}

function toggleNewModuleBlock(safeId) {
    const enabled = document.getElementById('epnewEnable_' + safeId).checked;
    document.getElementById('epnewBody_' + safeId).style.display = enabled ? 'block' : 'none';
    if (enabled) {
        const block = document.getElementById('epnewBody_' + safeId);
        const roleEl = block.querySelector('.ep-role-sel');
        if (roleEl) {
            const moduleName = block.closest('.ep-new-module-block').dataset.module;
            onNewRoleChange(safeId, moduleName);
        }
    }
}

function toggleEpRow(cb, idx, entity) {
    document.querySelectorAll(`.ep-perm-cb[data-idx="${idx}"][data-entity="${entity}"]`)
        .forEach(c => c.checked = cb.checked);
}

function toggleNewRow(cb, moduleName, entity) {
    document.querySelectorAll(`.ep-new-cb[data-module="${moduleName}"][data-entity="${entity}"]`)
        .forEach(c => c.checked = cb.checked);
}

function epUpdateSummary(cb, entity, idx, cbClass) {
    const block = cb.closest('.ea-entity-block');
    if (!block) return;
    const header = block.querySelector('.ea-entity-header');
    const summary = header.querySelector('.ea-entity-summary');
    const checked = [...block.querySelectorAll(`.${cbClass}:checked`)].map(c => c.dataset.action);
    summary.innerHTML = checked.length ? checked.map(a => `<span class="perm-action-chip action-${a}">${a}</span>`).join('') : '<span style="color:var(--text-muted);font-size:11px">no access</span>';
    const allCb = block.querySelector('.ea-all-label input');
    if (allCb) allCb.checked = checked.length >= COMMON_ACTIONS.length;
}

function epUpdateSummaryNew(cb, entity, moduleName) {
    epUpdateSummary(cb, entity, null, 'ep-new-cb');
}

// Auto-sync row toggles & section all toggles on individual checkbox click
document.addEventListener('change', (e) => {
    if (e.target.classList.contains('ep-perm-cb')) {
        const idx = e.target.dataset.idx;
        const entity = e.target.dataset.entity;
        const rowCbs = document.querySelectorAll(`.ep-perm-cb[data-idx="${idx}"][data-entity="${entity}"]`);
        const rowToggle = e.target.closest('tr').querySelector('.perm-matrix-cell input[type="checkbox"]:not(.ep-perm-cb)');
        if (rowToggle) rowToggle.checked = Array.from(rowCbs).every(c => c.checked);
    }
    if (e.target.classList.contains('ep-sec-cb')) {
        const idx = e.target.dataset.idx;
        const wrap = document.querySelector(`.ep-module-block[data-idx="${idx}"] .ep-sections-wrap`);
        if (wrap) {
            const allSecCb = wrap.querySelector('.ep-check-all-label input');
            const allSecs = wrap.querySelectorAll('.ep-sec-cb');
            if (allSecCb) allSecCb.checked = Array.from(allSecs).every(c => c.checked);
        }
    }
    if (e.target.classList.contains('ep-new-cb')) {
        const mod = e.target.dataset.module;
        const entity = e.target.dataset.entity;
        const rowCbs = document.querySelectorAll(`.ep-new-cb[data-module="${mod}"][data-entity="${entity}"]`);
        const rowToggle = e.target.closest('tr').querySelector('.perm-matrix-cell input[type="checkbox"]:not(.ep-new-cb)');
        if (rowToggle) rowToggle.checked = Array.from(rowCbs).every(c => c.checked);
    }
});

// ─── SAVE ───
async function saveEditPermissions() {
    if (!_editPermUser) return;
    const saveBtn = document.querySelector('#editPermModal .form-actions button.btn-primary');
    const origText = saveBtn ? saveBtn.textContent : 'Save Permissions';
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

    const saves = [];

    // Update existing module blocks
    document.querySelectorAll('.ep-module-block[data-mode="edit"]').forEach(block => {
        const idx = parseInt(block.dataset.idx);
        const accessId = block.dataset.accessId;
        const role = document.getElementById(`epRole_${idx}`).value;
        const isActive = document.getElementById(`epActive_${idx}`).checked;

        const sections = [];
        block.querySelectorAll('.ep-sec-cb:checked').forEach(cb => sections.push(cb.value));

        const entityPerms = {};
        block.querySelectorAll('.ep-perm-cb').forEach(cb => {
            if (!entityPerms[cb.dataset.entity]) entityPerms[cb.dataset.entity] = [];
            if (cb.checked) {
                entityPerms[cb.dataset.entity].push(cb.dataset.action);
            }
        });

        saves.push(fetch(SEC_API + '/module-access/' + accessId, {
            method: 'PUT', headers: SEC_HEADERS,
            body: JSON.stringify({ role, is_active: isActive, permissions: { sections, entity_permissions: entityPerms } })
        }).then(r => r.json()));
    });

    // Grant new module blocks that are checked
    document.querySelectorAll('.ep-new-module-block').forEach(block => {
        const moduleName = block.dataset.module;
        const safeId = moduleName.replace(/\W+/g, '_');
        const enabled = document.getElementById('epnewEnable_' + safeId);
        if (!enabled || !enabled.checked) return;

        const role = document.getElementById('epnewRole_' + safeId).value;

        const sections = [];
        block.querySelectorAll('.ep-new-sec-cb:checked').forEach(cb => sections.push(cb.value));

        const entityPerms = {};
        block.querySelectorAll('.ep-new-cb').forEach(cb => {
            if (!entityPerms[cb.dataset.entity]) entityPerms[cb.dataset.entity] = [];
            if (cb.checked) {
                entityPerms[cb.dataset.entity].push(cb.dataset.action);
            }
        });

        saves.push(fetch(SEC_API + '/module-access', {
            method: 'POST', headers: SEC_HEADERS,
            body: JSON.stringify({
                user_id: _editPermUser.id, module: moduleName, role,
                permissions: { sections, entity_permissions: entityPerms }
            })
        }).then(r => r.json()));
    });

    if (!saves.length) {
        secCloseModal('editPermModal');
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = origText; }
        return;
    }

    try {
        const results = await Promise.all(saves);
        const failed = results.filter(r => !r.success);
        if (failed.length) {
            secToast(`${failed.length} update(s) failed: ${failed.map(f=>f.message).join(', ')}`, 'error');
        } else {
            secToast('Permissions saved');
            secCloseModal('editPermModal');
            loadPermUsers();
            if (typeof loadModuleAccess === 'function') loadModuleAccess();
            if (typeof loadSecOverview === 'function') loadSecOverview();
        }
    } catch (e) { secToast('Network error', 'error'); }
    finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = origText; }
    }
}
