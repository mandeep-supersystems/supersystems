// BINS JS
let _allBins = [];
let _allLocations = [];

async function loadBins() {
    const container = document.getElementById('binListContainer');
    try {
        const res = await fetch(API + '/bins', { headers: HEADERS });
        const json = await res.json();
        _allBins = json.success ? json.data : [];
        _renderBinStats();
        _renderBinList(_allBins);
    } catch (e) {
        if (container) container.innerHTML = '<div style="padding:20px;color:red;">Error loading bins.</div>';
    }
}

function _renderBinStats() {
    const total = _allBins.length;
    const empty = _allBins.filter(b => (b.current_units || 0) === 0).length;
    const full  = _allBins.filter(b => (b.current_units || 0) >= (b.capacity_units || 1)).length;
    const partial = total - empty - full;
    const trashed = _allBins.filter(b => b.status === 'inactive' || b.status === 'trashed').length;
    const el = id => document.getElementById(id);
    if (el('binStatTotal'))   el('binStatTotal').innerText   = total;
    if (el('binStatEmpty'))   el('binStatEmpty').innerText   = empty;
    if (el('binStatFull'))    el('binStatFull').innerText    = full;
    if (el('binStatPartial')) el('binStatPartial').innerText = partial;
    if (el('binStatTrashed')) el('binStatTrashed').innerText = trashed;
}

function _renderBinList(bins) {
    const container = document.getElementById('binListContainer');
    if (!container) return;
    if (!bins.length) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">No bins found.</div>';
        return;
    }
    container.innerHTML = bins.map(b => {
        const pct = b.capacity_units ? Math.round((b.current_units / b.capacity_units) * 100) : 0;
        const fillColor = pct >= 100 ? '#c62828' : pct > 0 ? '#f57c00' : '#388e3c';
        const colorDot = b.bin_color ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${b.bin_color};margin-right:6px;border:1px solid var(--border-color);flex-shrink:0;"></span>` : '';
        return `
        <div class="bin-list-row" onclick="openBinPanel('${b.bin_code}')">
            <div class="bin-list-code">
                ${colorDot}
                <span class="material-icons-outlined" style="font-size:17px;color:var(--accent);">inventory_2</span>
                <strong>${b.bin_code}</strong>
            </div>
            <div style="font-size:13px;color:var(--text-muted);">${b.location_code || b.warehouse_code || '—'}</div>
            <div class="bin-list-fill">
                <div class="bin-fill-bar"><div class="bin-fill-inner" style="width:${Math.min(pct,100)}%;background:${fillColor};"></div></div>
                <span style="font-size:12px;color:var(--text-muted);min-width:64px;text-align:right;">${b.current_units}/${b.capacity_units}</span>
            </div>
            <div style="font-size:12px;color:var(--text-muted);text-transform:capitalize;">${b.bin_type || '—'}</div>
            <div><span class="badge ${b.status === 'active' ? 'badge-success' : 'badge-warning'}">${b.status || 'active'}</span></div>
            <div onclick="event.stopPropagation()"></div>
        </div>`;
    }).join('');
}

function filterBins() {
    const q = (document.getElementById('binSearch')?.value || '').toLowerCase();
    const filtered = q ? _allBins.filter(b =>
        (b.bin_code || '').toLowerCase().includes(q) ||
        (b.location_code || '').toLowerCase().includes(q) ||
        (b.warehouse_code || '').toLowerCase().includes(q) ||
        (b.bin_type || '').toLowerCase().includes(q)
    ) : _allBins;
    _renderBinList(filtered);
}

// ─── BIN DETAIL SLIDE-OVER PANEL ───
async function openBinPanel(binCode) {
    const panel = document.getElementById('binDetailPanel');
    const overlay = document.getElementById('binPanelOverlay');
    const content = document.getElementById('binPanelContent');

    content.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted);"><span class="material-icons-outlined" style="font-size:36px;animation:spin 1s linear infinite;">refresh</span><div style="margin-top:8px;">Loading bin details...</div></div>`;
    panel.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    try {
        const res = await fetch(`${API}/bins/${binCode}/details`, { headers: HEADERS });
        const json = await res.json();
        if (!json.success) { content.innerHTML = `<div style="padding:40px;text-align:center;color:red;">${json.message}</div>`; return; }
        _renderBinPanel(json.data);
    } catch (e) {
        content.innerHTML = '<div style="padding:40px;text-align:center;color:red;">Error loading bin details.</div>';
    }
}

