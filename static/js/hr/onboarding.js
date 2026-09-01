// ─── ONBOARDING JS ───
let empList = [], tasksList = [], exitList = [];

async function safeJson(res) {
    try { return await res.json(); } catch(e) { return { success: false, message: 'Server error (run HR migration SQL)', data: [] }; }
}

function showTab(name) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    if (name === 'tasks') loadTasks();
    if (name === 'exit') loadExit();
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

async function loadEmp() {
    try {
        const res = await fetch(API + '/employees', { headers: headers() });
        const data = await safeJson(res);
        empList = data.data || [];
        const opts = '<option value="">Select Employee</option>' + empList.map(e => `<option value="${e.id}">${e.emp_code} - ${e.first_name} ${e.last_name||''}</option>`).join('');
        ['taskEmp','exitEmp'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = opts; });
    } catch(e) { console.warn('loadEmp:', e.message); }
}

async function loadTasks() {
    const phase = document.getElementById('taskPhaseFilter').value;
    const url = `${API}/onboarding-tasks${phase ? '?phase=' + phase : ''}`;
    try {
    const res = await fetch(url, { headers: headers() });
    const data = await safeJson(res);
    tasksList = data.data || [];
    const tbody = document.getElementById('tasksBody');
    if (!tasksList.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No tasks</td></tr>'; return; }
    tbody.innerHTML = tasksList.map(t => `<tr>
        <td><strong>${t.emp_code}</strong> ${t.employee_name}</td>
        <td>${t.task_name}</td><td>${t.task_category}</td><td>${t.phase}</td>
        <td>${t.due_date || '—'}</td><td>${t.assigned_to || '—'}</td>
        <td><span class="status-badge ${t.status}">${t.status}</span></td>
        <td class="actions-cell">
            <button class="btn-icon" onclick="editTask('${t.id}')"><span class="material-icons-outlined">edit</span></button>
            <button class="btn-icon danger" onclick="deleteTask('${t.id}')"><span class="material-icons-outlined">delete</span></button>
        </td>
    </tr>`).join('');
    } catch(e) { const t=document.getElementById('tasksBody'); if(t) t.innerHTML='<tr><td colspan="8" class="empty">Failed to load. Run HR migration SQL first.</td></tr>'; }
}

function openTaskModal() {
    document.getElementById('taskId').value = '';
    document.getElementById('taskModalTitle').textContent = 'Add Onboarding Task';
    ['taskName','taskAssigned','taskNotes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('taskStatus').value = 'pending';
    openModal('taskModal');
}

function editTask(id) {
    const t = tasksList.find(x => x.id === id);
    if (!t) return;
    document.getElementById('taskId').value = t.id;
    document.getElementById('taskModalTitle').textContent = 'Edit Task';
    document.getElementById('taskEmp').value = t.employee_id;
    document.getElementById('taskName').value = t.task_name;
    document.getElementById('taskCat').value = t.task_category;
    document.getElementById('taskPhase').value = t.phase;
    document.getElementById('taskDue').value = t.due_date || '';
    document.getElementById('taskAssigned').value = t.assigned_to;
    document.getElementById('taskStatus').value = t.status;
    document.getElementById('taskNotes').value = t.notes;
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
    if (!body.employee_id || !body.task_name) { alert('Employee and task name required'); return; }
    try {
        const url = id ? `${API}/onboarding-tasks/${id}` : `${API}/onboarding-tasks`;
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) });
        const data = await safeJson(res);
        if (data.success) { closeModal('taskModal'); loadTasks(); } else { alert(data.message); }
    } catch(e) { alert('Error: ' + e.message); }
}

async function deleteTask(id) {
    if (!confirm('Delete this task?')) return;
    try {
        const res = await fetch(`${API}/onboarding-tasks/${id}`, { method: 'DELETE', headers: headers() });
        const data = await safeJson(res);
        if (data.success) loadTasks(); else alert(data.message);
    } catch(e) { alert('Error: ' + e.message); }
}

async function loadExit() {
    try {
    const res = await fetch(`${API}/exit-requests`, { headers: headers() });
    const data = await safeJson(res);
    exitList = data.data || [];
    const tbody = document.getElementById('exitBody');
    if (!exitList.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No exit requests</td></tr>'; return; }
    tbody.innerHTML = exitList.map(e => `<tr>
        <td><strong>${e.emp_code}</strong> ${e.employee_name}</td>
        <td>${e.resignation_date || '—'}</td><td>${e.last_working_date || '—'}</td>
        <td>${e.reason}</td>
        <td><span class="status-badge ${e.status}">${e.status}</span></td>
        <td>${e.exit_interview_done ? '<span class="status-badge active">Done</span>' : '<span class="status-badge inactive">Pending</span>'}</td>
        <td class="actions-cell">
            <button class="btn-icon" onclick="editExit('${e.id}')"><span class="material-icons-outlined">edit</span></button>
        </td>
    </tr>`).join('');
    } catch(e) { const t=document.getElementById('exitBody'); if(t) t.innerHTML='<tr><td colspan="7" class="empty">Failed to load.</td></tr>'; }
}

function openExitModal() {
    document.getElementById('exitId').value = '';
    document.getElementById('exitModalTitle').textContent = 'Initiate Exit';
    openModal('exitModal');
}

function editExit(id) {
    const e = exitList.find(x => x.id === id);
    if (!e) return;
    document.getElementById('exitId').value = e.id;
    document.getElementById('exitModalTitle').textContent = 'Update Exit';
    document.getElementById('exitEmp').value = e.employee_id;
    document.getElementById('exitRes').value = e.resignation_date || '';
    document.getElementById('exitLWD').value = e.last_working_date || '';
    document.getElementById('exitReason').value = e.reason;
    document.getElementById('exitStatus').value = e.status;
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
    if (!body.employee_id) { alert('Select employee'); return; }
    try {
        const url = id ? `${API}/exit-requests/${id}` : `${API}/exit-requests`;
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) });
        const data = await safeJson(res);
        if (data.success) { closeModal('exitModal'); loadExit(); } else { alert(data.message); }
    } catch(e) { alert('Error: ' + e.message); }
}

document.addEventListener('DOMContentLoaded', () => { loadEmp(); loadTasks(); });
