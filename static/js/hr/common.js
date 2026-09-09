// ─── HR MODULE: SHARED ───
const API = '/api/v1/hr';
const headers = () => {
    let tid = '';
    let userEmail = '';
    let userName = '';
    try {
        const tenant = JSON.parse(localStorage.getItem('tenant') || '{}');
        tid = tenant.id || tenant.code || '';
    } catch(e) {}
    if (!tid) {
        tid = localStorage.getItem('tenant_id') || 'b424df0e-f766-4e94-b3fd-05777e158958';
    }
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        userEmail = user.email || localStorage.getItem('user_email') || '';
        userName = (((user.first_name || '') + ' ' + (user.last_name || '')).trim()) || localStorage.getItem('user_name') || '';
    } catch(e) {}
    const token = localStorage.getItem('access_token') || '';
    return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'X-Tenant-ID': tid,
        'X-User-Email': userEmail,
        'X-User-Name': userName
    };
};

let criteriaList = [];
let employeesList = [];

function showSection(sec) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link[data-section]').forEach(l => l.classList.remove('active'));
    const el = document.getElementById('sec-' + sec);
    if (el) el.classList.add('active');
    const link = document.querySelector(`.sidebar-link[data-section="${sec}"]`);
    if (link) link.classList.add('active');
    if (location.hash !== '#' + sec) location.hash = sec;
    if (sec === 'overview' && typeof loadHROverview === 'function') loadHROverview();
    if (sec === 'codecriteria' && typeof loadCriteria === 'function') loadCriteria();
    if (sec === 'employees' && typeof loadEmployees === 'function') loadEmployees();
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function buildPreview(prefix, psep, num, ssep, suffix) {
    let code = String(num);
    if (prefix) code = prefix + (psep || '') + code;
    if (suffix) code = code + (ssep || '') + suffix;
    return code;
}

// ─── INIT ───
// Only activate hash-based section routing on pages that have .content-section elements
const _HR_VALID = ['overview', 'codecriteria', 'employees'];
window.addEventListener('hashchange', () => {
    if (!document.querySelector('.content-section')) return;
    const hash = location.hash.replace('#', '') || 'overview';
    showSection(_HR_VALID.includes(hash) ? hash : 'overview');
});
document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('.content-section')) return;
    const hash = location.hash.replace('#', '') || 'overview';
    showSection(_HR_VALID.includes(hash) ? hash : 'overview');
});

// ─── UNIVERSAL HR PAGE HISTORY DRAWER ───
let _pageHistoryItems = [];

function _ensureHistoryDrawer() {
    if (document.getElementById('hrHistoryDrawer')) return;
    const overlay = document.createElement('div');
    overlay.id = 'hrHistoryOverlay';
    overlay.className = 'hr-history-overlay';
    overlay.onclick = closePageHistory;
    document.body.appendChild(overlay);

    const drawer = document.createElement('div');
    drawer.id = 'hrHistoryDrawer';
    drawer.className = 'hr-history-drawer';
    drawer.innerHTML = `
        <div class="history-drawer-header">
            <div style="display:flex;align-items:center;gap:8px">
                <span class="material-icons-outlined" style="color:var(--primary,#1a73e8)">history</span>
                <h3 id="hrHistoryTitle">Page History</h3>
            </div>
            <button class="close-btn" onclick="closePageHistory()"><span class="material-icons-outlined">close</span></button>
        </div>
        <div class="history-drawer-search">
            <input type="text" id="hrHistorySearch" placeholder="Filter by user email, entity, field..." oninput="_filterHistoryDrawer()">
        </div>
        <div class="history-drawer-body" id="hrHistoryBody">
            <div style="text-align:center;padding:30px;color:var(--text-secondary)">Loading history...</div>
        </div>
    `;
    document.body.appendChild(drawer);
}

async function openPageHistory(entityTypes = '', pageTitle = 'Page History') {
    _ensureHistoryDrawer();
    const drawer = document.getElementById('hrHistoryDrawer');
    const overlay = document.getElementById('hrHistoryOverlay');
    const titleEl = document.getElementById('hrHistoryTitle');
    const bodyEl = document.getElementById('hrHistoryBody');
    const searchInput = document.getElementById('hrHistorySearch');

    if (titleEl) titleEl.textContent = pageTitle;
    if (searchInput) searchInput.value = '';
    if (bodyEl) bodyEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-secondary)">Loading history...</div>';

    drawer.classList.add('open');
    overlay.classList.add('open');

    let url = `${API}/audit-logs?limit=50`;
    if (entityTypes) url += `&entity_type=${encodeURIComponent(entityTypes)}`;

    try {
        const res = await fetch(url, { headers: headers() });
        const resJson = await res.json();
        _pageHistoryItems = (resJson.data && resJson.data.items) || [];
        _renderHistoryDrawerItems(_pageHistoryItems);
    } catch (e) {
        if (bodyEl) bodyEl.innerHTML = `<div style="text-align:center;padding:30px;color:#d32f2f">Failed to load history: ${e.message}</div>`;
    }
}

