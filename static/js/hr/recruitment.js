// ─── RECRUITMENT JS ───
let reqList = [], candList = [];

async function safeJson(res) {
    try { return await res.json(); } catch(e) { return { success: false, message: 'Server error (run HR migration SQL)', data: [] }; }
}

function showTab(name) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    if (name === 'requisitions') loadRequisitions();
    if (name === 'candidates') loadCandidates();
    if (name === 'interviews') loadInterviews();
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

async function loadRequisitions() {
    try {
    const res = await fetch(`${API}/job-requisitions`, { headers: headers() });
    const data = await safeJson(res);
    reqList = data.data || [];
    const tbody = document.getElementById('reqBody');
    if (!reqList.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No requisitions</td></tr>'; return; }
    tbody.innerHTML = reqList.map(r => `<tr>
        <td><strong>${r.title}</strong></td><td>${r.department}</td><td>${r.vacancies}</td>
        <td>${r.employment_type}</td><td>${r.location}</td>
        <td><span class="status-badge ${r.status}">${r.status}</span></td>
        <td>${r.target_date || '—'}</td>
        <td class="actions-cell">
            <button class="btn-icon" onclick="editReq('${r.id}')"><span class="material-icons-outlined">edit</span></button>
            <button class="btn-icon danger" onclick="deleteReq('${r.id}','${r.title}')"><span class="material-icons-outlined">delete</span></button>
        </td>
    </tr>`).join('');
    } catch(e) { const t=document.getElementById('reqBody'); if(t) t.innerHTML='<tr><td colspan="8" class="empty">Failed to load. Run HR migration SQL first.</td></tr>'; }
}

function openReqModal() {
    document.getElementById('reqId').value = '';
    document.getElementById('reqModalTitle').textContent = 'New Job Requisition';
    ['reqTitle','reqDept','reqLoc','reqDesc'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('reqVac').value = 1;
    document.getElementById('reqStatus').value = 'open';
    openModal('reqModal');
}

function editReq(id) {
    const r = reqList.find(x => x.id === id);
    if (!r) return;
    document.getElementById('reqId').value = r.id;
    document.getElementById('reqModalTitle').textContent = 'Edit Requisition';
    document.getElementById('reqTitle').value = r.title;
    document.getElementById('reqDept').value = r.department;
    document.getElementById('reqVac').value = r.vacancies;
    document.getElementById('reqType').value = r.employment_type;
    document.getElementById('reqLoc').value = r.location;
    document.getElementById('reqTarget').value = r.target_date || '';
    document.getElementById('reqStatus').value = r.status;
    openModal('reqModal');
}

async function saveReq() {
    const id = document.getElementById('reqId').value;
    const body = {
        title: document.getElementById('reqTitle').value.trim(),
        department: document.getElementById('reqDept').value.trim(),
        vacancies: parseInt(document.getElementById('reqVac').value) || 1,
        employment_type: document.getElementById('reqType').value,
        location: document.getElementById('reqLoc').value.trim(),
        target_date: document.getElementById('reqTarget').value || null,
        description: document.getElementById('reqDesc').value.trim(),
        status: document.getElementById('reqStatus').value
    };
    if (!body.title) { alert('Title required'); return; }
    try {
        const url = id ? `${API}/job-requisitions/${id}` : `${API}/job-requisitions`;
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) });
        const data = await safeJson(res);
        if (data.success) { closeModal('reqModal'); loadRequisitions(); } else { alert(data.message); }
    } catch(e) { alert('Error: ' + e.message); }
}

async function deleteReq(id, title) {
    if (!confirm(`Delete requisition "${title}"?`)) return;
    try {
        const res = await fetch(`${API}/job-requisitions/${id}`, { method: 'DELETE', headers: headers() });
        const data = await safeJson(res);
        if (data.success) loadRequisitions(); else alert(data.message);
    } catch(e) { alert('Error: ' + e.message); }
}

