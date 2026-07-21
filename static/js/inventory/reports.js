// REPORTS JS
async function loadValuation() {
    const tbody = document.getElementById('valuationBody');
    try {
        const res = await fetch(API + '/valuation', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(v => `
                <tr>
                    <td><strong>${v.item_type}</strong></td>
                    <td>${v.item_count} items</td>
                    <td>${v.total_qty.toLocaleString()} units</td>
                    <td><strong style="color:var(--accent);">₹${v.total_value.toLocaleString()}</strong></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No valuation data available.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Error loading valuation summary.</td></tr>';
    }
}