function closeBinPanel() {
    document.getElementById('binDetailPanel').classList.remove('active');
    document.getElementById('binPanelOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

function _renderBinPanel(d) {
    const b = d.bin;
    const pct = b.capacity_units ? Math.round((b.current_units / b.capacity_units) * 100) : 0;
    const fillColor = pct >= 100 ? '#c62828' : pct > 0 ? '#f57c00' : '#388e3c';

    // Location breadcrumb
    const loc = d.location;
    const breadcrumb = loc
        ? `${loc.plant || ''} › ${loc.floor_name || ''} › ${loc.shelf_name || ''} › ${loc.row_name || ''} › ${loc.column_name || ''}`
        : (b.location_code || b.warehouse_code || '—');

    // Stock rows
    const stockHtml = d.stock && d.stock.length
        ? d.stock.map(s => `
            <div class="bin-panel-stock-row">
                <div>
                    <div style="font-weight:600;font-size:13px;">${s.part_number}</div>
                    <div style="font-size:11px;color:var(--text-muted);">${s.description || ''}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:700;color:var(--accent);">${s.qty_on_hand} <small style="font-weight:400;color:var(--text-muted);">${s.unit}</small></div>
                    <div style="font-size:11px;color:var(--text-muted);">Avail: ${s.qty_available}</div>
                </div>
            </div>`).join('')
        : '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">Bin is empty</div>';

    // Movement rows
    const movHtml = d.movements && d.movements.length
        ? d.movements.map(m => {
            const isIn = m.direction === 'IN';
            return `
            <div class="bin-panel-mov-row">
                <span class="material-icons-outlined" style="font-size:16px;color:${isIn ? '#388e3c' : '#c62828'};">${isIn ? 'arrow_downward' : 'arrow_upward'}</span>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:12px;font-weight:600;">${m.movement_type} — ${m.part_number}</div>
                    <div style="font-size:11px;color:var(--text-muted);">${m.reference_no} · ${m.performed_by}</div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                    <div style="font-weight:700;font-size:13px;color:${isIn ? '#388e3c' : '#c62828'};">${isIn ? '+' : '-'}${m.qty}</div>
                    <div style="font-size:10px;color:var(--text-muted);">${m.created_at ? m.created_at.slice(0,16) : ''}</div>
                </div>
            </div>`;
        }).join('')
        : '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">No movements recorded</div>';

    // Scan history
    const scanHtml = d.scan_history && d.scan_history.length
        ? d.scan_history.map(s => `
            <div class="bin-panel-mov-row">
                <span class="material-icons-outlined" style="font-size:16px;color:var(--accent);">qr_code_scanner</span>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:12px;font-weight:600;">${s.scanned_by || 'Unknown'}</div>
                    <div style="font-size:11px;color:var(--text-muted);">${s.scan_context || 'QR Scan'} · ${s.location_at_scan || b.location_code || '—'}</div>
                </div>
                <div style="font-size:10px;color:var(--text-muted);flex-shrink:0;">${s.scanned_at ? s.scanned_at.slice(0,16) : ''}</div>
            </div>`).join('')
        : '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">No scan history</div>';

    const colorSwatch = b.bin_color
        ? `<span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:${b.bin_color};border:1px solid var(--border-color);vertical-align:middle;margin-left:6px;" title="Bin colour"></span>`
        : '';

    document.getElementById('binPanelContent').innerHTML = `
    <div class="bin-panel-inner">

        <!-- HEADER -->
        <div class="bin-panel-header">
            <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:44px;height:44px;border-radius:10px;background:${b.bin_color || 'var(--accent)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <span class="material-icons-outlined" style="color:#fff;font-size:22px;">inventory_2</span>
                </div>
                <div>
                    <div style="font-size:18px;font-weight:700;">${b.bin_code} ${colorSwatch}</div>
                    <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${b.bin_type ? b.bin_type.charAt(0).toUpperCase()+b.bin_type.slice(1)+' Bin' : 'Bin'} · ${b.warehouse_code || '—'}</div>
                </div>
            </div>
            <span class="badge ${b.status === 'active' ? 'badge-success' : 'badge-warning'}" style="font-size:12px;">${b.status || 'active'}</span>
        </div>

        <!-- LOCATION BREADCRUMB -->
        <div class="bin-panel-breadcrumb">
            <span class="material-icons-outlined" style="font-size:14px;">location_on</span>
            <span>${breadcrumb}</span>
        </div>

        <!-- TOP ROW: QR + STATS -->
        <div class="bin-panel-top-row">
            <div class="bin-panel-qr-box">
                ${b.qr_code ? `<img src="${b.qr_code}" alt="QR" style="width:120px;height:120px;">` : '<div style="width:120px;height:120px;display:flex;align-items:center;justify-content:center;background:var(--bg-secondary);border-radius:8px;color:var(--text-muted);font-size:11px;">No QR</div>'}
                <div style="font-size:11px;color:var(--text-muted);margin-top:6px;text-align:center;">${b.bin_code}</div>
            </div>
            <div class="bin-panel-stats-grid">
                <div class="bin-panel-stat">
                    <div class="bin-panel-stat-val">${b.current_units}</div>
                    <div class="bin-panel-stat-lbl">Current Units</div>
                </div>
                <div class="bin-panel-stat">
                    <div class="bin-panel-stat-val">${b.capacity_units}</div>
                    <div class="bin-panel-stat-lbl">Capacity</div>
                </div>
                <div class="bin-panel-stat">
                    <div class="bin-panel-stat-val" style="color:${fillColor};">${pct}%</div>
                    <div class="bin-panel-stat-lbl">Fill Rate</div>
                </div>
                <div class="bin-panel-stat">
                    <div class="bin-panel-stat-val">${d.stock ? d.stock.length : 0}</div>
                    <div class="bin-panel-stat-lbl">Part Types</div>
                </div>
            </div>
        </div>

        <!-- FILL BAR -->
        <div style="margin:0 0 20px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:4px;">
                <span>Fill Level</span><span style="color:${fillColor};font-weight:600;">${pct}%</span>
            </div>
            <div style="height:8px;background:var(--border-color);border-radius:4px;overflow:hidden;">
                <div style="height:100%;width:${Math.min(pct,100)}%;background:${fillColor};border-radius:4px;transition:width 0.4s;"></div>
            </div>
        </div>

        <!-- TABS -->
        <div class="bin-panel-tabs" id="binPanelTabs">
            <button class="bin-tab active" onclick="switchBinTab('stock')">Stock in Bin</button>
            <button class="bin-tab" onclick="switchBinTab('movements')">Movements</button>
            <button class="bin-tab" onclick="switchBinTab('scans')">Scan History</button>
        </div>

        <div id="binTabStock" class="bin-tab-content active">${stockHtml}</div>
        <div id="binTabMovements" class="bin-tab-content">${movHtml}</div>
        <div id="binTabScans" class="bin-tab-content">${scanHtml}</div>

    </div>`;
}

function switchBinTab(tab) {
    document.querySelectorAll('.bin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.bin-tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector(`.bin-tab[onclick*="${tab}"]`).classList.add('active');
    document.getElementById(`binTab${tab.charAt(0).toUpperCase()+tab.slice(1)}`).classList.add('active');
}

// ─── LOAD LOCATIONS ───
async function _loadLocations() {
    if (_allLocations.length) return _allLocations;
    try {
        const res = await fetch('/api/v1/inventory/locations', { headers: HEADERS });
        const json = await res.json();
        _allLocations = json.success ? json.data : [];
    } catch (e) { _allLocations = []; }
    return _allLocations;
}

// ─── ADD NEW BIN MODAL ───
async function openNewBinModal() {
    const locs = await _loadLocations();
    const grouped = {};
    locs.forEach(l => {
        const key = `${l.plant} / ${l.floor_name}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(l);
    });
    const optionsHtml = Object.entries(grouped).map(([grp, items]) =>
        `<optgroup label="${grp}">${items.map(l =>
            `<option value="${l.location_code}" data-wh="${l.warehouse_code}">${l.location_code} — ${l.shelf_name}, ${l.row_name}, ${l.column_name}</option>`
        ).join('')}</optgroup>`
    ).join('');

    const colors = ['#e53935','#f57c00','#fdd835','#43a047','#1e88e5','#8e24aa','#00acc1','#6d4c41','#546e7a','#78909c'];
    const colorSwatches = colors.map(c =>
        `<span onclick="selectBinColor('${c}')" data-color="${c}" style="display:inline-block;width:24px;height:24px;border-radius:6px;background:${c};cursor:pointer;border:2px solid transparent;transition:border 0.15s;" title="${c}"></span>`
    ).join('');

    openModal('Add New Bin', `
        <div class="form-group">
            <label>Bin Code *</label>
            <input type="text" id="binCodeInput" placeholder="e.g. BIN-RM-A-03">
        </div>
        <div class="form-group">
            <label>Location *</label>
            <select id="binLocationSelect" onchange="_onBinLocationChange()">
                <option value="">— Select Location —</option>
                ${optionsHtml}
            </select>
        </div>
        <div style="display:flex;gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Warehouse</label>
                <input type="text" id="binWarehouseInput" placeholder="Auto-filled" readonly style="background:var(--bg-secondary);">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Bin Type</label>
                <select id="binTypeInput">
                    <option value="small">Small</option>
                    <option value="medium" selected>Medium</option>
                    <option value="large">Large</option>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label>Capacity (units)</label>
            <input type="number" id="binCapInput" value="500" min="1">
        </div>
        <div class="form-group">
            <label>Bin Colour</label>
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                ${colorSwatches}
                <input type="color" id="binColorCustom" value="#1e88e5" style="width:28px;height:28px;border:none;padding:0;cursor:pointer;border-radius:6px;" title="Custom colour" onchange="selectBinColor(this.value)">
            </div>
            <input type="hidden" id="binColorInput" value="">
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitNewBin()">Create Bin</button>
        </div>
    `);
}

function selectBinColor(color) {
    document.getElementById('binColorInput').value = color;
    document.querySelectorAll('[data-color]').forEach(el => {
        el.style.border = el.dataset.color === color ? '2px solid var(--text-primary)' : '2px solid transparent';
    });
}

function _onBinLocationChange() {
    const sel = document.getElementById('binLocationSelect');
    const opt = sel.options[sel.selectedIndex];
    if (opt && opt.dataset.wh) document.getElementById('binWarehouseInput').value = opt.dataset.wh;
}

async function submitNewBin() {
    const payload = {
        bin_code: document.getElementById('binCodeInput').value.trim(),
        location_code: document.getElementById('binLocationSelect').value,
        warehouse_code: document.getElementById('binWarehouseInput').value,
        bin_type: document.getElementById('binTypeInput').value,
        capacity_units: parseInt(document.getElementById('binCapInput').value) || 500,
        bin_color: document.getElementById('binColorInput').value || null
    };
    if (!payload.bin_code || !payload.location_code) { showToast('Bin code and location are required', 'error'); return; }
    try {
        const res = await fetch(API + '/bins', { method: 'POST', headers: HEADERS, body: JSON.stringify(payload) });
        const json = await res.json();
        if (json.success) { showToast(json.message); closeModal(); loadBins(); }
        else showToast(json.message, 'error');
    } catch (e) { showToast('Error creating bin', 'error'); }
}

// ─── BIN CAPACITY SECTION ───
let _binCapacityRules = [];

async function loadBinCapacity() {
    try {
        const res = await fetch(API + '/bin-capacity', { headers: HEADERS });
        const json = await res.json();
        _binCapacityRules = json.success ? json.data : [];
        _renderBinCapacity();
    } catch (e) {
        const el = document.getElementById('binCapacityBody');
        if (el) el.innerHTML = '<tr><td colspan="6" style="text-align:center;color:red;">Error loading capacity rules.</td></tr>';
    }
}

function _renderBinCapacity() {
    const tbody = document.getElementById('binCapacityBody');
    if (!tbody) return;
    if (!_binCapacityRules.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">No capacity rules defined.</td></tr>';
        return;
    }
    tbody.innerHTML = _binCapacityRules.map(r => `
        <tr>
            <td><strong>${r.part_code}</strong></td>
            <td>${r.part_description || '—'}</td>
            <td><span class="badge badge-info">Small</span> ${r.capacity_small}</td>
            <td><span class="badge badge-warning">Medium</span> ${r.capacity_medium}</td>
            <td><span class="badge badge-success">Large</span> ${r.capacity_large}</td>
            <td><button class="btn-action" onclick="openEditCapacityModal('${r.id}')" title="Edit"><span class="material-icons-outlined">edit</span></button></td>
        </tr>`).join('');
}

function openNewCapacityModal() {
    openModal('Add Bin Capacity Rule', `
        <div class="form-group"><label>Part Code *</label><input type="text" id="capPartCode" placeholder="e.g. 101.1.0001"></div>
        <div class="form-group"><label>Part Description</label><input type="text" id="capPartDesc" placeholder="Optional"></div>
        <div style="display:flex;gap:10px;">
            <div class="form-group" style="flex:1;"><label>Small</label><input type="number" id="capSmall" value="100" min="1"></div>
            <div class="form-group" style="flex:1;"><label>Medium</label><input type="number" id="capMedium" value="150" min="1"></div>
            <div class="form-group" style="flex:1;"><label>Large</label><input type="number" id="capLarge" value="200" min="1"></div>
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitCapacityRule()">Save Rule</button>
        </div>`);
}

function openEditCapacityModal(id) {
    const r = _binCapacityRules.find(x => x.id === id);
    if (!r) return;
    openModal('Edit Bin Capacity Rule', `
        <input type="hidden" id="capEditId" value="${r.id}">
        <div class="form-group"><label>Part Code</label><div style="font-weight:600;padding:8px 0;">${r.part_code}</div></div>
        <div style="display:flex;gap:10px;">
            <div class="form-group" style="flex:1;"><label>Small</label><input type="number" id="capSmall" value="${r.capacity_small}" min="1"></div>
            <div class="form-group" style="flex:1;"><label>Medium</label><input type="number" id="capMedium" value="${r.capacity_medium}" min="1"></div>
            <div class="form-group" style="flex:1;"><label>Large</label><input type="number" id="capLarge" value="${r.capacity_large}" min="1"></div>
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitCapacityRule(true)">Update Rule</button>
        </div>`);
}

async function submitCapacityRule(isEdit = false) {
    const id = isEdit ? document.getElementById('capEditId')?.value : null;
    const payload = {
        part_code: isEdit ? null : document.getElementById('capPartCode').value.trim(),
        part_description: isEdit ? null : document.getElementById('capPartDesc').value.trim(),
        capacity_small: parseInt(document.getElementById('capSmall').value) || 100,
        capacity_medium: parseInt(document.getElementById('capMedium').value) || 150,
        capacity_large: parseInt(document.getElementById('capLarge').value) || 200
    };
    if (!isEdit && !payload.part_code) { showToast('Part code required', 'error'); return; }
    const url = isEdit ? `${API}/bin-capacity/${id}` : `${API}/bin-capacity`;
    const method = isEdit ? 'PUT' : 'POST';
    try {
        const res = await fetch(url, { method, headers: HEADERS, body: JSON.stringify(payload) });
        const json = await res.json();
        if (json.success) { showToast(json.message); closeModal(); loadBinCapacity(); }
        else showToast(json.message, 'error');
    } catch (e) { showToast('Error saving capacity rule', 'error'); }
}
