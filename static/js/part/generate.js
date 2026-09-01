// ─── PART MODULE: GENERATE PART CODE ───

// State
let _gsdCatData = [];   // [{id, name, series_prefix, separator}]
let _gsdSubData = [];   // [{id, name, series_prefix, columns_config}]
let _selCat = null;     // selected category object
let _selSub = null;     // selected subcategory object

// ─── LOAD ───
async function loadGenCategories() {
    try { const res = await fetch(API + '/categories', { headers: HEADERS }); categories = (await res.json()).data || []; } catch (e) {}
    try { const res = await fetch(API + '/subcategories', { headers: HEADERS }); subcategories = (await res.json()).data || []; } catch (e) {}
    _gsdCatData = categories;
    _selCat = null; _selSub = null;
    _gsdReset('cat'); _gsdReset('sub');
    _gsdSetDisabled('sub', true);
    document.getElementById('genColumnsForm').innerHTML = '';
    if (document.getElementById('genManufacturers')) document.getElementById('genManufacturers').style.display = 'none';
            document.getElementById('genManufacturers').style.display = 'none';
            document.getElementById('genMpnMakeList').innerHTML = '';
    document.getElementById('genPreview').style.display = 'none';
    document.getElementById('btnGenerate').disabled = true;
    document.getElementById('genResult').innerHTML = '';
    document.getElementById('generatedPartsList').innerHTML = '<div class="empty">Select a subcategory to view parts</div>';
}

async function loadGenSubcategories() {
    _selSub = null;
    _gsdReset('sub');
    document.getElementById('genColumnsForm').innerHTML = '';
    if (document.getElementById('genManufacturers')) document.getElementById('genManufacturers').style.display = 'none';
            document.getElementById('genManufacturers').style.display = 'none';
            document.getElementById('genMpnMakeList').innerHTML = '';
    document.getElementById('genPreview').style.display = 'none';
    document.getElementById('btnGenerate').disabled = true;
    document.getElementById('generatedPartsList').innerHTML = '<div class="empty">Select a subcategory</div>';
    if (!_selCat) { _gsdSetDisabled('sub', true); return; }
    const res = await fetch(API + '/subcategories?category_id=' + _selCat.id, { headers: HEADERS });
    _gsdSubData = (await res.json()).data || [];
    _gsdSetDisabled('sub', false);
}

// ─── CUSTOM DROPDOWN ENGINE ───
function _gsdItems(type) { return type === 'cat' ? _gsdCatData : _gsdSubData; }

function _gsdLabel(type, item) {
    if (type === 'cat') return `${item.name} <span class="gsd-series">${item.series_prefix}</span>`;
    return `${item.name} <span class="gsd-series">${item.series_prefix}</span>`;
}

function _gsdReset(type) {
    document.getElementById(`gen${type === 'cat' ? 'Cat' : 'Sub'}Text`).textContent = type === 'cat' ? 'Select category...' : 'Select subcategory...';
    document.getElementById(`gen${type === 'cat' ? 'Cat' : 'Sub'}Text`).classList.remove('gsd-selected');
    document.getElementById(`gen${type === 'cat' ? 'Cat' : 'Sub'}Clear`).style.display = 'none';
    document.getElementById(`gen${type === 'cat' ? 'Cat' : 'Sub'}Search`).value = '';
    _closeGsd(type);
}

function _gsdSetDisabled(type, disabled) {
    const box = document.getElementById(`gen${type === 'cat' ? 'Cat' : 'Sub'}Box`);
    if (disabled) box.classList.add('gsd-disabled'); else box.classList.remove('gsd-disabled');
}

function toggleGsd(type) {
    if (type === 'sub' && !_selCat) return;
    const dd = document.getElementById(`gen${type === 'cat' ? 'Cat' : 'Sub'}Dropdown`);
    const isOpen = dd.classList.contains('gsd-open');
    // close both first
    document.getElementById('genCatDropdown').classList.remove('gsd-open');
    document.getElementById('genSubDropdown').classList.remove('gsd-open');
    document.getElementById('genCatArrow').textContent = 'expand_more';
    document.getElementById('genSubArrow').textContent = 'expand_more';
    if (!isOpen) {
        dd.classList.add('gsd-open');
        document.getElementById(`gen${type === 'cat' ? 'Cat' : 'Sub'}Arrow`).textContent = 'expand_less';
        _renderGsdList(type, '');
        setTimeout(() => document.getElementById(`gen${type === 'cat' ? 'Cat' : 'Sub'}Search`).focus(), 50);
    }
}

