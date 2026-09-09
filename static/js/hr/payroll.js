// ─── EXECUTIVE PAYROLL & COMPLIANCE JS CONTROLLER ───

let payrollMaster = {
    summary: {},
    runs: [],
    payslips: [],
    salary_structures: [],
    pf_contributions: [],
    tax_declarations: [],
    recent_history: []
};

let currentTab = 'runs';

async function safeJson(res) {
    try {
        return await res.json();
    } catch(e) {
        return { success: false, message: 'Server communication error', data: [] };
    }
}

function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
}

// ─── INITIALIZATION ───
document.addEventListener('DOMContentLoaded', () => {
    initSelectOptions();
    loadAllPayrollData();
});

function initSelectOptions() {
    const now = new Date();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    
    // Month dropdowns
    ['runMonth', 'batchMonth', 'psMonth', 'pfMonth', 'psMonthFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const defaultSelected = now.getMonth() + 1;
        const options = id === 'psMonthFilter' ? '<option value="">All Months</option>' : '';
        el.innerHTML = options + months.map((m, i) => `<option value="${i+1}" ${i+1 === defaultSelected ? 'selected' : ''}>${m}</option>`).join('');
    });

    // Year dropdowns
    const curYear = now.getFullYear();
    const years = [curYear - 1, curYear, curYear + 1];
    ['runYear', 'batchYear', 'psYear', 'pfYear', 'psYearFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const options = id === 'psYearFilter' ? '<option value="">All Years</option>' : '';
        el.innerHTML = options + years.map(y => `<option value="${y}" ${y === curYear ? 'selected' : ''}>${y}</option>`).join('');
    });

    // Tax FY
    const taxFY = document.getElementById('taxFY');
    if (taxFY) {
        taxFY.innerHTML = '<option value="">All Financial Years</option>' +
            [`${curYear-1}-${String(curYear).slice(2)}`, `${curYear}-${String(curYear+1).slice(2)}`]
            .map(f => `<option value="${f}">${f}</option>`).join('');
    }
}

// ─── MASTER DATA FETCH ───
async function loadAllPayrollData() {
    try {
        const res = await fetch(`${API}/payroll`, { headers: headers() });
        const data = await safeJson(res);
        if (!data.success) {
            console.warn('Master payroll API warning:', data.message);
            return;
        }

        payrollMaster = data.data || {};
        renderKPIs(payrollMaster.summary || {});
        renderTabCounts();
        renderActiveTab();
        loadEmployeesDropdown();
    } catch(e) {
        console.error('loadAllPayrollData error:', e);
    }
}

function renderKPIs(s) {
    const formatINR = (val) => '₹' + Number(val || 0).toLocaleString('en-IN');
    
    const kpiNet = document.getElementById('kpiNetPay');
    if (kpiNet) kpiNet.textContent = formatINR(s.total_net);

    const kpiGross = document.getElementById('kpiGrossPay');
    if (kpiGross) kpiGross.textContent = 'Gross Disbursed: ' + formatINR(s.total_gross);

    const kpiRuns = document.getElementById('kpiRunsCount');
    if (kpiRuns) kpiRuns.textContent = (s.active_runs || 0) + (s.finalized_runs || 0);

    const kpiRunsStat = document.getElementById('kpiRunsStatus');
    if (kpiRunsStat) kpiRunsStat.textContent = `${s.finalized_runs || 0} Finalized • ${s.active_runs || 0} Draft`;

    const kpiEmp = document.getElementById('kpiEmpCount');
    if (kpiEmp) kpiEmp.textContent = s.total_employees || 0;

    const kpiPF = document.getElementById('kpiPF');
    if (kpiPF) kpiPF.textContent = formatINR(s.total_pf_ytd);

    const kpiTaxVer = document.getElementById('kpiTaxVerified');
    if (kpiTaxVer) kpiTaxVer.textContent = s.tax_verified || 0;

    const kpiTaxPend = document.getElementById('kpiTaxPending');
    if (kpiTaxPend) kpiTaxPend.textContent = `${s.tax_pending || 0} Pending Verification`;
}

