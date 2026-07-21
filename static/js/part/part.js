const API = '/api/v1/part';
let HEADERS = { 'Content-Type': 'application/json', 'X-Tenant-ID': 'TEST' };

// Try to get user info from JWT token for audit headers
(function setUserHeaders() {
    try {
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const identity = typeof payload.sub === 'string' ? JSON.parse(payload.sub) : payload.sub;
            if (identity) {
                HEADERS['X-User-Email'] = identity.email || '';
                HEADERS['X-User-Name'] = identity.name || identity.first_name || '';
                if (identity.tenant_id) HEADERS['X-Tenant-ID'] = identity.tenant_id;
            }
        }
    } catch(e) {}
})();

let categories = [];
let subcategories = [];
let pendingDelete = null;

// ─── SECTION DEFINITIONS ───
const PART_SECTIONS = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'categories', label: 'Categories', icon: 'folder' },
    { id: 'subcategories', label: 'Subcategories', icon: 'folder_open' },
    { id: 'generate', label: 'Generate Part Code', icon: 'bolt' },
    { id: 'allparts', label: 'All Parts', icon: 'view_list' },
    { id: 'partmapping', label: 'Part Mapping', icon: 'account_tree' },
    { id: 'auditlogs', label: 'Audit Logs', icon: 'history' },
    { id: 'obsolete', label: 'Obsolete Parts', icon: 'block' },
    { id: 'moduleusers', label: 'User Management', icon: 'manage_accounts' }
];

let myAllowedSections = PART_SECTIONS.map(s => s.id); // default all

// ─── SECTION NAVIGATION ───
function showSection(section) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link[data-section]').forEach(l => l.classList.remove('active'));
    document.getElementById('sec-' + section).classList.add('active');
    const link = document.querySelector(`.sidebar-link[data-section="${section}"]`);
    if (link) link.classList.add('active');

    // Update URL without reload
    history.pushState(null, '', '/part/' + section);

    // Track in dashboard sidebar
    const sec = PART_SECTIONS.find(s => s.id === section);
    if (sec) trackModule(sec.label, sec.icon, '/part/' + section);

    if (section === 'overview') loadOverview();
    if (section === 'categories') loadCategories();
    if (section === 'subcategories') loadSubcategories();
    if (section === 'generate') loadGenCategories();
    if (section === 'allparts') loadApCategories();
    if (section === 'auditlogs') loadAuditLogs();
    if (section === 'obsolete') loadObsoleteParts();
    if (section === 'moduleusers') loadModuleUsers();
}

// ─── OVERVIEW ───
async function loadOverview() {
    try {
        const res = await fetch(API + '/overview', { headers: HEADERS });
        const data = await res.json();
        if (!data.success) return;
        const d = data.data;
        document.getElementById('statCategories').textContent = d.categories;
        document.getElementById('statSubcategories').textContent = d.subcategories;
        document.getElementById('statTotalParts').textContent = d.total_parts;
        document.getElementById('statActiveParts').textContent = d.active_parts;
        document.getElementById('statObsolete').textContent = d.obsolete_parts;

        const actEl = document.getElementById('overviewActivity');
        if (d.recent_activity && d.recent_activity.length > 0) {
            actEl.innerHTML = d.recent_activity.map(a => `
                <div class="activity-item">
                    <span class="activity-action action-${a.action.toLowerCase()}">${esc(a.action)}</span>
                    <span class="activity-entity">${esc(a.entity_type)}</span>
                    <span class="activity-id">${esc(a.entity_id)}</span>
                    <span class="activity-time">${formatTime(a.created_at)}</span>
                </div>
            `).join('');
        } else {
            actEl.innerHTML = '<div class="empty">No recent activity</div>';
        }
    } catch (e) {
        console.error('Overview error:', e);
    }
}

// ─── CATEGORIES ───
async function loadCategories() {
    try {
        const res = await fetch(API + '/categories', { headers: HEADERS });
        const data = await res.json();
        categories = data.data || [];
        renderCategories();
    } catch (e) { console.error('Load categories error:', e); }
}

function renderCategories() {
    const tbody = document.getElementById('categoriesTableBody');
    if (categories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">No categories yet. Create one to get started.</td></tr>';
        return;
    }
    tbody.innerHTML = categories.map(c => `<tr>
        <td><strong>${esc(c.name)}</strong></td>
        <td><code>${esc(c.code || '-')}</code></td>
        <td><span class="series-badge">${esc(c.series_prefix)}</span></td>
        <td>${esc(c.description || '-')}</td>
        <td class="actions-cell">
            <button class="btn-action" onclick="editCategory('${c.id}','${esc(c.name)}','${esc(c.description || '')}')" title="Edit">
                <span class="material-icons-outlined">edit</span>
            </button>
            <button class="btn-action btn-danger" onclick="deleteCategory('${c.id}','${esc(c.name)}')" title="Delete">
                <span class="material-icons-outlined">delete</span>
            </button>
        </td>
    </tr>`).join('');
}

function openCategoryModal() {
    document.getElementById('catName').value = '';
    document.getElementById('catSeries').value = '';
    document.getElementById('catCode').value = '';
    document.getElementById('catDesc').value = '';
    partOpenModal('categoryModal');
}

async function saveCategory(e) {
    e.preventDefault();
    const name = document.getElementById('catName').value.trim();
    const series_prefix = document.getElementById('catSeries').value.trim();
    if (!name || !series_prefix) { showToast('Name and Series Prefix are required', 'error'); return; }
    const body = { name, series_prefix, code: document.getElementById('catCode').value.trim() || undefined, description: document.getElementById('catDesc').value.trim() };
    try {
        const res = await fetch(API + '/categories', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.success) { partCloseModal('categoryModal'); showToast('Category "' + name + '" created'); loadCategories(); }
        else showToast(data.message || 'Failed', 'error');
    } catch (e) { showToast('Network error', 'error'); }
}

async function deleteCategory(id, name) {
    pendingDelete = { type: 'category', id, name };
    document.getElementById('deleteConfirmMsg').textContent = `Delete category "${name}"? This will also delete all subcategories and drop their database tables.`;
    document.getElementById('deleteConfirmPassword').value = '';
    document.getElementById('deleteError').style.display = 'none';
    partOpenModal('deleteConfirmModal');
}

// ─── SUBCATEGORIES ───
async function loadSubcategories() {
    try {
        if (categories.length === 0) {
            const cr = await fetch(API + '/categories', { headers: HEADERS });
            categories = (await cr.json()).data || [];
        }
        const res = await fetch(API + '/subcategories', { headers: HEADERS });
        subcategories = (await res.json()).data || [];
        renderSubcategories();
    } catch (e) { console.error('Load subcategories error:', e); }
}

