// ─── ONBOARDING & EXIT JAVASCRIPT ───
let empList = [], tasksList = [], exitList = [];

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

    if (name === 'tasks') loadTasks();
    if (name === 'exit') loadExit();
}

function openModal(id) { 
    const el = document.getElementById(id);
    if (el) el.classList.add('active'); 
}
function closeModal(id) { 
    const el = document.getElementById(id);
    if (el) el.classList.remove('active'); 
}

function updateOnboardingKPIs() {
    // Total & Completed Tasks
    const completedTasks = tasksList.filter(t => t.status === 'completed');
    const pendingTasks = tasksList.filter(t => t.status === 'pending' || t.status === 'in_progress');
    
    const kpiTotEl = document.getElementById('kpiTotalTasks');
    if (kpiTotEl) kpiTotEl.textContent = tasksList.length;
    const kpiCompEl = document.getElementById('kpiCompletedTasks');
    if (kpiCompEl) kpiCompEl.textContent = `${completedTasks.length} Completed`;

    const kpiPendEl = document.getElementById('kpiPendingTasks');
    if (kpiPendEl) kpiPendEl.textContent = pendingTasks.length;

    // Overdue tasks
    const todayStr = new Date().toISOString().substring(0, 10);
    const overdueCount = pendingTasks.filter(t => t.due_date && t.due_date < todayStr).length;
    const kpiOverEl = document.getElementById('kpiOverdueTasks');
    if (kpiOverEl) kpiOverEl.textContent = `${overdueCount} Overdue`;

    // Exit stats
    const activeExits = exitList.filter(e => e.status !== 'completed');
    const completedExits = exitList.filter(e => e.status === 'completed');
    const pendingInterview = exitList.filter(e => !e.exit_interview_done);

    const kpiActExEl = document.getElementById('kpiActiveExits');
    if (kpiActExEl) kpiActExEl.textContent = activeExits.length;
    const kpiIntPendEl = document.getElementById('kpiExitInterviewPending');
    if (kpiIntPendEl) kpiIntPendEl.textContent = `${pendingInterview.length} interviews pending`;

    const kpiCompExEl = document.getElementById('kpiCompletedExits');
    if (kpiCompExEl) kpiCompExEl.textContent = completedExits.length;

    // Segmented badges
    const bTasks = document.getElementById('badgeTasks');
    if (bTasks) bTasks.textContent = tasksList.length;
    const bExits = document.getElementById('badgeExits');
    if (bExits) bExits.textContent = exitList.length;
}

async function loadEmp() {
    try {
        const res = await fetch(API + '/employees', { headers: headers() });
        const data = await safeJson(res);
        empList = data.data || [];
        const opts = '<option value="">Select Employee</option>' + 
            empList.map(e => `<option value="${e.id}">${e.emp_code} - ${e.first_name} ${e.last_name || ''}</option>`).join('');
        ['taskEmp', 'exitEmp'].forEach(id => { 
            const el = document.getElementById(id); 
            if (el) el.innerHTML = opts; 
        });
    } catch(e) { console.warn('loadEmp:', e.message); }
}

// ─── ONBOARDING TASKS ───
async function loadTasks() {
    const phase = document.getElementById('taskPhaseFilter')?.value || '';
    const url = `${API}/onboarding-tasks${phase ? '?phase=' + phase : ''}`;
    try {
        const res = await fetch(url, { headers: headers() });
        const data = await safeJson(res);
        tasksList = data.data || [];
        updateOnboardingKPIs();
        renderTasks(tasksList);
    } catch(e) { 
        const t = document.getElementById('tasksBody'); 
        if(t) t.innerHTML = '<tr><td colspan="8" class="empty">Failed to load onboarding tasks.</td></tr>'; 
    }
}

function filterTasks() {
    const q = (document.getElementById('taskSearchInput')?.value || '').toLowerCase().trim();
    const st = document.getElementById('taskStatusFilter')?.value || '';
    const filtered = tasksList.filter(t => {
        const empStr = `${t.emp_code || ''} ${t.employee_name || ''}`.toLowerCase();
        const matchesQ = !q || empStr.includes(q) || (t.task_name && t.task_name.toLowerCase().includes(q));
        const matchesSt = !st || t.status === st;
        return matchesQ && matchesSt;
    });
    renderTasks(filtered);
}

