// ─── PURCHASE REQUESTS ───
let prs = [];
async function loadPRs() {
    const r = await fetch(API + '/purchase-requests', { headers: H() });
    const d = await r.json();
    prs = d.data || [];
    const tbody = document.getElementById('pr-body');
    if (!prs.length) {
        tbody.innerHTML = '<div class="pr-empty"><span class="material-icons-outlined">inbox</span><br>No purchase requests yet</div>';
        return;
    }
    tbody.innerHTML = prs.map((p, idx) => _prCardHtml(p, idx)).join('');
}

function _findPOForItem(pos, itemCode) {
    if (!pos || !pos.length) return null;
    let match = pos.find(po => po.item_code === itemCode);
    if (match) return match;
    for (let po of pos) {
        if (po.lines && po.lines.length) {
            let lineMatch = po.lines.find(line => line.item_code === itemCode);
            if (lineMatch) return po;
        }
    }
    return null;
}

function _prCardHtml(p, idx) {
    const createdDate = p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
    const sentDate    = p.sent_to_purchaser_at ? new Date(p.sent_to_purchaser_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : null;
    const reqDate     = p.required_date || '—';
    const priorityCls = p.priority === 'urgent' ? 'badge-red' : p.priority === 'low' ? 'badge-draft' : 'badge-open';

    const lines = _prParseItems(p.notes);
    const itemSummary = lines.length
        ? `${lines.length} item${lines.length !== 1 ? 's' : ''}`
        : `${p.item_code} · ${p.required_qty} ${p.uom}`;

    let poSummaryHtml = '';
    if (p.pos && p.pos.length > 0) {
        const uniquePoNos = Array.from(new Set(p.pos.map(po => po.po_no)));
        const totalDelay = Math.max(...p.pos.map(po => po.delay_days));
        const totalResched = p.pos.reduce((sum, po) => sum + po.reschedule_count, 0);
        poSummaryHtml = `<div style="font-size:11px; margin-top:4px; font-weight:600; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="background:#e8f5e9; color:#2e7d32; border-radius:3px; padding:2px 6px; font-size:10px;">Bought (${uniquePoNos.join(', ')})</span>
            ${totalDelay > 0 ? `
            <span style="background:#ffebee; color:#c62828; border-radius:3px; padding:2px 6px; font-size:10px; display:inline-flex; align-items:center; gap:2px;">
                <span class="material-icons-outlined" style="font-size:11px;">schedule</span> +${totalDelay}d late
            </span>` : ''}
            ${totalResched > 0 ? `
            <span style="background:#fff3e0; color:#e65100; border-radius:3px; padding:2px 6px; font-size:10px;">
                Rescheduled ${totalResched}x
            </span>` : ''}
        </div>`;
    }

    const _getItemPoHtml = (itemCode) => {
        const po = _findPOForItem(p.pos, itemCode);
        if (!po) return `<span style="color:var(--text-muted); font-size:12px;">Not ordered yet</span>`;
        const dateStr = po.po_etd ? new Date(po.po_etd).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : '—';
        const delayBadge = po.delay_days > 0 ? `<span style="background:#ffebee; color:#c62828; border-radius:3px; padding:1px 4px; font-size:10px; font-weight:600; display:inline-flex; align-items:center; gap:2px; margin-left:6px;"><span class="material-icons-outlined" style="font-size:10px;">schedule</span>+${po.delay_days}d</span>` : '';
        const reschedBadge = po.reschedule_count > 0 ? `<span style="background:#fff3e0; color:#e65100; border-radius:3px; padding:1px 4px; font-size:10px; font-weight:600; margin-left:6px;" title="Rescheduled count">🔄 ${po.reschedule_count}x</span>` : '';
        
        return `<div style="font-size:12px; line-height:1.3;">
            <span style="background:#e8f5e9; color:#2e7d32; border-radius:3px; padding:1px 4px; font-size:10px; font-weight:600;">Ordered: ${po.po_no}</span>
            <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">
                ETD: <strong style="color:#e65100;">${dateStr}</strong>
                ${delayBadge}
                ${reschedBadge}
            </div>
        </div>`;
    };

    return `<div class="pr-card" id="pr-card-${idx}">
        <div class="pr-card-header" onclick="_prToggle(${idx})">
            <span class="pr-chevron material-icons-outlined">expand_more</span>
            <div class="pr-card-main">
                <span class="pr-no">${p.pr_no}</span>
                <span class="pr-item-summary">${itemSummary}</span>
                ${poSummaryHtml}
            </div>
            <div class="pr-card-meta">
                <span class="pr-meta-item"><span class="material-icons-outlined">calendar_today</span>${createdDate}</span>
                ${sentDate ? `<span class="pr-meta-item"><span class="material-icons-outlined">send</span>${sentDate}</span>` : ''}
                <span class="pr-meta-item"><span class="material-icons-outlined">person</span>${p.created_by || '—'}</span>
                <span class="badge ${priorityCls}">${p.priority}</span>
                ${badge(p.status)}
            </div>
            <div class="pr-card-actions" onclick="event.stopPropagation()">
                ${p.status === 'draft' ? `<button class="btn-icon" title="Send to Purchaser" onclick="sendToPurchaser('${p.id}','${p.pr_no}')"><span class="material-icons-outlined">send</span></button>` : ''}
                <button class="btn-icon danger" title="Delete" onclick="deletePR('${p.id}')"><span class="material-icons-outlined">delete</span></button>
            </div>
        </div>
        <div class="pr-card-body" id="pr-card-body-${idx}">
            <table class="pr-items-table">
                <thead><tr>
                    <th>#</th><th>Item Code</th><th>Description</th>
                    <th style="text-align:right">Qty</th><th>UOM</th>
                    <th>PO / Delivery Status</th><th>Required Date</th>
                </tr></thead>
                <tbody>
                ${lines.length ? lines.map((l, i) => `<tr>
                    <td class="pr-item-idx">${i + 1}</td>
                    <td><span class="co-cust-pn">${_escPR(l.code)}</span></td>
                    <td style="color:var(--text-secondary)">${_escPR(l.desc)}</td>
                    <td style="text-align:right;font-weight:600">${l.qty}</td>
                    <td>${_escPR(l.uom)}</td>
                    <td>${_getItemPoHtml(l.code)}</td>
                    <td>${p.required_date || '—'}</td>
                </tr>`).join('') : `<tr>
                    <td class="pr-item-idx">1</td>
                    <td><span class="co-cust-pn">${_escPR(p.item_code)}</span></td>
                    <td style="color:var(--text-secondary)">${_escPR(p.item_description)}</td>
                    <td style="text-align:right;font-weight:600">${p.required_qty}</td>
                    <td>${p.uom}</td>
                    <td>${_getItemPoHtml(p.item_code)}</td>
                    <td>${p.required_date || '—'}</td>
                </tr>`}
                </tbody>
            </table>
            ${p.notes && !lines.length ? `<div class="pr-notes"><span class="material-icons-outlined">notes</span>${_escPR(p.notes)}</div>` : ''}
        </div>
    </div>`;
}

function _escPR(s) {
    return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';
}

// Parse "1. CODE — description (qty UOM)" lines from notes
function _prParseItems(notes) {
    if (!notes) return [];
    const items = [];
    notes.split('\n').forEach(line => {
        const m = line.match(/^\d+\.\s+(.+?)\s+[—\-]\s+(.+?)\s+\((\d+(?:\.\d+)?)\s+([^)]+)\)/);
        if (m) items.push({ code: m[1].trim(), desc: m[2].trim(), qty: m[3], uom: m[4].trim() });
    });
    return items;
}

