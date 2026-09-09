// ─── HR APPROVALS JS ───
let leavesList = [];
let reviewsList = [];
let _rejectLeaveId = null;
let _approveReviewId = null;
let _rejectReviewId = null;

function switchApvTab(tab) {
    document.querySelectorAll('.apv-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.apv-tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
    document.getElementById('panel-' + tab).classList.add('active');
}

async function loadSummary() {
    try {
        const res = await fetch(API + '/approvals/summary', { headers: headers() });
        const d = await res.json();
        if (d.success) {
            const data = d.data;
            document.getElementById('kpiPendingLeaves').textContent = data.pending_leaves ?? 0;
            document.getElementById('kpiPendingReviews').textContent = data.pending_reviews ?? 0;
            document.getElementById('kpiApprovedToday').textContent = data.approved_today ?? 0;
            // Sidebar badge
            const total = (data.pending_leaves || 0) + (data.pending_reviews || 0);
            const badge = document.getElementById('sidebarPendingBadge');
            if (badge) {
                badge.textContent = total;
                badge.style.display = total > 0 ? 'inline-block' : 'none';
                badge.className = total > 0 ? 'apv-badge' : 'apv-badge empty';
            }
            // Tab badges
            const lb = document.getElementById('leaveBadge');
            if (lb) { lb.textContent = data.pending_leaves || 0; lb.className = data.pending_leaves > 0 ? 'apv-badge' : 'apv-badge empty'; }
            const rb = document.getElementById('reviewBadge');
            if (rb) { rb.textContent = data.pending_reviews || 0; rb.className = data.pending_reviews > 0 ? 'apv-badge' : 'apv-badge empty'; }
        }
    } catch(e) { console.warn('Summary load failed:', e); }
}

async function loadLeaves() {
    const statusEl = document.getElementById('leaveStatusFilter');
    const status = statusEl ? statusEl.value : 'pending';
    try {
        const res = await fetch(`${API}/approvals/leaves?status=${encodeURIComponent(status)}`, { headers: headers() });
        const d = await res.json();
        leavesList = d.data || [];
        renderLeaves(leavesList);
    } catch(e) {
        const b = document.getElementById('leavesBody');
        if (b) b.innerHTML = '<tr><td colspan="9" class="empty">Failed to load leave requests</td></tr>';
    }
}

async function loadReviews() {
    const statusEl = document.getElementById('reviewStatusFilter');
    const status = statusEl ? statusEl.value : 'pending';
    try {
        const res = await fetch(`${API}/approvals/reviews?status=${encodeURIComponent(status)}`, { headers: headers() });
        const d = await res.json();
        reviewsList = d.data || [];
        renderReviews(reviewsList);
    } catch(e) {
        const b = document.getElementById('reviewsBody');
        if (b) b.innerHTML = '<tr><td colspan="8" class="empty">Failed to load performance reviews</td></tr>';
    }
}

async function loadAll() {
    await Promise.all([loadSummary(), loadLeaves(), loadReviews()]);
}

function statusPill(status) {
    if (status === 'pending') return '<span class="hr-pill warning">Pending</span>';
    if (status === 'approved') return '<span class="hr-pill success">Approved</span>';
    if (status === 'rejected') return '<span class="hr-pill danger">Rejected</span>';
    if (status === 'cancelled') return '<span class="hr-pill neutral">Cancelled</span>';
    return `<span class="hr-pill neutral">${status || '—'}</span>`;
}

function ratingStars(val) {
    if (val === null || val === undefined) return '<span style="color:var(--text-secondary)">—</span>';
    const full = Math.round(val);
    return `<span class="rating-stars">${'★'.repeat(full)}${'☆'.repeat(Math.max(0,5-full))}</span> <span style="font-size:12px;color:var(--text-secondary)">${Number(val).toFixed(1)}</span>`;
}

function renderLeaves(list) {
    const tbody = document.getElementById('leavesBody');
    if (!tbody) return;
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty">No leave requests found for this status</td></tr>';
        return;
    }
    tbody.innerHTML = list.map(r => {
        const isPending = r.status === 'pending';
        const actionBtns = isPending
            ? `<div class="apv-action-btns">
                <button class="btn-approve" onclick="approveLeave('${r.id}','${r.employee_name}')">
                    <span class="material-icons-outlined" style="font-size:14px;vertical-align:middle">check</span> Approve
                </button>
                <button class="btn-reject" onclick="openRejectLeave('${r.id}','${r.employee_name}')">
                    <span class="material-icons-outlined" style="font-size:14px;vertical-align:middle">close</span> Reject
                </button>
               </div>`
            : `<span style="font-size:12px;color:var(--text-secondary)">${r.approved_by ? 'by ' + r.approved_by : '—'}</span>`;
        const submittedDate = r.created_at ? r.created_at.substring(0, 10) : '—';
        return `<tr>
            <td>
                <div style="font-weight:600">${r.employee_name}</div>
                <div style="font-size:11px;color:var(--text-secondary)">${r.emp_code}${r.designation ? ' · ' + r.designation : ''}</div>
            </td>
            <td><span class="hr-pill neutral">${r.leave_type || '—'}</span></td>
            <td>${r.start_date ? r.start_date.substring(0,10) : '—'}</td>
            <td>${r.end_date ? r.end_date.substring(0,10) : '—'}</td>
            <td><strong>${r.days}</strong></td>
            <td style="max-width:160px;font-size:12px;color:var(--text-secondary)">${r.reason ? r.reason.substring(0,80) : '—'}</td>
            <td>${statusPill(r.status)}${r.rejection_reason ? `<div style="font-size:11px;color:#e53935;margin-top:2px">${r.rejection_reason}</div>` : ''}</td>
            <td style="font-size:12px;color:var(--text-secondary)">${submittedDate}</td>
            <td style="text-align:right">${actionBtns}</td>
        </tr>`;
    }).join('');
}

