// ─── LOGISTICS PENDING POs JS ───

async function loadPendingPos() {
    const tbody = document.getElementById('pendingPosBody');
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;">Loading...</td></tr>';
    try {
        const res = await fetch(API + '/pending-pos', { headers: HEADERS });
        const json = await res.json();
        if (!json.success || !json.data.length) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text-muted);">No pending POs awaiting receipt.</td></tr>';
            return;
        }
        tbody.innerHTML = json.data.map(p => `
            <tr>
                <td><strong>${p.po_no}</strong></td>
                <td>${p.supplier_name || '-'}</td>
                <td><code>${p.item_code || '-'}</code></td>
                <td>${p.item_description || '-'}</td>
                <td style="text-align:right;">${p.order_qty}</td>
                <td style="text-align:right; color:#2e7d32; font-weight:600;">${p.received_qty}</td>
                <td style="text-align:right; color:#e65100; font-weight:600;">${p.pending_qty}</td>
                <td>${p.promised_date || '-'}</td>
                <td>${statusBadge(p.po_status)}</td>
                <td>
                    <button class="btn-primary" style="font-size:12px;padding:4px 12px;"
                        onclick="openCreateGrnModal('${p.id}','${p.po_no}','${p.supplier_name}','${p.item_code}',${p.order_qty},${p.received_qty},${p.pending_qty},${p.unit_price},${p.total_amount})">
                        <span class="material-icons-outlined" style="font-size:14px;">add</span> Create GRN
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:red;">Error loading POs.</td></tr>';
    }
}
