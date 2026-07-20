// ─── PART MODULE: ALL PARTS ───
async function loadApCategories() {
    try { if (categories.length === 0) { const r = await fetch(API + '/categories', { headers: HEADERS }); categories = (await r.json()).data || []; } } catch (e) {}
    const sel = document.getElementById('apCategory');
    sel.innerHTML = '<option value="">All Categories</option>' + categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    document.getElementById('apSubcategory').innerHTML = '<option value="">All Subcategories</option>';
    // Load all parts on init
    loadAllParts();
}

async function loadApSubcategories() {
    const catId = document.getElementById('apCategory').value;
    const sel = document.getElementById('apSubcategory');
    if (!catId) { sel.innerHTML = '<option value="">All Subcategories</option>'; loadAllParts(); return; }
    const res = await fetch(API + '/subcategories?category_id=' + catId, { headers: HEADERS });
    const subs = (await res.json()).data || [];
    sel.innerHTML = '<option value="">All Subcategories</option>' + subs.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    loadAllParts();
}

async function loadAllParts() {
    const catId = document.getElementById('apCategory').value;
    const subId = document.getElementById('apSubcategory').value;
    const tbody = document.getElementById('allPartsBody');
    const thead = document.getElementById('allPartsHead');

    thead.innerHTML = '<tr><th>Part Number</th><th>Description</th><th>Category</th><th>Subcategory</th><th>Created By</th><th>Status</th><th>Created</th></tr>';
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Loading...</td></tr>';

    let url = API + '/all-parts?';
    if (subId) url += 'subcategory_id=' + subId;
    else if (catId) url += 'category_id=' + catId;

    try {
        const res = await fetch(url, { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data || data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty">No parts found</td></tr>';
            return;
        }
        tbody.innerHTML = data.data.map(p => `<tr style="cursor:pointer" onclick="window.location='/part/detail/${encodeURIComponent(p.part_number)}'">
            <td><a class="part-number-cell part-link" href="/part/detail/${encodeURIComponent(p.part_number)}" onclick="event.stopPropagation()">${esc(p.part_number)}</a></td>
            <td><span class="desc-cell">${esc(p.description || '-')}</span></td>
            <td>${esc(p.category)}</td>
            <td>${esc(p.subcategory)}</td>
            <td>${esc(p.created_by || '-')}</td>
            <td><span class="status-badge ${p.status === 'obsolete' ? 'status-obsolete' : 'status-active'}">${esc(p.status || 'active')}</span></td>
            <td>${formatTime(p.created_at)}</td>
        </tr>`).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="7" class="empty">Error loading parts</td></tr>'; }
}