function renderReviews(list) {
    const tbody = document.getElementById('reviewsBody');
    if (!tbody) return;
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">No performance reviews found for this status</td></tr>';
        return;
    }
    tbody.innerHTML = list.map(r => {
        const isPending = r.status === 'pending';
        const actionBtns = isPending
            ? `<div class="apv-action-btns">
                <button class="btn-approve" onclick="openApproveReview('${r.id}','${r.employee_name}')">
                    <span class="material-icons-outlined" style="font-size:14px;vertical-align:middle">check</span> Approve
                </button>
                <button class="btn-reject" onclick="openRejectReview('${r.id}','${r.employee_name}')">
                    <span class="material-icons-outlined" style="font-size:14px;vertical-align:middle">close</span> Reject
                </button>
               </div>`
            : `<span style="font-size:12px;color:var(--text-secondary)">${r.reviewer_id || '—'}</span>`;
        const typeMap = { manager: 'Manager Review', self: 'Self Review', peer: 'Peer Review', annual: 'Annual', quarterly: 'Quarterly' };
        const submittedDate = r.submitted_at ? r.submitted_at.substring(0, 10) : (r.created_at ? r.created_at.substring(0, 10) : '—');
        return `<tr>
            <td>
                <div style="font-weight:600">${r.employee_name}</div>
                <div style="font-size:11px;color:var(--text-secondary)">${r.emp_code}${r.designation ? ' · ' + r.designation : ''}</div>
            </td>
            <td>${typeMap[r.review_type] || r.review_type || '—'}</td>
            <td>${ratingStars(r.self_rating)}</td>
            <td>${ratingStars(r.manager_rating)}</td>
            <td>${ratingStars(r.overall_rating)}</td>
            <td>${statusPill(r.status)}</td>
            <td style="font-size:12px;color:var(--text-secondary)">${submittedDate}</td>
            <td style="text-align:right">${actionBtns}</td>
        </tr>`;
    }).join('');
}

function filterLeaves() {
    const q = (document.getElementById('leaveSearch')?.value || '').toLowerCase().trim();
    const filtered = q
        ? leavesList.filter(r =>
            (r.employee_name || '').toLowerCase().includes(q) ||
            (r.emp_code || '').toLowerCase().includes(q) ||
            (r.leave_type || '').toLowerCase().includes(q) ||
            (r.reason || '').toLowerCase().includes(q))
        : leavesList;
    renderLeaves(filtered);
}

