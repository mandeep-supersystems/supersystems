const API = '/api/v1/procurement';
const PROJ_API = '/api/v1/projects';
const tenant = JSON.parse(localStorage.getItem('tenant') || '{}');
const HEADERS = { 'Content-Type': 'application/json', 'X-Tenant-ID': tenant.id || tenant.code || 'TEST', 'X-User-Email': JSON.parse(localStorage.getItem('user') || '{}').email || '', 'X-User-Name': (JSON.parse(localStorage.getItem('user') || '{}').first_name || '') };

const PROC_SECTIONS = [
    { id: 'purchaseorders', label: 'Purchase Orders', icon: 'receipt_long' },
    { id: 'addpo',          label: 'Add Purchase Order', icon: 'add_circle' },
];
function showSection(sec) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link[data-section]').forEach(l => l.classList.remove('active'));
    const el = document.getElementById('sec-' + sec);
    if (el) el.classList.add('active');
    const link = document.querySelector(`.sidebar-link[data-section="${sec}"]`);
    if (link) link.classList.add('active');
    history.pushState(null, '', '/procurement/' + sec);
    const s = PROC_SECTIONS.find(x => x.id === sec);
    if (s) trackModule(s.label, s.icon, '/procurement/' + sec);
    if (sec === 'purchaseorders') loadPOs();
}

