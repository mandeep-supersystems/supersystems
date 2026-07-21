// SERIALS JS
async function loadSerials() {
    const tbody = document.getElementById('serialsBody');
    try {
        const res = await fetch(API + '/serials', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(s => `
                <tr>
                    <td><strong>${s.serial_no}</strong></td>
                    <td>${s.part_number}</td>
                    <td>${s.batch_no || '-'}</td>
                    <td>${s.warehouse_code} / ${s.bin_code}</td>
                    <td><span class="badge badge-info">${s.status}</span></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No serial numbers registered.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading serials.</td></tr>';
    }
}
