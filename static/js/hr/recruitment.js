// ─── RECRUITMENT & ATS JAVASCRIPT ───
let reqList = [], candList = [], intList = [];

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

    if (name === 'requisitions') loadRequisitions();
    if (name === 'candidates') loadCandidates();
    if (name === 'interviews') loadInterviews();
}

function openModal(id) { 
    const el = document.getElementById(id);
    if (el) el.classList.add('active'); 
}
function closeModal(id) { 
    const el = document.getElementById(id);
    if (el) el.classList.remove('active'); 
}

function updateRecruitmentKPIs() {
    // Open Requisitions
    const openReqs = reqList.filter(r => r.status === 'open');
    const totalVacancies = openReqs.reduce((acc, r) => acc + (parseInt(r.vacancies) || 1), 0);
    const kpiReqEl = document.getElementById('kpiOpenReqs');
    if (kpiReqEl) kpiReqEl.textContent = openReqs.length;
    const kpiVacEl = document.getElementById('kpiTotalVacancies');
    if (kpiVacEl) kpiVacEl.textContent = `${totalVacancies} Vacancies Target`;

    // Candidate stats
    const kpiCandEl = document.getElementById('kpiTotalCandidates');
    if (kpiCandEl) kpiCandEl.textContent = candList.length;
    const screeningCount = candList.filter(c => c.stage === 'screening' || c.stage === 'interview').length;
    const kpiScreenEl = document.getElementById('kpiScreeningCount');
    if (kpiScreenEl) kpiScreenEl.textContent = `${screeningCount} in screening/interview`;

    // Interviews
    const scheduledCount = intList.filter(i => i.status === 'scheduled').length;
    const passedCount = intList.filter(i => i.result === 'pass').length;
    const kpiIntEl = document.getElementById('kpiScheduledInt');
    if (kpiIntEl) kpiIntEl.textContent = scheduledCount;
    const kpiPassEl = document.getElementById('kpiPassedInt');
    if (kpiPassEl) kpiPassEl.textContent = `${passedCount} passed rounds`;

    // Hired / Offers
    const hiredCount = candList.filter(c => c.stage === 'hired').length;
    const offerCount = candList.filter(c => c.stage === 'offer').length;
    const kpiHiredEl = document.getElementById('kpiHiredCount');
    if (kpiHiredEl) kpiHiredEl.textContent = hiredCount;
    const kpiOfferEl = document.getElementById('kpiOfferCount');
    if (kpiOfferEl) kpiOfferEl.textContent = `${offerCount} offers extended`;

    // Badge counts
    const bReq = document.getElementById('badgeReq');
    if (bReq) bReq.textContent = reqList.length;
    const bCand = document.getElementById('badgeCand');
    if (bCand) bCand.textContent = candList.length;
    const bInt = document.getElementById('badgeInt');
    if (bInt) bInt.textContent = intList.length;
}

// ─── REQUISITIONS ───
async function loadRequisitions() {
    try {
        const res = await fetch(`${API}/job-requisitions`, { headers: headers() });
        const data = await safeJson(res);
        reqList = data.data || [];
        updateRecruitmentKPIs();
        renderRequisitions(reqList);
    } catch(e) { 
        const t = document.getElementById('reqBody'); 
        if(t) t.innerHTML = '<tr><td colspan="8" class="empty">Failed to load. Run HR migration SQL first.</td></tr>'; 
    }
}

function filterRequisitions() {
    const q = (document.getElementById('reqSearchInput')?.value || '').toLowerCase().trim();
    const st = document.getElementById('reqStatusFilter')?.value || '';
    const filtered = reqList.filter(r => {
        const matchesQ = !q || 
            (r.title && r.title.toLowerCase().includes(q)) ||
            (r.department && r.department.toLowerCase().includes(q)) ||
            (r.location && r.location.toLowerCase().includes(q));
        const matchesSt = !st || r.status === st;
        return matchesQ && matchesSt;
    });
    renderRequisitions(filtered);
}

