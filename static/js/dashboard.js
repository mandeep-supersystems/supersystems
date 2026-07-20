let currentPeriod = 'month';

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── USER STORAGE KEY HELPER ───
function _getDashUserStorageKey(prefix) {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const uid = user.id || user.email || 'guest';
        return `${prefix}_${uid}`;
    } catch(e) {
        return `${prefix}_guest`;
    }
}

// ─── SIDEBAR: RECENT MODULES (USER-SCOPED) ───
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

    // Recently visited (exclude current)
    const recentEl = document.getElementById('dsb-recent');
    if (recentEl) {
        const filtered = recent.filter(m => m.route !== currentPath).slice(0, 8);
        if (filtered.length === 0) {
            recentEl.innerHTML = '<div class="dsb-empty">No recent modules</div>';
        } else {
            recentEl.innerHTML = filtered.map(m => `
                <a class="dsb-item" href="${m.route}">
                    <span class="material-icons-outlined">${m.icon || 'apps'}</span>
                    <span>${esc(m.name)}</span>
                </a>`).join('');
        }
    }
}

// Period filter buttons
document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPeriod = btn.dataset.period;
        loadDashboard();
    });
});

async function loadDashboard() {
    renderDashSidebar(); // Re-render sidebar per user immediately
    const token = localStorage.getItem('access_token');
    if (!token) {
        // No token — just show empty state, don't redirect
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

        // Stats
        document.getElementById('statLogins').textContent = data.login_count || 0;
        document.getElementById('statActions').textContent = data.total_actions || 0;
        document.getElementById('statCreates').textContent = data.work_summary.CREATE || 0;
        document.getElementById('statUpdates').textContent = data.work_summary.UPDATE || 0;

        // Recent Logins
        renderLogins(data.recent_logins);

        // Module Activity
        renderModuleActivity(data.module_activity);

        // Audit Trail
        renderAuditTrail(data.recent_activity);

    } catch (err) {
        console.error('Dashboard load error:', err);
    }
}

function renderLogins(logins) {
    const container = document.getElementById('recentLoginsBody');
    if (!logins || logins.length === 0) {
        container.innerHTML = '<div class="empty-state">No login records found for this period</div>';
        return;
    }
    container.innerHTML = logins.map(l => {
        const dt = new Date(l.login_at);
        const timeStr = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
            ' ' + dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const browser = parseBrowser(l.user_agent || '');
        return `<div class="login-item">
            <div class="login-icon"><span class="material-icons-outlined">login</span></div>
            <div class="login-details">
                <div class="login-time">${timeStr}</div>
                <div class="login-meta">${l.ip_address || 'Unknown IP'} • ${browser}</div>
            </div>
        </div>`;
    }).join('');
}

function renderModuleActivity(modules) {
    const container = document.getElementById('moduleActivityBody');
    if (!modules || modules.length === 0) {
        container.innerHTML = '<div class="empty-state">No module activity for this period</div>';
        return;
    }
    const max = Math.max(...modules.map(m => m.count));
    container.innerHTML = modules.map(m => {
        const pct = max > 0 ? (m.count / max) * 100 : 0;
        return `<div class="module-bar">
            <span class="module-bar-label">${m.module}</span>
            <div class="module-bar-track"><div class="module-bar-fill" style="width:${pct}%"></div></div>
            <span class="module-bar-count">${m.count}</span>
        </div>`;
    }).join('');
}

function renderAuditTrail(activities) {
    const tbody = document.getElementById('auditTableBody');
    if (!activities || activities.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No activity recorded for this period</td></tr>';
        return;
    }
    tbody.innerHTML = activities.map(a => {
        const dt = new Date(a.created_at);
        const timeStr = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) +
            ' ' + dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const actionClass = (a.action || '').toLowerCase();
        return `<tr>
            <td>${timeStr}</td>
            <td><span class="action-badge ${actionClass}">${a.action}</span></td>
            <td>${a.module || '-'}</td>
            <td>${a.entity_type || '-'}</td>
            <td>${a.ip_address || '-'}</td>
        </tr>`;
    }).join('');
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
