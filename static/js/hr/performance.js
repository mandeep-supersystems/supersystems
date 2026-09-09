// ─── PERFORMANCE MANAGEMENT JAVASCRIPT ───
let cyclesList = [], goalsList = [], reviewsList = [], empList = [];

async function safeJson(res) {
    try { return await res.json(); } catch(e) { return { success: false, message: 'Server error (run HR migration SQL)', data: [] }; }
}

function showTab(name) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.hr-seg-btn').forEach(b => b.classList.remove('active'));
    
    const panel = document.getElementById('tab-' + name);
    if (panel) panel.classList.add('active');
    
    const btn = document.getElementById('tabBtn-' + name);
    if (btn) btn.classList.add('active');

    if (name === 'cycles') loadCycles();
    if (name === 'goals') loadGoals();
    if (name === 'reviews') loadReviews();
}

function openModal(id) { 
    const el = document.getElementById(id);
    if (el) el.classList.add('active'); 
}
function closeModal(id) { 
    const el = document.getElementById(id);
    if (el) el.classList.remove('active'); 
}

function updatePerformanceKPIs() {
    // Review cycles
    const activeCycles = cyclesList.filter(c => c.status === 'active');
    const kpiActCycEl = document.getElementById('kpiActiveCycles');
    if (kpiActCycEl) kpiActCycEl.textContent = activeCycles.length;
    const kpiTotCycEl = document.getElementById('kpiTotalCycles');
    if (kpiTotCycEl) kpiTotCycEl.textContent = `${cyclesList.length} Total configured`;

    // Goals
    const activeGoals = goalsList.filter(g => g.status === 'active');
    const completedGoals = goalsList.filter(g => g.status === 'completed');
    const kpiActGEl = document.getElementById('kpiActiveGoals');
    if (kpiActGEl) kpiActGEl.textContent = activeGoals.length;
    const kpiCompGEl = document.getElementById('kpiCompletedGoals');
    if (kpiCompGEl) kpiCompGEl.textContent = `${completedGoals.length} Goals completed`;

    // Reviews
    const submittedReviews = reviewsList.filter(r => r.status === 'submitted' || r.status === 'acknowledged');
    const pendingReviews = reviewsList.filter(r => r.status === 'pending');
    const kpiSubRevEl = document.getElementById('kpiReviewsSubmitted');
    if (kpiSubRevEl) kpiSubRevEl.textContent = submittedReviews.length;
    const kpiPendRevEl = document.getElementById('kpiPendingReviews');
    if (kpiPendRevEl) kpiPendRevEl.textContent = `${pendingReviews.length} Pending reviews`;

    // Avg rating
    const ratedReviews = reviewsList.filter(r => r.overall_rating != null && !isNaN(parseFloat(r.overall_rating)));
    const avgRating = ratedReviews.length 
        ? (ratedReviews.reduce((acc, r) => acc + parseFloat(r.overall_rating), 0) / ratedReviews.length).toFixed(1)
        : '—';
    const kpiAvgEl = document.getElementById('kpiAvgRating');
    if (kpiAvgEl) kpiAvgEl.textContent = avgRating !== '—' ? `${avgRating} ★` : '—';

    // Badge counts
    const bCyc = document.getElementById('badgeCycles');
    if (bCyc) bCyc.textContent = cyclesList.length;
    const bGoal = document.getElementById('badgeGoals');
    if (bGoal) bGoal.textContent = goalsList.length;
    const bRev = document.getElementById('badgeReviews');
    if (bRev) bRev.textContent = reviewsList.length;
}

async function loadEmp() {
    try {
        const res = await fetch(API + '/employees', { headers: headers() });
        const d = await safeJson(res);
        empList = d.data || [];
        const opts = '<option value="">Select Employee</option>' + 
            empList.map(e => `<option value="${e.id}">${e.emp_code} - ${e.first_name} ${e.last_name || ''}</option>`).join('');
        ['goalEmp', 'reviewEmp'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = opts;
        });
    } catch(e) { console.warn('loadEmp:', e.message); }
}

// ─── REVIEW CYCLES ───
async function loadCycles() {
    try {
        const res = await fetch(`${API}/review-cycles`, { headers: headers() });
        const d = await safeJson(res);
        cyclesList = d.data || [];
        updatePerformanceKPIs();
        renderCycles(cyclesList);
    } catch(e) {
        const t = document.getElementById('cyclesBody');
        if (t) t.innerHTML = '<tr><td colspan="6" class="empty">Failed to load review cycles.</td></tr>';
    }
}

