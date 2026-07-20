// ─── PROCUREMENT MODULE: PURCHASE ORDERS ───

const PART_API = '/api/v1/part';

// ─── LINE ITEM TEMPLATE (with unit + mapped part info) ───
function lineItemHTML(prefix, idx, data = {}) {
    return `<div class="repeater-card" data-idx="${idx}">
        <div class="repeater-card-header"><span>Part #${idx + 1}</span><button type="button" class="btn-icon danger" onclick="removeLineItem(this,'${prefix}')"><span class="material-icons-outlined">close</span></button></div>
        <div class="form-row">
            <div class="form-group"><label>Customer Part Number *</label><input type="text" class="li-cpn" value="${esc(data.customer_part_number || '')}" required oninput="lookupMapping(this)"></div>
            <div class="form-group"><label>Part Code</label><input type="text" class="li-ipn" value="${esc(data.internal_part_number || '')}" readonly style="background:var(--bg-secondary);cursor:default"></div>
            <div class="form-group" style="flex:2"><label>Description</label><input type="text" class="li-desc" value="${esc(data.internal_description || '')}" readonly style="background:var(--bg-secondary);cursor:default"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Quantity *</label><input type="number" class="li-qty" step="0.01" value="${data.quantity || 0}" oninput="recalcTotal('${prefix}')"></div>
            <div class="form-group"><label>Unit</label><select class="li-unit"><option value="">Select</option><option value="Pcs" ${data.unit==='Pcs'?'selected':''}>Pcs</option><option value="Kg" ${data.unit==='Kg'?'selected':''}>Kg</option><option value="Mtr" ${data.unit==='Mtr'?'selected':''}>Mtr</option><option value="Ltr" ${data.unit==='Ltr'?'selected':''}>Ltr</option><option value="Set" ${data.unit==='Set'?'selected':''}>Set</option><option value="Box" ${data.unit==='Box'?'selected':''}>Box</option><option value="Nos" ${data.unit==='Nos'?'selected':''}>Nos</option></select></div>
            <div class="form-group"><label>Price/Qty (₹)</label><input type="number" class="li-ppq" step="0.01" value="${data.price_per_quantity || 0}" oninput="recalcTotal('${prefix}')"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>ETD</label><input type="date" class="li-etd" value="${data.delivery_date_etd || ''}"></div>
            <div class="form-group"><label>ETA</label><input type="date" class="li-eta" value="${data.delivery_date_eta || ''}"></div>
            <div class="form-group"><label>Deliver By</label><select class="li-deliver"><option value="">Select</option><option value="Air" ${data.deliver_by==='Air'?'selected':''}>Air</option><option value="Sea" ${data.deliver_by==='Sea'?'selected':''}>Sea</option><option value="Road" ${data.deliver_by==='Road'?'selected':''}>Road</option><option value="Rail" ${data.deliver_by==='Rail'?'selected':''}>Rail</option><option value="Courier" ${data.deliver_by==='Courier'?'selected':''}>Courier</option></select></div>
            <div class="form-group"><label>Location</label><input type="text" class="li-location" value="${esc(data.location || '')}"></div>
        </div>
    </div>`;
}

// ─── AUTO-LOOKUP MAPPING when customer part number is typed ───
let mappingLookupTimeout = null;
function lookupMapping(input) {
    clearTimeout(mappingLookupTimeout);
    const cpn = input.value.trim();
    const card = input.closest('.repeater-card');
    if (!cpn || cpn.length < 2) { card.querySelector('.li-ipn').value = ''; card.querySelector('.li-desc').value = ''; return; }
    mappingLookupTimeout = setTimeout(async () => {
        try {
            const res = await fetch(PART_API + '/lookup-mapping?customer_part_number=' + encodeURIComponent(cpn), { headers: HEADERS });
            const data = await res.json();
            if (data.success && data.data) {
                card.querySelector('.li-ipn').value = data.data.internal_part_number || '';
                card.querySelector('.li-desc').value = data.data.internal_description || '';
            } else {
                card.querySelector('.li-ipn').value = '';
                card.querySelector('.li-desc').value = '';
            }
        } catch(e) { }
    }, 400);
}

function addLineItem() {
    const container = document.getElementById('poLineItems');
    const idx = container.querySelectorAll('.repeater-card').length;
    container.insertAdjacentHTML('beforeend', lineItemHTML('poLineItems', idx));
}

