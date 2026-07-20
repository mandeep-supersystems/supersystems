// ─── SUPPLIER DETAIL PAGE ───
let SD = {};

function switchTab(tab) {
    document.querySelectorAll('.sup-detail-nav-link').forEach(l => l.classList.toggle('active', l.dataset.tab === tab));
    document.querySelectorAll('.sup-detail-section').forEach(s => s.classList.toggle('active', s.id === 'tab-' + tab));
    // Update URL hash without reload
    history.replaceState(null, '', '#' + tab);
    // Update breadcrumb trail
    _updateBreadcrumb(tab);
}

function _updateBreadcrumb(tab) {
    const typeLabel = 'Suppliers';
    const tabLabels = {
        info: 'Supplier Info',
        addresses: 'Addresses',
        contacts: 'Contacts',
        evaluations: 'Evaluations',
        contracts: 'Contracts',
        performance: 'Performance',
        parts: 'Items',
        history: 'History',
        audit: 'Audit Logs'
    };
    const name = SD.supplier ? SD.supplier.brand_name : 'Loading...';
    const crumb = document.getElementById('supBreadcrumb');
    if (crumb) crumb.innerHTML =
        `<a href="/supplier" id="breadcrumbRoot">${typeLabel}</a>
        <span class="material-icons-outlined">chevron_right</span>
        <a href="${window.location.pathname}" onclick="switchTab('info');return false;">${esc(name)}</a>
        <span class="material-icons-outlined">chevron_right</span>
        <span>${tabLabels[tab] || tab}</span>`;
}

async function loadSupplierDetail(sid) {
    _setBackLinks();

    const res = await fetch(`${API}/suppliers/${sid}`, { headers: getHeaders() });
    const data = await res.json();
    document.getElementById('sdLoading').style.display = 'none';
    if (!data.success) { document.getElementById('sdLoading').innerHTML = '<span style="color:#e53935">Supplier not found.</span>'; return; }
    SD = data.data;
    document.getElementById('sdContent').style.display = 'block';
    renderSidebar(SD.supplier);
    renderInfo(SD.supplier);
    renderAddresses(SD.addresses || []);
    renderContacts(SD.contacts || []);
    renderEvaluations(SD.evaluations || []);
    renderContracts(SD.contracts || []);
    renderPerformance(SD.performance || []);
    renderParts(SD.items || []);
    renderHistory(SD.history || []);
    renderAudit(SD.audit_logs || []);
    document.getElementById('navCountAddr').textContent = (SD.addresses || []).length;
    document.getElementById('navCountContacts').textContent = (SD.contacts || []).length;
    document.getElementById('navCountEvaluations').textContent = (SD.evaluations || []).length;
    document.getElementById('navCountContracts').textContent = (SD.contracts || []).length;
    document.getElementById('navCountPerformance').textContent = (SD.performance || []).length;
    document.getElementById('navCountParts').textContent = (SD.items || []).length;
    document.getElementById('navCountHistory').textContent = (SD.history || []).length;
    document.getElementById('navCountAudit').textContent = (SD.audit_logs || []).length;
    // Restore tab from URL hash or default to info
    const hash = window.location.hash.replace('#', '');
    const validTabs = ['info','addresses','contacts','evaluations','contracts','performance','parts','history','audit'];
    switchTab(validTabs.includes(hash) ? hash : 'info');
}

function _setBackLinks() {
    const backUrl = '/supplier';
    const el1 = document.getElementById('backToListBtn');
    const el2 = document.getElementById('topbarBackBtn');
    const el3 = document.getElementById('breadcrumbRoot');
    if (el1) el1.href = backUrl;
    if (el2) el2.href = backUrl;
    if (el3) el3.href = backUrl;
}

function _applyTypeLabels() {
    const typeLabel = 'Supplier';
    document.getElementById('navPartsLabel').textContent = 'Items';
    document.getElementById('partsTabTitle').textContent = 'Items';
    document.getElementById('addItemBtnLabel').textContent = 'Add Item';
    if (document.getElementById('editSupModalTitle'))
        document.getElementById('editSupModalTitle').textContent = `Edit ${typeLabel}`;
    const typeEl = document.getElementById('sdTypeLabel');
    if (typeEl) {
        typeEl.textContent = typeLabel;
        typeEl.className = 'sup-type-badge part';
    }
}

