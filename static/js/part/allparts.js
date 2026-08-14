// ─── PART MODULE: ALL PARTS ───
let apSelectedCats = [];
let apSelectedSubs = [];
let apCategories = [];
let apSubcategories = [];
let _allPartsCache = [];
let apSearchTimeout = null;

async function loadApCategories() {
    try {
        if (categories.length === 0) {
            const r = await fetch(API + '/categories', { headers: HEADERS });
            categories = (await r.json()).data || [];
        }
    } catch (e) {}
    apCategories = categories;
    apSelectedCats = [];
    apSelectedSubs = [];
    _apGsdReset('cat');
    _apGsdReset('sub');
    loadAllParts();
}

async function loadApSubcategories() {
    if (apSelectedCats.length === 0) {
        apSubcategories = [];
        apSelectedSubs = [];
        _apGsdReset('sub');
        loadAllParts();
        return;
    }
    try {
        const catIds = apSelectedCats.map(c => c.id).join(',');
        const res = await fetch(API + '/subcategories?category_ids=' + catIds, { headers: HEADERS });
        apSubcategories = (await res.json()).data || [];
    } catch (e) {
        apSubcategories = [];
    }
    // Remove any selected subcategories that do not belong to the remaining categories
    apSelectedSubs = apSelectedSubs.filter(sub => apSelectedCats.some(cat => cat.id === sub.category_id));
    _apGsdUpdateLabel('sub');
    loadAllParts();
}

function _apGsdReset(type) {
    if (type === 'cat') apSelectedCats = [];
    else apSelectedSubs = [];
    _apGsdUpdateLabel(type);
    const clearEl = document.getElementById(`ap${type === 'cat' ? 'Cat' : 'Sub'}Clear`);
    if (clearEl) clearEl.style.display = 'none';
    const searchEl = document.getElementById(`ap${type === 'cat' ? 'Cat' : 'Sub'}Search`);
    if (searchEl) searchEl.value = '';
    _closeApGsd(type);
}

function _apGsdUpdateLabel(type) {
    const textEl = document.getElementById(`ap${type === 'cat' ? 'Cat' : 'Sub'}Text`);
    const list = type === 'cat' ? apSelectedCats : apSelectedSubs;
    if (textEl) {
        if (list.length === 0) {
            textEl.textContent = type === 'cat' ? 'All Categories' : 'All Subcategories';
            textEl.classList.remove('gsd-selected');
        } else if (list.length === 1) {
            textEl.textContent = list[0].name;
            textEl.classList.add('gsd-selected');
        } else {
            textEl.textContent = `${list[0].name} + ${list.length - 1} more`;
            textEl.classList.add('gsd-selected');
        }
    }
}

function toggleApGsd(type) {
    const dd = document.getElementById(`ap${type === 'cat' ? 'Cat' : 'Sub'}Dropdown`);
    const isOpen = dd.classList.contains('gsd-open');
    document.getElementById('apCatDropdown').classList.remove('gsd-open');
    document.getElementById('apSubDropdown').classList.remove('gsd-open');
    document.getElementById('apCatArrow').textContent = 'expand_more';
    document.getElementById('apSubArrow').textContent = 'expand_more';
    if (!isOpen) {
        dd.classList.add('gsd-open');
        document.getElementById(`ap${type === 'cat' ? 'Cat' : 'Sub'}Arrow`).textContent = 'expand_less';
        _renderApGsdList(type, '');
        setTimeout(() => document.getElementById(`ap${type === 'cat' ? 'Cat' : 'Sub'}Search`).focus(), 50);
    }
}

function _closeApGsd(type) {
    const dd = document.getElementById(`ap${type === 'cat' ? 'Cat' : 'Sub'}Dropdown`);
    if (dd) {
        dd.classList.remove('gsd-open');
        document.getElementById(`ap${type === 'cat' ? 'Cat' : 'Sub'}Arrow`).textContent = 'expand_more';
    }
}

function filterApGsd(type, q) {
    _renderApGsdList(type, q);
}

function _renderApGsdList(type, q) {
    const list = document.getElementById(`ap${type === 'cat' ? 'Cat' : 'Sub'}List`);
    const items = type === 'cat' ? apCategories : apSubcategories;
    const selectedList = type === 'cat' ? apSelectedCats : apSelectedSubs;
    const filtered = q.trim() ? items.filter(i => i.name.toLowerCase().includes(q.toLowerCase()) || String(i.series_prefix).includes(q)) : items;
    if (!filtered.length) {
        list.innerHTML = '<div class="gsd-empty">No results found</div>';
        return;
    }
    list.innerHTML = filtered.map(item => {
        const selected = selectedList.some(s => s.id === item.id);
        return `<div class="gsd-item${selected ? ' gsd-item-active' : ''}" onclick="selectApGsd('${type}','${item.id}')"><input type="checkbox" style="pointer-events:none;flex-shrink:0" ${selected ? 'checked' : ''}><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.name)}</span><span class="gsd-series">${esc(item.series_prefix)}</span></div>`;
    }).join('');
}