function renderRequisitions(list) {
    const tbody = document.getElementById('reqBody');
    if (!tbody) return;
    if (!list.length) { 
        tbody.innerHTML = '<tr><td colspan="8" class="empty">No matching job requisitions</td></tr>'; 
        return; 
    }

    const statusPill = (status) => {
        if (status === 'open') return '<span class="hr-pill success">Open</span>';
        if (status === 'filled') return '<span class="hr-pill info">Filled</span>';
        if (status === 'on_hold') return '<span class="hr-pill warning">On Hold</span>';
        return `<span class="hr-pill neutral">${status || 'Closed'}</span>`;
    };

    tbody.innerHTML = list.map(r => `<tr>
        <td><strong>${r.title}</strong></td>
        <td>${r.department || '—'}</td>
        <td><span class="hr-pill info">${r.vacancies || 1} open</span></td>
        <td style="text-transform:capitalize">${(r.employment_type || '').replace('_', ' ')}</td>
        <td>${r.location || '—'}</td>
        <td>${statusPill(r.status)}</td>
        <td>${r.target_date ? r.target_date.substring(0, 10) : '—'}</td>
        <td style="text-align:right">
            <div style="display:inline-flex;gap:4px">
                <button class="btn-icon" title="Edit Requisition" onclick="editReq('${r.id}')"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-icon danger" title="Delete Requisition" onclick="deleteReq('${r.id}','${r.title}')"><span class="material-icons-outlined">delete</span></button>
            </div>
        </td>
    </tr>`).join('');
}

function openReqModal() {
    document.getElementById('reqId').value = '';
    document.getElementById('reqModalTitle').textContent = 'New Job Requisition';
    ['reqTitle','reqDept','reqLoc','reqDesc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('reqVac').value = 1;
    document.getElementById('reqStatus').value = 'open';
    openModal('reqModal');
}

function editReq(id) {
    const r = reqList.find(x => x.id === id);
    if (!r) return;
    document.getElementById('reqId').value = r.id;
    document.getElementById('reqModalTitle').textContent = 'Edit Requisition';
    document.getElementById('reqTitle').value = r.title || '';
    document.getElementById('reqDept').value = r.department || '';
    document.getElementById('reqVac').value = r.vacancies || 1;
    document.getElementById('reqType').value = r.employment_type || 'full_time';
    document.getElementById('reqLoc').value = r.location || '';
    document.getElementById('reqTarget').value = r.target_date ? r.target_date.substring(0,10) : '';
    document.getElementById('reqDesc').value = r.description || '';
    document.getElementById('reqStatus').value = r.status || 'open';
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
    if (!body.title) { alert('Title is required'); return; }
    try {
        const url = id ? `${API}/job-requisitions/${id}` : `${API}/job-requisitions`;
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) });
        const data = await safeJson(res);
        if (data.success) { 
            closeModal('reqModal'); 
            loadRequisitions(); 
        } else { 
            alert(data.message); 
        }
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

// ─── CANDIDATES ───
async function loadCandidates() {
    const stage = document.getElementById('candStageFilter')?.value || '';
    const url = `${API}/candidates${stage ? '?stage=' + stage : ''}`;
    try {
        const res = await fetch(url, { headers: headers() });
        const data = await safeJson(res);
        candList = data.data || [];
        updateRecruitmentKPIs();
        renderCandidates(candList);

        // Populate interview candidate select
        const sel = document.getElementById('intCand');
        if (sel) {
            sel.innerHTML = '<option value="">Select Candidate</option>' + 
                candList.map(c => `<option value="${c.id}">${c.first_name} ${c.last_name || ''}</option>`).join('');
        }
    } catch(e) { 
        const t = document.getElementById('candBody'); 
        if(t) t.innerHTML = '<tr><td colspan="7" class="empty">Failed to load candidates.</td></tr>'; 
    }
}

function filterCandidates() {
    const q = (document.getElementById('candSearchInput')?.value || '').toLowerCase().trim();
    const filtered = candList.filter(c => {
        const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
        return !q || name.includes(q) ||
            (c.email && c.email.toLowerCase().includes(q)) ||
            (c.current_company && c.current_company.toLowerCase().includes(q));
    });
    renderCandidates(filtered);
}

