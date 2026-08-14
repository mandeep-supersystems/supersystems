const API = '/api/v1/planning';
const PURCHASE_API = '/api/v1/purchase';
const token = () => localStorage.getItem('access_token');
const tenant = () => JSON.parse(localStorage.getItem('tenant') || '{}');
const user = () => JSON.parse(localStorage.getItem('user') || '{}');
const H = () => ({
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token(),
    'X-Tenant-ID': tenant().id || tenant().code || '',
    'X-User-Email': user().email || '',
    'X-User-Name': ((user().first_name || '') + ' ' + (user().last_name || '')).trim()
});

const VALID_SECTIONS = ['overview','demands','po-demands','purchase-requests','notifications'];

function showSection(sec) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link[data-section]').forEach(l => l.classList.remove('active'));
    const el = document.getElementById('sec-' + sec);
    if (el) el.classList.add('active');
    const lnk = document.querySelector(`.sidebar-link[data-section="${sec}"]`);
    if (lnk) lnk.classList.add('active');
    if (location.hash !== '#' + sec) location.hash = sec;
    if (sec === 'overview') loadOverview();
    if (sec === 'demands') loadDemands();
    if (sec === 'po-demands') loadPODemands();
    if (sec === 'purchase-requests') loadPRs();
    if (sec === 'notifications') loadNotifications();
}

window.addEventListener('hashchange', () => {
    const h = location.hash.replace('#','') || 'overview';
    showSection(VALID_SECTIONS.includes(h) ? h : 'overview');
});
document.addEventListener('DOMContentLoaded', () => {
    const h = location.hash.replace('#','') || 'overview';
    showSection(VALID_SECTIONS.includes(h) ? h : 'overview');
    refreshNotifBadge();
});

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function badge(status) {
    const map = {
        draft:'badge-draft', open:'badge-open', sent_to_purchaser:'badge-sent',
        converted_to_po:'badge-converted', rejected:'badge-rejected',
        pending:'badge-pending', passed:'badge-passed', partial_pass:'badge-partial',
        acknowledged:'badge-acknowledged', received:'badge-received'
    };
    const label = { sent_to_purchaser:'Sent to Purchaser', converted_to_po:'Converted to PO',
        partial_pass:'Partial Pass' };
    return `<span class="badge ${map[status]||'badge-draft'}">${label[status]||status}</span>`;
}

// ─── OVERVIEW ───
async function loadOverview() {
    const r = await fetch(API + '/overview', { headers: H() });
    const d = await r.json();
    if (!d.success) return;
    const s = d.data;
    document.getElementById('kpi-demands').textContent = s.total_demands;
    document.getElementById('kpi-open').textContent = s.open_demands;
    document.getElementById('kpi-prs').textContent = s.total_prs;
    document.getElementById('kpi-pending-prs').textContent = s.pending_prs;
    document.getElementById('kpi-sent').textContent = s.sent_prs;
    document.getElementById('kpi-notifs').textContent = s.unread_notifications;
}

