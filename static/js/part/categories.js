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

let editingCatColIdx = -1;

function editCategory(id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    editingCatColIdx = -1;
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
    container.innerHTML = cols.map((c, i) => {
        if (i === editingCatColIdx) {
            return `
            <div class="edit-cat-col-row editing" data-idx="${i}" style="display:flex;align-items:center;gap:6px;margin-bottom:6px;padding:6px 8px;background:var(--bg-secondary);border:1px solid var(--accent);border-radius:6px">
                <input type="text" id="inlineEditColLabel_${i}" value="${esc(c.label || c.name)}" placeholder="Label" style="flex:2;padding:4px 8px;font-size:12px;border:1px solid var(--border-color);border-radius:4px">
                <select id="inlineEditColType_${i}" style="flex:1;padding:4px 6px;font-size:12px;border:1px solid var(--border-color);border-radius:4px">
                    <option value="varchar" ${c.type === 'varchar' ? 'selected' : ''}>Text</option>
                    <option value="numeric" ${c.type === 'numeric' ? 'selected' : ''}>Number</option>
                    <option value="boolean" ${c.type === 'boolean' ? 'selected' : ''}>Boolean</option>
                    <option value="date" ${c.type === 'date' ? 'selected' : ''}>Date</option>
                </select>
                <button type="button" class="btn-icon" onclick="saveInlineCatCol(${i})" title="Save column changes" style="color:#2e7d32;background:none;border:none;cursor:pointer;padding:2px 4px"><span class="material-icons-outlined" style="font-size:18px">check</span></button>
                <button type="button" class="btn-icon" onclick="cancelInlineCatCol()" title="Cancel edit" style="color:var(--text-muted);background:none;border:none;cursor:pointer;padding:2px 4px"><span class="material-icons-outlined" style="font-size:18px">close</span></button>
            </div>`;
        }
        return `
        <div class="edit-cat-col-row" data-idx="${i}" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:6px 8px;background:var(--bg-secondary);border-radius:6px">
            <span style="flex:1;font-size:13px;font-weight:500">${esc(c.label || c.name)} <span style="font-size:11px;color:var(--text-muted);font-weight:normal">(${esc(c.name)})</span></span>
            <span style="font-size:11px;color:var(--text-muted);background:var(--bg-primary);padding:2px 6px;border-radius:4px">${esc(c.type || 'varchar')}</span>
            <button type="button" class="btn-icon" onclick="editCatCol(${i})" title="Edit column label & type" style="color:var(--accent);background:none;border:none;cursor:pointer;padding:2px 4px"><span class="material-icons-outlined" style="font-size:16px">edit</span></button>
            <button type="button" class="btn-icon" onclick="removeEditCatCol(${i})" title="Remove column" style="color:#e53935;background:none;border:none;cursor:pointer;padding:2px 4px"><span class="material-icons-outlined" style="font-size:16px">delete</span></button>
        </div>`;
    }).join('');

    descContainer.innerHTML = cols.map(c => `
        <label style="display:inline-flex;align-items:center;gap:5px;margin-right:12px;margin-bottom:6px;font-size:13px;cursor:pointer">
            <input type="checkbox" class="edit-cat-desc-cb" value="${esc(c.name)}" ${descCols.includes(c.name) ? 'checked' : ''}> ${esc(c.label || c.name)}
        </label>`).join('');
}

function editCatCol(idx) {
    editingCatColIdx = idx;
    const id = document.getElementById('editCatId').value;
    const cat = categories.find(c => c.id === id);
    renderEditCatColumns(cat ? (cat.columns || []) : [], getEditCatDescCols());
}

function cancelInlineCatCol() {
    editingCatColIdx = -1;
    const id = document.getElementById('editCatId').value;
    const cat = categories.find(c => c.id === id);
    renderEditCatColumns(cat ? (cat.columns || []) : [], getEditCatDescCols());
}

function saveInlineCatCol(idx) {
    const labelEl = document.getElementById(`inlineEditColLabel_${idx}`);
    const typeEl = document.getElementById(`inlineEditColType_${idx}`);
    if (!labelEl || !typeEl) return;
    const newLabel = labelEl.value.trim();
    if (!newLabel) { showToast('Column label cannot be empty', 'error'); return; }
    const newType = typeEl.value;

    const id = document.getElementById('editCatId').value;
    const cat = categories.find(c => c.id === id);
    if (!cat || !cat.columns || !cat.columns[idx]) return;

    cat.columns[idx].label = newLabel;
    cat.columns[idx].type = newType;
    editingCatColIdx = -1;
    renderEditCatColumns(cat.columns, getEditCatDescCols());
    showToast('Column updated. Click "Save & Sync All Subcategories" to apply.');
}

function removeEditCatCol(idx) {
    const id = document.getElementById('editCatId').value;
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const cols = [...(cat.columns || [])];
    const removedCol = cols[idx];
    if (!removedCol) return;

    if (!confirm(`Are you sure you want to remove column "${removedCol.label || removedCol.name}" from this category?`)) {
        return;
    }

    cols.splice(idx, 1);
    cat.columns = cols;
    editingCatColIdx = -1;
    const descCols = getEditCatDescCols().filter(c => c !== removedCol.name);
    renderEditCatColumns(cols, descCols);
    showToast(`Column "${removedCol.label || removedCol.name}" removed. Click "Save & Sync All Subcategories" to apply.`);
}

function getEditCatDescCols() {
    const checked = [];
    document.querySelectorAll('#editCatDescCols .edit-cat-desc-cb:checked').forEach(cb => checked.push(cb.value));
    return checked;
}

function addEditCatColumn() {
    const nameEl = document.getElementById('editCatNewColName');
    const typeEl = document.getElementById('editCatNewColType');
    const rawVal = nameEl.value.trim();
    if (!rawVal) { showToast('Enter a column name', 'error'); return; }
    const name = rawVal.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const id = document.getElementById('editCatId').value;
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const cols = [...(cat.columns || [])];
    if (cols.find(c => c.name === name)) { showToast('Column already exists', 'error'); return; }
    const label = rawVal.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    cols.push({ name, label, type: typeEl.value });
    cat.columns = cols;
    nameEl.value = '';
    renderEditCatColumns(cols, getEditCatDescCols());
    showToast(`Column "${label}" added. Click "Save & Sync All Subcategories" to apply.`);
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