function addEditLineItem() {
    const container = document.getElementById('epLineItems');
    const idx = container.querySelectorAll('.repeater-card').length;
    container.insertAdjacentHTML('beforeend', lineItemHTML('epLineItems', idx));
}

function removeLineItem(btn, prefix) {
    btn.closest('.repeater-card').remove();
    recalcTotal(prefix);
}

function recalcTotal(prefix) {
    const container = document.getElementById(prefix);
    let total = 0;
    container.querySelectorAll('.repeater-card').forEach(card => {
        const qty = parseFloat(card.querySelector('.li-qty').value) || 0;
        const ppq = parseFloat(card.querySelector('.li-ppq').value) || 0;
        total += qty * ppq;
    });
    const totalEl = prefix === 'poLineItems' ? document.getElementById('poGrandTotal') : document.getElementById('epGrandTotal');
    totalEl.textContent = total.toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

function collectLines(containerId) {
    const lines = [];
    document.getElementById(containerId).querySelectorAll('.repeater-card').forEach(card => {
        lines.push({
            customer_part_number: card.querySelector('.li-cpn').value.trim(),
            internal_part_number: card.querySelector('.li-ipn').value.trim(),
            internal_description: card.querySelector('.li-desc').value.trim(),
            quantity: parseFloat(card.querySelector('.li-qty').value) || 0,
            unit: card.querySelector('.li-unit').value,
            price_per_quantity: parseFloat(card.querySelector('.li-ppq').value) || 0,
            delivery_date_etd: card.querySelector('.li-etd').value || '',
            delivery_date_eta: card.querySelector('.li-eta').value || '',
            deliver_by: card.querySelector('.li-deliver').value,
            location: card.querySelector('.li-location').value.trim()
        });
    });
    return lines;
}

// ─── LOAD POs (clickable PO number) ───
async function loadPOs() {
    const tbody = document.getElementById('poTableBody');
    try {
        const res = await fetch(API + '/purchase-orders', { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No purchase orders yet.</td></tr>'; return; }
        tbody.innerHTML = data.data.map(po => {
            const mapped = (po.lines || []).filter(l => l.internal_part_number).length;
            const total = (po.lines || []).length;
            const mapLabel = mapped === total ? `<span style="color:var(--success)">${mapped}/${total} mapped</span>` : `<span style="color:var(--warning)">${mapped}/${total} mapped</span>`;
            return `<tr>
            <td><a href="#" class="link-clickable" onclick='openPODetail(${JSON.stringify(po).replace(/'/g,"&#39;")});return false'><strong>${esc(po.po_number)}</strong></a></td>
            <td>${po.po_date}</td><td>${esc(po.project_name)}</td>
            <td>${po.line_count} part${po.line_count !== 1 ? 's' : ''} <small>(${mapLabel})</small></td>
            <td><strong>₹${po.total_amount.toLocaleString()}</strong></td>
            <td><span class="status-badge status-${po.status}">${po.status}</span></td>
            <td class="actions-cell">
                <button class="btn-icon" title="View" onclick='openPODetail(${JSON.stringify(po).replace(/'/g,"&#39;")})'><span class="material-icons-outlined">visibility</span></button>
                <button class="btn-icon" title="Edit" onclick='openEditPO(${JSON.stringify(po).replace(/'/g,"&#39;")})'><span class="material-icons-outlined">edit</span></button>
                <button class="btn-icon danger" title="Delete" onclick="deletePO('${po.id}','${esc(po.po_number)}')"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>`;
        }).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="7" class="empty">Error loading</td></tr>'; }
}

// ─── PO DETAIL PAGE (full page, not modal) ───
function openPODetail(po) {
    currentPO = po;
    showSection('podetail');
}

function renderPODetail(po) {
    document.getElementById('pdPoTitle').textContent = po.po_number;
    document.getElementById('pdPoInfo').innerHTML = `<div class="org-detail-grid">
        <div><strong>PO Number:</strong> ${esc(po.po_number)}</div>
        <div><strong>Date:</strong> ${po.po_date || '—'}</div>
        <div><strong>Project:</strong> ${esc(po.project_name) || '—'}</div>
        <div><strong>Status:</strong> <span class="status-badge status-${po.status}">${po.status}</span></div>
        ${po.remarks ? `<div><strong>Remarks:</strong> ${esc(po.remarks)}</div>` : ''}
    </div>`;
    const lines = po.lines || [];
    const tbody = document.getElementById('pdPoLinesBody');
    if (!lines.length) { tbody.innerHTML = '<tr><td colspan="12" class="empty">No line items</td></tr>'; return; }
    let grandTotal = 0;
    tbody.innerHTML = lines.map((l, i) => {
        const lineTotal = (parseFloat(l.quantity) || 0) * (parseFloat(l.price_per_quantity) || 0);
        grandTotal += lineTotal;
        return `<tr>
            <td>${i + 1}</td><td><strong>${esc(l.customer_part_number)}</strong></td>
            <td>${esc(l.internal_part_number) || '<span class="text-muted">—</span>'}</td>
            <td><span class="desc-cell">${esc(l.internal_description) || '—'}</span></td>
            <td>${l.quantity}</td><td>${esc(l.unit) || '—'}</td>
            <td>₹${parseFloat(l.price_per_quantity || 0).toLocaleString()}</td>
            <td><strong>₹${lineTotal.toLocaleString()}</strong></td>
            <td>${l.delivery_date_etd || '—'}</td><td>${l.delivery_date_eta || '—'}</td>
            <td>${esc(l.deliver_by) || '—'}</td><td>${esc(l.location) || '—'}</td>
        </tr>`;
    }).join('');
    document.getElementById('pdPoTotal').innerHTML = `<strong>Grand Total: ₹${grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong>`;
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
        results.innerHTML = data.data.map(p => `<div class="org-search-item" onclick="selectProjectForPO('${p.id}','${esc(p.code)}','${esc(p.name)}')"><strong>${esc(p.code)}</strong> — ${esc(p.name)}</div>`).join('');
    }, 300);
}
function selectProjectForPO(id, code, name) {
    document.getElementById('poProjId').value = id; document.getElementById('poProjSearch').value = ''; document.getElementById('poProjResults').innerHTML = '';
    document.getElementById('poProjSelLabel').textContent = `${code} — ${name}`; document.getElementById('poProjSelected').style.display = 'flex';
    fetch(PROJ_API + '/projects/' + id, { headers: HEADERS }).then(r => r.json()).then(d => { if (d.success && d.data.organization_id) document.getElementById('poOrgId').value = d.data.organization_id; });
}
function clearProjSelection() { document.getElementById('poProjId').value = ''; document.getElementById('poOrgId').value = ''; document.getElementById('poProjSelected').style.display = 'none'; }

// ─── SAVE PO ───
async function savePO(e) {
    e.preventDefault();
    const lines = collectLines('poLineItems');
    if (!lines.length) { alert('Add at least one line item'); return; }
    const body = { po_number: document.getElementById('poNum').value.trim(), po_date: document.getElementById('poDate').value || null, project_id: document.getElementById('poProjId').value || null, organization_id: document.getElementById('poOrgId').value || null, lines: lines, remarks: document.getElementById('poRemarks').value.trim() };
    const res = await fetch(API + '/purchase-orders', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { alert('Purchase Order created!'); document.getElementById('poNum').value = ''; document.getElementById('poDate').value = ''; document.getElementById('poRemarks').value = ''; document.getElementById('poLineItems').innerHTML = ''; document.getElementById('poGrandTotal').textContent = '0.00'; clearProjSelection(); showSection('purchaseorders'); } else { alert(data.message); }
}

// ─── EDIT PO ───
function openEditPO(po) {
    document.getElementById('epId').value = po.id;
    document.getElementById('epNum').value = po.po_number;
    document.getElementById('epDate').value = po.po_date;
    document.getElementById('epStatus').value = po.status;
    document.getElementById('epRemarks').value = po.remarks;
    const container = document.getElementById('epLineItems');
    container.innerHTML = '';
    (po.lines || []).forEach((line, i) => { container.insertAdjacentHTML('beforeend', lineItemHTML('epLineItems', i, line)); });
    recalcTotal('epLineItems');
    openModal('editPOModal');
}

async function updatePO(e) {
    e.preventDefault();
    const id = document.getElementById('epId').value;
    const lines = collectLines('epLineItems');
    const body = { po_date: document.getElementById('epDate').value || null, lines: lines, status: document.getElementById('epStatus').value, remarks: document.getElementById('epRemarks').value.trim() };
    const res = await fetch(API + '/purchase-orders/' + id, { method: 'PUT', headers: HEADERS, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('editPOModal'); loadPOs(); } else { alert(data.message); }
}

async function deletePO(id, num) { if (!confirm(`Delete PO "${num}"?`)) return; const res = await fetch(API + '/purchase-orders/' + id, { method: 'DELETE', headers: HEADERS }); const data = await res.json(); if (data.success) loadPOs(); else alert(data.message); }
