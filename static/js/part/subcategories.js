// ─── PART MODULE: SUBCATEGORIES ───
async function loadSubcategories() {
    try {
        if (categories.length === 0) { const cr = await fetch(API + '/categories', { headers: HEADERS }); categories = (await cr.json()).data || []; }
        const res = await fetch(API + '/subcategories', { headers: HEADERS });
        subcategories = (await res.json()).data || [];
        renderSubcategories();
    } catch (e) { console.error('Load subcategories error:', e); }
}

function renderSubcategories() {
    const tbody = document.getElementById('subcategoriesTableBody');
    if (subcategories.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No subcategories yet.</td></tr>'; return; }
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
                <button class="btn-action" onclick="editSubcategory('${sData}')" data-perm-entity="subcategories" data-perm-action="edit"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-action btn-danger" onclick="deleteSubcategory('${s.id}','${esc(s.name)}')" data-perm-entity="subcategories" data-perm-action="delete"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>`;
    }).join('');
    applyDynamicPerms();
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
    document.querySelectorAll('#columnsContainer .column-row .col-name').forEach(input => { const name = input.value.trim().toLowerCase(); if (name) cols.push(name); });
    if (cols.length === 0) { container.innerHTML = '<span class="text-muted">Add columns first</span>'; return; }
    container.innerHTML = cols.map(c => `<label class="desc-col-label"><input type="checkbox" value="${esc(c)}" checked> ${esc(c)}</label>`).join('');
}

function getColumnRowHTML() {
    return `<div class="column-row">
        <input type="text" placeholder="Column name (e.g. material)" class="col-name" required onblur="updateDescColsCheckboxes()">
        <select class="col-type"><option value="varchar">Text</option><option value="integer">Number</option><option value="numeric">Decimal</option><option value="boolean">Yes/No</option><option value="date">Date</option></select>
        <button type="button" class="btn-icon-danger" onclick="removeColumnRow(this)"><span class="material-icons-outlined">close</span></button>
    </div>`;
}

function addColumnRow() { document.getElementById('columnsContainer').insertAdjacentHTML('beforeend', getColumnRowHTML()); updateDescColsCheckboxes(); }
function removeColumnRow(btn) { if (document.querySelectorAll('#columnsContainer .column-row').length <= 1) { showToast('At least one column required', 'error'); return; } btn.closest('.column-row').remove(); updateDescColsCheckboxes(); }

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
    const description_columns = [];
    document.querySelectorAll('#descColsContainer input[type="checkbox"]:checked').forEach(cb => description_columns.push(cb.value));
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
    document.getElementById('deleteConfirmMsg').textContent = `Delete subcategory "${name}"? This action cannot be undone.`;
    document.getElementById('deleteConfirmPassword').value = '';
    document.getElementById('deleteError').style.display = 'none';
    partOpenModal('deleteConfirmModal');
}

function editSubcategory(encodedData) {
    const s = JSON.parse(decodeURIComponent(encodedData));
    document.getElementById('editSubId').value = s.id;
    document.getElementById('editSubName').value = s.name || '';
    document.getElementById('editSubCode').value = s.code || '';
    document.getElementById('editSubSeries').value = s.series_prefix || '';
    const sel = document.getElementById('editSubCategory');
    sel.innerHTML = categories.map(c => `<option value="${c.id}" ${c.id === s.category_id ? 'selected' : ''}>${esc(c.name)} (${esc(c.series_prefix)})</option>`).join('');
    const cols = parseCols(s.columns_config);
    const container = document.getElementById('editColumnsContainer');
    container.innerHTML = cols.length > 0 ? cols.map(c => `<div class="column-row">
        <input type="text" value="${esc(c.name)}" class="col-name" required onblur="updateEditDescColsCheckboxes()">
        <select class="col-type"><option value="varchar" ${c.type==='varchar'?'selected':''}>Text</option><option value="integer" ${c.type==='integer'?'selected':''}>Number</option><option value="numeric" ${c.type==='numeric'?'selected':''}>Decimal</option><option value="boolean" ${c.type==='boolean'?'selected':''}>Yes/No</option><option value="date" ${c.type==='date'?'selected':''}>Date</option></select>
        <button type="button" class="btn-icon-danger" onclick="removeEditColumnRow(this)"><span class="material-icons-outlined">close</span></button>
    </div>`).join('') : '<div class="empty" style="font-size:12px">No columns defined</div>';
    const descCols = s.description_columns ? (Array.isArray(s.description_columns) ? s.description_columns : JSON.parse(s.description_columns || '[]')) : [];
    updateEditDescColsCheckboxes(descCols);
    partOpenModal('editSubcategoryModal');
}

function updateEditDescColsCheckboxes(checkedCols) {
    const container = document.getElementById('editDescColsContainer');
    if (!container) return;
    const cols = [];
    document.querySelectorAll('#editColumnsContainer .column-row .col-name').forEach(input => { const name = input.value.trim().toLowerCase(); if (name) cols.push(name); });
    if (cols.length === 0) { container.innerHTML = '<span class="text-muted">No columns defined</span>'; return; }
    if (!checkedCols) { checkedCols = []; container.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => checkedCols.push(cb.value)); }
    container.innerHTML = cols.map(c => `<label class="desc-col-label"><input type="checkbox" value="${esc(c)}" ${checkedCols.includes(c)?'checked':''}> ${esc(c)}</label>`).join('');
}

function addEditColumnRow() {
    document.getElementById('editColumnsContainer').insertAdjacentHTML('beforeend', `<div class="column-row"><input type="text" placeholder="Column name" class="col-name" required onblur="updateEditDescColsCheckboxes()"><select class="col-type"><option value="varchar">Text</option><option value="integer">Number</option><option value="numeric">Decimal</option><option value="boolean">Yes/No</option><option value="date">Date</option></select><button type="button" class="btn-icon-danger" onclick="removeEditColumnRow(this)"><span class="material-icons-outlined">close</span></button></div>`);
    updateEditDescColsCheckboxes();
}
function removeEditColumnRow(btn) { btn.closest('.column-row').remove(); updateEditDescColsCheckboxes(); }

async function saveEditSubcategory(e) {
    e.preventDefault();
    const id = document.getElementById('editSubId').value;
    const name = document.getElementById('editSubName').value.trim();
    if (!name) { showToast('Name is required', 'error'); return; }
    const columns = [];
    for (const row of document.querySelectorAll('#editColumnsContainer .column-row')) {
        const colName = row.querySelector('.col-name').value.trim();
        const colType = row.querySelector('.col-type').value;
        if (colName) columns.push({ name: colName.toLowerCase(), type: colType, label: colName });
    }
    const description_columns = [];
    document.querySelectorAll('#editDescColsContainer input[type="checkbox"]:checked').forEach(cb => description_columns.push(cb.value));
    const body = { name, code: document.getElementById('editSubCode').value.trim(), series_prefix: document.getElementById('editSubSeries').value.trim(), category_id: document.getElementById('editSubCategory').value, columns, description_columns };
    try {
        const res = await fetch(API + '/subcategories/' + id, { method: 'PUT', headers: HEADERS, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.success) { partCloseModal('editSubcategoryModal'); showToast('Subcategory updated'); loadSubcategories(); }
        else showToast(data.message || 'Update failed', 'error');
    } catch (e) { showToast('Network error', 'error'); }
}
