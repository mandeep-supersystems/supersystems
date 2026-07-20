// ─── PROJECT MODULE: OVERVIEW ───
async function loadOverview() {
    try {
        const res = await fetch(API + '/overview', { headers: HEADERS });
        const data = await res.json();
        if (!data.success) return;
        const d = data.data;
        document.getElementById('statTotalProjects').textContent = d.total_projects;
        document.getElementById('statOpenProjects').textContent = d.open_projects;
        document.getElementById('statCompletedProjects').textContent = d.completed_projects;
        document.getElementById('statTotalTasks').textContent = d.total_tasks;
        document.getElementById('statTotalOrgs').textContent = d.total_organizations;
        const actEl = document.getElementById('overviewActivity');
        if (d.recent_activity && d.recent_activity.length > 0) {
            actEl.innerHTML = d.recent_activity.map(a => `
                <div class="activity-item">
                    <span class="activity-action action-${a.action.toLowerCase()}">${esc(a.action)}</span>
                    <span class="activity-entity">${esc(a.entity_type)}</span>
                    <span class="activity-id">${esc(a.entity_id)}</span>
                    <span class="activity-time">${formatTime(a.created_at)}</span>
                </div>
            `).join('');
        } else { actEl.innerHTML = '<div class="empty">No recent activity</div>'; }
    } catch (e) { console.error('Overview error:', e); }
}