function _closeGsd(type) {
    const dd = document.getElementById(`gen${type === 'cat' ? 'Cat' : 'Sub'}Dropdown`);
    dd.classList.remove('gsd-open');
    document.getElementById(`gen${type === 'cat' ? 'Cat' : 'Sub'}Arrow`).textContent = 'expand_more';
}

function filterGsd(type, q) {
    _renderGsdList(type, q);
}

function _renderGsdList(type, q) {
    const list = document.getElementById(`gen${type === 'cat' ? 'Cat' : 'Sub'}List`);
    const items = _gsdItems(type);
    const filtered = q.trim() ? items.filter(i => i.name.toLowerCase().includes(q.toLowerCase()) || String(i.series_prefix).includes(q)) : items;
    if (!filtered.length) {
        list.innerHTML = '<div class="gsd-empty">No results found</div>';
        return;
    }
    list.innerHTML = filtered.map(item => {
        const selected = (type === 'cat' && _selCat?.id === item.id) || (type === 'sub' && _selSub?.id === item.id);
        return `<div class="gsd-item${selected ? ' gsd-item-active' : ''}" onclick="selectGsd('${type}','${item.id}')">${_gsdLabel(type, item)}</div>`;
    }).join('');
}

function selectGsd(type, id) {
    if (type === 'cat') {
        _selCat = _gsdCatData.find(c => c.id === id);
        const textEl = document.getElementById('genCatText');
        textEl.innerHTML = `${_selCat.name} <span class="gsd-series">${_selCat.series_prefix}</span>`;
        textEl.classList.add('gsd-selected');
        document.getElementById('genCatClear').style.display = 'flex';
        _closeGsd('cat');
        loadGenSubcategories();
    } else {
        _selSub = _gsdSubData.find(s => s.id === id);
        const textEl = document.getElementById('genSubText');
        textEl.innerHTML = `${_selSub.name} <span class="gsd-series">${_selSub.series_prefix}</span>`;
        textEl.classList.add('gsd-selected');
        document.getElementById('genSubClear').style.display = 'flex';
        _closeGsd('sub');
        loadGenColumns();
    }
}

function clearGsd(e, type) {
    e.stopPropagation();
    if (type === 'cat') {
        _selCat = null; _selSub = null;
        _gsdReset('cat'); _gsdReset('sub');
        _gsdSetDisabled('sub', true);
        document.getElementById('genColumnsForm').innerHTML = '';
    if (document.getElementById('genManufacturers')) document.getElementById('genManufacturers').style.display = 'none';
            document.getElementById('genManufacturers').style.display = 'none';
            document.getElementById('genMpnMakeList').innerHTML = '';
        document.getElementById('genPreview').style.display = 'none';
        document.getElementById('btnGenerate').disabled = true;
        document.getElementById('genResult').innerHTML = '';
        document.getElementById('generatedPartsList').innerHTML = '<div class="empty">Select a subcategory to view parts</div>';
    } else {
        _selSub = null;
        _gsdReset('sub');
        document.getElementById('genColumnsForm').innerHTML = '';
    if (document.getElementById('genManufacturers')) document.getElementById('genManufacturers').style.display = 'none';
            document.getElementById('genManufacturers').style.display = 'none';
            document.getElementById('genMpnMakeList').innerHTML = '';
        document.getElementById('genPreview').style.display = 'none';
        document.getElementById('btnGenerate').disabled = true;
        document.getElementById('genResult').innerHTML = '';
        document.getElementById('generatedPartsList').innerHTML = '<div class="empty">Select a subcategory</div>';
    }
}

// Close on outside click
document.addEventListener('click', function(e) {
    if (!e.target.closest('#genCatWrap')) _closeGsd('cat');
    if (!e.target.closest('#genSubWrap')) _closeGsd('sub');
});