function filterReviews() {
    const q = (document.getElementById('reviewSearch')?.value || '').toLowerCase().trim();
    const filtered = q
        ? reviewsList.filter(r =>
            (r.employee_name || '').toLowerCase().includes(q) ||
            (r.emp_code || '').toLowerCase().includes(q) ||
            (r.review_type || '').toLowerCase().includes(q))
        : reviewsList;
    renderReviews(filtered);
}

// ── LEAVE ACTIONS ──
async function approveLeave(id, empName) {
    if (!confirm(`Approve leave for ${empName}?`)) return;
    try {
        const res = await fetch(`${API}/approvals/leaves/${id}/approve`, { method: 'POST', headers: headers() });
        const d = await res.json();
        if (d.success) { showToast('Leave approved successfully', 'success'); loadAll(); }
        else { showToast(d.message || 'Failed to approve', 'error'); }
    } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

function openRejectLeave(id, empName) {
    _rejectLeaveId = id;
    document.getElementById('rejectLeaveMsg').textContent = `Rejecting leave request for: ${empName}`;
    document.getElementById('rejectLeaveReason').value = '';
    openModal('rejectLeaveModal');
}

async function confirmRejectLeave() {
    const reason = document.getElementById('rejectLeaveReason').value.trim();
    if (!reason) { alert('Please provide a rejection reason'); return; }
    try {
        const res = await fetch(`${API}/approvals/leaves/${_rejectLeaveId}/reject`, {
            method: 'POST', headers: headers(), body: JSON.stringify({ reason })
        });
        const d = await res.json();
        if (d.success) { closeModal('rejectLeaveModal'); showToast('Leave rejected', 'error'); loadAll(); }
        else { showToast(d.message || 'Failed to reject', 'error'); }
    } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

// ── REVIEW ACTIONS ──
function openApproveReview(id, empName) {
    _approveReviewId = id;
    document.getElementById('approveReviewMsg').textContent = `Approving review for: ${empName}`;
    document.getElementById('reviewMgrRating').value = '';
    document.getElementById('reviewOverallRating').value = '';
    document.getElementById('reviewFeedback').value = '';
    openModal('approveReviewModal');
}

async function confirmApproveReview() {
    const mgr = document.getElementById('reviewMgrRating').value;
    const overall = document.getElementById('reviewOverallRating').value;
    const feedback = document.getElementById('reviewFeedback').value.trim();
    try {
        const res = await fetch(`${API}/approvals/reviews/${_approveReviewId}/approve`, {
            method: 'POST', headers: headers(),
            body: JSON.stringify({ manager_rating: mgr ? parseFloat(mgr) : null, overall_rating: overall ? parseFloat(overall) : null, feedback })
        });
        const d = await res.json();
        if (d.success) { closeModal('approveReviewModal'); showToast('Review approved', 'success'); loadAll(); }
        else { showToast(d.message || 'Failed', 'error'); }
    } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

function openRejectReview(id, empName) {
    _rejectReviewId = id;
    document.getElementById('rejectReviewMsg').textContent = `Rejecting review for: ${empName}`;
    document.getElementById('rejectReviewReason').value = '';
    openModal('rejectReviewModal');
}

async function confirmRejectReview() {
    const reason = document.getElementById('rejectReviewReason').value.trim();
    if (!reason) { alert('Please provide a rejection reason'); return; }
    try {
        const res = await fetch(`${API}/approvals/reviews/${_rejectReviewId}/reject`, {
            method: 'POST', headers: headers(), body: JSON.stringify({ reason })
        });
        const d = await res.json();
        if (d.success) { closeModal('rejectReviewModal'); showToast('Review rejected', 'error'); loadAll(); }
        else { showToast(d.message || 'Failed', 'error'); }
    } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

// Reload on filter change
document.addEventListener('DOMContentLoaded', () => {
    loadAll();
    document.getElementById('leaveStatusFilter')?.addEventListener('change', loadLeaves);
    document.getElementById('reviewStatusFilter')?.addEventListener('change', loadReviews);
});

function showToast(msg, type) {
    const existing = document.getElementById('apvToast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.id = 'apvToast';
    t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600;color:#fff;box-shadow:0 4px 16px rgba(0,0,0,.2);background:${type==='success'?'#2e7d32':'#c62828'};animation:slideUp .3s ease`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}
