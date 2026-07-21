// NON-CONFORMANCE REPORTS (NCR) JS
async function loadNcrs() {
    const tbody = document.getElementById('ncrBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/ncr', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
            tbody.innerHTML = json.data.map(n => `
                <tr>
                    <td><strong>${n.ncr_no}</strong></td>
                    <td>${n.checkin_no}</td>
                    <td><span class="badge badge-info">${n.part_or_rm_code}</span></td>
                    <td>${n.supplier_name}</td>
                    <td><strong style="color:#c62828;">${n.rejected_qty} units</strong></td>
                    <td>${n.root_cause || n.defect_type}</td>
                    <td><span class="badge badge-danger">${n.severity}</span></td>
                    <td>${n.disposition}</td>
                    <td><span class="badge badge-warning">${n.status}</span></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No non-conformance reports.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:red;">Error loading NCRs.</td></tr>';
    }
}
