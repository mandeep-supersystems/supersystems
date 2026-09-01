// ─── HR ANALYTICS JS ───
let auditPage = 1, auditTotal = 0;

async function safeJson(res) {
    try { return await res.json(); } catch(e) { return { success: false, message: 'Server error (run HR migration SQL)', data: {} }; }
}

function showTab(n) { document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active')); document.getElementById('tab-'+n).classList.add('active'); if(n==='overview')loadOverview(); if(n==='auditlogs'){auditPage=1;loadAuditLogs();} }

async function loadOverview() {
    try {
    const res = await fetch(`${API}/hr-analytics/overview`, { headers: headers() });
    const d = await safeJson(res);
    if (!d.success) { console.warn('Analytics overview:', d.message); return; }
    const data = d.data;
    const kpiEl = document.getElementById('analyticsKPIs');
    kpiEl.innerHTML = `
        <div class="ovr-kpi-card ovr-kpi-blue"><div class="ovr-kpi-icon"><span class="material-icons-outlined">groups</span></div><div class="ovr-kpi-body"><div class="ovr-kpi-value">${data.headcount.total}</div><div class="ovr-kpi-label">Total Employees</div></div></div>
        <div class="ovr-kpi-card ovr-kpi-green"><div class="ovr-kpi-icon"><span class="material-icons-outlined">how_to_reg</span></div><div class="ovr-kpi-body"><div class="ovr-kpi-value">${data.headcount.active}</div><div class="ovr-kpi-label">Active</div></div></div>
        <div class="ovr-kpi-card ovr-kpi-orange"><div class="ovr-kpi-icon"><span class="material-icons-outlined">person_add</span></div><div class="ovr-kpi-body"><div class="ovr-kpi-value">${data.new_joiners_this_month}</div><div class="ovr-kpi-label">New Joiners (This Month)</div></div></div>
        <div class="ovr-kpi-card ovr-kpi-red"><div class="ovr-kpi-icon"><span class="material-icons-outlined">trending_down</span></div><div class="ovr-kpi-body"><div class="ovr-kpi-value">${data.attrition_rate}%</div><div class="ovr-kpi-label">Attrition Rate (YTD)</div></div></div>
        <div class="ovr-kpi-card ovr-kpi-purple"><div class="ovr-kpi-icon"><span class="material-icons-outlined">event_busy</span></div><div class="ovr-kpi-body"><div class="ovr-kpi-value">${data.pending_leaves}</div><div class="ovr-kpi-label">Pending Leaves</div></div></div>
        <div class="ovr-kpi-card ovr-kpi-blue"><div class="ovr-kpi-icon"><span class="material-icons-outlined">work</span></div><div class="ovr-kpi-body"><div class="ovr-kpi-value">${data.open_jobs}</div><div class="ovr-kpi-label">Open Jobs</div></div></div>
    `;
    const renderList = (items, labelKey, countKey) => items.map(i => {
        const pct = data.headcount.active > 0 ? Math.round(i[countKey] / data.headcount.active * 100) : 0;
        return `<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between"><span>${i[labelKey]}</span><strong>${i[countKey]}</strong></div><div style="background:var(--border);border-radius:4px;height:6px;margin-top:4px"><div style="background:var(--primary);height:6px;border-radius:4px;width:${pct}%"></div></div></div>`;
    }).join('');
    document.getElementById('deptBreakdown').innerHTML = renderList(data.department_breakdown, 'department', 'count') || '<p class="empty">No data</p>';
    document.getElementById('genderSplit').innerHTML = renderList(data.gender_split, 'gender', 'count') || '<p class="empty">No data</p>';
    document.getElementById('empTypeSplit').innerHTML = renderList(data.employment_type, 'type', 'count') || '<p class="empty">No data</p>';
    } catch(e) { console.warn('loadOverview:', e.message); }
}

async function loadAuditLogs() {
    try {
    const res = await fetch(`${API}/hr-analytics/audit-logs?page=${auditPage}&limit=50`, { headers: headers() });
    const d = await safeJson(res);
    if (!d.success) { console.warn('Audit logs:', d.message); return; }
    const { items, total } = d.data;
    auditTotal = total;
    document.getElementById('auditTotal').textContent = `Total: ${total} records`;
    document.getElementById('pageInfo').textContent = `Page ${auditPage} of ${Math.ceil(total/50)}`;
    document.getElementById('prevPage').disabled = auditPage <= 1;
    document.getElementById('nextPage').disabled = auditPage >= Math.ceil(total/50);
    const tbody = document.getElementById('auditBody');
    if (!items.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No audit logs</td></tr>'; return; }
    tbody.innerHTML = items.map(r => `<tr>
        <td><span class="status-badge ${r.action.toLowerCase()}">${r.action}</span></td>
        <td>${r.entity_type}</td><td>${r.entity_id}</td>
        <td>${r.user_name || r.user_email}</td>
        <td>${r.ip_address}</td>
        <td>${r.created_at ? r.created_at.replace('T',' ').substring(0,19) : '—'}</td>
    </tr>`).join('');
    } catch(e) { const t=document.getElementById('auditBody'); if(t) t.innerHTML='<tr><td colspan="6" class="empty">Failed to load.</td></tr>'; }
}

function changePage(dir) { auditPage += dir; if (auditPage < 1) auditPage = 1; loadAuditLogs(); }

document.addEventListener('DOMContentLoaded', () => { loadOverview(); });
