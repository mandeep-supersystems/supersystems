// ─── PART MODULE: OVERVIEW ───
async function loadOverview() {
    try {
        const res = await fetch(API + '/overview', { headers: HEADERS });
        const data = await res.json();
        if (!data.success) return;
        const d = data.data;
        document.getElementById('statCategories').textContent = d.categories;
        document.getElementById('statSubcategories').textContent = d.subcategories;
        document.getElementById('statTotalParts').textContent = d.total_parts;
        document.getElementById('statActiveParts').textContent = d.active_parts;
        document.getElementById('statObsolete').textContent = d.obsolete_parts;
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
