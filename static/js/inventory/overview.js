// OVERVIEW JS
async function loadOverviewStats() {
    try {
        const res = await fetch(API + '/overview-stats', { headers: HEADERS });
        const json = await res.json();
        if (json.success) {
            const d = json.data;
            const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
            set('statTotalItems', d.total_items ?? 0);
            set('statTotalValue', '₹' + (d.total_value ?? 0).toLocaleString());
            set('statLowStock', d.low_stock_count ?? 0);
            set('statTotalMovements', d.total_movements ?? 0);
        }
    } catch (e) { console.error(e); }
    loadRecentMovementsOverview();
}

async function loadRecentMovementsOverview() {
    const tbody = document.getElementById('overviewRecentMovements');
    try {
        const res = await fetch(API + '/stock-movements', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.slice(0, 5).map(m => `
                <tr>
                    <td><strong>${m.movement_no}</strong></td>
                    <td><span class="badge ${m.movement_type === 'RECEIPT' ? 'badge-success' : 'badge-info'}">${m.movement_type}</span></td>
                    <td>${m.part_number}</td>
                    <td><strong>${m.qty} ${m.unit}</strong></td>
                    <td>${m.from_bin_code || '-'} ➔ ${m.to_bin_code || '-'}</td>
                    <td>${m.created_at || '-'}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No recent movements.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error loading movements.</td></tr>';
    }
}
