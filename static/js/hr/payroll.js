// ─── PAYROLL JS ───
let empList = [], salStructures = [];

async function safeJson(res) {
    try { return await res.json(); } catch(e) { return { success: false, message: 'Server error (run HR migration SQL)', data: [] }; }
}

function showTab(name) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    if (name === 'runs') loadRuns();
    if (name === 'payslips') loadPayslips();
    if (name === 'salaries') loadSalaries();
    if (name === 'pf') loadPF();
    if (name === 'tax') loadTax();
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function initSelects() {
    const now = new Date();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    ['runMonth','psMonth'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = months.map((m,i) => `<option value="${i+1}" ${i+1===now.getMonth()+1?'selected':''}>${m}</option>`).join('');
    });
    ['runYear','psYear','pfYear'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = [now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1]
            .map(y => `<option value="${y}" ${y===now.getFullYear()?'selected':''}>${y}</option>`).join('');
    });
    const pfM = document.getElementById('pfMonth');
    if (pfM) pfM.innerHTML = months.map((m,i) => `<option value="${i+1}" ${i+1===now.getMonth()+1?'selected':''}>${m}</option>`).join('');
    const fy = document.getElementById('taxFY');
    const y = now.getFullYear();
    if (fy) fy.innerHTML = [`${y-1}-${String(y).slice(2)}`, `${y}-${String(y+1).slice(2)}`]
        .map(f => `<option value="${f}">${f}</option>`).join('');
}

async function loadEmp() {
    try {
    const res = await fetch(API + '/employees', { headers: headers() });
    const data = await safeJson(res);
    empList = data.data || [];
    const opts = '<option value="">Select Employee</option>' + empList.map(e => `<option value="${e.id}">${e.emp_code} - ${e.first_name} ${e.last_name||''}</option>`).join('');
    ['psEmp','taxEmp'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = opts; });
    } catch(e) { console.warn('loadEmp:', e.message); }
}

async function loadRuns() {
    try {
    const res = await fetch(`${API}/payroll-runs`, { headers: headers() });
    const data = await safeJson(res);
    const rows = data.data || [];
    const tbody = document.getElementById('runsBody');
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No payroll runs</td></tr>'; return; }
    const months = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    tbody.innerHTML = rows.map(r => `<tr>
        <td><strong>${months[r.period_month]} ${r.period_year}</strong></td>
        <td><span class="status-badge ${r.status}">${r.status}</span></td>
        <td>${r.total_employees}</td>
        <td>₹${Number(r.total_gross).toLocaleString('en-IN')}</td>
        <td>₹${Number(r.total_deductions).toLocaleString('en-IN')}</td>
        <td><strong>₹${Number(r.total_net).toLocaleString('en-IN')}</strong></td>
        <td>${r.finalized_by || '—'}</td>
        <td class="actions-cell">
            ${r.status !== 'finalized' ? `<button class="btn-icon" title="Finalize" onclick="finalizeRun('${r.id}')"><span class="material-icons-outlined" style="color:#4caf50">lock</span></button>` : '<span class="material-icons-outlined" style="color:#4caf50;font-size:18px">lock</span>'}
        </td>
    </tr>`).join('');
    } catch(e) { const t=document.getElementById('runsBody'); if(t) t.innerHTML='<tr><td colspan="8" class="empty">Failed to load. Run HR migration SQL first.</td></tr>'; }
}

function openRunModal() { openModal('runModal'); }