function renderTabCounts() {
    const setBadge = (id, count) => {
        const el = document.getElementById(id);
        if (el) el.textContent = count || 0;
    };
    setBadge('count-runs', (payrollMaster.runs || []).length);
    setBadge('count-payslips', (payrollMaster.payslips || []).length);
    setBadge('count-salaries', (payrollMaster.salary_structures || []).length);
    setBadge('count-pf', (payrollMaster.pf_contributions || []).length);
    setBadge('count-tax', (payrollMaster.tax_declarations || []).length);
    setBadge('count-history', (payrollMaster.recent_history || []).length);
}

// ─── TAB SWITCHING ───
function switchPayrollTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.hr-seg-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    const btn = document.getElementById(`seg-${tabName}`);
    if (btn) btn.classList.add('active');

    const panel = document.getElementById(`tab-${tabName}`);
    if (panel) panel.classList.add('active');

    renderActiveTab();
}

function renderActiveTab() {
    if (currentTab === 'runs') renderRunsTable();
    if (currentTab === 'payslips') renderPayslipsTable();
    if (currentTab === 'salaries') renderSalariesTable();
    if (currentTab === 'pf') renderPFTable();
    if (currentTab === 'tax') renderTaxTable();
    if (currentTab === 'history') renderHistoryTab();
}

