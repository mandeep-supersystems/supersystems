// ─── RM OVERVIEW ───
let rmCategoryChartInstance = null;
let rmActionChartInstance = null;

async function loadRmOverview() {
    try {
        const period = document.getElementById('overviewPeriod')?.value || 'all';
        const res = await fetch(`${RM_API}/overview?period=${period}`, { headers: RM_HEADERS });
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

        // Render Charts
        renderRmCategoryChart(d.category_breakdown || []);
        renderRmActionChart(d.action_breakdown || {});
    } catch(e) {
        console.error("Overview error:", e);
    }
}

function renderRmCategoryChart(breakdown) {
    const ctx = document.getElementById('rmCategoryChart');
    if (!ctx) return;
    if (rmCategoryChartInstance) rmCategoryChartInstance.destroy();
    
    if (!breakdown || breakdown.length === 0) {
        // Fallback if no data
        rmCategoryChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ['No Data'], datasets: [{ data: [1], backgroundColor: ['#eee'] }] },
            options: { responsive: false, maintainAspectRatio: false }
        });
        return;
    }

    const labels = breakdown.map(i => i.category);
    const data = breakdown.map(i => i.count);
    
    const bgColors = [
        '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', 
        '#f59e0b', '#10b981', '#0ea5e9', '#3b82f6'
    ];

    rmCategoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: bgColors.slice(0, labels.length),
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10, font: {size: 11} } }
            }
        }
    });
}

function renderRmActionChart(actions) {
    const ctx = document.getElementById('rmActionChart');
    if (!ctx) return;
    if (rmActionChartInstance) rmActionChartInstance.destroy();

    const labels = Object.keys(actions);
    const data = Object.values(actions);

    if (labels.length === 0) {
        rmActionChartInstance = new Chart(ctx, {
            type: 'pie',
            data: { labels: ['No Actions'], datasets: [{ data: [1], backgroundColor: ['#eee'] }] },
            options: { responsive: false, maintainAspectRatio: false }
        });
        return;
    }

    const bgColors = [
        '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'
    ];

    rmActionChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels.map(l => l.replace(/_/g, ' ')),
            datasets: [{
                data: data,
                backgroundColor: bgColors.slice(0, labels.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10, font: {size: 11} } }
            }
        }
    });
}

