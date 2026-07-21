// INCOMING QUALITY CONTROL (IQC) JS
async function loadIqcInspections() {
    const tbody = document.getElementById('iqcBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/iqc', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
            tbody.innerHTML = json.data.map(c => `
                <tr style="cursor:pointer;" onclick="window.location.href='/quality/iqc/${c.id}'">
                    <td><strong>${c.checkin_no}</strong></td>
                    <td>${c.po_no}</td>
                    <td>${c.supplier_name}</td>
                    <td><span class="badge badge-info">${c.part_or_rm_code}</span></td>
                    <td><strong>${c.received_qty}</strong></td>
                    <td>${c.checkin_time}</td>
                    <td>
                        <span class="badge ${c.iqc_status === 'passed' ? 'badge-success' : c.iqc_status === 'rejected' ? 'badge-danger' : 'badge-warning'}">
                            ${c.iqc_status === 'passed' ? 'Approved by IQC' : c.iqc_status === 'rejected' ? 'Rejected' : 'Pending IQC Inspection'}
                        </span>
                    </td>
                    <td><strong style="color:#2e7d32;">${c.iqc_passed_qty}</strong></td>
                    <td><strong style="color:#c62828;">${c.iqc_rejected_qty}</strong></td>
                    <td onclick="event.stopPropagation()">
                        <button class="btn-action" title="Open IQC Detail & Criteria Evaluation Page" onclick="window.location.href='/quality/iqc/${c.id}'"><span class="material-icons-outlined">visibility</span></button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No IQC inspection records found.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:red;">Error loading IQC records.</td></tr>';
    }
}
