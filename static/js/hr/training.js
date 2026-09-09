// ─── TRAINING & L&D JAVASCRIPT ───
let coursesList = [], assignList = [], expiringList = [], empList = [];

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

    if (name === 'courses') loadCourses();
    if (name === 'assignments') loadAssignments();
    if (name === 'expiring') loadExpiring();
}

function openModal(id) { 
    const el = document.getElementById(id);
    if (el) el.classList.add('active'); 
}
function closeModal(id) { 
    const el = document.getElementById(id);
    if (el) el.classList.remove('active'); 
}

function updateTrainingKPIs() {
    // Courses
    const mandatoryCount = coursesList.filter(c => c.is_mandatory).length;
    const kpiTotC = document.getElementById('kpiTotalCourses');
    if (kpiTotC) kpiTotC.textContent = coursesList.length;
    const kpiMandC = document.getElementById('kpiMandatoryCourses');
    if (kpiMandC) kpiMandC.textContent = `${mandatoryCount} Mandatory compliance`;

    // Assignments
    const inProgressCount = assignList.filter(a => a.status === 'in_progress' || a.status === 'assigned').length;
    const completedCount = assignList.filter(a => a.status === 'completed').length;
    const kpiTotA = document.getElementById('kpiTotalAssignments');
    if (kpiTotA) kpiTotA.textContent = assignList.length;
    const kpiInProgA = document.getElementById('kpiInProgressAssignments');
    if (kpiInProgA) kpiInProgA.textContent = `${inProgressCount} In progress/assigned`;

    const kpiCompA = document.getElementById('kpiCompletedAssignments');
    if (kpiCompA) kpiCompA.textContent = completedCount;
    const kpiCompRate = document.getElementById('kpiCompletionRate');
    if (kpiCompRate) {
        const rate = assignList.length ? Math.round((completedCount / assignList.length) * 100) : 0;
        kpiCompRate.textContent = `${rate}% Completion rate`;
    }

    // Expiring
    const kpiExp = document.getElementById('kpiExpiringCount');
    if (kpiExp) kpiExp.textContent = expiringList.length;

    // Badges
    const bC = document.getElementById('badgeCourses');
    if (bC) bC.textContent = coursesList.length;
    const bA = document.getElementById('badgeAssign');
    if (bA) bA.textContent = assignList.length;
    const bE = document.getElementById('badgeExpiring');
    if (bE) bE.textContent = expiringList.length;
}

async function loadEmp() {
    try {
        const res = await fetch(API + '/employees', { headers: headers() });
        const d = await safeJson(res);
        empList = d.data || [];
        const opts = '<option value="">Select Employee</option>' + 
            empList.map(e => `<option value="${e.id}">${e.emp_code} - ${e.first_name} ${e.last_name || ''}</option>`).join('');
        const el = document.getElementById('assignEmp');
        if (el) el.innerHTML = opts;
    } catch(e) { console.warn('loadEmp:', e.message); }
}

// ─── COURSES ───
async function loadCourses() {
    try {
        const res = await fetch(`${API}/training-courses`, { headers: headers() });
        const d = await safeJson(res);
        coursesList = d.data || [];
        updateTrainingKPIs();
        renderCourses(coursesList);

        const sel = document.getElementById('assignCourse');
        if (sel) {
            sel.innerHTML = '<option value="">Select Course</option>' + 
                coursesList.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
        }
    } catch(e) {
        const t = document.getElementById('coursesBody');
        if (t) t.innerHTML = '<tr><td colspan="8" class="empty">Failed to load courses.</td></tr>';
    }
}

function filterCourses() {
    const q = (document.getElementById('courseSearchInput')?.value || '').toLowerCase().trim();
    const mode = document.getElementById('courseModeFilter')?.value || '';
    const filtered = coursesList.filter(c => {
        const matchesQ = !q || 
            (c.title && c.title.toLowerCase().includes(q)) ||
            (c.category && c.category.toLowerCase().includes(q));
        const matchesMode = !mode || c.mode === mode;
        return matchesQ && matchesMode;
    });
    renderCourses(filtered);
}

