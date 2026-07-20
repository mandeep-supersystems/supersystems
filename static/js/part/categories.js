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
    tbody.innerHTML = categories.map(c => `<tr>
        <td><strong>${esc(c.name)}</strong></td>
        <td><code>${esc(c.code || '-')}</code></td>
        <td><span class="series-badge">${esc(c.series_prefix)}</span></td>
        <td><code>${esc(c.separator || '-')}</code></td>
        <td>${esc(c.description || '-')}</td>
        <td class="actions-cell">
            <button class="btn-action" onclick="editCategory('${c.id}','${esc(c.name)}','${esc(c.description || '')}')" data-perm-entity="categories" data-perm-action="edit"><span class="material-icons-outlined">edit</span></button>
            <button class="btn-action btn-danger" onclick="deleteCategory('${c.id}','${esc(c.name)}')" data-perm-entity="categories" data-perm-action="delete"><span class="material-icons-outlined">delete</span></button>
        </td>
    </tr>`).join('');
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

function editCategory(id, name, desc) {
    const newName = prompt('Category Name:', name);
    if (!newName) return;
    const newDesc = prompt('Description:', desc);
    fetch(API + '/categories/' + id, { method: 'PUT', headers: HEADERS, body: JSON.stringify({ name: newName, description: newDesc || '' }) })
        .then(r => r.json()).then(d => { if (d.success) { showToast('Category updated'); loadCategories(); } else showToast(d.message || 'Failed', 'error'); });
}

async function deleteCategory(id, name) {
    pendingDelete = { type: 'category', id, name };
    document.getElementById('deleteConfirmMsg').textContent = `Delete category "${name}"? This will also delete all subcategories and drop their database tables.`;
    document.getElementById('deleteConfirmPassword').value = '';
    document.getElementById('deleteError').style.display = 'none';
    partOpenModal('deleteConfirmModal');
}