function renderSidebar(s) {
    document.getElementById('sdCode').textContent = s.supplier_code;
    document.getElementById('sdName').textContent = s.brand_name;
    document.getElementById('sdType').textContent = s.company_type || '—';
    document.getElementById('sdRating').textContent = stars(s.rating);
    const sb = document.getElementById('sdStatus');
    sb.textContent = s.status;
    sb.className = `status-badge status-${s.status}`;
    document.getElementById('topbarName').textContent = s.brand_name;
    document.title = `${s.brand_name} - Supplier Detail`;
}

function field(label, val) {
    const empty = !val || val === '0' || val === 0;
    return `<div class="sup-field-row">
        <div class="sup-field-label">${esc(label)}</div>
        <div class="sup-field-val ${empty ? 'empty' : ''}">${empty ? '—' : esc(String(val))}</div>
    </div>`;
}

function renderInfo(s) {
    document.getElementById('cardBasic').innerHTML =
        field('Supplier Code', s.supplier_code) +
        field('Brand Name', s.brand_name) +
        field('Type', 'Supplier') +
        field('Company Type', s.company_type) +
        field('Status', s.status) +
        field('Rating', s.rating ? stars(s.rating) : '') +
        field('Currency', s.currency) +
        field('Website', s.website) +
        field('Created By', s.created_by) +
        field('Created At', fmtDateTime(s.created_at));
    document.getElementById('cardBusiness').innerHTML =
        field('Registered Name', s.registered_name) +
        field('GST No', s.gst_no) +
        field('Notes', s.notes);
}

function renderAddresses(list) {
    const tbody = document.getElementById('addressesBody');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">No addresses added.</td></tr>'; return; }
    tbody.innerHTML = list.map(a => `<tr>
        <td><strong>${esc(a.label || '—')}</strong></td>
        <td style="font-size:12px;max-width:200px">${esc(a.billing_address || '—')}</td>
        <td style="font-size:12px;max-width:200px">${esc(a.shipping_address || '—')}</td>
        <td>${a.is_default ? '<span class="status-badge status-active">Default</span>' : '—'}</td>
        <td class="actions-cell">
            <button class="btn-action" onclick="editAddress(${JSON.stringify(a).replace(/"/g,'&quot;')})"><span class="material-icons-outlined">edit</span></button>
            <button class="btn-action btn-danger" onclick="deleteItem('address','${a.id}','${esc(a.label || 'this address')}')"><span class="material-icons-outlined">delete</span></button>
        </td>
    </tr>`).join('');
}

function renderContacts(list) {
    const tbody = document.getElementById('contactsBody');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="9" class="empty">No contacts added.</td></tr>'; return; }
    tbody.innerHTML = list.map(c => `<tr>
        <td>${esc(c.designation || '—')}</td>
        <td><strong>${esc(c.name)}</strong></td>
        <td>${esc(c.mobile1 || '—')}</td>
        <td>${esc(c.mobile2 || '—')}</td>
        <td>${esc(c.email || '—')}</td>
        <td>${statusBadge(c.status)}</td>
        <td style="font-size:12px;max-width:150px">${esc(c.about || '—')}</td>
        <td style="font-size:12px;max-width:150px">${esc(c.remarks || '—')}</td>
        <td class="actions-cell">
            <button class="btn-action" onclick="editContact(${JSON.stringify(c).replace(/"/g,'&quot;')})"><span class="material-icons-outlined">edit</span></button>
            <button class="btn-action btn-danger" onclick="deleteItem('contact','${c.id}','${esc(c.name)}')"><span class="material-icons-outlined">delete</span></button>
        </td>
    </tr>`).join('');
}

