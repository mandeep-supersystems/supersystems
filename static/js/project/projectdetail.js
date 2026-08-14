// ─── PROJECT MODULE: PROJECT DETAIL ───
function showPdTab(tab) {
    document.querySelectorAll('#sec-projectdetail .tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('#pdTabs .form-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('pdTab-' + tab).classList.add('active');
    event.target.classList.add('active');
    if (tab === 'customer-pos') {
        loadCustomerPOs(currentProjectId);
    }
}

async function openProject(id) {
    currentProjectId = id;
    const res = await fetch(API + '/projects/' + id, { headers: HEADERS });
    const data = await res.json();
    if (!data.success) { alert(data.message); return; }
    const p = data.data;
    document.getElementById('pdTitle').textContent = `${p.project_number} — ${p.project_name}`;
    document.getElementById('pdCards').innerHTML = `<div class="detail-cards-grid">
        <div class="d-card"><span class="d-label">Status</span><span class="status-badge status-${p.status}">${p.status}</span></div>
        <div class="d-card"><span class="d-label">Organization</span><span class="d-value">${p.organization_name||'—'}</span></div>
        <div class="d-card"><span class="d-label">% Complete</span><span class="d-value">${p.percent_complete}%</span></div>
        <div class="d-card"><span class="d-label">Start</span><span class="d-value">${p.start_date||'—'}</span></div>
        <div class="d-card"><span class="d-label">Due</span><span class="d-value">${p.due_date||'—'}</span></div>
        <div class="d-card"><span class="d-label">Type</span><span class="d-value">${p.project_type||'—'}</span></div>
        <div class="d-card"><span class="d-label">Owner</span><span class="d-value">${p.owner||'—'}</span></div>
        <div class="d-card"><span class="d-label">Tasks</span><span class="d-value">${p.open_tasks}/${p.total_tasks}</span></div>
    </div>`;
    // reset tabs to overview
    document.querySelectorAll('#sec-projectdetail .tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('#pdTabs .form-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('pdTab-overview').classList.add('active');
    document.querySelector('#pdTabs .form-tab').classList.add('active');
    showSection('projectdetail');
}

// ─── TASKS ───
async function loadTasks(pid) {
    const tbody = document.getElementById('tasksTableBody');
    const res = await fetch(API + '/projects/' + pid + '/tasks', { headers: HEADERS });
    const data = await res.json();
    if (!data.success || !data.data.length) { tbody.innerHTML = '<tr><td colspan="10" class="empty">No tasks</td></tr>'; return; }
    tbody.innerHTML = data.data.map(t => `<tr>
        <td><strong>${esc(t.task_name)}</strong></td><td>${esc(t.stage)}</td><td>${esc(t.owner)}</td>
        <td>${t.start_date}</td><td>${t.due_date}</td>
        <td>${t.planned_cost?'₹'+t.planned_cost.toLocaleString():'—'}</td>
        <td>${t.invoiced_amount?'₹'+t.invoiced_amount.toLocaleString():'—'}</td>
        <td><div class="progress-bar sm"><div class="progress-fill" style="width:${t.percent_complete}%"></div><span>${t.percent_complete}%</span></div></td>
        <td><span class="status-badge status-${t.status}">${t.status}</span></td>
        <td class="actions-cell"><button class="btn-icon" onclick="openEditTask('${t.id}','${esc(t.task_name)}','${esc(t.description||'')}','${esc(t.stage)}','${esc(t.owner)}','${t.start_date}','${t.end_date}','${t.due_date}','${t.planned_cost}','${t.invoiced_amount}','${t.percent_complete}','${esc(t.dependencies)}','${t.status}')"><span class="material-icons-outlined">edit</span></button><button class="btn-icon danger" onclick="deleteTask('${t.id}')"><span class="material-icons-outlined">delete</span></button></td>
    </tr>`).join('');
}
function openAddTaskModal() { document.querySelectorAll('#addTaskModal input, #addTaskModal textarea').forEach(el => { if (el.type!=='submit'&&el.type!=='button') el.value = el.type==='number'?'0':''; }); openModal('addTaskModal'); }
async function saveTask(e) { e.preventDefault(); const body = { task_name: document.getElementById('atName').value.trim(), description: document.getElementById('atDesc').value.trim(), stage: document.getElementById('atStage').value.trim(), owner: document.getElementById('atOwner').value.trim(), start_date: document.getElementById('atStart').value||null, end_date: document.getElementById('atEnd').value||null, due_date: document.getElementById('atDue').value||null, planned_cost: parseFloat(document.getElementById('atCost').value)||0, invoiced_amount: parseFloat(document.getElementById('atInvoiced').value)||0, percent_complete: parseFloat(document.getElementById('atPct').value)||0, dependencies: document.getElementById('atDeps').value.trim() }; const res = await fetch(API+'/projects/'+currentProjectId+'/tasks',{method:'POST',headers:HEADERS,body:JSON.stringify(body)}); const data = await res.json(); if(data.success){closeModal('addTaskModal');loadTasks(currentProjectId);}else{alert(data.message);} }
function openEditTask(id,name,desc,stage,owner,start,end,due,cost,inv,pct,deps,status){document.getElementById('etId').value=id;document.getElementById('etName').value=name;document.getElementById('etDesc').value=desc;document.getElementById('etStage').value=stage;document.getElementById('etOwner').value=owner;document.getElementById('etStart').value=start;document.getElementById('etEnd').value=end;document.getElementById('etDue').value=due;document.getElementById('etCost').value=cost;document.getElementById('etInvoiced').value=inv;document.getElementById('etPct').value=pct;document.getElementById('etDeps').value=deps;document.getElementById('etStatus').value=status;openModal('editTaskModal');}
async function updateTask(e){e.preventDefault();const id=document.getElementById('etId').value;const body={task_name:document.getElementById('etName').value.trim(),description:document.getElementById('etDesc').value.trim(),stage:document.getElementById('etStage').value.trim(),owner:document.getElementById('etOwner').value.trim(),start_date:document.getElementById('etStart').value||null,end_date:document.getElementById('etEnd').value||null,due_date:document.getElementById('etDue').value||null,planned_cost:parseFloat(document.getElementById('etCost').value)||0,invoiced_amount:parseFloat(document.getElementById('etInvoiced').value)||0,percent_complete:parseFloat(document.getElementById('etPct').value)||0,dependencies:document.getElementById('etDeps').value.trim(),status:document.getElementById('etStatus').value};const res=await fetch(API+'/tasks/'+id,{method:'PUT',headers:HEADERS,body:JSON.stringify(body)});const data=await res.json();if(data.success){closeModal('editTaskModal');loadTasks(currentProjectId);}else{alert(data.message);}}
async function deleteTask(id){if(!confirm('Delete this task?'))return;const res=await fetch(API+'/tasks/'+id,{method:'DELETE',headers:HEADERS});const data=await res.json();if(data.success)loadTasks(currentProjectId);else alert(data.message);}

// ─── CUSTOMER POs (received FROM customer, stored on project) ───
async function loadCustomerPOs(pid) {
    const grid = document.getElementById('customerPosGrid');
    grid.innerHTML = '<div class="cpo-loading">Loading…</div>';
    const res = await fetch(API + '/projects/' + pid + '/customer-pos', { headers: HEADERS });
    const data = await res.json();
    if (!data.success || !data.data.length) {
        grid.innerHTML = '<div class="cpo-empty-state"><span class="cpo-empty-icon">📄</span><div>No Customer POs yet</div><div style="font-size:12px;margin-top:4px;">Click “Add Customer PO” to import or create one</div></div>';
        const sb = document.getElementById('cpoSummaryBar'); if (sb) sb.textContent = '';
        return;
    }
    const pos = data.data;
    const totalVal = pos.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const cur = pos[0]?.currency === 'INR' ? '₹' : (pos[0]?.currency || '');
    const sb = document.getElementById('cpoSummaryBar');
    if (sb) sb.innerHTML = pos.length + ' PO' + (pos.length !== 1 ? 's' : '') + ' &nbsp;&bull;&nbsp; Total: <strong>' + cur + ' ' + totalVal.toLocaleString('en-IN', {minimumFractionDigits:2}) + '</strong>';
    const statusMeta = {
        received:     { label: 'Received',     cls: 'cpo-s-received' },
        acknowledged: { label: 'Acknowledged', cls: 'cpo-s-acknowledged' },
        in_progress:  { label: 'In Progress',  cls: 'cpo-s-in_progress' },
        completed:    { label: 'Completed',    cls: 'cpo-s-completed' },
        cancelled:    { label: 'Cancelled',    cls: 'cpo-s-cancelled' },
    };
    grid.innerHTML = pos.map(po => {
        const sm = statusMeta[po.status] || { label: po.status, cls: '' };
        const lines = po.lines || [];
        const subtotal = lines.reduce((s, l) => s + (l.qty * l.cost), 0);
        const igst     = subtotal * 0.18;
        const orderTotal = subtotal + igst;
        const fmt = v => '₹ ' + v.toLocaleString('en-IN', {minimumFractionDigits:2});
        const linesHtml = lines.length ? lines.map((l, i) =>
            '<div class="cpo-line-item' + (i % 2 === 1 ? ' cpo-line-alt' : '') + '">' +
            '<span class="cpo-line-num">' + (i + 1) + '</span>' +
            '<span class="cpo-line-pn">' + esc(l.part_number) + '</span>' +
            '<span class="cpo-line-qty"><strong>' + l.qty + '</strong></span>' +
            '<span class="cpo-line-price">' + fmt(parseFloat(l.cost)) + '</span>' +
            '<span class="cpo-line-total-val">' + fmt(l.qty * l.cost) + '</span>' +
            '</div>').join('') : '<div class="cpo-no-lines">No line items</div>';
        const summaryHtml =
            '<div class="cpo-summary">' +
                '<div class="cpo-summary-row"><span>Total Base Amount (Subtotal)</span><span>' + fmt(subtotal) + '</span></div>' +
                '<div class="cpo-summary-row"><span>IGST @18%</span><span>' + fmt(igst) + '</span></div>' +
                '<div class="cpo-summary-row cpo-summary-total"><span>Total Order Value</span><span>' + fmt(orderTotal) + '</span></div>' +
            '</div>';
        return '<div class="cpo-card">' +
            '<div class="cpo-card-top">' +
                '<div class="cpo-card-left">' +
                    '<div class="cpo-card-po-num">' + esc(po.po_number) + '</div>' +
                    '<div class="cpo-card-customer">' + (esc(po.customer_name) || '&mdash;') + '</div>' +
                '</div>' +
                '<div class="cpo-card-right">' +
                    '<span class="cpo-status-badge ' + sm.cls + '">' + sm.label + '</span>' +
                    '<button class="cpo-delete-btn" onclick="deleteCustomerPO(\''+ pid +'\',\''+ po.id +'\')" title="Delete">✕</button>' +
                '</div>' +
            '</div>' +
            '<div class="cpo-card-meta">' +
                '<div class="cpo-meta-item"><span class="cpo-meta-label">PO Date</span><span>' + (po.po_date || '&mdash;') + '</span></div>' +
                '<div class="cpo-meta-item"><span class="cpo-meta-label">Delivery</span><span>' + (po.delivery_date || '&mdash;') + '</span></div>' +
                '<div class="cpo-meta-item"><span class="cpo-meta-label">Currency</span><span>' + esc(po.currency) + '</span></div>' +
                '<div class="cpo-meta-item cpo-meta-amount"><span class="cpo-meta-label">Stored Amount</span><span class="cpo-amount-val">' + (po.amount ? '₹ ' + parseFloat(po.amount).toLocaleString('en-IN',{minimumFractionDigits:2}) : '&mdash;') + '</span></div>' +
            '</div>' +
            (po.remarks ? '<div class="cpo-remarks">' + esc(po.remarks) + '</div>' : '') +
            '<div class="cpo-lines-section">' +
                '<div class="cpo-lines-header"><span>Line Items</span><span class="cpo-lines-count">' + lines.length + ' item' + (lines.length !== 1 ? 's' : '') + '</span></div>' +
                '<div class="cpo-lines-col-header"><span>#</span><span>Part / Description</span><span>Qty</span><span>Unit Price</span><span>Line Total</span></div>' +
                '<div class="cpo-lines-body">' + linesHtml + '</div>' +
                summaryHtml +
            '</div>' +
        '</div>';
    }).join('');
}
function addCustomerPOLineRow(partNumber = '', qty = 1, cost = 0) {
    const container = document.getElementById('cpoLinesContainer');
    const lineTotal = (parseFloat(qty) * parseFloat(cost)).toFixed(2);
    const rowNum = container.querySelectorAll('.cpo-line-row').length + 1;
    const div = document.createElement('div');
    div.className = 'cpo-line-row';
    div.style = 'display:grid;grid-template-columns:28px 2fr 0.8fr 1.1fr 1.1fr 32px;gap:6px;padding:6px 8px;border-bottom:1px solid var(--border-color);align-items:center;';
    div.innerHTML = `
        <span class="cpo-row-num" style="font-size:11px;font-weight:600;color:var(--text-secondary);">${rowNum}</span>
        <input type="text" placeholder="Part number or description" class="cpo-part-number" value="${esc(partNumber)}" style="width:100%;box-sizing:border-box;">
        <input type="number" placeholder="Qty" class="cpo-part-qty" value="${qty}" min="1" style="width:100%;box-sizing:border-box;" oninput="recalcCustomerPOTotal()">
        <input type="number" placeholder="0.00" class="cpo-part-cost" value="${cost}" min="0" step="0.01" style="width:100%;box-sizing:border-box;" oninput="recalcCustomerPOTotal()">
        <span class="cpo-line-total" style="font-size:13px;font-weight:600;color:var(--accent);">&#8377; ${parseFloat(lineTotal).toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
        <button type="button" class="btn-icon danger" onclick="this.closest('.cpo-line-row').remove();recalcCustomerPOTotal();" style="padding:3px;font-size:16px;line-height:1;">&#x2715;</button>
    `;
    container.appendChild(div);
    recalcCustomerPOTotal();
}

function recalcCustomerPOTotal() {
    let subtotal = 0;
    document.querySelectorAll('.cpo-line-row').forEach((row, i) => {
        const numEl = row.querySelector('.cpo-row-num');
        if (numEl) numEl.textContent = i + 1;
        const qty  = parseFloat(row.querySelector('.cpo-part-qty')?.value)  || 0;
        const cost = parseFloat(row.querySelector('.cpo-part-cost')?.value) || 0;
        const lineTotal = qty * cost;
        subtotal += lineTotal;
        const span = row.querySelector('.cpo-line-total');
        if (span) span.textContent = '\u20b9 ' + lineTotal.toLocaleString('en-IN', {minimumFractionDigits:2});
    });
    const igst  = subtotal * 0.18;
    const total = subtotal + igst;
    const fmt = v => '\u20b9 ' + v.toLocaleString('en-IN', {minimumFractionDigits:2});
    document.getElementById('cpoAmount').value = total.toFixed(2);
    const sub  = document.getElementById('cpoSubtotalDisplay'); if (sub)  sub.textContent  = fmt(subtotal);
    const igstEl = document.getElementById('cpoIgstDisplay');   if (igstEl) igstEl.textContent = fmt(igst);
    const disp = document.getElementById('cpoTotalDisplay');    if (disp) disp.textContent   = fmt(total);
    const cnt  = document.getElementById('cpoLineCount');
    const rows = document.querySelectorAll('.cpo-line-row').length;
    if (cnt) cnt.textContent = rows ? `(${rows} item${rows>1?'s':''})` : '';
}

async function loadPOExamples() {
    try {
        const res = await fetch(API + '/customer-pos/examples', { headers: HEADERS });
        const data = await res.json();
        const select = document.getElementById('cpoExamplePDF');
        select.innerHTML = '<option value="">-- Select a PO PDF --</option>';
        if (data.success && data.data && data.data.length) {
            data.data.forEach(f => {
                // Strip .pdf extension for display, keep full name as value
                const label = f.replace(/\.pdf$/i, '');
                select.innerHTML += `<option value="${esc(f)}">${esc(label)}</option>`;
            });
        } else {
            select.innerHTML += '<option disabled>No example POs found in /POs folder</option>';
        }
    } catch (e) {
        console.error('Failed to load PO examples', e);
    }
}

function _setParseFeedback(msg, type) {
    const el = document.getElementById('cpoParseFeedback');
    if (!el) return;
    el.style.display = 'block';
    el.textContent = msg;
    if (type === 'loading') {
        el.style.background = 'var(--bg-secondary)';
        el.style.color = 'var(--text-muted)';
        el.style.border = '1px solid var(--border-color)';
    } else if (type === 'success') {
        el.style.background = '#e8f5e9';
        el.style.color = '#2e7d32';
        el.style.border = '1px solid #a5d6a7';
    } else if (type === 'warning') {
        el.style.background = '#fff8e1';
        el.style.color = '#f57f17';
        el.style.border = '1px solid #ffe082';
    } else {
        el.style.background = '#ffebee';
        el.style.color = '#c62828';
        el.style.border = '1px solid #ef9a9a';
    }
}

async function parseUploadedPO(input) {
    const file = input.files[0];
    if (!file) return;
    const nameEl = document.getElementById('cpoUploadName');
    if (nameEl) nameEl.textContent = file.name;
    _setParseFeedback('\u23f3 Parsing PDF \u2014 ' + file.name + '...', 'loading');
    const formData = new FormData();
    formData.append('file', file);
    try {
        const res = await fetch(API + '/customer-pos/parse-pdf', {
            method: 'POST',
            headers: { 'X-Tenant-ID': HEADERS['X-Tenant-ID'] || 'TEST', 'X-User-Email': HEADERS['X-User-Email'] || '' },
            body: formData
        });
        const data = await res.json();
        if (data.success && data.data) {
            const poNum2 = data.data.po_number || '';
            const existing2 = (window._cpoAllPOs || []).filter(p => p.po_number === poNum2);
            populatePOFields(data.data);
            const lc = document.querySelectorAll('.cpo-line-row').length;
            if (existing2.length) {
                const latest2 = Math.max(...existing2.map(p => p.version || 1));
                _setParseFeedback('⚠️ ' + poNum2 + ' already exists (latest: v' + latest2 + '). Saving will create v' + (latest2+1) + '.', 'warning');
            } else {
                _setParseFeedback(`\u2713 Parsed successfully \u2014 ${lc} line item${lc!==1?'s':''} extracted from ${file.name}`, 'success');
            }
        } else {
            _setParseFeedback('\u2717 Parse failed: ' + (data.message || 'Could not extract data from PDF'), 'error');
        }
    } catch (e) {
        _setParseFeedback('\u2717 Connection error while parsing PDF', 'error');
    }
    input.value = '';
}

async function parseExamplePO(filename) {
    if (!filename) { _setParseFeedback('Please select a PDF from the library first.', 'error'); return; }
    _setParseFeedback('⏳ Parsing — ' + filename + '...', 'loading');
    try {
        const res = await fetch(API + '/customer-pos/parse-pdf', { method: 'POST', headers: HEADERS, body: JSON.stringify({ filename }) });
        const data = await res.json();
        if (data.success && data.data) {
            const poNum = data.data.po_number || '';
            const existing = (window._cpoAllPOs || []).filter(p => p.po_number === poNum);
            populatePOFields(data.data);
            const lc = document.querySelectorAll('.cpo-line-row').length;
            if (existing.length) {
                const latest = Math.max(...existing.map(p => p.version || 1));
                _setParseFeedback('⚠️ ' + poNum + ' already exists (latest: v' + latest + '). Saving will create v' + (latest+1) + '.', 'warning');
            } else {
                _setParseFeedback('✓ Parsed — ' + lc + ' item' + (lc!==1?'s':'') + ' from ' + filename.replace(/\.pdf$/i,''), 'success');
            }
        } else {
            _setParseFeedback('✗ Parse failed: ' + (data.message || 'Could not extract data'), 'error');
        }
    } catch (e) {
        _setParseFeedback('✗ Connection error while parsing PDF', 'error');
    }
}
function populatePOFields(po) {
    if (po.original_pdf) window._cpoParsedOriginalPdf = po.original_pdf;
    else window._cpoParsedOriginalPdf = null;
    if (po.po_number) document.getElementById('cpoPONumber').value = po.po_number;
    if (po.po_date) {
        try {
            const d = new Date(po.po_date);
            if (!isNaN(d.getTime())) document.getElementById('cpoPODate').value = d.toISOString().split('T')[0];
        } catch(e) {}
    }
    if (po.customer_name) document.getElementById('cpoCustomerName').value = po.customer_name;
    document.getElementById('cpoLinesContainer').innerHTML = '';
    const lines = po.lines && po.lines.length ? po.lines : [{ part_number: '', qty: 1, cost: 0 }];
    lines.forEach(l => addCustomerPOLineRow(l.part_number || '', l.qty || 1, l.cost || 0));
    recalcCustomerPOTotal();
}

function openAddCustomerPOModal() {
    ['cpoPONumber','cpoPODate','cpoCustomerName','cpoDeliveryDate','cpoRemarks'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('cpoAmount').value = '0';
    document.getElementById('cpoCurrency').value = 'INR';
    document.getElementById('cpoStatus').value = 'received';
    document.getElementById('cpoExamplePDF').value = '';
    const fb = document.getElementById('cpoParseFeedback');
    if (fb) { fb.style.display = 'none'; fb.textContent = ''; }
    const nameEl = document.getElementById('cpoUploadName');
    if (nameEl) nameEl.textContent = '';
    const xlsNameEl = document.getElementById('cpoExcelUploadName');
    if (xlsNameEl) xlsNameEl.textContent = '';
    window._cpoParsedOriginalPdf = null;
    document.getElementById('cpoLinesContainer').innerHTML = '';
    addCustomerPOLineRow('', 1, 0);
    loadPOExamples();
    openModal('addCustomerPOModal');
}

async function saveCustomerPO(e) {
    e.preventDefault();
    const lines = [];
    document.querySelectorAll('.cpo-line-row').forEach(row => {
        const part_number = row.querySelector('.cpo-part-number').value.trim();
        const qty = parseInt(row.querySelector('.cpo-part-qty').value) || 1;
        const cost = parseFloat(row.querySelector('.cpo-part-cost').value) || 0;
        if (part_number) lines.push({ part_number, qty, cost });
    });
    const body = {
        po_number:     document.getElementById('cpoPONumber').value.trim(),
        po_date:       document.getElementById('cpoPODate').value || null,
        customer_name: document.getElementById('cpoCustomerName').value.trim(),
        amount:        parseFloat(document.getElementById('cpoAmount').value) || 0,
        currency:      document.getElementById('cpoCurrency').value,
        delivery_date: document.getElementById('cpoDeliveryDate').value || null,
        status:        document.getElementById('cpoStatus').value,
        remarks:       document.getElementById('cpoRemarks').value.trim(),
        lines,
        original_pdf:  window._cpoParsedOriginalPdf || null
    };
    const res = await fetch(API + '/projects/' + currentProjectId + '/customer-pos', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) {
        closeModal('addCustomerPOModal');
        loadCustomerPOs(currentProjectId);
    } else if (data.already_exists) {
        _setParseFeedback('✗ ' + data.message, 'error');
    } else {
        alert(data.message);
    }
}async function loadCustomerPOs(pid) {
    const grid = document.getElementById('customerPosGrid');
    grid.innerHTML = '<div class="cpo-loading">Loading…</div>';
    const res = await fetch(API + '/projects/' + pid + '/customer-pos', { headers: HEADERS });
    const data = await res.json();
    if (!data.success || !data.data.length) {
        grid.innerHTML = '<div class="cpo-empty-state"><span class="cpo-empty-icon">📄</span><div>No Customer POs yet</div><div style="font-size:12px;margin-top:4px;">Click “Add Customer PO” to import or create one</div></div>';
        const sb = document.getElementById('cpoSummaryBar'); if (sb) sb.textContent = '';
        return;
    }
    window._cpoAllPOs = data.data;
    _renderCPOGrid(pid, data.data);
}

function _renderCPOGrid(pid, pos) {
    const grid = document.getElementById('customerPosGrid');
    const totalVal = pos.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const cur = '₹';
    const sb = document.getElementById('cpoSummaryBar');
    if (sb) sb.innerHTML = pos.length + ' PO' + (pos.length !== 1 ? 's' : '') + ' &nbsp;&bull;&nbsp; Total: <strong>' + cur + ' ' + totalVal.toLocaleString('en-IN', {minimumFractionDigits:2}) + '</strong>';
    const statusMeta = {
        received:     { label: 'Received',     cls: 'cpo-s-received' },
        acknowledged: { label: 'Acknowledged', cls: 'cpo-s-acknowledged' },
        in_progress:  { label: 'In Progress',  cls: 'cpo-s-in_progress' },
        completed:    { label: 'Completed',    cls: 'cpo-s-completed' },
        cancelled:    { label: 'Cancelled',    cls: 'cpo-s-cancelled' },
    };
    const fmt = v => '₹ ' + v.toLocaleString('en-IN', {minimumFractionDigits:2});
    grid.innerHTML = pos.map(po => {
        const sm = statusMeta[po.status] || { label: po.status, cls: '' };
        const lines = po.lines || [];
        const subtotal = lines.reduce((s, l) => s + (l.qty * l.cost), 0);
        const igst = subtotal * 0.18;
        const orderTotal = subtotal + igst;
        const ver = po.version || 1;
        const linesHtml = lines.length ? lines.map((l, i) =>
            '<div class="cpo-line-item' + (i % 2 === 1 ? ' cpo-line-alt' : '') + '">' +
            '<span class="cpo-line-num">' + (i+1) + '</span>' +
            '<span class="cpo-line-pn">' + esc(l.part_number) + '</span>' +
            '<span class="cpo-line-qty"><strong>' + l.qty + '</strong></span>' +
            '<span class="cpo-line-price">' + fmt(parseFloat(l.cost)) + '</span>' +
            '<span class="cpo-line-total-val">' + fmt(l.qty * l.cost) + '</span>' +
            '</div>').join('') : '<div class="cpo-no-lines">No line items</div>';
        const summaryHtml =
            '<div class="cpo-summary">' +
            '<div class="cpo-summary-row"><span>Total Base Amount (Subtotal)</span><span>' + fmt(subtotal) + '</span></div>' +
            '<div class="cpo-summary-row"><span>IGST @18%</span><span>' + fmt(igst) + '</span></div>' +
            '<div class="cpo-summary-row cpo-summary-total"><span>Total Order Value</span><span>' + fmt(orderTotal) + '</span></div>' +
            '</div>';
        return '<div class="cpo-card" id="cpo-card-' + po.id + '">' +
            '<div class="cpo-card-top" onclick="_toggleCPOCard(\'' + po.id + '\')" style="cursor:pointer;">' +
                '<div class="cpo-card-left">' +
                    '<div class="cpo-card-po-num">' + esc(po.po_number) +
                    '  <span class="cpo-ver-badge">v' + ver + '</span></div>' +
                    '<div class="cpo-card-customer">' + (esc(po.customer_name) || '&mdash;') +
                    '  &bull;  ' + lines.length + ' item' + (lines.length !== 1 ? 's' : '') +
                    '  &bull;  ' + fmt(orderTotal) + '</div>' +
                '</div>' +
                '<div class="cpo-card-right">' +
                    '<span class="cpo-status-badge ' + sm.cls + '">' + sm.label + '</span>' +
                    '<button class="cpo-icon-btn" onclick="event.stopPropagation();downloadCPOPdf(\'' + po.id + '\')" title="Download PDF">&#8659;</button>' +
                    '<button class="cpo-delete-btn" onclick="event.stopPropagation();deleteCustomerPO(\'' + pid + '\',\'' + po.id + '\')" title="Delete">✕</button>' +
                '</div>' +
            '</div>' +
            '<div class="cpo-card-body" id="cpo-body-' + po.id + '" style="display:none;">' +
                '<div class="cpo-card-meta">' +
                    '<div class="cpo-meta-item"><span class="cpo-meta-label">PO Date</span><span>' + (po.po_date || '&mdash;') + '</span></div>' +
                    '<div class="cpo-meta-item"><span class="cpo-meta-label">Delivery</span><span>' + (po.delivery_date || '&mdash;') + '</span></div>' +
                    '<div class="cpo-meta-item"><span class="cpo-meta-label">Currency</span><span>' + esc(po.currency) + '</span></div>' +
                    '<div class="cpo-meta-item cpo-meta-amount"><span class="cpo-meta-label">Version</span><span class="cpo-amount-val">v' + ver + '</span></div>' +
                '</div>' +
                (po.remarks ? '<div class="cpo-remarks">' + esc(po.remarks) + '</div>' : '') +
                '<div class="cpo-lines-section">' +
                    '<div class="cpo-lines-header"><span>Line Items</span><span class="cpo-lines-count">' + lines.length + ' item' + (lines.length !== 1 ? 's' : '') + '</span></div>' +
                    '<div class="cpo-lines-col-header"><span>#</span><span>Part / Description</span><span>Qty</span><span>Unit Price</span><span>Line Total</span></div>' +
                    '<div class="cpo-lines-body">' + linesHtml + '</div>' +
                    summaryHtml +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');
}

function _toggleCPOCard(id) {
    const body = document.getElementById('cpo-body-' + id);
    if (!body) return;
    body.style.display = body.style.display === 'none' ? '' : 'none';
}

function filterCPOs(val) {
    if (!window._cpoAllPOs) return;
    const q = val.trim().toLowerCase();
    const filtered = q ? window._cpoAllPOs.filter(p =>
        (p.po_number||"").toLowerCase().includes(q) ||
        (p.customer_name||"").toLowerCase().includes(q) ||
        (p.lines||[]).some(l => (l.part_number||"").toLowerCase().includes(q))
    ) : window._cpoAllPOs;
    _renderCPOGrid(currentProjectId, filtered);
}

function downloadCPOPdf(poId) {
    // Remove any existing dropdown
    const existing = document.getElementById('cpo-dl-menu');
    if (existing) { existing.remove(); return; }
    if (!window._cpoAllPOs) return;
    const po = window._cpoAllPOs.find(p => p.id === poId);
    if (!po) return;
    const btn = document.querySelector(`#cpo-card-${poId} .cpo-icon-btn`);
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.id = 'cpo-dl-menu';
    menu.style.cssText = 'position:fixed;z-index:9999;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.15);min-width:220px;overflow:hidden;';
    menu.style.top  = (rect.bottom + 6) + 'px';
    menu.style.left = (rect.left - 160) + 'px';
    const items = [
        { label: '&#8659; Download Generated PDF', action: () => { window.location.href = `/api/v1/projects/projects/${currentProjectId}/customer-pos/${poId}/pdf?type=generated`; } },
    ];
    if (po.original_pdf) {
        items.push({ label: '&#8659; Download Original PDF', action: () => { window.location.href = `/api/v1/projects/projects/${currentProjectId}/customer-pos/${poId}/pdf?type=original`; } });
    }
    items.forEach(item => {
        const div = document.createElement('div');
        div.innerHTML = item.label;
        div.style.cssText = 'padding:10px 16px;font-size:13px;cursor:pointer;color:var(--text);transition:background .1s;';
        div.onmouseenter = () => div.style.background = 'rgba(26,115,232,0.07)';
        div.onmouseleave = () => div.style.background = '';
        div.onclick = () => { menu.remove(); item.action(); };
        menu.appendChild(div);
    });
    document.body.appendChild(menu);
    const close = (e) => { if (!menu.contains(e.target) && e.target !== btn) { menu.remove(); document.removeEventListener('click', close); } };
    setTimeout(() => document.addEventListener('click', close), 0);
}
async function saveCustomerPO(e) {
    e.preventDefault();
    const lines = [];
    document.querySelectorAll('.cpo-line-row').forEach(row => {
        const part_number = row.querySelector('.cpo-part-number').value.trim();
        const qty = parseInt(row.querySelector('.cpo-part-qty').value) || 1;
        const cost = parseFloat(row.querySelector('.cpo-part-cost').value) || 0;
        if (part_number) lines.push({ part_number, qty, cost });
    });
    const body = {
        po_number:     document.getElementById('cpoPONumber').value.trim(),
        po_date:       document.getElementById('cpoPODate').value || null,
        customer_name: document.getElementById('cpoCustomerName').value.trim(),
        amount:        parseFloat(document.getElementById('cpoAmount').value) || 0,
        currency:      document.getElementById('cpoCurrency').value,
        delivery_date: document.getElementById('cpoDeliveryDate').value || null,
        status:        document.getElementById('cpoStatus').value,
        remarks:       document.getElementById('cpoRemarks').value.trim(),
        lines,
        original_pdf:  window._cpoParsedOriginalPdf || null
    };
    const res = await fetch(API + '/projects/' + currentProjectId + '/customer-pos', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) {
        closeModal('addCustomerPOModal');
        loadCustomerPOs(currentProjectId);
    } else if (data.already_exists) {
        _setParseFeedback('✗ ' + data.message, 'error');
    } else {
        alert(data.message);
    }
}async function loadCustomerPOs(pid) {
    const grid = document.getElementById('customerPosGrid');
    grid.innerHTML = '<div class="cpo-loading">Loading…</div>';
    const res = await fetch(API + '/projects/' + pid + '/customer-pos', { headers: HEADERS });
    const data = await res.json();
    if (!data.success || !data.data.length) {
        grid.innerHTML = '<div class="cpo-empty-state"><span class="cpo-empty-icon">📄</span><div>No Customer POs yet</div><div style="font-size:12px;margin-top:4px;">Click “Add Customer PO” to import or create one</div></div>';
        const sb = document.getElementById('cpoSummaryBar'); if (sb) sb.textContent = '';
        return;
    }
    window._cpoAllPOs = data.data;
    _renderCPOGrid(pid, data.data);
}

function _renderCPOGrid(pid, pos) {
    const grid = document.getElementById('customerPosGrid');
    const totalVal = pos.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const cur = '₹';
    const sb = document.getElementById('cpoSummaryBar');
    if (sb) sb.innerHTML = pos.length + ' PO' + (pos.length !== 1 ? 's' : '') + ' &nbsp;&bull;&nbsp; Total: <strong>' + cur + ' ' + totalVal.toLocaleString('en-IN', {minimumFractionDigits:2}) + '</strong>';
    const statusMeta = {
        received:     { label: 'Received',     cls: 'cpo-s-received' },
        acknowledged: { label: 'Acknowledged', cls: 'cpo-s-acknowledged' },
        in_progress:  { label: 'In Progress',  cls: 'cpo-s-in_progress' },
        completed:    { label: 'Completed',    cls: 'cpo-s-completed' },
        cancelled:    { label: 'Cancelled',    cls: 'cpo-s-cancelled' },
    };
    const fmt = v => '₹ ' + v.toLocaleString('en-IN', {minimumFractionDigits:2});
    grid.innerHTML = pos.map(po => {
        const sm = statusMeta[po.status] || { label: po.status, cls: '' };
        const lines = po.lines || [];
        const subtotal = lines.reduce((s, l) => s + (l.qty * l.cost), 0);
        const igst = subtotal * 0.18;
        const orderTotal = subtotal + igst;
        const ver = po.version || 1;
        const linesHtml = lines.length ? lines.map((l, i) =>
            '<div class="cpo-line-item' + (i % 2 === 1 ? ' cpo-line-alt' : '') + '">' +
            '<span class="cpo-line-num">' + (i+1) + '</span>' +
            '<span class="cpo-line-pn">' + esc(l.part_number) + '</span>' +
            '<span class="cpo-line-qty"><strong>' + l.qty + '</strong></span>' +
            '<span class="cpo-line-price">' + fmt(parseFloat(l.cost)) + '</span>' +
            '<span class="cpo-line-total-val">' + fmt(l.qty * l.cost) + '</span>' +
            '</div>').join('') : '<div class="cpo-no-lines">No line items</div>';
        const summaryHtml =
            '<div class="cpo-summary">' +
            '<div class="cpo-summary-row"><span>Total Base Amount (Subtotal)</span><span>' + fmt(subtotal) + '</span></div>' +
            '<div class="cpo-summary-row"><span>IGST @18%</span><span>' + fmt(igst) + '</span></div>' +
            '<div class="cpo-summary-row cpo-summary-total"><span>Total Order Value</span><span>' + fmt(orderTotal) + '</span></div>' +
            '</div>';
        return '<div class="cpo-card" id="cpo-card-' + po.id + '">' +
            '<div class="cpo-card-top" onclick="_toggleCPOCard(\'' + po.id + '\')" style="cursor:pointer;">' +
                '<div class="cpo-card-left">' +
                    '<div class="cpo-card-po-num">' + esc(po.po_number) +
                    '  <span class="cpo-ver-badge">v' + ver + '</span></div>' +
                    '<div class="cpo-card-customer">' + (esc(po.customer_name) || '&mdash;') +
                    '  &bull;  ' + lines.length + ' item' + (lines.length !== 1 ? 's' : '') +
                    '  &bull;  ' + fmt(orderTotal) + '</div>' +
                '</div>' +
                '<div class="cpo-card-right">' +
                    '<span class="cpo-status-badge ' + sm.cls + '">' + sm.label + '</span>' +
                    '<button class="cpo-icon-btn" onclick="event.stopPropagation();downloadCPOPdf(\'' + po.id + '\')" title="Download PDF">&#8659;</button>' +
                    '<button class="cpo-delete-btn" onclick="event.stopPropagation();deleteCustomerPO(\'' + pid + '\',\'' + po.id + '\')" title="Delete">✕</button>' +
                '</div>' +
            '</div>' +
            '<div class="cpo-card-body" id="cpo-body-' + po.id + '" style="display:none;">' +
                '<div class="cpo-card-meta">' +
                    '<div class="cpo-meta-item"><span class="cpo-meta-label">PO Date</span><span>' + (po.po_date || '&mdash;') + '</span></div>' +
                    '<div class="cpo-meta-item"><span class="cpo-meta-label">Delivery</span><span>' + (po.delivery_date || '&mdash;') + '</span></div>' +
                    '<div class="cpo-meta-item"><span class="cpo-meta-label">Currency</span><span>' + esc(po.currency) + '</span></div>' +
                    '<div class="cpo-meta-item cpo-meta-amount"><span class="cpo-meta-label">Version</span><span class="cpo-amount-val">v' + ver + '</span></div>' +
                '</div>' +
                (po.remarks ? '<div class="cpo-remarks">' + esc(po.remarks) + '</div>' : '') +
                '<div class="cpo-lines-section">' +
                    '<div class="cpo-lines-header"><span>Line Items</span><span class="cpo-lines-count">' + lines.length + ' item' + (lines.length !== 1 ? 's' : '') + '</span></div>' +
                    '<div class="cpo-lines-col-header"><span>#</span><span>Part / Description</span><span>Qty</span><span>Unit Price</span><span>Line Total</span></div>' +
                    '<div class="cpo-lines-body">' + linesHtml + '</div>' +
                    summaryHtml +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');
}

function _toggleCPOCard(id) {
    const body = document.getElementById('cpo-body-' + id);
    if (!body) return;
    body.style.display = body.style.display === 'none' ? '' : 'none';
}

function filterCPOs(val) {
    if (!window._cpoAllPOs) return;
    const q = val.trim().toLowerCase();
    const filtered = q ? window._cpoAllPOs.filter(p =>
        (p.po_number||"").toLowerCase().includes(q) ||
        (p.customer_name||"").toLowerCase().includes(q) ||
        (p.lines||[]).some(l => (l.part_number||"").toLowerCase().includes(q))
    ) : window._cpoAllPOs;
    _renderCPOGrid(currentProjectId, filtered);
}

function downloadCPOPdf(poId) {
    if (!window._cpoAllPOs) return;
    const po = window._cpoAllPOs.find(p => p.id === poId);
    if (!po) return;
    const lines = po.lines || [];
    const subtotal = lines.reduce((s, l) => s + (l.qty * l.cost), 0);
    const igst = subtotal * 0.18;
    const total = subtotal + igst;
    const fmt = v => '₹ ' + v.toLocaleString('en-IN', {minimumFractionDigits:2});
    const rows = lines.map((l, i) =>
        `<tr><td>${i+1}</td><td>${esc(l.part_number)}</td><td style="text-align:right">${l.qty}</td><td style="text-align:right">${fmt(l.cost)}</td><td style="text-align:right">${fmt(l.qty*l.cost)}</td></tr>`
    ).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${po.po_number}</title>
<style>body{font-family:Arial,sans-serif;padding:32px;color:#1f2937}h1{font-size:20px;margin-bottom:4px}h2{font-size:13px;color:#6b7280;font-weight:400;margin:0 0 24px}
.meta{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:24px;padding:14px;background:#f8f9fa;border-radius:6px}
.ml{font-size:10px;text-transform:uppercase;color:#6b7280;font-weight:600;margin-bottom:2px}.mv{font-size:13px;font-weight:500}
table{width:100%;border-collapse:collapse;font-size:13px}th{background:#f3f4f6;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb}
td{padding:8px 10px;border-bottom:1px solid #e5e7eb}.summary{margin-top:16px;display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.sr{display:flex;gap:40px;font-size:13px;color:#6b7280}.sr span:last-child{font-weight:600;color:#1f2937;min-width:120px;text-align:right}
.st{font-size:15px;font-weight:800;color:#1a73e8}.ver{display:inline-block;background:#e3f2fd;color:#1565c0;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;margin-left:8px}
</style></head><body>
<h1>${po.po_number} <span class="ver">v${po.version||1}</span></h1>
<h2>${po.customer_name || ""} &nbsp;&bull;&nbsp; ${po.po_date || ""}</h2>
<div class="meta"><div><div class="ml">Status</div><div class="mv">${po.status||""}</div></div><div><div class="ml">Currency</div><div class="mv">${po.currency||"INR"}</div></div><div><div class="ml">Delivery</div><div class="mv">${po.delivery_date||"&mdash;"}</div></div><div><div class="ml">Remarks</div><div class="mv">${po.remarks||"&mdash;"}</div></div></div>
<table><thead><tr><th>#</th><th>Part / Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Line Total</th></tr></thead><tbody>${rows}</tbody></table>
<div class="summary"><div class="sr"><span>Total Base Amount (Subtotal)</span><span>${fmt(subtotal)}</span></div><div class="sr"><span>IGST @18%</span><span>${fmt(igst)}</span></div><div class="sr st"><span>Total Order Value</span><span>${fmt(total)}</span></div></div>
</body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
}
function addCustomerPOLineRow(partNumber = '', qty = 1, cost = 0) {
    const container = document.getElementById('cpoLinesContainer');
    const lineTotal = (parseFloat(qty) * parseFloat(cost)).toFixed(2);
    const rowNum = container.querySelectorAll('.cpo-line-row').length + 1;
    const div = document.createElement('div');
    div.className = 'cpo-line-row';
    div.style = 'display:grid;grid-template-columns:28px 2fr 0.8fr 1.1fr 1.1fr 32px;gap:6px;padding:6px 8px;border-bottom:1px solid var(--border-color);align-items:center;';
    div.innerHTML = `
        <span class="cpo-row-num" style="font-size:11px;font-weight:600;color:var(--text-secondary);">${rowNum}</span>
        <input type="text" placeholder="Part number or description" class="cpo-part-number" value="${esc(partNumber)}" style="width:100%;box-sizing:border-box;">
        <input type="number" placeholder="Qty" class="cpo-part-qty" value="${qty}" min="1" style="width:100%;box-sizing:border-box;" oninput="recalcCustomerPOTotal()">
        <input type="number" placeholder="0.00" class="cpo-part-cost" value="${cost}" min="0" step="0.01" style="width:100%;box-sizing:border-box;" oninput="recalcCustomerPOTotal()">
        <span class="cpo-line-total" style="font-size:13px;font-weight:600;color:var(--accent);">&#8377; ${parseFloat(lineTotal).toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
        <button type="button" class="btn-icon danger" onclick="this.closest('.cpo-line-row').remove();recalcCustomerPOTotal();" style="padding:3px;font-size:16px;line-height:1;">&#x2715;</button>
    `;
    container.appendChild(div);
    recalcCustomerPOTotal();
}

function recalcCustomerPOTotal() {
    let subtotal = 0;
    document.querySelectorAll('.cpo-line-row').forEach((row, i) => {
        const numEl = row.querySelector('.cpo-row-num');
        if (numEl) numEl.textContent = i + 1;
        const qty  = parseFloat(row.querySelector('.cpo-part-qty')?.value)  || 0;
        const cost = parseFloat(row.querySelector('.cpo-part-cost')?.value) || 0;
        const lineTotal = qty * cost;
        subtotal += lineTotal;
        const span = row.querySelector('.cpo-line-total');
        if (span) span.textContent = '\u20b9 ' + lineTotal.toLocaleString('en-IN', {minimumFractionDigits:2});
    });
    const igst  = subtotal * 0.18;
    const total = subtotal + igst;
    const fmt = v => '\u20b9 ' + v.toLocaleString('en-IN', {minimumFractionDigits:2});
    document.getElementById('cpoAmount').value = total.toFixed(2);
    const sub  = document.getElementById('cpoSubtotalDisplay'); if (sub)  sub.textContent  = fmt(subtotal);
    const igstEl = document.getElementById('cpoIgstDisplay');   if (igstEl) igstEl.textContent = fmt(igst);
    const disp = document.getElementById('cpoTotalDisplay');    if (disp) disp.textContent   = fmt(total);
    const cnt  = document.getElementById('cpoLineCount');
    const rows = document.querySelectorAll('.cpo-line-row').length;
    if (cnt) cnt.textContent = rows ? `(${rows} item${rows>1?'s':''})` : '';
}

async function loadPOExamples() {
    try {
        const res = await fetch(API + '/customer-pos/examples', { headers: HEADERS });
        const data = await res.json();
        const select = document.getElementById('cpoExamplePDF');
        select.innerHTML = '<option value="">-- Select a PO PDF --</option>';
        if (data.success && data.data && data.data.length) {
            data.data.forEach(f => {
                // Strip .pdf extension for display, keep full name as value
                const label = f.replace(/\.pdf$/i, '');
                select.innerHTML += `<option value="${esc(f)}">${esc(label)}</option>`;
            });
        } else {
            select.innerHTML += '<option disabled>No example POs found in /POs folder</option>';
        }
    } catch (e) {
        console.error('Failed to load PO examples', e);
    }
}

function _setParseFeedback(msg, type) {
    const el = document.getElementById('cpoParseFeedback');
    if (!el) return;
    el.style.display = 'block';
    el.textContent = msg;
    if (type === 'loading') {
        el.style.background = 'var(--bg-secondary)';
        el.style.color = 'var(--text-muted)';
        el.style.border = '1px solid var(--border-color)';
    } else if (type === 'success') {
        el.style.background = '#e8f5e9';
        el.style.color = '#2e7d32';
        el.style.border = '1px solid #a5d6a7';
    } else {
        el.style.background = '#ffebee';
        el.style.color = '#c62828';
        el.style.border = '1px solid #ef9a9a';
    }
}

async function parseUploadedPO(input) {
    const file = input.files[0];
    if (!file) return;
    const nameEl = document.getElementById('cpoUploadName');
    if (nameEl) nameEl.textContent = file.name;
    _setParseFeedback('\u23f3 Parsing PDF \u2014 ' + file.name + '...', 'loading');
    const formData = new FormData();
    formData.append('file', file);
    try {
        const res = await fetch(API + '/customer-pos/parse-pdf', {
            method: 'POST',
            headers: { 'X-Tenant-ID': HEADERS['X-Tenant-ID'] || 'TEST', 'X-User-Email': HEADERS['X-User-Email'] || '' },
            body: formData
        });
        const data = await res.json();
        if (data.success && data.data) {
            populatePOFields(data.data);
            const lc = document.querySelectorAll('.cpo-line-row').length;
            _setParseFeedback(`\u2713 Parsed successfully \u2014 ${lc} line item${lc!==1?'s':''} extracted from ${file.name}`, 'success');
        } else {
            _setParseFeedback('\u2717 Parse failed: ' + (data.message || 'Could not extract data from PDF'), 'error');
        }
    } catch (e) {
        _setParseFeedback('\u2717 Connection error while parsing PDF', 'error');
    }
    input.value = '';
}

async function parseExamplePO(filename) {
    if (!filename) { _setParseFeedback('Please select a PDF from the library first.', 'error'); return; }
    _setParseFeedback('\u23f3 Parsing \u2014 ' + filename + '...', 'loading');
    try {
        const res = await fetch(API + '/customer-pos/parse-pdf', {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({ filename })
        });
        const data = await res.json();
        if (data.success && data.data) {
            populatePOFields(data.data);
            const lc = document.querySelectorAll('.cpo-line-row').length;
            _setParseFeedback(`\u2713 Parsed successfully \u2014 ${lc} line item${lc!==1?'s':''} extracted from ${filename.replace(/\.pdf$/i,'')}`, 'success');
        } else {
            _setParseFeedback('\u2717 Parse failed: ' + (data.message || 'Could not extract data'), 'error');
        }
    } catch (e) {
        _setParseFeedback('\u2717 Connection error while parsing PDF', 'error');
    }
}

function populatePOFields(po) {
    if (po.po_number) document.getElementById('cpoPONumber').value = po.po_number;
    if (po.po_date) {
        try {
            const d = new Date(po.po_date);
            if (!isNaN(d.getTime())) document.getElementById('cpoPODate').value = d.toISOString().split('T')[0];
        } catch(e) {}
    }
    if (po.customer_name) document.getElementById('cpoCustomerName').value = po.customer_name;
    document.getElementById('cpoLinesContainer').innerHTML = '';
    const lines = po.lines && po.lines.length ? po.lines : [{ part_number: '', qty: 1, cost: 0 }];
    lines.forEach(l => addCustomerPOLineRow(l.part_number || '', l.qty || 1, l.cost || 0));
    recalcCustomerPOTotal();
}

function openAddCustomerPOModal() {
    ['cpoPONumber','cpoPODate','cpoCustomerName','cpoDeliveryDate','cpoRemarks'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('cpoAmount').value = '0';
    document.getElementById('cpoCurrency').value = 'INR';
    document.getElementById('cpoStatus').value = 'received';
    document.getElementById('cpoExamplePDF').value = '';
    const fb = document.getElementById('cpoParseFeedback');
    if (fb) { fb.style.display = 'none'; fb.textContent = ''; }
    const nameEl = document.getElementById('cpoUploadName');
    if (nameEl) nameEl.textContent = '';
    document.getElementById('cpoLinesContainer').innerHTML = '';
    addCustomerPOLineRow('', 1, 0);
    loadPOExamples();
    openModal('addCustomerPOModal');
}

async function saveCustomerPO(e) {
    e.preventDefault();
    const lines = [];
    document.querySelectorAll('.cpo-line-row').forEach(row => {
        const part_number = row.querySelector('.cpo-part-number').value.trim();
        const qty = parseInt(row.querySelector('.cpo-part-qty').value) || 1;
        const cost = parseFloat(row.querySelector('.cpo-part-cost').value) || 0;
        if (part_number) {
            lines.push({ part_number, qty, cost });
        }
    });

    const body = {
        po_number: document.getElementById('cpoPONumber').value.trim(),
        po_date: document.getElementById('cpoPODate').value || null,
        customer_name: document.getElementById('cpoCustomerName').value.trim(),
        amount: parseFloat(document.getElementById('cpoAmount').value) || 0,
        currency: document.getElementById('cpoCurrency').value,
        delivery_date: document.getElementById('cpoDeliveryDate').value || null,
        status: document.getElementById('cpoStatus').value,
        remarks: document.getElementById('cpoRemarks').value.trim(),
        lines: lines
    };
    const res = await fetch(API + '/projects/' + currentProjectId + '/customer-pos', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('addCustomerPOModal'); loadCustomerPOs(currentProjectId); }
    else alert(data.message);
}

async function deleteCustomerPO(pid, poId) {
    if (!confirm('Remove this Customer PO?')) return;
    const res = await fetch(API + '/projects/' + pid + '/customer-pos/' + poId, { method: 'DELETE', headers: HEADERS });
    const data = await res.json();
    if (data.success) loadCustomerPOs(pid);
    else alert(data.message);
}

// Removed loadProjectProductionOrders and goToCreateProductionOrder because they are no longer required on the Customer PO tab.

let cachedProjLogs = [];
async function showProjHistoryModal() {
    const tbody = document.getElementById('projHistoryModalBody');
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Loading history...</td></tr>';
    document.getElementById('projHistorySearch').value = '';
    openModal('projHistoryModal');
    
    if (!currentProjectId) return;
    
    try {
        const res = await fetch(API + '/audit-logs?page=1&limit=250', { headers: HEADERS });
        const data = await res.json();
        if (data.success && data.data.items) {
            // Find active project information to map logs to name or ID
            const pRes = await fetch(API + '/projects/' + currentProjectId, { headers: HEADERS });
            const pData = await pRes.json();
            const projName = pData.success && pData.data ? pData.data.project_name : '';
            const projNum = pData.success && pData.data ? pData.data.project_number : '';
            
            cachedProjLogs = data.data.items.filter(l => 
                (l.entity_type === 'Project' && (l.entity_id === currentProjectId || (projName && l.entity_id.toLowerCase().includes(projName.toLowerCase())) || (projNum && l.entity_id.toLowerCase().includes(projNum.toLowerCase())))) ||
                (l.entity_type === 'Task' && l.entity_id.toLowerCase().includes(currentProjectId.toLowerCase())) ||
                (l.entity_type === 'Customer PO' && l.entity_id.toLowerCase().includes(currentProjectId.toLowerCase()))
            );
            renderProjHistoryList(cachedProjLogs);
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="empty">No project logs recorded.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">Error loading history logs</td></tr>';
    }
}

function renderProjHistoryList(logs) {
    const tbody = document.getElementById('projHistoryModalBody');
    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">No matching history logs.</td></tr>';
        return;
    }
    tbody.innerHTML = logs.map(l => {
        const user = l.user_name || l.user_email || 'System';
        let changesStr = '—';
        if (l.old_values && l.new_values) {
            try {
                const oldObj = typeof l.old_values === 'string' ? JSON.parse(l.old_values) : l.old_values;
                const newObj = typeof l.new_values === 'string' ? JSON.parse(l.new_values) : l.new_values;
                const keys = Object.keys(newObj);
                if (keys.length > 0) {
                    changesStr = keys.map(k => {
                        let ov = oldObj[k];
                        let nv = newObj[k];
                        if (typeof ov === 'object') ov = JSON.stringify(ov);
                        if (typeof nv === 'object') nv = JSON.stringify(nv);
                        return `<div style="margin-bottom:3px"><strong>${esc(k)}</strong>: <span style="text-decoration:line-through;color:#e53935">${esc(ov || 'empty')}</span> ➔ <span style="color:#2e7d32;font-weight:600">${esc(nv || 'empty')}</span></div>`;
                    }).join('');
                }
            } catch (e) {
                changesStr = 'Error parsing changes';
            }
        } else if (l.action === 'CREATE') {
            changesStr = '<span style="color:#2e7d32;font-weight:600">Created New Record</span>';
        } else if (l.action === 'DELETE' || l.action === 'DELETE_SECURE') {
            changesStr = '<span style="color:#e53935;font-weight:600">Deleted Record</span>';
        }
        return `<tr>
            <td><span class="action-badge action-${l.action.toLowerCase()}">${esc(l.action)}</span></td>
            <td><div style="font-size:11px">${changesStr}</div></td>
            <td><div class="cell-main">${esc(user)}</div><div class="cell-sub">${esc(l.user_email || '')}</div></td>
            <td><code>${esc(l.ip_address || '-')}</code></td>
            <td>${formatTime(l.created_at)}</td>
        </tr>`;
    }).join('');
}

function filterProjHistory(val) {
    const q = val.trim().toLowerCase();
    if (!q) {
        renderProjHistoryList(cachedProjLogs);
        return;
    }
    const filtered = cachedProjLogs.filter(l => 
        (l.action || '').toLowerCase().includes(q) ||
        (l.user_name || '').toLowerCase().includes(q) ||
        (l.user_email || '').toLowerCase().includes(q)
    );
    renderProjHistoryList(filtered);
}

let activeProjectDetails = null;

async function editProjectFromDetail() {
    if (!currentProjectId) return;
    const res = await fetch(API + '/projects/' + currentProjectId, { headers: HEADERS });
    const data = await res.json();
    if (data.success && data.data) {
        activeProjectDetails = data.data;
        document.getElementById('epId').value = activeProjectDetails.id;
        document.getElementById('epName').value = activeProjectDetails.project_name;
        document.getElementById('epNumber').value = activeProjectDetails.project_number;
        document.getElementById('epType').value = activeProjectDetails.project_type || '';
        document.getElementById('epStatus').value = activeProjectDetails.status || 'open';
        document.getElementById('epStart').value = activeProjectDetails.start_date || '';
        document.getElementById('epDue').value = activeProjectDetails.due_date || '';
        document.getElementById('epClosing').value = activeProjectDetails.closing_date || '';
        document.getElementById('epTerritory').value = activeProjectDetails.territory || '';
        document.getElementById('epSales').value = activeProjectDetails.sales_employee || '';
        document.getElementById('epOwner').value = activeProjectDetails.owner || '';
        openModal('editProjModal');
    }
}

async function updateProject(e) {
    e.preventDefault();
    if (!currentProjectId) return;
    const body = {
        project_name: document.getElementById('epName').value.trim(),
        project_number: document.getElementById('epNumber').value.trim(),
        project_type: document.getElementById('epType').value.trim(),
        status: document.getElementById('epStatus').value,
        start_date: document.getElementById('epStart').value || null,
        due_date: document.getElementById('epDue').value || null,
        closing_date: document.getElementById('epClosing').value || null,
        territory: document.getElementById('epTerritory').value.trim(),
        sales_employee: document.getElementById('epSales').value.trim(),
        owner: document.getElementById('epOwner').value.trim()
    };
    const res = await fetch(API + '/projects/' + currentProjectId, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
        closeModal('editProjModal');
        openProject(currentProjectId);
    } else {
        alert(data.message);
    }
}

async function deleteProjectFromDetail() {
    if (!currentProjectId) return;
    const pwd = prompt("Please enter password to confirm deletion of this project:");
    if (pwd === null) return;
    if (!pwd) {
        alert("Password verification is required.");
        return;
    }
    const res = await fetch('/api/v1/auth/verify-password', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ password: pwd })
    });
    const data = await res.json();
    if (!data.success) {
        alert("Verification failed: " + data.message);
        return;
    }
    const delRes = await fetch(API + '/projects/' + currentProjectId, { method: 'DELETE', headers: HEADERS });
    const delData = await delRes.json();
    if (delData.success) {
        alert("Project deleted successfully.");
        showSection('projects');
    } else {
        alert(delData.message);
    }
}

// ─── EXCEL / CSV CUSTOMER PO TEMPLATE IMPORT & EXPORT ───
function downloadPOTemplateExcel() {
    const data = [
        {
            "PO Number": "PO-2026-EXMPLE",
            "PO Date": "2026-07-28",
            "Customer Name": "EXAMPLE MANUFACTURING CO.",
            "Delivery Date": "2026-08-15",
            "Currency": "INR",
            "Remarks": "Ship all items together",
            "Part Number": "B32922C3104KN1",
            "Description": "0.1 µF Film Capacitor 305V Polyester",
            "Quantity": 1000,
            "Unit Price": 2.75
        },
        {
            "PO Number": "PO-2026-EXMPLE",
            "PO Date": "2026-07-28",
            "Customer Name": "EXAMPLE MANUFACTURING CO.",
            "Delivery Date": "2026-08-15",
            "Currency": "INR",
            "Remarks": "Ship all items together",
            "Part Number": "B32922C3474M6N1",
            "Description": "0.47 µF Film Capacitor 305V Polyester",
            "Quantity": 500,
            "Unit Price": 5.50
        }
    ];
    
    try {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Customer PO Template");
        
        // Auto-fit columns
        const max_len = 25;
        worksheet["!cols"] = Object.keys(data[0]).map(() => ({ wch: max_len }));
        
        XLSX.writeFile(workbook, "customer_po_import_template.xlsx");
        _setParseFeedback("✓ Excel import template downloaded", "success");
    } catch (err) {
        // Fallback to CSV if SheetJS has not loaded yet
        console.error("SheetJS not loaded, falling back to CSV download", err);
        const headers = ["PO Number", "PO Date", "Customer Name", "Delivery Date", "Currency", "Remarks", "Part Number", "Description", "Quantity", "Unit Price"];
        const rows = [
            ["PO-2026-EXMPLE", "2026-07-28", "EXAMPLE MANUFACTURING CO.", "2026-08-15", "INR", "Ship all items together", "B32922C3104KN1", "0.1 uF Film Capacitor", 1000, 2.75],
            ["PO-2026-EXMPLE", "2026-07-28", "EXAMPLE MANUFACTURING CO.", "2026-08-15", "INR", "Ship all items together", "B32922C3474M6N1", "0.47 uF Film Capacitor", 500, 5.50]
        ];
        
        let csvContent = headers.join(",") + "\n" + rows.map(r => r.map(v => typeof v === 'string' ? `"${v}"` : v).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = "customer_po_import_template.csv";
        link.click();
        URL.revokeObjectURL(link.href);
        _setParseFeedback("✓ CSV template downloaded (fallback)", "success");
    }
}

async function importPOTemplateExcel(input) {
    const file = input.files[0];
    if (!file) return;
    
    const label = document.getElementById("cpoExcelUploadName");
    if (label) label.textContent = file.name;
    
    _setParseFeedback("⏳ Processing spreadsheet — " + file.name + "...", "loading");
    
    try {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet);
                
                if (!rows.length) {
                    _setParseFeedback("✗ spreadsheet is empty or missing headers", "error");
                    return;
                }
                
                // Map columns
                // Expected Headers: PO Number, PO Date, Customer Name, Delivery Date, Currency, Remarks, Part Number, Description, Quantity, Unit Price
                const firstRow = rows[0];
                const cleanKey = k => String(k).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                
                const keyMap = {};
                Object.keys(firstRow).forEach(k => {
                    const ck = cleanKey(k);
                    if (ck.includes('ponumber') || ck === 'po') keyMap.po_number = k;
                    else if (ck.includes('podate') || ck === 'date') keyMap.po_date = k;
                    else if (ck.includes('customer') || ck.includes('vendor')) keyMap.customer_name = k;
                    else if (ck.includes('delivery')) keyMap.delivery_date = k;
                    else if (ck.includes('currency')) keyMap.currency = k;
                    else if (ck.includes('remarks') || ck.includes('note')) keyMap.remarks = k;
                    else if (ck.includes('partnumber') || ck.includes('partno') || ck === 'part') keyMap.part_number = k;
                    else if (ck.includes('description') || ck === 'desc') keyMap.description = k;
                    else if (ck.includes('quantity') || ck === 'qty') keyMap.qty = k;
                    else if (ck.includes('price') || ck === 'cost' || ck.includes('unitprice')) keyMap.cost = k;
                });
                
                // Find primary PO headers from first row
                const po_number = rows[0][keyMap.po_number] || "PO-EXCEL-IMPORTED";
                let po_date = rows[0][keyMap.po_date] || "";
                if (po_date && typeof po_date === 'number') {
                    // Excel serial date representation conversion
                    try {
                        const parsedDate = new Date((po_date - 25569) * 86400 * 1000);
                        if (!isNaN(parsedDate.getTime())) {
                            po_date = parsedDate.toISOString().split('T')[0];
                        }
                    } catch(e){}
                }
                
                const customer_name = rows[0][keyMap.customer_name] || "";
                let delivery_date = rows[0][keyMap.delivery_date] || "";
                if (delivery_date && typeof delivery_date === 'number') {
                    try {
                        const parsedDate = new Date((delivery_date - 25569) * 86400 * 1000);
                        if (!isNaN(parsedDate.getTime())) {
                            delivery_date = parsedDate.toISOString().split('T')[0];
                        }
                    } catch(e){}
                }
                
                const currency = rows[0][keyMap.currency] || "INR";
                const remarks = rows[0][keyMap.remarks] || "";
                
                // Parse lines
                const lines = [];
                rows.forEach(r => {
                    const part_number = String(r[keyMap.part_number] || r[keyMap.description] || "").trim();
                    const qty = parseInt(r[keyMap.qty]) || 1;
                    const cost = parseFloat(r[keyMap.cost]) || 0;
                    
                    if (part_number) {
                        lines.push({ part_number, qty, cost });
                    }
                });
                
                if (!lines.length) {
                    _setParseFeedback("✗ No valid line items could be extracted", "error");
                    return;
                }
                
                // Fill modal form fields
                document.getElementById('cpoPONumber').value = po_number;
                if (po_date) {
                    try {
                        const d = new Date(po_date);
                        if (!isNaN(d.getTime())) {
                            document.getElementById('cpoPODate').value = d.toISOString().split('T')[0];
                        }
                    } catch (e) {}
                }
                document.getElementById('cpoCustomerName').value = customer_name;
                if (delivery_date) {
                    try {
                        const d = new Date(delivery_date);
                        if (!isNaN(d.getTime())) {
                            document.getElementById('cpoDeliveryDate').value = d.toISOString().split('T')[0];
                        }
                    } catch (e) {}
                }
                document.getElementById('cpoCurrency').value = currency;
                document.getElementById('cpoRemarks').value = remarks;
                
                // Re-render lines table
                const container = document.getElementById('cpoLinesContainer');
                container.innerHTML = '';
                lines.forEach(l => {
                    addCustomerPOLineRow(l.part_number, l.qty, l.cost);
                });
                
                recalcCustomerPOTotal();
                _setParseFeedback(`✓ Successfully imported ${lines.length} lines from ${file.name}`, "success");
            } catch (err) {
                _setParseFeedback("✗ Failed to process Excel: " + err.message, "error");
            }
        };
        reader.readAsArrayBuffer(file);
    } catch(err) {
        _setParseFeedback("✗ Failed to read file: " + err.message, "error");
    }
    input.value = '';
}
