// ─── SUPPLIER PERFORMANCE PAGE ───
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
            fetch(`${API}/suppliers/${s.id}/performance`, { headers: getHeaders() })
                .then(r => r.json())
                .then(d => (d.data || []).map(p => ({ ...p, _supplier: s })))
                .catch(() => [])
        ));
        results.forEach(r => allRows.push(...r));
    }
    renderTable(allRows);
}

function filterTable(q) {
    const lq = (q || '').toLowerCase();
    const grade = document.getElementById('perfGradeFilter').value;
    const filtered = allRows.filter(r => {
        const matchQ = !lq || lq.length < 2 ||
            (r._supplier.brand_name || '').toLowerCase().includes(lq) ||
            (r.period || '').toLowerCase().includes(lq) ||
            (r._supplier.supplier_code || '').toLowerCase().includes(lq);
        const matchGrade = !grade || (r.performance_grade || '') === grade;
        return matchQ && matchGrade;
    });
    renderTable(filtered);
}

function gradeColor(g) {
    const map = { A: '#2e7d32', B: '#1565c0', C: '#e65100', D: '#c62828' };
    return map[g] || '#555';
}

function renderTable(list) {
    const tbody = document.getElementById('perfBody');
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="11" class="empty">No performance reviews found.</td></tr>';
        return;
    }
    tbody.innerHTML = list.map(p => {
        const s = p._supplier;
        const gc = gradeColor(p.performance_grade);
        return `<tr>
            <td><a class="sup-code-link" href="/supplier/detail/${s.id}#performance">${esc(s.brand_name)}</a><br>
                <span style="font-size:11px;color:var(--text-muted)">${esc(s.supplier_code)}</span></td>
            <td>${esc(p.period || '—')}</td>
            <td>${fmtNum(p.po_count || 0)}</td>
            <td>${fmtNum(p.grn_count || 0)}</td>
            <td>${fmtNum(p.inspection_pass_rate || 0)}%</td>
            <td>${fmtNum(p.ncr_count || 0)}</td>
            <td>${fmtNum(p.quality_defect_rate || 0)}%</td>
            <td>${fmtNum(p.on_time_delivery_rate || 0)}%</td>
            <td><strong style="color:var(--accent)">${fmtNum(p.overall_score || 0)}%</strong></td>
            <td><span style="font-size:14px;font-weight:800;color:${gc};background:${gc}22;padding:3px 10px;border-radius:8px">${esc(p.performance_grade || '—')}</span></td>
            <td class="actions-cell">
                <button class="btn-action btn-danger" title="Delete" onclick="confirmDelete('${p.id}','${s.id}','${esc(s.brand_name)} ${esc(p.period || '')}')">
                    <span class="material-icons-outlined">delete</span>
                </button>
            </td>
        </tr>`;
    }).join('');
}

// ── SUPPLIER SEARCH IN MODAL ──
function searchSupplier(q) {
    clearTimeout(_supSearchTimer);
    const dd = document.getElementById('perfSupplierDropdown');
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
    document.getElementById('perfSupplierId').value = id;
    document.getElementById('perfSupplierSearch').value = name;
    document.getElementById('perfSupplierDropdown').style.display = 'none';
    document.getElementById('perfSupplierSelected').textContent = `✓ ${code} — ${name}`;
}

document.addEventListener('click', e => {
    if (!e.target.closest('#perfSupplierSearch') && !e.target.closest('#perfSupplierDropdown')) {
        const dd = document.getElementById('perfSupplierDropdown');
        if (dd) dd.style.display = 'none';
    }
});

// ── ADD / SAVE ──
function openAddModal() {
    document.getElementById('perfModalTitle').textContent = 'New Performance Review';
    document.getElementById('perfId').value = '';
    document.getElementById('perfSupplierId').value = '';
    document.getElementById('perfSupplierSearch').value = '';
    document.getElementById('perfSupplierSelected').textContent = '';
    ['perfPeriod','perfPO','perfGRN','perfInspection','perfNCR','perfDefect','perfOTD','perfOverall'].forEach(id => document.getElementById(id).value = '');
    openModal('addPerfModal');
}

async function savePerf(e) {
    e.preventDefault();
    const sid = document.getElementById('perfSupplierId').value;
    if (!sid) { showToast('Please select a supplier', 'error'); return; }
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
    const res = await fetch(`${API}/suppliers/${sid}/performance`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('addPerfModal'); showToast('Performance review saved'); loadAll(); }
    else showToast(data.message || 'Error', 'error');
}

function confirmDelete(pid, sid, name) {
    document.getElementById('deleteMsg').textContent = `Delete performance review for "${name}"?`;
    document.getElementById('deleteConfirmBtn').onclick = async () => {
        const res = await fetch(`${API}/suppliers/${sid}/performance/${pid}`, { method: 'DELETE', headers: getHeaders() });
        const data = await res.json();
        if (data.success) { closeModal('deleteModal'); showToast('Review deleted'); loadAll(); }
        else showToast(data.message || 'Error', 'error');
    };
    openModal('deleteModal');
}

loadAll();
