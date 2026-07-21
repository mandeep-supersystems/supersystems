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
                    <td><strong>${l.entity_type}</strong> (<code>${l.entity_id}</code>)</td>
                    <td>${l.user_name} <div style="font-size:11px; color:var(--text-muted);">${l.user_email}</div></td>
                    <td><code>${l.ip_address}</code></td>
                    <td>${l.created_at}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No audit logs recorded for Manufacturing.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading audit logs.</td></tr>';
    }
}