// ─── PO LIST ───
async function loadPOs() {
    const tbody = document.getElementById('poTableBody');
    try {
        const res = await fetch(API + '/purchase-orders', { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data.length) { tbody.innerHTML = '<tr><td colspan="12" class="empty">No purchase orders yet.</td></tr>'; return; }
        tbody.innerHTML = data.data.map(po => `<tr>
            <td><strong>${esc(po.po_number)}</strong></td>
            <td>${po.po_date}</td>
            <td>${esc(po.project_name)}</td>
            <td>${esc(po.customer_part_number)}</td>
            <td>${po.quantity}</td>
            <td>₹${po.price_per_quantity.toLocaleString()}</td>
            <td><strong>₹${po.total_amount.toLocaleString()}</strong></td>
            <td>${po.delivery_date_etd}</td>
            <td>${po.delivery_date_eta}</td>
            <td>${esc(po.deliver_by)}</td>
            <td><span class="status-badge status-${po.status}">${po.status}</span></td>
            <td class="actions-cell">
                <button class="btn-icon" title="Edit" onclick="openEditPO(${JSON.stringify(po).replace(/"/g,'&quot;')})"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-icon danger" title="Delete" onclick="deletePO('${po.id}','${esc(po.po_number)}')"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>`).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="12" class="empty">Error loading</td></tr>'; }
}

// ─── PROJECT SEARCH ───
let projSearchTimeout = null;
function searchProjectsForPO(q) {
    clearTimeout(projSearchTimeout);
    const results = document.getElementById('poProjResults');
    if (!q || q.trim().length < 2) { results.innerHTML = ''; return; }
    projSearchTimeout = setTimeout(async () => {
        const res = await fetch(API + '/search-projects?q=' + encodeURIComponent(q.trim()), { headers: HEADERS });
        const data = await res.json();
        if (!data.data || !data.data.length) { results.innerHTML = '<div class="org-search-empty">No projects found</div>'; return; }
        results.innerHTML = data.data.map(p => `
            <div class="org-search-item" onclick="selectProjectForPO('${p.id}','${esc(p.code)}','${esc(p.name)}')">
                <strong>${esc(p.code)}</strong> — ${esc(p.name)}
            </div>
        `).join('');
    }, 300);
}

function selectProjectForPO(id, code, name) {
    document.getElementById('poProjId').value = id;
    document.getElementById('poProjSearch').value = '';
    document.getElementById('poProjResults').innerHTML = '';
    document.getElementById('poProjSelLabel').textContent = `${code} — ${name}`;
    document.getElementById('poProjSelected').style.display = 'flex';
    // Also fetch project's org
    fetch(PROJ_API + '/projects/' + id, { headers: HEADERS }).then(r => r.json()).then(d => {
        if (d.success && d.data.organization_id) document.getElementById('poOrgId').value = d.data.organization_id;
    });
}

function clearProjSelection() {
    document.getElementById('poProjId').value = '';
    document.getElementById('poOrgId').value = '';
    document.getElementById('poProjSelected').style.display = 'none';
}

function calcPOTotal() {
    const qty = parseFloat(document.getElementById('poQty').value) || 0;
    const ppq = parseFloat(document.getElementById('poPPQ').value) || 0;
    document.getElementById('poTotal').value = (qty * ppq).toFixed(2);
}
function calcEPTotal() {
    const qty = parseFloat(document.getElementById('epQty').value) || 0;
    const ppq = parseFloat(document.getElementById('epPPQ').value) || 0;
    document.getElementById('epTotal').value = (qty * ppq).toFixed(2);
}

// ─── SAVE PO ───
async function savePO(e) {
    e.preventDefault();
    const body = {
        po_number: document.getElementById('poNum').value.trim(),
        po_date: document.getElementById('poDate').value || null,
        project_id: document.getElementById('poProjId').value || null,
        organization_id: document.getElementById('poOrgId').value || null,
        customer_part_number: document.getElementById('poCPN').value.trim(),
        quantity: parseFloat(document.getElementById('poQty').value) || 0,
        price_per_quantity: parseFloat(document.getElementById('poPPQ').value) || 0,
        delivery_date_etd: document.getElementById('poETD').value || null,
        delivery_date_eta: document.getElementById('poETA').value || null,
        deliver_by: document.getElementById('poDeliverBy').value,
        location: document.getElementById('poLocation').value.trim(),
        remarks: document.getElementById('poRemarks').value.trim()
    };
    const res = await fetch(API + '/purchase-orders', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) {
        alert('Purchase Order created!');
        document.querySelectorAll('#sec-addpo input, #sec-addpo select, #sec-addpo textarea').forEach(el => { if (el.type !== 'submit' && el.type !== 'hidden') el.value = ''; });
        clearProjSelection();
        showSection('purchaseorders');
    } else { alert(data.message); }
}

// ─── EDIT PO ───
function openEditPO(po) {
    document.getElementById('epId').value = po.id;
    document.getElementById('epNum').value = po.po_number;
    document.getElementById('epDate').value = po.po_date;
    document.getElementById('epCPN').value = po.customer_part_number;
    document.getElementById('epQty').value = po.quantity;
    document.getElementById('epPPQ').value = po.price_per_quantity;
    document.getElementById('epTotal').value = po.total_amount;
    document.getElementById('epETD').value = po.delivery_date_etd;
    document.getElementById('epETA').value = po.delivery_date_eta;
    document.getElementById('epDeliverBy').value = po.deliver_by;
    document.getElementById('epLocation').value = po.location;
    document.getElementById('epStatus').value = po.status;
    document.getElementById('epRemarks').value = po.remarks;
    openModal('editPOModal');
}

async function updatePO(e) {
    e.preventDefault();
    const id = document.getElementById('epId').value;
    const body = {
        po_date: document.getElementById('epDate').value || null,
        customer_part_number: document.getElementById('epCPN').value.trim(),
        quantity: parseFloat(document.getElementById('epQty').value) || 0,
        price_per_quantity: parseFloat(document.getElementById('epPPQ').value) || 0,
        delivery_date_etd: document.getElementById('epETD').value || null,
        delivery_date_eta: document.getElementById('epETA').value || null,
        deliver_by: document.getElementById('epDeliverBy').value,
        location: document.getElementById('epLocation').value.trim(),
        status: document.getElementById('epStatus').value,
        remarks: document.getElementById('epRemarks').value.trim()
    };
    const res = await fetch(API + '/purchase-orders/' + id, { method: 'PUT', headers: HEADERS, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('editPOModal'); loadPOs(); } else { alert(data.message); }
}

async function deletePO(id, num) {
    if (!confirm(`Delete PO "${num}"?`)) return;
    const res = await fetch(API + '/purchase-orders/' + id, { method: 'DELETE', headers: HEADERS });
    const data = await res.json();
    if (data.success) loadPOs(); else alert(data.message);
}

// ─── HELPERS ───
function esc(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// ─── INIT ───
(function() {
    const path = window.location.pathname;
    const section = path.split('/procurement/')[1] || 'purchaseorders';
    // Check if redirected from project with project_id
    const params = new URLSearchParams(window.location.search);
    if (params.get('project_id') && params.get('project_name')) {
        document.getElementById('poProjId').value = params.get('project_id');
        document.getElementById('poProjSelLabel').textContent = params.get('project_name');
        document.getElementById('poProjSelected').style.display = 'flex';
        showSection('addpo');
    } else {
        const valid = ['purchaseorders', 'addpo'];
        if (valid.includes(section)) showSection(section); else showSection('purchaseorders');
    }
})();
window.addEventListener('popstate', () => { const s = window.location.pathname.split('/procurement/')[1] || 'purchaseorders'; showSection(s); });
