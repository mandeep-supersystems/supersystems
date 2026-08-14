/* ═══════════════════════════════════════════════════════
   SUPERSYSTEMS — Power BI-Style Executive Dashboard JS
   ═══════════════════════════════════════════════════════ */

let currentPeriod = 'month';

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ─── MODULE METADATA ─── */
const MODULE_META = {
    'Part Management':      { icon: 'settings_input_component', color: 'blue', route: '/part' },
    'Part':                 { icon: 'settings_input_component', color: 'blue', route: '/part' },
    'Inventory Management': { icon: 'inventory_2', color: 'green', route: '/inventory' },
    'Inventory':            { icon: 'inventory_2', color: 'green', route: '/inventory' },
    'Warehouse Management': { icon: 'warehouse', color: 'orange', route: '/warehouse' },
    'Warehouse':            { icon: 'warehouse', color: 'orange', route: '/warehouse' },
    'Manufacturing':        { icon: 'factory', color: 'purple', route: '/manufacturing' },
    'Purchase Management':  { icon: 'shopping_cart', color: 'teal', route: '/purchase' },
    'Purchase':             { icon: 'shopping_cart', color: 'teal', route: '/purchase' },
    'Quality Management':   { icon: 'verified', color: 'red', route: '/quality' },
    'Quality':              { icon: 'verified', color: 'red', route: '/quality' },
    'Human Resources':      { icon: 'people', color: 'indigo', route: '/hr' },
    'HR':                   { icon: 'people', color: 'indigo', route: '/hr' },
    'Supplier Management':  { icon: 'handshake', color: 'brown', route: '/supplier' },
    'Supplier':             { icon: 'handshake', color: 'brown', route: '/supplier' },
    'Machine Management':   { icon: 'precision_manufacturing', color: 'cyan', route: '/machine' },
    'Machine':              { icon: 'precision_manufacturing', color: 'cyan', route: '/machine' },
    'Workflow & Costing':   { icon: 'account_tree', color: 'lime', route: '/workflow' },
    'Workflow':             { icon: 'account_tree', color: 'lime', route: '/workflow' },
    'Planning':             { icon: 'event_note', color: 'pink', route: '/planning' },
    'Auth & Security':      { icon: 'security', color: 'amber', route: '/auth' },
    'Auth':                 { icon: 'security', color: 'amber', route: '/auth' },
    'Project Management':   { icon: 'assignment', color: 'deepblue', route: '/project' },
    'Project':              { icon: 'assignment', color: 'deepblue', route: '/project' },
    'Raw Material Management':{ icon: 'science', color: 'teal', route: '/rawmaterial' },
    'Raw Material':         { icon: 'science', color: 'teal', route: '/rawmaterial' },
    'Logistics':            { icon: 'local_shipping', color: 'orange', route: '/logistics' },
};

const DONUT_COLORS = [
    '#1976D2', '#2E7D32', '#F57C00', '#7B1FA2', '#C62828',
    '#00838F', '#4E342E', '#283593', '#558B2F', '#AD1457',
    '#FF8F00', '#0D47A1', '#6A1B9A', '#00695C'
];

/* ─── USER STORAGE KEY HELPER ─── */
function _getDashUserStorageKey(prefix) {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const uid = user.id || user.email || 'guest';
        return `${prefix}_${uid}`;
    } catch(e) {
        return `${prefix}_guest`;
    }
}

/* ─── SIDEBAR: RECENT MODULES (USER-SCOPED) ─── */
function renderDashSidebar() {
    const recentKey = _getDashUserStorageKey('recent_modules');
    const currentKey = _getDashUserStorageKey('current_module_route');

    let recent = [];
    try {
        recent = JSON.parse(localStorage.getItem(recentKey) || '[]');
        if (!recent.length) {
            recent = JSON.parse(localStorage.getItem('recent_modules') || '[]');
        }
    } catch(e) { recent = []; }

    const currentPath = localStorage.getItem(currentKey) || localStorage.getItem('current_module_route');

    // Currently open
    const currentWrap = document.getElementById('dsb-current-wrap');
    const currentEl = document.getElementById('dsb-current');
    if (currentWrap && currentEl) {
        if (currentPath) {
            const cur = recent.find(m => m.route === currentPath) ||
                        { name: currentPath, icon: 'web', route: currentPath };
            currentEl.innerHTML = `<a class="dsb-item dsb-active" href="${cur.route}">
                <span class="material-icons-outlined">${cur.icon || 'web'}</span>
                <span>${esc(cur.name)}</span>
            </a>`;
            currentWrap.style.display = '';
        } else {
            currentWrap.style.display = 'none';
        }
    }

    // Recently visited (exclude current, max 3, with relative time)
    const recentEl = document.getElementById('dsb-recent');
    if (recentEl) {
        const filtered = recent.filter(m => m.route !== currentPath).slice(0, 3);
        if (filtered.length === 0) {
            recentEl.innerHTML = '<div class="dsb-empty">No recent modules</div>';
        } else {
            recentEl.innerHTML = filtered.map(m => {
                const ago = m.timestamp ? _relTime(m.timestamp) : '';
                return `<a class="dsb-item" href="${m.route}">
                    <span class="material-icons-outlined">${m.icon || 'apps'}</span>
                    <span style="flex:1">${esc(m.name)}</span>
                    ${ago ? `<span style="font-size:10px;color:var(--text-muted);white-space:nowrap">${ago}</span>` : ''}
                </a>`;
            }).join('');
        }
    }
}

