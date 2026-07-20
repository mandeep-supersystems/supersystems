// ─── RM CODE CRITERIA ───
let allCriteria = [];

async function loadCriteria() {
    const res = await fetch(RM_API + '/criteria', { headers: RM_HEADERS });
    const data = await res.json();
    allCriteria = data.success ? data.data : [];
    renderCriteria();
}

function renderCriteria() {
    const tbody = document.getElementById('criteriaTableBody');
    if (!allCriteria.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No criteria defined yet</td></tr>'; return; }
    tbody.innerHTML = allCriteria.map(c => {
        const cols = parseCritCols(c.columns_config);
        const colTags = cols.length ? cols.map(col => `<span class="col-tag">${esc(col.label || col.name)}</span>`).join('') : '<span class="text-muted">None</span>';
        return `
        <tr>
            <td><span class="cell-main">${esc(c.material_category)}</span></td>
            <td>${esc(c.sub_category) || '-'}</td>
            <td><span class="series-badge">${esc(c.series_prefix)}</span></td>
            <td><code style="font-size:16px;font-weight:700">${esc(c.separator)}</code></td>
            <td>${c.number_format} digits</td>
            <td><span class="rm-code-preview" style="padding:4px 8px;font-size:12px">${esc(c.series_prefix)}${esc(c.separator)}${'0'.repeat(parseInt(c.number_format)||4).slice(0,-1)}1</span></td>
            <td><div class="col-tags">${colTags}</div></td>
            <td class="actions-cell">
                <button class="btn-action" onclick="editCriteria('${c.id}')"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-action btn-danger" onclick="deleteCriteria('${c.id}')"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>
    `}).join('');
}

function parseCritCols(config) {
    if (!config) return [];
    if (Array.isArray(config)) return config;
    if (typeof config === 'string') { try { return JSON.parse(config); } catch(e) { return []; } }
    return [];
}

function openAddCriteriaModal() {
    document.getElementById('critCategory').value = '';
    document.getElementById('critSubCategory').value = '';
    document.getElementById('critPrefix').value = '';
    document.getElementById('critNumFormat').value = '4';
    document.getElementById('critDesc').value = '';
    document.getElementById('critId').value = '';
    document.getElementById('critModalTitle').textContent = 'New RM Code Criteria';
    document.getElementById('critColumnsContainer').innerHTML = '';
    setCritSep('-');
    updateCritPreview();
    rmOpenModal('criteriaModal');
}

function setCritSep(sep) {
    document.querySelectorAll('#criteriaModal .crit-sep-btn').forEach(el => {
        const isActive = el.dataset.sep === sep;
        el.dataset.active = isActive ? '1' : '0';
        el.style.borderColor = isActive ? 'var(--accent)' : 'var(--border-color)';
        el.style.background = isActive ? 'var(--accent-light)' : 'var(--bg-primary)';
        el.style.color = isActive ? 'var(--accent)' : 'var(--text-secondary)';
    });
    updateCritPreview();
}

function getCritSep() {
    let sep = '-';
    document.querySelectorAll('#criteriaModal .crit-sep-btn').forEach(el => {
        if (el.dataset.active === '1') sep = el.dataset.sep;
    });
    return sep;
}

function updateCritPreview() {
    const prefix = document.getElementById('critPrefix').value.trim();
    const sep = getCritSep();
    const fmt = parseInt(document.getElementById('critNumFormat').value) || 4;
    const preview = prefix ? `${prefix}${sep}${'0'.repeat(fmt - 1)}1` : '---';
    document.getElementById('critPreview').textContent = preview;
}

// ─── COLUMNS ───
function addCritColumnRow() {
    const container = document.getElementById('critColumnsContainer');
    const row = document.createElement('div');
    row.className = 'column-row';
    row.innerHTML = `
        <input type="text" placeholder="Column name (e.g. grade)" class="crit-col-name" required>
        <select class="crit-col-type">
            <option value="varchar">Text</option>
            <option value="integer">Number</option>
            <option value="numeric">Decimal</option>
            <option value="boolean">Yes/No</option>
            <option value="date">Date</option>
        </select>
        <button type="button" class="btn-icon-danger" onclick="this.parentElement.remove()"><span class="material-icons-outlined">close</span></button>
    `;
    container.appendChild(row);
}

function getCritColumns() {
    const rows = document.querySelectorAll('#critColumnsContainer .column-row');
    const cols = [];
    rows.forEach(row => {
        const name = row.querySelector('.crit-col-name').value.trim();
        const type = row.querySelector('.crit-col-type').value;
        if (name) cols.push({ name, type, label: name });
    });
    return cols;
}

function setCritColumns(cols) {
    const container = document.getElementById('critColumnsContainer');
    container.innerHTML = '';
    if (!cols || !cols.length) return;
    cols.forEach(col => {
        const row = document.createElement('div');
        row.className = 'column-row';
        row.innerHTML = `
            <input type="text" placeholder="Column name" class="crit-col-name" value="${esc(col.name || col.label || '')}" required>
            <select class="crit-col-type">
                <option value="varchar" ${col.type === 'varchar' ? 'selected' : ''}>Text</option>
                <option value="integer" ${col.type === 'integer' ? 'selected' : ''}>Number</option>
                <option value="numeric" ${col.type === 'numeric' ? 'selected' : ''}>Decimal</option>
                <option value="boolean" ${col.type === 'boolean' ? 'selected' : ''}>Yes/No</option>
                <option value="date" ${col.type === 'date' ? 'selected' : ''}>Date</option>
            </select>
            <button type="button" class="btn-icon-danger" onclick="this.parentElement.remove()"><span class="material-icons-outlined">close</span></button>
        `;
        container.appendChild(row);
    });
}

async function saveCriteria(e) {
    e.preventDefault();
    const id = document.getElementById('critId').value;
    const payload = {
        material_category: document.getElementById('critCategory').value.trim(),
        sub_category: document.getElementById('critSubCategory').value.trim(),
        series_prefix: document.getElementById('critPrefix').value.trim(),
        separator: getCritSep(),
        number_format: document.getElementById('critNumFormat').value.trim(),
        description: document.getElementById('critDesc').value.trim(),
        columns_config: getCritColumns()
    };
    if (!payload.material_category || !payload.series_prefix) { rmToast('Category and Prefix required', 'error'); return; }
    const url = id ? `${RM_API}/criteria/${id}` : `${RM_API}/criteria`;
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: RM_HEADERS, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.success) { rmCloseModal('criteriaModal'); rmToast(data.message || 'Saved'); loadCriteria(); }
    else { rmToast(data.message || 'Error', 'error'); }
}

function editCriteria(id) {
    const c = allCriteria.find(x => x.id === id);
    if (!c) return;
    document.getElementById('critId').value = c.id;
    document.getElementById('critCategory').value = c.material_category;
    document.getElementById('critSubCategory').value = c.sub_category || '';
    document.getElementById('critPrefix').value = c.series_prefix;
    document.getElementById('critNumFormat').value = c.number_format || '4';
    document.getElementById('critDesc').value = c.description || '';
    setCritColumns(parseCritCols(c.columns_config));
    document.getElementById('critModalTitle').textContent = 'Edit RM Code Criteria';
    // Set separator after a tick so DOM is ready
    setTimeout(() => { setCritSep(c.separator || '-'); }, 50);
    rmOpenModal('criteriaModal');
}

async function deleteCriteria(id) {
    if (!confirm('Delete this criteria?')) return;
    const res = await fetch(`${RM_API}/criteria/${id}`, { method: 'DELETE', headers: RM_HEADERS });
    const data = await res.json();
    if (data.success) { rmToast('Deleted'); loadCriteria(); }
    else { rmToast(data.message || 'Error', 'error'); }
}