function renderEvaluations(list) {
    const tbody = document.getElementById('evaluationsBody');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="12" class="empty">No evaluations added.</td></tr>'; return; }
    tbody.innerHTML = list.map(e => `<tr>
        <td>${esc(e.period || e.evaluation_date || '—')}</td>
        <td>${esc(e.workflow_stage || '—')}</td>
        <td>${esc(e.document_verification_status || '—')}</td>
        <td>${fmtNum(e.overall_score || 0)}%</td>
        <td>${fmtNum(e.quality_score || 0)}%</td>
        <td>${fmtNum(e.price_score || 0)}%</td>
        <td>${fmtNum(e.delivery_score || 0)}%</td>
        <td>${fmtNum(e.capacity_score || 0)}%</td>
        <td>${fmtNum(e.financial_stability_score || 0)}%</td>
        <td>${fmtNum(e.experience_score || 0)}%</td>
        <td>${fmtNum(e.technical_support_score || 0)}%</td>
        <td>${statusBadge(e.approval_status || e.status || 'pending')}</td>
    </tr>`).join('');
}

function renderContracts(list) {
    const tbody = document.getElementById('contractsBody');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="10" class="empty">No contracts added.</td></tr>'; return; }
    tbody.innerHTML = list.map(c => `<tr>
        <td><span class="sup-code">${esc(c.contract_number || '—')}</span></td>
        <td>${esc(c.contract_type || '—')}</td>
        <td>${fmtDate(c.start_date)}</td>
        <td>${fmtDate(c.end_date)}</td>
        <td>₹${fmtNum(c.contract_value || 0)}</td>
        <td>${esc(c.payment_terms || '—')}</td>
        <td>${esc(c.delivery_terms || '—')}</td>
        <td>${esc(c.lifecycle_stage || '—')}</td>
        <td>${statusBadge(c.status || 'draft')}</td>
        <td>${esc(c.attachment_path || '—')}</td>
    </tr>`).join('');
}

function renderPerformance(list) {
    const tbody = document.getElementById('performanceBody');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="9" class="empty">No performance reviews added.</td></tr>'; return; }
    tbody.innerHTML = list.map(p => `<tr>
        <td>${esc(p.period || '—')}</td>
        <td>${fmtNum(p.po_count || 0)}</td>
        <td>${fmtNum(p.grn_count || 0)}</td>
        <td>${fmtNum(p.inspection_pass_rate || 0)}%</td>
        <td>${fmtNum(p.ncr_count || 0)}</td>
        <td>${fmtNum(p.quality_defect_rate || 0)}%</td>
        <td>${fmtNum(p.on_time_delivery_rate || 0)}%</td>
        <td>${fmtNum(p.overall_score || 0)}%</td>
        <td>${esc(p.performance_grade || '—')}</td>
    </tr>`).join('');
}

function _ppu(qty, price) {
    if (!qty || !price || qty === 0) return '—';
    return fmtNum(price / qty);
}

function renderParts(list) {
    const tbody = document.getElementById('partsBody');
    const thead = document.getElementById('partsTableHead');

    thead.innerHTML = `<tr>
        <th>Item Type</th>
        <th>Item Code</th>
        <th>MPN</th>
        <th>Make</th>
        <th>Unit</th>
        <th>Sample Qty</th><th>Sample ₹</th><th>₹/Unit</th>
        <th>SPQ</th><th>SPQ ₹</th><th>₹/Unit</th>
        <th>MOQ</th><th>MOQ ₹</th><th>₹/Unit</th>
        <th>Actions</th>
    </tr>`;

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="15" class="empty">No items added.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(p => {
        const unit = p.unit ? `<span style="font-size:11px;color:var(--text-muted)">${esc(p.unit)}</span>` : '—';
        return `<tr>
            <td>${esc((p.item_type || 'part').toUpperCase())}</td>
            <td><span class="sup-code">${esc(p.part_code || '—')}</span></td>
            <td>${esc(p.mpn || '—')}</td>
            <td>${esc(p.make || '—')}</td>
            <td>${unit}</td>
            <td>${fmtNum(p.sample_qty)}</td>
            <td>₹${fmtNum(p.sample_price)}</td>
            <td class="ppu-cell">${_ppu(p.sample_qty, p.sample_price)}</td>
            <td>${fmtNum(p.spq)}</td>
            <td>₹${fmtNum(p.spq_price)}</td>
            <td class="ppu-cell">${_ppu(p.spq, p.spq_price)}</td>
            <td>${fmtNum(p.moq)}</td>
            <td>₹${fmtNum(p.moq_price)}</td>
            <td class="ppu-cell">${_ppu(p.moq, p.moq_price)}</td>
            <td class="actions-cell">
                <button class="btn-action" onclick="editPart(${JSON.stringify(p).replace(/"/g,'&quot;')})"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-action btn-danger" onclick="deleteItem('part','${p.id}','${esc(p.part_code || 'this item')}')"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>`;
    }).join('');
}