// ─── COLUMNS + GENERATE ───
function loadGenColumns() {
    if (!_selSub || !_selCat) return;
    // Always use category columns as authoritative source for generate form
    const cols = (_selCat.columns && _selCat.columns.length > 0) ? _selCat.columns : parseCols(_selSub.columns_config);
    const sep = _selCat.separator || '-';
    document.getElementById('genPreview').style.display = 'block';
    document.getElementById('genManufacturers').style.display = 'block';
    document.getElementById('genMpnMakeList').innerHTML = '';
    addGenMpnMakeRow();
    const padLen = _selSub.sequence_padding || 4;
    const placeholderStr = 'X'.repeat(padLen);
    document.getElementById('partPreviewText').textContent = `${_selCat.series_prefix}${sep}${_selSub.series_prefix}${sep}${placeholderStr}`;
    
    const isAssembly = (_selCat && _selCat.name === 'Assembly');
    const usageHtml = isAssembly ? '' : 
        `<div class="form-group">
            <label>Part Usage *</label>
            <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 14px;border:2px solid var(--accent);border-radius:8px;font-size:13px;font-weight:600" id="ptBoughtLabel">
                    <input type="checkbox" id="ptBought" checked onchange="updatePartTypeSel()" style="width:auto"> Bought-Out
                </label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 14px;border:2px solid var(--border-color);border-radius:8px;font-size:13px;font-weight:600;color:var(--text-secondary)" id="ptMfgLabel">
                    <input type="checkbox" id="ptMfg" onchange="updatePartTypeSel()" style="width:auto"> Manufactured
                </label>
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:5px" id="ptHint">Select one or both — same part code, different usage contexts.</div>
        </div>`;
        
    document.getElementById('genColumnsForm').innerHTML = usageHtml +
        (cols.length > 0 ? '<p class="gen-cols-title">Part Details</p>' + cols.map(c => `<div class="form-group"><label>${esc(c.label || c.name)}</label><input type="text" id="gen_col_${c.name}" placeholder="Enter ${esc(c.label || c.name)}"></div>`).join('') : '');
    document.getElementById('btnGenerate').disabled = false;
    document.getElementById('genResult').innerHTML = '';
    loadGeneratedParts(_selSub.id);
}

function updatePartTypeSel() {
    const boEl = document.getElementById('ptBought');
    const mfgEl = document.getElementById('ptMfg');
    if (!boEl || !mfgEl) return;
    const bo = boEl.checked;
    const mfg = mfgEl.checked;
    if (!bo && !mfg) { boEl.checked = true; return updatePartTypeSel(); }
    document.getElementById('ptBoughtLabel').style.borderColor = bo ? 'var(--accent)' : 'var(--border-color)';
    document.getElementById('ptBoughtLabel').style.color = bo ? 'var(--accent)' : 'var(--text-secondary)';
    document.getElementById('ptMfgLabel').style.borderColor = mfg ? '#2e7d32' : 'var(--border-color)';
    document.getElementById('ptMfgLabel').style.color = mfg ? '#2e7d32' : 'var(--text-secondary)';
    const hint = document.getElementById('ptHint');
    if (hint) hint.textContent = bo && mfg ? 'Both: can be purchased or manufactured depending on context.'
        : bo ? 'Bought-Out: purchased from supplier.'
        : 'Manufactured: made in-house — can be used in process routings.';
}

async function generatePart() {
    if (!_selSub) return;
    // Use category columns as authoritative source
    const cols = (_selCat && _selCat.columns && _selCat.columns.length > 0) ? _selCat.columns : parseCols(_selSub.columns_config);
    const values = {};
    cols.forEach(c => { const input = document.getElementById('gen_col_' + c.name); if (input && input.value.trim()) values[c.name] = input.value.trim(); });
    
    const isAssembly = (_selCat && _selCat.name === 'Assembly');
    const is_bought_out = isAssembly ? false : (document.getElementById('ptBought')?.checked ?? true);
    const is_manufactured = isAssembly ? true : (document.getElementById('ptMfg')?.checked ?? false);
    document.getElementById('btnGenerate').disabled = true;

    const manufacturers = [];
    document.querySelectorAll('.gen-mpn-row').forEach(r => {
        const mpn = r.querySelector('.gen-mpn').value.trim();
        const make = r.querySelector('.gen-make').value.trim();
        if(mpn || make) manufacturers.push({mpn, make});
    });

    try {
        const res = await fetch(API + '/generate', { method: 'POST', headers: HEADERS, body: JSON.stringify({ subcategory_id: _selSub.id, values, is_bought_out, is_manufactured, manufacturers }) });
        const data = await res.json();
        if (data.success) {
            const desc = data.data.description ? ` | ${data.data.description}` : '';
            const bo = data.data.is_bought_out, mfg = data.data.is_manufactured;
            const typeLabel = (bo && mfg)
                ? ' <span style="font-size:11px;background:#fff8e1;color:#f9a825;padding:2px 8px;border-radius:8px;font-weight:700">BO + MFG</span>'
                : mfg
                ? ' <span style="font-size:11px;background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:8px;font-weight:700">MANUFACTURED</span>'
                : ' <span style="font-size:11px;background:#e3f2fd;color:#1565c0;padding:2px 8px;border-radius:8px;font-weight:700">BOUGHT-OUT</span>';
            document.getElementById('genResult').innerHTML = `<div class="success-msg"><span class="material-icons-outlined">check_circle</span> Generated: <strong>${data.data.part_number}</strong>${typeLabel}${desc}</div>`;
            document.getElementById('partPreviewText').textContent = data.data.part_number;
            // Clear using category columns
            const clearCols = (_selCat && _selCat.columns && _selCat.columns.length > 0) ? _selCat.columns : cols;
            clearCols.forEach(c => { const input = document.getElementById('gen_col_' + c.name); if (input) input.value = ''; });
            document.getElementById('genMpnMakeList').innerHTML = '';
            addGenMpnMakeRow();
            loadGeneratedParts(_selSub.id);
        } else {
            if ((res.status === 409 || data.already_exists) && data.data && data.data.existing_part) {
                document.getElementById('genResult').innerHTML = `<div class="error-msg"><span class="material-icons-outlined">error</span> Part already exists: <strong>${data.data.existing_part}</strong><br><small>Description: "${esc(data.data.description)}"</small></div>`;
            } else { showToast(data.message || 'Generation failed', 'error'); }
        }
    } catch (e) { showToast('Network error', 'error'); }
    document.getElementById('btnGenerate').disabled = false;
}

