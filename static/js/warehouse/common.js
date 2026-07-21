// ─── WAREHOUSE MODULE COMMON JS ───
const API = '/api/v1/warehouse';
const HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + (localStorage.getItem('access_token') || localStorage.getItem('token') || '')
};

function showSection(sectionId) {
    if (!sectionId) sectionId = 'overview';
    if (!document.getElementById('sec-' + sectionId)) sectionId = 'overview';

    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.sidebar-link[data-section]').forEach(link => link.classList.remove('active'));

    document.getElementById('sec-' + sectionId).classList.add('active');
    const linkEl = document.querySelector(`.sidebar-link[data-section="${sectionId}"]`);
    if (linkEl) linkEl.classList.add('active');

    if (sectionId === 'overview') loadOverviewStats();
    else if (sectionId === 'zones') loadZones();
    else if (sectionId === 'bins') loadBins();
    else if (sectionId === 'picklists') loadPickLists();
    else if (sectionId === 'putaway') loadPutawayTasks();
    else if (sectionId === 'receiving') loadReceipts();
    else if (sectionId === 'packing') loadPacking();
    else if (sectionId === 'shipping') loadShipping();
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
    document.getElementById('warehouseModalOverlay').classList.add('active');
}

function closeModal(id) {
    const target = id ? document.getElementById(id) : document.getElementById('warehouseModalOverlay');
    if (target) target.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', () => {
    const sec = location.hash.replace('#', '') || 'overview';
    showSection(sec);
});

window.addEventListener('hashchange', () => {
    const sec = location.hash.replace('#', '') || 'overview';
    showSection(sec);
});
