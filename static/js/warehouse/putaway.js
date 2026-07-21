// PUTAWAY JS
async function loadPutaways() {
    const tbody = document.getElementById('putawayBody');
    try {
        const res = await fetch(API + '/putaway', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(t => `
                <tr>
                    <td><strong>${t.task_no}</strong></td>
                    <td>${t.receipt_ref}</td>
                    <td>${t.part_number}</td>
                    <td><strong>${t.qty}</strong></td>
                    <td><span class="badge badge-info">${t.suggested_bin}</span></td>
                    <td><span class="badge badge-warning">${t.status}</span></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No pending putaways.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error loading putaway tasks.</td></tr>';
    }
}