async function loadGeneratedParts(subId) {
    const container = document.getElementById('generatedPartsList');
    try {
        const res = await fetch(API + '/parts/' + subId, { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data || data.data.length === 0) { container.innerHTML = '<div class="empty">No parts generated yet</div>'; return; }
        container.innerHTML = data.data.map(p => {
            const isObs = p.status === 'obsolete';
            const bo = p.is_bought_out !== false;
            const mfg = p.is_manufactured === true;
            const typeBadge = (bo && mfg)
                ? '<span style="font-size:10px;background:#fff8e1;color:#f9a825;padding:1px 7px;border-radius:8px;font-weight:700;margin-left:4px">BO+MFG</span>'
                : mfg
                ? '<span style="font-size:10px;background:#e8f5e9;color:#2e7d32;padding:1px 7px;border-radius:8px;font-weight:700;margin-left:4px">MFG</span>'
                : '<span style="font-size:10px;background:#e3f2fd;color:#1565c0;padding:1px 7px;border-radius:8px;font-weight:700;margin-left:4px">BO</span>';
            const meta = Object.entries(p).filter(([k]) => !['id','part_number','created_at','status','obsoleted_at','obsolete_reason','part_type'].includes(k)).filter(([,v]) => v).map(([k,v]) => `<span class="meta-tag">${k}: ${v}</span>`).join('');
            return `<div class="part-item ${isObs ? 'obsolete' : ''}" style="cursor:pointer" onclick="window.location='/part/detail/${encodeURIComponent(p.part_number)}'">
                <div class="part-item-left"><a class="part-item-number part-link" href="/part/detail/${encodeURIComponent(p.part_number)}" onclick="event.stopPropagation()">${p.part_number}</a>${typeBadge}<div class="part-item-meta">${meta}</div></div>
                <div class="part-item-actions">${isObs ? '<span class="obs-badge">Obsolete</span>' : `<button class="btn-obs" onclick="event.stopPropagation();obsoletePart('${subId}','${p.part_number}')" title="Mark Obsolete"><span class="material-icons-outlined">block</span></button>`}</div>
            </div>`;
        }).join('');
    } catch (e) { container.innerHTML = '<div class="empty">Error loading parts</div>'; }
}

// No downloadTemplate override needed here. Use the global multi-sheet template generator in common.js

function addGenMpnMakeRow() {
    const list = document.getElementById('genMpnMakeList');
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.gap = '8px';
    div.className = 'gen-mpn-row';
    div.innerHTML = `
        <input type="text" class="gen-mpn" placeholder="MPN (e.g. CR0402)" style="flex:1; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px;">
        <input type="text" class="gen-make" placeholder="Make (e.g. Yageo)" style="flex:1; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px;">
        <button type="button" class="btn-outline btn-sm" onclick="this.parentElement.remove()" title="Remove" style="padding: 4px 8px;"><span class="material-icons-outlined">close</span></button>
    `;
    list.appendChild(div);
}
