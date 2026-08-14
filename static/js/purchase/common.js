// ─── PURCHASE MODULE COMMON JS ───
const API = '/api/v1/purchase';
const HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + (localStorage.getItem('access_token') || localStorage.getItem('token') || ''),
    'X-Tenant-ID': 'TEST'
};
try {
    const token = localStorage.getItem('access_token');
    if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const identity = typeof payload.sub === 'string' ? JSON.parse(payload.sub) : payload.sub;
        if (identity.tenant_id) HEADERS['X-Tenant-ID'] = identity.tenant_id;
    }
} catch(e) {}

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
    else if (sectionId === 'lead-times') loadLeadTimes();
    else if (sectionId === 'pr-inbox') loadPurchaseRequests();
    else if (sectionId === 'buy-material') loadBuyMaterialSection();
    else if (sectionId === 'orders') loadPurchaseOrders();
    else if (sectionId === 'invoices') loadAllInvoices();
    else if (sectionId === 'history') loadPurchaseHistory();
    else if (sectionId === 'auditlogs') loadAuditLogs();
    else if (sectionId === 'moduleusers') loadModuleUsers();
}

// ─── SUPPLIER SEARCH HELPER (used in PO create modal) ───
let _supSearchTimer = null;
async function searchSuppliersInPurchase(q, resultsId, hiddenId, selectedId, labelId) {
    clearTimeout(_supSearchTimer);
    const results = document.getElementById(resultsId);
    if (!results) return;
    if (!q || q.length < 2) { results.innerHTML = ''; return; }
    _supSearchTimer = setTimeout(async () => {
        try {
            const res = await fetch(API + '/search-suppliers?q=' + encodeURIComponent(q), { headers: HEADERS });
            const json = await res.json();
            if (!json.data || !json.data.length) {
                results.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:13px;">No suppliers found</div>';
                return;
            }
            results.innerHTML = json.data.map(s =>
                `<div class="org-search-item" onclick="selectSupplierInPurchase('${s.id}','${s.supplier_code}','${s.brand_name}','${resultsId}','${hiddenId}','${selectedId}','${labelId}')">
                    <strong>${s.brand_name}</strong> <span style="color:var(--text-muted);font-size:12px;">${s.supplier_code}</span>
                </div>`
            ).join('');
        } catch(e) { results.innerHTML = ''; }
    }, 300);
}

function selectSupplierInPurchase(id, code, name, resultsId, hiddenId, selectedId, labelId) {
    document.getElementById(hiddenId).value = id;
    document.getElementById(resultsId).innerHTML = '';
    document.getElementById(labelId).textContent = `${name} (${code})`;
    document.getElementById(selectedId).style.display = 'flex';
    // Also fill supplier name text field if present
    const nameField = document.getElementById('poSupplierName');
    if (nameField) nameField.value = name;
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