async function loadCandidates() {
    const stage = document.getElementById('candStageFilter').value;
    const url = `${API}/candidates${stage ? '?stage=' + stage : ''}`;
    try {
    const res = await fetch(url, { headers: headers() });
    const data = await safeJson(res);
    candList = data.data || [];
    const tbody = document.getElementById('candBody');
    if (!candList.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No candidates</td></tr>'; return; }
    tbody.innerHTML = candList.map(c => `<tr>
        <td><strong>${c.first_name} ${c.last_name}</strong></td>
        <td>${c.email}</td><td>${c.current_company}</td>
        <td>${c.experience_years}y</td><td>${c.source}</td>
        <td><span class="status-badge ${c.stage}">${c.stage}</span></td>
        <td class="actions-cell">
            <button class="btn-icon" onclick="editCand('${c.id}')"><span class="material-icons-outlined">edit</span></button>
            <button class="btn-icon danger" onclick="deleteCand('${c.id}','${c.first_name}')"><span class="material-icons-outlined">delete</span></button>
        </td>
    </tr>`).join('');
    // Populate interview candidate select
    const sel = document.getElementById('intCand');
    if (sel) sel.innerHTML = '<option value="">Select Candidate</option>' + candList.map(c => `<option value="${c.id}">${c.first_name} ${c.last_name}</option>`).join('');
    } catch(e) { const t=document.getElementById('candBody'); if(t) t.innerHTML='<tr><td colspan="7" class="empty">Failed to load.</td></tr>'; }
}

function openCandModal() {
    document.getElementById('candId').value = '';
    document.getElementById('candModalTitle').textContent = 'Add Candidate';
    ['candFN','candLN','candEmail','candPhone','candCompany','candDesig','candNotes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('candExp').value = '';
    document.getElementById('candStage').value = 'applied';
    openModal('candModal');
}

function editCand(id) {
    const c = candList.find(x => x.id === id);
    if (!c) return;
    document.getElementById('candId').value = c.id;
    document.getElementById('candModalTitle').textContent = 'Edit Candidate';
    document.getElementById('candFN').value = c.first_name;
    document.getElementById('candLN').value = c.last_name;
    document.getElementById('candEmail').value = c.email;
    document.getElementById('candPhone').value = c.phone;
    document.getElementById('candCompany').value = c.current_company;
    document.getElementById('candDesig').value = c.current_designation;
    document.getElementById('candExp').value = c.experience_years;
    document.getElementById('candSource').value = c.source;
    document.getElementById('candStage').value = c.stage;
    document.getElementById('candRating').value = c.rating || '';
    document.getElementById('candNotes').value = c.notes || '';
    openModal('candModal');
}

async function saveCand() {
    const id = document.getElementById('candId').value;
    const body = {
        first_name: document.getElementById('candFN').value.trim(),
        last_name: document.getElementById('candLN').value.trim(),
        email: document.getElementById('candEmail').value.trim(),
        phone: document.getElementById('candPhone').value.trim(),
        current_company: document.getElementById('candCompany').value.trim(),
        current_designation: document.getElementById('candDesig').value.trim(),
        experience_years: parseFloat(document.getElementById('candExp').value) || 0,
        source: document.getElementById('candSource').value,
        stage: document.getElementById('candStage').value,
        rating: parseInt(document.getElementById('candRating').value) || null,
        notes: document.getElementById('candNotes').value.trim()
    };
    if (!body.first_name) { alert('First name required'); return; }
    try {
        const url = id ? `${API}/candidates/${id}` : `${API}/candidates`;
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) });
        const data = await safeJson(res);
        if (data.success) { closeModal('candModal'); loadCandidates(); } else { alert(data.message); }
    } catch(e) { alert('Error: ' + e.message); }
}

async function deleteCand(id, name) {
    if (!confirm(`Delete candidate "${name}"?`)) return;
    try {
        const res = await fetch(`${API}/candidates/${id}`, { method: 'DELETE', headers: headers() });
        const data = await safeJson(res);
        if (data.success) loadCandidates(); else alert(data.message);
    } catch(e) { alert('Error: ' + e.message); }
}

async function loadInterviews() {
    try {
    const res = await fetch(`${API}/interviews`, { headers: headers() });
    const data = await safeJson(res);
    const rows = data.data || [];
    const tbody = document.getElementById('intBody');
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No interviews</td></tr>'; return; }
    tbody.innerHTML = rows.map(r => `<tr>
        <td><strong>${r.candidate_name}</strong></td>
        <td>${r.interview_type}</td>
        <td>${r.scheduled_at ? r.scheduled_at.replace('T',' ').substring(0,16) : '—'}</td>
        <td>${r.interviewer}</td><td>${r.mode}</td>
        <td><span class="status-badge ${r.status}">${r.status}</span></td>
        <td>${r.result ? `<span class="status-badge ${r.result}">${r.result}</span>` : '—'}</td>
        <td class="actions-cell">
            <button class="btn-icon" onclick="editInt('${r.id}')"><span class="material-icons-outlined">edit</span></button>
        </td>
    </tr>`).join('');
    } catch(e) { const t=document.getElementById('intBody'); if(t) t.innerHTML='<tr><td colspan="8" class="empty">Failed to load.</td></tr>'; }
}

function openIntModal() {
    document.getElementById('intId').value = '';
    openModal('intModal');
}

function editInt(id) { document.getElementById('intId').value = id; openModal('intModal'); }

async function saveInt() {
    const id = document.getElementById('intId').value;
    const body = {
        candidate_id: document.getElementById('intCand').value,
        interview_type: document.getElementById('intType').value,
        mode: document.getElementById('intMode').value,
        scheduled_at: document.getElementById('intSched').value || null,
        interviewer: document.getElementById('intInterviewer').value.trim(),
        status: document.getElementById('intStatus').value,
        result: document.getElementById('intResult').value,
        feedback: document.getElementById('intFeedback').value.trim()
    };
    if (!id && !body.candidate_id) { alert('Select candidate'); return; }
    try {
        const url = id ? `${API}/interviews/${id}` : `${API}/interviews`;
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) });
        const data = await safeJson(res);
        if (data.success) { closeModal('intModal'); loadInterviews(); } else { alert(data.message); }
    } catch(e) { alert('Error: ' + e.message); }
}

document.addEventListener('DOMContentLoaded', () => { loadRequisitions(); loadCandidates(); });