function renderSubcategories() {
    const tbody = document.getElementById('subcategoriesTableBody');
    if (subcategories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">No subcategories yet.</td></tr>';
        return;
    }
    tbody.innerHTML = subcategories.map(s => {
        const cols = parseCols(s.columns_config);
        const colTags = cols.map(c => `<span class="col-tag">${esc(c.name)}</span>`).join('');
        const sData = encodeURIComponent(JSON.stringify(s));
        return `<tr>
            <td><div class="cell-main">${esc(s.name)}</div><div class="cell-sub">${esc(s.code || '')}</div></td>
            <td><span class="cat-badge">${esc(s.category_name || '-')}</span></td>
            <td><span class="series-badge">${esc(s.cat_series || '?')}-${esc(s.series_prefix)}</span></td>
            <td><strong>${s.current_sequence || 0}</strong></td>
            <td><div class="col-tags">${colTags || '<span class="text-muted">None</span>'}</div></td>
            <td class="actions-cell">
                <button class="btn-action" onclick="editSubcategory('${sData}')" title="Edit">
                    <span class="material-icons-outlined">edit</span>
                </button>
                <button class="btn-action btn-danger" onclick="deleteSubcategory('${s.id}','${esc(s.name)}')" title="Delete">
                    <span class="material-icons-outlined">delete</span>
                </button>
            </td>
        </tr>`;
    }).join('');
}

function openSubcategoryModal() {
    document.getElementById('subCatName').value = '';
    document.getElementById('subCatSeries').value = '';
    document.getElementById('subCatCode').value = '';
    const sel = document.getElementById('subCatCategory');
    sel.innerHTML = '<option value="">Select Category</option>' + categories.map(c => `<option value="${c.id}">${esc(c.name)} (${esc(c.series_prefix)})</option>`).join('');
    document.getElementById('columnsContainer').innerHTML = getColumnRowHTML();
    updateDescColsCheckboxes();
    partOpenModal('subcategoryModal');
}

function updateDescColsCheckboxes() {
    const container = document.getElementById('descColsContainer');
    if (!container) return;
    const cols = [];
    document.querySelectorAll('#columnsContainer .column-row .col-name').forEach(input => {
        const name = input.value.trim().toLowerCase();
        if (name) cols.push(name);
    });
    if (cols.length === 0) {
        container.innerHTML = '<span class="text-muted">Add columns first</span>';
        return;
    }
    container.innerHTML = cols.map(c => `<label class="desc-col-label"><input type="checkbox" value="${esc(c)}" checked> ${esc(c)}</label>`).join('');
}

function getColumnRowHTML() {
    return `<div class="column-row">
        <input type="text" placeholder="Column name (e.g. material)" class="col-name" required onblur="updateDescColsCheckboxes()">
        <select class="col-type"><option value="varchar">Text</option><option value="integer">Number</option><option value="numeric">Decimal</option><option value="boolean">Yes/No</option><option value="date">Date</option></select>
        <button type="button" class="btn-icon-danger" onclick="removeColumnRow(this)"><span class="material-icons-outlined">close</span></button>
    </div>`;
}

function addColumnRow() {
    document.getElementById('columnsContainer').insertAdjacentHTML('beforeend', getColumnRowHTML());
    updateDescColsCheckboxes();
}

function removeColumnRow(btn) {
    if (document.querySelectorAll('#columnsContainer .column-row').length <= 1) { showToast('At least one column required', 'error'); return; }
    btn.closest('.column-row').remove();
    updateDescColsCheckboxes();
}

async function saveSubcategory(e) {
    e.preventDefault();
    const catId = document.getElementById('subCatCategory').value;
    const name = document.getElementById('subCatName').value.trim();
    const series = document.getElementById('subCatSeries').value.trim();
    if (!catId) { showToast('Select a category', 'error'); return; }
    if (!name || !series) { showToast('Name and Series required', 'error'); return; }

    const columns = [];
    for (const row of document.querySelectorAll('#columnsContainer .column-row')) {
        const colName = row.querySelector('.col-name').value.trim();
        const colType = row.querySelector('.col-type').value;
        if (!colName) { showToast('All column names required', 'error'); return; }
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(colName)) { showToast(`Invalid column name "${colName}"`, 'error'); return; }
        columns.push({ name: colName.toLowerCase(), type: colType, label: colName });
    }

    // Collect description columns (checked ones)
    const description_columns = [];
    document.querySelectorAll('#descColsContainer input[type="checkbox"]:checked').forEach(cb => {
        description_columns.push(cb.value);
    });

    const body = { name, series_prefix: series, code: document.getElementById('subCatCode').value.trim() || undefined, category_id: catId, columns, description_columns };
    try {
        const res = await fetch(API + '/subcategories', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.success) { partCloseModal('subcategoryModal'); showToast(`Subcategory "${name}" created`); loadSubcategories(); }
        else showToast(data.message || 'Failed', 'error');
    } catch (e) { showToast('Network error', 'error'); }
}

async function deleteSubcategory(id, name) {
    pendingDelete = { type: 'subcategory', id, name };
    document.getElementById('deleteConfirmMsg').textContent = `Delete subcategory "${name}"? This will permanently drop the database table.`;
    document.getElementById('deleteConfirmPassword').value = '';
    document.getElementById('deleteError').style.display = 'none';
    partOpenModal('deleteConfirmModal');
}

// ─── GENERATE PART ───
async function loadGenCategories() {
    try {
        const res = await fetch(API + '/categories', { headers: HEADERS });
        categories = (await res.json()).data || [];
    } catch (e) {}
    const sel = document.getElementById('genCategory');
    sel.innerHTML = '<option value="">— Select Category —</option>' + categories.map(c => `<option value="${c.id}" data-series="${c.series_prefix}">${esc(c.name)} (${c.series_prefix})</option>`).join('');
    document.getElementById('genSubcategory').innerHTML = '<option value="">— Select Subcategory —</option>';
    document.getElementById('genColumnsForm').innerHTML = '';
    document.getElementById('genPreview').style.display = 'none';
    document.getElementById('btnGenerate').disabled = true;
    document.getElementById('genResult').innerHTML = '';
    document.getElementById('generatedPartsList').innerHTML = '<div class="empty">Select a subcategory to view parts</div>';
}