function _relTime(ts) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
}

/* ─── DATE DISPLAY ─── */
function setDashDate() {
    const el = document.getElementById('dashDate');
    if (el) {
        const now = new Date();
        el.textContent = now.toLocaleDateString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }
}

/* ─── PERIOD FILTER ─── */
document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPeriod = btn.dataset.period;
        loadDashboard();
    });
});

/* ─── ANIMATED NUMBER COUNTER ─── */
function animateCounter(el, target) {
    const duration = 800;
    const start = parseInt(el.textContent) || 0;
    const diff = target - start;
    if (diff === 0) { el.textContent = target; return; }
    const startTime = performance.now();

    function step(ts) {
        const elapsed = ts - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(start + diff * eased).toLocaleString();
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

/* ─── SPARKLINE BARS ─── */
function renderSparkline(containerId, values) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const max = Math.max(...values, 1);
    el.innerHTML = values.map(v => {
        const h = Math.max((v / max) * 24, 3);
        return `<div class="kpi-sparkline-bar" style="height:${h}px"></div>`;
    }).join('');
}

/* ─── DONUT CHART (CSS conic-gradient) ─── */
function renderDonutChart(modules) {
    const chart = document.getElementById('donutChart');
    const legend = document.getElementById('donutLegend');
    const totalEl = document.getElementById('donutTotal');

    if (!modules || modules.length === 0) {
        chart.style.background = 'var(--bg-secondary)';
        totalEl.textContent = '0';
        legend.innerHTML = '<div style="color:var(--text-muted);font-size:12px">No data</div>';
        return;
    }

    const total = modules.reduce((s, m) => s + m.count, 0);
    animateCounter(totalEl, total);

    // Build conic gradient
    let gradientParts = [];
    let cumDeg = 0;
    modules.forEach((m, i) => {
        const color = DONUT_COLORS[i % DONUT_COLORS.length];
        const deg = (m.count / total) * 360;
        gradientParts.push(`${color} ${cumDeg}deg ${cumDeg + deg}deg`);
        cumDeg += deg;
    });

    chart.style.background = `conic-gradient(${gradientParts.join(', ')})`;
    chart.style.borderRadius = '50%';

    // Legend
    legend.innerHTML = modules.slice(0, 8).map((m, i) => {
        const color = DONUT_COLORS[i % DONUT_COLORS.length];
        const pct = total > 0 ? Math.round((m.count / total) * 100) : 0;
        return `<div class="donut-legend-item">
            <span class="donut-legend-dot" style="background:${color}"></span>
            <span>${esc(m.module)} (${pct}%)</span>
        </div>`;
    }).join('');
}

/* ─── HORIZONTAL BAR CHART ─── */
function renderHBarChart(modules) {
    const container = document.getElementById('hbarList');
    if (!modules || modules.length === 0) {
        container.innerHTML = '<div class="empty-state"><span class="material-icons-outlined">bar_chart</span>No module activity for this period</div>';
        return;
    }

    const max = Math.max(...modules.map(m => m.count));
    container.innerHTML = modules.slice(0, 10).map(m => {
        const meta = MODULE_META[m.module] || { icon: 'apps', color: 'blue' };
        const pct = max > 0 ? (m.count / max) * 100 : 0;
        return `<div class="hbar-item">
            <div class="hbar-icon"><span class="material-icons-outlined">${meta.icon}</span></div>
            <div class="hbar-info">
                <div class="hbar-top">
                    <span class="hbar-label">${esc(m.module)}</span>
                    <span class="hbar-count">${m.count}</span>
                </div>
                <div class="hbar-track"><div class="hbar-fill" style="width:0%" data-width="${pct}%"></div></div>
            </div>
        </div>`;
    }).join('');

    // Animate bars after render
    requestAnimationFrame(() => {
        container.querySelectorAll('.hbar-fill').forEach(bar => {
            bar.style.width = bar.dataset.width;
        });
    });
}

/* ─── MODULE COVERAGE GRID ─── */
function renderModuleGrid(modules, breakdown) {
    const grid = document.getElementById('moduleGrid');
    if (!modules || modules.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="material-icons-outlined">grid_view</span>No module activity recorded for this period</div>';
        return;
    }

    const max = Math.max(...modules.map(m => m.count));

    grid.innerHTML = modules.map((m, i) => {
        const meta = MODULE_META[m.module] || { icon: 'apps', color: 'blue', route: '#' };
        const bd = (breakdown && breakdown[m.module]) || { CREATE: 0, UPDATE: 0, DELETE: 0 };
        const pct = max > 0 ? (m.count / max) * 100 : 0;

        return `<div class="module-tile" data-color="${meta.color}" 
                     onclick="window.location.href='${meta.route}'"
                     style="animation-delay:${0.05 * i}s">
            <div class="module-tile-header">
                <div class="module-tile-icon">
                    <span class="material-icons-outlined">${meta.icon}</span>
                </div>
                <div class="module-tile-name">${esc(m.module)}</div>
            </div>
            <div class="module-tile-count">${m.count}</div>
            <div class="module-tile-label">actions this period</div>
            <div class="module-tile-actions">
                ${bd.CREATE > 0 ? `<span class="module-action-tag create">+${bd.CREATE} created</span>` : ''}
                ${bd.UPDATE > 0 ? `<span class="module-action-tag update">${bd.UPDATE} updated</span>` : ''}
                ${bd.DELETE > 0 ? `<span class="module-action-tag delete">${bd.DELETE} deleted</span>` : ''}
            </div>
            <div class="module-tile-bar">
                <div class="module-tile-bar-fill" style="width:${pct}%"></div>
            </div>
        </div>`;
    }).join('');
}

/* ─── ACTIVITY TIMELINE ─── */
function renderTimeline(activities) {
    const container = document.getElementById('timelineBody');
    if (!activities || activities.length === 0) {
        container.innerHTML = '<div class="empty-state"><span class="material-icons-outlined">timeline</span>No activity recorded for this period</div>';
        return;
    }

    container.innerHTML = activities.map((a, i) => {
        const dt = new Date(a.created_at);
        const timeStr = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) +
            ' ' + dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const actionClass = (a.action || '').toLowerCase();
        const meta = MODULE_META[a.module] || { icon: 'apps' };
        const isLast = i === activities.length - 1;

        return `<div class="timeline-item" style="animation-delay:${0.03 * i}s">
            <div class="timeline-dot-col">
                <div class="timeline-dot ${actionClass}"></div>
                ${!isLast ? '<div class="timeline-line"></div>' : ''}
            </div>
            <div class="timeline-content">
                <div class="timeline-action-row">
                    <span class="timeline-action-badge ${actionClass}">${a.action || '-'}</span>
                    <span class="timeline-entity">${esc(a.entity_type || '-')}</span>
                </div>
                <div class="timeline-module">
                    <span class="material-icons-outlined">${meta.icon}</span>
                    ${esc(a.module || '-')}
                </div>
                ${a.ip_address ? `<div class="timeline-ip">IP: ${esc(a.ip_address)}</div>` : ''}
            </div>
            <div class="timeline-time">${timeStr}</div>
        </div>`;
    }).join('');
}