async function saveRun() {
    const body = { period_month: parseInt(document.getElementById('runMonth').value), period_year: parseInt(document.getElementById('runYear').value) };
    try {
        const res = await fetch(`${API}/payroll-runs`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
        const data = await safeJson(res);
        if (data.success) { closeModal('runModal'); loadRuns(); } else { alert(data.message); }
    } catch(e) { alert('Error: ' + e.message); }
}

async function finalizeRun(id) {
    if (!confirm('Finalize this payroll run? This will lock all payslips.')) return;
    try {
        const res = await fetch(`${API}/payroll-runs/${id}/finalize`, { method: 'POST', headers: headers() });
        const data = await safeJson(res);
        if (data.success) loadRuns(); else alert(data.message);
    } catch(e) { alert('Error: ' + e.message); }
}

async function loadPayslips() {
    try {
    const res = await fetch(`${API}/payslips`, { headers: headers() });
    const data = await safeJson(res);
    let rows = data.data || [];
    const filter = document.getElementById('psEmpFilter')?.value.toLowerCase() || '';
    if (filter) rows = rows.filter(r => r.employee_name.toLowerCase().includes(filter) || r.emp_code.toLowerCase().includes(filter));
    const months = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const tbody = document.getElementById('payslipsBody');
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No payslips</td></tr>'; return; }
    tbody.innerHTML = rows.map(r => `<tr>
        <td><strong>${r.emp_code}</strong> ${r.employee_name}</td>
        <td>${months[r.period_month]} ${r.period_year}</td>
        <td>₹${Number(r.gross_salary).toLocaleString('en-IN')}</td>
        <td>₹${Number(r.total_deductions).toLocaleString('en-IN')}</td>
        <td><strong>₹${Number(r.net_salary).toLocaleString('en-IN')}</strong></td>
        <td><span class="status-badge ${r.status}">${r.status}</span></td>
        <td class="actions-cell">
            <button class="btn-icon" title="View" onclick="viewPayslip('${r.id}')"><span class="material-icons-outlined">visibility</span></button>
        </td>
    </tr>`).join('');
    } catch(e) { const t=document.getElementById('payslipsBody'); if(t) t.innerHTML='<tr><td colspan="7" class="empty">Failed to load.</td></tr>'; }
}

function openPayslipModal() { openModal('payslipModal'); }

function calcPayslip() {
    const basic = parseFloat(document.getElementById('psBasic').value) || 0;
    const hra = parseFloat(document.getElementById('psHRA').value) || 0;
    const sa = parseFloat(document.getElementById('psSA').value) || 0;
    const tds = parseFloat(document.getElementById('psTDS').value) || 0;
    const pt = parseFloat(document.getElementById('psPT').value) || 0;
    const gross = basic + hra + sa;
    const pf = Math.round(Math.min(basic, 15000) * 0.12 * 100) / 100;
    const esi = gross <= 21000 ? Math.round(gross * 0.0075 * 100) / 100 : 0;
    const net = gross - pf - esi - tds - pt;
    document.getElementById('calcGross').textContent = '₹' + gross.toLocaleString('en-IN');
    document.getElementById('calcPF').textContent = '₹' + pf.toLocaleString('en-IN');
    document.getElementById('calcESI').textContent = '₹' + esi.toLocaleString('en-IN');
    document.getElementById('calcNet').textContent = '₹' + net.toLocaleString('en-IN');
}

async function savePayslip() {
    try {
    const body = {
        employee_id: document.getElementById('psEmp').value,
        period_month: parseInt(document.getElementById('psMonth').value),
        period_year: parseInt(document.getElementById('psYear').value),
        basic: parseFloat(document.getElementById('psBasic').value) || 0,
        hra: parseFloat(document.getElementById('psHRA').value) || 0,
        special_allowance: parseFloat(document.getElementById('psSA').value) || 0,
        tds: parseFloat(document.getElementById('psTDS').value) || 0,
        professional_tax: parseFloat(document.getElementById('psPT').value) || 0,
        lop_days: parseFloat(document.getElementById('psLOP').value) || 0,
        working_days: parseInt(document.getElementById('psWD').value) || 26,
        present_days: parseInt(document.getElementById('psPD').value) || 26
    };
    if (!body.employee_id) { alert('Select employee'); return; }
    const res = await fetch(`${API}/payslips`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    const data = await safeJson(res);
    if (data.success) { closeModal('payslipModal'); loadPayslips(); alert(`Payslip generated. Net: ₹${data.data.net_salary}`); } else { alert(data.message); }
    } catch(e) { alert('Error: ' + e.message); }
}

async function viewPayslip(id) {
    try {
    const res = await fetch(`${API}/payslips/${id}`, { headers: headers() });
    const data = await safeJson(res);
    if (!data.success) { alert(data.message); return; }
    const p = data.data;
    const months = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
    document.getElementById('payslipViewBody').innerHTML = `
        <div style="font-family:monospace;padding:16px">
            <div style="text-align:center;margin-bottom:16px"><h3>PAYSLIP - ${months[p.period_month]} ${p.period_year}</h3></div>
            <div class="emp-detail-grid">
                <div class="detail-section"><h4>Employee</h4>
                    <div class="detail-row"><span>Code:</span><strong>${p.emp_code}</strong></div>
                    <div class="detail-row"><span>Name:</span><span>${p.employee_name}</span></div>
                    <div class="detail-row"><span>Designation:</span><span>${p.designation}</span></div>
                    <div class="detail-row"><span>Working Days:</span><span>${p.working_days}</span></div>
                    <div class="detail-row"><span>Present Days:</span><span>${p.present_days}</span></div>
                </div>
                <div class="detail-section"><h4>Earnings</h4>
                    <div class="detail-row"><span>Basic:</span><span>₹${Number(p.basic).toLocaleString('en-IN')}</span></div>
                    <div class="detail-row"><span>HRA:</span><span>₹${Number(p.hra).toLocaleString('en-IN')}</span></div>
                    <div class="detail-row"><span>Special Allowance:</span><span>₹${Number(p.special_allowance).toLocaleString('en-IN')}</span></div>
                    <div class="detail-row" style="border-top:1px solid var(--border);padding-top:8px"><span><strong>Gross:</strong></span><strong>₹${Number(p.gross_salary).toLocaleString('en-IN')}</strong></div>
                </div>
                <div class="detail-section"><h4>Deductions</h4>
                    <div class="detail-row"><span>PF (Employee 12%):</span><span>₹${Number(p.pf_employee).toLocaleString('en-IN')}</span></div>
                    <div class="detail-row"><span>ESI (Employee 0.75%):</span><span>₹${Number(p.esi_employee).toLocaleString('en-IN')}</span></div>
                    <div class="detail-row"><span>TDS:</span><span>₹${Number(p.tds).toLocaleString('en-IN')}</span></div>
                    <div class="detail-row"><span>Professional Tax:</span><span>₹${Number(p.professional_tax).toLocaleString('en-IN')}</span></div>
                    ${p.lop_days > 0 ? `<div class="detail-row"><span>LOP (${p.lop_days} days):</span><span>₹${Number(p.lop_amount).toLocaleString('en-IN')}</span></div>` : ''}
                    <div class="detail-row" style="border-top:1px solid var(--border);padding-top:8px"><span><strong>Total Deductions:</strong></span><strong>₹${Number(p.total_deductions).toLocaleString('en-IN')}</strong></div>
                </div>
                <div class="detail-section"><h4>Employer Contributions</h4>
                    <div class="detail-row"><span>PF Employer (EPF):</span><span>₹${Number(p.pf_employer).toLocaleString('en-IN')}</span></div>
                    <div class="detail-row"><span>EPS Employer:</span><span>₹${Number(p.eps_employer).toLocaleString('en-IN')}</span></div>
                    <div class="detail-row"><span>ESI Employer (3.25%):</span><span>₹${Number(p.esi_employer).toLocaleString('en-IN')}</span></div>
                </div>
            </div>
            <div style="background:var(--bg-secondary);padding:16px;border-radius:8px;text-align:center;margin-top:16px;font-size:1.2em">
                <strong>Net Salary: ₹${Number(p.net_salary).toLocaleString('en-IN')}</strong>
                <span class="status-badge ${p.status}" style="margin-left:12px">${p.status}</span>
            </div>
        </div>`;
    openModal('payslipViewModal');
    } catch(e) { alert('Error: ' + e.message); }
}

async function loadSalaries() {
    try {
    const res = await fetch(`${API}/salary-structures`, { headers: headers() });
    const data = await safeJson(res);
    salStructures = data.data || [];
    const tbody = document.getElementById('salariesBody');
    if (!salStructures.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">No salary structures</td></tr>'; return; }
    tbody.innerHTML = salStructures.map(s => `<tr>
        <td><strong>${s.name}</strong></td>
        <td>${s.description}</td>
        <td>${(s.components||[]).length} components</td>
        <td class="actions-cell">
            <button class="btn-icon" onclick="editSalary('${s.id}')"><span class="material-icons-outlined">edit</span></button>
            <button class="btn-icon danger" onclick="deleteSalary('${s.id}','${s.name}')"><span class="material-icons-outlined">delete</span></button>
        </td>
    </tr>`).join('');
    } catch(e) { const t=document.getElementById('salariesBody'); if(t) t.innerHTML='<tr><td colspan="4" class="empty">Failed to load.</td></tr>'; }
}

function openSalaryModal() {
    document.getElementById('salId').value = '';
    document.getElementById('salModalTitle').textContent = 'New Salary Structure';
    document.getElementById('salName').value = '';
    document.getElementById('salDesc').value = '';
    openModal('salaryModal');
}

function editSalary(id) {
    const s = salStructures.find(x => x.id === id);
    if (!s) return;
    document.getElementById('salId').value = s.id;
    document.getElementById('salModalTitle').textContent = 'Edit Salary Structure';
    document.getElementById('salName').value = s.name;
    document.getElementById('salDesc').value = s.description;
    openModal('salaryModal');
}

async function saveSalary() {
    const id = document.getElementById('salId').value;
    const body = { name: document.getElementById('salName').value.trim(), description: document.getElementById('salDesc').value.trim() };
    if (!body.name) { alert('Name required'); return; }
    try {
        const url = id ? `${API}/salary-structures/${id}` : `${API}/salary-structures`;
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(body) });
        const data = await safeJson(res);
        if (data.success) { closeModal('salaryModal'); loadSalaries(); } else { alert(data.message); }
    } catch(e) { alert('Error: ' + e.message); }
}

async function deleteSalary(id, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
        const res = await fetch(`${API}/salary-structures/${id}`, { method: 'DELETE', headers: headers() });
        const data = await safeJson(res);
        if (data.success) loadSalaries(); else alert(data.message);
    } catch(e) { alert('Error: ' + e.message); }
}

