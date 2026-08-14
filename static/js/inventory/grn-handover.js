// ─── INVENTORY GRN HANDOVER JS ───
const LG_API = '/api/v1/logistics';

async function loadGrnHandovers() {
    const tbody = document.getElementById('grnHandoverBody');
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;">Loading...</td></tr>';
    try {
        const res = await fetch(LG_API + '/grn?status=handed_over', { headers: HEADERS });
        const json = await res.json();
        if (!json.success || !json.data.length) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text-muted);">No GRNs handed over yet.</td></tr>';
            // Update badge
            const badge = document.getElementById('invGrnBadge');
            if (badge) badge.style.display = 'none';
            return;
        }

        // Update badge
        const badge = document.getElementById('invGrnBadge');
        if (badge) { badge.textContent = json.data.length; badge.style.display = 'inline'; }

        tbody.innerHTML = json.data.map(g => `
            <tr>
                <td><strong>${g.grn_no}</strong></td>
                <td>${g.po_no || g.po_id || '—'}</td>
                <td>${g.supplier_name || '—'}</td>
                <td>
                    <a href="/inventory/stock-level-by-part?part=${encodeURIComponent(g.item_code)}"
                       style="color:#1976d2;font-weight:600;text-decoration:none;"
                       onclick="event.preventDefault();viewPartStock('${g.item_code}')">
                        <code>${g.item_code}</code>
                    </a>
                </td>
                <td><strong>${g.batch_no || '—'}</strong></td>
                <td>${g.received_qty}</td>
                <td><code>${g.assigned_bin_code || '—'}</code></td>
                <td>${g.handover_warehouse || '—'}</td>
                <td>${g.handover_by || g.created_by || '—'}</td>
                <td><span style="background:#fff3e0;color:#e65100;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;">Pending IQC</span></td>
                <td>
                    <button class="btn-outline" style="font-size:12px;padding:3px 10px;"
                        onclick="viewPartStock('${g.item_code}')">
                        <span class="material-icons-outlined" style="font-size:13px;">bar_chart</span> Stock
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:red;">Error loading GRN handovers.</td></tr>';
    }
}

async function viewPartStock(partCode) {
    // Load stock levels for this part and show in modal
    try {
        const res = await fetch(API + '/stock-levels?search=' + encodeURIComponent(partCode), { headers: HEADERS });
        const json = await res.json();
        const rows = (json.data || []).filter(s => s.part_number === partCode);

        const html = rows.length ? `
            <div style="margin-bottom:12px;font-size:13px;color:var(--text-muted);">
                Stock levels for <strong>${partCode}</strong> across all locations:
            </div>
            <table class="data-table" style="width:100%;">
                <thead>
                    <tr>
                        <th>Warehouse</th><th>Bin</th><th>On Hand</th>
                        <th>Reserved</th><th>Available</th><th>Unit Cost</th><th>Total Value</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(s => `
                    <tr>
                        <td>${s.warehouse_code || '—'}</td>
                        <td><code>${s.bin_code || '—'}</code></td>
                        <td><strong>${s.qty_on_hand}</strong></td>
                        <td>${s.qty_reserved}</td>
                        <td style="color:${s.qty_available > 0 ? '#2e7d32' : '#c62828'};font-weight:600;">${s.qty_available}</td>
                        <td>₹${s.unit_cost.toLocaleString()}</td>
                        <td>₹${s.total_value.toLocaleString()}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
            <div style="margin-top:14px;display:flex;gap:10px;">
                <button class="btn-primary" onclick="showSection('stocklevels')">
                    <span class="material-icons-outlined" style="font-size:14px;">open_in_new</span> View All Stock Levels
                </button>
            </div>
        ` : `<p style="color:var(--text-muted);">No stock records found for <strong>${partCode}</strong>.</p>`;

        openModal(`Stock Levels — ${partCode}`, html);
    } catch (e) {
        openModal(`Stock Levels — ${partCode}`, '<p style="color:red;">Error loading stock data.</p>');
    }
}