function closePageHistory() {
    const drawer = document.getElementById('hrHistoryDrawer');
    const overlay = document.getElementById('hrHistoryOverlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
}

function _filterHistoryDrawer() {
    const q = (document.getElementById('hrHistorySearch')?.value || '').toLowerCase().trim();
    if (!q) {
        _renderHistoryDrawerItems(_pageHistoryItems);
        return;
    }
    const filtered = _pageHistoryItems.filter(item => {
        const user = (item.user_email || '') + ' ' + (item.user_name || '');
        const entity = (item.entity_type || '') + ' ' + (item.entity_id || '');
        const action = item.action || '';
        const changes = JSON.stringify(item.changes || {});
        return (user + ' ' + entity + ' ' + action + ' ' + changes).toLowerCase().includes(q);
    });
    _renderHistoryDrawerItems(filtered);
}

function _renderHistoryDrawerItems(items) {
    const bodyEl = document.getElementById('hrHistoryBody');
    if (!bodyEl) return;

    if (!items || !items.length) {
        bodyEl.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text-secondary)"><span class="material-icons-outlined" style="font-size:36px;opacity:0.5;display:block;margin-bottom:8px">history</span>No history records found</div>';
        return;
    }

    bodyEl.innerHTML = items.map(item => {
        const action = (item.action || 'UPDATE').toUpperCase();
        let badgeClass = 'badge-other';
        if (action === 'CREATE') badgeClass = 'badge-create';
        else if (action === 'UPDATE') badgeClass = 'badge-update';
        else if (action === 'DELETE') badgeClass = 'badge-delete';
        else if (action === 'APPROVE') badgeClass = 'badge-approve';
        else if (action === 'REJECT') badgeClass = 'badge-reject';

        const timeStr = item.created_at ? item.created_at.replace('T', ' ').substring(0, 19) : '—';
        const userDisplay = item.user_email ? `${item.user_email}${item.user_name ? ` (${item.user_name})` : ''}` : 'System / Automated';

        const changes = item.changes || {};
        const changeKeys = Object.keys(changes);
        let diffHtml = '';

        if (changeKeys.length > 0) {
            diffHtml = `<div class="history-diff-box">
                ${changeKeys.map(k => {
                    const d = changes[k] || {};
                    const oldV = d.old !== null && d.old !== undefined ? String(d.old) : 'none';
                    const newV = d.new !== null && d.new !== undefined ? String(d.new) : 'none';
                    return `<div class="history-diff-row">
                        <span class="history-diff-key">${k}:</span>
                        <span class="history-diff-old">${oldV}</span>
                        <span class="history-diff-arrow">→</span>
                        <span class="history-diff-new">${newV}</span>
                    </div>`;
                }).join('')}
            </div>`;
        } else if (item.extra_data && item.extra_data.new) {
            const entries = Object.entries(item.extra_data.new).slice(0, 4);
            diffHtml = `<div class="history-diff-box">
                ${entries.map(([k, v]) => `
                    <div class="history-diff-row">
                        <span class="history-diff-key">${k}:</span>
                        <span class="history-diff-new">${String(v ?? '')}</span>
                    </div>
                `).join('')}
            </div>`;
        }

        return `
            <div class="history-item">
                <div class="history-item-top">
                    <span class="badge-action ${badgeClass}">${action}</span>
                    <span style="font-size:11px;color:var(--text-secondary)">${timeStr}</span>
                </div>
                <div class="history-item-entity">${item.entity_type || 'HR'}: <strong>${item.entity_id || '—'}</strong></div>
                <div class="history-item-meta">
                    <span class="material-icons-outlined" style="font-size:14px">person</span>
                    <span class="history-item-user">${userDisplay}</span>
                    ${item.ip_address ? `<span>•</span><span>${item.ip_address}</span>` : ''}
                </div>
                ${diffHtml}
            </div>
        `;
    }).join('');
}