function filterCycles() {
    const q = (document.getElementById('cycleSearchInput')?.value || '').toLowerCase().trim();
    const filtered = cyclesList.filter(c => !q || (c.name && c.name.toLowerCase().includes(q)));
    renderCycles(filtered);
}

function renderCycles(list) {
    const tbody = document.getElementById('cyclesBody');
    if (!tbody) return;
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">No review cycles configured</td></tr>';
        return;
    }

    const statusPill = (st) => st === 'active' 
        ? '<span class="hr-pill success">Active</span>' 
        : '<span class="hr-pill neutral">Closed</span>';

    tbody.innerHTML = list.map(c => `<tr>
        <td><strong>${c.name}</strong></td>
        <td style="text-transform:capitalize">${(c.cycle_type || 'annual').replace('_', ' ')}</td>
        <td>${c.start_date ? c.start_date.substring(0, 10) : '—'}</td>
        <td>${c.end_date ? c.end_date.substring(0, 10) : '—'}</td>
        <td>${statusPill(c.status)}</td>
        <td style="text-align:right">
            <button class="btn-icon" title="Edit Cycle" onclick="editCycle('${c.id}')"><span class="material-icons-outlined">edit</span></button>
        </td>
    </tr>`).join('');
}

function openCycleModal() {
    document.getElementById('cycleId').value = '';
    document.getElementById('cycleModalTitle').textContent = 'New Review Cycle';
    document.getElementById('cycleName').value = '';
    document.getElementById('cycleSD').value = '';
    document.getElementById('cycleED').value = '';
    document.getElementById('cycleStatus').value = 'active';
    openModal('cycleModal');
}

function editCycle(id) {
    const c = cyclesList.find(x => x.id === id);
    if (!c) return;
    document.getElementById('cycleId').value = c.id;
    document.getElementById('cycleModalTitle').textContent = 'Edit Cycle';
    document.getElementById('cycleName').value = c.name || '';
    document.getElementById('cycleType').value = c.cycle_type || 'annual';
    document.getElementById('cycleStatus').value = c.status || 'active';
    document.getElementById('cycleSD').value = c.start_date ? c.start_date.substring(0, 10) : '';
    document.getElementById('cycleED').value = c.end_date ? c.end_date.substring(0, 10) : '';
    openModal('cycleModal');
}

async function saveCycle() {
    const id = document.getElementById('cycleId').value;
    const body = {
        name: document.getElementById('cycleName').value.trim(),
        cycle_type: document.getElementById('cycleType').value,
        status: document.getElementById('cycleStatus').value,
        start_date: document.getElementById('cycleSD').value || null,
        end_date: document.getElementById('cycleED').value || null
    };
    if (!body.name) { alert('Name is required'); return; }
    try {
        const url = id ? `${API}/review-cycles/${id}` : `${API}/review-cycles`;
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) });
        const d = await safeJson(res);
        if (d.success) { 
            closeModal('cycleModal'); 
            loadCycles(); 
        } else alert(d.message);
    } catch(e) { alert('Error: ' + e.message); }
}

// ─── GOALS ───
async function loadGoals() {
    try {
        const res = await fetch(`${API}/performance-goals`, { headers: headers() });
        const d = await safeJson(res);
        goalsList = d.data || [];
        updatePerformanceKPIs();
        renderGoals(goalsList);
    } catch(e) {
        const t = document.getElementById('goalsBody');
        if (t) t.innerHTML = '<tr><td colspan="8" class="empty">Failed to load performance goals.</td></tr>';
    }
}

function filterGoals() {
    const q = (document.getElementById('goalSearchInput')?.value || '').toLowerCase().trim();
    const st = document.getElementById('goalStatusFilter')?.value || '';
    const filtered = goalsList.filter(g => {
        const empStr = `${g.emp_code || ''} ${g.employee_name || ''}`.toLowerCase();
        const matchesQ = !q || empStr.includes(q) || (g.title && g.title.toLowerCase().includes(q));
        const matchesSt = !st || g.status === st;
        return matchesQ && matchesSt;
    });
    renderGoals(filtered);
}

