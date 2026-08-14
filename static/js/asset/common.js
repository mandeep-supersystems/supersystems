// ── ASSET MODULE COMMON ──────────────────────────────
const ASSET_API = '/api/v1/assets';

function ASSET_HEADERS() {
    return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (localStorage.getItem('access_token') || localStorage.getItem('token') || '')
    };
}

function assetShowSection(sectionId) {
    if (!sectionId) sectionId = 'overview';
    if (!document.getElementById('asset-sec-' + sectionId)) sectionId = 'overview';

    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.asset-sidebar-link[data-section]').forEach(l => l.classList.remove('active'));

    document.getElementById('asset-sec-' + sectionId).classList.add('active');
    const link = document.querySelector(`.asset-sidebar-link[data-section="${sectionId}"]`);
    if (link) link.classList.add('active');

    if      (sectionId === 'overview')     assetLoadOverview();
    else if (sectionId === 'register')     { loadSeries(); loadAssets(); }
    else if (sectionId === 'depreciation') assetLoadDepreciation();
    else if (sectionId === 'transfers')    assetLoadTransfers();
    else if (sectionId === 'disposal')     assetLoadDisposal();
    else if (sectionId === 'maintenance')  assetLoadMaintenance();
    else if (sectionId === 'moduleusers')  assetLoadModuleUsers();
}

function assetShowToast(msg, type = 'success') {
    const t = document.getElementById('assetToast');
    if (!t) return;
    t.textContent = msg;
    t.style.background = type === 'error' ? '#c62828' : '#323232';
    t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 3000);
}

function assetOpenModal(title, html) {
    document.getElementById('assetModalTitle').innerText = title;
    document.getElementById('assetModalBody').innerHTML = html;
    document.getElementById('assetModalOverlay').classList.add('active');
}

function assetCloseModal(id) {
    const target = id ? document.getElementById(id) : document.getElementById('assetModalOverlay');
    if (target) target.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', () => {
    const sec = location.hash.replace('#', '') || 'overview';
    assetShowSection(sec);
});

window.addEventListener('hashchange', () => {
    const sec = location.hash.replace('#', '') || 'overview';
    assetShowSection(sec);
});
