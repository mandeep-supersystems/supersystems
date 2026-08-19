// ─── PART MODULE: CATEGORIES ───
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
    if (categories.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No categories yet. Create one to get started.</td></tr>'; return; }
    tbody.innerHTML = categories.map(c => {
        const cols = (c.columns || []);
        const descCols = Array.isArray(c.description_columns) ? c.description_columns : [];
        const colTags = cols.map(col => `<span class="col-tag">${esc(col.label || col.name)}</span>`).join('');
        return `<tr>
        <td><strong>${esc(c.name)}</strong></td>
        <td><code>${esc(c.code || '-')}</code></td>
        <td><span class="series-badge">${esc(c.series_prefix)}</span></td>
        <td><code>${esc(c.separator || '-')}</code></td>
        <td><div class="col-tags">${colTags || '<span class="text-muted">None</span>'}</div></td>
        <td class="actions-cell">
            <button class="btn-action" onclick="editCategory('${c.id}')" data-perm-entity="categories" data-perm-action="edit"><span class="material-icons-outlined">edit</span></button>
            <button class="btn-action btn-danger" onclick="deleteCategory('${c.id}','${esc(c.name)}')" data-perm-entity="categories" data-perm-action="delete"><span class="material-icons-outlined">delete</span></button>
        </td>
    </tr>`;
    }).join('');
    applyDynamicPerms();
}

function openCategoryModal() {
    document.getElementById('catName').value = '';
    document.getElementById('catSeries').value = '';
    document.getElementById('catCode').value = '';
    document.getElementById('catDesc').value = '';
    setPartCatSep('-');
    partOpenModal('categoryModal');
}

function setPartCatSep(sep) {
    document.querySelectorAll('#categoryModal .part-cat-sep-btn').forEach(el => {
        const isActive = el.dataset.sep === sep;
        el.dataset.active = isActive ? '1' : '0';
        el.style.borderColor = isActive ? 'var(--accent)' : 'var(--border-color)';
        el.style.background = isActive ? 'var(--accent-light)' : 'var(--bg-primary)';
        el.style.color = isActive ? 'var(--accent)' : 'var(--text-secondary)';
    });
}

function getPartCatSep() {
    let sep = '-';
    document.querySelectorAll('#categoryModal .part-cat-sep-btn').forEach(el => {
        if (el.dataset.active === '1') sep = el.dataset.sep;
    });
    return sep;
}

async function saveCategory(e) {
    e.preventDefault();
    const name = document.getElementById('catName').value.trim();
    const series_prefix = document.getElementById('catSeries').value.trim();
    if (!name || !series_prefix) { showToast('Name and Series Prefix are required', 'error'); return; }
    const body = { name, series_prefix, separator: getPartCatSep(), code: document.getElementById('catCode').value.trim() || undefined, description: document.getElementById('catDesc').value.trim() };
    try {
        const res = await fetch(API + '/categories', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.success) { partCloseModal('categoryModal'); showToast('Category "' + name + '" created'); loadCategories(); }
        else showToast(data.message || 'Failed', 'error');
    } catch (e) { showToast('Network error', 'error'); }
}

function editCategory(id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    document.getElementById('editCatId').value = id;
    document.getElementById('editCatName').value = cat.name || '';
    document.getElementById('editCatDesc').value = cat.description || '';
    // Set separator buttons
    document.querySelectorAll('#editCategoryModal .part-cat-sep-btn').forEach(el => {
        const isActive = el.dataset.sep === (cat.separator || '-');
        el.dataset.active = isActive ? '1' : '0';
        el.style.borderColor = isActive ? 'var(--accent)' : 'var(--border-color)';
        el.style.background = isActive ? 'var(--accent-light)' : 'var(--bg-primary)';
        el.style.color = isActive ? 'var(--accent)' : 'var(--text-secondary)';
    });
    renderEditCatColumns(cat.columns || [], cat.description_columns || []);
    partOpenModal('editCategoryModal');
}