function renderCourses(list) {
    const tbody = document.getElementById('coursesBody');
    if (!tbody) return;
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">No training courses found</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(c => `<tr>
        <td><strong>${c.title}</strong></td>
        <td><span class="hr-pill neutral">${c.category || 'General'}</span></td>
        <td>${c.duration_hours ? c.duration_hours + ' hrs' : 'Self-paced'}</td>
        <td style="text-transform:capitalize">${(c.mode || 'online').replace('_', ' ')}</td>
        <td>${c.is_mandatory ? '<span class="hr-pill danger">Mandatory</span>' : '<span class="hr-pill neutral">Optional</span>'}</td>
        <td>${c.certification_name || '—'}</td>
        <td>${c.validity_months ? c.validity_months + ' months' : 'Lifetime'}</td>
        <td style="text-align:right">
            <div style="display:inline-flex;gap:4px">
                <button class="btn-icon" title="Edit Course" onclick="editCourse('${c.id}')"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-icon danger" title="Delete Course" onclick="deleteCourse('${c.id}','${c.title}')"><span class="material-icons-outlined">delete</span></button>
            </div>
        </td>
    </tr>`).join('');
}

function openCourseModal() {
    document.getElementById('courseId').value = '';
    document.getElementById('courseModalTitle').textContent = 'New Training Course';
    ['courseTitle','courseCat','courseCert','courseDur','courseValidity'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('courseMandatory').value = 'false';
    openModal('courseModal');
}

function editCourse(id) {
    const c = coursesList.find(x => x.id === id);
    if (!c) return;
    document.getElementById('courseId').value = c.id;
    document.getElementById('courseModalTitle').textContent = 'Edit Course';
    document.getElementById('courseTitle').value = c.title || '';
    document.getElementById('courseCat').value = c.category || '';
    document.getElementById('courseDur').value = c.duration_hours || '';
    document.getElementById('courseMode').value = c.mode || 'online';
    document.getElementById('courseMandatory').value = String(c.is_mandatory);
    document.getElementById('courseCert').value = c.certification_name || '';
    document.getElementById('courseValidity').value = c.validity_months || '';
    openModal('courseModal');
}

async function saveCourse() {
    const id = document.getElementById('courseId').value;
    const body = {
        title: document.getElementById('courseTitle').value.trim(),
        category: document.getElementById('courseCat').value.trim(),
        duration_hours: parseFloat(document.getElementById('courseDur').value) || 0,
        mode: document.getElementById('courseMode').value,
        is_mandatory: document.getElementById('courseMandatory').value === 'true',
        certification_name: document.getElementById('courseCert').value.trim(),
        validity_months: parseInt(document.getElementById('courseValidity').value) || null
    };
    if (!body.title) { alert('Course title is required'); return; }
    try {
        const url = id ? `${API}/training-courses/${id}` : `${API}/training-courses`;
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) });
        const d = await safeJson(res);
        if (d.success) { 
            closeModal('courseModal'); 
            loadCourses(); 
        } else alert(d.message);
    } catch(e) { alert('Error: ' + e.message); }
}

async function deleteCourse(id, title) {
    if (!confirm(`Delete training course "${title}"?`)) return;
    try {
        const res = await fetch(`${API}/training-courses/${id}`, { method: 'DELETE', headers: headers() });
        const d = await safeJson(res);
        if (d.success) loadCourses(); else alert(d.message);
    } catch(e) { alert('Error: ' + e.message); }
}

// ─── ASSIGNMENTS ───
async function loadAssignments() {
    const status = document.getElementById('assignStatusFilter')?.value || '';
    const url = `${API}/training-assignments${status ? '?status=' + status : ''}`;
    try {
        const res = await fetch(url, { headers: headers() });
        const d = await safeJson(res);
        assignList = d.data || [];
        updateTrainingKPIs();
        renderAssignments(assignList);
    } catch(e) {
        const t = document.getElementById('assignBody');
        if (t) t.innerHTML = '<tr><td colspan="8" class="empty">Failed to load training assignments.</td></tr>';
    }
}

function filterAssignments() {
    const q = (document.getElementById('assignSearchInput')?.value || '').toLowerCase().trim();
    const filtered = assignList.filter(a => {
        const empStr = `${a.emp_code || ''} ${a.employee_name || ''}`.toLowerCase();
        return !q || empStr.includes(q) || (a.course_title && a.course_title.toLowerCase().includes(q));
    });
    renderAssignments(filtered);
}

function renderAssignments(list) {
    const tbody = document.getElementById('assignBody');
    if (!tbody) return;
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">No training assignments found</td></tr>';
        return;
    }

    const statusPill = (st) => {
        if (st === 'completed') return '<span class="hr-pill success">Completed</span>';
        if (st === 'in_progress') return '<span class="hr-pill warning">In Progress</span>';
        if (st === 'expired') return '<span class="hr-pill danger">Expired</span>';
        return '<span class="hr-pill info">Assigned</span>';
    };

    tbody.innerHTML = list.map(r => `<tr>
        <td>
            <strong>${r.emp_code || ''}</strong>
            <div>${r.employee_name || '—'}</div>
        </td>
        <td><strong>${r.course_title || '—'}</strong></td>
        <td>${r.due_date ? r.due_date.substring(0, 10) : '—'}</td>
        <td>${r.completed_at ? r.completed_at.substring(0, 10) : '—'}</td>
        <td>${r.score != null ? `<strong>${r.score}%</strong>` : '—'}</td>
        <td>${r.cert_expiry_date ? r.cert_expiry_date.substring(0, 10) : '—'}</td>
        <td>${statusPill(r.status)}</td>
        <td style="text-align:right">
            <button class="btn-icon" title="Edit Assignment" onclick="editAssign('${r.id}')"><span class="material-icons-outlined">edit</span></button>
        </td>
    </tr>`).join('');
}

function openAssignModal() {
    document.getElementById('assignId').value = '';
    document.getElementById('assignModalTitle').textContent = 'Assign Training Course';
    document.getElementById('assignStatus').value = 'assigned';
    ['assignScore','assignExpiry','assignDue'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    openModal('assignModal');
}

function editAssign(id) {
    const a = assignList.find(x => x.id === id);
    if (!a) return;
    document.getElementById('assignId').value = a.id;
    document.getElementById('assignModalTitle').textContent = 'Edit Enrollment';
    document.getElementById('assignEmp').value = a.employee_id || '';
    document.getElementById('assignCourse').value = a.course_id || '';
    document.getElementById('assignDue').value = a.due_date ? a.due_date.substring(0, 10) : '';
    document.getElementById('assignStatus').value = a.status || 'assigned';
    document.getElementById('assignScore').value = a.score != null ? a.score : '';
    document.getElementById('assignExpiry').value = a.cert_expiry_date ? a.cert_expiry_date.substring(0, 10) : '';
    openModal('assignModal');
}

async function saveAssign() {
    const id = document.getElementById('assignId').value;
    const body = {
        employee_id: document.getElementById('assignEmp').value,
        course_id: document.getElementById('assignCourse').value,
        due_date: document.getElementById('assignDue').value || null,
        status: document.getElementById('assignStatus').value,
        score: parseFloat(document.getElementById('assignScore').value) || null,
        cert_expiry_date: document.getElementById('assignExpiry').value || null
    };
    if (!id && (!body.employee_id || !body.course_id)) { alert('Employee and course are required'); return; }
    try {
        const url = id ? `${API}/training-assignments/${id}` : `${API}/training-assignments`;
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) });
        const d = await safeJson(res);
        if (d.success) { 
            closeModal('assignModal'); 
            loadAssignments(); 
        } else alert(d.message);
    } catch(e) { alert('Error: ' + e.message); }
}

// ─── EXPIRING ───
async function loadExpiring() {
    const days = document.getElementById('expiryDays')?.value || '30';
    try {
        const res = await fetch(`${API}/expiring-certifications?days=${days}`, { headers: headers() });
        const d = await safeJson(res);
        expiringList = d.data || [];
        updateTrainingKPIs();
        const tbody = document.getElementById('expiringBody');
        if (!tbody) return;
        if (!expiringList.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty">No certifications expiring within this timeframe</td></tr>';
            return;
        }
        tbody.innerHTML = expiringList.map(r => `<tr>
            <td>
                <strong>${r.emp_code || ''}</strong>
                <div>${r.employee_name || '—'}</div>
            </td>
            <td><strong>${r.course_title || '—'}</strong></td>
            <td style="color:#e11d48;font-weight:600">${r.cert_expiry_date || '—'}</td>
            <td><span class="hr-pill warning">Expiring Soon</span></td>
        </tr>`).join('');
    } catch(e) {
        const t = document.getElementById('expiringBody');
        if (t) t.innerHTML = '<tr><td colspan="4" class="empty">Failed to load expiring certifications.</td></tr>';
    }
}

async function loadAllTrainingData() {
    await Promise.all([loadEmp(), loadCourses(), loadAssignments(), loadExpiring()]);
}

document.addEventListener('DOMContentLoaded', () => {
    loadAllTrainingData();
});
