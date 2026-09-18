// INVENTORY AUDIT LOGS JS

const AUDIT_BADGE = {
    EXPORT_CSV:      { color: '#0891b2', bg: '#e0f7fa', label: 'Excel Downloaded' },
    EXCEL_IMPORT:    { color: '#7c3aed', bg: '#ede9fe', label: 'Excel Imported'   },
    STOCK_CREATED:   { color: '#16a34a', bg: '#dcfce7', label: 'Stock Created'    },
    MANUAL_ENTRY:    { color: '#16a34a', bg: '#dcfce7', label: 'Manual Entry'     },
    RECEIPT:         { color: '#2563eb', bg: '#dbeafe', label: 'Receipt'          },
    ISSUE:           { color: '#dc2626', bg: '#fee2e2', label: 'Issue'            },
    TRANSFER:        { color: '#d97706', bg: '#fef3c7', label: 'Transfer'         },
    ADJUSTMENT_POS:  { color: '#16a34a', bg: '#dcfce7', label: 'Adj (+)'         },
    ADJUSTMENT_NEG:  { color: '#dc2626', bg: '#fee2e2', label: 'Adj (-)'         },
    RETURN:          { color: '#0891b2', bg: '#e0f7fa', label: 'Return'           },
};

function auditBadge(action) {
    const s = AUDIT_BADGE[action] || { color: '#6b7280', bg: '#f3f4f6', label: action };
    return `<span style="display:inline-block;padding:2px 9px;border-radius:12px;font-size:11px;font-weight:600;color:${s.color};background:${s.bg};">${s.label}</span>`;
}

async function loadAuditLogs(page = 1) {
    const tbody = document.getElementById('auditLogsBody');
    if (!tbody) return;
    try {
        const res  = await fetch(API + '/audit-logs?page=' + page, { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.items && json.data.items.length > 0) {
            tbody.innerHTML = json.data.items.map(l => `
                <tr>
                    <td>${auditBadge(l.action)}</td>
                    <td><strong>${l.entity_type}</strong> <span style="color:var(--text-muted);font-size:12px;">${l.entity_id}</span></td>
                    <td>${l.user_name}<div style="font-size:11px;color:var(--text-muted);">${l.user_email}</div></td>
                    <td><code>${l.ip_address}</code></td>
                    <td style="white-space:nowrap;">${l.created_at.replace('T', ' ').split('.')[0]}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No audit logs recorded for Inventory.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Error loading audit logs.</td></tr>';
    }
}