function renderTasks(list) {
    const tbody = document.getElementById('tasksBody');
    if (!tbody) return;
    if (!list.length) { 
        tbody.innerHTML = '<tr><td colspan="8" class="empty">No matching onboarding tasks</td></tr>'; 
        return; 
    }

    const phasePill = (ph) => {
        if (ph === 'pre_boarding') return '<span class="hr-pill neutral">Pre-Boarding</span>';
        if (ph === 'day1') return '<span class="hr-pill info">Day 1</span>';
        if (ph === 'week1') return '<span class="hr-pill warning">Week 1</span>';
        if (ph === 'month1') return '<span class="hr-pill success">Month 1</span>';
        return `<span class="hr-pill neutral">${ph || 'Standard'}</span>`;
    };

    const statusPill = (st) => {
        if (st === 'completed') return '<span class="hr-pill success">Completed</span>';
        if (st === 'in_progress') return '<span class="hr-pill warning">In Progress</span>';
        if (st === 'skipped') return '<span class="hr-pill neutral">Skipped</span>';
        return '<span class="hr-pill danger">Pending</span>';
    };

    tbody.innerHTML = list.map(t => `<tr>
        <td>
            <strong>${t.emp_code || ''}</strong> 
            <div>${t.employee_name || '—'}</div>
        </td>
        <td><strong>${t.task_name}</strong></td>
        <td style="text-transform:capitalize">${(t.task_category || 'general').replace('_', ' ')}</td>
        <td>${phasePill(t.phase)}</td>
        <td>${t.due_date ? t.due_date.substring(0, 10) : '—'}</td>
        <td>${t.assigned_to || '—'}</td>
        <td>${statusPill(t.status)}</td>
        <td style="text-align:right">
            <div style="display:inline-flex;gap:4px">
                <button class="btn-icon" title="Edit Task" onclick="editTask('${t.id}')"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-icon danger" title="Delete Task" onclick="deleteTask('${t.id}')"><span class="material-icons-outlined">delete</span></button>
            </div>
        </td>
    </tr>`).join('');
}

function openTaskModal() {
    document.getElementById('taskId').value = '';
    document.getElementById('taskModalTitle').textContent = 'Add Onboarding Task';
    ['taskName','taskAssigned','taskNotes','taskDue'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('taskStatus').value = 'pending';
    openModal('taskModal');
}

function editTask(id) {
    const t = tasksList.find(x => x.id === id);
    if (!t) return;
    document.getElementById('taskId').value = t.id;
    document.getElementById('taskModalTitle').textContent = 'Edit Task';
    document.getElementById('taskEmp').value = t.employee_id || '';
    document.getElementById('taskName').value = t.task_name || '';
    document.getElementById('taskCat').value = t.task_category || 'documents';
    document.getElementById('taskPhase').value = t.phase || 'day1';
    document.getElementById('taskDue').value = t.due_date ? t.due_date.substring(0, 10) : '';
    document.getElementById('taskAssigned').value = t.assigned_to || '';
    document.getElementById('taskStatus').value = t.status || 'pending';
    document.getElementById('taskNotes').value = t.notes || '';
    openModal('taskModal');
}

async function saveTask() {
    const id = document.getElementById('taskId').value;
    const body = {
        employee_id: document.getElementById('taskEmp').value,
        task_name: document.getElementById('taskName').value.trim(),
        task_category: document.getElementById('taskCat').value,
        phase: document.getElementById('taskPhase').value,
        due_date: document.getElementById('taskDue').value || null,
        assigned_to: document.getElementById('taskAssigned').value.trim(),
        status: document.getElementById('taskStatus').value,
        notes: document.getElementById('taskNotes').value.trim()
    };
    if (!body.employee_id || !body.task_name) { alert('Employee and task name are required'); return; }
    try {
        const url = id ? `${API}/onboarding-tasks/${id}` : `${API}/onboarding-tasks`;
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) });
        const data = await safeJson(res);
        if (data.success) { 
            closeModal('taskModal'); 
            loadTasks(); 
        } else { 
            alert(data.message); 
        }
    } catch(e) { alert('Error: ' + e.message); }
}

async function deleteTask(id) {
    if (!confirm('Delete this onboarding task?')) return;
    try {
        const res = await fetch(`${API}/onboarding-tasks/${id}`, { method: 'DELETE', headers: headers() });
        const data = await safeJson(res);
        if (data.success) loadTasks(); else alert(data.message);
    } catch(e) { alert('Error: ' + e.message); }
}

// ─── EXIT REQUESTS ───
async function loadExit() {
    try {
        const res = await fetch(`${API}/exit-requests`, { headers: headers() });
        const data = await safeJson(res);
        exitList = data.data || [];
        updateOnboardingKPIs();
        renderExit(exitList);
    } catch(e) { 
        const t = document.getElementById('exitBody'); 
        if(t) t.innerHTML = '<tr><td colspan="7" class="empty">Failed to load exit requests.</td></tr>'; 
    }
}

