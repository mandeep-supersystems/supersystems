// PLANNING HISTORY JS
async function loadPlanningHistory() {
    const tbody = document.getElementById('planningHistoryBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading history...</td></tr>';
    try {
        const res = await fetch(API + '/audit-logs', { headers: H() });
        const json = await res.json();
        if (json.success && json.data.items && json.data.items.length > 0) {
            // Filter only Planning PR or demand changes (Plan, Purchase Request, etc)
            const planningEvents = json.data.items.filter(l => 
                ['Plan', 'Purchase Request', 'demand_plans', 'purchase_requests'].includes(l.entity_type)
            );
            if (planningEvents.length > 0) {
                tbody.innerHTML = planningEvents.map(l => {
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
                        <td><span class="badge badge-info">${esc(l.action)}</span></td>
                        <td><strong>${esc(l.entity_type)}</strong> (<code>${esc(l.entity_id)}</code>)</td>
                        <td style="font-size:12px; font-family:monospace; color:var(--text-secondary); background:var(--bg-secondary); border-radius:4px; padding:6px 10px; line-height:1.4;">${details || '—'}</td>
                        <td>${esc(l.user_name)} <div style="font-size:11px; color:var(--text-muted);">${esc(l.user_email)}</div></td>
                        <td style="font-size:12px; color:var(--text-muted);">${esc(l.created_at)}</td>
                    </tr>`;
                }).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No planning generation logs found.</td></tr>';
            }
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No logs recorded.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading history.</td></tr>';
    }
}

// Simple escape helper since planning module files might not have esc() defined globally
function esc(s) {
    if (s == null) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
}