function _prToggle(idx) {
    const card = document.getElementById(`pr-card-${idx}`);
    const body = document.getElementById(`pr-card-body-${idx}`);
    const chevron = card.querySelector('.pr-chevron');
    const open = card.classList.toggle('pr-card-open');
    body.style.display = open ? '' : 'none';
    chevron.textContent = open ? 'expand_less' : 'expand_more';
}

function openCreatePRFromDemand(planId, planNo, itemCode, shortageQty) {
    document.getElementById('pr-plan-id').value = planId || '';
    document.getElementById('pr-plan-no').value = planNo || '';
    document.getElementById('pr-item-code').value = itemCode || '';
    document.getElementById('pr-qty').value = shortageQty || '';
    document.getElementById('pr-desc').value = '';
    document.getElementById('pr-supplier').value = '';
    document.getElementById('pr-price').value = '';
    document.getElementById('pr-date').value = '';
    document.getElementById('pr-priority').value = 'normal';
    document.getElementById('pr-notes').value = '';
    openModal('prModal');
}

function openCreatePRModal() {
    openCreatePRFromDemand('', '', '', '');
}

async function savePR(e) {
    e.preventDefault();
    const body = {
        plan_id: document.getElementById('pr-plan-id').value || null,
        plan_no: document.getElementById('pr-plan-no').value,
        item_code: document.getElementById('pr-item-code').value.trim(),
        item_description: document.getElementById('pr-desc').value.trim(),
        required_qty: parseFloat(document.getElementById('pr-qty').value),
        suggested_supplier_name: document.getElementById('pr-supplier').value.trim(),
        estimated_unit_price: parseFloat(document.getElementById('pr-price').value || 0),
        required_date: document.getElementById('pr-date').value || null,
        priority: document.getElementById('pr-priority').value,
        notes: document.getElementById('pr-notes').value.trim()
    };
    const r = await fetch(API + '/purchase-requests', { method:'POST', headers:H(), body:JSON.stringify(body) });
    const d = await r.json();
    if (d.success) { closeModal('prModal'); loadPRs(); loadOverview(); }
    else { alert(d.message); }
}

async function sendToPurchaser(prId, prNo) {
    if (!confirm(`Send PR ${prNo} to Purchaser?`)) return;
    const r = await fetch(API + `/purchase-requests/${prId}/send-to-purchaser`, { method:'POST', headers:H() });
    const d = await r.json();
    if (d.success) { loadPRs(); loadOverview(); refreshNotifBadge(); alert(d.message); }
    else { alert(d.message); }
}

async function deletePR(id) {
    if (!confirm('Delete this PR?')) return;
    await fetch(API + '/purchase-requests/' + id, { method:'DELETE', headers:H() });
    loadPRs(); loadOverview();
}

