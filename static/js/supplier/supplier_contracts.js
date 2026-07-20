// ─── SUPPLIER CONTRACTS PAGE ───
let allRows = [], allSuppliers = [];
let _supSearchTimer = null;

async function loadAll() {
    const res = await fetch(`${API}/suppliers`, { headers: getHeaders() });
    const data = await res.json();
    allSuppliers = data.data || [];

    const chunks = [];
    for (let i = 0; i < allSuppliers.length; i += 10) chunks.push(allSuppliers.slice(i, i + 10));

    allRows = [];
    for (const chunk of chunks) {
        const results = await Promise.all(chunk.map(s =>
            fetch(`${API}/suppliers/${s.id}/contracts`, { headers: getHeaders() })
                .then(r => r.json())
                .then(d => (d.data || []).map(c => ({ ...c, _supplier: s })))
                .catch(() => [])
        ));
        results.forEach(r => allRows.push(...r));
    }
    renderTable(allRows);
}

function filterTable(q) {
    const lq = (q || '').toLowerCase();
    const status = document.getElementById('contractStatusFilter').value;
    const stage = document.getElementById('contractStageFilter').value;
    const filtered = allRows.filter(r => {
        const matchQ = !lq || lq.length < 2 ||
            (r._supplier.brand_name || '').toLowerCase().includes(lq) ||
            (r.contract_number || '').toLowerCase().includes(lq) ||
            (r.contract_type || '').toLowerCase().includes(lq) ||
            (r._supplier.supplier_code || '').toLowerCase().includes(lq);
        const matchStatus = !status || (r.status || '') === status;
        const matchStage = !stage || (r.lifecycle_stage || '') === stage;
        return matchQ && matchStatus && matchStage;
    });
    renderTable(filtered);
}

function renderTable(list) {
    const tbody = document.getElementById('contractBody');
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="12" class="empty">No contracts found.</td></tr>';
        return;
    }
    tbody.innerHTML = list.map(c => {
        const s = c._supplier;
        const isExpiring = c.end_date && (new Date(c.end_date) - new Date()) < 30 * 24 * 3600 * 1000 && new Date(c.end_date) > new Date();
        return `<tr>
            <td><a class="sup-code-link" href="/supplier/detail/${s.id}#contracts">${esc(s.brand_name)}</a><br>
                <span style="font-size:11px;color:var(--text-muted)">${esc(s.supplier_code)}</span></td>
            <td><span class="sup-code">${esc(c.contract_number || '—')}</span></td>
            <td>${esc(c.contract_type || '—')}</td>
            <td>${fmtDate(c.start_date)}</td>
            <td>${fmtDate(c.end_date)}${isExpiring ? ' <span style="font-size:10px;color:#e65100;font-weight:700">⚠ Expiring</span>' : ''}</td>
            <td><strong>₹${fmtNum(c.contract_value || 0)}</strong></td>
            <td style="font-size:12px">${esc(c.payment_terms || '—')}</td>
            <td style="font-size:12px">${esc(c.delivery_terms || '—')}</td>
            <td><span style="font-size:11px;padding:2px 8px;border-radius:10px;background:var(--accent-light);color:var(--accent)">${esc(c.lifecycle_stage || '—')}</span></td>
            <td>${statusBadge(c.status || 'draft')}</td>
            <td>${c.auto_renew ? '<span style="color:#2e7d32;font-weight:700;font-size:12px">✓ Yes</span>' : '<span style="color:var(--text-muted);font-size:12px">No</span>'}</td>
            <td class="actions-cell">
                <button class="btn-action btn-danger" title="Delete" onclick="confirmDelete('${c.id}','${s.id}','${esc(c.contract_number || s.brand_name)}')">
                    <span class="material-icons-outlined">delete</span>
                </button>
            </td>
        </tr>`;
    }).join('');
}

// ── SUPPLIER SEARCH IN MODAL ──
function searchSupplier(q) {
    clearTimeout(_supSearchTimer);
    const dd = document.getElementById('contractSupplierDropdown');
    if (!q || q.length < 2) { dd.style.display = 'none'; return; }
    _supSearchTimer = setTimeout(async () => {
        const res = await fetch(`${API}/search?q=${encodeURIComponent(q)}`, { headers: getHeaders() });
        const data = await res.json();
        const items = data.data || [];
        if (!items.length) { dd.style.display = 'none'; return; }
        dd.innerHTML = items.map(s =>
            `<div class="item-search-option" onclick="selectSupplier('${s.id}','${esc(s.supplier_code)}','${esc(s.brand_name)}')">
                <span class="item-search-code">${esc(s.supplier_code)}</span>
                <span class="item-search-desc">${esc(s.brand_name)}</span>
                ${statusBadge(s.status)}
            </div>`
        ).join('');
        dd.style.display = 'block';
    }, 280);
}

function selectSupplier(id, code, name) {
    document.getElementById('contractSupplierId').value = id;
    document.getElementById('contractSupplierSearch').value = name;
    document.getElementById('contractSupplierDropdown').style.display = 'none';
    document.getElementById('contractSupplierSelected').textContent = `✓ ${code} — ${name}`;
}

document.addEventListener('click', e => {
    if (!e.target.closest('#contractSupplierSearch') && !e.target.closest('#contractSupplierDropdown')) {
        const dd = document.getElementById('contractSupplierDropdown');
        if (dd) dd.style.display = 'none';
    }
});

// ── ADD / SAVE ──
function openAddModal() {
    document.getElementById('contractModalTitle').textContent = 'New Contract';
    document.getElementById('contractId').value = '';
    document.getElementById('contractSupplierId').value = '';
    document.getElementById('contractSupplierSearch').value = '';
    document.getElementById('contractSupplierSelected').textContent = '';
    ['contractNumber','contractType','contractStart','contractEnd','contractPayment','contractDelivery','contractAttachment','contractNotes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('contractValue').value = '';
    document.getElementById('contractStatus').value = 'draft';
    document.getElementById('contractStage').value = 'draft';
    document.getElementById('contractAutoRenew').checked = false;
    openModal('addContractModal');
}

async function saveContract(e) {
    e.preventDefault();
    const sid = document.getElementById('contractSupplierId').value;
    if (!sid) { showToast('Please select a supplier', 'error'); return; }
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
    const res = await fetch(`${API}/suppliers/${sid}/contracts`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('addContractModal'); showToast('Contract saved'); loadAll(); }
    else showToast(data.message || 'Error', 'error');
}

function confirmDelete(cid, sid, name) {
    document.getElementById('deleteMsg').textContent = `Delete contract "${name}"?`;
    document.getElementById('deleteConfirmBtn').onclick = async () => {
        const res = await fetch(`${API}/suppliers/${sid}/contracts/${cid}`, { method: 'DELETE', headers: getHeaders() });
        const data = await res.json();
        if (data.success) { closeModal('deleteModal'); showToast('Contract deleted'); loadAll(); }
        else showToast(data.message || 'Error', 'error');
    };
    openModal('deleteModal');
}

loadAll();
