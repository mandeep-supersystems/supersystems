// ─── SUPPLIER MODULE: OVERVIEW ───

async function loadSupOverview(period = 'all') {
    try {
        const res = await fetch(`${API}/overview?period=${period}`, { headers: getHeaders() });
        const data = await res.json();
        
        if (data.success && data.data) {
            const d = data.data;
            document.getElementById('statTotalSuppliers').textContent = fmtNum(d.total_suppliers);
            document.getElementById('statActiveSuppliers').textContent = fmtNum(d.active_suppliers);
            document.getElementById('statTotalParts').textContent = fmtNum(d.total_parts);
            document.getElementById('statTotalContracts').textContent = fmtNum(d.total_contracts);
            
            renderTypeChart(d.type_breakdown);
            renderActionChart(d.action_breakdown);
            renderRecentActivity(d.recent_activity);
        }
    } catch(e) {
        console.error('Error loading overview:', e);
    }
}

function renderTypeChart(breakdown) {
    const ctx = document.getElementById('supTypeChart');
    if (!ctx) return;
    
    if (window.supTypeChartInst) window.supTypeChartInst.destroy();
    
    const labels = breakdown.map(x => x.type.replace('_', ' '));
    const data = breakdown.map(x => x.count);
    
    window.supTypeChartInst = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12, usePointStyle: true, font: { family: 'Inter', size: 12 } } }
            },
            cutout: '70%'
        }
    });
}

function renderActionChart(breakdown) {
    const ctx = document.getElementById('supActionChart');
    if (!ctx) return;
    
    if (window.supActionChartInst) window.supActionChartInst.destroy();
    
    const labels = Object.keys(breakdown);
    const data = Object.values(breakdown);
    
    if (labels.length === 0) {
        labels.push('No Activity');
        data.push(1);
    }
    
    window.supActionChartInst = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Actions',
                data: data,
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#e5e7eb', drawBorder: false }, ticks: { stepSize: 1, font: { family: 'Inter', size: 11 } } },
                x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 } } }
            }
        }
    });
}

function renderRecentActivity(activity) {
    const tbody = document.getElementById('recentActivityBody');
    if (!tbody) return;
    
    if (!activity || activity.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty">No recent activity found.</td></tr>';
        return;
    }
    
    tbody.innerHTML = activity.map(a => `
        <tr>
            <td style="font-weight:500;color:var(--primary)">${esc(a.action)}</td>
            <td>${esc(a.entity_type)}</td>
            <td style="font-size:11px;color:var(--text-secondary);font-family:monospace">${esc(a.entity_id)}</td>
            <td>${fmtDateTime(a.created_at)}</td>
        </tr>
    `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    loadSupOverview();
});
