// ─── RM OVERVIEW ───
async function loadRmOverview() {
    try {
        const res = await fetch(RM_API + '/overview', { headers: RM_HEADERS });
        const data = await res.json();
        if (!data.success) return;
        const d = data.data;
        document.getElementById('statCriteria').textContent = d.criteria;
        document.getElementById('statRawMaterials').textContent = d.raw_materials;
        document.getElementById('statActiveRM').textContent = d.active_rm;
        document.getElementById('statMappings').textContent = d.mappings;

        const actEl = document.getElementById('rmOverviewActivity');
        if (d.recent_activity && d.recent_activity.length) {
            actEl.innerHTML = d.recent_activity.map(a => `
                <div class="activity-item">
                    <span class="activity-action">${esc(a.action)}</span>
                    <span class="activity-entity">${esc(a.entity_type)}</span>
                    <span class="activity-id">${esc(a.entity_id)}</span>
                    <span class="activity-time">${formatTime(a.created_at)}</span>
                </div>
            `).join('');
        } else {
            actEl.innerHTML = '<div class="empty">No recent activity</div>';
        }
    } catch(e) {
        console.error(e);
    }
}
