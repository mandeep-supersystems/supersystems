// PURCHASE AUDIT LOGS JS
async function loadAuditLogs() {
    const tbody = document.getElementById('auditLogsBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/audit-logs', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data && json.data.items && json.data.items.length > 0) {
            tbody.innerHTML = json.data.items.map(log => {
                let details = '';
                if (log.action === 'CREATE' && log.new_value) {
                    let parts = [];
                    for (let k in log.new_value) {
                        if (log.new_value[k] !== null && log.new_value[k] !== '') {
                            parts.push(`${k}: ${log.new_value[k]}`);
                        }
                    }
                    details = parts.join(' | ');
                } else if (log.action === 'DELETE' && log.old_value) {
                    let parts = [];
                    for (let k in log.old_value) {
                        if (log.old_value[k] !== null && log.old_value[k] !== '') {
                            parts.push(`${k}: ${log.old_value[k]}`);
                        }
                    }
                    details = parts.join(' | ');
                } else if (log.action === 'UPDATE' && log.new_value && log.old_value) {
                    let changes = [];
                    for (let k in log.new_value) {
                        if (String(log.new_value[k]) !== String(log.old_value[k])) {
                            changes.push(`${k}: ${log.old_value[k]} &rarr; ${log.new_value[k]}`);
                        }
                    }
                    details = changes.join(', ');
                }

                return `<tr>
                    <td><span class="badge badge-info">${log.action}</span></td>
                    <td>
                        <strong>${log.entity_type}</strong> / ${log.entity_id}
                        ${details ? `<div style="font-size:11px; font-family:monospace; color:var(--text-secondary); background:var(--bg-secondary); border-radius:4px; padding:4px 8px; margin-top:4px; line-height:1.4;">${details}</div>` : ''}
                    </td>
                    <td>${log.user_name} <div style="font-size:11px; color:var(--text-muted);">${log.user_email}</div></td>
                    <td>${log.ip_address}</td>
                    <td>${log.created_at}</td>
                </tr>`;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No audit logs available for Purchase.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading audit logs.</td></tr>';
    }
}
