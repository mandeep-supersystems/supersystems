// BATCH TRACKING JS
let _allBatches = [];

async function loadBatches() {
    const tbody = document.getElementById('batchesBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Loading...</td></tr>';
    try {
        const res = await fetch(`${API}/batches`, { headers: HEADERS });
        const json = await res.json();
        _allBatches = json.success ? json.data : [];
        _renderBatches(_allBatches);
    } catch (e) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:red;">Failed to load batches.</td></tr>';
    }
}

function filterBatches() {
    const q = (document.getElementById('batchSearch')?.value || '').toLowerCase();
    const filtered = q ? _allBatches.filter(b =>
        (b.batch_no || '').toLowerCase().includes(q) ||
        (b.parts || []).some(p => p.toLowerCase().includes(q)) ||
        (b.supplier_lot || '').toLowerCase().includes(q) ||
        (b.warehouse_code || '').toLowerCase().includes(q)
    ) : _allBatches;
    _renderBatches(filtered);
}

function _renderBatches(batches) {
    const tbody = document.getElementById('batchesBody');
    if (!tbody) return;
    if (!batches.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">No batches found.</td></tr>';
        return;
    }
    tbody.innerHTML = batches.map(b => {
        const usedPct = b.qty_received > 0 ? Math.round(((b.qty_received - b.qty_remaining) / b.qty_received) * 100) : 0;
        const fillColor = usedPct >= 100 ? '#c62828' : usedPct > 50 ? '#f57c00' : '#388e3c';
        const expiry = b.expiry_date ? _expiryBadge(b.expiry_date) : '<span style="color:var(--text-muted);">—</span>';
        const statusCls = b.status === 'active' ? 'badge-success' : b.status === 'consumed' ? 'badge-info' : 'badge-warning';
        const partsLabel = b.parts && b.parts.length > 1
            ? `<span title="${b.parts.join(', ')}" style="cursor:help;">${b.parts[0]} <span style="color:var(--text-muted);font-size:11px;">+${b.parts.length - 1} more</span></span>`
            : (b.parts && b.parts[0]) || '—';
        return `
        <tr style="cursor:pointer;" onclick="openBatchPanel('${b.batch_no}')">
            <td><strong style="color:var(--accent);">${b.batch_no}</strong></td>
            <td style="font-size:12px;">${partsLabel}</td>
            <td style="color:var(--text-muted);font-size:12px;">${b.supplier_lot || '—'}</td>
            <td style="font-size:12px;">${b.manufacture_date || '—'}</td>
            <td>${expiry}</td>
            <td>
                <div style="display:flex;align-items:center;gap:8px;">
                    <div style="flex:1;height:5px;background:var(--border-color);border-radius:3px;min-width:60px;">
                        <div style="height:100%;width:${Math.min(usedPct,100)}%;background:${fillColor};border-radius:3px;"></div>
                    </div>
                    <span style="font-size:12px;white-space:nowrap;">${b.qty_remaining} / ${b.qty_received}</span>
                </div>
            </td>
            <td style="font-size:12px;">${b.warehouse_code || '—'}</td>
            <td><span class="badge ${statusCls}">${b.status}</span></td>
        </tr>`;
    }).join('');
}

function _expiryBadge(dateStr) {
    if (!dateStr) return '—';
    const exp = new Date(dateStr);
    const days = Math.ceil((exp - new Date()) / 86400000);
    if (days < 0) return `<span class="badge badge-danger" style="background:#c62828;color:#fff;">Expired</span>`;
    if (days <= 30) return `<span class="badge" style="background:#f57c00;color:#fff;">${dateStr} (${days}d)</span>`;
    return `<span style="font-size:12px;">${dateStr}</span>`;
}

