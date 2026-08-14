// ─── LOGISTICS HANDOVER JS ───

// ── Handover list ──────────────────────────────────────────────────────────────
async function loadHandoverGrns() {
    const container = document.getElementById('handoverListContainer');
    container.innerHTML = '<div class="empty-state"><span class="material-icons-outlined">move_to_inbox</span>Loading...</div>';
    try {
        const res  = await fetch(API + '/grn', { headers: HEADERS });
        const json = await res.json();
        const grns = (json.data || []).filter(g =>
            g.grn_status === 'pending_iqc' || g.grn_status === 'partially_handed_over'
        );
        if (!grns.length) {
            container.innerHTML = '<div class="empty-state"><span class="material-icons-outlined">check_circle</span>No GRNs pending handover.</div>';
            return;
        }
        const rows = grns.map(g => {
            const partText = g.lines && g.lines.length
                ? `<code>${g.lines[0].item_code}</code>${g.lines.length > 1 ? ` <span style="color:var(--text-muted);font-size:11px;">(+${g.lines.length - 1} more)</span>` : ''}`
                : `<code>${g.item_code}</code>`;
            return `
            <tr>
                <td><strong style="color:var(--primary-color);">${g.grn_no}</strong></td>
                <td><code>${g.po_no || g.po_id}</code></td>
                <td>${g.supplier_name}</td>
                <td>${partText}</td>
                <td style="font-weight:600;text-align:right;">${g.received_qty}</td>
                <td>${statusBadge(g.grn_status)}</td>
                <td>${g.discrepancy_notes
                    ? `<span class="discrepancy-badge">⚠ ${g.discrepancy_notes}</span>`
                    : '<span class="ok-badge">✓ OK</span>'}</td>
                <td>
                    <button class="btn-primary" style="font-size:12px;padding:5px 14px;display:inline-flex;align-items:center;gap:4px;"
                        onclick="openHandoverFromGrn('${g.id}','${g.grn_no}')">
                        <span class="material-icons-outlined" style="font-size:14px;">move_to_inbox</span> Assign & Handover
                    </button>
                </td>
            </tr>`;
        }).join('');
        container.innerHTML = `
            <div class="card">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>GRN No</th><th>PO Ref</th><th>Supplier</th>
                                <th>Part(s)</th><th style="text-align:right;">Rec. Qty</th>
                                <th>Status</th><th>Discrepancy</th><th>Action</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
    } catch (e) {
        container.innerHTML = '<div class="empty-state" style="color:red;">Error loading handover list.</div>';
    }
}

// ── State ──────────────────────────────────────────────────────────────────────
let _hoGrnId      = '';
let _hoGrnNo      = '';
let _hoLines      = [];
let _hoLocations  = [];
let _hoBins       = [];
let _hoAssignments = [];

// ── Open modal ─────────────────────────────────────────────────────────────────
async function openHandoverFromGrn(grnId, grnNo) {
    const modal = document.getElementById('handoverModal');
    const body  = document.getElementById('handoverModalBody');
    document.getElementById('handoverModalTitle').textContent = `Handover: ${grnNo}`;
    body.innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--text-muted);">
            <span class="material-icons-outlined" style="font-size:36px;display:block;margin-bottom:8px;animation:spin 1s linear infinite;">sync</span>
            Loading locations &amp; bins…
        </div>`;
    modal.classList.add('active');

    _hoGrnId       = grnId;
    _hoGrnNo       = grnNo;
    _hoAssignments = [];

    try {
        const [locRes, binRes, grnRes] = await Promise.all([
            fetch(INV_API + '/locations', { headers: HEADERS }),
            fetch(WH_API  + '/bins',      { headers: HEADERS }),
            fetch(API     + '/grn/' + grnId, { headers: HEADERS })
        ]);
        _hoLocations = (await locRes.json()).data || [];
        _hoBins      = (await binRes.json()).data  || [];

        const grnData = (await grnRes.json()).data;
        _hoLines = grnData.lines || [];
        if (!_hoLines.length) {
            _hoLines = [{
                item_code: grnData.item_code,
                item_description: grnData.item_description,
                received_qty: grnData.received_qty,
                handed_over_qty: 0,
                assignments: []
            }];
        }
        _hoLines.forEach(l => {
            if (l.handed_over_qty === undefined) l.handed_over_qty = 0;
            if (!l.assignments) l.assignments = [];
        });
        renderHandoverBuilder();
    } catch (e) {
        body.innerHTML = '<div class="empty-state" style="color:red;">Error loading handover details.</div>';
    }
}

// ── Render builder ─────────────────────────────────────────────────────────────
function renderHandoverBuilder() {
    const body = document.getElementById('handoverModalBody');
    if (!body) return;

    const cardsHtml = _hoLines.map((line, idx) => {
        const remaining   = line.received_qty - line.handed_over_qty;
        const stagedQty   = _hoAssignments.filter(a => a.item_code === line.item_code).reduce((s, a) => s + a.qty, 0);
        const isCompleted = remaining <= 0;

        // Saved placements (from DB)
        const savedHtml = (line.assignments || []).map(a => `
            <div class="ho-saved-row">
                <span>
                    <span class="material-icons-outlined" style="font-size:13px;vertical-align:middle;color:var(--accent);">place</span>
                    <strong>${a.qty}</strong> units &rarr; ${a.location_code || 'Direct'}${a.bin_code ? ` / Bin: <code>${a.bin_code}</code>` : ''}
                </span>
                <span style="color:var(--accent);font-weight:600;font-size:11px;">✓ Saved</span>
            </div>`).join('');

        // Staged placements (this session)
        const pendingForItem = _hoAssignments.filter(a => a.item_code === line.item_code);
        const stagedHtml = pendingForItem.map((a, ai) => `
            <div class="ho-staged-row">
                <span>
                    <span class="material-icons-outlined" style="font-size:13px;vertical-align:middle;color:var(--text-secondary);">pending</span>
                    <strong>${a.qty}</strong> units &rarr; ${a.location_code || 'Direct'}${a.bin_code ? ` / Bin: <code>${a.bin_code}</code>` : ''}
                    <span style="font-size:10px;color:var(--text-muted);margin-left:4px;">(staged)</span>
                </span>
                <button onclick="removeHoAssignment('${line.item_code}',${ai})"
                    style="background:none;border:none;color:var(--coming-soon-text);cursor:pointer;display:flex;align-items:center;padding:0;">
                    <span class="material-icons-outlined" style="font-size:16px;">delete</span>
                </button>
            </div>`).join('');

        // Stage-placement form
        const stageForm = isCompleted ? '' : `
            <div class="ho-stage-box">
                <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                    <span class="material-icons-outlined" style="font-size:16px;">add_location_alt</span>
                    Add Storage Placement
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
                    <div>
                        <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#0277bd;display:block;margin-bottom:4px;">Location *</label>
                        ${_comboHtml(`hoLoc-${idx}`, 'Search location…', false)}
                    </div>
                    <div>
                        <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#0277bd;display:block;margin-bottom:4px;">Bin <span style="font-weight:400;font-style:italic;">(optional)</span></label>
                        ${_comboHtml(`hoBin-${idx}`, 'Search bin…', true)}
                    </div>
                </div>
                <div style="display:flex;gap:10px;align-items:flex-end;">
                    <div style="flex:1;">
                        <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#0277bd;display:block;margin-bottom:4px;">
                            Qty to Place <span style="font-weight:400;">(Remaining: <strong>${remaining - stagedQty}</strong>)</span>
                        </label>
                        <input type="number" id="hoQty-${idx}" value="${remaining - stagedQty}"
                            min="1" max="${remaining - stagedQty}"
                            style="padding:8px 10px;font-size:13px;border:1px solid #81d4fa;border-radius:6px;width:100%;box-sizing:border-box;">
                    </div>
                    <div style="width:100px;">
                        <label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#0277bd;display:block;margin-bottom:4px;">Warehouse</label>
                        <input type="text" id="hoWh-${idx}" value="MAIN"
                            style="padding:8px 10px;font-size:13px;border:1px solid #81d4fa;border-radius:6px;width:100%;box-sizing:border-box;">
                    </div>
                    <button class="btn-primary" onclick="stageHoAssignment(${idx})"
                        style="height:38px;padding:0 18px;font-size:13px;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;">
                        <span class="material-icons-outlined" style="font-size:16px;">add_circle</span> Stage
                    </button>
                </div>
            </div>`;

        return `
            <div class="ho-item-card${isCompleted ? ' done' : ''}">
                <div class="ho-item-header">
                    <div>
                        <code style="font-size:13px;font-weight:700;color:var(--primary-color);">${line.item_code}</code>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${line.item_description || ''}</div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <span class="ho-pill received">
                            <span class="material-icons-outlined" style="font-size:12px;">inventory_2</span>
                            Received: ${line.received_qty}
                        </span>
                        ${isCompleted
                            ? '<span class="ho-pill done"><span class="material-icons-outlined" style="font-size:12px;">check_circle</span> Complete</span>'
                            : `<span class="ho-pill pending"><span class="material-icons-outlined" style="font-size:12px;">pending</span> Pending: ${remaining - stagedQty}</span>`}
                    </div>
                </div>
                <div class="ho-item-body">
                    ${savedHtml  ? `<div style="margin-bottom:8px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;">Saved Placements</div>${savedHtml}</div>` : ''}
                    ${stagedHtml ? `<div style="margin-bottom:8px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#1565c0;margin-bottom:4px;">Staged (pending confirm)</div>${stagedHtml}</div>` : ''}
                    ${stageForm}
                </div>
            </div>`;
    }).join('');

    body.innerHTML = `
        <div class="ho-info-banner">
            <span class="material-icons-outlined" style="font-size:18px;">info</span>
            Split quantities across multiple locations/bins. Bin is optional for direct-to-location storage.
        </div>
        <div style="max-height:420px;overflow-y:auto;padding-right:2px;">${cardsHtml}</div>
        <div style="margin-top:14px;">
            <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px;">Handover Notes (Optional)</label>
            <textarea id="hoNotes" rows="2" placeholder="Notes for inventory team…"
                style="width:100%;box-sizing:border-box;padding:8px 10px;font-size:13px;border:1px solid var(--border-color);border-radius:6px;resize:vertical;"></textarea>
        </div>
        <div class="form-actions" style="margin-top:16px;border-top:1px solid var(--border-color);padding-top:14px;">
            <button class="btn-outline" onclick="closeHandoverModal()">Cancel</button>
            <button class="btn-primary" onclick="submitHandover()" style="display:inline-flex;align-items:center;gap:6px;">
                <span class="material-icons-outlined" style="font-size:16px;">check_circle</span> Confirm Handover &amp; Notify IQC
            </button>
        </div>`;

    // Attach combobox behaviour after DOM is ready
    _hoLines.forEach((line, idx) => {
        if (line.received_qty - line.handed_over_qty > 0) {
            _initCombo(`hoLoc-${idx}`, _hoLocations, l =>
                ({ id: l.id, label: l.location_code, sub: `${l.plant} / ${l.floor_name} / ${l.shelf_name}`, wh: l.warehouse_code || 'MAIN', bin: l.bin_code || '' })
            );
            _initCombo(`hoBin-${idx}`, _hoBins, b =>
                ({ id: b.bin_code, label: b.bin_code, sub: b.warehouse_code || 'MAIN', wh: b.warehouse_code || 'MAIN', bin: '' }),
                true
            );
        }
    });
}

// ── Combobox helpers ───────────────────────────────────────────────────────────
function _comboHtml(id, placeholder, optional) {
    return `
        <div class="ho-combo" id="combo-wrap-${id}">
            <input type="text" class="ho-combo-input" id="combo-input-${id}"
                placeholder="${placeholder}" autocomplete="off"
                oninput="_comboFilter('${id}')" onfocus="_comboOpen('${id}')"
                onblur="_comboBlur('${id}')">
            <span class="material-icons-outlined ho-combo-arrow">expand_more</span>
            <div class="ho-combo-dropdown" id="combo-drop-${id}"></div>
            <input type="hidden" id="combo-val-${id}">
            <input type="hidden" id="combo-wh-${id}" value="MAIN">
            <input type="text" class="ho-manual-input" id="combo-manual-${id}"
                placeholder="Type code manually…">
        </div>`;
}

// items: raw array, mapper: item → { id, label, sub, wh, bin }
function _initCombo(id, items, mapper, optional = false) {
    const input = document.getElementById(`combo-input-${id}`);
    const drop  = document.getElementById(`combo-drop-${id}`);
    if (!input || !drop) return;

    input._items  = items;
    input._mapper = mapper;
    input._optional = optional;

    _comboRenderDrop(id, items.map(mapper), '');
}

function _comboRenderDrop(id, mapped, query) {
    const drop = document.getElementById(`combo-drop-${id}`);
    if (!drop) return;
    const q = query.toLowerCase().trim();
    const filtered = q
        ? mapped.filter(m => (m.label + ' ' + m.sub).toLowerCase().includes(q))
        : mapped;

    let html = filtered.slice(0, 80).map(m => `
        <div class="ho-combo-item" data-id="${m.id}" data-wh="${m.wh}" data-bin="${m.bin}"
            onmousedown="_comboSelect('${id}','${m.id}','${m.label.replace(/'/g,"\\'")}','${m.wh}','${m.bin}')">
            <span class="ci-main">${m.label}</span>
            <span class="ci-sub">${m.sub}</span>
        </div>`).join('');
    html += `<div class="ho-combo-item manual" onmousedown="_comboManual('${id}')">
        <span class="material-icons-outlined" style="font-size:13px;vertical-align:middle;">edit</span>
        Enter manually…
    </div>`;
    drop.innerHTML = html;
}

function _comboFilter(id) {
    const input = document.getElementById(`combo-input-${id}`);
    if (!input || !input._items) return;
    const mapped = input._items.map(input._mapper);
    _comboRenderDrop(id, mapped, input.value);
    _comboOpen(id);
    // Clear hidden value when user types
    document.getElementById(`combo-val-${id}`).value = '';
    document.getElementById(`combo-manual-${id}`).classList.remove('visible');
}

function _comboOpen(id) {
    document.getElementById(`combo-drop-${id}`)?.classList.add('open');
}

function _comboBlur(id) {
    // Delay so mousedown on item fires first
    setTimeout(() => document.getElementById(`combo-drop-${id}`)?.classList.remove('open'), 180);
}

function _comboSelect(id, val, label, wh, bin) {
    document.getElementById(`combo-input-${id}`).value  = label;
    document.getElementById(`combo-val-${id}`).value    = val;
    document.getElementById(`combo-wh-${id}`).value     = wh;
    document.getElementById(`combo-drop-${id}`).classList.remove('open');
    document.getElementById(`combo-manual-${id}`).classList.remove('visible');

    // If location selected, auto-fill warehouse on the row
    const idxMatch = id.match(/hoLoc-(\d+)/);
    if (idxMatch) {
        const whInput = document.getElementById(`hoWh-${idxMatch[1]}`);
        if (whInput && wh) whInput.value = wh;
    }
}

function _comboManual(id) {
    document.getElementById(`combo-input-${id}`).value = '';
    document.getElementById(`combo-val-${id}`).value   = '__manual__';
    document.getElementById(`combo-drop-${id}`).classList.remove('open');
    document.getElementById(`combo-manual-${id}`).classList.add('visible');
    document.getElementById(`combo-manual-${id}`).focus();
}

// ── Stage / remove assignment ──────────────────────────────────────────────────
function stageHoAssignment(idx) {
    const line     = _hoLines[idx];
    const remaining = line.received_qty - line.handed_over_qty;
    const stagedQty = _hoAssignments.filter(a => a.item_code === line.item_code).reduce((s, a) => s + a.qty, 0);
    const qty       = parseFloat(document.getElementById(`hoQty-${idx}`).value || 0);
    const wh        = (document.getElementById(`hoWh-${idx}`).value || 'MAIN').trim();

    if (qty <= 0) { showToast('Quantity must be greater than 0', 'error'); return; }
    if (stagedQty + qty > remaining) {
        showToast(`Exceeds remaining qty (${remaining - stagedQty} left)`, 'error'); return;
    }

    // Location
    const locVal    = document.getElementById(`combo-val-hoLoc-${idx}`).value.trim();
    const locInput  = document.getElementById(`combo-input-hoLoc-${idx}`).value.trim();
    const locManual = document.getElementById(`combo-manual-hoLoc-${idx}`).value.trim();

    let locId   = null;
    let locCode = '';
    if (locVal === '__manual__') {
        locCode = locManual;
        if (!locCode) { showToast('Enter a location code', 'error'); return; }
    } else if (locVal) {
        locId   = locVal;
        locCode = locInput;
    } else {
        showToast('Select a location', 'error'); return;
    }

    // Bin (optional)
    const binVal    = document.getElementById(`combo-val-hoBin-${idx}`).value.trim();
    const binInput  = document.getElementById(`combo-input-hoBin-${idx}`).value.trim();
    const binManual = document.getElementById(`combo-manual-hoBin-${idx}`).value.trim();

    let binCode = '';
    if (binVal === '__manual__') {
        binCode = binManual;
    } else if (binVal) {
        binCode = binInput;
    }

    _hoAssignments.push({ item_code: line.item_code, qty, location_id: locId, location_code: locCode, bin_code: binCode, warehouse_code: wh });
    renderHandoverBuilder();
}

function removeHoAssignment(itemCode, assIdx) {
    let counter = 0;
    _hoAssignments = _hoAssignments.filter(a => {
        if (a.item_code !== itemCode) return true;
        return counter++ !== assIdx;
    });
    renderHandoverBuilder();
}

// ── Submit ─────────────────────────────────────────────────────────────────────
async function submitHandover() {
    if (!_hoAssignments.length) {
        showToast('Stage at least one placement before confirming', 'error'); return;
    }
    const notes = document.getElementById('hoNotes').value.trim();
    try {
        const res  = await fetch(API + '/grn/' + _hoGrnId + '/handover', {
            method: 'POST', headers: HEADERS,
            body: JSON.stringify({ assignments: _hoAssignments, notes })
        });
        const json = await res.json();
        if (json.success) {
            showToast(json.message || 'Handover registered successfully.');
            closeHandoverModal();
            loadHandoverGrns();
            loadLgOverview();
        } else {
            showToast(json.message || 'Handover failed', 'error');
        }
    } catch (e) {
        showToast('Error submitting handover', 'error');
    }
}
