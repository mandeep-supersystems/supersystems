// ─── SUPPLIER DETAIL PAGE ───
let SD = {};

function switchTab(tab, updateHistory = true) {
    document.querySelectorAll('.sup-detail-nav-link').forEach(l => l.classList.toggle('active', l.dataset.tab === tab));
    document.querySelectorAll('.sup-detail-section').forEach(s => s.classList.toggle('active', s.id === 'tab-' + tab));
    if (updateHistory) {
        history.pushState(null, '', '#' + tab);
    }
    _updateBreadcrumb(tab);
}

window.addEventListener('popstate', () => {
    const hash = window.location.hash.replace('#', '');
    const validTabs = ['info','addresses','contacts','evaluations','contracts','performance','parts','purchase-orders','history','audit'];
    switchTab(validTabs.includes(hash) ? hash : 'info', false);
});

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
        'purchase-orders': 'Purchase Orders',
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
    loadSupplierPOs(sid);
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
    const validTabs = ['info','addresses','contacts','evaluations','contracts','performance','parts','purchase-orders','history','audit'];
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
    const codeEl = document.getElementById('sdCode');
    if (codeEl) codeEl.textContent = s.supplier_code;

    const nameEl = document.getElementById('sdName');
    if (nameEl) nameEl.textContent = s.brand_name;

    const typeEl = document.getElementById('sdType');
    if (typeEl) typeEl.textContent = s.company_type || '—';

    const ratingEl = document.getElementById('sdRating');
    if (ratingEl) ratingEl.textContent = stars(s.rating);

    const sb = document.getElementById('sdStatus');
    if (sb) {
        sb.textContent = s.status;
        sb.className = `status-badge status-${s.status}`;
    }

    const topbarNameEl = document.getElementById('topbarName');
    if (topbarNameEl) topbarNameEl.textContent = s.brand_name;

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
        <th>Added On</th>
        <th>Actions</th>
    </tr>`;

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="15" class="empty">No items added.</td></tr>`;
        return;
    }

    // Group items by item_type and part_code
    const grouped = {};
    list.forEach(p => {
        const key = p.item_type + '_' + (p.part_code || 'unspecified');
        if (!grouped[key]) grouped[key] = { type: p.item_type, code: p.part_code, items: [] };
        grouped[key].items.push(p);
    });

    // We will render only the latest item as the main row, 
    // and older items as hidden historical rows that can be toggled.
    let groupIndex = 0;
    tbody.innerHTML = Object.values(grouped).map(g => {
        // Sort items by created_at descending so the newest is first
        g.items.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA; // descending
        });
        
        const latest = g.items[0];
        const history = g.items.slice(1);
        const hasHistory = history.length > 0;
        const groupId = 'group-' + groupIndex++;
        
        const unitLatest = latest.unit ? `<span style="font-size:11px;color:var(--text-muted)">${esc(latest.unit)}</span>` : '—';
        
        let html = `<tr style="border-top: 2px solid var(--border-color); ${hasHistory ? 'cursor:pointer; background-color:#f9fbff' : ''}" ${hasHistory ? `onclick="toggleHistory('${groupId}')"` : ''}>
            <td>${esc((latest.item_type || 'part').toUpperCase())}</td>
            <td>
                <div style="display:flex; align-items:center; gap:4px">
                    <span class="sup-code">${esc(latest.part_code || '—')}</span>
                    ${hasHistory ? `<span id="icon-${groupId}" class="material-icons-outlined" style="font-size:16px; color:var(--primary); transition:transform 0.2s">expand_more</span> <span style="font-size:11px; color:var(--text-muted)">(${history.length} old)</span>` : ''}
                </div>
            </td>
            <td><strong>${esc(latest.mpn || '—')}</strong></td>
            <td>${esc(latest.make || '—')}</td>
            <td>${unitLatest}</td>
            <td>${fmtNum(latest.sample_qty)}</td>
            <td>₹${fmtNum(latest.sample_price)}</td>
            <td class="ppu-cell">${_ppu(latest.sample_qty, latest.sample_price)}</td>
            <td>${fmtNum(latest.spq)}</td>
            <td>₹${fmtNum(latest.spq_price)}</td>
            <td class="ppu-cell">${_ppu(latest.spq, latest.spq_price)}</td>
            <td>${fmtNum(latest.moq)}</td>
            <td>₹${fmtNum(latest.moq_price)}</td>
            <td class="ppu-cell">${_ppu(latest.moq, latest.moq_price)}</td>
            <td style="font-size:11px; color:var(--text-muted)">
                ${latest.created_at ? new Date(latest.created_at).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'}) : '—'}
                <br><span style="color:var(--primary); font-weight:600">Latest</span>
            </td>
            <td class="actions-cell" onclick="event.stopPropagation()">
                <button class="btn-action" onclick="editPart(${JSON.stringify(latest).replace(/"/g,'&quot;')})"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-action btn-danger" onclick="deleteItem('part','${latest.id}','${esc(latest.part_code || 'this item')}')"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>`;
        
        if (hasHistory) {
            html += history.map(p => {
                const unit = p.unit ? `<span style="font-size:11px;color:var(--text-muted)">${esc(p.unit)}</span>` : '—';
                return `<tr class="history-row-${groupId}" style="display:none; background-color:#fafafa; opacity:0.8">
                    <td></td>
                    <td></td>
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
                    <td style="font-size:11px; color:var(--text-muted)">${p.created_at ? new Date(p.created_at).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'}) : '—'}</td>
                    <td class="actions-cell">
                        <button class="btn-action btn-danger" onclick="deleteItem('part','${p.id}','${esc(p.part_code || 'this item')}')"><span class="material-icons-outlined">delete</span></button>
                    </td>
                </tr>`;
            }).join('');
        }
        return html;
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
        
        let details = '';
        if (a.action === 'CREATE' && a.new_value) {
            let parts = [];
            for (let k in a.new_value) {
                if (a.new_value[k] !== null && a.new_value[k] !== '') {
                    parts.push(`${k}: ${a.new_value[k]}`);
                }
            }
            details = parts.join(' | ');
        } else if (a.action === 'DELETE' && a.old_value) {
            let parts = [];
            for (let k in a.old_value) {
                if (a.old_value[k] !== null && a.old_value[k] !== '') {
                    parts.push(`${k}: ${a.old_value[k]}`);
                }
            }
            details = parts.join(' | ');
        } else if (a.action === 'UPDATE' && a.new_value && a.old_value) {
            let changes = [];
            for (let k in a.new_value) {
                if (a.new_value[k] !== a.old_value[k]) {
                    changes.push(`${k}: ${a.old_value[k]} &rarr; ${a.new_value[k]}`);
                }
            }
            details = changes.join(', ');
        }
        
        return `<div class="sup-audit-item">
            <div class="sup-audit-dot ${im.cls}"><span class="material-icons-outlined">${im.icon}</span></div>
            <div class="sup-audit-body">
                <div class="sup-audit-action">${esc(a.action)} — ${esc(a.entity_type)}</div>
                ${details ? `<div style="font-size:12px; color:var(--text-color); margin-top:4px; padding:6px; background:var(--bg-secondary); border-radius:4px; font-family:monospace">${details}</div>` : ''}
                <div class="sup-audit-meta" style="margin-top:4px">
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
    fetchPartManufacturers(p.part_number);
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

// ─── IMPORT / EXPORT / TEMPLATE / HISTORY ───

let currentImportEntity = null;

const ENTITY_CONFIG = {
    'addresses': { 
        name: 'Supplier Address', endpoint: 'addresses', dataKey: 'addresses',
        headers: ['Label', 'Billing Address', 'Shipping Address', 'Default (true/false)'],
        mapRow: (r) => ({ label: r[0], billing_address: r[1], shipping_address: r[2], is_default: r[3]==='true' }),
        exportRow: (d) => [d.label, d.billing_address, d.shipping_address, d.is_default]
    },
    'contacts': { 
        name: 'Supplier Contact', endpoint: 'contacts', dataKey: 'contacts',
        headers: ['Name', 'Designation', 'Mobile 1', 'Mobile 2', 'Email', 'Status', 'About', 'Remarks'],
        mapRow: (r) => ({ name: r[0], designation: r[1], mobile1: r[2], mobile2: r[3], email: r[4], status: r[5]||'active', about: r[6], remarks: r[7] }),
        exportRow: (d) => [d.name, d.designation, d.mobile1, d.mobile2, d.email, d.status, d.about, d.remarks]
    },
    'evaluations': { 
        name: 'Supplier Evaluation', endpoint: 'evaluations', dataKey: 'evaluations',
        headers: ['Date', 'Period', 'Document Status', 'Workflow Stage', 'Overall Score', 'Approval Status', 'Comments'],
        mapRow: (r) => ({ evaluation_date: r[0], period: r[1], document_verification_status: r[2], workflow_stage: r[3], overall_score: parseFloat(r[4])||0, approval_status: r[5], comments: r[6] }),
        exportRow: (d) => [d.evaluation_date, d.period, d.document_verification_status, d.workflow_stage, d.overall_score, d.approval_status, d.comments]
    },
    'contracts': { 
        name: 'Supplier Contract', endpoint: 'contracts', dataKey: 'contracts',
        headers: ['Contract Type', 'Contract Value', 'Currency', 'Start Date', 'End Date', 'Status'],
        mapRow: (r) => ({ contract_type: r[0], contract_value: parseFloat(r[1])||0, currency: r[2], start_date: r[3], end_date: r[4], status: r[5] }),
        exportRow: (d) => [d.contract_type, d.contract_value, d.currency, d.start_date, d.end_date, d.status]
    },
    'performance': { 
        name: 'Supplier Performance', endpoint: 'performance', dataKey: 'performance',
        headers: ['Period', 'On Time %', 'Defect Rate %', 'Support Rating', 'Response Time (hrs)', 'Total Score', 'Comments'],
        mapRow: (r) => ({ period: r[0], on_time_delivery_percent: parseFloat(r[1])||0, defect_rate_percent: parseFloat(r[2])||0, support_rating: parseFloat(r[3])||0, response_time_hours: parseFloat(r[4])||0, total_score: parseFloat(r[5])||0, comments: r[6] }),
        exportRow: (d) => [d.period, d.on_time_delivery_percent, d.defect_rate_percent, d.support_rating, d.response_time_hours, d.total_score, d.comments]
    },
    'parts': { 
        name: 'Supplier Item', endpoint: 'items', dataKey: 'items',
        headers: ['Item Type', 'Item Code', 'MPN', 'Make', 'Unit', 'Sample Qty', 'Sample ₹', '₹/Unit', 'SPQ', 'SPQ ₹', '₹/Unit', 'MOQ', 'MOQ ₹', '₹/Unit'],
        mapRow: (r) => ({ 
            item_type: r[0] || 'part', 
            part_code: r[1], 
            mpn: r[2], 
            make: r[3], 
            unit: r[4], 
            sample_qty: parseFloat(r[5]) || 0, 
            sample_price: r[7] ? parseFloat(r[7]) : (parseFloat(r[6])/parseFloat(r[5]) || 0), 
            spq: parseFloat(r[8]) || 0, 
            spq_price: r[10] ? parseFloat(r[10]) : (parseFloat(r[9])/parseFloat(r[8]) || 0), 
            moq: parseFloat(r[11]) || 0, 
            moq_price: r[13] ? parseFloat(r[13]) : (parseFloat(r[12])/parseFloat(r[11]) || 0)
        }),
        exportRow: (d) => [
            d.item_type || 'part',
            d.part_code,
            d.mpn,
            d.make,
            d.unit,
            d.sample_qty,
            d.sample_qty * d.sample_price,
            d.sample_price,
            d.spq,
            d.spq * d.spq_price,
            d.spq_price,
            d.moq,
            d.moq * d.moq_price,
            d.moq_price
        ]
    }
};

function downloadCsv(headers, rows, filename) {
    let csv = '"' + headers.join('","') + '"\n';
    for (const row of rows) {
        csv += row.map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(',') + '\n';
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function exportData(entityId) {
    const config = ENTITY_CONFIG[entityId];
    if (!config) return;
    const data = SD[config.dataKey] || [];
    if (!data.length) { showToast(`No ${config.name}s to export`, 'error'); return; }
    const rows = data.map(config.exportRow);
    downloadCsv(config.headers, rows, `${entityId}_export.csv`);
    fetch(API + '/log-action', { method: 'POST', headers: getHeaders(), body: JSON.stringify({ action: 'EXPORT', entity_type: config.name, entity_id: `${entityId}_export.csv` }) }).catch(() => {});
    showToast(`Exported ${data.length} records`);
}

function downloadTemplate(entityId) {
    const config = ENTITY_CONFIG[entityId];
    if (!config) return;
    downloadCsv(config.headers, [], `${entityId}_template.csv`);
    showToast('Template downloaded');
}

function triggerImport(entityId) {
    currentImportEntity = entityId;
    document.getElementById('importFileInput').value = '';
    document.getElementById('importFileInput').click();
}

async function handleImportFile(input) {
    const file = input.files[0];
    if (!file || !currentImportEntity) return;
    const config = ENTITY_CONFIG[currentImportEntity];

    let rows = [];
    try {
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
        if (isExcel) {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            if (jsonData.length < 2) throw new Error('File has no data rows');
            rows = jsonData.slice(1).map(r => r.map(v => String(v !== undefined && v !== null ? v : '').trim()));
        } else {
            const text = await file.text();
            const lines = text.trim().split('\n');
            if (lines.length < 2) throw new Error('File has no data rows');
            rows = lines.slice(1).map(line => {
                const vals = line.match(/("[^"]*"|[^,]+)/g) || [];
                return vals.map(v => v.trim().replace(/^"|"$/g, ''));
            });
        }

        let imported = 0;
        let errors = [];

        for (const row of rows) {
            if (row.length === 0 || !row.join('').trim()) continue;
            try {
                const payload = config.mapRow(row);
                
                // If it's parts, validate part_code exists globally first
                if (currentImportEntity === 'parts' && payload.part_code) {
                    const checkRes = await fetch(`/api/v1/parts/part-detail/${encodeURIComponent(payload.part_code)}`, {headers: getHeaders()});
                    if (checkRes.status === 404) {
                        errors.push(`Skipped ${payload.part_code} (Not found in global parts list)`);
                        continue;
                    }
                }
                
                const res = await fetch(`${API}/suppliers/${SUPPLIER_ID}/${config.endpoint}`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) imported++;
                else errors.push(`Row error: ${data.message}`);
            } catch (e) {
                errors.push(`Network Error: ${e.message}`);
            }
        }
        
        loadSupplierDetail(SUPPLIER_ID);
        if (errors.length) {
            console.error('Import Errors:', errors);
            showToast(`Imported ${imported}. Failed ${errors.length}. See console.`, 'error');
        } else {
            showToast(`Successfully imported ${imported} records`);
        }
    } catch (e) {
        showToast(e.message || 'Error processing file', 'error');
    }
}

async function viewDetailedHistory(entityId) {
    const config = ENTITY_CONFIG[entityId];
    if (!config) return;
    
    document.getElementById('dhTitle').textContent = `${config.name} History`;
    document.getElementById('dhBody').innerHTML = '<tr><td colspan="4" class="empty">Loading...</td></tr>';
    openModal('detailedHistoryModal');
    
    try {
        const res = await fetch(`${API}/suppliers/${SUPPLIER_ID}/detailed-history?entity_type=${encodeURIComponent(config.name)}`, { headers: getHeaders() });
        const data = await res.json();
        
        if (!data.success) throw new Error(data.message);
        
        const logs = data.data;
        if (!logs.length) {
            document.getElementById('dhBody').innerHTML = '<tr><td colspan="4" class="empty">No history found</td></tr>';
            return;
        }
        
        document.getElementById('dhBody').innerHTML = logs.map(l => {
            let changesHtml = '';
            if (l.action === 'UPDATE' && l.old_value && l.new_value) {
                changesHtml = '<ul style="margin:0;padding-left:20px;font-size:12px;">';
                for (const key in l.new_value) {
                    if (l.old_value[key] !== l.new_value[key] && key !== 'updated_at') {
                        changesHtml += `<li><strong>${key}:</strong> ${l.old_value[key]} &rarr; <span style="color:var(--success)">${l.new_value[key]}</span></li>`;
                    }
                }
                changesHtml += '</ul>';
            } else if (l.action === 'CREATE') {
                changesHtml = '<span style="color:var(--success);font-size:12px;">Record Created</span>';
                if (l.new_value && Object.keys(l.new_value).length > 0) {
                    changesHtml += '<ul style="margin:4px 0 0;padding-left:20px;font-size:11px;color:var(--text-color);">';
                    for (const key in l.new_value) {
                        changesHtml += `<li><strong>${key}:</strong> ${l.new_value[key]}</li>`;
                    }
                    changesHtml += '</ul>';
                }
            } else if (l.action === 'DELETE') {
                changesHtml = '<span style="color:var(--error);font-size:12px;">Record Deleted</span>';
                if (l.old_value && Object.keys(l.old_value).length > 0) {
                    changesHtml += '<ul style="margin:4px 0 0;padding-left:20px;font-size:11px;color:var(--text-color);">';
                    for (const key in l.old_value) {
                        changesHtml += `<li><strong>${key}:</strong> ${l.old_value[key]}</li>`;
                    }
                    changesHtml += '</ul>';
                }
            }
            
            return `<tr>
                <td style="white-space:nowrap;font-size:12px;">${new Date(l.created_at).toLocaleString()}</td>
                <td>${esc(l.user_name || l.user_email)}</td>
                <td><span class="status-badge status-draft">${esc(l.action)}</span></td>
                <td>${changesHtml || '-'}</td>
            </tr>`;
        }).join('');
        
    } catch (e) {
        document.getElementById('dhBody').innerHTML = `<tr><td colspan="4" class="empty error">Error: ${e.message}</td></tr>`;
    }
}

async function fetchPartManufacturers(partNumber) {
    try {
        const res = await fetch(`/api/v1/part/manufacturers/${encodeURIComponent(partNumber)}`, { headers: getHeaders() });
        const data = await res.json();
        
        const mpnInput = document.getElementById('partMPN');
        const makeInput = document.getElementById('partMake');
        
        let datalistMpn = document.getElementById('dl-mpn');
        if (!datalistMpn) { datalistMpn = document.createElement('datalist'); datalistMpn.id = 'dl-mpn'; document.body.appendChild(datalistMpn); }
        
        let datalistMake = document.getElementById('dl-make');
        if (!datalistMake) { datalistMake = document.createElement('datalist'); datalistMake.id = 'dl-make'; document.body.appendChild(datalistMake); }
        
        mpnInput.setAttribute('list', 'dl-mpn');
        makeInput.setAttribute('list', 'dl-make');
        
        if (data.success && data.data && data.data.length > 0) {
            datalistMpn.innerHTML = data.data.map(m => m.mpn ? `<option value="${esc(m.mpn)}">` : '').join('');
            datalistMake.innerHTML = data.data.map(m => m.make ? `<option value="${esc(m.make)}">` : '').join('');
            
            if (data.data.length === 1 && !mpnInput.value && !makeInput.value) {
                mpnInput.value = data.data[0].mpn || '';
                makeInput.value = data.data[0].make || '';
            }
        } else {
            datalistMpn.innerHTML = '';
            datalistMake.innerHTML = '';
        }
    } catch(e) {
        console.error('Error fetching manufacturers:', e);
    }
}

function toggleHistory(groupId) {
    const rows = document.querySelectorAll('.history-row-' + groupId);
    const icon = document.getElementById('icon-' + groupId);
    let isHidden = true;
    rows.forEach(r => {
        if (r.style.display === 'none') {
            r.style.display = 'table-row';
            isHidden = false;
        } else {
            r.style.display = 'none';
        }
    });
    if (icon) {
        icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }
}

// ── PURCHASE ORDERS TAB ──
async function loadSupplierPOs(sid) {
    const tbody = document.getElementById('supplierPOsBody');
    if (!tbody) return;
    try {
        const res = await fetch(`${API}/suppliers/${sid}/purchase-orders`, { headers: getHeaders() });
        const json = await res.json();
        if (!json.success) { tbody.innerHTML = `<tr><td colspan="8" class="empty" style="color:red">Error: ${json.message}</td></tr>`; return; }
        const count = (json.data || []).length;
        const navEl = document.getElementById('navCountPOs');
        if (navEl) navEl.textContent = count;
        renderPurchaseOrders(json.data || []);
    } catch (e) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="empty" style="color:red">Failed to load purchase orders.</td></tr>';
    }
}

function renderPurchaseOrders(list) {
    const tbody = document.getElementById('supplierPOsBody');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No purchase orders found for this supplier.</td></tr>'; return; }

    const statusColor = { draft: '#757575', sent_to_supplier: '#1565c0', acknowledged: '#2e7d32', cancelled: '#c62828' };
    const statusBg    = { draft: '#f5f5f5', sent_to_supplier: '#e3f2fd', acknowledged: '#e8f5e9', cancelled: '#ffebee' };

    window._supPOList = list;

    tbody.innerHTML = list.map((po, idx) => {
        const lines = po.lines || [];
        const sc = statusColor[po.po_status] || '#555';
        const sb = statusBg[po.po_status] || '#f5f5f5';
        return `<tr style="cursor:pointer;" onclick="openSupPODetail(${idx})">
            <td><span style="color:var(--primary);font-weight:600;text-decoration:underline;">${esc(po.po_no)}</span>${lines.length > 1 ? `<span style="font-size:10px;color:var(--text-muted);margin-left:4px;">(${lines.length} lines)</span>` : ''}</td>
            <td>${esc(po.pr_no || '\u2014')}</td>
            <td><code>${esc(po.item_code || '\u2014')}</code>${lines.length > 1 ? `<span style="font-size:10px;color:var(--text-muted);margin-left:4px;">(+${lines.length - 1} more)</span>` : ''}</td>
            <td>${po.order_qty.toLocaleString()}</td>
            <td><strong>\u20b9${po.total_amount.toLocaleString()}</strong></td>
            <td>${po.promised_date || '\u2014'}</td>
            <td style="font-size:12px;color:var(--text-muted);">${po.po_date || '\u2014'}</td>
            <td><span style="background:${sb};color:${sc};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;">${po.po_status || 'draft'}</span></td>
        </tr>`;
    }).join('');
}

function openSupPODetail(idx) {
    const po = (window._supPOList || [])[idx];
    if (!po) return;
    const statusColor = { draft: '#757575', sent_to_supplier: '#1565c0', acknowledged: '#2e7d32', cancelled: '#c62828' };
    const statusBg    = { draft: '#f5f5f5', sent_to_supplier: '#e3f2fd', acknowledged: '#e8f5e9', cancelled: '#ffebee' };
    const sc = statusColor[po.po_status] || '#555';
    const sb = statusBg[po.po_status] || '#f5f5f5';
    const lines = po.lines || [];

    const lineRows = lines.length ? lines.map(l => {
        const validAml = (l.aml || []).filter(m => m.mpn && m.mpn.trim());
        const amlHtml = validAml.length
            ? validAml.map(m => `<span class="aml-chip-group"><span class="aml-chip aml-chip-mpn">${esc(m.mpn)}</span><span class="aml-chip aml-chip-make">${esc(m.make || '\u2014')}</span></span>`).join(' ')
            : '<span style="color:var(--text-muted);font-size:11px;">\u2014</span>';
        return `<tr>
            <td style="padding:8px 12px;font-size:12px;"><code>${esc(l.item_code || '\u2014')}</code></td>
            <td style="padding:8px 12px;font-size:12px;">${esc(l.item_description || '\u2014')}</td>
            <td style="padding:8px 12px;font-size:12px;text-align:right;">${(l.order_qty||0).toLocaleString()} ${esc(l.uom||'')}</td>
            <td style="padding:8px 12px;font-size:12px;text-align:right;">\u20b9${(l.unit_price||0).toLocaleString()}</td>
            <td style="padding:8px 12px;font-size:12px;text-align:right;font-weight:600;">\u20b9${(l.total_amount||0).toLocaleString()}</td>
            <td style="padding:8px 12px;">${amlHtml}</td>
        </tr>`;
    }).join('') : `<tr><td colspan="6" style="padding:12px;text-align:center;color:var(--text-muted);font-size:12px;">No line items.</td></tr>`;

    document.getElementById('poDetailTitle').textContent = po.po_no;
    document.getElementById('poDetailBody').innerHTML = `
        <div style="padding:16px 20px;border-bottom:1px solid var(--border-color);display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;">
            <div class="sup-field-row"><div class="sup-field-label">PO No</div><div class="sup-field-val"><strong>${esc(po.po_no)}</strong></div></div>
            <div class="sup-field-row"><div class="sup-field-label">Status</div><div class="sup-field-val"><span style="background:${sb};color:${sc};border-radius:4px;padding:2px 10px;font-size:11px;font-weight:600;">${po.po_status||'draft'}</span></div></div>
            <div class="sup-field-row"><div class="sup-field-label">PR No</div><div class="sup-field-val">${esc(po.pr_no||'\u2014')}</div></div>
            <div class="sup-field-row"><div class="sup-field-label">PO Date</div><div class="sup-field-val">${esc(po.po_date||'\u2014')}</div></div>
            <div class="sup-field-row"><div class="sup-field-label">Supplier</div><div class="sup-field-val">${esc(po.supplier_name||'\u2014')}</div></div>
            <div class="sup-field-row"><div class="sup-field-label">
                Promised Date
                <button onclick="togglePoDateForm()" style="margin-left:6px;background:none;border:1px solid var(--primary);color:var(--primary);border-radius:4px;padding:1px 7px;font-size:10px;cursor:pointer;vertical-align:middle;">
                    <span class="material-icons-outlined" style="font-size:12px;vertical-align:middle;">edit_calendar</span> Update
                </button>
            </div><div class="sup-field-val" id="poPromisedDateDisplay">${esc(po.promised_date||'\u2014')}</div></div>
            <div class="sup-field-row"><div class="sup-field-label">Total Qty</div><div class="sup-field-val">${(po.order_qty||0).toLocaleString()}</div></div>
            <div class="sup-field-row"><div class="sup-field-label">Total Value</div><div class="sup-field-val"><strong>\u20b9${(po.total_amount||0).toLocaleString()}</strong></div></div>
            ${po.created_by ? `<div class="sup-field-row"><div class="sup-field-label">Created By</div><div class="sup-field-val">${esc(po.created_by)}</div></div>` : ''}
            ${po.notes ? `<div class="sup-field-row" style="grid-column:1/-1;"><div class="sup-field-label">Notes</div><div class="sup-field-val" style="font-size:12px;white-space:pre-wrap;">${esc(po.notes)}</div></div>` : ''}
            ${po.supplier_invoice_no ? `<div class="sup-field-row"><div class="sup-field-label">Invoice No</div><div class="sup-field-val">${esc(po.supplier_invoice_no)}</div></div>` : ''}
            ${po.supplier_invoice_amount ? `<div class="sup-field-row"><div class="sup-field-label">Invoice Amount</div><div class="sup-field-val">\u20b9${(po.supplier_invoice_amount||0).toLocaleString()}</div></div>` : ''}
        </div>
        <div id="poDateUpdateForm" style="display:none;padding:12px 20px;border-bottom:1px solid var(--border-color);background:var(--bg-secondary);">
            <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px;">UPDATE PROMISED DELIVERY DATE</div>
            <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
                <div class="form-group" style="margin:0;flex:0 0 160px;">
                    <label style="font-size:11px;">New Date</label>
                    <input type="date" id="poNewDate" value="${po.promised_date||''}" style="font-size:13px;padding:6px 8px;">
                </div>
                <div class="form-group" style="margin:0;flex:1;min-width:180px;">
                    <label style="font-size:11px;">Reason <span style="color:var(--text-muted)">(e.g. supplier delayed by 2 days)</span></label>
                    <input type="text" id="poDateReason" placeholder="e.g. Material arriving late, delayed by 2 days" style="font-size:13px;padding:6px 8px;">
                </div>
                <button class="btn-primary" style="padding:6px 16px;font-size:12px;" onclick="savePoPromisedDate('${po.id}',${idx})">
                    <span class="material-icons-outlined" style="font-size:14px;vertical-align:middle;">save</span> Save
                </button>
                <button class="btn-secondary" style="padding:6px 12px;font-size:12px;" onclick="togglePoDateForm()">Cancel</button>
            </div>
        </div>
        <div style="padding:12px 20px 16px;">
            <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px;">LINE ITEMS (${lines.length})</div>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                    <thead><tr style="background:var(--bg-secondary);">
                        <th style="padding:6px 12px;text-align:left;font-weight:600;color:var(--text-muted);">Item Code</th>
                        <th style="padding:6px 12px;text-align:left;font-weight:600;color:var(--text-muted);">Description</th>
                        <th style="padding:6px 12px;text-align:right;font-weight:600;color:var(--text-muted);">Qty</th>
                        <th style="padding:6px 12px;text-align:right;font-weight:600;color:var(--text-muted);">Unit Price</th>
                        <th style="padding:6px 12px;text-align:right;font-weight:600;color:var(--text-muted);">Total</th>
                        <th style="padding:6px 12px;text-align:left;font-weight:600;color:var(--text-muted);">MPN / Make</th>
                    </tr></thead>
                    <tbody>${lineRows}</tbody>
                </table>
            </div>
        </div>`;
    openModal('poDetailModal');
}

function togglePoDateForm() {
    const f = document.getElementById('poDateUpdateForm');
    if (f) f.style.display = f.style.display === 'none' ? '' : 'none';
}

async function savePoPromisedDate(poId, idx) {
    const newDate = document.getElementById('poNewDate').value;
    const reason  = document.getElementById('poDateReason').value.trim();
    if (!newDate) { showToast('Please select a date', 'error'); return; }
    const sid = SD.supplier.id;
    try {
        const res = await fetch(`${API}/suppliers/${sid}/purchase-orders/${poId}/promised-date`, {
            method: 'PUT', headers: getHeaders(),
            body: JSON.stringify({ promised_date: newDate, reason })
        });
        const json = await res.json();
        if (!json.success) { showToast(json.message || 'Failed', 'error'); return; }
        // Update in-memory list and refresh display
        if (window._supPOList && window._supPOList[idx]) {
            window._supPOList[idx].promised_date = newDate;
            if (reason) {
                const note = ` | Date revised \u2192 ${newDate}` + (reason ? `: ${reason}` : '');
                window._supPOList[idx].notes = (window._supPOList[idx].notes || '') + note;
            }
        }
        document.getElementById('poPromisedDateDisplay').textContent = newDate;
        togglePoDateForm();
        showToast('Promised date updated');
        // Refresh the table row too
        renderPurchaseOrders(window._supPOList);
    } catch (e) {
        showToast('Error updating date', 'error');
    }
}
