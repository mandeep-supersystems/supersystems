// ─── WAREHOUSE GRN JS ───
async function loadGrns() {
    const tbody = document.getElementById('grnBody');
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;">Loading...</td></tr>';
    try {
        const res = await fetch('/api/v1/logistics/grn', { headers: HEADERS });
        const data = await res.json();
        const rows = data.grns || data.data || [];
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:var(--text-muted);">No GRNs found.</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map(g => `
            <tr>
                <td>${esc(g.grn_number || g.id)}</td>
                <td>${esc(g.po_number || g.po_ref || '-')}</td>
                <td>${esc(g.supplier_name || '-')}</td>
                <td>${esc(g.part_code || '-')}</td>
                <td>${esc(g.batch_no || '-')}</td>
                <td>${esc(g.invoice_number || '-')}</td>
                <td>${esc(g.quantity_received ?? '-')}</td>
                <td>${esc(g.assigned_bin_code || '-')}</td>
                <td>${esc(g.handover_warehouse || '-')}</td>
                <td>${statusBadge(g.iqc_status || '-')}</td>
                <td>${statusBadge(g.status || '-')}</td>
                <td><button class="btn-sm btn-outline" onclick="viewGrnDetail('${g.id}')">View</button></td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:red;">Failed to load GRNs.</td></tr>';
    }
}

async function viewGrnDetail(id) {
    try {
        const res = await fetch(`/api/v1/logistics/grn/${id}`, { headers: HEADERS });
        const data = await res.json();
        const g = data.grn || data;
        const checks = g.physical_checks || {};
        const checksHtml = Object.entries(checks).map(([k, v]) =>
            `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <span class="material-icons-outlined" style="color:${v ? '#2e7d32' : '#c62828'};font-size:18px;">${v ? 'check_circle' : 'cancel'}</span>
                <span>${esc(k)}</span>
            </div>`
        ).join('') || '<p style="color:var(--text-muted);">No checks recorded.</p>';

        openModal('GRN Detail — ' + esc(g.grn_number || id), `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
                <div><label>PO Ref</label><div class="form-static">${esc(g.po_number || '-')}</div></div>
                <div><label>Supplier</label><div class="form-static">${esc(g.supplier_name || '-')}</div></div>
                <div><label>Invoice No</label><div class="form-static">${esc(g.invoice_number || '-')}</div></div>
                <div><label>Batch No</label><div class="form-static">${esc(g.batch_no || '-')}</div></div>
                <div><label>Supplier Lot</label><div class="form-static">${esc(g.supplier_lot || '-')}</div></div>
                <div><label>Qty Received</label><div class="form-static">${esc(g.quantity_received ?? '-')}</div></div>
                <div><label>Bin Assigned</label><div class="form-static">${esc(g.assigned_bin_code || '-')}</div></div>
                <div><label>Warehouse</label><div class="form-static">${esc(g.handover_warehouse || '-')}</div></div>
                <div><label>IQC Status</label><div class="form-static">${esc(g.iqc_status || '-')}</div></div>
                <div><label>Status</label><div class="form-static">${esc(g.status || '-')}</div></div>
            </div>
            <h4 style="margin-bottom:10px;">Physical Checks</h4>
            ${checksHtml}
            ${g.remarks ? `<div style="margin-top:12px;"><label>Remarks</label><div class="form-static">${esc(g.remarks)}</div></div>` : ''}
        `);
    } catch (e) {
        showToast('Failed to load GRN detail', 'error');
    }
}

function statusBadge(status) {
    const map = {
        pending_iqc: '#f57c00', handed_over: '#1976d2', approved: '#2e7d32',
        rejected: '#c62828', pass: '#2e7d32', fail: '#c62828'
    };
    const color = map[status] || '#555';
    return `<span style="background:${color};color:#fff;border-radius:10px;padding:2px 8px;font-size:11px;">${status}</span>`;
}