// ─── DEMANDS ───
let demands = [];
async function loadDemands() {
    const r = await fetch(API + '/demands', { headers: H() });
    const d = await r.json();
    demands = d.data || [];
    const tbody = document.getElementById('demands-body');
    if (!demands.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No demand plans yet</td></tr>'; return; }
    tbody.innerHTML = demands.map(d => `<tr>
        <td><strong>${d.plan_no}</strong></td>
        <td>${d.item_code}</td>
        <td>${d.item_description || '—'}</td>
        <td>${d.required_qty}</td>
        <td>${d.available_stock}</td>
        <td><strong style="color:${d.shortage_qty>0?'#c62828':'#2e7d32'}">${d.shortage_qty}</strong></td>
        <td>${badge(d.status)}</td>
        <td>
            <button class="btn-icon" title="Create PR from this demand" onclick="openCreatePRFromDemand('${d.id}','${d.plan_no}','${d.item_code}',${d.shortage_qty})">
                <span class="material-icons-outlined">add_shopping_cart</span>
            </button>
            <button class="btn-icon danger" title="Delete" onclick="deleteDemand('${d.id}')">
                <span class="material-icons-outlined">delete</span>
            </button>
        </td>
    </tr>`).join('');
}

function openCreateDemandModal() {
    document.getElementById('dm-item-code').value = '';
    document.getElementById('dm-item-desc').value = '';
    document.getElementById('dm-qty').value = '';
    document.getElementById('dm-date').value = '';
    document.getElementById('dm-customer').value = '';
    document.getElementById('dm-notes').value = '';
    openModal('demandModal');
}

async function saveDemand(e) {
    e.preventDefault();
    const body = {
        item_code: document.getElementById('dm-item-code').value.trim(),
        item_description: document.getElementById('dm-item-desc').value.trim(),
        required_qty: parseFloat(document.getElementById('dm-qty').value),
        required_date: document.getElementById('dm-date').value || null,
        customer_name: document.getElementById('dm-customer').value.trim(),
        notes: document.getElementById('dm-notes').value.trim()
    };
    const r = await fetch(API + '/demands', { method:'POST', headers:H(), body:JSON.stringify(body) });
    const d = await r.json();
    if (d.success) {
        closeModal('demandModal');
        loadDemands();
        loadOverview();
        refreshNotifBadge();
        if (d.data.shortage_qty > 0) {
            if (confirm(`Shortage of ${d.data.shortage_qty} units detected. Create Purchase Request now?`)) {
                openCreatePRFromDemand(d.data.id, d.data.plan_no, body.item_code, d.data.shortage_qty);
            }
        }
    } else { alert(d.message); }
}

async function deleteDemand(id) {
    if (!confirm('Delete this demand plan?')) return;
    await fetch(API + '/demands/' + id, { method:'DELETE', headers:H() });
    loadDemands(); loadOverview();
}

// ─── PURCHASE REQUESTS ───
let prs = [];
async function loadPRs() {
    const r = await fetch(API + '/purchase-requests', { headers: H() });
    const d = await r.json();
    prs = d.data || [];
    const tbody = document.getElementById('pr-body');
    if (!prs.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No purchase requests yet</td></tr>'; return; }
    tbody.innerHTML = prs.map(p => `<tr>
        <td><strong>${p.pr_no}</strong></td>
        <td>${p.plan_no || '—'}</td>
        <td>${p.item_code}</td>
        <td>${p.required_qty} ${p.uom}</td>
        <td>${p.suggested_supplier_name || '—'}</td>
        <td><span class="badge badge-${p.priority==='urgent'?'red':'open'}">${p.priority}</span></td>
        <td>${badge(p.status)}</td>
        <td>
            ${p.status === 'draft' ? `<button class="btn-icon" title="Send to Purchaser" onclick="sendToPurchaser('${p.id}','${p.pr_no}')"><span class="material-icons-outlined">send</span></button>` : ''}
            <button class="btn-icon danger" title="Delete" onclick="deletePR('${p.id}')"><span class="material-icons-outlined">delete</span></button>
        </td>
    </tr>`).join('');
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

// ─── NOTIFICATIONS ───
async function loadNotifications() {
    const r = await fetch(API + '/notifications?role=planner', { headers: H() });
    const d = await r.json();
    const list = document.getElementById('notif-list');
    const items = d.data || [];
    if (!items.length) { list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-secondary);">No notifications</div>'; return; }
    list.innerHTML = items.map(n => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}" id="notif-${n.id}">
            <div class="notif-dot ${n.is_read ? 'read' : ''}"></div>
            <div style="flex:1;">
                <div class="notif-title">${n.title}</div>
                <div class="notif-msg">${n.message}</div>
                <div class="notif-meta">
                    <span class="notif-module">${n.module}</span>
                    <span>${n.reference_no}</span>
                    <span>${n.created_at ? new Date(n.created_at).toLocaleString() : ''}</span>
                    ${!n.is_read ? `<a href="#" onclick="markRead('${n.id}');return false;" style="color:var(--primary);font-size:11px;">Mark read</a>` : ''}
                </div>
            </div>
        </div>`).join('');
}

async function markRead(id) {
    await fetch(API + '/notifications/' + id + '/read', { method:'PUT', headers:H() });
    loadNotifications(); refreshNotifBadge();
}

async function markAllRead() {
    await fetch(API + '/notifications/mark-all-read', { method:'PUT', headers:H(), body:'{}' });
    loadNotifications(); refreshNotifBadge();
}

async function refreshNotifBadge() {
    try {
        const r = await fetch(API + '/notifications/unread-count?role=planner', { headers: H() });
        const d = await r.json();
        const badge = document.getElementById('notif-count-badge');
        const count = d.data?.count || 0;
        if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline' : 'none'; }
    } catch(e) {}
}

// ─── PO DEMANDS ───
let poDemands = [];
async function loadPODemands() {
    const tbody = document.getElementById('po-demands-body');
    tbody.innerHTML = '<tr><td colspan="10" class="empty">Loading...</td></tr>';
    const r = await fetch(API + '/demands/from-po', { headers: H() });
    const d = await r.json();
    poDemands = d.data || [];
    const badge = document.getElementById('po-demands-badge');
    const open = poDemands.filter(x => x.status === 'open').length;
    if (badge) { badge.textContent = open; badge.style.display = open > 0 ? 'inline' : 'none'; }
    if (!poDemands.length) { tbody.innerHTML = '<tr><td colspan="10" class="empty">No PO demands yet</td></tr>'; return; }
    tbody.innerHTML = poDemands.map(d => `<tr>
        <td><strong>${d.plan_no}</strong></td>
        <td>${d.item_code}</td>
        <td>${d.item_description || '—'}</td>
        <td>${d.required_qty}</td>
        <td><strong style="color:${d.available_stock>0?'#2e7d32':'#c62828'}">${d.available_stock}</strong></td>
        <td>${d.reserved_qty}</td>
        <td><strong style="color:${d.shortage_qty>0?'#c62828':'#2e7d32'}">${d.shortage_qty}</strong></td>
        <td><small>${d.reference_no || '—'}</small></td>
        <td>${badge(d.status)}</td>
        <td style="display:flex;gap:4px">
            ${d.available_stock > 0 && d.status === 'open' ? `<button class="btn-icon" title="Book Stock" onclick="bookStock('${d.id}','${d.item_code}',${d.available_stock})"><span class="material-icons-outlined">inventory</span></button>` : ''}
            ${d.shortage_qty > 0 ? `<button class="btn-icon" title="Create PR for shortage" onclick="openCreatePRFromDemand('${d.id}','${d.plan_no}','${d.item_code}',${d.shortage_qty})"><span class="material-icons-outlined">add_shopping_cart</span></button>` : ''}
            <button class="btn-icon" title="View RM Stock" onclick="viewRMStock('${d.item_code}')"><span class="material-icons-outlined">science</span></button>
        </td>
    </tr>`).join('');
}

async function bookStock(demandId, itemCode, availableQty) {
    if (!confirm(`Book ${availableQty} units of ${itemCode} from inventory for this demand?`)) return;
    const r = await fetch(API + `/demands/${demandId}/book-stock`, {
        method: 'POST', headers: H(), body: JSON.stringify({ book_qty: availableQty })
    });
    const d = await r.json();
    if (d.success) { alert(d.message); loadPODemands(); loadOverview(); refreshNotifBadge(); }
    else alert(d.message);
}

async function viewRMStock(itemCode) {
    const r = await fetch(API + `/rm-stock?item_code=${encodeURIComponent(itemCode)}`, { headers: H() });
    const d = await r.json();
    const items = d.data || [];
    if (!items.length) { alert(`No RM mappings found for ${itemCode}`); return; }
    const lines = items.map(rm =>
        `${rm.rm_code} (${rm.rm_description}): Available ${rm.stock_available} ${rm.unit} | Required per part: ${rm.qty_required_per_part}`
    ).join('\n');
    alert(`RM Stock for ${itemCode}:\n\n${lines}`);
}


// --- CUSTOMER ORDERS & BOM ANALYSIS ---

async function loadCustomerOrders() {
    const tbody = document.getElementById('co-body');
    tbody.innerHTML = '<tr><td colspan="8" class="empty">Loading...</td></tr>';
    
    try {
        const res = await API.get('/api/v1/planning/customer-orders');
        if (!res.success) throw new Error(res.message);
        
        const pos = res.data || [];
        if (pos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty">No customer orders found.</td></tr>';
            return;
        }
        
        let html = '';
        pos.forEach(po => {
            const lines = po.lines || [];
            lines.forEach((line, idx) => {
                html += `
                <tr>
                    <td>${po.project_name || 'N/A'}</td>
                    <td>${po.customer_name || 'N/A'}</td>
                    <td>${po.po_number || 'N/A'} v${po.version || 1}</td>
                    <td>${line.part_number || 'N/A'}</td>
                    <td>${line.qty || 0}</td>
                    <td>${po.po_date || '-'}</td>
                    <td>${po.delivery_date || '-'}</td>
                    <td>
                        <button class="btn-primary btn-sm" onclick="openDecisionModal('${line.part_number}', ${line.qty}, '${po.po_number}')">
                            <span class="material-icons-outlined">account_tree</span> Plan
                        </button>
                    </td>
                </tr>
                `;
            });
        });
        
        tbody.innerHTML = html || '<tr><td colspan="8" class="empty">No line items found.</td></tr>';
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" style="color:var(--danger-color);text-align:center;">Error: ${e.message}</td></tr>`;
    }
}

let currentDecisionData = null;

async function openDecisionModal(partNumber, qty, poNumber) {
    if (!partNumber) {
        alert("No part number specified for this line.");
        return;
    }
    
    document.getElementById('decisionModal').classList.add('active');
    document.getElementById('decisionLoading').style.display = 'block';
    document.getElementById('decisionContent').style.display = 'none';
    
    currentDecisionData = { partNumber, qty, poNumber };
    
    try {
        const res = await API.get(`/api/v1/planning/bom-analysis/${encodeURIComponent(partNumber)}`);
        document.getElementById('decisionLoading').style.display = 'none';
        document.getElementById('decisionContent').style.display = 'block';
        
        document.getElementById('dec-part-number').textContent = partNumber;
        document.getElementById('dec-customer').textContent = "PO: " + poNumber;
        document.getElementById('dec-qty').textContent = qty;
        
        if (res.success && res.data) {
            currentDecisionData.bom = res.data;
            document.getElementById('dec-bom-no').textContent = res.data.bom_no;
            document.getElementById('dec-bom-yield').textContent = "Yield: " + res.data.yield_qty;
            document.getElementById('dec-rm-count').textContent = res.data.components.length;
            
            let rmHtml = '';
            res.data.components.forEach(c => {
                const reqQty = Math.ceil((qty / res.data.yield_qty) * c.qty_per);
                rmHtml += `
                <tr>
                    <td>${c.component_no}</td>
                    <td>${c.description}</td>
                    <td>${c.qty_per} ${c.unit}</td>
                    <td style="font-weight:600;color:var(--primary-color);">${reqQty} ${c.unit}</td>
                </tr>`;
            });
            document.getElementById('dec-rm-body').innerHTML = rmHtml || '<tr><td colspan="4" class="empty">No RM specified.</td></tr>';
            
        } else {
            // No BOM
            currentDecisionData.bom = null;
            document.getElementById('dec-bom-no').textContent = "No BOM Found";
            document.getElementById('dec-bom-yield').textContent = "-";
            document.getElementById('dec-rm-count').textContent = "0";
            document.getElementById('dec-rm-body').innerHTML = '<tr><td colspan="4" class="empty">No BOM found for this part. Proceed with direct buy?</td></tr>';
        }
        
    } catch (e) {
        document.getElementById('decisionLoading').innerHTML = `<div style="color:var(--danger-color)">Error analyzing BOM: ${e.message}</div>`;
    }
}

async function executeDecision(decisionType) {
    if (!currentDecisionData) return;
    
    try {
        let itemsToOrder = [];
        
        if (decisionType === 'buy') {
            itemsToOrder.push({
                item_code: currentDecisionData.partNumber,
                required_qty: currentDecisionData.qty,
                uom: "PCS",
                notes: "Direct buy from Customer PO demand."
            });
        } else if (decisionType === 'manufacture') {
            if (!currentDecisionData.bom) {
                alert("Cannot manufacture without a BOM.");
                return;
            }
            currentDecisionData.bom.components.forEach(c => {
                const reqQty = Math.ceil((currentDecisionData.qty / currentDecisionData.bom.yield_qty) * c.qty_per);
                itemsToOrder.push({
                    item_code: c.component_no,
                    required_qty: reqQty,
                    uom: c.unit,
                    notes: `RM for ${currentDecisionData.partNumber} (Manufacture)`
                });
            });
        }
        
        // Create PRs
        for (const item of itemsToOrder) {
            const prRes = await API.post('/api/v1/planning/purchase-requests', {
                item_code: item.item_code,
                required_qty: item.required_qty,
                uom: item.uom,
                notes: item.notes,
                priority: "high" // Make it high priority
            });
            if (!prRes.success) {
                console.error("Failed to create PR for", item.item_code, prRes.message);
            }
        }
        
        alert(`Successfully processed decision: ${decisionType.toUpperCase()}. PRs have been generated.`);
        closeModal('decisionModal');
        if (typeof loadPRs === 'function') loadPRs(); // refresh PR list if we are on that tab
        
    } catch(e) {
        alert("Error executing decision: " + e.message);
    }
}

// Hook into sidebar load
document.addEventListener('DOMContentLoaded', () => {
    // Override standard showSection if we need to load Customer Orders on demand
    const links = document.querySelectorAll('.sidebar-link[data-section]');
    links.forEach(l => {
        l.addEventListener('click', (e) => {
            const sec = e.currentTarget.getAttribute('data-section');
            if (sec === 'customer-orders') {
                loadCustomerOrders();
            }
        });
    });
    
    // Load if hash matches
    if (window.location.hash === '#customer-orders') {
        loadCustomerOrders();
    }
});