function selectApGsd(type, id) {
    if (type === 'cat') {
        const cat = apCategories.find(c => c.id === id);
        const idx = apSelectedCats.findIndex(c => c.id === id);
        if (idx > -1) {
            apSelectedCats.splice(idx, 1);
        } else {
            apSelectedCats.push(cat);
        }
        
        const clearEl = document.getElementById('apCatClear');
        if (apSelectedCats.length > 0) {
            clearEl.style.display = 'flex';
        } else {
            clearEl.style.display = 'none';
        }
        _apGsdUpdateLabel('cat');
        _renderApGsdList('cat', document.getElementById('apCatSearch').value);
        loadApSubcategories();
    } else {
        const sub = apSubcategories.find(s => s.id === id);
        const idx = apSelectedSubs.findIndex(s => s.id === id);
        if (idx > -1) {
            apSelectedSubs.splice(idx, 1);
        } else {
            apSelectedSubs.push(sub);
        }
        
        const clearEl = document.getElementById('apSubClear');
        if (apSelectedSubs.length > 0) {
            clearEl.style.display = 'flex';
        } else {
            clearEl.style.display = 'none';
        }
        _apGsdUpdateLabel('sub');
        _renderApGsdList('sub', document.getElementById('apSubSearch').value);
        loadAllParts();
    }
}

function clearApGsd(e, type) {
    e.stopPropagation();
    _apGsdReset(type);
    if (type === 'cat') {
        apSubcategories = [];
        apSelectedSubs = [];
        _apGsdReset('sub');
    }
    loadAllParts();
}

async function loadAllParts() {
    const catIds = apSelectedCats.map(c => c.id).join(',');
    const subIds = apSelectedSubs.map(s => s.id).join(',');
    const q = ((document.getElementById('allPartsSearch') || {}).value || '').trim();
    const tbody = document.getElementById('allPartsBody');
    const thead = document.getElementById('allPartsHead');

    thead.innerHTML = '<tr><th>Part Number</th><th>Category</th><th>Subcategory</th><th>Value</th><th>Description</th><th>Status</th></tr>';
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading...</td></tr>';

    let url = API + '/all-parts?';
    if (subIds) url += 'subcategory_ids=' + subIds + '&';
    else if (catIds) url += 'category_ids=' + catIds + '&';
    if (q) url += 'q=' + encodeURIComponent(q);

    try {
        const res = await fetch(url, { headers: HEADERS });
        const data = await res.json();
        _allPartsCache = (data.success && data.data) ? data.data : [];
        renderAllPartsTable();
    } catch (e) { tbody.innerHTML = '<tr><td colspan="7" class="empty">Error loading parts</td></tr>'; }
}

function renderAllPartsTable() {
    const tbody = document.getElementById('allPartsBody');
    const rows = _allPartsCache;
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No parts found</td></tr>'; return; }
    tbody.innerHTML = rows.map(p => `<tr style="cursor:pointer" onclick="window.location='/part/detail/${encodeURIComponent(p.part_number)}'">
        <td><a class="part-number-cell part-link" href="/part/detail/${encodeURIComponent(p.part_number)}" onclick="event.stopPropagation()">${esc(p.part_number)}</a></td>
        <td>${esc(p.category || '-')}</td>
        <td>${esc(p.subcategory || '-')}</td>
        <td><span class="desc-cell">${esc(p.value || '-')}</span></td>
        <td><span class="desc-cell">${esc(p.description || '-')}</span></td>
        <td><span class="status-badge ${p.status === 'obsolete' ? 'status-obsolete' : 'status-active'}">${esc(p.status || 'active')}</span></td>
    </tr>`).join('');
}

function filterAllParts() {
    clearTimeout(apSearchTimeout);
    apSearchTimeout = setTimeout(() => {
        loadAllParts();
    }, 250);
}

// Close dropdowns when clicking outside
window.addEventListener('click', e => {
    if (!e.target.closest('#apCatWrap')) _closeApGsd('cat');
    if (!e.target.closest('#apSubWrap')) _closeApGsd('sub');
});
