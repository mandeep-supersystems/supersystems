// ─── PART MODULE: OVERVIEW ───

let currentOvPeriod = 'month';

function _ovRelTime(ts) {
    if (!ts || ts === 'None') return '';
    try {
        const diff = Date.now() - new Date(ts).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 1) return 'just now';
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        const d = Math.floor(h / 24);
        return `${d}d ago`;
    } catch(e) { return ''; }
}

function setOvPeriod(period, btn) {
    if (btn) {
        document.querySelectorAll('.ov-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    currentOvPeriod = period;
    loadOverview();
}

function updateOvDate() {
    const el = document.getElementById('ovDate');
    if(el) el.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start).toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

async function loadOverview() {
    updateOvDate();
    try {
        const [ovRes, mapRes] = await Promise.all([
            fetch(API + `/overview?period=${currentOvPeriod}`, { headers: HEADERS }),
            fetch(API + '/mappings', { headers: HEADERS })
        ]);
        const ovData = await ovRes.json();
        const mapData = await mapRes.json();
        if (!ovData.success) return;
        const d = ovData.data;
        const mappingCount = mapData.success ? (mapData.data || []).length : 0;

        // ── KPI Cards ───────────────────────────────────────────────────────
        animateValue('kpiCategories', 0, d.categories || 0, 1000);
        animateValue('kpiSubcategories', 0, d.subcategories || 0, 1000);
        animateValue('kpiTotalParts', 0, d.total_parts || 0, 1000);
        animateValue('kpiActiveParts', 0, d.active_parts || 0, 1000);
        animateValue('kpiObsoleteParts', 0, d.obsolete_parts || 0, 1000);
        animateValue('kpiPartMappings', 0, mappingCount, 1000);

        // ── Health Breakdown Donut (CSS) ────────────────────────────────────
        const total = d.total_parts || 0;
        document.getElementById('ovDonutTotal').textContent = total.toLocaleString();
        
        const ring = document.getElementById('ovDonutRing');
        const leg = document.getElementById('ovDonutLegend');
        if (total === 0) {
            ring.style.background = '#e5e7eb';
            leg.innerHTML = '';
        } else {
            const actPct = ((d.active_parts || 0)/total)*100;
            const obsPct = ((d.obsolete_parts || 0)/total)*100;
            ring.style.background = `conic-gradient(#2E7D32 0% ${actPct}%, #C62828 ${actPct}% 100%)`;
            leg.innerHTML = `
                <div class="ov-donut-legend-item"><span class="ov-donut-legend-dot" style="background:#2E7D32"></span><span>Active</span><strong>${d.active_parts||0}</strong></div>
                <div class="ov-donut-legend-item"><span class="ov-donut-legend-dot" style="background:#C62828"></span><span>Obsolete</span><strong>${d.obsolete_parts||0}</strong></div>
            `;
        }

        // ── Health Bars ─────────────────────────────────────────────────────
        const activePct = total > 0 ? Math.round(((d.active_parts||0) / total) * 100) : 0;
        const obsPct = total > 0 ? Math.round(((d.obsolete_parts||0) / total) * 100) : 0;
        
        const barActive = document.getElementById('barActive');
        const barObs = document.getElementById('barObs');
        const valActive = document.getElementById('valActive');
        const valObs = document.getElementById('valObs');
        
        if (barActive) barActive.style.width = activePct + '%';
        if (barObs) barObs.style.width = obsPct + '%';
        if (valActive) valActive.innerHTML = `${(d.active_parts||0).toLocaleString()} <small>(${activePct}%)</small>`;
        if (valObs) valObs.innerHTML = `${(d.obsolete_parts||0).toLocaleString()} <small>(${obsPct}%)</small>`;

        // ── Category Distribution (CSS Bar) — scrollable ────────────────────
        const catList = document.getElementById('ovCatDistList');
        if (catList) {
            const breakdown = d.category_breakdown || [];
            if (breakdown.length === 0) {
                catList.innerHTML = '<div class="ov-empty"><span class="material-icons-outlined">inbox</span>No categories with parts</div>';
            } else {
                const maxCat = breakdown[0].count || 1;
                catList.innerHTML = breakdown.map((c, i) => {
                    const pct = (c.count / maxCat) * 100;
                    return `
                    <div class="ov-hbar-item">
                        <div class="ov-hbar-icon"><span class="material-icons-outlined">folder</span></div>
                        <div class="ov-hbar-info">
                            <div class="ov-hbar-top">
                                <span class="ov-hbar-label">${esc(c.category)}</span>
                                <span class="ov-hbar-count">${c.count.toLocaleString()}</span>
                            </div>
                            <div class="ov-hbar-track">
                                <div class="ov-hbar-fill" style="width: 0%" data-width="${pct}%"></div>
                            </div>
                        </div>
                    </div>`;
                }).join('');
                
                setTimeout(() => {
                    document.querySelectorAll('.ov-hbar-fill').forEach(f => {
                        f.style.width = f.getAttribute('data-width');
                    });
                }, 50);
            }
        }

        // ── Recent Activity (Timeline) — show only 2 ──────────────────────
        const actEl = document.getElementById('overviewActivity');
        if (d.recent_activity && d.recent_activity.length) {
            actEl.innerHTML = d.recent_activity.slice(0, 2).map((a, i) => `
                <div class="ov-timeline-item" style="animation-delay: ${i*0.05}s">
                    <div class="ov-timeline-dot-col">
                        <div class="ov-timeline-dot dot-${(a.action||'').toLowerCase()}"></div>
                        <div class="ov-timeline-line"></div>
                    </div>
                    <div class="ov-timeline-content">
                        <div class="ov-timeline-action-row">
                            <span class="ov-timeline-badge b-${(a.action||'').toLowerCase()}">${esc(a.action)}</span>
                            <span class="ov-timeline-entity">${esc(a.entity_type)}</span>
                        </div>
                        <div class="ov-timeline-meta">${esc(a.entity_id)}</div>
                    </div>
                    <div class="ov-timeline-time">${_ovRelTime(a.created_at)}</div>
                </div>
            `).join('');
        } else {
            actEl.innerHTML = '<div class="ov-empty"><span class="material-icons-outlined">inbox</span>No recent activity found</div>';
        }

        // ── Quick Actions ───────────────────────────────────────────────────
        _renderQuickActions();

    } catch (e) { console.error('Overview error:', e); }
}

function _renderQuickActions() {
    const container = document.getElementById('quickActionsGrid');
    if (!container) return;
    
    // Check module permissions if needed. Part module has all users capable of standard views.
    const allActions = [
        { label: 'Generate Part',   icon: 'bolt',               section: 'generate' },
        { label: 'New Category',    icon: 'create_new_folder',  action: 'openCategoryModal' },
        { label: 'New Subcategory', icon: 'add_box',            action: 'showSubcatAndModal' },
        { label: 'All Parts',       icon: 'view_list',          section: 'allparts' },
        { label: 'Part Mapping',    icon: 'swap_horiz',         section: 'partmapping' },
        { label: 'Audit Logs',      icon: 'history',            section: 'auditlogs' },
    ];
    
    container.innerHTML = allActions.map(a => {
        const onclick = a.action ? 
            (a.action === 'showSubcatAndModal' ? "showSection('subcategories'); setTimeout(openSubcategoryModal, 300)" : `${a.action}()`) 
            : `showSection('${a.section}')`;
            
        return `
        <button class="ov-quick-btn" onclick="${onclick}">
            <span class="material-icons-outlined">${a.icon}</span>
            <span>${a.label}</span>
        </button>`;
    }).join('');
}