function renderEditCatColumns(cols, descCols) {
    const container = document.getElementById('editCatColsList');
    const descContainer = document.getElementById('editCatDescCols');
    if (!cols.length) {
        container.innerHTML = '<span class="text-muted" style="font-size:12px">No columns yet. Add one below.</span>';
        descContainer.innerHTML = '<span class="text-muted" style="font-size:12px">No columns defined</span>';
        return;
    }
    container.innerHTML = cols.map((c, i) => `
        <div class="edit-cat-col-row" data-idx="${i}" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:6px 8px;background:var(--bg-secondary);border-radius:6px">
            <span style="flex:1;font-size:13px;font-weight:500">${esc(c.label || c.name)}</span>
            <span style="font-size:11px;color:var(--text-muted);background:var(--bg-primary);padding:2px 6px;border-radius:4px">${esc(c.type || 'varchar')}</span>
            <button type="button" class="btn-icon" onclick="removeEditCatCol(${i})" title="Remove column" style="color:#e53935"><span class="material-icons-outlined" style="font-size:16px">delete</span></button>
        </div>`).join('');
    descContainer.innerHTML = cols.map(c => `
        <label style="display:inline-flex;align-items:center;gap:5px;margin-right:12px;margin-bottom:6px;font-size:13px;cursor:pointer">
            <input type="checkbox" class="edit-cat-desc-cb" value="${esc(c.name)}" ${descCols.includes(c.name) ? 'checked' : ''}> ${esc(c.label || c.name)}
        </label>`).join('');
}

function removeEditCatCol(idx) {
    const id = document.getElementById('editCatId').value;
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const cols = [...(cat.columns || [])];
    cols.splice(idx, 1);
    cat.columns = cols;
    const descCols = getEditCatDescCols();
    renderEditCatColumns(cols, descCols);
}

function getEditCatDescCols() {
    const checked = [];
    document.querySelectorAll('#editCatDescCols .edit-cat-desc-cb:checked').forEach(cb => checked.push(cb.value));
    return checked;
}

function addEditCatColumn() {
    const nameEl = document.getElementById('editCatNewColName');
    const typeEl = document.getElementById('editCatNewColType');
    const name = nameEl.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!name) { showToast('Enter a column name', 'error'); return; }
    const id = document.getElementById('editCatId').value;
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const cols = [...(cat.columns || [])];
    if (cols.find(c => c.name === name)) { showToast('Column already exists', 'error'); return; }
    const label = nameEl.value.trim().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    cols.push({ name, label, type: typeEl.value });
    cat.columns = cols;
    nameEl.value = '';
    renderEditCatColumns(cols, getEditCatDescCols());
}

function setEditCatSep(sep) {
    document.querySelectorAll('#editCategoryModal .part-cat-sep-btn').forEach(el => {
        const isActive = el.dataset.sep === sep;
        el.dataset.active = isActive ? '1' : '0';
        el.style.borderColor = isActive ? 'var(--accent)' : 'var(--border-color)';
        el.style.background = isActive ? 'var(--accent-light)' : 'var(--bg-primary)';
        el.style.color = isActive ? 'var(--accent)' : 'var(--text-secondary)';
    });
}

function getEditCatSep() {
    let sep = '-';
    document.querySelectorAll('#editCategoryModal .part-cat-sep-btn').forEach(el => {
        if (el.dataset.active === '1') sep = el.dataset.sep;
    });
    return sep;
}

async function saveEditCategory(e) {
    e.preventDefault();
    const id = document.getElementById('editCatId').value;
    const cat = categories.find(c => c.id === id);
    const name = document.getElementById('editCatName').value.trim();
    if (!name) { showToast('Name required', 'error'); return; }
    const columns = cat ? (cat.columns || []) : [];
    const description_columns = getEditCatDescCols();
    const body = {
        name,
        description: document.getElementById('editCatDesc').value.trim(),
        separator: getEditCatSep(),
        columns,
        description_columns
    };
    try {
        const res = await fetch(API + '/categories/' + id, { method: 'PUT', headers: HEADERS, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.success) {
            partCloseModal('editCategoryModal');
            showToast('Category updated & synced to all subcategories');
            await loadCategories();
            await loadSubcategories();
        } else showToast(data.message || 'Failed', 'error');
    } catch (e) { showToast('Network error', 'error'); }
}

async function deleteCategory(id, name) {
    pendingDelete = { type: 'category', id, name };
    document.getElementById('deleteConfirmMsg').textContent = `Delete category "${name}"? This action cannot be undone.`;
    document.getElementById('deleteConfirmPassword').value = '';
    document.getElementById('deleteError').style.display = 'none';
    partOpenModal('deleteConfirmModal');
}

function filterCategoriesTable(query) {
    const q = query.toLowerCase().trim();
    const rows = document.querySelectorAll('#categoriesTableBody tr');
    rows.forEach(row => {
        if (row.querySelector('.empty')) return;
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
    });
}
