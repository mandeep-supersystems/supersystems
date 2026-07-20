// ─── PROJECT MODULE: PROJECT DETAIL ───
function showPdTab(tab) {
    document.querySelectorAll('#sec-projectdetail .tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('#pdTabs .form-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('pdTab-' + tab).classList.add('active');
    event.target.classList.add('active');
    if (tab === 'tasks') loadTasks(currentProjectId);
    if (tab === 'pos') loadProjectPOs(currentProjectId);
}

async function openProject(id) {
    currentProjectId = id;
    const res = await fetch(API + '/projects/' + id, { headers: HEADERS });
    const data = await res.json();
    if (!data.success) { alert(data.message); return; }
    const p = data.data;
    document.getElementById('pdTitle').textContent = `${p.project_number} — ${p.project_name}`;
    document.getElementById('pdCards').innerHTML = `<div class="detail-cards-grid">
        <div class="d-card"><span class="d-label">Status</span><span class="status-badge status-${p.status}">${p.status}</span></div>
        <div class="d-card"><span class="d-label">Organization</span><span class="d-value">${p.organization_name||'—'}</span></div>
        <div class="d-card"><span class="d-label">% Complete</span><span class="d-value">${p.percent_complete}%</span></div>
        <div class="d-card"><span class="d-label">Start</span><span class="d-value">${p.start_date||'—'}</span></div>
        <div class="d-card"><span class="d-label">Due</span><span class="d-value">${p.due_date||'—'}</span></div>
        <div class="d-card"><span class="d-label">Type</span><span class="d-value">${p.project_type||'—'}</span></div>
        <div class="d-card"><span class="d-label">Owner</span><span class="d-value">${p.owner||'—'}</span></div>
        <div class="d-card"><span class="d-label">Tasks</span><span class="d-value">${p.open_tasks}/${p.total_tasks}</span></div>
    </div>`;
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById('sec-projectdetail').classList.add('active');
    loadTasks(id);
}

// ─── TASKS ───
async function loadTasks(pid) {
    const tbody = document.getElementById('tasksTableBody');
    const res = await fetch(API + '/projects/' + pid + '/tasks', { headers: HEADERS });
    const data = await res.json();
    if (!data.success || !data.data.length) { tbody.innerHTML = '<tr><td colspan="10" class="empty">No tasks</td></tr>'; return; }
    tbody.innerHTML = data.data.map(t => `<tr>
        <td><strong>${esc(t.task_name)}</strong></td><td>${esc(t.stage)}</td><td>${esc(t.owner)}</td>
        <td>${t.start_date}</td><td>${t.due_date}</td>
        <td>${t.planned_cost?'₹'+t.planned_cost.toLocaleString():'—'}</td>
        <td>${t.invoiced_amount?'₹'+t.invoiced_amount.toLocaleString():'—'}</td>
        <td><div class="progress-bar sm"><div class="progress-fill" style="width:${t.percent_complete}%"></div><span>${t.percent_complete}%</span></div></td>
        <td><span class="status-badge status-${t.status}">${t.status}</span></td>
        <td class="actions-cell"><button class="btn-icon" onclick="openEditTask('${t.id}','${esc(t.task_name)}','${esc(t.description||'')}','${esc(t.stage)}','${esc(t.owner)}','${t.start_date}','${t.end_date}','${t.due_date}','${t.planned_cost}','${t.invoiced_amount}','${t.percent_complete}','${esc(t.dependencies)}','${t.status}')"><span class="material-icons-outlined">edit</span></button><button class="btn-icon danger" onclick="deleteTask('${t.id}')"><span class="material-icons-outlined">delete</span></button></td>
    </tr>`).join('');
}
function openAddTaskModal() { document.querySelectorAll('#addTaskModal input, #addTaskModal textarea').forEach(el => { if (el.type!=='submit'&&el.type!=='button') el.value = el.type==='number'?'0':''; }); openModal('addTaskModal'); }
async function saveTask(e) { e.preventDefault(); const body = { task_name: document.getElementById('atName').value.trim(), description: document.getElementById('atDesc').value.trim(), stage: document.getElementById('atStage').value.trim(), owner: document.getElementById('atOwner').value.trim(), start_date: document.getElementById('atStart').value||null, end_date: document.getElementById('atEnd').value||null, due_date: document.getElementById('atDue').value||null, planned_cost: parseFloat(document.getElementById('atCost').value)||0, invoiced_amount: parseFloat(document.getElementById('atInvoiced').value)||0, percent_complete: parseFloat(document.getElementById('atPct').value)||0, dependencies: document.getElementById('atDeps').value.trim() }; const res = await fetch(API+'/projects/'+currentProjectId+'/tasks',{method:'POST',headers:HEADERS,body:JSON.stringify(body)}); const data = await res.json(); if(data.success){closeModal('addTaskModal');loadTasks(currentProjectId);}else{alert(data.message);} }
function openEditTask(id,name,desc,stage,owner,start,end,due,cost,inv,pct,deps,status){document.getElementById('etId').value=id;document.getElementById('etName').value=name;document.getElementById('etDesc').value=desc;document.getElementById('etStage').value=stage;document.getElementById('etOwner').value=owner;document.getElementById('etStart').value=start;document.getElementById('etEnd').value=end;document.getElementById('etDue').value=due;document.getElementById('etCost').value=cost;document.getElementById('etInvoiced').value=inv;document.getElementById('etPct').value=pct;document.getElementById('etDeps').value=deps;document.getElementById('etStatus').value=status;openModal('editTaskModal');}
async function updateTask(e){e.preventDefault();const id=document.getElementById('etId').value;const body={task_name:document.getElementById('etName').value.trim(),description:document.getElementById('etDesc').value.trim(),stage:document.getElementById('etStage').value.trim(),owner:document.getElementById('etOwner').value.trim(),start_date:document.getElementById('etStart').value||null,end_date:document.getElementById('etEnd').value||null,due_date:document.getElementById('etDue').value||null,planned_cost:parseFloat(document.getElementById('etCost').value)||0,invoiced_amount:parseFloat(document.getElementById('etInvoiced').value)||0,percent_complete:parseFloat(document.getElementById('etPct').value)||0,dependencies:document.getElementById('etDeps').value.trim(),status:document.getElementById('etStatus').value};const res=await fetch(API+'/tasks/'+id,{method:'PUT',headers:HEADERS,body:JSON.stringify(body)});const data=await res.json();if(data.success){closeModal('editTaskModal');loadTasks(currentProjectId);}else{alert(data.message);}}
async function deleteTask(id){if(!confirm('Delete this task?'))return;const res=await fetch(API+'/tasks/'+id,{method:'DELETE',headers:HEADERS});const data=await res.json();if(data.success)loadTasks(currentProjectId);else alert(data.message);}

// ─── POs (read-only from procurement) ───
async function loadProjectPOs(pid) {
    const tbody = document.getElementById('posTableBody');
    const res = await fetch(PROC_API + '/purchase-orders?project_id=' + pid, { headers: HEADERS });
    const data = await res.json();
    if (!data.success || !data.data.length) { tbody.innerHTML = '<tr><td colspan="10" class="empty">No POs linked to this project</td></tr>'; return; }
    let rows = '';
    data.data.forEach(po => {
        const lines = po.lines || [];
        if (!lines.length) {
            rows += `<tr><td><strong>${esc(po.po_number)}</strong></td><td>${po.po_date}</td><td>—</td><td>—</td><td>—</td><td><strong>₹${po.total_amount.toLocaleString()}</strong></td><td>—</td><td>—</td><td>—</td><td><span class="status-badge status-${po.status}">${po.status}</span></td></tr>`;
        } else {
            lines.forEach((l, i) => {
                const lineTotal = (parseFloat(l.quantity) || 0) * (parseFloat(l.price_per_quantity) || 0);
                rows += `<tr><td>${i === 0 ? '<strong>' + esc(po.po_number) + '</strong>' : ''}</td><td>${i === 0 ? po.po_date : ''}</td><td>${esc(l.customer_part_number)}</td><td>${l.quantity}</td><td>₹${parseFloat(l.price_per_quantity || 0).toLocaleString()}</td><td><strong>₹${lineTotal.toLocaleString()}</strong></td><td>${l.delivery_date_etd || '—'}</td><td>${l.delivery_date_eta || '—'}</td><td>${esc(l.deliver_by) || '—'}</td><td>${i === 0 ? '<span class="status-badge status-' + po.status + '">' + po.status + '</span>' : ''}</td></tr>`;
            });
        }
    });
    tbody.innerHTML = rows;
}
function goToAddPO() { window.location.href = `/procurement/addpo?project_id=${currentProjectId}&project_name=${encodeURIComponent(document.getElementById('pdTitle').textContent)}`; }