// ─── RUNS ───
function renderRunsTable() {
    const tbody = document.getElementById('runsBody');
    if (!tbody) return;
    const q = (document.getElementById('searchRuns')?.value || '').toLowerCase();
    const st = document.getElementById('filterRunStatus')?.value || '';

    const months = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let list = payrollMaster.runs || [];
    if (q) list = list.filter(r => `${months[r.period_month]} ${r.period_year}`.toLowerCase().includes(q) || (r.status||'').toLowerCase().includes(q));
    if (st) list = list.filter(r => r.status === st);

    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">No payroll runs found. Click "New Payroll Run" to start.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(r => `<tr>
        <td><strong>${months[r.period_month]} ${r.period_year}</strong></td>
        <td><span class="hr-pill ${r.status}">${r.status}</span></td>
        <td><span class="material-icons-outlined" style="font-size:15px;vertical-align:middle;color:var(--text-secondary)">person</span> ${r.total_employees}</td>
        <td>₹${Number(r.total_gross).toLocaleString('en-IN')}</td>
        <td>₹${Number(r.total_deductions).toLocaleString('en-IN')}</td>
        <td><strong style="color:#2e7d32">₹${Number(r.total_net).toLocaleString('en-IN')}</strong></td>
        <td>${r.finalized_by || '—'}</td>
        <td class="actions-cell">
            ${r.status !== 'finalized' ? `
                <button class="btn-icon" title="Batch Generate Payslips" onclick="quickBatchForRun('${r.id}', ${r.period_month}, ${r.period_year})">
                    <span class="material-icons-outlined" style="color:#2563eb">flash_on</span>
                </button>
                <button class="btn-icon" title="Finalize and Lock" onclick="finalizeRun('${r.id}')">
                    <span class="material-icons-outlined" style="color:#4caf50">lock</span>
                </button>
            ` : '<span class="material-icons-outlined" style="color:#4caf50;font-size:18px" title="Finalized">lock</span>'}
        </td>
    </tr>`).join('');
}

function filterRuns() { renderRunsTable(); }
function openRunModal() { openModal('runModal'); }

async function saveRun() {
    const month = parseInt(document.getElementById('runMonth').value);
    const year = parseInt(document.getElementById('runYear').value);
    try {
        const res = await fetch(`${API}/payroll-runs`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ period_month: month, period_year: year })
        });
        const data = await safeJson(res);
        if (data.success) {
            closeModal('runModal');
            await loadAllPayrollData();
            alert('Payroll run created successfully!');
        } else {
            alert(data.message);
        }
    } catch(e) {
        alert('Error: ' + e.message);
    }
}

async function finalizeRun(id) {
    if (!confirm('Finalize this payroll run? This will lock all associated payslips.')) return;
    try {
        const res = await fetch(`${API}/payroll-runs/${id}/finalize`, { method: 'POST', headers: headers() });
        const data = await safeJson(res);
        if (data.success) {
            await loadAllPayrollData();
            alert('Payroll run finalized successfully.');
        } else {
            alert(data.message);
        }
    } catch(e) {
        alert('Error: ' + e.message);
    }
}

// ─── BATCH PAYSLIPS ───
function openBatchPayslipModal() { openModal('batchModal'); }

function quickBatchForRun(runId, month, year) {
    document.getElementById('batchMonth').value = month;
    document.getElementById('batchYear').value = year;
    openModal('batchModal');
}

async function executeBatchGenerate() {
    const month = parseInt(document.getElementById('batchMonth').value);
    const year = parseInt(document.getElementById('batchYear').value);
    try {
        const res = await fetch(`${API}/payroll/batch-payslips`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ period_month: month, period_year: year })
        });
        const data = await safeJson(res);
        if (data.success) {
            closeModal('batchModal');
            await loadAllPayrollData();
            alert(data.message || 'Payslips generated successfully.');
        } else {
            alert(data.message);
        }
    } catch(e) {
        alert('Error: ' + e.message);
    }
}

// ─── PAYSLIPS ───
function renderPayslipsTable() {
    const tbody = document.getElementById('payslipsBody');
    if (!tbody) return;
    const q = (document.getElementById('psEmpFilter')?.value || '').toLowerCase();
    const m = document.getElementById('psMonthFilter')?.value;
    const y = document.getElementById('psYearFilter')?.value;

    let list = payrollMaster.payslips || [];
    if (q) list = list.filter(p => p.employee_name.toLowerCase().includes(q) || p.emp_code.toLowerCase().includes(q));
    if (m) list = list.filter(p => String(p.period_month) === String(m));
    if (y) list = list.filter(p => String(p.period_year) === String(y));

    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">No payslips found for this period. Click "Generate Individual Payslip" or "Batch Generate".</td></tr>';
        return;
    }

    const months = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    tbody.innerHTML = list.map(p => `<tr>
        <td><strong>${p.emp_code}</strong> - ${p.employee_name}</td>
        <td>${p.designation || 'Staff'}</td>
        <td>${months[p.period_month]} ${p.period_year}</td>
        <td>₹${Number(p.gross_salary).toLocaleString('en-IN')}</td>
        <td>₹${Number(p.total_deductions).toLocaleString('en-IN')}</td>
        <td><strong style="color:#2e7d32">₹${Number(p.net_salary).toLocaleString('en-IN')}</strong></td>
        <td><span class="hr-pill ${p.status}">${p.status}</span></td>
        <td class="actions-cell">
            <button class="btn-icon" title="View Executive Payslip" onclick="viewPayslip('${p.id}')">
                <span class="material-icons-outlined" style="color:#2563eb">visibility</span>
            </button>
        </td>
    </tr>`).join('');
}

function filterPayslips() { renderPayslipsTable(); }
function openPayslipModal() { calcPayslip(); openModal('payslipModal'); }

function calcPayslip() {
    const basic = parseFloat(document.getElementById('psBasic')?.value) || 0;
    const hra = parseFloat(document.getElementById('psHRA')?.value) || 0;
    const sa = parseFloat(document.getElementById('psSA')?.value) || 0;
    const tds = parseFloat(document.getElementById('psTDS')?.value) || 0;
    const pt = parseFloat(document.getElementById('psPT')?.value) || 0;

    const gross = basic + hra + sa;
    const pf = Math.round(Math.min(basic, 15000) * 0.12 * 100) / 100;
    const esi = gross <= 21000 ? Math.round(gross * 0.0075 * 100) / 100 : 0;
    const net = gross - pf - esi - tds - pt;

    const fmt = (v) => '₹' + Math.max(0, Math.round(v)).toLocaleString('en-IN');
    if (document.getElementById('calcGross')) document.getElementById('calcGross').textContent = fmt(gross);
    if (document.getElementById('calcPF')) document.getElementById('calcPF').textContent = fmt(pf);
    if (document.getElementById('calcESI')) document.getElementById('calcESI').textContent = fmt(esi);
    if (document.getElementById('calcTax')) document.getElementById('calcTax').textContent = fmt(tds + pt);
    if (document.getElementById('calcNet')) document.getElementById('calcNet').textContent = fmt(net);
}

async function savePayslip() {
    const empId = document.getElementById('psEmp').value;
    if (!empId) { alert('Please select an employee'); return; }

    const body = {
        employee_id: empId,
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

    try {
        const res = await fetch(`${API}/payslips`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify(body)
        });
        const data = await safeJson(res);
        if (data.success) {
            closeModal('payslipModal');
            await loadAllPayrollData();
            alert(`Payslip generated successfully! Net salary: ₹${Number(data.data.net_salary).toLocaleString('en-IN')}`);
        } else {
            alert(data.message);
        }
    } catch(e) {
        alert('Error: ' + e.message);
    }
}

// ─── EXECUTIVE PRINTABLE PAYSLIP VIEW ───
async function viewPayslip(id) {
    try {
        const res = await fetch(`${API}/payslips/${id}`, { headers: headers() });
        const data = await safeJson(res);
        if (!data.success) { alert(data.message); return; }

        const p = data.data;
        const months = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

        document.getElementById('payslipViewBody').innerHTML = `
            <div class="payslip-sheet">
                <div class="payslip-header">
                    <div>
                        <div class="payslip-corp-name">SUPERSYSTEMS PRIVATE LIMITED</div>
                        <div class="payslip-corp-sub">Manufacturing & Enterprise Operations • HR Payroll Division</div>
                    </div>
                    <div class="payslip-period-badge">
                        <div class="payslip-period-title">${months[p.period_month]} ${p.period_year}</div>
                        <span class="hr-pill ${p.status}">${p.status}</span>
                    </div>
                </div>

                <div class="payslip-meta-grid">
                    <div class="payslip-meta-item"><span class="payslip-meta-label">Employee Code</span><span class="payslip-meta-val">${p.emp_code}</span></div>
                    <div class="payslip-meta-item"><span class="payslip-meta-label">Employee Name</span><span class="payslip-meta-val">${p.employee_name}</span></div>
                    <div class="payslip-meta-item"><span class="payslip-meta-label">Designation</span><span class="payslip-meta-val">${p.designation || 'Staff'}</span></div>
                    <div class="payslip-meta-item"><span class="payslip-meta-label">Working Days</span><span class="payslip-meta-val">${p.working_days} Days</span></div>
                    <div class="payslip-meta-item"><span class="payslip-meta-label">Present Days</span><span class="payslip-meta-val">${p.present_days} Days</span></div>
                    <div class="payslip-meta-item"><span class="payslip-meta-label">LOP Days</span><span class="payslip-meta-val">${p.lop_days || 0} Days</span></div>
                </div>

                <div class="payslip-split-grid">
                    <!-- EARNINGS -->
                    <div class="payslip-column">
                        <div class="payslip-col-header"><span>Earnings Component</span><span>Amount (INR)</span></div>
                        <div class="payslip-line-row"><span>Basic Salary</span><span>₹${Number(p.basic).toLocaleString('en-IN')}</span></div>
                        <div class="payslip-line-row"><span>House Rent Allowance (HRA)</span><span>₹${Number(p.hra).toLocaleString('en-IN')}</span></div>
                        <div class="payslip-line-row"><span>Special Allowance</span><span>₹${Number(p.special_allowance).toLocaleString('en-IN')}</span></div>
                        <div class="payslip-line-row total-row"><span>Total Gross Earnings</span><span>₹${Number(p.gross_salary).toLocaleString('en-IN')}</span></div>
                    </div>

                    <!-- DEDUCTIONS -->
                    <div class="payslip-column">
                        <div class="payslip-col-header"><span>Deductions Component</span><span>Amount (INR)</span></div>
                        <div class="payslip-line-row"><span>Provident Fund (Employee 12%)</span><span>₹${Number(p.pf_employee).toLocaleString('en-IN')}</span></div>
                        <div class="payslip-line-row"><span>ESI (Employee 0.75%)</span><span>₹${Number(p.esi_employee).toLocaleString('en-IN')}</span></div>
                        <div class="payslip-line-row"><span>Tax Deducted at Source (TDS)</span><span>₹${Number(p.tds).toLocaleString('en-IN')}</span></div>
                        <div class="payslip-line-row"><span>Professional Tax (PT)</span><span>₹${Number(p.professional_tax).toLocaleString('en-IN')}</span></div>
                        ${p.lop_amount > 0 ? `<div class="payslip-line-row"><span>Loss of Pay</span><span>₹${Number(p.lop_amount).toLocaleString('en-IN')}</span></div>` : ''}
                        <div class="payslip-line-row total-row"><span>Total Deductions</span><span>₹${Number(p.total_deductions).toLocaleString('en-IN')}</span></div>
                    </div>
                </div>

                <!-- NET PAY BOX -->
                <div class="payslip-net-box">
                    <div>
                        <div class="payslip-net-label">Net Take Home Pay</div>
                        <div class="payslip-words">Transferred directly to registered corporate bank account</div>
                    </div>
                    <div class="payslip-net-amount">₹${Number(p.net_salary).toLocaleString('en-IN')}</div>
                </div>

                <!-- EMPLOYER CONTRIBUTIONS -->
                <div class="payslip-er-grid">
                    <div><strong>Employer EPF (3.67%):</strong> ₹${Number(p.pf_employer).toLocaleString('en-IN')}</div>
                    <div><strong>Employer EPS (8.33%):</strong> ₹${Number(p.eps_employer).toLocaleString('en-IN')}</div>
                    <div><strong>Employer ESI (3.25%):</strong> ₹${Number(p.esi_employer).toLocaleString('en-IN')}</div>
                </div>
            </div>
        `;
        openModal('payslipViewModal');
    } catch(e) {
        alert('Error viewing payslip: ' + e.message);
    }
}

// ─── SALARY STRUCTURES ───
function renderSalariesTable() {
    const tbody = document.getElementById('salariesBody');
    if (!tbody) return;
    const q = (document.getElementById('searchSalaries')?.value || '').toLowerCase();
    let list = payrollMaster.salary_structures || [];
    if (q) list = list.filter(s => s.name.toLowerCase().includes(q) || (s.description||'').toLowerCase().includes(q));

    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">No salary structures configured. Click "New Salary Structure".</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(s => `<tr>
        <td><strong>${s.name}</strong></td>
        <td>${s.description || '—'}</td>
        <td>
            ${(s.components||[]).map(c => `<span class="hr-pill neutral" style="margin:2px">${c.name || c}</span>`).join('') || '<span style="color:var(--text-secondary)">Standard Components</span>'}
        </td>
        <td><span class="hr-pill ${s.is_active ? 'active' : 'inactive'}">${s.is_active ? 'Active' : 'Inactive'}</span></td>
        <td class="actions-cell">
            <button class="btn-icon" title="Edit" onclick="editSalary('${s.id}')"><span class="material-icons-outlined">edit</span></button>
            <button class="btn-icon danger" title="Delete" onclick="deleteSalary('${s.id}','${s.name}')"><span class="material-icons-outlined">delete</span></button>
        </td>
    </tr>`).join('');
}

function filterSalaries() { renderSalariesTable(); }
function openSalaryModal() {
    document.getElementById('salId').value = '';
    document.getElementById('salModalTitle').textContent = 'New Salary Structure';
    document.getElementById('salName').value = '';
    document.getElementById('salDesc').value = '';
    openModal('salaryModal');
}

function editSalary(id) {
    const s = (payrollMaster.salary_structures || []).find(x => x.id === id);
    if (!s) return;
    document.getElementById('salId').value = s.id;
    document.getElementById('salModalTitle').textContent = 'Edit Salary Structure';
    document.getElementById('salName').value = s.name;
    document.getElementById('salDesc').value = s.description;
    openModal('salaryModal');
}

async function saveSalary() {
    const id = document.getElementById('salId').value;
    const name = document.getElementById('salName').value.trim();
    const desc = document.getElementById('salDesc').value.trim();
    if (!name) { alert('Structure name is required'); return; }

    const components = [
        { name: 'Basic', percent: 50 },
        { name: 'HRA', percent: 25 },
        { name: 'Special Allowance', percent: 25 }
    ];

    try {
        const url = id ? `${API}/salary-structures/${id}` : `${API}/salary-structures`;
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method: method,
            headers: headers(),
            body: JSON.stringify({ name: name, description: desc, components: components })
        });
        const data = await safeJson(res);
        if (data.success) {
            closeModal('salaryModal');
            await loadAllPayrollData();
            alert('Salary structure saved.');
        } else {
            alert(data.message);
        }
    } catch(e) {
        alert('Error: ' + e.message);
    }
}

async function deleteSalary(id, name) {
    if (!confirm(`Delete salary structure "${name}"?`)) return;
    try {
        const res = await fetch(`${API}/salary-structures/${id}`, { method: 'DELETE', headers: headers() });
        const data = await safeJson(res);
        if (data.success) {
            await loadAllPayrollData();
            alert('Salary structure deleted.');
        } else {
            alert(data.message);
        }
    } catch(e) {
        alert('Error: ' + e.message);
    }
}

// ─── PF CONTRIBUTIONS ───
function renderPFTable() {
    const tbody = document.getElementById('pfBody');
    if (!tbody) return;
    const m = document.getElementById('pfMonth')?.value;
    const y = document.getElementById('pfYear')?.value;
    const q = (document.getElementById('searchPF')?.value || '').toLowerCase();

    let list = payrollMaster.pf_contributions || [];
    if (m) list = list.filter(p => String(p.period_month) === String(m));
    if (y) list = list.filter(p => String(p.period_year) === String(y));
    if (q) list = list.filter(p => (p.employee_name||'').toLowerCase().includes(q) || (p.emp_code||'').toLowerCase().includes(q) || (p.uan_number||'').toLowerCase().includes(q));

    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">No PF records for this month. Click "Auto-Generate PF from Payslips" to compute automatically.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(p => `<tr>
        <td><strong>${p.emp_code}</strong> ${p.employee_name ? '- ' + p.employee_name : ''}</td>
        <td>${p.uan_number || '—'}</td>
        <td>${p.period_month}/${p.period_year}</td>
        <td>₹${Number(p.pf_wage).toLocaleString('en-IN')}</td>
        <td>₹${Number(p.employee_contribution).toLocaleString('en-IN')}</td>
        <td>₹${Number(p.employer_epf).toLocaleString('en-IN')}</td>
        <td>₹${Number(p.employer_eps).toLocaleString('en-IN')}</td>
        <td><strong style="color:#7b1fa2">₹${Number(p.total_contribution).toLocaleString('en-IN')}</strong></td>
    </tr>`).join('');
}

function filterPF() { renderPFTable(); }

async function triggerAutoPF() {
    const m = parseInt(document.getElementById('pfMonth').value);
    const y = parseInt(document.getElementById('pfYear').value);
    try {
        const res = await fetch(`${API}/payroll/auto-pf`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ period_month: m, period_year: y })
        });
        const data = await safeJson(res);
        if (data.success) {
            await loadAllPayrollData();
            alert(data.message);
        } else {
            alert(data.message);
        }
    } catch(e) {
        alert('Error: ' + e.message);
    }
}

// ─── TAX DECLARATIONS ───
function renderTaxTable() {
    const tbody = document.getElementById('taxBody');
    if (!tbody) return;
    const fy = document.getElementById('taxFY')?.value;
    const st = document.getElementById('taxStatusFilter')?.value;
    const q = (document.getElementById('searchTax')?.value || '').toLowerCase();

    let list = payrollMaster.tax_declarations || [];
    if (fy) list = list.filter(t => t.financial_year === fy);
    if (st) list = list.filter(t => t.status === st);
    if (q) list = list.filter(t => t.employee_name.toLowerCase().includes(q) || t.emp_code.toLowerCase().includes(q));

    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty">No tax declarations found. Click "New Tax Declaration".</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(t => `<tr>
        <td><strong>${t.emp_code}</strong> - ${t.employee_name}</td>
        <td>${t.financial_year}</td>
        <td><span class="hr-pill neutral">${t.tax_regime.toUpperCase()}</span></td>
        <td>₹${Number(t.section_80c).toLocaleString('en-IN')}</td>
        <td>₹${Number(t.section_80d).toLocaleString('en-IN')}</td>
        <td>₹${Number(t.hra_exemption).toLocaleString('en-IN')}</td>
        <td><strong>₹${Number(t.total_declared).toLocaleString('en-IN')}</strong></td>
        <td><span class="hr-pill ${t.status}">${t.status}</span></td>
        <td class="actions-cell">
            ${t.status === 'submitted' ? `
                <button class="btn-icon" title="Verify Declaration" onclick="verifyTax('${t.id}')">
                    <span class="material-icons-outlined" style="color:#2e7d32">verified</span>
                </button>
            ` : '<span class="material-icons-outlined" style="color:#2e7d32;font-size:18px" title="Verified">verified</span>'}
        </td>
    </tr>`).join('');
}

function filterTax() { renderTaxTable(); }
function openTaxModal() { openModal('taxModal'); }

async function saveTax() {
    const empId = document.getElementById('taxEmp').value;
    const fy = document.getElementById('taxFYInput').value.trim();
    if (!empId || !fy) { alert('Employee and Financial Year required'); return; }

    const body = {
        employee_id: empId,
        financial_year: fy,
        tax_regime: document.getElementById('taxRegime').value,
        section_80c: parseFloat(document.getElementById('tax80C').value) || 0,
        section_80d: parseFloat(document.getElementById('tax80D').value) || 0,
        hra_exemption: parseFloat(document.getElementById('taxHRA').value) || 0
    };

    try {
        const res = await fetch(`${API}/tax-declarations`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify(body)
        });
        const data = await safeJson(res);
        if (data.success) {
            closeModal('taxModal');
            await loadAllPayrollData();
            alert('Tax declaration submitted.');
        } else {
            alert(data.message);
        }
    } catch(e) {
        alert('Error: ' + e.message);
    }
}

async function verifyTax(id) {
    if (!confirm('Verify and approve this employee tax declaration?')) return;
    try {
        const res = await fetch(`${API}/tax-declarations/${id}/verify`, { method: 'POST', headers: headers() });
        const data = await safeJson(res);
        if (data.success) {
            await loadAllPayrollData();
            alert('Tax declaration verified successfully.');
        } else {
            alert(data.message);
        }
    } catch(e) {
        alert('Error: ' + e.message);
    }
}

// ─── AUDIT HISTORY TAB ───
function renderHistoryTab() {
    const container = document.getElementById('payrollHistoryContainer');
    if (!container) return;
    const q = (document.getElementById('searchHistory')?.value || '').toLowerCase();
    let logs = payrollMaster.recent_history || [];

    if (q) {
        logs = logs.filter(l => (l.user_email||'').toLowerCase().includes(q) ||
            (l.action||'').toLowerCase().includes(q) ||
            (l.entity_type||'').toLowerCase().includes(q) ||
            (l.entity_name||'').toLowerCase().includes(q));
    }

    if (!logs.length) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)">No audit logs recorded for Payroll & Compliance.</div>';
        return;
    }

    container.innerHTML = logs.map(l => {
        const changes = l.changes || {};
        const keys = Object.keys(changes);
        return `
            <div class="hr-item-card">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div style="display:flex;gap:8px;align-items:center">
                        <span class="hr-pill ${l.action.toLowerCase()}">${l.action}</span>
                        <strong>${l.entity_type}:</strong> <span>${l.entity_name || '—'}</span>
                    </div>
                    <span style="font-size:11px;color:var(--text-secondary)">${l.created_at || ''}</span>
                </div>
                <div style="font-size:12px;color:var(--text-secondary)">
                    <span class="material-icons-outlined" style="font-size:14px;vertical-align:middle">person</span>
                    <strong>${l.user_email}</strong> ${l.user_name ? `(${l.user_name})` : ''} • IP: ${l.ip_address || '—'}
                </div>
                ${keys.length > 0 ? `
                    <div class="history-diff-box" style="margin-top:6px">
                        ${keys.map(k => `
                            <div class="history-diff-row">
                                <span class="history-diff-key">${k}:</span>
                                <span class="history-diff-old">${changes[k].old !== undefined ? changes[k].old : '—'}</span>
                                <span class="history-diff-arrow">→</span>
                                <span class="history-diff-new">${changes[k].new !== undefined ? changes[k].new : '—'}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function filterHistoryTab() { renderHistoryTab(); }

// ─── EXPORT CSV ───
function openExportModal() { openModal('exportModal'); }

function downloadExportCSV() {
    const type = document.getElementById('exportSelect').value;
    closeModal('exportModal');
    window.location.href = `${API}/payroll/export?type=${type}`;
}

// ─── EMPLOYEES DROPDOWN ───
async function loadEmployeesDropdown() {
    try {
        const res = await fetch(`${API}/employees`, { headers: headers() });
        const data = await safeJson(res);
        const list = data.data || [];
        const opts = '<option value="">Select Employee</option>' +
            list.map(e => `<option value="${e.id}">${e.emp_code} - ${e.first_name} ${e.last_name || ''}</option>`).join('');

        ['psEmp', 'taxEmp'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = opts;
        });
    } catch(e) {
        console.warn('loadEmployeesDropdown:', e);
    }
}

function onEmployeeSelect(empId) {
    calcPayslip();
}
