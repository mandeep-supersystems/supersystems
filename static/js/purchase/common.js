// ─── PURCHASE MODULE COMMON JS ───
const API = '/api/v1/purchase';
const HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + (localStorage.getItem('access_token') || localStorage.getItem('token') || '')
};

function showSection(sectionId, pushState = true) {
    if (!sectionId) sectionId = 'overview';

    const targetSec = document.getElementById('sec-' + sectionId);
    if (!targetSec) sectionId = 'overview';

    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));

    const secEl = document.getElementById('sec-' + sectionId);
    const linkEl = document.querySelector(`.sidebar-link[data-section="${sectionId}"]`);

    if (secEl) secEl.classList.add('active');
    if (linkEl) linkEl.classList.add('active');

    if (pushState && window.location.pathname !== '/purchase/' + sectionId) {
        history.pushState(null, '', '/purchase/' + sectionId);
    }

    if (sectionId === 'overview') loadOverviewStats();
    else if (sectionId === 'demand') loadCustomerDemands();
    else if (sectionId === 'suppliers') loadSupplierRules();
    else if (sectionId === 'requisitions') loadRequisitions();
    else if (sectionId === 'orders') loadPurchaseOrders();
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
    document.getElementById('purchaseModalOverlay').classList.add('active');
}

function closeModal(id = 'purchaseModalOverlay') {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', () => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const sec = parts.length > 1 ? parts[1] : 'overview';
    showSection(sec, false);
});

window.onpopstate = () => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const sec = parts.length > 1 ? parts[1] : 'overview';
    showSection(sec, false);
};
