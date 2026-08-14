// ── ASSET REGISTER ───────────────────────────────────
let _allAssets  = [];
let _allSeries  = [];
let _activeSeries = '';

// ── SERIES SIDEBAR ────────────────────────────────────
async function loadSeries() {
    const res = await fetch(ASSET_API + '/series', { headers: ASSET_HEADERS() });
    const json = await res.json();
    _allSeries = json.success ? json.data : [];
    _renderSeriesSidebar();
}

function _renderSeriesSidebar() {
    const el = document.getElementById('assetSeriesList');
    if (!el) return;
    el.innerHTML = `
        <div class="asset-series-item ${_activeSeries === '' ? 'active' : ''}" onclick="filterBySeries('')">
            <span class="material-icons-outlined">list</span>
            <span style="flex:1;">All Assets</span>
            <span class="asset-series-count">${_allAssets.length}</span>
        </div>` +
        _allSeries.map(s => `
        <div class="asset-series-item ${_activeSeries === String(s.series_number) ? 'active' : ''}" onclick="filterBySeries('${s.series_number}')">
            <span class="material-icons-outlined">folder</span>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:13px;">${s.series_number}</div>
                <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.category}</div>
            </div>
            <span class="asset-series-count">${s.item_count}</span>
        </div>`).join('');
}

function filterBySeries(sn) {
    _activeSeries = String(sn);
    _renderSeriesSidebar();
    loadAssets(sn);
}

// ── ASSETS LIST ───────────────────────────────────────
async function loadAssets(series = '') {
    const search = document.getElementById('assetSearch')?.value || '';
    let url = ASSET_API + '/register?';
    if (series) url += `series=${series}&`;
    if (search) url += `search=${encodeURIComponent(search)}`;

    try {
        const res = await fetch(url, { headers: ASSET_HEADERS() });
        const json = await res.json();
        _allAssets = json.success ? json.data : [];
    } catch (e) { _allAssets = []; }
    _renderAssetTable(_allAssets);
    _renderSeriesSidebar();
}

const _statusBadge = s => ({
    active:       '<span class="asset-status-badge badge-active">Active</span>',
    under_repair: '<span class="asset-status-badge badge-repair">Under Repair</span>',
    disposed:     '<span class="asset-status-badge badge-disposed">Disposed</span>',
    inactive:     '<span class="asset-status-badge badge-inactive">Inactive</span>',
})[s] || `<span class="asset-status-badge badge-inactive">${s||'—'}</span>`;

function _renderAssetTable(assets) {
    const tbody = document.getElementById('assetTableBody');
    if (!tbody) return;
    if (!assets.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">No assets found.</td></tr>';
        return;
    }
    let prevSeries = null;
    tbody.innerHTML = assets.map(a => {
        const showSeries = a.series_number !== prevSeries;
        prevSeries = a.series_number;
        return `<tr>
            <td style="font-weight:700;color:${showSeries?'var(--accent)':'transparent'};user-select:none;font-size:12px;">${showSeries ? a.series_number : '·'}</td>
            <td><span class="asset-num-badge">${a.asset_number}</span></td>
            <td style="color:var(--text-muted);font-size:12px;">${a.category}</td>
            <td>${a.description || '<span style="color:var(--text-muted)">—</span>'}</td>
            <td>${a.make || '<span style="color:var(--text-muted)">—</span>'}</td>
            <td style="text-align:center;font-weight:600;">${a.qty}</td>
            <td>${_statusBadge(a.status)}</td>
            <td style="white-space:nowrap;">
                <button class="btn-action" onclick="openEditAssetModal('${a.id}','${a.asset_number}')" title="Edit"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-action" onclick="deleteAsset('${a.id}','${a.asset_number}')" title="Delete" style="color:#c62828;"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>`;
    }).join('');
}

function searchAssets() { loadAssets(_activeSeries); }

