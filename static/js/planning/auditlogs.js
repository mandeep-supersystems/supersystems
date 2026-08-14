// PLANNING AUDIT LOGS JS
async function loadAuditLogs(page = 1) {
    const tbody = document.getElementById('auditLogsBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/audit-logs?page=' + page, { headers: H() });
        const json = await res.json();
        if (json.success && json.data.items && json.data.items.length > 0) {
            tbody.innerHTML = json.data.items.map(l => {
                let details = '';
                if (l.action === 'CREATE' && l.new_value) {
                    let parts = [];
                    for (let k in l.new_value) {
                        if (l.new_value[k] !== null && l.new_value[k] !== '') {
                            parts.push(`${k}: ${l.new_value[k]}`);
                        }
                    }
                    details = parts.join(' | ');
                } else if (l.action === 'DELETE' && l.old_value) {
                    let parts = [];
                    for (let k in l.old_value) {
                        if (l.old_value[k] !== null && l.old_value[k] !== '') {
                            parts.push(`${k}: ${l.old_value[k]}`);
                        }
                    }
                    details = parts.join(' | ');
                } else if (l.action === 'UPDATE' && l.new_value && l.old_value) {
                    let changes = [];
                    for (let k in l.new_value) {
                        if (String(l.new_value[k]) !== String(l.old_value[k])) {
                            changes.push(`${k}: ${l.old_value[k]} &rarr; ${l.new_value[k]}`);
                        }
                    }
                    details = changes.join(', ');
                }

                return `<tr>
                    <td><span class="badge badge-info">${l.action}</span></td>
                    <td>
                        <strong>${l.entity_type}</strong> (<code>${l.entity_id}</code>)
                        ${details ? `<div style="font-size:11px; font-family:monospace; color:var(--text-secondary); background:var(--bg-secondary); border-radius:4px; padding:4px 8px; margin-top:4px; line-height:1.4;">${details}</div>` : ''}
                    </td>
                    <td>${l.user_name} <div style="font-size:11px; color:var(--text-muted);">${l.user_email}</div></td>
                    <td><code>${l.ip_address}</code></td>
                    <td>${l.created_at}</td>
                </tr>`;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No audit logs recorded for Planning.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading audit logs.</td></tr>';
    }
}
