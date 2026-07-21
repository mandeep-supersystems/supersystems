// QUALITY MANAGEMENT OVERVIEW STATS JS
async function loadOverviewStats() {
    try {
        const res = await fetch(API + '/overview-stats', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data) {
            const d = json.data;
            const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
            set('qPendingIqc', d.pending_iqc ?? 0);
            set('qPassedIqc', d.passed_iqc ?? 0);
            set('qTotalNcrs', d.total_ncrs ?? 0);
            set('qActiveCriteria', d.active_criteria ?? 0);
        }
    } catch (e) { console.error(e); }
}

async function loadRecentMovementsOverview() {
    const el = document.getElementById('recentMovementsOverview');
    if (!el) return;
    try {
        const res = await fetch(API + '/recent-movements', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data) {
            el.innerHTML = json.data.length === 0
                ? '<tr><td colspan="5" style="text-align:center;">No recent activity</td></tr>'
                : json.data.map(r => `
                    <tr>
                        <td>${r.checkin_no || '-'}</td>
                        <td>${r.part_or_rm_code || '-'}</td>
                        <td>${r.supplier_name || '-'}</td>
                        <td><span class="badge badge-${r.iqc_status === 'passed' ? 'success' : r.iqc_status === 'failed' ? 'danger' : 'warning'}">${r.iqc_status}</span></td>
                        <td>${r.created_at ? new Date(r.created_at).toLocaleDateString() : '-'}</td>
                    </tr>`).join('');
        }
    } catch (e) { console.error(e); }
}
