// ─── PART MODULE: GENERATE PART CODE ───
async function loadGenCategories() {
    try { const res = await fetch(API + '/categories', { headers: HEADERS }); categories = (await res.json()).data || []; } catch (e) {}
    const sel = document.getElementById('genCategory');
    sel.innerHTML = '<option value="">— Select Category —</option>' + categories.map(c => `<option value="${c.id}" data-series="${c.series_prefix}" data-sep="${c.separator || '-'}">${esc(c.name)} (${c.series_prefix})</option>`).join('');
    document.getElementById('genSubcategory').innerHTML = '<option value="">— Select Subcategory —</option>';
    document.getElementById('genColumnsForm').innerHTML = '';
    document.getElementById('genPreview').style.display = 'none';
    document.getElementById('btnGenerate').disabled = true;
    document.getElementById('genResult').innerHTML = '';
    document.getElementById('generatedPartsList').innerHTML = '<div class="empty">Select a subcategory to view parts</div>';
}

async function loadGenSubcategories() {
    const catId = document.getElementById('genCategory').value;
    const sel = document.getElementById('genSubcategory');
    document.getElementById('genColumnsForm').innerHTML = '';
    document.getElementById('genPreview').style.display = 'none';
    document.getElementById('btnGenerate').disabled = true;
    document.getElementById('generatedPartsList').innerHTML = '<div class="empty">Select a subcategory</div>';
    if (!catId) { sel.innerHTML = '<option value="">— Select Subcategory —</option>'; return; }
    const res = await fetch(API + '/subcategories?category_id=' + catId, { headers: HEADERS });
    const subs = (await res.json()).data || [];
    sel.innerHTML = '<option value="">— Select Subcategory —</option>' + subs.map(s => {
        const colsStr = JSON.stringify(s.columns_config || []).replace(/'/g, '&#39;');
        return `<option value="${s.id}" data-series="${s.series_prefix}" data-cols='${colsStr}'>${esc(s.name)} (${s.series_prefix})</option>`;
    }).join('');
}

function loadGenColumns() {
    const sel = document.getElementById('genSubcategory');
    const opt = sel.options[sel.selectedIndex];
    if (!opt || !opt.value) { document.getElementById('genColumnsForm').innerHTML = ''; document.getElementById('genPreview').style.display = 'none'; document.getElementById('btnGenerate').disabled = true; return; }
    const cols = JSON.parse(opt.dataset.cols || '[]');
    const catOpt = document.getElementById('genCategory').options[document.getElementById('genCategory').selectedIndex];
    const catSeries = catOpt.dataset.series;
    const sep = catOpt.dataset.sep || '-';
    document.getElementById('genPreview').style.display = 'block';
    document.getElementById('partPreviewText').textContent = `${catSeries}${sep}${opt.dataset.series}${sep}XXXXXX`;
    document.getElementById('genColumnsForm').innerHTML =
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
        </div>` +
        (cols.length > 0 ? '<p class="gen-cols-title">Part Details</p>' + cols.map(c => `<div class="form-group"><label>${esc(c.label || c.name)}</label><input type="text" id="gen_col_${c.name}" placeholder="Enter ${esc(c.label || c.name)}"></div>`).join('') : '');
    document.getElementById('btnGenerate').disabled = false;
    document.getElementById('genResult').innerHTML = '';
    loadGeneratedParts(opt.value);
}

function updatePartTypeSel() {
    const bo = document.getElementById('ptBought')?.checked;
    const mfg = document.getElementById('ptMfg')?.checked;
    // enforce at least one
    if (!bo && !mfg) { document.getElementById('ptBought').checked = true; return updatePartTypeSel(); }
    const boColor = bo ? 'var(--accent)' : 'var(--border-color)';
    const mfgColor = mfg ? '#2e7d32' : 'var(--border-color)';
    document.getElementById('ptBoughtLabel').style.borderColor = boColor;
    document.getElementById('ptBoughtLabel').style.color = bo ? 'var(--accent)' : 'var(--text-secondary)';
    document.getElementById('ptMfgLabel').style.borderColor = mfgColor;
    document.getElementById('ptMfgLabel').style.color = mfg ? '#2e7d32' : 'var(--text-secondary)';
    const hint = document.getElementById('ptHint');
    if (hint) hint.textContent = bo && mfg ? 'Both: can be purchased or manufactured depending on context.'
        : bo ? 'Bought-Out: purchased from supplier.'
        : 'Manufactured: made in-house — can be used in process routings.';
}

async function generatePart() {
    const subId = document.getElementById('genSubcategory').value;
    if (!subId) return;
    const opt = document.getElementById('genSubcategory').options[document.getElementById('genSubcategory').selectedIndex];
    const cols = JSON.parse(opt.dataset.cols || '[]');
    const values = {};
    cols.forEach(c => { const input = document.getElementById('gen_col_' + c.name); if (input && input.value.trim()) values[c.name] = input.value.trim(); });
    const is_bought_out = document.getElementById('ptBought')?.checked ?? true;
    const is_manufactured = document.getElementById('ptMfg')?.checked ?? false;
    document.getElementById('btnGenerate').disabled = true;
    try {
        const res = await fetch(API + '/generate', { method: 'POST', headers: HEADERS, body: JSON.stringify({ subcategory_id: subId, values, is_bought_out, is_manufactured }) });
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
            cols.forEach(c => { const input = document.getElementById('gen_col_' + c.name); if (input) input.value = ''; });
            loadGeneratedParts(subId);
        } else {
            if (res.status === 409 && data.data && data.data.existing_part) {
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
