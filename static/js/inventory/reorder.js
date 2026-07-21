// REORDER JS
async function loadReorderAlerts() {
    const tbody = document.getElementById('reorderAlertsBody');
    try {
        const res = await fetch(API + '/reorder-alerts', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(a => `
                <tr>
                    <td><strong>${a.part_number}</strong><div style="font-size:11px; color:var(--text-muted);">${a.part_description}</div></td>
                    <td>${a.qty_on_hand}</td>
                    <td><strong style="color:red;">${a.qty_available}</strong></td>
                    <td>${a.reorder_point}</td>
                    <td><strong>${a.suggested_po_qty}</strong></td>
                    <td><button class="btn-primary" style="padding:4px 10px; font-size:11px;" onclick="createSuggestedPO('${a.part_number}', ${a.suggested_po_qty})">Create Requisition</button></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:green;">✓ All stock levels are sufficient above reorder thresholds.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error loading reorder alerts.</td></tr>';
    }
}

function createSuggestedPO(partNo, qty) {
    showToast(`Purchase Requisition generated for ${qty} units of ${partNo}`);
}