function renderGoals(list) {
    const tbody = document.getElementById('goalsBody');
    if (!tbody) return;
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">No goals or OKRs recorded</td></tr>';
        return;
    }

    const statusPill = (st) => {
        if (st === 'completed') return '<span class="hr-pill success">Completed</span>';
        if (st === 'cancelled') return '<span class="hr-pill neutral">Cancelled</span>';
        return '<span class="hr-pill info">Active</span>';
    };

    tbody.innerHTML = list.map(g => `<tr>
        <td>
            <strong>${g.emp_code || ''}</strong>
            <div>${g.employee_name || '—'}</div>
        </td>
        <td><strong>${g.title}</strong></td>
        <td style="text-transform:uppercase"><span class="hr-pill neutral">${g.goal_type || 'OKR'}</span></td>
        <td>${g.target_value || '—'}</td>
        <td><strong>${g.actual_value || '—'}</strong></td>
        <td>${g.weight ? g.weight + '%' : '—'}</td>
        <td>${statusPill(g.status)}</td>
        <td style="text-align:right">
            <div style="display:inline-flex;gap:4px">
                <button class="btn-icon" title="Edit Goal" onclick="editGoal('${g.id}')"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-icon danger" title="Delete Goal" onclick="deleteGoal('${g.id}')"><span class="material-icons-outlined">delete</span></button>
            </div>
        </td>
    </tr>`).join('');
}

function openGoalModal() {
    document.getElementById('goalId').value = '';
    document.getElementById('goalModalTitle').textContent = 'Add Goal';
    ['goalTitle','goalTarget','goalActual','goalSD','goalED'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('goalWeight').value = 25;
    document.getElementById('goalStatus').value = 'active';
    openModal('goalModal');
}

function editGoal(id) {
    const g = goalsList.find(x => x.id === id);
    if (!g) return;
    document.getElementById('goalId').value = g.id;
    document.getElementById('goalModalTitle').textContent = 'Edit Goal';
    document.getElementById('goalEmp').value = g.employee_id || '';
    document.getElementById('goalTitle').value = g.title || '';
    document.getElementById('goalType').value = g.goal_type || 'kra';
    document.getElementById('goalWeight').value = g.weight || 0;
    document.getElementById('goalTarget').value = g.target_value || '';
    document.getElementById('goalActual').value = g.actual_value || '';
    document.getElementById('goalSD').value = g.start_date ? g.start_date.substring(0, 10) : '';
    document.getElementById('goalED').value = g.end_date ? g.end_date.substring(0, 10) : '';
    document.getElementById('goalStatus').value = g.status || 'active';
    openModal('goalModal');
}

async function saveGoal() {
    const id = document.getElementById('goalId').value;
    const body = {
        employee_id: document.getElementById('goalEmp').value,
        title: document.getElementById('goalTitle').value.trim(),
        goal_type: document.getElementById('goalType').value,
        weight: parseFloat(document.getElementById('goalWeight').value) || 0,
        target_value: document.getElementById('goalTarget').value.trim(),
        actual_value: document.getElementById('goalActual').value.trim(),
        start_date: document.getElementById('goalSD').value || null,
        end_date: document.getElementById('goalED').value || null,
        status: document.getElementById('goalStatus').value
    };
    if (!body.employee_id || !body.title) { alert('Employee and title are required'); return; }
    try {
        const url = id ? `${API}/performance-goals/${id}` : `${API}/performance-goals`;
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) });
        const d = await safeJson(res);
        if (d.success) { 
            closeModal('goalModal'); 
            loadGoals(); 
        } else alert(d.message);
    } catch(e) { alert('Error: ' + e.message); }
}

async function deleteGoal(id) {
    if (!confirm('Delete this performance goal?')) return;
    try {
        const res = await fetch(`${API}/performance-goals/${id}`, { method: 'DELETE', headers: headers() });
        const d = await safeJson(res);
        if (d.success) loadGoals(); else alert(d.message);
    } catch(e) { alert('Error: ' + e.message); }
}

// ─── REVIEWS ───
async function loadReviews() {
    try {
        const res = await fetch(`${API}/performance-reviews`, { headers: headers() });
        const d = await safeJson(res);
        reviewsList = d.data || [];
        updatePerformanceKPIs();
        renderReviews(reviewsList);
    } catch(e) {
        const t = document.getElementById('reviewsBody');
        if (t) t.innerHTML = '<tr><td colspan="7" class="empty">Failed to load performance reviews.</td></tr>';
    }
}