async function loadGenSubcategories() {
    const catId = document.getElementById('genCategory').value;
    const sel = document.getElementById('genSubcategory');
    document.getElementById('genColumnsForm').innerHTML = '';
    document.getElementById('genPreview').style.display = 'none';
    document.getElementById('btnGenerate').disabled = true;
    document.getElementById('generatedPartsList').innerHTML = '<div class="empty">Select a subcategory</div>';
    if (!catId) { sel.innerHTML = '<option value="">— Select Subcategory —</option>'; return; }
    const res = await fetch(API + '/subcategories?category_id=' + catId, { headers: HEADERS });
    const subs = (await res.json()).data || [];
    sel.innerHTML = '<option value="">— Select Subcategory —</option>' + subs.map(s => {
        const colsStr = JSON.stringify(s.columns_config || []).replace(/'/g, '&#39;');
        return `<option value="${s.id}" data-series="${s.series_prefix}" data-cols='${colsStr}'>${esc(s.name)} (${s.series_prefix})</option>`;
    }).join('');
}

function loadGenColumns() {
    const sel = document.getElementById('genSubcategory');
    const opt = sel.options[sel.selectedIndex];
    if (!opt || !opt.value) { document.getElementById('genColumnsForm').innerHTML = ''; document.getElementById('genPreview').style.display = 'none'; document.getElementById('btnGenerate').disabled = true; return; }
    const cols = JSON.parse(opt.dataset.cols || '[]');
    const catOpt = document.getElementById('genCategory').options[document.getElementById('genCategory').selectedIndex];
    const catSeries = catOpt.dataset.series;
    document.getElementById('genPreview').style.display = 'block';
    document.getElementById('partPreviewText').textContent = `${catSeries}-${opt.dataset.series}-XXXXXX`;
    document.getElementById('genColumnsForm').innerHTML = cols.length > 0 ? '<p class="gen-cols-title">Part Details</p>' + cols.map(c => `<div class="form-group"><label>${esc(c.label || c.name)}</label><input type="text" id="gen_col_${c.name}" placeholder="Enter ${esc(c.label || c.name)}"></div>`).join('') : '';
    document.getElementById('btnGenerate').disabled = false;
    document.getElementById('genResult').innerHTML = '';
    loadGeneratedParts(opt.value);
}

async function generatePart() {
    const subId = document.getElementById('genSubcategory').value;
    if (!subId) return;
    const opt = document.getElementById('genSubcategory').options[document.getElementById('genSubcategory').selectedIndex];
    const cols = JSON.parse(opt.dataset.cols || '[]');
    const values = {};
    cols.forEach(c => { const input = document.getElementById('gen_col_' + c.name); if (input && input.value.trim()) values[c.name] = input.value.trim(); });
    document.getElementById('btnGenerate').disabled = true;
    try {
        const res = await fetch(API + '/generate', { method: 'POST', headers: HEADERS, body: JSON.stringify({ subcategory_id: subId, values }) });
        const data = await res.json();
        if (data.success) {
            const desc = data.data.description ? ` | ${data.data.description}` : '';
            document.getElementById('genResult').innerHTML = `<div class="success-msg"><span class="material-icons-outlined">check_circle</span> Generated: <strong>${data.data.part_number}</strong>${desc}</div>`;
            document.getElementById('partPreviewText').textContent = data.data.part_number;
            cols.forEach(c => { const input = document.getElementById('gen_col_' + c.name); if (input) input.value = ''; });
            loadGeneratedParts(subId);
        } else {
            // Show duplicate error with existing part code
            if (res.status === 409 && data.data && data.data.existing_part) {
                document.getElementById('genResult').innerHTML = `<div class="error-msg"><span class="material-icons-outlined">error</span> Part already exists: <strong>${data.data.existing_part}</strong><br><small>Description: "${esc(data.data.description)}"</small></div>`;
            } else {
                showToast(data.message || 'Generation failed', 'error');
            }
        }
    } catch (e) { showToast('Network error', 'error'); }
    document.getElementById('btnGenerate').disabled = false;
}

async function loadGeneratedParts(subId) {
    const container = document.getElementById('generatedPartsList');
    try {
        const res = await fetch(API + '/parts/' + subId, { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data || data.data.length === 0) { container.innerHTML = '<div class="empty">No parts generated yet</div>'; return; }
        container.innerHTML = data.data.map(p => {
            const isObs = p.status === 'obsolete';
            const meta = Object.entries(p).filter(([k]) => !['id','part_number','created_at','status','obsoleted_at','obsolete_reason'].includes(k)).filter(([,v]) => v).map(([k,v]) => `<span class="meta-tag">${k}: ${v}</span>`).join('');
            return `<div class="part-item ${isObs ? 'obsolete' : ''}">
                <div class="part-item-left"><span class="part-item-number">${p.part_number}</span><div class="part-item-meta">${meta}</div></div>
                <div class="part-item-actions">${isObs ? '<span class="obs-badge">Obsolete</span>' : `<button class="btn-obs" onclick="obsoletePart('${subId}','${p.part_number}')" title="Mark Obsolete"><span class="material-icons-outlined">block</span></button>`}</div>
            </div>`;
        }).join('');
    } catch (e) { container.innerHTML = '<div class="empty">Error loading parts</div>'; }
}

// ─── ALL PARTS ───
async function loadApCategories() {
    try {
        if (categories.length === 0) { const r = await fetch(API + '/categories', { headers: HEADERS }); categories = (await r.json()).data || []; }
    } catch (e) {}
    const sel = document.getElementById('apCategory');
    sel.innerHTML = '<option value="">— Select Category —</option>' + categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    document.getElementById('apSubcategory').innerHTML = '<option value="">Select Subcategory</option>';
    document.getElementById('allPartsBody').innerHTML = '<tr><td colspan="3" class="empty">Select a subcategory to view parts</td></tr>';
}

async function loadApSubcategories() {
    const catId = document.getElementById('apCategory').value;
    const sel = document.getElementById('apSubcategory');
    if (!catId) { sel.innerHTML = '<option value="">Select Subcategory</option>'; return; }
    const res = await fetch(API + '/subcategories?category_id=' + catId, { headers: HEADERS });
    const subs = (await res.json()).data || [];
    sel.innerHTML = '<option value="">— Select Subcategory —</option>' + subs.map(s => {
        const colsStr = JSON.stringify(s.columns_config || []).replace(/'/g, '&#39;');
        return `<option value="${s.id}" data-cols='${colsStr}'>${esc(s.name)}</option>`;
    }).join('');
}

async function loadAllParts() {
    const subId = document.getElementById('apSubcategory').value;
    const tbody = document.getElementById('allPartsBody');
    const thead = document.getElementById('allPartsHead');
    if (!subId) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Select a subcategory</td></tr>'; return; }
    const opt = document.getElementById('apSubcategory').options[document.getElementById('apSubcategory').selectedIndex];
    const cols = JSON.parse(opt.dataset.cols || '[]');

    // Build dynamic header
    let headers = '<th>Part Number</th><th>Description</th>';
    cols.forEach(c => { headers += `<th>${esc(c.label || c.name)}</th>`; });
    headers += '<th>Created By</th><th>Status</th><th>Created</th>';
    thead.innerHTML = `<tr>${headers}</tr>`;

    try {
        const res = await fetch(API + '/parts/' + subId, { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data || data.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${5 + cols.length}" class="empty">No parts found</td></tr>`;
            return;
        }
        tbody.innerHTML = data.data.map(p => {
            let row = `<td><strong class="part-number-cell">${esc(p.part_number)}</strong></td>`;
            row += `<td><span class="desc-cell">${esc(p.description || '-')}</span></td>`;
            cols.forEach(c => { row += `<td>${esc(p[c.name] || '-')}</td>`; });
            row += `<td>${esc(p.created_by || '-')}</td>`;
            const statusClass = p.status === 'obsolete' ? 'status-obsolete' : 'status-active';
            row += `<td><span class="status-badge ${statusClass}">${esc(p.status || 'active')}</span></td>`;
            row += `<td>${formatTime(p.created_at)}</td>`;
            return `<tr>${row}</tr>`;
        }).join('');
    } catch (e) { tbody.innerHTML = `<tr><td colspan="${5 + cols.length}" class="empty">Error loading</td></tr>`; }
}

// ─── AUDIT LOGS ───
let auditPage = 1;
async function loadAuditLogs(page = 1) {
    auditPage = page;
    const tbody = document.getElementById('auditLogsBody');
    try {
        const res = await fetch(API + '/audit-logs?page=' + page + '&limit=20', { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data.items || data.data.items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty">No audit logs</td></tr>';
            document.getElementById('auditPagination').innerHTML = '';
            return;
        }
        tbody.innerHTML = data.data.items.map(l => {
            const user = l.user_name || l.user_email || 'System';
            const emailLine = l.user_email ? `<div class="cell-sub">${esc(l.user_email)}</div>` : '';
            return `<tr>
                <td><span class="action-badge action-${l.action.toLowerCase()}">${esc(l.action)}</span></td>
                <td><div class="cell-main">${esc(l.entity_type)}</div><div class="cell-sub"><code>${esc(l.entity_id)}</code></div></td>
                <td><div class="cell-main">${esc(user)}</div>${emailLine}</td>
                <td><code>${esc(l.ip_address || '-')}</code></td>
                <td>${formatTime(l.created_at)}</td>
            </tr>`;
        }).join('');

        const totalPages = Math.ceil(data.data.total / 20);
        let pag = '';
        if (totalPages > 1) {
            if (page > 1) pag += `<button class="btn-page" onclick="loadAuditLogs(${page-1})">← Prev</button>`;
            pag += `<span class="page-info">Page ${page} of ${totalPages}</span>`;
            if (page < totalPages) pag += `<button class="btn-page" onclick="loadAuditLogs(${page+1})">Next →</button>`;
        }
        document.getElementById('auditPagination').innerHTML = pag;
    } catch (e) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Error loading</td></tr>'; }
}

// ─── OBSOLETE ───
async function obsoletePart(subId, partNumber) {
    pendingDelete = { type: 'obsolete', subId, partNumber };
    document.getElementById('deleteConfirmMsg').textContent = `Mark part "${partNumber}" as obsolete? Enter your password to confirm.`;
    document.getElementById('deleteConfirmPassword').value = '';
    document.getElementById('deleteError').style.display = 'none';
    partOpenModal('deleteConfirmModal');
}

async function loadObsoleteParts() {
    const tbody = document.getElementById('obsoletePartsBody');
    try {
        const res = await fetch(API + '/obsolete-parts', { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data || data.data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="empty">No obsolete parts</td></tr>'; return; }
        tbody.innerHTML = data.data.map(p => `<tr class="obsolete-row">
            <td><strong>${esc(p.part_number)}</strong></td>
            <td>${esc(p.category || '-')}</td>
            <td>${esc(p.subcategory || '-')}</td>
            <td>${formatTime(p.obsoleted_at)}</td>
            <td>${esc(p.reason || '-')}</td>
        </tr>`).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Error loading</td></tr>'; }
}

// ─── DELETE WITH PASSWORD CONFIRMATION ───
async function executeDelete() {
    const password = document.getElementById('deleteConfirmPassword').value;
    if (!password) { showDeleteError('Password is required'); return; }

    const btn = document.getElementById('deleteConfirmBtn');
    btn.disabled = true;
    btn.textContent = 'Verifying...';

    // Verify password
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const email = user.email || '';
    try {
        const verifyRes = await fetch('/api/v1/auth/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('access_token') || localStorage.getItem('token') || '') },
            body: JSON.stringify({ email, password })
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
            showDeleteError(verifyData.message || 'Incorrect password');
            btn.disabled = false;
            btn.textContent = 'Delete';
            return;
        }
    } catch (e) {
        showDeleteError('Failed to verify password');
        btn.disabled = false;
        btn.textContent = 'Delete';
        return;
    }

    // Password verified, proceed with delete
    try {
        if (pendingDelete.type === 'category') {
            const res = await fetch(API + '/categories/' + pendingDelete.id, { method: 'DELETE', headers: HEADERS });
            const data = await res.json();
            if (data.success) { showToast('Category deleted'); loadCategories(); }
            else {
                btn.disabled = false; btn.textContent = 'Delete';
                showDeleteError(data.message || 'Delete failed');
                return;
            }
        } else if (pendingDelete.type === 'subcategory') {
            const res = await fetch(API + '/subcategories/' + pendingDelete.id, { method: 'DELETE', headers: HEADERS });
            const data = await res.json();
            if (data.success) { showToast('Subcategory deleted'); loadSubcategories(); }
            else {
                btn.disabled = false; btn.textContent = 'Delete';
                showDeleteError(data.message || 'Delete failed');
                return;
            }
        } else if (pendingDelete.type === 'obsolete') {
            const res = await fetch(API + '/obsolete', { method: 'POST', headers: HEADERS, body: JSON.stringify({ subcategory_id: pendingDelete.subId, part_number: pendingDelete.partNumber }) });
            const data = await res.json();
            if (data.success) { showToast(`Part ${pendingDelete.partNumber} marked as obsolete`); loadGeneratedParts(pendingDelete.subId); }
            else showToast(data.message || 'Failed', 'error');
        } else if (pendingDelete.type === 'revoke_access') {
            const res = await fetch(API + '/users/' + pendingDelete.id, { method: 'DELETE', headers: HEADERS });
            const data = await res.json();
            if (data.success) { showToast('Access revoked'); loadModuleUsers(); }
            else showToast(data.message || 'Failed', 'error');
        }
    } catch (e) { showToast('Network error', 'error'); }

    partCloseModal('deleteConfirmModal');
    pendingDelete = null;
    btn.disabled = false;
    btn.textContent = 'Delete';
}

function showDeleteError(msg) {
    const el = document.getElementById('deleteError');
    el.textContent = msg;
    el.style.display = 'block';
}

// ─── EDIT FUNCTIONS ───
function editCategory(id, name, desc) {
    const newName = prompt('Category Name:', name);
    if (!newName || newName === name && desc === (prompt('Description:', desc) || desc)) return;
    const newDesc = prompt('Description:', desc);
    fetch(API + '/categories/' + id, { method: 'PUT', headers: HEADERS, body: JSON.stringify({ name: newName || name, description: newDesc || '' }) })
        .then(r => r.json()).then(d => { if (d.success) { showToast('Category updated'); loadCategories(); } else showToast(d.message || 'Failed', 'error'); });
}

function editSubcategory(encodedData) {
    const s = JSON.parse(decodeURIComponent(encodedData));
    document.getElementById('editSubId').value = s.id;
    document.getElementById('editSubName').value = s.name || '';
    document.getElementById('editSubCode').value = s.code || '';
    document.getElementById('editSubSeries').value = s.series_prefix || '';
    // Populate category dropdown
    const sel = document.getElementById('editSubCategory');
    sel.innerHTML = categories.map(c => `<option value="${c.id}" ${c.id === s.category_id ? 'selected' : ''}>${esc(c.name)} (${esc(c.series_prefix)})</option>`).join('');
    // Populate columns
    const cols = parseCols(s.columns_config);
    const container = document.getElementById('editColumnsContainer');
    if (cols.length > 0) {
        container.innerHTML = cols.map(c => `<div class="column-row">
            <input type="text" value="${esc(c.name)}" class="col-name" required onblur="updateEditDescColsCheckboxes()">
            <select class="col-type">
                <option value="varchar" ${c.type === 'varchar' ? 'selected' : ''}>Text</option>
                <option value="integer" ${c.type === 'integer' ? 'selected' : ''}>Number</option>
                <option value="numeric" ${c.type === 'numeric' ? 'selected' : ''}>Decimal</option>
                <option value="boolean" ${c.type === 'boolean' ? 'selected' : ''}>Yes/No</option>
                <option value="date" ${c.type === 'date' ? 'selected' : ''}>Date</option>
            </select>
            <button type="button" class="btn-icon-danger" onclick="removeEditColumnRow(this)"><span class="material-icons-outlined">close</span></button>
        </div>`).join('');
    } else {
        container.innerHTML = '<div class="empty" style="font-size:12px;color:var(--text-muted)">No columns defined</div>';
    }
    // Populate description columns checkboxes
    const descCols = s.description_columns ? (Array.isArray(s.description_columns) ? s.description_columns : JSON.parse(s.description_columns || '[]')) : [];
    updateEditDescColsCheckboxes(descCols);
    partOpenModal('editSubcategoryModal');
}

function updateEditDescColsCheckboxes(checkedCols) {
    const container = document.getElementById('editDescColsContainer');
    if (!container) return;
    const cols = [];
    document.querySelectorAll('#editColumnsContainer .column-row .col-name').forEach(input => {
        const name = input.value.trim().toLowerCase();
        if (name) cols.push(name);
    });
    if (cols.length === 0) {
        container.innerHTML = '<span class="text-muted">No columns defined</span>';
        return;
    }
    // If checkedCols not passed, preserve current checked state
    if (!checkedCols) {
        checkedCols = [];
        container.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => checkedCols.push(cb.value));
    }
    container.innerHTML = cols.map(c => {
        const checked = checkedCols.includes(c) ? 'checked' : '';
        return `<label class="desc-col-label"><input type="checkbox" value="${esc(c)}" ${checked}> ${esc(c)}</label>`;
    }).join('');
}

function addEditColumnRow() {
    const container = document.getElementById('editColumnsContainer');
    container.insertAdjacentHTML('beforeend', `<div class="column-row">
        <input type="text" placeholder="Column name" class="col-name" required onblur="updateEditDescColsCheckboxes()">
        <select class="col-type"><option value="varchar">Text</option><option value="integer">Number</option><option value="numeric">Decimal</option><option value="boolean">Yes/No</option><option value="date">Date</option></select>
        <button type="button" class="btn-icon-danger" onclick="removeEditColumnRow(this)"><span class="material-icons-outlined">close</span></button>
    </div>`);
    updateEditDescColsCheckboxes();
}

function removeEditColumnRow(btn) {
    btn.closest('.column-row').remove();
    updateEditDescColsCheckboxes();
}

async function saveEditSubcategory(e) {
    e.preventDefault();
    const id = document.getElementById('editSubId').value;
    const name = document.getElementById('editSubName').value.trim();
    const code = document.getElementById('editSubCode').value.trim();
    const series_prefix = document.getElementById('editSubSeries').value.trim();
    const category_id = document.getElementById('editSubCategory').value;
    if (!name) { showToast('Name is required', 'error'); return; }

    const columns = [];
    for (const row of document.querySelectorAll('#editColumnsContainer .column-row')) {
        const colName = row.querySelector('.col-name').value.trim();
        const colType = row.querySelector('.col-type').value;
        if (colName) columns.push({ name: colName.toLowerCase(), type: colType, label: colName });
    }

    // Collect description columns
    const description_columns = [];
    document.querySelectorAll('#editDescColsContainer input[type="checkbox"]:checked').forEach(cb => {
        description_columns.push(cb.value);
    });

    const body = { name, code, series_prefix, category_id, columns, description_columns };
    try {
        const res = await fetch(API + '/subcategories/' + id, { method: 'PUT', headers: HEADERS, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.success) { partCloseModal('editSubcategoryModal'); showToast('Subcategory updated'); loadSubcategories(); }
        else showToast(data.message || 'Update failed', 'error');
    } catch (e) { showToast('Network error', 'error'); }
}

// ─── UTILITIES ───
function esc(str) { if (!str) return ''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function parseCols(config) { if (!config) return []; if (Array.isArray(config)) return config; if (typeof config === 'string') { try { return JSON.parse(config); } catch(e) { return []; } } return []; }
function formatTime(ts) { if (!ts || ts === 'None') return '-'; try { const d = new Date(ts); return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); } catch(e) { return ts; } }

function partOpenModal(id) { document.getElementById(id).classList.add('active'); }
function partCloseModal(id) { document.getElementById(id).classList.remove('active'); }

function showToast(msg, type = 'success') {
    let toast = document.getElementById('partToast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'partToast'; document.body.appendChild(toast); }
    toast.className = 'part-toast ' + type;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

// ─── MODULE USER MANAGEMENT ───

// Default sections per role
const ROLE_DEFAULT_SECTIONS = {
    module_admin: ['overview', 'categories', 'subcategories', 'generate', 'allparts', 'partmapping', 'auditlogs', 'obsolete', 'moduleusers'],
    editor: ['overview', 'categories', 'subcategories', 'generate', 'allparts', 'partmapping', 'auditlogs', 'obsolete'],
    viewer: ['overview', 'allparts', 'obsolete']
};

// Entities and actions for Part Management
const PART_ENTITIES = [
    { id: 'categories',        label: 'Categories' },
    { id: 'subcategories',     label: 'Subcategories' },
    { id: 'parts',             label: 'Parts (Generate)' },
    { id: 'generate_part_code',label: 'Generate Part Code' },
    { id: 'part_mapping',      label: 'Part Mapping' },
    { id: 'obsolete_parts',    label: 'Obsolete Parts' },
    { id: 'audit_logs',        label: 'Audit Logs' },
    { id: 'user_management',   label: 'User Management' }
];
const PART_ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'import'];

// Default entity permissions per role
const ROLE_DEFAULT_PERMS = {
    module_admin: () => {
        const p = {};
        PART_ENTITIES.forEach(e => p[e.id] = [...PART_ACTIONS]);
        return p;
    },
    editor: () => {
        const p = {};
        PART_ENTITIES.forEach(e => p[e.id] = ['view', 'create', 'edit', 'export', 'import']);
        delete p['user_management'];
        p['user_management'] = ['view'];
        return p;
    },
    viewer: () => {
        const p = {};
        PART_ENTITIES.forEach(e => p[e.id] = ['view', 'export']);
        return p;
    }
};

function renderSectionCheckboxes(containerId, checkedSections) {
    const container = document.getElementById(containerId);
    container.innerHTML = PART_SECTIONS.map(s => {
        const checked = checkedSections.includes(s.id) ? 'checked' : '';
        return `<label class="section-check-label">
            <input type="checkbox" value="${s.id}" ${checked}>
            <span class="material-icons-outlined" style="font-size:16px;">${s.icon}</span>
            ${esc(s.label)}
        </label>`;
    }).join('');
}

function renderPermMatrix(containerId, entityPerms) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <table class="perm-matrix-table">
            <thead><tr>
                <th>Entity</th>
                ${PART_ACTIONS.map(a => `<th>${a}</th>`).join('')}
                <th>All</th>
            </tr></thead>
            <tbody>
                ${PART_ENTITIES.map(e => {
                    const perms = entityPerms[e.id] || [];
                    return `<tr>
                        <td class="entity-label">${esc(e.label)}</td>
                        ${PART_ACTIONS.map(a => `<td><input type="checkbox" class="perm-cb" data-entity="${e.id}" data-action="${a}" ${perms.includes(a) ? 'checked' : ''}></td>`).join('')}
                        <td><input type="checkbox" class="perm-row-toggle" data-entity="${e.id}" ${perms.length === PART_ACTIONS.length ? 'checked' : ''} onchange="togglePermRow(this, '${containerId}')"></td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    `;
}

function togglePermRow(cb, containerId) {
    const entity = cb.dataset.entity;
    const container = document.getElementById(containerId);
    container.querySelectorAll(`.perm-cb[data-entity="${entity}"]`).forEach(c => c.checked = cb.checked);
}

function collectPermissions(containerId) {
    const perms = {};
    document.getElementById(containerId).querySelectorAll('.perm-cb:checked').forEach(cb => {
        const entity = cb.dataset.entity;
        const action = cb.dataset.action;
        if (!perms[entity]) perms[entity] = [];
        perms[entity].push(action);
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

async function loadModuleUsers() {
    const tbody = document.getElementById('moduleUsersBody');
    try {
        const res = await fetch(API + '/users', { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data || data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty">No users assigned to this module yet. Click "Add User" to grant access.</td></tr>';
            return;
        }
        tbody.innerHTML = data.data.map(u => {
            const name = (u.first_name + ' ' + u.last_name).trim() || u.email;
            const roleClass = u.role === 'module_admin' ? 'role-admin' : u.role === 'editor' ? 'role-editor' : 'role-viewer';
            const roleLabel = u.role === 'module_admin' ? 'Module Admin' : u.role === 'editor' ? 'Editor' : 'Viewer';
            const statusClass = u.is_active ? 'status-active' : 'status-obsolete';
            const statusLabel = u.is_active ? 'Active' : 'Inactive';
            // Show allowed sections
            const perms = typeof u.permissions === 'string' ? JSON.parse(u.permissions || '{}') : (u.permissions || {});
            const sections = (perms && perms.sections) ? perms.sections : ROLE_DEFAULT_SECTIONS[u.role] || [];
            const sectionTags = sections.map(s => {
                const sec = PART_SECTIONS.find(ps => ps.id === s);
                return sec ? `<span class="section-tag">${sec.label}</span>` : '';
            }).join('');
            const uData = encodeURIComponent(JSON.stringify({ id: u.id, email: u.email, first_name: u.first_name, last_name: u.last_name, role: u.role, permissions: perms }));
            return `<tr>
                <td><strong>${esc(name)}</strong><div class="cell-sub">${esc(u.email)}</div></td>
                <td><span class="role-badge ${roleClass}">${roleLabel}</span></td>
                <td><div class="section-tags-cell">${sectionTags}</div></td>
                <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                <td>${formatTime(u.created_at)}</td>
                <td class="actions-cell">
                    <button class="btn-action" onclick="openEditModuleUser('${uData}')" title="Edit Sections">
                        <span class="material-icons-outlined">edit</span>
                    </button>
                    <button class="btn-action btn-danger" onclick="revokeModuleUser('${u.id}','${esc(u.email)}')" title="Revoke Access">
                        <span class="material-icons-outlined">person_remove</span>
                    </button>
                </td>
            </tr>`;
        }).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="6" class="empty">Error loading users</td></tr>'; }
}

async function openAddUserModal() {
    document.getElementById('muUserSearch').value = '';
    document.getElementById('muUserSelect').value = '';
    document.getElementById('muUserResults').innerHTML = '';
    document.getElementById('muUserSelected').style.display = 'none';
    document.getElementById('muRole').value = 'viewer';
    onMuRoleChange();
    partOpenModal('addModuleUserModal');
}

async function searchEmployeesForPart(query) {
    const resultsDiv = document.getElementById('muUserResults');
    if (!query || query.trim().length < 2) { resultsDiv.innerHTML = ''; return; }
    try {
        const res = await fetch('/api/v1/security/search-employees?q=' + encodeURIComponent(query.trim()), { headers: HEADERS });
        const data = await res.json();
        if (!data.data || data.data.length === 0) {
            resultsDiv.innerHTML = '<div class="emp-search-empty">No employees found</div>';
            return;
        }
        resultsDiv.innerHTML = data.data.map(e => `
            <div class="emp-search-item" onclick="selectEmployeeForPart('${e.id}','${esc(e.emp_code)} - ${esc(e.first_name)} ${esc(e.last_name)} (${esc(e.email || 'no email')})')">
                <div class="emp-search-main"><strong>${esc(e.emp_code)}</strong> — ${esc(e.first_name)} ${esc(e.last_name)}</div>
                <div class="emp-search-sub">${esc(e.email || 'No email')}</div>
            </div>
        `).join('');
    } catch (e) { resultsDiv.innerHTML = ''; }
}

function selectEmployeeForPart(empId, label) {
    fetch('/api/v1/security/import-employee', {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({ employee_id: empId })
    }).then(r => r.json()).then(data => {
        if (data.success) {
            document.getElementById('muUserSelect').value = data.data.id;
            document.getElementById('muUserSearch').value = '';
            document.getElementById('muUserResults').innerHTML = '';
            document.getElementById('muUserSelLabel').textContent = label;
            document.getElementById('muUserSelected').style.display = 'flex';
        } else { showToast(data.message || 'Failed to link employee', 'error'); }
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
    if (!userId) { showToast('Select a user', 'error'); return; }

    const sections = [];
    document.querySelectorAll('#muSectionCheckboxes input:checked').forEach(cb => sections.push(cb.value));
    const entity_permissions = collectPermissions('muPermMatrix');

    const permissions = { sections, entity_permissions };

    try {
        const res = await fetch(API + '/users', {
            method: 'POST', headers: HEADERS,
            body: JSON.stringify({ user_id: userId, role, permissions })
        });
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
    const sections = perms.sections || ROLE_DEFAULT_SECTIONS[u.role] || [];
    const entityPerms = perms.entity_permissions || ROLE_DEFAULT_PERMS[u.role]();
    renderSectionCheckboxes('emuSectionCheckboxes', sections);
    renderPermMatrix('emuPermMatrix', entityPerms);
    partOpenModal('editModuleUserModal');
}

async function saveEditModuleUser(e) {
    e.preventDefault();
    const accessId = document.getElementById('emuAccessId').value;
    const role = document.getElementById('emuRole').value;

    const sections = [];
    document.querySelectorAll('#emuSectionCheckboxes input:checked').forEach(cb => sections.push(cb.value));
    const entity_permissions = collectPermissions('emuPermMatrix');

    const permissions = { sections, entity_permissions };

    try {
        const res = await fetch(API + '/users/' + accessId, {
            method: 'PUT', headers: HEADERS,
            body: JSON.stringify({ role, permissions })
        });
        const data = await res.json();
        if (data.success) { partCloseModal('editModuleUserModal'); showToast('User access updated'); loadModuleUsers(); }
        else showToast(data.message || 'Failed', 'error');
    } catch (e) { showToast('Network error', 'error'); }
}

function editModuleUser(accessId, currentRole, isActive) {
    // Legacy fallback - redirect to new modal
    showToast('Use the edit button to manage sections', 'error');
}

function revokeModuleUser(accessId, email) {
    pendingDelete = { type: 'revoke_access', id: accessId, email };
    document.getElementById('deleteConfirmMsg').textContent = `Revoke access for "${email}" from Part Management? They will no longer be able to use this module.`;
    document.getElementById('deleteConfirmPassword').value = '';
    document.getElementById('deleteError').style.display = 'none';
    partOpenModal('deleteConfirmModal');
}

// ─── EXPORT / IMPORT / TEMPLATE ───
let importTarget = '';

function exportData(section) {
    let csvContent = '';
    let filename = '';

    if (section === 'categories') {
        if (!categories.length) { showToast('No data to export', 'error'); return; }
        csvContent = 'Name,Code,Series Prefix,Description\n' + categories.map(c => `"${c.name}","${c.code || ''}","${c.series_prefix}","${c.description || ''}"`).join('\n');
        filename = 'categories_export.csv';
    } else if (section === 'subcategories') {
        if (!subcategories.length) { showToast('No data to export', 'error'); return; }
        csvContent = 'Name,Code,Category,Series Prefix,Parts Generated,Columns\n' + subcategories.map(s => {
            const cols = parseCols(s.columns_config).map(c => c.name).join('; ');
            return `"${s.name}","${s.code || ''}","${s.category_name || ''}","${s.series_prefix}","${s.current_sequence || 0}","${cols}"`;
        }).join('\n');
        filename = 'subcategories_export.csv';
    } else if (section === 'parts' || section === 'allparts') {
        const tbody = document.getElementById('allPartsBody');
        const thead = document.getElementById('allPartsHead');
        if (!thead || !tbody || tbody.querySelector('.empty')) { showToast('No parts data to export. Select a subcategory first.', 'error'); return; }
        const headers = Array.from(thead.querySelectorAll('th')).map(th => th.textContent);
        const rows = Array.from(tbody.querySelectorAll('tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => `"${td.textContent.trim()}"`).join(','));
        csvContent = headers.join(',') + '\n' + rows.join('\n');
        filename = 'parts_export.csv';
    } else if (section === 'auditlogs') {
        const tbody = document.getElementById('auditLogsBody');
        if (!tbody || tbody.querySelector('.empty')) { showToast('No audit logs to export', 'error'); return; }
        csvContent = 'Action,Entity Type,Entity ID,Performed By,Email,IP Address,Timestamp\n';
        Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length >= 5) {
                const action = tds[0].textContent.trim();
                const entityMain = tds[1].querySelector('.cell-main')?.textContent.trim() || '';
                const entitySub = tds[1].querySelector('.cell-sub')?.textContent.trim() || '';
                const userName = tds[2].querySelector('.cell-main')?.textContent.trim() || '';
                const userEmail = tds[2].querySelector('.cell-sub')?.textContent.trim() || '';
                const ip = tds[3].textContent.trim();
                const time = tds[4].textContent.trim();
                csvContent += `"${action}","${entityMain}","${entitySub}","${userName}","${userEmail}","${ip}","${time}"\n`;
            }
        });
        filename = 'audit_logs_export.csv';
    } else if (section === 'obsolete') {
        const tbody = document.getElementById('obsoletePartsBody');
        if (!tbody || tbody.querySelector('.empty')) { showToast('No obsolete parts to export', 'error'); return; }
        csvContent = 'Part Number,Category,Subcategory,Obsoleted At,Reason\n';
        Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length >= 5) csvContent += Array.from(tds).map(td => `"${td.textContent.trim()}"`).join(',') + '\n';
        });
        filename = 'obsolete_parts_export.csv';
    }

    if (csvContent) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast(`Exported ${filename}`);
        // Log export to audit
        fetch(API + '/log-action', { method: 'POST', headers: HEADERS, body: JSON.stringify({ action: 'EXPORT', entity_type: section, entity_id: filename }) }).catch(() => {});
    }
}

function downloadTemplate(section) {
    let csvContent = '';
    let filename = '';

    if (section === 'categories') {
        csvContent = 'Name,Series Prefix,Code,Description\nSheetmetal,601,SM,Sheet metal parts\n';
        filename = 'categories_template.csv';
    } else if (section === 'subcategories') {
        csvContent = 'Name,Series Prefix,Category ID,Code,Columns (JSON)\nProto,0,<category_uuid>,PR,"[{""name"":""material"",""type"":""varchar"",""label"":""Material""}]"\n';
        filename = 'subcategories_template.csv';
    } else if (section === 'parts' || section === 'allparts') {
        const opt = document.getElementById('apSubcategory')?.options[document.getElementById('apSubcategory')?.selectedIndex] || document.getElementById('genSubcategory')?.options[document.getElementById('genSubcategory')?.selectedIndex];
        const cols = opt && opt.dataset.cols ? JSON.parse(opt.dataset.cols) : [];
        if (cols.length === 0) {
            csvContent = 'subcategory_id,column1,column2\n<subcategory_uuid>,value1,value2\n';
        } else {
            const colNames = cols.map(c => c.name);
            csvContent = 'subcategory_id,' + colNames.join(',') + '\n<subcategory_uuid>,' + colNames.map(() => 'value').join(',') + '\n';
        }
        filename = 'parts_import_template.csv';
    }

    if (csvContent) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast(`Downloaded ${filename}`);
        fetch(API + '/log-action', { method: 'POST', headers: HEADERS, body: JSON.stringify({ action: 'TEMPLATE_DOWNLOAD', entity_type: section, entity_id: filename }) }).catch(() => {});
    }
}

function importData(section) {
    importTarget = section;
    document.getElementById('importFileInput').value = '';
    document.getElementById('importFileInput').click();
}

async function handleImportFile(input) {
    const file = input.files[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) { showToast('CSV file is empty or has no data rows', 'error'); return; }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map(line => {
        const vals = line.match(/("[^"]*"|[^,]+)/g) || [];
        return vals.map(v => v.trim().replace(/^"|"$/g, ''));
    });

    let imported = 0;
    let errors = [];

    if (importTarget === 'categories') {
        for (const row of rows) {
            const name = row[0], series = row[1], code = row[2] || '', desc = row[3] || '';
            if (!name || !series) { errors.push(`Skipped row: missing name or series`); continue; }
            try {
                const res = await fetch(API + '/categories', { method: 'POST', headers: HEADERS, body: JSON.stringify({ name, series_prefix: series, code, description: desc }) });
                const data = await res.json();
                if (data.success) imported++; else errors.push(`${name}: ${data.message}`);
            } catch (e) { errors.push(`${name}: network error`); }
        }
        loadCategories();
    } else if (importTarget === 'subcategories') {
        for (const row of rows) {
            const name = row[0], series = row[1], catId = row[2], code = row[3] || '';
            let columns = [];
            try { columns = JSON.parse(row[4] || '[]'); } catch(e) {}
            if (!name || !series || !catId) { errors.push(`Skipped row: missing required fields`); continue; }
            if (!columns.length) columns = [{ name: 'description', type: 'varchar', label: 'Description' }];
            try {
                const res = await fetch(API + '/subcategories', { method: 'POST', headers: HEADERS, body: JSON.stringify({ name, series_prefix: series, category_id: catId, code, columns }) });
                const data = await res.json();
                if (data.success) imported++; else errors.push(`${name}: ${data.message}`);
            } catch (e) { errors.push(`${name}: network error`); }
        }
        loadSubcategories();
    } else if (importTarget === 'parts' || importTarget === 'allparts') {
        const subIdIdx = headers.findIndex(h => h.toLowerCase().includes('subcategory_id'));
        const colHeaders = headers.filter((h, i) => i !== subIdIdx);
        for (const row of rows) {
            const subId = subIdIdx >= 0 ? row[subIdIdx] : '';
            if (!subId) { errors.push('Skipped row: missing subcategory_id'); continue; }
            const values = {};
            colHeaders.forEach((h, i) => {
                const idx = i >= subIdIdx ? i + 1 : i;
                if (row[idx]) values[h] = row[idx];
            });
            try {
                const res = await fetch(API + '/generate', { method: 'POST', headers: HEADERS, body: JSON.stringify({ subcategory_id: subId, values }) });
                const data = await res.json();
                if (data.success) imported++; else errors.push(`Row: ${data.message}`);
            } catch (e) { errors.push('Row: network error'); }
        }
        if (importTarget === 'allparts') loadAllParts();
    }

    // Log import action
    fetch(API + '/log-action', { method: 'POST', headers: HEADERS, body: JSON.stringify({ action: 'IMPORT', entity_type: importTarget, entity_id: `${imported} records from ${file.name}` }) }).catch(() => {});

    if (errors.length) showToast(`Imported ${imported} rows. ${errors.length} errors.`, 'error');
    else showToast(`Successfully imported ${imported} rows`);
}

// ─── INIT ───
(async function() {
    // Load user's allowed sections
    try {
        const res = await fetch(API + '/my-access', { headers: HEADERS });
        const data = await res.json();
        if (data.success && data.data.sections) {
            myAllowedSections = data.data.sections;
            applySidebarAccess();
        }
    } catch (e) {}

    // Read section from URL path
    const path = window.location.pathname.split('/');
    const section = path[2] || 'overview';
    showSection(section);
})();

// Handle browser back/forward
window.addEventListener('popstate', () => {
    const path = window.location.pathname.split('/');
    const section = path[2] || 'overview';
    showSection(section);
});

function applySidebarAccess() {
    document.querySelectorAll('.sidebar-link[data-section]').forEach(link => {
        const section = link.dataset.section;
        if (!myAllowedSections.includes(section)) {
            link.style.display = 'none';
        } else {
            link.style.display = '';
        }
    });
}