function renderCandidates(list) {
    const tbody = document.getElementById('candBody');
    if (!tbody) return;
    if (!list.length) { 
        tbody.innerHTML = '<tr><td colspan="7" class="empty">No matching candidates</td></tr>'; 
        return; 
    }

    const stagePill = (stage) => {
        if (stage === 'hired') return '<span class="hr-pill success">Hired</span>';
        if (stage === 'offer') return '<span class="hr-pill info">Offer</span>';
        if (stage === 'interview') return '<span class="hr-pill warning">Interview</span>';
        if (stage === 'screening') return '<span class="hr-pill neutral">Screening</span>';
        if (stage === 'rejected') return '<span class="hr-pill danger">Rejected</span>';
        return `<span class="hr-pill neutral">${stage || 'Applied'}</span>`;
    };

    tbody.innerHTML = list.map(c => `<tr>
        <td>
            <div style="font-weight:600;color:var(--text-primary);">${c.first_name} ${c.last_name || ''}</div>
            ${c.rating ? `<div style="color:#f59e0b;font-size:12px">★ ${c.rating}/5</div>` : ''}
        </td>
        <td>
            <div>${c.email || '—'}</div>
            <div style="font-size:12px;color:var(--text-secondary)">${c.phone || ''}</div>
        </td>
        <td>
            <div>${c.current_company || '—'}</div>
            <div style="font-size:12px;color:var(--text-secondary)">${c.current_designation || ''}</div>
        </td>
        <td>${c.experience_years ? c.experience_years + ' yrs' : 'Fresher'}</td>
        <td style="text-transform:capitalize">${c.source || 'Direct'}</td>
        <td>${stagePill(c.stage)}</td>
        <td style="text-align:right">
            <div style="display:inline-flex;gap:4px">
                <button class="btn-icon" title="Edit Candidate" onclick="editCand('${c.id}')"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-icon danger" title="Delete Candidate" onclick="deleteCand('${c.id}','${c.first_name}')"><span class="material-icons-outlined">delete</span></button>
            </div>
        </td>
    </tr>`).join('');
}

function openCandModal() {
    document.getElementById('candId').value = '';
    document.getElementById('candModalTitle').textContent = 'Add Candidate';
    ['candFN','candLN','candEmail','candPhone','candCompany','candDesig','candNotes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('candExp').value = '';
    document.getElementById('candStage').value = 'applied';
    document.getElementById('candRating').value = '';
    openModal('candModal');
}

function editCand(id) {
    const c = candList.find(x => x.id === id);
    if (!c) return;
    document.getElementById('candId').value = c.id;
    document.getElementById('candModalTitle').textContent = 'Edit Candidate';
    document.getElementById('candFN').value = c.first_name || '';
    document.getElementById('candLN').value = c.last_name || '';
    document.getElementById('candEmail').value = c.email || '';
    document.getElementById('candPhone').value = c.phone || '';
    document.getElementById('candCompany').value = c.current_company || '';
    document.getElementById('candDesig').value = c.current_designation || '';
    document.getElementById('candExp').value = c.experience_years || '';
    document.getElementById('candSource').value = c.source || '';
    document.getElementById('candStage').value = c.stage || 'applied';
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
    if (!body.first_name) { alert('First name is required'); return; }
    try {
        const url = id ? `${API}/candidates/${id}` : `${API}/candidates`;
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) });
        const data = await safeJson(res);
        if (data.success) { 
            closeModal('candModal'); 
            loadCandidates(); 
        } else { 
            alert(data.message); 
        }
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

// ─── INTERVIEWS ───
async function loadInterviews() {
    try {
        const res = await fetch(`${API}/interviews`, { headers: headers() });
        const data = await safeJson(res);
        intList = data.data || [];
        updateRecruitmentKPIs();
        renderInterviews(intList);
    } catch(e) { 
        const t = document.getElementById('intBody'); 
        if(t) t.innerHTML = '<tr><td colspan="8" class="empty">Failed to load interviews.</td></tr>'; 
    }
}

