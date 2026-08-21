// ─── MANUFACTURING MODULE COMMON JS ───
const API = '/api/v1/manufacturing';
const token = localStorage.getItem('access_token') || localStorage.getItem('token') || '';
let tenantId = '';
if (token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        const identity = typeof payload.sub === 'string' ? JSON.parse(payload.sub) : payload.sub;
        if (identity && identity.tenant_id) {
            tenantId = identity.tenant_id;
        }
    } catch(e) {}
}

const HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
};
if (tenantId) {
    HEADERS['X-Tenant-ID'] = tenantId;
}

function showSection(sectionId) {
    if (!sectionId) sectionId = 'overview';
    if (!document.getElementById('sec-' + sectionId)) sectionId = 'overview';

    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.sidebar-link[data-section]').forEach(link => link.classList.remove('active'));

    document.getElementById('sec-' + sectionId).classList.add('active');
    const linkEl = document.querySelector(`.sidebar-link[data-section="${sectionId}"]`);
    if (linkEl) linkEl.classList.add('active');

    if (sectionId === 'overview') loadOverviewStats();
    else if (sectionId === 'bom') loadAssemblyBomList();
    else if (sectionId === 'productionorders') loadProductionOrders();
    else if (sectionId === 'workcenters') loadWorkCenters();
    else if (sectionId === 'routing') loadRoutings();
    else if (sectionId === 'planning') loadPlanning();
    else if (sectionId === 'capacity') loadCapacity();
    else if (sectionId === 'auditlogs') loadAuditLogs();
    else if (sectionId === 'moduleusers') loadModuleUsers();
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.background = type === 'error' ? '#c62828' : '#323232';
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

function openModal(title, contentHtml) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalBody').innerHTML = contentHtml;
    document.getElementById('manufacturingModalOverlay').classList.add('active');
}

function closeModal(id) {
    const target = id ? document.getElementById(id) : document.getElementById('manufacturingModalOverlay');
    if (target) target.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', () => {
    parseHashRoute();
});

window.addEventListener('hashchange', () => {
    parseHashRoute();
});

function parseHashRoute() {
    let hash = location.hash;
    if (!hash) {
        showSection('overview');
        return;
    }
    
    const parts = hash.split('#');
    let section = parts[1] || 'overview';
    let partCode = parts[2] || null;
    
    if (section.includes('?id=')) {
        const sub = section.split('?id=');
        section = sub[0];
        const bomId = sub[1];
        showSection(section);
        setTimeout(() => {
            if (typeof navigateToBomDetail === 'function') navigateToBomDetail(bomId);
        }, 150);
        return;
    }
    
    showSection(section);
    
    if (section === 'bom' && partCode) {
        setTimeout(() => {
            if (typeof navigateToBomDetailByPart === 'function') navigateToBomDetailByPart(partCode);
        }, 150);
    } else if (section === 'bom' && !partCode) {
        // If we backed out to main list, ensure details panel is hidden
        const detPanel = document.getElementById('bomDetailPanel');
        const listPanel = document.getElementById('bomListPanel');
        if (detPanel && listPanel) {
            detPanel.style.display = 'none';
            listPanel.style.display = 'block';
        }
    }
}
