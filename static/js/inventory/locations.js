// HIERARCHICAL LOCATIONS JS

async function loadLocations() {
    const tbody = document.getElementById('locationsBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/locations', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
            tbody.innerHTML = json.data.map(l => {
                const occ = l.capacity > 0 ? Math.round((l.current_occupancy / l.capacity) * 100) : 0;
                const barColor = occ >= 90 ? '#c62828' : occ >= 60 ? '#f57f17' : '#2e7d32';
                return `
                <tr style="cursor:pointer;" onclick="openLocationDetail('${l.id}', '${l.location_code}', '${l.bin_code}')">
                    <td><strong>${l.location_code}</strong></td>
                    <td>${l.plant}</td>
                    <td>${l.floor_name}</td>
                    <td>${l.shelf_name}</td>
                    <td>${l.row_name} / ${l.column_name}</td>
                    <td><span class="badge badge-info">${l.bin_code}</span></td>
                    <td>${l.warehouse_code}</td>
                    <td>
                        <div style="font-size:12px; margin-bottom:3px;">${l.current_occupancy} / ${l.capacity} units</div>
                        <div style="background:var(--border-color); border-radius:4px; height:6px; width:100px;">
                            <div style="background:${barColor}; width:${Math.min(occ,100)}%; height:6px; border-radius:4px;"></div>
                        </div>
                    </td>
                    <td><span class="badge ${l.is_active ? 'badge-success' : 'badge-danger'}">${l.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td onclick="event.stopPropagation()">
                        <button class="btn-action" title="View Location Detail" onclick="openLocationDetail('${l.id}', '${l.location_code}', '${l.bin_code}')">
                            <span class="material-icons-outlined">visibility</span>
                        </button>
                    </td>
                </tr>`;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No hierarchical storage locations created.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:red;">Error loading locations.</td></tr>';
    }
}

async function openLocationDetail(lid, locationCode, binCode) {
    openModal(`📍 ${locationCode} — Bin: ${binCode}`, `<div style="text-align:center; padding:20px; color:var(--text-muted);">Loading location data...</div>`);
    try {
        const res = await fetch(API + '/locations/' + lid + '/detail', { headers: HEADERS });
        const json = await res.json();
        if (!json.success) { document.getElementById('modalBody').innerHTML = `<p style="color:red;">${json.message}</p>`; return; }

        const { location: loc, current_stock, movements, checkins, summary } = json.data;

        const iqcBadge = s => {
            const map = { passed: 'badge-success', rejected: 'badge-danger', partial_pass: 'badge-warning', pending_iqc: 'badge-warning' };
            return `<span class="badge ${map[s] || 'badge-info'}">${s}</span>`;
        };
        const movBadge = (type, dir) => {
            const color = dir === 'IN' ? 'badge-success' : 'badge-danger';
            return `<span class="badge ${color}">${dir}</span> <span class="badge badge-info">${type}</span>`;
        };

        document.getElementById('modalBody').innerHTML = `
            <!-- LOCATION INFO -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; margin-bottom:18px;">
                <div class="stat-card" style="padding:12px;">
                    <span class="material-icons-outlined" style="font-size:22px; color:var(--accent);">inventory_2</span>
                    <div class="stat-info"><div class="value" style="font-size:18px;">${summary.total_parts}</div><div class="label">Part Types</div></div>
                </div>
                <div class="stat-card" style="padding:12px;">
                    <span class="material-icons-outlined" style="font-size:22px; color:var(--accent);">layers</span>
                    <div class="stat-info"><div class="value" style="font-size:18px;">${summary.total_qty}</div><div class="label">Total Units</div></div>
                </div>
                <div class="stat-card" style="padding:12px;">
                    <span class="material-icons-outlined" style="font-size:22px; color:var(--accent);">attach_money</span>
                    <div class="stat-info"><div class="value" style="font-size:18px;">₹${Number(summary.total_value).toLocaleString()}</div><div class="label">Stock Value</div></div>
                </div>
                <div class="stat-card" style="padding:12px;">
                    <span class="material-icons-outlined" style="font-size:22px; color:var(--accent);">swap_horiz</span>
                    <div class="stat-info"><div class="value" style="font-size:18px;">${summary.total_movements}</div><div class="label">Movements</div></div>
                </div>
                <div class="stat-card" style="padding:12px;">
                    <span class="material-icons-outlined" style="font-size:22px; color:var(--accent);">verified</span>
                    <div class="stat-info"><div class="value" style="font-size:18px;">${summary.total_checkins}</div><div class="label">Check-Ins</div></div>
                </div>
            </div>

            <!-- LOCATION PATH -->
            <div style="background:var(--bg-secondary); border-radius:8px; padding:10px 14px; font-size:12px; color:var(--text-muted); margin-bottom:18px;">
                <span class="material-icons-outlined" style="font-size:14px; vertical-align:middle;">place</span>
                <strong>${loc.plant}</strong> → ${loc.floor_name} → ${loc.shelf_name} → ${loc.row_name} / ${loc.column_name} →
                <strong style="color:var(--accent);">Bin: ${loc.bin_code}</strong> &nbsp;|&nbsp; Warehouse: <strong>${loc.warehouse_code}</strong>
                &nbsp;|&nbsp; Capacity: ${loc.capacity} units
            </div>

            <!-- TABS -->
            <div style="display:flex; gap:4px; margin-bottom:14px; border-bottom:1px solid var(--border-color);">
                <button class="loc-tab active" onclick="switchLocTab('stock')" id="tab-stock" style="padding:7px 14px; border:none; background:none; font-size:13px; font-weight:600; color:var(--accent); border-bottom:2px solid var(--accent); cursor:pointer;">
                    Current Stock (${current_stock.length})
                </button>
                <button class="loc-tab" onclick="switchLocTab('movements')" id="tab-movements" style="padding:7px 14px; border:none; background:none; font-size:13px; font-weight:500; color:var(--text-muted); cursor:pointer;">
                    Movement History (${movements.length})
                </button>
                <button class="loc-tab" onclick="switchLocTab('checkins')" id="tab-checkins" style="padding:7px 14px; border:none; background:none; font-size:13px; font-weight:500; color:var(--text-muted); cursor:pointer;">
                    Check-In History (${checkins.length})
                </button>
            </div>

            <!-- CURRENT STOCK TAB -->
            <div id="locTab-stock">
                ${current_stock.length === 0
                    ? '<p style="text-align:center; color:var(--text-muted); padding:20px;">No stock currently at this location.</p>'
                    : `<div class="table-responsive"><table class="data-table">
                        <thead><tr>
                            <th>Part Number</th><th>Description</th><th>Type</th>
                            <th>On Hand</th><th>Reserved</th><th>Available</th>
                            <th>Unit Cost</th><th>Total Value</th><th>Last Movement</th>
                        </tr></thead>
                        <tbody>${current_stock.map(s => `
                            <tr>
                                <td><strong>${s.part_number}</strong></td>
                                <td style="font-size:12px;">${s.part_description || '-'}</td>
                                <td><span class="badge badge-info">${s.item_type}</span></td>
                                <td><strong>${s.qty_on_hand} ${s.unit}</strong></td>
                                <td>${s.qty_reserved}</td>
                                <td><strong style="color:${s.qty_available <= 0 ? '#c62828' : 'var(--text-primary)'};">${s.qty_available}</strong></td>
                                <td>₹${s.unit_cost}</td>
                                <td><strong>₹${Number(s.total_value).toLocaleString()}</strong></td>
                                <td style="font-size:11px; color:var(--text-muted);">${s.last_movement_at}</td>
                            </tr>`).join('')}
                        </tbody></table></div>`
                }
            </div>

            <!-- MOVEMENT HISTORY TAB -->
            <div id="locTab-movements" style="display:none;">
                ${movements.length === 0
                    ? '<p style="text-align:center; color:var(--text-muted); padding:20px;">No stock movements recorded for this location.</p>'
                    : `<div class="table-responsive"><table class="data-table">
                        <thead><tr>
                            <th>Movement No</th><th>Direction</th><th>Part Number</th>
                            <th>Qty</th><th>From Bin</th><th>To Bin</th>
                            <th>Reference</th><th>Performed By</th><th>Date & Time</th>
                        </tr></thead>
                        <tbody>${movements.map(m => `
                            <tr>
                                <td><strong>${m.movement_no}</strong></td>
                                <td>${movBadge(m.movement_type, m.direction)}</td>
                                <td><strong>${m.part_number}</strong></td>
                                <td><strong style="color:${m.direction === 'IN' ? '#2e7d32' : '#c62828'};">${m.direction === 'IN' ? '+' : '-'}${m.qty} ${m.unit}</strong></td>
                                <td style="font-size:12px;">${m.from_bin} <span style="color:var(--text-muted);">(${m.from_wh})</span></td>
                                <td style="font-size:12px;">${m.to_bin} <span style="color:var(--text-muted);">(${m.to_wh})</span></td>
                                <td style="font-size:12px;">${m.reference_no}</td>
                                <td style="font-size:12px;">${m.performed_by}</td>
                                <td style="font-size:11px; color:var(--text-muted);">${m.created_at}</td>
                            </tr>`).join('')}
                        </tbody></table></div>`
                }
            </div>

            <!-- CHECK-IN HISTORY TAB -->
            <div id="locTab-checkins" style="display:none;">
                ${checkins.length === 0
                    ? '<p style="text-align:center; color:var(--text-muted); padding:20px;">No stock check-ins recorded for this bin.</p>'
                    : `<div class="table-responsive"><table class="data-table">
                        <thead><tr>
                            <th>Check-In No</th><th>PO Ref</th><th>Supplier</th>
                            <th>Part / RM Code</th><th>Received Qty</th>
                            <th>IQC Status</th><th>OK Qty</th><th>NG Qty</th>
                            <th>Checked In By</th><th>Date & Time</th>
                        </tr></thead>
                        <tbody>${checkins.map(c => `
                            <tr>
                                <td><strong>${c.checkin_no}</strong></td>
                                <td>${c.po_no}</td>
                                <td>${c.supplier_name}</td>
                                <td><span class="badge badge-info">${c.part_or_rm_code}</span></td>
                                <td><strong>${c.received_qty}</strong></td>
                                <td>${iqcBadge(c.iqc_status)}</td>
                                <td><strong style="color:#2e7d32;">${c.iqc_passed_qty}</strong></td>
                                <td><strong style="color:#c62828;">${c.iqc_rejected_qty}</strong></td>
                                <td style="font-size:12px;">${c.checked_in_by}</td>
                                <td style="font-size:11px; color:var(--text-muted);">${c.checkin_time}</td>
                            </tr>`).join('')}
                        </tbody></table></div>`
                }
            </div>
        `;
    } catch (e) {
        document.getElementById('modalBody').innerHTML = `<p style="color:red;">Error loading location detail: ${e.message}</p>`;
    }
}

function switchLocTab(tab) {
    ['stock', 'movements', 'checkins'].forEach(t => {
        const panel = document.getElementById('locTab-' + t);
        const btn = document.getElementById('tab-' + t);
        if (!panel || !btn) return;
        const active = t === tab;
        panel.style.display = active ? 'block' : 'none';
        btn.style.color = active ? 'var(--accent)' : 'var(--text-muted)';
        btn.style.fontWeight = active ? '600' : '500';
        btn.style.borderBottom = active ? '2px solid var(--accent)' : '2px solid transparent';
    });
}

function openNewLocationModal() {
    openModal('Create Physical Storage Location (Plant/Floor/Shelf/Bin)', `
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Plant *</label>
                <select id="locPlant">
                    <option value="Plant 1">Plant 1 (Main Assembly)</option>
                    <option value="Plant 2">Plant 2 (Casting & Machining)</option>
                    <option value="Plant 3">Plant 3 (Staging & Logistics)</option>
                </select>
            </div>
            <div class="form-group" style="flex:1;">
                <label>Floor *</label>
                <select id="locFloor">
                    <option value="Ground Floor">Ground Floor</option>
                    <option value="First Floor">First Floor</option>
                    <option value="Second Floor">Second Floor</option>
                </select>
            </div>
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Shelf *</label>
                <input type="text" id="locShelf" value="Shelf A1" placeholder="e.g. Shelf A1">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Row *</label>
                <input type="text" id="locRow" value="Row 01" placeholder="e.g. Row 01">
            </div>
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Column *</label>
                <input type="text" id="locCol" value="Col 01" placeholder="e.g. Col 01">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Bin Code *</label>
                <input type="text" id="locBin" value="RM-A-01" placeholder="e.g. RM-A-01">
            </div>
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Warehouse</label>
                <input type="text" id="locWh" value="MAIN">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Capacity (Units)</label>
                <input type="number" id="locCap" value="1000">
            </div>
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitLocation()">Save Location</button>
        </div>
    `);
}

async function submitLocation() {
    const payload = {
        plant: document.getElementById('locPlant').value,
        floor_name: document.getElementById('locFloor').value,
        shelf_name: document.getElementById('locShelf').value,
        row_name: document.getElementById('locRow').value,
        column_name: document.getElementById('locCol').value,
        bin_code: document.getElementById('locBin').value,
        warehouse_code: document.getElementById('locWh').value,
        capacity: parseFloat(document.getElementById('locCap').value || 1000)
    };
    try {
        const res = await fetch(API + '/locations', { method: 'POST', headers: HEADERS, body: JSON.stringify(payload) });
        const json = await res.json();
        if (json.success) { showToast(json.message); closeModal(); loadLocations(); }
        else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error creating location', 'error'); }
}