function filterReviews() {
    const q = (document.getElementById('reviewSearchInput')?.value || '').toLowerCase().trim();
    const st = document.getElementById('reviewStatusFilter')?.value || '';
    const filtered = reviewsList.filter(r => {
        const empStr = `${r.emp_code || ''} ${r.employee_name || ''}`.toLowerCase();
        const matchesQ = !q || empStr.includes(q) || (r.feedback && r.feedback.toLowerCase().includes(q));
        const matchesSt = !st || r.status === st;
        return matchesQ && matchesSt;
    });
    renderReviews(filtered);
}

function renderReviews(list) {
    const tbody = document.getElementById('reviewsBody');
    if (!tbody) return;
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">No performance reviews recorded</td></tr>';
        return;
    }

    const statusPill = (st) => {
        if (st === 'acknowledged') return '<span class="hr-pill success">Acknowledged</span>';
        if (st === 'submitted') return '<span class="hr-pill info">Submitted</span>';
        return '<span class="hr-pill warning">Pending</span>';
    };

    const ratingBadge = (val) => {
        if (val == null || isNaN(val)) return '—';
        return `<span style="font-weight:600;color:#f59e0b">★ ${parseFloat(val).toFixed(1)}</span>`;
    };

    tbody.innerHTML = list.map(r => `<tr>
        <td>
            <strong>${r.emp_code || ''}</strong>
            <div>${r.employee_name || '—'}</div>
        </td>
        <td style="text-transform:capitalize">${(r.review_type || 'manager').replace('_', ' ')}</td>
        <td>${ratingBadge(r.self_rating)}</td>
        <td>${ratingBadge(r.manager_rating)}</td>
        <td>${ratingBadge(r.overall_rating)}</td>
        <td>${statusPill(r.status)}</td>
        <td style="text-align:right">
            <button class="btn-icon" title="Edit Review" onclick="editReview('${r.id}')"><span class="material-icons-outlined">edit</span></button>
        </td>
    </tr>`).join('');
}

function openReviewModal() {
    document.getElementById('reviewId').value = '';
    ['reviewFeedback','reviewStrengths','reviewImprove'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['reviewOverall','reviewSelf','reviewMgr'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('reviewStatus').value = 'pending';
    openModal('reviewModal');
}

function editReview(id) {
    const r = reviewsList.find(x => x.id === id);
    if (!r) return;
    document.getElementById('reviewId').value = r.id;
    document.getElementById('reviewEmp').value = r.employee_id || '';
    document.getElementById('reviewType').value = r.review_type || 'manager';
    document.getElementById('reviewOverall').value = r.overall_rating || '';
    document.getElementById('reviewSelf').value = r.self_rating || '';
    document.getElementById('reviewMgr').value = r.manager_rating || '';
    document.getElementById('reviewFeedback').value = r.feedback || '';
    document.getElementById('reviewStrengths').value = r.strengths || '';
    document.getElementById('reviewImprove').value = r.improvements || '';
    document.getElementById('reviewStatus').value = r.status || 'pending';
    openModal('reviewModal');
}

async function saveReview() {
    const id = document.getElementById('reviewId').value;
    const body = {
        employee_id: document.getElementById('reviewEmp').value,
        review_type: document.getElementById('reviewType').value,
        overall_rating: parseFloat(document.getElementById('reviewOverall').value) || null,
        self_rating: parseFloat(document.getElementById('reviewSelf').value) || null,
        manager_rating: parseFloat(document.getElementById('reviewMgr').value) || null,
        feedback: document.getElementById('reviewFeedback').value.trim(),
        strengths: document.getElementById('reviewStrengths').value.trim(),
        improvements: document.getElementById('reviewImprove').value.trim(),
        status: document.getElementById('reviewStatus').value
    };
    if (!body.employee_id) { alert('Please select an employee'); return; }
    try {
        const url = id ? `${API}/performance-reviews/${id}` : `${API}/performance-reviews`;
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) });
        const d = await safeJson(res);
        if (d.success) { 
            closeModal('reviewModal'); 
            loadReviews(); 
        } else alert(d.message);
    } catch(e) { alert('Error: ' + e.message); }
}

async function loadAllPerformanceData() {
    await Promise.all([loadEmp(), loadCycles(), loadGoals(), loadReviews()]);
}

document.addEventListener('DOMContentLoaded', () => {
    loadAllPerformanceData();
});