function renderHistory(list) {
    const tbody = document.getElementById('historyBody');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No history entries.</td></tr>'; return; }
    const typeColor = { purchase: '#1976D2', sample: '#7b1fa2', return: '#c62828', quote: '#e65100', other: '#555' };
    tbody.innerHTML = list.map(h => {
        const c = typeColor[h.event_type] || '#555';
        return `<tr>
            <td style="font-size:12px">${fmtDate(h.event_date || h.created_at)}</td>
            <td><span class="sup-code">${esc(h.part_code || '—')}</span></td>
            <td><span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:${c}22;color:${c}">${esc(h.event_type)}</span></td>
            <td style="font-size:12px;max-width:200px">${esc(h.description || '—')}</td>
            <td>${h.quantity ? fmtNum(h.quantity) + ' ' + esc(h.unit) : '—'}</td>
            <td>${h.amount ? '₹' + fmtNum(h.amount) : '—'}</td>
            <td style="font-size:12px">${esc(h.reference_no || '—')}</td>
            <td style="font-size:12px">${esc(h.created_by || '—')}</td>
        </tr>`;
    }).join('');
}

function renderAudit(list) {
    const el = document.getElementById('auditList');
    if (!list.length) { el.innerHTML = '<div class="empty" style="padding:32px;text-align:center">No audit logs.</div>'; return; }
    const iconMap = { CREATE: { cls: 'create', icon: 'add_circle' }, UPDATE: { cls: 'update', icon: 'edit' }, DELETE: { cls: 'delete', icon: 'delete' } };
    el.innerHTML = list.map(a => {
        const im = iconMap[a.action] || { cls: '', icon: 'info' };
        return `<div class="sup-audit-item">
            <div class="sup-audit-dot ${im.cls}"><span class="material-icons-outlined">${im.icon}</span></div>
            <div class="sup-audit-body">
                <div class="sup-audit-action">${esc(a.action)} — ${esc(a.entity_type)}</div>
                <div class="sup-audit-meta">
                    ${a.user_email ? `<span>👤 ${esc(a.user_email)}</span>` : ''}
                    ${a.ip_address ? `<span>🌐 ${esc(a.ip_address)}</span>` : ''}
                </div>
            </div>
            <div class="sup-audit-time">${fmtDateTime(a.created_at)}</div>
        </div>`;
    }).join('');
}

