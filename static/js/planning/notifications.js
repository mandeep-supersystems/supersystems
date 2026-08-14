// ─── NOTIFICATIONS ───

const _NOTIF_ICONS = {
    IQC_PASSED:    { icon: 'verified',        color: '#388e3c', label: 'IQC Passed'    },
    IQC_PARTIAL:   { icon: 'rule',            color: '#f57c00', label: 'IQC Partial'   },
    IQC_DONE:      { icon: 'fact_check',      color: '#1976d2', label: 'IQC Done'      },
    IQC_REJECTED:  { icon: 'cancel',          color: '#c62828', label: 'IQC Rejected'  },
    IQC_REJECTION: { icon: 'cancel',          color: '#c62828', label: 'IQC Rejected'  },
    PR_CREATED:    { icon: 'add_shopping_cart',color: '#1976d2', label: 'PR Created'   },
    PR_RECEIVED:   { icon: 'inbox',           color: '#7b1fa2', label: 'PR Received'   },
    PR_NEEDED:     { icon: 'warning',         color: '#f57c00', label: 'PR Needed'     },
    DEMAND_CREATED:{ icon: 'trending_up',     color: '#1976d2', label: 'Demand'        },
    STOCK_BOOKED:  { icon: 'inventory',       color: '#388e3c', label: 'Stock Booked'  },
};

function _notifMeta(evt) {
    return _NOTIF_ICONS[evt] || { icon: 'notifications', color: 'var(--accent)', label: evt };
}

async function loadNotifications() {
    const list = document.getElementById('notif-list');
    if (!list) return;
    list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);">Loading...</div>';
    try {
        const r = await fetch(API + '/notifications?role=planner', { headers: H() });
        const d = await r.json();
        const items = d.data || [];
        if (!items.length) {
            list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted);">No notifications</div>';
            return;
        }
        list.innerHTML = items.map(n => {
            const meta = _notifMeta(n.event_type);
            const timeStr = n.created_at ? new Date(n.created_at).toLocaleString() : '';
            return `
            <div class="notif-item ${n.is_read ? '' : 'unread'}" id="notif-${n.id}" style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border-color);${n.is_read ? '' : 'background:var(--bg-secondary);'}">
                <div style="width:36px;height:36px;border-radius:50%;background:${meta.color}18;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">
                    <span class="material-icons-outlined" style="font-size:18px;color:${meta.color};">${meta.icon}</span>
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
                        <span style="font-size:13px;font-weight:${n.is_read ? '500' : '700'};">${n.title}</span>
                        ${!n.is_read ? '<span style="width:7px;height:7px;border-radius:50%;background:var(--accent);flex-shrink:0;display:inline-block;"></span>' : ''}
                    </div>
                    <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;line-height:1.5;">${n.message}</div>
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:10px;background:${meta.color}18;color:${meta.color};">${meta.label}</span>
                        <span style="font-size:11px;color:var(--text-muted);">${n.module}</span>
                        ${n.reference_no ? `<span style="font-size:11px;color:var(--text-muted);">· ${n.reference_no}</span>` : ''}
                        <span style="font-size:11px;color:var(--text-muted);">· ${timeStr}</span>
                        ${!n.is_read ? `<a href="#" onclick="markRead('${n.id}');return false;" style="font-size:11px;color:var(--accent);margin-left:auto;">Mark read</a>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch(e) {
        list.innerHTML = '<div style="padding:24px;text-align:center;color:red;">Failed to load notifications.</div>';
    }
}

async function markRead(id) {
    await fetch(API + '/notifications/' + id + '/read', { method: 'PUT', headers: H() });
    loadNotifications();
    refreshNotifBadge();
}

async function markAllRead() {
    await fetch(API + '/notifications/mark-all-read', { method: 'PUT', headers: H(), body: '{}' });
    loadNotifications();
    refreshNotifBadge();
}

async function refreshNotifBadge() {
    try {
        const r = await fetch(API + '/notifications/unread-count?role=planner', { headers: H() });
        const d = await r.json();
        const badge = document.getElementById('notif-count-badge');
        const count = d.data?.count || 0;
        if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline' : 'none'; }
    } catch(e) {}
}