/* ─── GENERATE SPARKLINE DATA ─── */
function generateSparkData(activities, actionFilter) {
    // Create 7 buckets from recent activity for a mini trend
    const now = Date.now();
    const buckets = Array(7).fill(0);
    const bucketSize = (currentPeriod === 'day') ? 3600000 * 3.5 : // 3.5hr buckets for day
                       (currentPeriod === 'week') ? 86400000 : // daily for week
                       (currentPeriod === 'month') ? 86400000 * 4.3 : // ~4 day buckets for month
                       (currentPeriod === 'year') ? 86400000 * 52 : // ~52 day buckets
                       86400000 * 30; // ~30 day buckets for all

    if (activities) {
        activities.forEach(a => {
            if (actionFilter && a.action !== actionFilter) return;
            const ts = new Date(a.created_at).getTime();
            const age = now - ts;
            const idx = Math.min(6, Math.floor(age / bucketSize));
            if (idx >= 0 && idx < 7) buckets[6 - idx]++;
        });
    }
    return buckets;
}

/* ─── MAIN DASHBOARD LOADER ─── */
async function loadDashboard() {
    renderDashSidebar();
    setDashDate();

    const token = localStorage.getItem('access_token');
    if (!token) {
        document.getElementById('dashUserName').textContent = 'Guest';
        document.getElementById('dashUserRole').textContent = 'Please login to see your activity';
        return;
    }

    // Set user name from localStorage immediately
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const name = (user.first_name || user.name || user.email || 'User').split('@')[0];
    document.getElementById('dashUserName').textContent = name;
    document.getElementById('dashUserRole').textContent =
        localStorage.getItem('user_type') === 'super_admin' ? 'Super Admin • Platform Owner' : 'Organization User';

    try {
        const res = await fetch(`/api/v1/dashboard?period=${currentPeriod}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const result = await res.json();

        if (!result.success) {
            if (res.status === 401) {
                localStorage.removeItem('access_token');
                document.getElementById('dashUserName').textContent = 'Guest';
                document.getElementById('dashUserRole').textContent = 'Session expired';
            }
            return;
        }

        const data = result.data;

        // Update user info from API
        if (data.user && data.user.name) {
            document.getElementById('dashUserName').textContent = data.user.name || name;
        }

        // ─── KPI CARDS ───
        const totalActions = data.total_actions || 0;
        const created = data.work_summary.CREATE || 0;
        const updated = data.work_summary.UPDATE || 0;
        const deleted = data.work_summary.DELETE || 0;
        const logins = data.login_count || 0;

        animateCounter(document.getElementById('kpiTotalActions'), totalActions);
        animateCounter(document.getElementById('kpiCreated'), created);
        animateCounter(document.getElementById('kpiUpdated'), updated);
        animateCounter(document.getElementById('kpiDeleted'), deleted);
        animateCounter(document.getElementById('kpiLogins'), logins);

        // Sparklines from recent activity
        renderSparkline('sparkActions', generateSparkData(data.recent_activity, null));
        renderSparkline('sparkCreated', generateSparkData(data.recent_activity, 'CREATE'));
        renderSparkline('sparkUpdated', generateSparkData(data.recent_activity, 'UPDATE'));
        renderSparkline('sparkDeleted', generateSparkData(data.recent_activity, 'DELETE'));

        // Login sparkline from recent logins
        const loginSparkBuckets = Array(7).fill(0);
        if (data.recent_logins) {
            const now = Date.now();
            const bSize = (currentPeriod === 'day') ? 3600000 * 3.5 :
                          (currentPeriod === 'week') ? 86400000 :
                          (currentPeriod === 'month') ? 86400000 * 4.3 :
                          (currentPeriod === 'year') ? 86400000 * 52 :
                          86400000 * 30;
            data.recent_logins.forEach(l => {
                const ts = new Date(l.login_at).getTime();
                const idx = Math.min(6, Math.floor((now - ts) / bSize));
                if (idx >= 0 && idx < 7) loginSparkBuckets[6 - idx]++;
            });
        }
        renderSparkline('sparkLogins', loginSparkBuckets);

        // ─── DONUT CHART ───
        renderDonutChart(data.module_activity);

        // ─── HORIZONTAL BAR CHART ───
        renderHBarChart(data.module_activity);

        // ─── MODULE COVERAGE GRID ───
        renderModuleGrid(data.module_activity, data.module_action_breakdown || {});

        // ─── ACTIVITY TIMELINE ───
        renderTimeline(data.recent_activity);

    } catch (err) {
        console.error('Dashboard load error:', err);
    }
}

function parseBrowser(ua) {
    if (!ua) return 'Unknown';
    if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    return 'Browser';
}

// Load on page ready
renderDashSidebar();
loadDashboard();

// Show access denied toast if redirected from a blocked module
(function() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('access') === 'denied') {
        const mod = params.get('module') || 'that module';
        setTimeout(() => {
            let toast = document.getElementById('dashToast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'dashToast';
                toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#c62828;color:#fff;padding:12px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;gap:8px';
                document.body.appendChild(toast);
            }
            toast.innerHTML = '<span class="material-icons-outlined" style="font-size:18px">lock</span> Access denied: You do not have permission to access ' + esc(decodeURIComponent(mod));
            toast.style.display = 'flex';
            setTimeout(() => { toast.style.display = 'none'; }, 5000);
        }, 300);
        // Clean URL
        history.replaceState({}, '', '/');
    }
})();