async function loadPF() {
    const month = document.getElementById('pfMonth').value;
    const year = document.getElementById('pfYear').value;
    try {
    const res = await fetch(`${API}/pf-contributions`, { headers: headers() });
    const data = await safeJson(res);
    const rows = (data.data || []).filter(r => r.period_month == month && r.period_year == year);
    const tbody = document.getElementById('pfBody');
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No PF data for this period</td></tr>'; return; }
    tbody.innerHTML = rows.map(r => `<tr>
        <td>${r.emp_code}</td><td>${r.uan_number || '—'}</td>
        <td>${r.period_month}/${r.period_year}</td>
        <td>₹${Number(r.pf_wage).toLocaleString('en-IN')}</td>
        <td>₹${Number(r.employee_contribution).toLocaleString('en-IN')}</td>
        <td>₹${Number(r.employer_epf).toLocaleString('en-IN')}</td>
        <td>₹${Number(r.employer_eps).toLocaleString('en-IN')}</td>
        <td><strong>₹${Number(r.total_contribution).toLocaleString('en-IN')}</strong></td>
    </tr>`).join('');
    } catch(e) { const t=document.getElementById('pfBody'); if(t) t.innerHTML='<tr><td colspan="8" class="empty">Failed to load.</td></tr>'; }
}

