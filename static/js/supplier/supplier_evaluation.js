// ─── SUPPLIER EVALUATION PAGE ───
let allRows = [], allSuppliers = [];
let _supSearchTimer = null;

async function loadAll() {
    const res = await fetch(`${API}/suppliers`, { headers: getHeaders() });
    const data = await res.json();
    allSuppliers = data.data || [];

    // Fetch evaluations for all suppliers in parallel (limit to avoid overload)
    const chunks = [];
    for (let i = 0; i < allSuppliers.length; i += 10) chunks.push(allSuppliers.slice(i, i + 10));

    allRows = [];
    for (const chunk of chunks) {
        const results = await Promise.all(chunk.map(s =>
            fetch(`${API}/suppliers/${s.id}/evaluations`, { headers: getHeaders() })
                .then(r => r.json())
                .then(d => (d.data || []).map(e => ({ ...e, _supplier: s })))
                .catch(() => [])
        ));
        results.forEach(r => allRows.push(...r));
    }
    renderTable(allRows);
}

function filterTable(q) {
    const lq = (q || '').toLowerCase();
    const status = document.getElementById('evalStatusFilter').value;
    const stage = document.getElementById('evalStageFilter').value;
    const filtered = allRows.filter(r => {
        const matchQ = !lq || lq.length < 2 ||
            (r._supplier.brand_name || '').toLowerCase().includes(lq) ||
            (r.period || '').toLowerCase().includes(lq) ||
            (r._supplier.supplier_code || '').toLowerCase().includes(lq);
        const matchStatus = !status || (r.approval_status || '') === status;
        const matchStage = !stage || (r.workflow_stage || '') === stage;
        return matchQ && matchStatus && matchStage;
    });
    renderTable(filtered);
}

function renderTable(list) {
    const tbody = document.getElementById('evalBody');
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="14" class="empty">No evaluations found.</td></tr>';
        return;
    }
    tbody.innerHTML = list.map(e => {
        const s = e._supplier;
        return `<tr>
            <td><a class="sup-code-link" href="/supplier/detail/${s.id}#evaluations">${esc(s.brand_name)}</a><br>
                <span style="font-size:11px;color:var(--text-muted)">${esc(s.supplier_code)}</span></td>
            <td>${esc(e.period || fmtDate(e.evaluation_date) || '—')}</td>
            <td><span style="font-size:11px;padding:2px 8px;border-radius:10px;background:var(--accent-light);color:var(--accent)">${esc(e.workflow_stage || '—')}</span></td>
            <td>${statusBadge(e.document_verification_status || 'pending')}</td>
            <td><strong style="color:var(--accent)">${fmtNum(e.overall_score || 0)}%</strong></td>
            <td>${fmtNum(e.quality_score || 0)}%</td>
            <td>${fmtNum(e.price_score || 0)}%</td>
            <td>${fmtNum(e.delivery_score || 0)}%</td>
            <td>${fmtNum(e.capacity_score || 0)}%</td>
            <td>${fmtNum(e.financial_stability_score || 0)}%</td>
            <td>${fmtNum(e.experience_score || 0)}%</td>
            <td>${fmtNum(e.technical_support_score || 0)}%</td>
            <td>${statusBadge(e.approval_status || 'pending')}</td>
            <td class="actions-cell">
                <button class="btn-action btn-danger" title="Delete" onclick="confirmDelete('${e.id}','${s.id}','${esc(s.brand_name)}')">
                    <span class="material-icons-outlined">delete</span>
                </button>
            </td>
        </tr>`;
    }).join('');
}

// ── SUPPLIER SEARCH IN MODAL ──
function searchSupplier(q) {
    clearTimeout(_supSearchTimer);
    const dd = document.getElementById('evalSupplierDropdown');
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
    document.getElementById('evalSupplierId').value = id;
    document.getElementById('evalSupplierSearch').value = name;
    document.getElementById('evalSupplierDropdown').style.display = 'none';
    document.getElementById('evalSupplierSelected').textContent = `✓ ${code} — ${name}`;
}

document.addEventListener('click', e => {
    if (!e.target.closest('#evalSupplierSearch') && !e.target.closest('#evalSupplierDropdown')) {
        const dd = document.getElementById('evalSupplierDropdown');
        if (dd) dd.style.display = 'none';
    }
});

// ── ADD / SAVE ──
function openAddModal() {
    document.getElementById('evalModalTitle').textContent = 'New Evaluation';
    document.getElementById('evalId').value = '';
    document.getElementById('evalSupplierId').value = '';
    document.getElementById('evalSupplierSearch').value = '';
    document.getElementById('evalSupplierSelected').textContent = '';
    ['evalPeriod','evalComments'].forEach(id => document.getElementById(id).value = '');
    ['evalQ','evalP','evalD','evalC','evalF','evalE','evalT','evalOverall'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('evalDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('evalStage').value = 'evaluation';
    document.getElementById('evalDocStatus').value = 'verified';
    document.getElementById('evalApproval').value = 'pending';
    openModal('addEvalModal');
}

async function saveEval(e) {
    e.preventDefault();
    const sid = document.getElementById('evalSupplierId').value;
    if (!sid) { showToast('Please select a supplier', 'error'); return; }
    const body = {
        evaluation_date: document.getElementById('evalDate').value || null,
        period: document.getElementById('evalPeriod').value.trim(),
        workflow_stage: document.getElementById('evalStage').value,
        document_verification_status: document.getElementById('evalDocStatus').value,
        quality_score: parseFloat(document.getElementById('evalQ').value) || 0,
        price_score: parseFloat(document.getElementById('evalP').value) || 0,
        delivery_score: parseFloat(document.getElementById('evalD').value) || 0,
        capacity_score: parseFloat(document.getElementById('evalC').value) || 0,
        financial_stability_score: parseFloat(document.getElementById('evalF').value) || 0,
        experience_score: parseFloat(document.getElementById('evalE').value) || 0,
        technical_support_score: parseFloat(document.getElementById('evalT').value) || 0,
        overall_score: parseFloat(document.getElementById('evalOverall').value) || 0,
        approval_status: document.getElementById('evalApproval').value,
        comments: document.getElementById('evalComments').value.trim()
    };
    const res = await fetch(`${API}/suppliers/${sid}/evaluations`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('addEvalModal'); showToast('Evaluation saved'); loadAll(); }
    else showToast(data.message || 'Error', 'error');
}

function confirmDelete(eid, sid, name) {
    document.getElementById('deleteMsg').textContent = `Delete evaluation for "${name}"?`;
    document.getElementById('deleteConfirmBtn').onclick = async () => {
        const res = await fetch(`${API}/suppliers/${sid}/evaluations/${eid}`, { method: 'DELETE', headers: getHeaders() });
        const data = await res.json();
        if (data.success) { closeModal('deleteModal'); showToast('Evaluation deleted'); loadAll(); }
        else showToast(data.message || 'Error', 'error');
    };
    openModal('deleteModal');
}

loadAll();
