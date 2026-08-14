// ─── CUSTOMER ORDERS: PROCUREMENT READINESS ───

// ── State ──
let _coData     = [];           // projects array from API
let _coFilter   = 'all';        // active filter tab
let _coSelected = new Map();    // key `projId|poId|lineIdx` → line object

// ── Status display config ──
const _statusCfg = {
    unmapped:  { label: 'Unmapped',  cls: 'co-s-unmapped', icon: 'link_off' },
    in_stock:  { label: 'In Stock',  cls: 'co-s-stock',    icon: 'inventory' },
    needs_pr:  { label: 'Needs PR',  cls: 'co-s-needspr',  icon: 'add_shopping_cart' },
    pr_raised: { label: 'PR Raised', cls: 'co-s-prraised', icon: 'pending_actions' },
    ready:     { label: 'Ready',     cls: 'co-s-ready',    icon: 'check_circle' },
    no_part:   { label: 'No Part #', cls: 'co-s-unmapped', icon: 'help_outline' },
};

// ── Part-type badge config ──
const _partTypeCfg = {
    bop:          { label: 'BOP',          cls: 'co-pt-bop',  icon: 'shopping_bag' },
    manufactured: { label: 'Manufactured', cls: 'co-pt-mfg',  icon: 'precision_manufacturing' },
    both:         { label: 'BOP + Mfg',    cls: 'co-pt-both', icon: 'sync_alt' },
    unknown:      { label: 'Unknown',      cls: 'co-pt-unk',  icon: 'help_outline' },
};

