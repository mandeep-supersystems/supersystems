// PURCHASE HISTORY JS
async function loadPurchaseHistory() {
    const tbody = document.getElementById('purchaseHistoryBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading history...</td></tr>';
    try {
        const res = await fetch(API + '/lead-time-history', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
            tbody.innerHTML = json.data.map(h => {
                const dateStr = h.changed_at ? new Date(h.changed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                return `<tr>
                    <td><strong>${esc(h.po_no)}</strong></td>
                    <td style="color:var(--text-muted);">${h.old_lead_time_days} days</td>
                    <td style="font-weight:600; color:#e65100;">${h.new_lead_time_days} days</td>
                    <td><span class="badge badge-warning">${esc(h.change_reason)}</span></td>
                    <td style="font-size:12px; color:var(--text-secondary);">${esc(h.remarks || '—')}</td>
                    <td>${esc(h.changed_by || 'Purchaser')}</td>
                    <td style="font-size:12px; color:var(--text-muted);">${dateStr}</td>
                </tr>`;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No revision history found.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Error loading history.</td></tr>';
    }
}
