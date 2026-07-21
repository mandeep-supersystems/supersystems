// PURCHASE AUDIT LOGS JS
async function loadAuditLogs() {
    const tbody = document.getElementById('auditLogsBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/audit-logs', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data && json.data.items && json.data.items.length > 0) {
            tbody.innerHTML = json.data.items.map(log => `
                <tr>
                    <td><span class="badge badge-info">${log.action}</span></td>
                    <td><strong>${log.entity_type}</strong> / ${log.entity_id}</td>
                    <td>${log.user_name} <div style="font-size:11px; color:var(--text-muted);">${log.user_email}</div></td>
                    <td>${log.ip_address}</td>
                    <td>${log.created_at}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No audit logs available for Purchase.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading audit logs.</td></tr>';
    }
}