function filterInterviews() {
    const q = (document.getElementById('intSearchInput')?.value || '').toLowerCase().trim();
    const st = document.getElementById('intStatusFilter')?.value || '';
    const filtered = intList.filter(i => {
        const matchesQ = !q || 
            (i.candidate_name && i.candidate_name.toLowerCase().includes(q)) ||
            (i.interviewer && i.interviewer.toLowerCase().includes(q));
        const matchesSt = !st || i.status === st;
        return matchesQ && matchesSt;
    });
    renderInterviews(filtered);
}

function renderInterviews(list) {
    const tbody = document.getElementById('intBody');
    if (!tbody) return;
    if (!list.length) { 
        tbody.innerHTML = '<tr><td colspan="8" class="empty">No scheduled interviews</td></tr>'; 
        return; 
    }

    const statusPill = (status) => {
        if (status === 'completed') return '<span class="hr-pill success">Completed</span>';
        if (status === 'scheduled') return '<span class="hr-pill info">Scheduled</span>';
        if (status === 'cancelled') return '<span class="hr-pill danger">Cancelled</span>';
        return `<span class="hr-pill warning">${status || 'Pending'}</span>`;
    };

    const resultPill = (res) => {
        if (res === 'pass') return '<span class="hr-pill success">Passed</span>';
        if (res === 'fail') return '<span class="hr-pill danger">Failed</span>';
        if (res === 'hold') return '<span class="hr-pill warning">Hold</span>';
        return '—';
    };

    tbody.innerHTML = list.map(r => `<tr>
        <td><strong>${r.candidate_name || '—'}</strong></td>
        <td style="text-transform:capitalize">${r.interview_type || 'Standard'}</td>
        <td>${r.scheduled_at ? r.scheduled_at.replace('T',' ').substring(0,16) : '—'}</td>
        <td>${r.interviewer || '—'}</td>
        <td style="text-transform:capitalize">${(r.mode || 'video').replace('_', ' ')}</td>
        <td>${statusPill(r.status)}</td>
        <td>${resultPill(r.result)}</td>
        <td style="text-align:right">
            <button class="btn-icon" title="Edit Interview" onclick="editInt('${r.id}')"><span class="material-icons-outlined">edit</span></button>
        </td>
    </tr>`).join('');
}

function openIntModal() {
    document.getElementById('intId').value = '';
    document.getElementById('intStatus').value = 'scheduled';
    document.getElementById('intResult').value = '';
    ['intSched','intInterviewer','intFeedback'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    openModal('intModal');
}

function editInt(id) {
    const r = intList.find(x => x.id === id);
    if (!r) return;
    document.getElementById('intId').value = r.id;
    document.getElementById('intCand').value = r.candidate_id || '';
    document.getElementById('intType').value = r.interview_type || 'hr';
    document.getElementById('intMode').value = r.mode || 'video';
    document.getElementById('intSched').value = r.scheduled_at ? r.scheduled_at.substring(0,16) : '';
    document.getElementById('intInterviewer').value = r.interviewer || '';
    document.getElementById('intStatus').value = r.status || 'scheduled';
    document.getElementById('intResult').value = r.result || '';
    document.getElementById('intFeedback').value = r.feedback || '';
    openModal('intModal');
}

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
    if (!id && !body.candidate_id) { alert('Please select a candidate'); return; }
    try {
        const url = id ? `${API}/interviews/${id}` : `${API}/interviews`;
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) });
        const data = await safeJson(res);
        if (data.success) { 
            closeModal('intModal'); 
            loadInterviews(); 
        } else { 
            alert(data.message); 
        }
    } catch(e) { alert('Error: ' + e.message); }
}

async function loadAllRecruitmentData() {
    await Promise.all([loadRequisitions(), loadCandidates(), loadInterviews()]);
}

document.addEventListener('DOMContentLoaded', () => {
    loadAllRecruitmentData();
});
