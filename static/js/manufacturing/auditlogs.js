// MANUFACTURING AUDIT LOGS JS
async function loadAuditLogs(page = 1) {
    const tbody = document.getElementById('auditLogsBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/audit-logs?page=' + page, { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.items && json.data.items.length > 0) {
            tbody.innerHTML = json.data.items.map(l => `
                <tr>
                    <td><span class="badge badge-info">${l.action}</span></td>
                    <td><code style="font-size:12px; font-weight:700; color:var(--accent);">${l.fg_part_number}</code> <span style="font-size:11px; color:var(--text-secondary);">${l.bom_no}</span></td>
                    <td style="max-width:320px; font-size:12px;">${l.detail}</td>
                    <td><strong>${l.performed_by}</strong></td>
                    <td style="font-size:11px; color:var(--text-secondary);">${l.performed_at.split('.')[0]}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-secondary);">No BOM activity logs found.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading audit logs.</td></tr>';
    }
}