// ── WORKFLOW MODALS ──
function openAddEvaluationModal() {
    ['evalDate','evalPeriod','evalComments'].forEach(id => document.getElementById(id).value = '');
    ['evalQuality','evalPrice','evalDelivery','evalCapacity','evalFinance','evalExperience','evalTechnical','evalOverall'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('evalStage').value = 'evaluation';
    document.getElementById('evalDocStatus').value = 'verified';
    document.getElementById('evalStatus').value = 'pending';
    openModal('addEvaluationModal');
}

async function saveEvaluation(e) {
    e.preventDefault();
    const body = {
        evaluation_date: document.getElementById('evalDate').value || null,
        period: document.getElementById('evalPeriod').value.trim(),
        workflow_stage: document.getElementById('evalStage').value,
        document_verification_status: document.getElementById('evalDocStatus').value,
        quality_score: parseFloat(document.getElementById('evalQuality').value) || 0,
        price_score: parseFloat(document.getElementById('evalPrice').value) || 0,
        delivery_score: parseFloat(document.getElementById('evalDelivery').value) || 0,
        capacity_score: parseFloat(document.getElementById('evalCapacity').value) || 0,
        financial_stability_score: parseFloat(document.getElementById('evalFinance').value) || 0,
        experience_score: parseFloat(document.getElementById('evalExperience').value) || 0,
        technical_support_score: parseFloat(document.getElementById('evalTechnical').value) || 0,
        overall_score: parseFloat(document.getElementById('evalOverall').value) || 0,
        approval_status: document.getElementById('evalStatus').value,
        comments: document.getElementById('evalComments').value.trim(),
        evaluator_id: ''
    };
    const res = await fetch(`${API}/suppliers/${SD.supplier.id}/evaluations`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('addEvaluationModal'); showToast('Evaluation saved'); loadSupplierDetail(SD.supplier.id); }
    else showToast(data.message || 'Error', 'error');
}

function openAddContractModal() {
    ['contractNumber','contractType','contractStart','contractEnd','contractValue','contractPayment','contractDelivery','contractAttachment','contractNotes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('contractStatus').value = 'draft';
    document.getElementById('contractStage').value = 'draft';
    document.getElementById('contractAutoRenew').checked = false;
    openModal('addContractModal');
}

async function saveContract(e) {
    e.preventDefault();
    const body = {
        contract_number: document.getElementById('contractNumber').value.trim(),
        contract_type: document.getElementById('contractType').value.trim(),
        start_date: document.getElementById('contractStart').value || null,
        end_date: document.getElementById('contractEnd').value || null,
        contract_value: parseFloat(document.getElementById('contractValue').value) || 0,
        payment_terms: document.getElementById('contractPayment').value.trim(),
        delivery_terms: document.getElementById('contractDelivery').value.trim(),
        attachment_path: document.getElementById('contractAttachment').value.trim(),
        status: document.getElementById('contractStatus').value,
        lifecycle_stage: document.getElementById('contractStage').value,
        auto_renew: document.getElementById('contractAutoRenew').checked,
        notes: document.getElementById('contractNotes').value.trim()
    };
    const res = await fetch(`${API}/suppliers/${SD.supplier.id}/contracts`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('addContractModal'); showToast('Contract saved'); loadSupplierDetail(SD.supplier.id); }
    else showToast(data.message || 'Error', 'error');
}

function openAddPerformanceModal() {
    ['perfPeriod','perfPO','perfGRN','perfInspection','perfNCR','perfDefect','perfOTD','perfOverall'].forEach(id => document.getElementById(id).value = '');
    openModal('addPerformanceModal');
}

async function savePerformance(e) {
    e.preventDefault();
    const body = {
        period: document.getElementById('perfPeriod').value.trim(),
        po_count: parseFloat(document.getElementById('perfPO').value) || 0,
        grn_count: parseFloat(document.getElementById('perfGRN').value) || 0,
        inspection_pass_rate: parseFloat(document.getElementById('perfInspection').value) || 0,
        ncr_count: parseFloat(document.getElementById('perfNCR').value) || 0,
        quality_defect_rate: parseFloat(document.getElementById('perfDefect').value) || 0,
        on_time_delivery_rate: parseFloat(document.getElementById('perfOTD').value) || 0,
        overall_score: parseFloat(document.getElementById('perfOverall').value) || 0
    };
    const res = await fetch(`${API}/suppliers/${SD.supplier.id}/performance`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('addPerformanceModal'); showToast('Performance review saved'); loadSupplierDetail(SD.supplier.id); }
    else showToast(data.message || 'Error', 'error');
}

// ── EDIT SUPPLIER ──
function openEditSupplierModal() {
    const s = SD.supplier;
    document.getElementById('esBrand').value = s.brand_name;
    document.getElementById('esType').value = s.company_type || '';
    document.getElementById('esRegName').value = s.registered_name || '';
    document.getElementById('esGST').value = s.gst_no || '';
    document.getElementById('esCurrency').value = s.currency || 'INR';
    document.getElementById('esStatus').value = s.status || 'active';
    document.getElementById('esRating').value = s.rating || 0;
    document.getElementById('esWebsite').value = s.website || '';
    document.getElementById('esNotes').value = s.notes || '';
    openModal('editSupplierModal');
}

async function saveEditSupplier(e) {
    e.preventDefault();
    const body = {
        brand_name: document.getElementById('esBrand').value.trim(),
        company_type: document.getElementById('esType').value,
        registered_name: document.getElementById('esRegName').value.trim(),
        gst_no: document.getElementById('esGST').value.trim(),
        currency: document.getElementById('esCurrency').value,
        status: document.getElementById('esStatus').value,
        rating: parseFloat(document.getElementById('esRating').value) || 0,
        website: document.getElementById('esWebsite').value.trim(),
        notes: document.getElementById('esNotes').value.trim()
    };
    const res = await fetch(`${API}/suppliers/${SD.supplier.id}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('editSupplierModal'); showToast('Supplier updated'); loadSupplierDetail(SD.supplier.id); }
    else showToast(data.message || 'Error', 'error');
}

function openEditSection() { openEditSupplierModal(); }

// ── ADDRESSES ──
function openAddAddressModal() {
    document.getElementById('addrModalTitle').textContent = 'Add Address';
    document.getElementById('addrId').value = '';
    ['addrLabel','addrBilling','addrShipping'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('addrDefault').checked = false;
    openModal('addAddressModal');
}

function editAddress(a) {
    document.getElementById('addrModalTitle').textContent = 'Edit Address';
    document.getElementById('addrId').value = a.id;
    document.getElementById('addrLabel').value = a.label || '';
    document.getElementById('addrBilling').value = a.billing_address || '';
    document.getElementById('addrShipping').value = a.shipping_address || '';
    document.getElementById('addrDefault').checked = a.is_default || false;
    openModal('addAddressModal');
}

async function saveAddress(e) {
    e.preventDefault();
    const id = document.getElementById('addrId').value;
    const body = {
        label: document.getElementById('addrLabel').value.trim(),
        billing_address: document.getElementById('addrBilling').value.trim(),
        shipping_address: document.getElementById('addrShipping').value.trim(),
        is_default: document.getElementById('addrDefault').checked
    };
    const url = id ? `${API}/suppliers/${SD.supplier.id}/addresses/${id}` : `${API}/suppliers/${SD.supplier.id}/addresses`;
    const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: getHeaders(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('addAddressModal'); showToast('Address saved'); loadSupplierDetail(SD.supplier.id); }
    else showToast(data.message || 'Error', 'error');
}

// ── CONTACTS ──
function openAddContactModal() {
    document.getElementById('contactModalTitle').textContent = 'Add Contact';
    document.getElementById('contactId').value = '';
    ['contactName','contactDesig','contactM1','contactM2','contactEmail','contactAbout','contactRemarks'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('contactStatus').value = 'active';
    openModal('addContactModal');
}

function editContact(c) {
    document.getElementById('contactModalTitle').textContent = 'Edit Contact';
    document.getElementById('contactId').value = c.id;
    document.getElementById('contactName').value = c.name || '';
    document.getElementById('contactDesig').value = c.designation || '';
    document.getElementById('contactM1').value = c.mobile1 || '';
    document.getElementById('contactM2').value = c.mobile2 || '';
    document.getElementById('contactEmail').value = c.email || '';
    document.getElementById('contactStatus').value = c.status || 'active';
    document.getElementById('contactAbout').value = c.about || '';
    document.getElementById('contactRemarks').value = c.remarks || '';
    openModal('addContactModal');
}

async function saveContact(e) {
    e.preventDefault();
    const id = document.getElementById('contactId').value;
    const body = {
        name: document.getElementById('contactName').value.trim(),
        designation: document.getElementById('contactDesig').value.trim(),
        mobile1: document.getElementById('contactM1').value.trim(),
        mobile2: document.getElementById('contactM2').value.trim(),
        email: document.getElementById('contactEmail').value.trim(),
        status: document.getElementById('contactStatus').value,
        about: document.getElementById('contactAbout').value.trim(),
        remarks: document.getElementById('contactRemarks').value.trim()
    };
    const url = id ? `${API}/suppliers/${SD.supplier.id}/contacts/${id}` : `${API}/suppliers/${SD.supplier.id}/contacts`;
    const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: getHeaders(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('addContactModal'); showToast('Contact saved'); loadSupplierDetail(SD.supplier.id); }
    else showToast(data.message || 'Error', 'error');
}

// ── PARTS / RM ITEMS ──
let _rmSearchTimer = null;

function onItemCodeInput(val) {
    clearTimeout(_rmSearchTimer);
    const dd = document.getElementById('partCodeDropdown');
    if (!val || val.length < 2) { dd.style.display = 'none'; return; }
    const itemType = document.getElementById('partItemType').value;
    _rmSearchTimer = setTimeout(() => itemType === 'raw_material' ? _searchRM(val) : _searchPart(val), 280);
}

async function _searchRM(q) {
    const dd = document.getElementById('partCodeDropdown');
    const res = await fetch(`/api/v1/rawmaterial/search-rm?q=${encodeURIComponent(q)}`, { headers: getHeaders() });
    const data = await res.json();
    const items = data.data || [];
    if (!items.length) { dd.style.display = 'none'; return; }
    dd.innerHTML = items.map(r =>
        `<div class="item-search-option" onclick="selectRM(${JSON.stringify(r).replace(/"/g,'&quot;')})">
            <span class="item-search-code">${esc(r.rm_code)}</span>
            <span class="item-search-desc">${esc(r.rm_description || '')}</span>
            ${r.unit ? `<span class="item-search-unit">${esc(r.unit)}</span>` : ''}
        </div>`
    ).join('');
    dd.style.display = 'block';
}

async function _searchPart(q) {
    const dd = document.getElementById('partCodeDropdown');
    const res = await fetch(`/api/v1/part/search-parts?q=${encodeURIComponent(q)}`, { headers: getHeaders() });
    const data = await res.json();
    const items = data.data || [];
    if (!items.length) { dd.style.display = 'none'; return; }
    dd.innerHTML = items.map(r =>
        `<div class="item-search-option" onclick="selectPart(${JSON.stringify(r).replace(/"/g,'&quot;')})">
            <span class="item-search-code">${esc(r.part_number)}</span>
            <span class="item-search-desc">${esc(r.description || '')}</span>
        </div>`
    ).join('');
    dd.style.display = 'block';
}

function selectRM(rm) {
    document.getElementById('partCode').value = rm.rm_code;
    document.getElementById('partCodeDropdown').style.display = 'none';
    if (rm.unit && !document.getElementById('partUnit').value)
        document.getElementById('partUnit').value = rm.unit;
    document.getElementById('partCode').dataset.desc = rm.rm_description || '';
}

function selectPart(p) {
    document.getElementById('partCode').value = p.part_number;
    document.getElementById('partCodeDropdown').style.display = 'none';
    document.getElementById('partCode').dataset.desc = p.description || '';
}

// Close dropdown on outside click
document.addEventListener('click', e => {
    if (!e.target.closest('#partCode') && !e.target.closest('#partCodeDropdown')) {
        const dd = document.getElementById('partCodeDropdown');
        if (dd) dd.style.display = 'none';
    }
});

function calcPPU(tier) {
    const map = { sample: ['partSQ','partSP','partSPPU'], spq: ['partSPQ','partSPQP','partSPQPPU'], moq: ['partMOQ','partMOQP','partMOQPPU'] };
    const [qId, pId, ppuId] = map[tier];
    const qty = parseFloat(document.getElementById(qId).value) || 0;
    const price = parseFloat(document.getElementById(pId).value) || 0;
    const unit = document.getElementById('partUnit').value.trim();
    document.getElementById(ppuId).value = (qty > 0 && price > 0)
        ? `₹${(price / qty).toFixed(4)}${unit ? ' / ' + unit : ''}`
        : '';
}

function openAddPartModal() {
    document.getElementById('partModalTitle').textContent = 'Add Item';
    document.getElementById('partId').value = '';
    document.getElementById('partItemType').value = 'part';
    ['partCode','partMPN','partMake','partUnit','partNotes'].forEach(id => document.getElementById(id).value = '');
    ['partSQ','partSP','partSPPU','partSPQ','partSPQP','partSPQPPU','partMOQ','partMOQP','partMOQPPU'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('partCodeLabel').textContent = 'Item Code';
    document.getElementById('partCode').placeholder = 'Type to search or enter code';
    document.getElementById('mpnGroup').style.display = '';
    const dd = document.getElementById('partCodeDropdown');
    if (dd) dd.style.display = 'none';
    openModal('addPartModal');
}

function onItemTypeChange() {
    const dd = document.getElementById('partCodeDropdown');
    if (dd) dd.style.display = 'none';
    document.getElementById('partCode').value = '';
}

function editPart(p) {
    document.getElementById('partModalTitle').textContent = 'Edit Item';
    document.getElementById('partId').value = p.id;
    document.getElementById('partItemType').value = p.item_type || 'part';
    document.getElementById('partCode').value = p.part_code || '';
    document.getElementById('partMPN').value = p.mpn || '';
    document.getElementById('partMake').value = p.make || '';
    document.getElementById('partUnit').value = p.unit || '';
    document.getElementById('partSQ').value = p.sample_qty || 0;
    document.getElementById('partSP').value = p.sample_price || 0;
    document.getElementById('partSPQ').value = p.spq || 0;
    document.getElementById('partSPQP').value = p.spq_price || 0;
    document.getElementById('partMOQ').value = p.moq || 0;
    document.getElementById('partMOQP').value = p.moq_price || 0;
    document.getElementById('partNotes').value = p.notes || '';
    document.getElementById('partCodeLabel').textContent = 'Item Code';
    document.getElementById('mpnGroup').style.display = '';
    ['sample','spq','moq'].forEach(calcPPU);
    openModal('addPartModal');
}

async function savePart(e) {
    e.preventDefault();
    const id = document.getElementById('partId').value;
    const body = {
        item_type: document.getElementById('partItemType').value || 'part',
        part_code: document.getElementById('partCode').value.trim(),
        mpn: document.getElementById('partMPN').value.trim(),
        make: document.getElementById('partMake').value.trim(),
        unit: document.getElementById('partUnit').value.trim(),
        sample_qty: parseFloat(document.getElementById('partSQ').value) || 0,
        sample_price: parseFloat(document.getElementById('partSP').value) || 0,
        spq: parseFloat(document.getElementById('partSPQ').value) || 0,
        spq_price: parseFloat(document.getElementById('partSPQP').value) || 0,
        moq: parseFloat(document.getElementById('partMOQ').value) || 0,
        moq_price: parseFloat(document.getElementById('partMOQP').value) || 0,
        notes: document.getElementById('partNotes').value.trim()
    };
    const url = id ? `${API}/suppliers/${SD.supplier.id}/items/${id}` : `${API}/suppliers/${SD.supplier.id}/items`;
    const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: getHeaders(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('addPartModal'); showToast('Item saved'); loadSupplierDetail(SD.supplier.id); }
    else showToast(data.message || 'Error', 'error');
}

// ── HISTORY ──
function openAddHistoryModal() {
    document.getElementById('histItemLabel').textContent = 'Item Code';
    ['histPartCode','histDesc','histUnit','histRef'].forEach(id => document.getElementById(id).value = '');
    ['histQty','histAmt'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('histEventType').value = 'purchase';
    document.getElementById('histDate').value = new Date().toISOString().split('T')[0];
    openModal('addHistoryModal');
}

async function saveHistory(e) {
    e.preventDefault();
    const body = {
        part_code: document.getElementById('histPartCode').value.trim(),
        event_type: document.getElementById('histEventType').value,
        description: document.getElementById('histDesc').value.trim(),
        quantity: parseFloat(document.getElementById('histQty').value) || null,
        unit: document.getElementById('histUnit').value.trim(),
        amount: parseFloat(document.getElementById('histAmt').value) || null,
        reference_no: document.getElementById('histRef').value.trim(),
        event_date: document.getElementById('histDate').value || null
    };
    const res = await fetch(`${API}/suppliers/${SD.supplier.id}/history`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('addHistoryModal'); showToast('History entry added'); loadSupplierDetail(SD.supplier.id); }
    else showToast(data.message || 'Error', 'error');
}

// ── DELETE ──
function deleteItem(type, id, name) {
    const urlMap = {
        address: `${API}/suppliers/${SD.supplier.id}/addresses/${id}`,
        contact: `${API}/suppliers/${SD.supplier.id}/contacts/${id}`,
        part: `${API}/suppliers/${SD.supplier.id}/items/${id}`,
        item: `${API}/suppliers/${SD.supplier.id}/items/${id}`
    };
    document.getElementById('deleteMsg').textContent = `Delete ${type} "${name}"?`;
    document.getElementById('deleteConfirmBtn').onclick = async () => {
        const res = await fetch(urlMap[type] || urlMap.item, { method: 'DELETE', headers: getHeaders() });
        const data = await res.json();
        if (data.success) { closeModal('deleteModal'); showToast(`${type} deleted`); loadSupplierDetail(SD.supplier.id); }
        else showToast(data.message || 'Error', 'error');
    };
    openModal('deleteModal');
}