// ─── BATCH DETAIL SLIDE-OVER PANEL ───
async function openBatchPanel(batchNo) {
    const panel = document.getElementById('batchDetailPanel');
    const overlay = document.getElementById('batchPanelOverlay');
    const content = document.getElementById('batchPanelContent');

    content.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted);">
        <span class="material-icons-outlined" style="font-size:36px;animation:spin 1s linear infinite;">refresh</span>
        <div style="margin-top:8px;">Loading batch details...</div></div>`;
    panel.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    try {
        const res = await fetch(`${API}/batches/${encodeURIComponent(batchNo)}/detail`, { headers: HEADERS });
        const json = await res.json();
        if (!json.success) { content.innerHTML = `<div style="padding:40px;text-align:center;color:red;">${json.message}</div>`; return; }
        _renderBatchPanel(json.data);
    } catch (e) {
        content.innerHTML = '<div style="padding:40px;text-align:center;color:red;">Error loading batch details.</div>';
    }
}

function closeBatchPanel() {
    document.getElementById('batchDetailPanel').classList.remove('active');
    document.getElementById('batchPanelOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

function _renderBatchPanel(d) {
    const b = d.batch;
    const usedQty = b.qty_received - b.qty_remaining;
    const usedPct = b.qty_received > 0 ? Math.round((usedQty / b.qty_received) * 100) : 0;
    const fillColor = usedPct >= 100 ? '#c62828' : usedPct > 50 ? '#f57c00' : '#388e3c';
    const statusCls = b.status === 'active' ? 'badge-success' : b.status === 'consumed' ? 'badge-info' : 'badge-warning';

    // PARTS IN THIS BATCH
    const partsHtml = d.parts && d.parts.length
        ? `<div style="display:flex;flex-direction:column;gap:8px;">` +
          d.parts.map(p => {
              const pUsed = p.qty_received > 0 ? Math.round(((p.qty_received - p.qty_remaining) / p.qty_received) * 100) : 0;
              const pColor = pUsed >= 100 ? '#c62828' : pUsed > 50 ? '#f57c00' : '#388e3c';
              return `
              <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:12px 14px;">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                      <div>
                          <div style="font-size:13px;font-weight:700;color:var(--accent);">${p.part_number}</div>
                          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                              ${p.warehouse_code ? 'WH: ' + p.warehouse_code : ''}${p.bin_code ? ' · Bin: ' + p.bin_code : ''}
                          </div>
                      </div>
                      <div style="text-align:right;">
                          <div style="font-size:13px;font-weight:700;">${p.qty_remaining} <span style="font-size:11px;font-weight:400;color:var(--text-muted);">/ ${p.qty_received} received</span></div>
                          <div style="font-size:11px;color:${pColor};margin-top:2px;">${pUsed}% consumed</div>
                      </div>
                  </div>
                  <div style="height:4px;background:var(--border-color);border-radius:2px;overflow:hidden;">
                      <div style="height:100%;width:${Math.min(pUsed,100)}%;background:${pColor};border-radius:2px;"></div>
                  </div>
              </div>`;
          }).join('') + `</div>`
        : '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:13px;">No parts found</div>';

    // WHERE IS IT — stock locations
    const stockHtml = d.stock && d.stock.length
        ? d.stock.map(s => `
            <div class="bin-panel-stock-row">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="material-icons-outlined" style="font-size:16px;color:var(--accent);">location_on</span>
                    <div>
                        <div style="font-size:12px;font-weight:600;color:var(--accent);">${s.part_number}</div>
                        <div style="font-size:12px;">${s.warehouse_code}${s.bin_code ? ' › ' + s.bin_code : ''}${s.location_code ? ' › ' + s.location_code : ''}</div>
                        <div style="font-size:11px;color:var(--text-muted);">Available: ${s.qty_available} ${s.unit}</div>
                    </div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:700;font-size:15px;color:var(--accent);">${s.qty_on_hand}</div>
                    <div style="font-size:11px;color:var(--text-muted);">${s.unit} on hand</div>
                </div>
            </div>`).join('')
        : '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:13px;">No current stock found</div>';

    // WHERE USED — movements
    const movHtml = d.movements && d.movements.length
        ? d.movements.map(m => {
            const isIn = ['RECEIPT','GRN_HANDOVER','ADJUSTMENT_POS','RETURN'].includes(m.movement_type);
            const icon = isIn ? 'arrow_downward' : 'arrow_upward';
            const color = isIn ? '#388e3c' : '#c62828';
            const route = isIn
                ? `${m.to_warehouse || '—'} › ${m.to_bin || '—'}`
                : `${m.from_warehouse || '—'} › ${m.from_bin || '—'}`;
            return `
            <div class="bin-panel-mov-row">
                <span class="material-icons-outlined" style="font-size:16px;color:${color};flex-shrink:0;">${icon}</span>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:12px;font-weight:600;">${m.movement_type} <span style="color:var(--text-muted);font-weight:400;">· ${m.part_number}</span></div>
                    <div style="font-size:11px;color:var(--text-muted);">${route} · ${m.reference_no} · ${m.performed_by}</div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                    <div style="font-weight:700;font-size:13px;color:${color};">${isIn ? '+' : '-'}${m.qty} <small style="font-weight:400;">${m.unit}</small></div>
                    <div style="font-size:10px;color:var(--text-muted);">${m.created_at ? m.created_at.slice(0,16) : ''}</div>
                </div>
            </div>`;
        }).join('')
        : '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:13px;">No movements recorded</div>';

    // GRN SOURCE
    const grnHtml = d.grn_source && d.grn_source.length
        ? d.grn_source.map(g => `
            <div class="bin-panel-mov-row">
                <span class="material-icons-outlined" style="font-size:16px;color:var(--accent);flex-shrink:0;">receipt_long</span>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:12px;font-weight:600;">${g.grn_number}</div>
                    <div style="font-size:11px;color:var(--text-muted);">PO: ${g.po_number} · ${g.supplier_name}</div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                    <span class="badge badge-info" style="font-size:10px;">${g.status}</span>
                    <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${g.received_date ? g.received_date.slice(0,10) : ''}</div>
                </div>
            </div>`).join('')
        : '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:13px;">No GRN source found</div>';

    document.getElementById('batchPanelContent').innerHTML = `
    <div class="bin-panel-inner">

        <!-- HEADER -->
        <div class="bin-panel-header">
            <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:44px;height:44px;border-radius:10px;background:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <span class="material-icons-outlined" style="color:#fff;font-size:22px;">qr_code_2</span>
                </div>
                <div>
                    <div style="font-size:18px;font-weight:700;">${b.batch_no}</div>
                    <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
                        ${b.parts_count} part${b.parts_count !== 1 ? 's' : ''}${b.supplier_lot ? ' · Lot: ' + b.supplier_lot : ''}
                        ${b.warehouse_code ? ' · ' + b.warehouse_code : ''}
                    </div>
                </div>
            </div>
            <span class="badge ${statusCls}" style="font-size:12px;">${b.status}</span>
        </div>

        <!-- INFO GRID -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
            <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:10px 14px;">
                <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;">Manufacture Date</div>
                <div style="font-weight:600;margin-top:3px;">${b.manufacture_date || '—'}</div>
            </div>
            <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:10px 14px;">
                <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;">Expiry Date</div>
                <div style="font-weight:600;margin-top:3px;">${b.expiry_date ? _expiryBadge(b.expiry_date) : '—'}</div>
            </div>
            <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:10px 14px;">
                <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;">Total Received</div>
                <div style="font-weight:700;font-size:18px;margin-top:3px;">${b.qty_received}</div>
            </div>
            <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:10px 14px;">
                <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;">Total Remaining</div>
                <div style="font-weight:700;font-size:18px;margin-top:3px;color:${fillColor};">${b.qty_remaining}</div>
            </div>
        </div>

        <!-- USAGE BAR -->
        <div style="margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:4px;">
                <span>Consumed</span>
                <span style="color:${fillColor};font-weight:600;">${usedPct}% used (${usedQty} units)</span>
            </div>
            <div style="height:8px;background:var(--border-color);border-radius:4px;overflow:hidden;">
                <div style="height:100%;width:${Math.min(usedPct,100)}%;background:${fillColor};border-radius:4px;transition:width .4s;"></div>
            </div>
        </div>

        <!-- TABS -->
        <div class="bin-panel-tabs">
            <button class="bin-tab active" onclick="switchBatchTab('parts')">Parts (${d.parts.length})</button>
            <button class="bin-tab" onclick="switchBatchTab('location')">Where Is It</button>
            <button class="bin-tab" onclick="switchBatchTab('movements')">Movements</button>
            <button class="bin-tab" onclick="switchBatchTab('source')">GRN Source</button>
        </div>

        <div id="batchTabParts" class="bin-tab-content active">${partsHtml}</div>
        <div id="batchTabLocation" class="bin-tab-content">${stockHtml}</div>
        <div id="batchTabMovements" class="bin-tab-content">${movHtml}</div>
        <div id="batchTabSource" class="bin-tab-content">${grnHtml}</div>

    </div>`;
}

function switchBatchTab(tab) {
    document.querySelectorAll('#batchDetailPanel .bin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#batchDetailPanel .bin-tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector(`#batchDetailPanel .bin-tab[onclick*="'${tab}'"]`).classList.add('active');
    document.getElementById(`batchTab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active');
}

async function openNewBatchModal() {
    openModal('Create Batch', `
        <div class="form-group"><label>Batch No *</label><input type="text" id="batchNo" placeholder="e.g. BAT-2026-001"></div>
        <div class="form-group"><label>Part Number *</label><input type="text" id="batchPartCode" placeholder="e.g. 101.7.0001"></div>
        <div class="form-group"><label>Supplier Lot</label><input type="text" id="batchSupplierLot" placeholder="Supplier's lot reference"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group"><label>Manufacture Date</label><input type="date" id="batchMfgDate"></div>
            <div class="form-group"><label>Expiry Date</label><input type="date" id="batchExpiryDate"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group"><label>Qty Received</label><input type="number" id="batchQtyRec" min="0" value="0"></div>
            <div class="form-group"><label>Warehouse</label><input type="text" id="batchWh" placeholder="e.g. MAIN"></div>
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitBatch()">Create Batch</button>
        </div>
    `);
}

async function submitBatch() {
    const payload = {
        batch_no: document.getElementById('batchNo').value.trim(),
        part_number: document.getElementById('batchPartCode').value.trim(),
        supplier_lot: document.getElementById('batchSupplierLot').value.trim(),
        manufacture_date: document.getElementById('batchMfgDate').value || null,
        expiry_date: document.getElementById('batchExpiryDate').value || null,
        qty_received: parseFloat(document.getElementById('batchQtyRec').value) || 0,
        warehouse_code: document.getElementById('batchWh').value.trim() || 'MAIN'
    };
    if (!payload.batch_no || !payload.part_number) { showToast('Batch No and Part Number required', 'error'); return; }
    try {
        const res = await fetch('/api/v1/inventory/batches', { method: 'POST', headers: HEADERS, body: JSON.stringify(payload) });
        const json = await res.json();
        if (json.success) { showToast(json.message); closeModal(); loadBatches(); }
        else showToast(json.message || 'Failed', 'error');
    } catch (e) { showToast('Error creating batch', 'error'); }
}