// ── ADD ASSET ─────────────────────────────────────────
function openAddAssetModal() {
    const opts = _allSeries.map(s =>
        `<option value="${s.series_number}" data-cat="${s.category}">${s.series_number} — ${s.category}</option>`
    ).join('');
    assetOpenModal('Add Asset', `
        <div class="form-group">
            <label>Series *</label>
            <select id="addAssetSeries" onchange="onAddSeriesChange()" required>
                <option value="">— Select Series —</option>${opts}
                <option value="__new__">+ Create New Series</option>
            </select>
        </div>
        <div id="newSeriesFields" style="display:none;">
            <div style="display:flex;gap:10px;">
                <div class="form-group" style="flex:1;"><label>Series Number *</label><input type="number" id="newSeriesNum" placeholder="e.g. 5270"></div>
                <div class="form-group" style="flex:2;"><label>Category *</label><input type="text" id="newSeriesCat" placeholder="e.g. Printer"></div>
            </div>
        </div>
        <div class="form-group"><label>Category</label><input type="text" id="addAssetCat" placeholder="Auto-filled" readonly style="background:var(--bg-secondary);"></div>
        <div class="form-group"><label>Description</label><input type="text" id="addAssetDesc" placeholder="e.g. Laser Printer, A4"></div>
        <div style="display:flex;gap:10px;">
            <div class="form-group" style="flex:1;"><label>Qty *</label><input type="number" id="addAssetQty" value="1" min="1"></div>
            <div class="form-group" style="flex:2;"><label>Make / Brand</label><input type="text" id="addAssetMake" placeholder="e.g. HP"></div>
        </div>
        <div class="form-group"><label>Location</label><input type="text" id="addAssetLoc" placeholder="e.g. Server Room"></div>
        <div class="form-actions">
            <button class="btn-outline" onclick="assetCloseModal()">Cancel</button>
            <button class="btn-primary" onclick="submitAddAsset()">Add Asset</button>
        </div>`);
}

function onAddSeriesChange() {
    const sel = document.getElementById('addAssetSeries');
    const newFields = document.getElementById('newSeriesFields');
    const catInput  = document.getElementById('addAssetCat');
    if (sel.value === '__new__') {
        newFields.style.display = 'block';
        catInput.value = ''; catInput.removeAttribute('readonly');
    } else {
        newFields.style.display = 'none';
        catInput.setAttribute('readonly', true);
        catInput.style.background = 'var(--bg-secondary)';
        catInput.value = sel.options[sel.selectedIndex]?.dataset?.cat || '';
    }
}

async function submitAddAsset() {
    const seriesSel = document.getElementById('addAssetSeries').value;
    let series_number, category;
    if (seriesSel === '__new__') {
        series_number = parseInt(document.getElementById('newSeriesNum').value);
        category = document.getElementById('newSeriesCat').value.trim();
        if (!series_number || !category) { assetShowToast('Series number and category required', 'error'); return; }
    } else {
        series_number = parseInt(seriesSel);
        category = document.getElementById('addAssetCat').value.trim();
        if (!series_number) { assetShowToast('Select a series', 'error'); return; }
    }
    const payload = {
        series_number, category,
        description: document.getElementById('addAssetDesc').value.trim(),
        qty: parseInt(document.getElementById('addAssetQty').value) || 1,
        make: document.getElementById('addAssetMake').value.trim(),
        location: document.getElementById('addAssetLoc').value.trim()
    };
    const res = await fetch(ASSET_API + '/register', { method: 'POST', headers: ASSET_HEADERS(), body: JSON.stringify(payload) });
    const json = await res.json();
    if (json.success) { assetShowToast(json.message); assetCloseModal(); loadSeries(); loadAssets(_activeSeries); }
    else assetShowToast(json.message, 'error');
}

// ── EDIT ASSET ────────────────────────────────────────
function openEditAssetModal(id, assetNumber) {
    const a = _allAssets.find(x => x.id === id);
    if (!a) return;
    assetOpenModal(`Edit — ${assetNumber}`, `
        <input type="hidden" id="editAssetId" value="${id}">
        <div class="form-group"><label>Asset Number</label><div style="font-weight:700;padding:8px 0;font-size:15px;">${assetNumber}</div></div>
        <div class="form-group"><label>Description</label><input type="text" id="editDesc" value="${a.description || ''}"></div>
        <div style="display:flex;gap:10px;">
            <div class="form-group" style="flex:1;"><label>Qty</label><input type="number" id="editQty" value="${a.qty}" min="1"></div>
            <div class="form-group" style="flex:2;"><label>Make</label><input type="text" id="editMake" value="${a.make || ''}"></div>
        </div>
        <div class="form-group"><label>Location</label><input type="text" id="editLoc" value="${a.location || ''}"></div>
        <div class="form-group"><label>Status</label>
            <select id="editStatus">
                <option value="active" ${a.status==='active'?'selected':''}>Active</option>
                <option value="inactive" ${a.status==='inactive'?'selected':''}>Inactive</option>
                <option value="disposed" ${a.status==='disposed'?'selected':''}>Disposed</option>
                <option value="under_repair" ${a.status==='under_repair'?'selected':''}>Under Repair</option>
            </select>
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="assetCloseModal()">Cancel</button>
            <button class="btn-primary" onclick="submitEditAsset()">Save</button>
        </div>`);
}

