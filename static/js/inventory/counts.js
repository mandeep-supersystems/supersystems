// COUNTS JS
async function loadStockCounts() {
    const tbody = document.getElementById('stockCountsBody');
    try {
        const res = await fetch(API + '/stock-counts', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(c => `
                <tr>
                    <td><strong>${c.count_no}</strong></td>
                    <td>${c.warehouse_code}</td>
                    <td>${c.count_date}</td>
                    <td><span class="badge badge-info">${c.status}</span></td>
                    <td>${c.assigned_to}</td>
                    <td>${c.lines ? c.lines.length : 0} items</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No stock counts found.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error loading counts.</td></tr>';
    }
}

async function createStockCount() {
    try {
        const res = await fetch(API + '/stock-counts', {
            method: 'POST', headers: HEADERS, body: JSON.stringify({ warehouse_code: 'MAIN' })
        });
        const json = await res.json();
        if (json.success) {
            showToast(json.message);
            loadStockCounts();
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Failed to create count cycle', 'error'); }
}
