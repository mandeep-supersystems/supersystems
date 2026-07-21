// IN-PROCESS QUALITY CONTROL (IPQC) JS
async function loadIpqcInspections() {
    const tbody = document.getElementById('ipqcBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/ipqc', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
            tbody.innerHTML = json.data.map(i => `
                <tr>
                    <td><strong>${i.inspection_no}</strong></td>
                    <td>${i.production_order_no}</td>
                    <td><span class="badge badge-info">${i.part_number}</span></td>
                    <td>${i.work_center}</td>
                    <td>${i.operation_sequence}</td>
                    <td><strong>${i.sample_qty} pcs</strong></td>
                    <td><span class="badge ${i.status === 'passed' ? 'badge-success' : 'badge-danger'}">${i.status}</span></td>
                    <td>${i.inspector}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No in-process quality inspections recorded.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">Error loading IPQC records.</td></tr>';
    }
}
