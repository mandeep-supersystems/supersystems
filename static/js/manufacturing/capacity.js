// CAPACITY JS
async function loadCapacity() {
    const tbody = document.getElementById('capacityBody');
    try {
        const res = await fetch(API + '/capacity', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(c => `
                <tr>
                    <td><strong>${c.work_center}</strong> (${c.name})</td>
                    <td>${c.available_hours_per_day} hrs/day</td>
                    <td>${c.efficiency_pct}%</td>
                    <td>${c.allocated_hours} hrs</td>
                    <td><strong style="color:${c.load_pct > 90 ? '#c62828' : 'var(--text-primary)'}">${c.load_pct}%</strong></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No capacity data.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading capacity planning.</td></tr>';
    }
}
