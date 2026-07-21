// FINAL QUALITY ASSURANCE (FQA) JS
async function loadFqaInspections() {
    const tbody = document.getElementById('fqaBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/fqa', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
            tbody.innerHTML = json.data.map(f => `
                <tr>
                    <td><strong>${f.fqa_no}</strong></td>
                    <td>${f.production_order_no}</td>
                    <td><span class="badge badge-info">${f.part_number}</span></td>
                    <td><strong>${f.inspected_qty} pcs</strong></td>
                    <td><strong style="color:#2e7d32;">${f.passed_qty} OK</strong></td>
                    <td><strong style="color:#c62828;">${f.rejected_qty} NG</strong></td>
                    <td><span class="badge badge-success">${f.status}</span></td>
                    <td>${f.cert_status || 'Certified OK'}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No final quality assurance inspections recorded.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">Error loading FQA records.</td></tr>';
    }
}