// ── Helpers ──
function _esc(s) {
    return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : '';
}
function _fmt(n) {
    return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function _lineIsSelectable(line) {
    return line.status !== 'unmapped' && line.status !== 'no_part' && !line.pr_generated;
}

// ── Load ──
async function loadCustomerOrders() {
    const container = document.getElementById('coProjectsContainer');
    container.innerHTML = '<div class="co-empty"><span class="material-icons-outlined" style="font-size:32px;opacity:.4">hourglass_empty</span><br>Loading...</div>';
    document.getElementById('coSummaryBar').style.display = 'none';
    try {
        const res = await fetch(API + '/customer-orders/procurement-view', { headers: H() });
        const d   = await res.json();
        if (!d.success) throw new Error(d.message);
        _coData = d.data || [];
        _renderCO();
    } catch (e) {
        container.innerHTML = `<div class="co-empty" style="color:#c62828">${e.message}</div>`;
    }
}

// ── Filter tabs ──
function filterCOLines(filter, btn) {
    _coFilter = filter;
    document.querySelectorAll('.co-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    _renderCO();
}

function _lineMatchesFilter(line) {
    if (_coFilter === 'all')      return true;
    if (_coFilter === 'unmapped') return line.status === 'unmapped' || line.status === 'no_part';
    return line.status === _coFilter;
}

// ─── SELECTION LOGIC ───

function _coSelKey(projId, poId, idx) { return `${projId}|${poId}|${idx}`; }

function _coToggleLine(projId, poId, idx, lineData, cb) {
    if (!_lineIsSelectable(lineData)) { cb.checked = false; return; }
    const k = _coSelKey(projId, poId, idx);
    if (cb.checked) _coSelected.set(k, lineData);
    else            _coSelected.delete(k);
    _coUpdateSelBar();
    _coSyncPOCheckbox(projId, poId);
}

function _coTogglePO(projId, poId, checked) {
    document.querySelectorAll(`.co-line-chk[data-proj="${projId}"][data-po="${poId}"]`).forEach(cb => {
        const line = JSON.parse(cb.dataset.line);
        if (!_lineIsSelectable(line)) return;   // skip unmapped
        cb.checked = checked;
        const k = _coSelKey(projId, poId, parseInt(cb.dataset.idx));
        if (checked) _coSelected.set(k, line);
        else         _coSelected.delete(k);
    });
    _coUpdateSelBar();
}

function _coSyncPOCheckbox(projId, poId) {
    const box = document.getElementById(`co-po-chk-${projId}-${poId}`);
    if (!box) return;
    const all = [...document.querySelectorAll(`.co-line-chk[data-proj="${projId}"][data-po="${poId}"]`)]
                    .filter(cb => _lineIsSelectable(JSON.parse(cb.dataset.line)));
    const checked = all.filter(cb => cb.checked).length;
    box.indeterminate = checked > 0 && checked < all.length;
    box.checked       = all.length > 0 && checked === all.length;
}

function _coUpdateSelBar() {
    const bar = document.getElementById('coSelBar');
    const cnt = _coSelected.size;
    if (cnt === 0) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    document.getElementById('coSelCount').textContent = `${cnt} line${cnt !== 1 ? 's' : ''} selected`;
}

function openGeneratePR() {
    if (_coSelected.size === 0) return;
    const lines = [];
    _coSelected.forEach((line, key) => {
        const [projId, poId, lineIdx] = key.split('|');
        // Ensure line_key is always set — use the selection key as the authoritative value
        const lineKey = line.line_key || key;
        lines.push({ ...line, line_key: lineKey, _projId: projId, _poId: poId, _lineIdx: lineIdx });
    });
    _prReviewLines = lines.map(l => ({
        ...l,
        _orderMode: (l.part_type === 'manufactured' || l.part_type === 'both') ? 'materials' : 'buy'
    }));
    showSection('generate-pr');
    _renderPRReview();
}

// ─── MAIN RENDER ───

function _renderCO() {
    const container = document.getElementById('coProjectsContainer');

    if (!_coData.length) {
        container.innerHTML = '<div class="co-empty"><span class="material-icons-outlined">inbox</span><br>No customer orders found.</div>';
        document.getElementById('coSummaryBar').style.display = 'none';
        return;
    }

    // ── Summary totals ──
    let totals = { total: 0, unmapped: 0, in_stock: 0, needs_pr: 0, pr_raised: 0 };
    _coData.forEach(proj => proj.pos.forEach(po => po.lines.forEach(l => {
        totals.total++;
        if (l.status === 'unmapped' || l.status === 'no_part') totals.unmapped++;
        else if (l.status === 'in_stock')  totals.in_stock++;
        else if (l.status === 'needs_pr')  totals.needs_pr++;
        else if (l.status === 'pr_raised') totals.pr_raised++;
    })));
    document.getElementById('coSumTotal').textContent   = totals.total;
    document.getElementById('coSumUnmapped').textContent = totals.unmapped;
    document.getElementById('coSumStock').textContent   = totals.in_stock;
    document.getElementById('coSumPR').textContent      = totals.needs_pr;
    document.getElementById('coSumRaised').textContent  = totals.pr_raised;
    document.getElementById('coSummaryBar').style.display = 'flex';

    // ── Collect all unmapped lines for the warning panel ──
    const allUnmapped = [];
    _coData.forEach(proj => proj.pos.forEach(po => po.lines.forEach(l => {
        if (l.status === 'unmapped' || l.status === 'no_part')
            allUnmapped.push({ proj: proj.project_name, po: po.po_number, cpn: l.customer_part_number, desc: l.description });
    })));

    let html = '';

    // ── Unmapped warning panel ──
    if (allUnmapped.length) {
        html += `<div class="co-unmapped-panel">
            <div class="co-unmapped-header">
                <span class="material-icons-outlined">link_off</span>
                <strong>${allUnmapped.length} Unmapped Part${allUnmapped.length !== 1 ? 's' : ''}</strong>
                <span style="color:var(--text-secondary);font-size:12px">— These lines are excluded from PR generation. Map them first.</span>
                <button class="co-map-all-btn" onclick="window.location.href='/rawmaterial/partmapping'">
                    <span class="material-icons-outlined">add_link</span> Go to Part Mapping
                </button>
            </div>
            <div class="co-unmapped-list">
                ${allUnmapped.map(u => `
                <div class="co-unmapped-item">
                    <span class="co-cust-pn">${_esc(u.cpn) || '<em>No part #</em>'}</span>
                    <span class="co-unmapped-desc">${_esc(u.desc)}</span>
                    <span class="co-unmapped-ref">${_esc(u.proj)} › ${_esc(u.po)}</span>
                </div>`).join('')}
            </div>
        </div>`;
    }

    // ── Projects + POs ──
    _coData.forEach(proj => {
        const visiblePOs = proj.pos.filter(po =>
            _coFilter === 'all' || po.lines.some(l => _lineMatchesFilter(l))
        );
        if (!visiblePOs.length) return;

        html += `<div class="co-project-block">
            <div class="co-project-header">
                <span class="material-icons-outlined" style="font-size:16px;color:var(--primary)">folder_open</span>
                <span class="co-project-name">${_esc(proj.project_name)}</span>
                <span class="co-project-po-count">${visiblePOs.length} PO${visiblePOs.length !== 1 ? 's' : ''}</span>
            </div>`;

        visiblePOs.forEach(po => {
            const visibleLines = _coFilter === 'all' ? po.lines : po.lines.filter(l => _lineMatchesFilter(l));
            if (!visibleLines.length) return;

            const s = po.summary;
            const urgentCount = (s.unmapped || 0) + (s.needs_pr || 0);
            const poStatusCls = urgentCount > 0 ? 'co-po-urgent' : 'co-po-ok';
            const poChkId = `co-po-chk-${proj.project_id}-${po.id}`;

            html += `<div class="co-po-card co-po-collapsed">
                <div class="co-po-header ${poStatusCls}">
                    <div class="co-po-header-left">
                        <input type="checkbox" class="co-chk" id="${poChkId}"
                            onchange="_coTogglePO('${proj.project_id}','${po.id}',this.checked)"
                            onclick="event.stopPropagation()">
                        <span class="material-icons-outlined co-po-chevron"
                            onclick="togglePOCard(this.closest('.co-po-card'))">chevron_right</span>
                        <div onclick="togglePOCard(this.closest('.co-po-card'))" style="cursor:pointer">
                            <div class="co-po-number">${_esc(po.po_number)} <span class="co-po-ver">v${po.version}</span></div>
                            <div class="co-po-meta">${_esc(po.customer_name)} &bull; ${po.po_date || '—'} &bull; Delivery: <strong>${po.delivery_date || '—'}</strong></div>
                        </div>
                    </div>
                    <div class="co-po-header-right" onclick="togglePOCard(this.closest('.co-po-card'))" style="cursor:pointer;flex:1">
                        <div class="co-po-pills">
                            ${s.unmapped  ? `<span class="co-pill co-pill-unmapped"><span class="material-icons-outlined">link_off</span>${s.unmapped} Unmapped</span>` : ''}
                            ${s.in_stock  ? `<span class="co-pill co-pill-stock"><span class="material-icons-outlined">inventory</span>${s.in_stock} In Stock</span>` : ''}
                            ${s.needs_pr  ? `<span class="co-pill co-pill-pr"><span class="material-icons-outlined">add_shopping_cart</span>${s.needs_pr} Needs PR</span>` : ''}
                            ${s.pr_raised ? `<span class="co-pill co-pill-raised"><span class="material-icons-outlined">pending_actions</span>${s.pr_raised} PR Raised</span>` : ''}
                        </div>
                        <div class="co-po-amount">${po.currency || 'INR'} ${_fmt(po.amount)}</div>
                    </div>
                </div>
                <div class="co-po-body">
                    <table class="co-lines-table">
                        <thead><tr>
                            <th style="width:32px"></th>
                            <th>#</th>
                            <th>Customer Part #</th>
                            <th>Description</th>
                            <th>Internal Part</th>
                            <th>Type</th>
                            <th style="text-align:right">Qty</th>
                            <th style="text-align:right">Stock Avail</th>
                            <th style="text-align:right">Shortage</th>
                            <th style="text-align:right">PR Raised</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr></thead>
                        <tbody>`;

            visibleLines.forEach((line) => {
                const actualIdx = po.lines.indexOf(line);
                const sCfg  = _statusCfg[line.status]   || _statusCfg.ready;
                const ptCfg = _partTypeCfg[line.part_type] || _partTypeCfg.unknown;
                const isUnmapped   = !_lineIsSelectable(line);
                const shortageStyle = line.shortage_qty > 0 ? 'color:#c62828;font-weight:700' : 'color:#2e7d32';

                const intPart = line.internal_part_number
                    ? `<span class="co-int-part">${_esc(line.internal_part_number)}</span>`
                    : `<span class="co-no-int">—</span>`;

                // Checkbox — disabled + tooltip for unmapped or already PR'd
                const chkHtml = isUnmapped
                    ? `<input type="checkbox" class="co-chk" disabled title="Map this part first">`
                    : line.pr_generated
                    ? `<input type="checkbox" class="co-chk" disabled title="PR already generated for this line">`
                    : _coCheckboxHtml(proj.project_id, po.id, actualIdx, line);

                // Part type badge — only show if mapped
                const typeBadge = isUnmapped ? '' :
                    `<span class="co-pt-badge ${ptCfg.cls}">
                        <span class="material-icons-outlined">${ptCfg.icon}</span>${ptCfg.label}
                    </span>`;

                // Action button
                let actionBtn = '';
                if (isUnmapped) {
                    actionBtn = `<button class="co-act-btn co-act-map" onclick="window.location.href='/rawmaterial/partmapping'">
                        <span class="material-icons-outlined">add_link</span> Map
                    </button>`;
                } else if (line.pr_generated) {
                    actionBtn = `<span class="co-act-done co-act-pr-done"><span class="material-icons-outlined">task_alt</span> PR Generated</span>`;
                } else if (line.status === 'needs_pr') {
                    actionBtn = `<button class="co-act-btn co-act-pr"
                        onclick="openPRFromCO('${_esc(line.internal_part_number||line.customer_part_number)}','${_esc(line.internal_description||line.description)}',${line.shortage_qty})">
                        <span class="material-icons-outlined">add_shopping_cart</span> Raise PR
                    </button>`;
                } else if (line.status === 'in_stock') {
                    actionBtn = `<button class="co-act-btn co-act-plan"
                        onclick="openDecisionModal('${_esc(line.internal_part_number||line.customer_part_number)}',${line.qty},'${_esc(po.po_number)}')">
                        <span class="material-icons-outlined">account_tree</span> Plan
                    </button>`;
                } else if (line.status === 'pr_raised') {
                    actionBtn = `<span class="co-act-done"><span class="material-icons-outlined">check</span> PR Done</span>`;
                }

                html += `<tr class="co-line-row co-line-${line.status}${isUnmapped ? ' co-line-disabled' : ''}${line.pr_generated ? ' co-line-pr-done' : ''}">
                    <td>${chkHtml}</td>
                    <td class="co-line-idx">${actualIdx + 1}</td>
                    <td><span class="co-cust-pn">${_esc(line.customer_part_number) || '<span style="color:var(--text-secondary)">—</span>'}</span></td>
                    <td class="co-desc">${_esc(line.description)}</td>
                    <td>${intPart}</td>
                    <td>${typeBadge}</td>
                    <td style="text-align:right;font-weight:600">${line.qty}</td>
                    <td style="text-align:right">${line.stock_available}</td>
                    <td style="text-align:right;${shortageStyle}">${line.shortage_qty > 0 ? line.shortage_qty : '—'}</td>
                    <td style="text-align:right;color:${line.pr_qty_raised > 0 ? '#1a73e8' : 'var(--text-secondary)'}">
                        ${line.pr_qty_raised > 0 ? line.pr_qty_raised : '—'}
                    </td>
                    <td><span class="co-status-badge ${sCfg.cls}"><span class="material-icons-outlined">${sCfg.icon}</span>${sCfg.label}</span></td>
                    <td>${actionBtn}</td>
                </tr>`;
            });

            html += `</tbody></table></div></div>`;
        });

        html += `</div>`;
    });

    container.innerHTML = html || '<div class="co-empty">No lines match the selected filter.</div>';
}

function _coCheckboxHtml(projId, poId, lineIdx, line) {
    const safe = JSON.stringify(line).replace(/"/g, '&quot;');
    return `<input type="checkbox" class="co-line-chk co-chk"
        data-proj="${projId}" data-po="${poId}" data-idx="${lineIdx}" data-line="${safe}"
        onchange="_coToggleLine('${projId}','${poId}',${lineIdx},JSON.parse(this.dataset.line),this)">`;
}

function togglePOCard(card) {
    card.classList.toggle('co-po-collapsed');
    const chevron = card.querySelector('.co-po-chevron');
    if (chevron) chevron.textContent = card.classList.contains('co-po-collapsed') ? 'chevron_right' : 'expand_more';
}

function openMapFromCO() { window.location.href = '/rawmaterial/partmapping'; }

function openPRFromCO(itemCode, desc, shortageQty) {
    openCreatePRModal();
    setTimeout(() => {
        const g = id => document.getElementById(id);
        if (g('pr-item-code')) g('pr-item-code').value = itemCode;
        if (g('pr-desc'))      g('pr-desc').value      = desc;
        if (g('pr-qty'))       g('pr-qty').value        = shortageQty;
        if (g('pr-priority'))  g('pr-priority').value   = 'urgent';
    }, 50);
}

// ─── PR REVIEW PAGE ───

let _prReviewLines = [];    // lines passed from selection
let _prBomCache    = {};    // partNumber → bom data (cached per session)
let _rmAllocated   = {};    // rmCode → qty already committed in this PR session (ACID deduction)

function _renderPRReview() {
    const container = document.getElementById('prReviewContainer');
    if (!_prReviewLines.length) {
        container.innerHTML = '<div class="co-empty">No lines selected.</div>';
        return;
    }
    // Reset allocation map each time we open the review page
    _rmAllocated = {};

    const today    = new Date();
    const datePart = today.getFullYear().toString()
        + String(today.getMonth() + 1).padStart(2, '0')
        + String(today.getDate()).padStart(2, '0');
    const prNum = `PR-${datePart}-${String(Math.floor(Math.random() * 900) + 100)}`;
    document.getElementById('prRevNumber').textContent  = prNum;
    document.getElementById('prRevNumberHidden').value  = prNum;

    const bopLines  = _prReviewLines.filter(l => l.part_type === 'bop'  || l.part_type === 'unknown');
    const mfgLines  = _prReviewLines.filter(l => l.part_type === 'manufactured');
    const bothLines = _prReviewLines.filter(l => l.part_type === 'both');

    let html = '';
    if (bopLines.length || bothLines.length) {
        const bopAll = [...bopLines, ...bothLines];
        html += `<div class="prr-section-header prr-section-bop">
            <span class="material-icons-outlined">shopping_bag</span>
            <span>Bought-Out Parts (BOP)</span>
            <span class="prr-section-count">${bopAll.length} line${bopAll.length !== 1 ? 's' : ''}</span>
            <span class="prr-section-hint">Buy the finished part directly, or order raw materials.</span>
        </div>`;
        bopAll.forEach(line => { html += _prrRowHtml(line, _prReviewLines.indexOf(line)); });
    }
    if (mfgLines.length) {
        html += `<div class="prr-section-header prr-section-mfg">
            <span class="material-icons-outlined">precision_manufacturing</span>
            <span>Manufactured Parts</span>
            <span class="prr-section-count">${mfgLines.length} line${mfgLines.length !== 1 ? 's' : ''}</span>
            <span class="prr-section-hint">BOM materials shown when Order Materials is selected.</span>
        </div>`;
        mfgLines.forEach(line => { html += _prrRowHtml(line, _prReviewLines.indexOf(line)); });
    }
    container.innerHTML = html;

    // Load BOM async for mfg/both
    [...mfgLines, ...bothLines].forEach(line => {
        const pn = line.internal_part_number || line.customer_part_number;
        if (pn) _prrLoadBom(_prReviewLines.indexOf(line), pn, line.qty);
    });
}

function _prrRowHtml(line, i) {
    const stockAvail      = line.stock_available || 0;
    const maxUseStock     = Math.min(stockAvail, line.qty);
    const defaultUseStock = line.status === 'in_stock' ? maxUseStock : 0;
    const defaultPRQty    = Math.max(0, line.qty - defaultUseStock);
    const partCode        = line.internal_part_number || line.customer_part_number || '';
    const ptCfg           = _partTypeCfg[line.part_type] || _partTypeCfg.unknown;
    const sCfg            = _statusCfg[line.status]      || _statusCfg.ready;
    const isMfg           = line.part_type === 'manufactured' || line.part_type === 'both';

    return `<div class="prr-row" id="prr-row-${i}">

        <!-- ROW HEADER (always visible, click to collapse) -->
        <div class="prr-row-header" onclick="_prrToggleCollapse(${i})">
            <span class="prr-idx">${i + 1}</span>
            <div style="flex:1;min-width:0">
                <span class="prr-part-code">${_esc(partCode)}</span>
                <span class="prr-part-desc" style="margin-left:8px">${_esc(line.description || line.internal_description || '')}</span>
            </div>
            <span class="co-pt-badge ${ptCfg.cls}">
                <span class="material-icons-outlined">${ptCfg.icon}</span>${ptCfg.label}
            </span>
            <span class="co-status-badge ${sCfg.cls}" style="margin-left:6px">
                <span class="material-icons-outlined">${sCfg.icon}</span>${sCfg.label}
            </span>
            <span class="prr-row-chevron material-icons-outlined">expand_more</span>
        </div>

        <!-- ROW BODY (collapsible) -->
        <div class="prr-row-body">
        <div class="prr-row-inner">

        <!-- LEFT: stock info -->
        <div class="prr-left">

            <!-- Finished-part stock panel -->
            <div class="prr-stock-panel">
                <div class="prr-stock-row">
                    <span class="prr-stock-lbl">Order Qty</span>
                    <span class="prr-stock-val">${line.qty}</span>
                </div>
                <div class="prr-stock-row">
                    <span class="prr-stock-lbl">Stock Available</span>
                    <span class="prr-stock-val" style="color:${stockAvail > 0 ? '#2e7d32' : 'var(--text-secondary)'}">${stockAvail}</span>
                </div>
                <div class="prr-stock-row">
                    <span class="prr-stock-lbl">Stock On Hand</span>
                    <span class="prr-stock-val">${line.stock_on_hand || 0}</span>
                </div>
                ${line.pr_qty_raised > 0 ? `<div class="prr-stock-row"><span class="prr-stock-lbl">PR Already Raised</span><span class="prr-stock-val" style="color:#1a73e8">${line.pr_qty_raised}</span></div>` : ''}
                <div class="prr-use-stock">
                    <label class="prr-use-lbl">Use from stock (units):</label>
                    <div class="prr-slider-row">
                        <input type="range" class="prr-slider" id="prr-slider-${i}"
                            min="0" max="${maxUseStock}" step="1" value="${defaultUseStock}"
                            ${maxUseStock === 0 ? 'disabled' : ''}
                            oninput="_prrUpdateQty(${i})">
                        <input type="number" class="prr-stock-input" id="prr-stock-use-${i}"
                            min="0" max="${maxUseStock}" step="1" value="${defaultUseStock}"
                            ${maxUseStock === 0 ? 'disabled' : ''}
                            oninput="_prrSyncSlider(${i})">
                    </div>
                    <div class="prr-qty-result">
                        PR Qty: <strong id="prr-pr-qty-display-${i}">${defaultPRQty}</strong>
                        <span style="color:var(--text-secondary);font-size:11px"> / ${line.qty} ordered</span>
                    </div>
                </div>
            </div>

            <!-- BOM materials panel (only for mfg/both, only visible when Order Materials active) -->
            ${isMfg ? `<div class="prr-bom-panel" id="prr-bom-${i}" style="display:none">
                <div class="prr-bom-loading">
                    <span class="material-icons-outlined" style="animation:spin 1s linear infinite;font-size:16px">sync</span>
                    Loading BOM...
                </div>
            </div>` : ''}
        </div>

        <!-- RIGHT: order decision + PR fields -->
        <div class="prr-right">

            <!-- Buy decision toggle -->
            <div class="prr-decision-bar" id="prr-decision-${i}">
                <span class="prr-decision-lbl">Order as:</span>
                <button class="prr-dec-btn prr-dec-buy ${isMfg ? '' : 'active'}" id="prr-dec-buy-${i}"
                    data-idx="${i}" data-mode="buy" onclick="_prrSetDecision(+this.dataset.idx,this.dataset.mode)">
                    <span class="material-icons-outlined">shopping_cart</span> Buy Directly
                </button>
                ${isMfg ? `<button class="prr-dec-btn prr-dec-mat active" id="prr-dec-mat-${i}"
                    data-idx="${i}" data-mode="materials" onclick="_prrSetDecision(+this.dataset.idx,this.dataset.mode)">
                    <span class="material-icons-outlined">category</span> Order Materials
                </button>` : ''}
            </div>

            <!-- Buy directly fields -->
            <div id="prr-buy-fields-${i}" ${isMfg ? 'style="display:none"' : ''}>
                <div class="prr-form-row">
                    <div class="form-group">
                        <label>Item Code</label>
                        <input type="text" class="prr-field" id="prr-code-${i}" value="${_esc(partCode)}">
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <input type="text" class="prr-field" id="prr-desc-${i}"
                            value="${_esc(line.description || line.internal_description || '')}">
                    </div>
                </div>
                <div class="prr-form-row">
                    <div class="form-group">
                        <label>PR Qty *</label>
                        <input type="number" class="prr-field" id="prr-qty-${i}"
                            value="${defaultPRQty}" min="0" step="any">
                    </div>
                    <div class="form-group">
                        <label>UOM</label>
                        <input type="text" class="prr-field" id="prr-uom-${i}" value="PCS">
                    </div>
                </div>
                <div class="prr-buffer-panel" style="margin-bottom:10px">
                    <span class="prr-buffer-lbl">Buffer:</span>
                    <div class="prr-buffer-btns">
                        <button class="prr-buf-btn" data-idx="${i}" data-pct="5"  onclick="_prrApplyBuffer(+this.dataset.idx,5)">+5%</button>
                        <button class="prr-buf-btn" data-idx="${i}" data-pct="10" onclick="_prrApplyBuffer(+this.dataset.idx,10)">+10%</button>
                        <input  type="number" class="prr-buf-input" id="prr-buf-pct-${i}" min="0" max="100" step="1" placeholder="%">
                        <button class="prr-buf-btn prr-buf-custom" data-idx="${i}" onclick="_prrApplyBuffer(+this.dataset.idx, parseFloat(document.getElementById('prr-buf-pct-'+this.dataset.idx).value)||0)">Apply</button>
                    </div>
                </div>
                <div class="prr-form-row">
                    <div class="form-group">
                        <label>Priority</label>
                        <select class="prr-field" id="prr-priority-${i}">
                            <option value="urgent" ${line.status === 'needs_pr' ? 'selected' : ''}>Urgent</option>
                            <option value="normal" ${line.status !== 'needs_pr' ? 'selected' : ''}>Normal</option>
                            <option value="low">Low</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Required Date</label>
                        <input type="date" class="prr-field" id="prr-date-${i}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Notes</label>
                    <textarea class="prr-field" id="prr-notes-${i}" rows="2">Customer PO — ${_esc(line.customer_part_number || '')}</textarea>
                </div>
            </div>

            <!-- Order materials fields (hidden until BOM loads + user picks) -->
            <div id="prr-mat-fields-${i}" ${isMfg ? '' : 'style="display:none"'}>
                <div id="prr-mat-rows-${i}">
                    <div style="color:var(--text-secondary);font-size:12px;padding:8px">
                        Loading materials...
                    </div>
                </div>
            </div>

            <div class="prr-skip-row">
                <label class="prr-skip-label">
                    <input type="checkbox" id="prr-skip-${i}" onchange="_prrToggleSkip(${i})">
                    Skip this line (don't create PR)
                </label>
            </div>
        </div>
        </div></div></div>`;
}

// ── BOM loader ──
async function _prrLoadBom(i, partNumber, orderQty) {
    const bomPanel = document.getElementById(`prr-bom-${i}`);
    const matRows  = document.getElementById(`prr-mat-rows-${i}`);
    try {
        let bom = _prBomCache[partNumber];
        if (!bom) {
            const r = await fetch(`${API}/bom-analysis/${encodeURIComponent(partNumber)}`, { headers: H() });
            const d = await r.json();
            bom = d.success ? d.data : null;
            _prBomCache[partNumber] = bom;
        }
        if (!bom || !bom.components || !bom.components.length) {
            if (bomPanel) bomPanel.innerHTML = `<div class="prr-bom-empty"><span class="material-icons-outlined">info</span> No BOM found — only Buy Directly available.</div>`;
            const matBtn = document.getElementById(`prr-dec-mat-${i}`);
            if (matBtn) { matBtn.disabled = true; matBtn.title = 'No BOM available'; }
            return;
        }
        _prReviewLines[i]._bom = bom;
        _prrRenderBomPanel(i, bom, orderQty);
        _prrRenderMatRows(i, bom, orderQty);
    } catch (e) {
        if (bomPanel) bomPanel.innerHTML = `<div class="prr-bom-empty" style="color:#c62828">BOM error: ${e.message}</div>`;
    }
}

// Renders the left BOM summary panel (RM stock info)
function _prrRenderBomPanel(i, bom, orderQty) {
    const bomPanel = document.getElementById(`prr-bom-${i}`);
    if (!bomPanel) return;
    const hasUnmapped = bom.has_unmapped_rm || bom.components.some(c => !c.is_mapped);
    let html = `<div class="prr-bom-title">
        <span class="material-icons-outlined">account_tree</span>
        Raw Materials &nbsp;·&nbsp; ${bom.components.length} item${bom.components.length !== 1 ? 's' : ''}
        ${hasUnmapped ? `<span class="prr-rm-warn"><span class="material-icons-outlined">warning</span> Some RM not mapped</span>` : ''}
    </div>
    <table class="prr-bom-table">
        <thead><tr><th>RM Code</th><th>Description</th><th>Need</th><th>In Stock</th><th>Free</th></tr></thead>
        <tbody>`;
    bom.components.forEach(c => {
        const need      = +(orderQty * c.qty_per).toFixed(3);
        const inStock   = c.stock_available || 0;
        const allocated = _rmAllocated[c.component_no] || 0;
        const free      = Math.max(0, inStock - allocated);
        const canUse    = Math.min(free, need);
        const freeColor = free >= need ? '#2e7d32' : free > 0 ? '#e65100' : 'var(--text-secondary)';
        html += `<tr id="prr-bom-row-${i}-${c.component_no.replace(/[^a-z0-9]/gi,'_')}" style="${!c.is_mapped ? 'background:rgba(198,40,40,.04)' : ''}">
            <td class="co-cust-pn" style="font-size:11px">${_esc(c.component_no)}</td>
            <td style="font-size:11px;color:var(--text-secondary)">${_esc(c.description)}</td>
            <td style="font-weight:600;color:var(--primary)">${need} ${c.unit}</td>
            <td style="font-size:11px">${inStock} ${c.unit}</td>
            <td style="font-weight:700;color:${freeColor}" id="prr-bom-free-${i}-${c.component_no.replace(/[^a-z0-9]/gi,'_')}">${free} ${c.unit}</td>
        </tr>`;
    });
    html += `</tbody></table>`;
    if (hasUnmapped) {
        html += `<div class="prr-rm-unmapped-warn"><span class="material-icons-outlined">link_off</span>
            Some RM not mapped. <a href="/rawmaterial/partmapping" target="_blank" style="color:#c62828;font-weight:600">Map Now →</a></div>`;
    }
    bomPanel.innerHTML = html;
}

// Renders the right-side material order rows
function _prrRenderMatRows(i, bom, orderQty) {
    const matRows = document.getElementById(`prr-mat-rows-${i}`);
    if (!matRows) return;
    const hasUnmapped = bom.components.some(c => !c.is_mapped);
    let html = '';
    if (hasUnmapped) {
        html += `<div class="prr-rm-unmapped-warn" style="margin-bottom:10px">
            <span class="material-icons-outlined">warning</span>
            Some RM codes are not mapped.
            <a href="/rawmaterial/partmapping" target="_blank" style="color:#c62828;font-weight:600;margin-left:4px">Map Now →</a>
        </div>`;
    }
    bom.components.forEach((c, ci) => {
        const need       = +(orderQty * c.qty_per).toFixed(3);
        const inStock    = c.stock_available || 0;
        const allocated  = _rmAllocated[c.component_no] || 0;
        const free       = Math.max(0, inStock - allocated);
        const canUse     = Math.min(free, need);
        const prQty      = +(Math.max(0, need - canUse)).toFixed(3);
        const isUnmapped = !c.is_mapped;

        // Commit this allocation immediately so next part sees reduced free stock
        _rmAllocated[c.component_no] = (_rmAllocated[c.component_no] || 0) + canUse;

        const stockNote = canUse > 0
            ? `<span class="prr-mat-stock-used"><span class="material-icons-outlined">inventory</span>${canUse} ${c.unit} from stock</span>`
            : (inStock > 0
                ? `<span class="prr-mat-stock-zero"><span class="material-icons-outlined">inventory_2</span>Stock used by earlier parts</span>`
                : '');

        html += `<div class="prr-mat-row ${isUnmapped ? 'prr-mat-unmapped' : ''}" id="prr-mat-row-${i}-${ci}">
            <div class="prr-mat-row-header">
                <span class="co-cust-pn" style="font-size:12px">${_esc(c.component_no)}</span>
                <span style="font-size:11px;color:var(--text-secondary)">${_esc(c.description)}</span>
                ${stockNote}
                ${isUnmapped ? `<span class="prr-mat-notmapped"><span class="material-icons-outlined">link_off</span>Not mapped</span>` : ''}
                <label class="prr-skip-label" style="margin-left:auto">
                    <input type="checkbox" id="prr-mat-skip-${i}-${ci}" ${isUnmapped ? 'checked' : ''}> Skip
                </label>
            </div>
            <div ${isUnmapped ? 'style="opacity:.4;pointer-events:none"' : ''}>
                <div class="prr-form-row" style="align-items:flex-end">
                    <div class="form-group">
                        <label>Order Qty *</label>
                        <input type="number" class="prr-field" id="prr-mat-qty-${i}-${ci}"
                            value="${prQty}" min="0" step="any"
                            data-base="${need}" data-i="${i}" data-ci="${ci}"
                            oninput="_prrMatQtyChanged(${i},${ci})">
                    </div>
                    <div class="form-group">
                        <label>UOM</label>
                        <input type="text" class="prr-field" id="prr-mat-uom-${i}-${ci}" value="${_esc(c.unit)}">
                    </div>
                    <div class="prr-mat-buf-wrap">
                        <button class="prr-buf-btn" data-i="${i}" data-ci="${ci}" data-pct="5"
                            onclick="_prrMatBuf(+this.dataset.i,+this.dataset.ci,5)">+5%</button>
                        <button class="prr-buf-btn" data-i="${i}" data-ci="${ci}" data-pct="10"
                            onclick="_prrMatBuf(+this.dataset.i,+this.dataset.ci,10)">+10%</button>
                        <input type="number" class="prr-buf-input" id="prr-mat-buf-${i}-${ci}" min="0" max="100" step="1" placeholder="%">
                        <button class="prr-buf-btn prr-buf-custom" data-i="${i}" data-ci="${ci}"
                            onclick="_prrMatBuf(+this.dataset.i,+this.dataset.ci,parseFloat(document.getElementById('prr-mat-buf-'+this.dataset.i+'-'+this.dataset.ci).value)||0)">Apply</button>
                    </div>
                </div>
                <div class="prr-form-row">
                    <div class="form-group">
                        <label>Priority</label>
                        <select class="prr-field" id="prr-mat-priority-${i}-${ci}">
                            <option value="urgent">Urgent</option>
                            <option value="normal" selected>Normal</option>
                            <option value="low">Low</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Required Date</label>
                        <input type="date" class="prr-field" id="prr-mat-date-${i}-${ci}">
                    </div>
                </div>
            </div>
        </div>`;
    });
    matRows.innerHTML = html;
}

// Called when a mat qty input changes — updates allocation display for all rows sharing that RM
function _prrMatQtyChanged(i, ci) {
    const bom = _prReviewLines[i]?._bom;
    if (!bom) return;
    const c       = bom.components[ci];
    const rmCode  = c.component_no;
    // Recalculate _rmAllocated from scratch for this RM across all parts
    _rmAllocated[rmCode] = 0;
    _prReviewLines.forEach((line, li) => {
        if (!line._bom?.components) return;
        line._bom.components.forEach((comp, cj) => {
            if (comp.component_no !== rmCode) return;
            const inStock   = comp.stock_available || 0;
            const need      = +(line.qty * comp.qty_per).toFixed(3);
            const prevAlloc = _rmAllocated[rmCode] || 0;
            const free      = Math.max(0, inStock - prevAlloc);
            const canUse    = Math.min(free, need);
            // If this is the row being edited, use the actual input value instead
            if (li === i && cj === ci) {
                const inputVal = parseFloat(document.getElementById(`prr-mat-qty-${i}-${ci}`)?.value) || 0;
                const usedFromStock = Math.max(0, need - inputVal);
                _rmAllocated[rmCode] = prevAlloc + Math.min(usedFromStock, free);
            } else {
                _rmAllocated[rmCode] = prevAlloc + canUse;
            }
            // Update the free stock display in the BOM panel for this row
            const safeCode = rmCode.replace(/[^a-z0-9]/gi,'_');
            const freeEl = document.getElementById(`prr-bom-free-${li}-${safeCode}`);
            if (freeEl) {
                const newFree = Math.max(0, inStock - (_rmAllocated[rmCode] || 0));
                freeEl.textContent = `${newFree} ${comp.unit}`;
                freeEl.style.color = newFree >= need ? '#2e7d32' : newFree > 0 ? '#e65100' : 'var(--text-secondary)';
            }
        });
    });
}

// Buffer apply for individual material row
function _prrMatBuf(i, ci, pct) {
    if (pct <= 0) return;
    const inp = document.getElementById(`prr-mat-qty-${i}-${ci}`);
    if (!inp) return;
    const base = parseFloat(inp.dataset.base) || 0;
    inp.value  = +(base * (1 + pct / 100)).toFixed(3);
    _prrMatQtyChanged(i, ci);
}

// ── Collapse/expand row ──
function _prrToggleCollapse(i) {
    const row = document.getElementById(`prr-row-${i}`);
    const body = row.querySelector('.prr-row-body');
    const chevron = row.querySelector('.prr-row-chevron');
    const collapsed = row.classList.toggle('prr-row-collapsed');
    chevron.textContent = collapsed ? 'chevron_right' : 'expand_more';
}

// ── Decision toggle (Buy / Order Materials) ──
function _prrSetDecision(i, mode) {
    document.getElementById(`prr-buy-fields-${i}`).style.display  = mode === 'buy'       ? '' : 'none';
    document.getElementById(`prr-mat-fields-${i}`).style.display  = mode === 'materials' ? '' : 'none';
    document.getElementById(`prr-dec-buy-${i}`).classList.toggle('active', mode === 'buy');
    const matBtn = document.getElementById(`prr-dec-mat-${i}`);
    if (matBtn) matBtn.classList.toggle('active', mode === 'materials');
    // Show BOM panel only when Order Materials is selected
    const bomPanel = document.getElementById(`prr-bom-${i}`);
    if (bomPanel) bomPanel.style.display = mode === 'materials' ? '' : 'none';
    _prReviewLines[i]._orderMode = mode;
}

// ── Buffer % apply (finished part / Buy Directly) ──
function _prrApplyBuffer(i, pct) {
    if (pct <= 0) return;
    const line    = _prReviewLines[i];
    const qtyIn   = document.getElementById(`prr-qty-${i}`);
    const display = document.getElementById(`prr-pr-qty-display-${i}`);
    const useStock = parseInt(document.getElementById(`prr-stock-use-${i}`)?.value) || 0;
    const base     = Math.max(0, line.qty - useStock);
    const newQty   = +(base * (1 + pct / 100)).toFixed(3);
    if (qtyIn)   qtyIn.value         = newQty;
    if (display) display.textContent = newQty;
}

// ── Stock slider sync ──
function _prrUpdateQty(i) {
    const slider   = document.getElementById(`prr-slider-${i}`);
    const stockIn  = document.getElementById(`prr-stock-use-${i}`);
    const qtyIn    = document.getElementById(`prr-qty-${i}`);
    const display  = document.getElementById(`prr-pr-qty-display-${i}`);
    const useStock = parseInt(slider.value) || 0;
    stockIn.value  = useStock;
    const prQty    = Math.max(0, _prReviewLines[i].qty - useStock);
    if (qtyIn)   qtyIn.value        = prQty;
    if (display) display.textContent = prQty;
}

function _prrSyncSlider(i) {
    const stockIn = document.getElementById(`prr-stock-use-${i}`);
    const slider  = document.getElementById(`prr-slider-${i}`);
    const max     = parseInt(slider.max) || 0;
    const val     = Math.min(max, Math.max(0, parseInt(stockIn.value) || 0));
    stockIn.value = val;
    slider.value  = val;
    _prrUpdateQty(i);
}

// ── Skip toggle ──
function _prrToggleSkip(i) {
    const skip    = document.getElementById(`prr-skip-${i}`).checked;
    const row     = document.getElementById(`prr-row-${i}`);
    const header  = row.querySelector('.prr-row-header');
    row.classList.toggle('prr-skipped', skip);
    // Show/hide skipped badge in header
    let badge = header.querySelector('.prr-skipped-badge');
    if (skip) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'prr-skipped-badge';
            badge.innerHTML = '<span class="material-icons-outlined">block</span> Skipped';
            header.insertBefore(badge, header.querySelector('.prr-row-chevron'));
        }
        // Collapse the body
        row.classList.add('prr-row-collapsed');
        row.querySelector('.prr-row-chevron').textContent = 'chevron_right';
    } else {
        if (badge) badge.remove();
        row.classList.remove('prr-row-collapsed');
        row.querySelector('.prr-row-chevron').textContent = 'expand_more';
    }
    row.querySelectorAll('.prr-right input:not(#prr-skip-' + i + '), .prr-right select, .prr-right textarea')
       .forEach(el => el.disabled = skip);
    row.querySelectorAll('.prr-slider, .prr-stock-input').forEach(el => el.disabled = skip);
    row.querySelectorAll('.prr-dec-btn').forEach(el => el.disabled = skip);
}

// ─── SUBMIT PR REVIEW ───

async function submitPRReview() {
    const btn = document.getElementById('prRevSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-outlined" style="animation:spin 1s linear infinite">sync</span> Creating PR...';

    const prNum   = document.getElementById('prRevNumberHidden').value;
    const errors  = [];
    const skippedLabels = [];
    // Collect all line items into one PR
    const allItems = [];
    // Collect source line keys for all non-skipped lines
    const sourceKeys = [];

    for (let i = 0; i < _prReviewLines.length; i++) {
        const skipChk = document.getElementById(`prr-skip-${i}`);
        if (skipChk?.checked) {
            const line = _prReviewLines[i];
            skippedLabels.push(line.internal_part_number || line.customer_part_number || `Line ${i+1}`);
            continue;
        }

        const line = _prReviewLines[i];
        const mode = line._orderMode || 'buy';

        if (mode === 'materials' && line._bom?.components?.length) {
            for (let ci = 0; ci < line._bom.components.length; ci++) {
                if (document.getElementById(`prr-mat-skip-${i}-${ci}`)?.checked) continue;
                const qty = parseFloat(document.getElementById(`prr-mat-qty-${i}-${ci}`)?.value) || 0;
                if (qty <= 0) continue;
                allItems.push({
                    item_code:        line._bom.components[ci].component_no,
                    item_description: line._bom.components[ci].description,
                    required_qty:     qty,
                    uom:              document.getElementById(`prr-mat-uom-${i}-${ci}`)?.value || 'PCS',
                    priority:         document.getElementById(`prr-mat-priority-${i}-${ci}`)?.value || 'normal',
                    required_date:    document.getElementById(`prr-mat-date-${i}-${ci}`)?.value || null,
                    notes:            `RM for ${line.internal_part_number || line.customer_part_number}`,
                });
            }
            if (line.line_key) sourceKeys.push(line.line_key);
        } else {
            const qty = parseFloat(document.getElementById(`prr-qty-${i}`)?.value) || 0;
            if (qty <= 0) { skippedLabels.push(line.internal_part_number || line.customer_part_number || `Line ${i+1}`); continue; }
            allItems.push({
                item_code:        document.getElementById(`prr-code-${i}`)?.value.trim(),
                item_description: document.getElementById(`prr-desc-${i}`)?.value.trim(),
                required_qty:     qty,
                uom:              document.getElementById(`prr-uom-${i}`)?.value.trim() || 'PCS',
                priority:         document.getElementById(`prr-priority-${i}`)?.value || 'normal',
                required_date:    document.getElementById(`prr-date-${i}`)?.value || null,
                notes:            document.getElementById(`prr-notes-${i}`)?.value.trim(),
            });
            if (line.line_key) sourceKeys.push(line.line_key);
        }
    }

    if (!allItems.length) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-outlined">send</span> Generate &amp; Send PR';
        const msg = skippedLabels.length
            ? `All lines were skipped:\n${skippedLabels.join(', ')}`
            : 'No items to create a PR for.';
        alert(msg);
        return;
    }

    // Use the first item's fields as the PR header; rest go into notes
    const first = allItems[0];
    const combinedNotes = allItems.map((it, idx) =>
        `${idx+1}. ${it.item_code} — ${it.item_description} (${it.required_qty} ${it.uom})`
    ).join('\n');
    const topPriority = allItems.some(it => it.priority === 'urgent') ? 'urgent' : 'normal';

    const body = {
        pr_no:            prNum,
        item_code:        first.item_code,
        item_description: first.item_description,
        required_qty:     first.required_qty,
        uom:              first.uom,
        required_date:    first.required_date || null,
        priority:         topPriority,
        notes:            combinedNotes,
        suggested_supplier_name: '',
        estimated_unit_price:    0,
        source_line_keys: sourceKeys.join(','),
    };

    let created = false;
    try {
        const r = await fetch(API + '/purchase-requests', { method: 'POST', headers: H(), body: JSON.stringify(body) });
        const d = await r.json();
        if (!d.success) { errors.push(d.message); }
        else {
            created = true;
            if (d.data?.id) {
                await fetch(API + `/purchase-requests/${d.data.id}/send-to-purchaser`, { method: 'POST', headers: H() });
            }
        }
    } catch (e) { errors.push(e.message); }

    btn.disabled  = false;
    btn.innerHTML = '<span class="material-icons-outlined">send</span> Generate &amp; Send PR';

    if (errors.length) {
        alert(`Error creating PR:\n${errors.join('\n')}`);
    } else {
        let successMsg = `Purchase Request ${prNum} created and sent to Purchaser (${allItems.length} item${allItems.length !== 1 ? 's' : ''}).`;
        if (skippedLabels.length) {
            successMsg += `\n\nSkipped: ${skippedLabels.join(', ')}`;
        }
        document.getElementById('prRevSuccess').style.display = 'flex';
        document.getElementById('prRevSuccessMsg').textContent = successMsg;
        _coSelected.clear();
        _coUpdateSelBar();
        setTimeout(() => {
            document.getElementById('prRevSuccess').style.display = 'none';
            showSection('purchase-requests');
            loadPRs();
            loadOverview();
            refreshNotifBadge();
        }, 3000);
    }
}

// ─── LEGACY DECISION MODAL (kept for in_stock Plan button) ───

let currentDecisionData = null;

async function openDecisionModal(partNumber, qty, poNumber) {
    if (!partNumber) return;
    document.getElementById('decisionModal').classList.add('active');
    document.getElementById('decisionLoading').style.display = 'block';
    document.getElementById('decisionContent').style.display = 'none';
    currentDecisionData = { partNumber, qty, poNumber };
    try {
        const res = await fetch(`${API}/bom-analysis/${encodeURIComponent(partNumber)}`, { headers: H() });
        const d   = await res.json();
        document.getElementById('decisionLoading').style.display = 'none';
        document.getElementById('decisionContent').style.display = 'block';
        document.getElementById('dec-part-number').textContent = partNumber;
        document.getElementById('dec-customer').textContent    = 'PO: ' + poNumber;
        document.getElementById('dec-qty').textContent         = qty;
        if (d.success && d.data) {
            currentDecisionData.bom = d.data;
            document.getElementById('dec-bom-no').textContent    = d.data.bom_no || 'No BOM Found';
            document.getElementById('dec-bom-yield').textContent = 'Yield: ' + (d.data.yield_qty || 1);
            document.getElementById('dec-rm-count').textContent  = d.data.components.length;
            const fgLT = d.data.fg_lead_time_days || 0;
            document.querySelector('button[onclick="executeDecision(\'buy\')"]').innerHTML =
                `<span class="material-icons-outlined">shopping_cart</span> Buy Directly (LT: ${fgLT}d)`;
            let rmHtml = '', maxLT = 0;
            d.data.components.forEach(c => {
                const reqQty = Math.ceil((qty / d.data.yield_qty) * c.qty_per);
                if (c.lead_time_days > maxLT) maxLT = c.lead_time_days;
                rmHtml += `<tr>
                    <td>${c.component_no}</td><td>${c.description}</td>
                    <td>${c.qty_per} ${c.unit}</td>
                    <td style="font-weight:600;color:var(--primary)">${reqQty} ${c.unit}</td>
                    <td style="color:${c.lead_time_days > 14 ? '#c62828' : 'inherit'}">${c.lead_time_days}d</td>
                </tr>`;
            });
            document.querySelector('button[onclick="executeDecision(\'manufacture\')"]').innerHTML =
                `<span class="material-icons-outlined">factory</span> Manufacture (Max LT: ${maxLT}d)`;
            document.getElementById('dec-rm-body').innerHTML = rmHtml || '<tr><td colspan="5" class="empty">No RM specified.</td></tr>';
        } else {
            currentDecisionData.bom = null;
            document.getElementById('dec-bom-no').textContent    = 'No BOM Found';
            document.getElementById('dec-bom-yield').textContent = '—';
            document.getElementById('dec-rm-count').textContent  = '0';
            document.getElementById('dec-rm-body').innerHTML     = '<tr><td colspan="5" class="empty">No BOM. Proceed with direct buy.</td></tr>';
        }
    } catch (e) {
        document.getElementById('decisionLoading').innerHTML = `<div style="color:#c62828">Error: ${e.message}</div>`;
    }
}

async function executeDecision(type) {
    if (!currentDecisionData) return;
    const items = [];
    if (type === 'buy') {
        items.push({ item_code: currentDecisionData.partNumber, required_qty: currentDecisionData.qty, uom: 'PCS', notes: 'Direct buy from Customer PO.' });
    } else {
        if (!currentDecisionData.bom?.bom_id) { alert('No BOM available.'); return; }
        currentDecisionData.bom.components.forEach(c => {
            items.push({ item_code: c.component_no, required_qty: Math.ceil((currentDecisionData.qty / currentDecisionData.bom.yield_qty) * c.qty_per), uom: c.unit, notes: `RM for ${currentDecisionData.partNumber}` });
        });
    }
    for (const item of items) {
        await fetch(API + '/purchase-requests', { method: 'POST', headers: H(), body: JSON.stringify({ ...item, priority: 'urgent' }) });
    }
    alert(`PRs created for ${type === 'buy' ? 'direct buy' : 'manufacture'}. Check Purchase Requests.`);
    closeModal('decisionModal');
    loadCustomerOrders();
}
