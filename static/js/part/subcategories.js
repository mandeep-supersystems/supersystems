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
        const seriesLabel = s.cat_series ? `${s.cat_series}.${s.series_prefix}` : s.series_prefix;
        return `<tr>
            <td><div class="cell-main">${esc(s.name)}</div><div class="cell-sub">${esc(s.code || '')}</div></td>
            <td><span class="cat-badge">${esc(s.category_name || '-')}</span></td>
            <td><span class="series-badge">${esc(seriesLabel)}</span></td>
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
    
    sel.onchange = function() {
        const cat = categories.find(c => c.id === this.value);
        if (cat) {
            renderSubcatCategoryColumns(cat.columns || []);
        } else {
            document.getElementById('columnsContainer').innerHTML = '<span class="text-muted" style="font-size:12px">Select a category first</span>';
            document.getElementById('descColsContainer').innerHTML = '<span class="text-muted" style="font-size:12px">Select a category first</span>';
        }
    };
    
    document.getElementById('columnsContainer').innerHTML = '<span class="text-muted" style="font-size:12px">Select a category first</span>';
    document.getElementById('descColsContainer').innerHTML = '<span class="text-muted" style="font-size:12px">Select a category first</span>';
    
    partOpenModal('subcategoryModal');
}

function renderSubcatCategoryColumns(cols) {
    if (!cols || cols.length === 0) {
        document.getElementById('columnsContainer').innerHTML = '<span class="text-muted" style="font-size:12px">Category has no columns</span>';
        document.getElementById('descColsContainer').innerHTML = '<span class="text-muted" style="font-size:12px">Category has no columns</span>';
        return;
    }
    const html = cols.map(c => `<label style="display:block;margin-bottom:8px;font-size:13px;"><input type="checkbox" class="subcat-col-cb" value="${esc(c.name)}" data-type="${esc(c.type)}" checked> ${esc(c.name)} (${esc(c.type)})</label>`).join('');
    document.getElementById('columnsContainer').innerHTML = html;
    
    const htmlDesc = cols.map(c => `<label style="display:inline-block;margin-right:12px;margin-bottom:8px;font-size:13px;"><input type="checkbox" class="subcat-desc-cb" value="${esc(c.name)}"> ${esc(c.name)}</label>`).join('');
    document.getElementById('descColsContainer').innerHTML = htmlDesc;
}


async function saveSubcategory(e) {
    e.preventDefault();
    const catId = document.getElementById('subCatCategory').value;
    const name = document.getElementById('subCatName').value.trim();
    const series = document.getElementById('subCatSeries').value.trim();
    if (!catId) { showToast('Select a category', 'error'); return; }
    if (!name || !series) { showToast('Name and Series required', 'error'); return; }
    
    const columns_config = [];
    document.querySelectorAll('#columnsContainer .subcat-col-cb:checked').forEach(cb => {
        columns_config.push({ name: cb.value, type: cb.dataset.type, label: cb.value });
    });
    
    const description_columns = [];
    document.querySelectorAll('#descColsContainer .subcat-desc-cb:checked').forEach(cb => description_columns.push(cb.value));
    
    const sequence_padding = 6;
    const body = { name, series_prefix: series, code: document.getElementById('subCatCode').value.trim() || undefined, category_id: catId, columns_config, description_columns, sequence_padding };
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

    // Always use category columns as authoritative source
    const cat = categories.find(c => c.id === s.category_id);
    const catCols = (cat && cat.columns && cat.columns.length > 0) ? cat.columns : [];
    const descCols = cat && cat.description_columns ? (Array.isArray(cat.description_columns) ? cat.description_columns : []) : [];

    const renderEditCols = (cols, selectedDescCols) => {
        if (cols.length > 0) {
            document.getElementById('editColumnsContainer').innerHTML =
                `<div style="padding:8px 12px;background:var(--accent-light);border-radius:6px;font-size:12px;color:var(--accent);margin-bottom:8px">
                    <span class="material-icons-outlined" style="font-size:14px;vertical-align:middle">info</span>
                    Columns are inherited from the category and apply to all subcategories.
                </div>` +
                cols.map(c => `<label style="display:block;margin-bottom:8px;font-size:13px;"><input type="checkbox" class="edit-subcat-col-cb" value="${esc(c.name)}" data-type="${esc(c.type||'varchar')}" checked disabled> ${esc(c.label||c.name)} <span style="color:var(--text-muted);font-size:11px">(${esc(c.type||'varchar')})</span></label>`).join('');
            document.getElementById('editDescColsContainer').innerHTML =
                cols.map(c => `<label style="display:inline-block;margin-right:12px;margin-bottom:8px;font-size:13px;"><input type="checkbox" class="edit-subcat-desc-cb" value="${esc(c.name)}" ${selectedDescCols.includes(c.name) ? 'checked' : ''}> ${esc(c.label||c.name)}</label>`).join('');
        } else {
            document.getElementById('editColumnsContainer').innerHTML = '<span class="text-muted" style="font-size:12px">No columns defined on category. Edit the category to add columns.</span>';
            document.getElementById('editDescColsContainer').innerHTML = '<span class="text-muted" style="font-size:12px">No columns defined</span>';
        }
    };

    renderEditCols(catCols, descCols);

    sel.onchange = function() {
        const newCat = categories.find(c => c.id === this.value);
        const newCols = (newCat && newCat.columns && newCat.columns.length > 0) ? newCat.columns : [];
        const newDescCols = newCat && newCat.description_columns ? (Array.isArray(newCat.description_columns) ? newCat.description_columns : []) : [];
        renderEditCols(newCols, newDescCols);
    };

    document.getElementById('editSubSequencePadding').value = s.sequence_padding || 6;
    partOpenModal('editSubcategoryModal');
}


async function saveEditSubcategory(e) {
    e.preventDefault();
    const id = document.getElementById('editSubId').value;
    const name = document.getElementById('editSubName').value.trim();
    if (!name) { showToast('Name is required', 'error'); return; }

    // columns_config is inherited from category — send category's columns
    const catId = document.getElementById('editSubCategory').value;
    const cat = categories.find(c => c.id === catId);
    const columns_config = (cat && cat.columns) ? cat.columns : [];

    const description_columns = [];
    document.querySelectorAll('#editDescColsContainer .edit-subcat-desc-cb:checked').forEach(cb => description_columns.push(cb.value));

    const sequence_padding = parseInt(document.getElementById('editSubSequencePadding').value || '6');
    const body = { name, code: document.getElementById('editSubCode').value.trim(), series_prefix: document.getElementById('editSubSeries').value.trim(), category_id: catId, columns_config, description_columns, sequence_padding };
    try {
        const res = await fetch(API + '/subcategories/' + id, { method: 'PUT', headers: HEADERS, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.success) { partCloseModal('editSubcategoryModal'); showToast('Subcategory updated'); loadSubcategories(); }
        else showToast(data.message || 'Update failed', 'error');
    } catch (e) { showToast('Network error', 'error'); }
}
function filterSubcategoriesTable(query) {
    const q = query.toLowerCase().trim();
    const rows = document.querySelectorAll('#subcategoriesTableBody tr');
    rows.forEach(row => {
        if (row.querySelector('.empty')) return;
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
    });
}