async function submitEditAsset() {
    const id = document.getElementById('editAssetId').value;
    const payload = {
        description: document.getElementById('editDesc').value.trim(),
        qty: parseInt(document.getElementById('editQty').value) || 1,
        make: document.getElementById('editMake').value.trim(),
        location: document.getElementById('editLoc').value.trim(),
        status: document.getElementById('editStatus').value
    };
    const res = await fetch(`${ASSET_API}/register/${id}`, { method: 'PUT', headers: ASSET_HEADERS(), body: JSON.stringify(payload) });
    const json = await res.json();
    if (json.success) { assetShowToast(json.message); assetCloseModal(); loadAssets(_activeSeries); }
    else assetShowToast(json.message, 'error');
}

async function deleteAsset(id, assetNumber) {
    if (!confirm(`Delete asset ${assetNumber}?`)) return;
    const res = await fetch(`${ASSET_API}/register/${id}`, { method: 'DELETE', headers: ASSET_HEADERS() });
    const json = await res.json();
    if (json.success) { assetShowToast(json.message); loadSeries(); loadAssets(_activeSeries); }
    else assetShowToast(json.message, 'error');
}

// ── NEW SERIES ────────────────────────────────────────
function openNewSeriesModal() {
    assetOpenModal('Create New Series', `
        <div style="display:flex;gap:10px;">
            <div class="form-group" style="flex:1;"><label>Series Number *</label><input type="number" id="snNum" placeholder="e.g. 5270"></div>
            <div class="form-group" style="flex:2;"><label>Category *</label><input type="text" id="snCat" placeholder="e.g. Printer"></div>
        </div>
        <div class="form-group"><label>Description</label><input type="text" id="snDesc" placeholder="Optional"></div>
        <div class="form-actions">
            <button class="btn-outline" onclick="assetCloseModal()">Cancel</button>
            <button class="btn-primary" onclick="submitNewSeries()">Create Series</button>
        </div>`);
}

async function submitNewSeries() {
    const payload = {
        series_number: parseInt(document.getElementById('snNum').value),
        category: document.getElementById('snCat').value.trim(),
        description: document.getElementById('snDesc').value.trim()
    };
    if (!payload.series_number || !payload.category) { assetShowToast('Series number and category required', 'error'); return; }
    const res = await fetch(ASSET_API + '/series', { method: 'POST', headers: ASSET_HEADERS(), body: JSON.stringify(payload) });
    const json = await res.json();
    if (json.success) { assetShowToast(json.message); assetCloseModal(); loadSeries(); }
    else assetShowToast(json.message, 'error');
}

// ── IMPORT ────────────────────────────────────────────
function openImportModal() {
    assetOpenModal('Import Assets from Excel', `
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">
            Columns: <strong>Series | Asset Number | Category | Description | Qty | Make</strong><br>
            Series and Asset Number can be blank for continuation rows.
        </p>
        <div class="form-group"><label>Select .xlsx file *</label><input type="file" id="importFile" accept=".xlsx"></div>
        <div class="form-actions">
            <button class="btn-outline" onclick="assetCloseModal()">Cancel</button>
            <button class="btn-primary" onclick="submitImport()">Import</button>
        </div>`);
}

async function submitImport() {
    const file = document.getElementById('importFile')?.files[0];
    if (!file) { assetShowToast('Select a file', 'error'); return; }
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(ASSET_API + '/import', {
        method: 'POST',
        headers: { 'Authorization': ASSET_HEADERS()['Authorization'] },
        body: fd
    });
    const json = await res.json();
    if (json.success) { assetShowToast(json.message); assetCloseModal(); loadSeries(); loadAssets(_activeSeries); }
    else assetShowToast(json.message, 'error');
}

// ── EXPORT ────────────────────────────────────────────
function exportAssets() {
    window.location.href = ASSET_API + '/export' + (_activeSeries ? `?series=${_activeSeries}` : '');
}