function filterExit() {
    const q = (document.getElementById('exitSearchInput')?.value || '').toLowerCase().trim();
    const st = document.getElementById('exitStatusFilter')?.value || '';
    const filtered = exitList.filter(e => {
        const empStr = `${e.emp_code || ''} ${e.employee_name || ''}`.toLowerCase();
        const matchesQ = !q || empStr.includes(q) || (e.reason && e.reason.toLowerCase().includes(q));
        const matchesSt = !st || e.status === st;
        return matchesQ && matchesSt;
    });
    renderExit(filtered);
}

function renderExit(list) {
    const tbody = document.getElementById('exitBody');
    if (!tbody) return;
    if (!list.length) { 
        tbody.innerHTML = '<tr><td colspan="7" class="empty">No exit requests recorded</td></tr>'; 
        return; 
    }

    const statusPill = (st) => {
        if (st === 'completed') return '<span class="hr-pill success">Completed</span>';
        if (st === 'in_progress') return '<span class="hr-pill warning">In Progress</span>';
        return '<span class="hr-pill danger">Initiated</span>';
    };

    tbody.innerHTML = list.map(e => `<tr>
        <td>
            <strong>${e.emp_code || ''}</strong> 
            <div>${e.employee_name || '—'}</div>
        </td>
        <td>${e.resignation_date ? e.resignation_date.substring(0, 10) : '—'}</td>
        <td><strong>${e.last_working_date ? e.last_working_date.substring(0, 10) : '—'}</strong></td>
        <td style="text-transform:capitalize">${(e.reason || 'resignation').replace('_', ' ')}</td>
        <td>${statusPill(e.status)}</td>
        <td>${e.exit_interview_done ? '<span class="hr-pill success">Conducted</span>' : '<span class="hr-pill warning">Pending</span>'}</td>
        <td style="text-align:right">
            <button class="btn-icon" title="Update Exit" onclick="editExit('${e.id}')"><span class="material-icons-outlined">edit</span></button>
        </td>
    </tr>`).join('');
}

function openExitModal() {
    document.getElementById('exitId').value = '';
    document.getElementById('exitModalTitle').textContent = 'Initiate Exit';
    ['exitRes','exitLWD','exitNotes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('exitStatus').value = 'initiated';
    document.getElementById('exitIntDone').value = 'false';
    openModal('exitModal');
}

function editExit(id) {
    const e = exitList.find(x => x.id === id);
    if (!e) return;
    document.getElementById('exitId').value = e.id;
    document.getElementById('exitModalTitle').textContent = 'Update Exit Record';
    document.getElementById('exitEmp').value = e.employee_id || '';
    document.getElementById('exitRes').value = e.resignation_date ? e.resignation_date.substring(0, 10) : '';
    document.getElementById('exitLWD').value = e.last_working_date ? e.last_working_date.substring(0, 10) : '';
    document.getElementById('exitReason').value = e.reason || 'resignation';
    document.getElementById('exitStatus').value = e.status || 'initiated';
    document.getElementById('exitIntDone').value = String(e.exit_interview_done);
    document.getElementById('exitNotes').value = e.exit_interview_notes || '';
    openModal('exitModal');
}

async function saveExit() {
    const id = document.getElementById('exitId').value;
    const body = {
        employee_id: document.getElementById('exitEmp').value,
        resignation_date: document.getElementById('exitRes').value || null,
        last_working_date: document.getElementById('exitLWD').value || null,
        reason: document.getElementById('exitReason').value,
        status: document.getElementById('exitStatus').value,
        exit_interview_done: document.getElementById('exitIntDone').value === 'true',
        exit_interview_notes: document.getElementById('exitNotes').value.trim()
    };
    if (!body.employee_id) { alert('Please select an employee'); return; }
    try {
        const url = id ? `${API}/exit-requests/${id}` : `${API}/exit-requests`;
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) });
        const data = await safeJson(res);
        if (data.success) { 
            closeModal('exitModal'); 
            loadExit(); 
        } else { 
            alert(data.message); 
        }
    } catch(e) { alert('Error: ' + e.message); }
}

async function loadAllOnboardingData() {
    await Promise.all([loadEmp(), loadTasks(), loadExit()]);
}

document.addEventListener('DOMContentLoaded', () => {
    loadAllOnboardingData();
});