async function loadTax() {
    const fy = document.getElementById('taxFY').value;
    try {
    const res = await fetch(`${API}/tax-declarations`, { headers: headers() });
    const data = await safeJson(res);
    const rows = (data.data || []).filter(r => !fy || r.financial_year === fy);
    const tbody = document.getElementById('taxBody');
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="9" class="empty">No declarations</td></tr>'; return; }
    tbody.innerHTML = rows.map(r => `<tr>
        <td><strong>${r.emp_code}</strong> ${r.employee_name}</td>
        <td>${r.financial_year}</td><td>${r.tax_regime}</td>
        <td>₹${Number(r.section_80c).toLocaleString('en-IN')}</td>
        <td>₹${Number(r.section_80d).toLocaleString('en-IN')}</td>
        <td>₹${Number(r.hra_exemption).toLocaleString('en-IN')}</td>
        <td>₹${Number(r.total_declared).toLocaleString('en-IN')}</td>
        <td><span class="status-badge ${r.status}">${r.status}</span></td>
        <td class="actions-cell">
            ${r.status === 'submitted' ? `<button class="btn-icon" title="Verify" onclick="verifyTax('${r.id}')"><span class="material-icons-outlined" style="color:#4caf50">verified</span></button>` : ''}
        </td>
    </tr>`).join('');
    } catch(e) { const t=document.getElementById('taxBody'); if(t) t.innerHTML='<tr><td colspan="9" class="empty">Failed to load.</td></tr>'; }
}

function openTaxModal() { openModal('taxModal'); }

async function saveTax() {
    const body = {
        employee_id: document.getElementById('taxEmp').value,
        financial_year: document.getElementById('taxFYInput').value.trim(),
        tax_regime: document.getElementById('taxRegime').value,
        section_80c: parseFloat(document.getElementById('tax80C').value) || 0,
        section_80d: parseFloat(document.getElementById('tax80D').value) || 0,
        hra_exemption: parseFloat(document.getElementById('taxHRA').value) || 0
    };
    if (!body.employee_id || !body.financial_year) { alert('Employee and FY required'); return; }
    try {
        const res = await fetch(`${API}/tax-declarations`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
        const data = await safeJson(res);
        if (data.success) { closeModal('taxModal'); loadTax(); } else { alert(data.message); }
    } catch(e) { alert('Error: ' + e.message); }
}

async function verifyTax(id) {
    if (!confirm('Mark this declaration as verified?')) return;
    try {
        const res = await fetch(`${API}/tax-declarations/${id}/verify`, { method: 'POST', headers: headers() });
        const data = await safeJson(res);
        if (data.success) loadTax(); else alert(data.message);
    } catch(e) { alert('Error: ' + e.message); }
}

document.addEventListener('DOMContentLoaded', () => {
    initSelects();
    loadEmp();
    loadRuns();
});
