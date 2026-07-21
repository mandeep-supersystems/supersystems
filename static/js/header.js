// Global HTML Escaper
if (typeof window.esc !== 'function') {
    window.esc = function esc(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };
}

// All services ordered by row layout
const services = [
    // ─── ROW 1 ───
    {
        name: "Auth & Security",
        icon: "security",
        comingSoon: false,
        route: "/auth",
        items: [
            { label: "Overview", route: "/auth/overview" },
            { label: "Users", route: "/auth/users" },
            { label: "Module Access", route: "/auth/modules" },
            { label: "Roles & Permissions", route: "/auth/roles" },
            { label: "Permission Matrix", route: "/auth/matrix" },
            { label: "Audit Logs", route: "/auth/auditlogs" }
        ]
    },
    {
        name: "Part Management",
        icon: "settings_input_component",
        comingSoon: false,
        route: "/part",
        items: [
            { label: "Overview", route: "/part/overview" },
            { label: "Categories", route: "/part/categories" },
            { label: "Subcategories", route: "/part/subcategories" },
            { label: "Generate Part Code", route: "/part/generate" },
            { label: "All Parts", route: "/part/allparts" },
            { label: "Part Mapping", route: "/part/partmapping" },
            { label: "Audit Logs", route: "/part/auditlogs" },
            { label: "Obsolete Parts", route: "/part/obsolete" }
        ]
    },
    {
        name: "RM Management",
        icon: "science",
        comingSoon: false,
        route: "/rawmaterial",
        items: [
            { label: "Overview", route: "/rawmaterial/overview" },
            { label: "RM Code Criteria", route: "/rawmaterial/criteria" },
            { label: "RM Master", route: "/rawmaterial/master" },
            { label: "RM-Part Mapping", route: "/rawmaterial/partmapping" },
            "RM Inventory"
        ]
    },
    {
        name: "Inventory Management",
        icon: "inventory_2",
        comingSoon: false,
        route: "/inventory",
        items: [
            { label: "Overview", route: "/inventory/overview" },
            { label: "Stock Check-In", route: "/inventory/checkin" },
            { label: "Stock Levels", route: "/inventory/stocklevels" },
            { label: "Hierarchical Locations", route: "/inventory/locations" },
            { label: "Stock Movements", route: "/inventory/stockmovements" },
            { label: "Stock Transfers", route: "/inventory/transfers" },
            { label: "Stock Adjustments", route: "/inventory/adjustments" },
            { label: "Stock Counts", route: "/inventory/counts" },
            { label: "Batch Tracking", route: "/inventory/batches" },
            { label: "Serial Numbers", route: "/inventory/serials" },
            { label: "Reorder Rules", route: "/inventory/reorder" },
            { label: "Valuation & Reports", route: "/inventory/reports" },
            { label: "Audit Logs", route: "/inventory/auditlogs" },
            { label: "Module Users", route: "/inventory/moduleusers" }
        ]
    },
    {
        name: "Warehouse Management",
        icon: "warehouse",
        comingSoon: false,
        route: "/warehouse",
        items: [
            { label: "Overview", route: "/warehouse/overview" },
            { label: "Warehouse Zones", route: "/warehouse/zones" },
            { label: "Bin Management", route: "/warehouse/bins" },
            { label: "Pick Lists", route: "/warehouse/picklists" },
            { label: "Putaway", route: "/warehouse/putaway" },
            { label: "Packing", route: "/warehouse/packing" },
            { label: "Shipping", route: "/warehouse/shipping" },
            { label: "Receiving", route: "/warehouse/receiving" },
            { label: "Audit Logs", route: "/warehouse/auditlogs" },
            { label: "Module Users", route: "/warehouse/moduleusers" }
        ]
    },
    {
        name: "Supplier Management",
        icon: "handshake",
        comingSoon: false,
        route: "/supplier",
        items: [
            { label: "All Suppliers", route: "/supplier" },
            { label: "Supplier Evaluation", route: "/supplier/evaluation" },
            { label: "Supplier Contracts", route: "/supplier/contracts" },
            { label: "Performance Scoring", route: "/supplier/performance" }
        ]
    },
    {
        name: "Machine Management",
        icon: "precision_manufacturing",
        comingSoon: false,
        route: "/machine",
        items: [
            { label: "Machines", route: "/machine/machines" },
            { label: "Stations", route: "/machine/stations" },
            { label: "MHR Calculator", route: "/machine/mhr" }
        ]
    },
    {
        name: "Workflow & Costing",
        icon: "account_tree",
        comingSoon: false,
        route: "/workflow",
        items: [
            { label: "Process Routings", route: "/workflow/routings" }
        ]
    },
    {
        name: "Manufacturing",
        icon: "factory",
        comingSoon: false,
        route: "/manufacturing",
        items: [
            { label: "Overview", route: "/manufacturing/overview" },
            { label: "Bill of Materials", route: "/manufacturing/bom" },
            { label: "Production Orders", route: "/manufacturing/productionorders" },
            { label: "Work Centers", route: "/manufacturing/workcenters" },
            { label: "Process Routings", route: "/manufacturing/routing" },
            { label: "Shop Floor Control", route: "/manufacturing/shopfloor" },
            { label: "Production Planning", route: "/manufacturing/planning" },
            { label: "Capacity Planning", route: "/manufacturing/capacity" },
            { label: "Audit Logs", route: "/manufacturing/auditlogs" },
            { label: "Module Users", route: "/manufacturing/moduleusers" }
        ]
    },
    {
        name: "Quality Management",
        icon: "verified",
        comingSoon: false,
        route: "/quality",
        items: [
            { label: "Overview", route: "/quality/overview" },
            { label: "Incoming Quality Control (IQC)", route: "/quality/iqc" },
            { label: "IQC Criteria Master", route: "/quality/criteria" },
            { label: "Non-Conformance Reports (NCR)", route: "/quality/ncr" },
            { label: "Audit Logs", route: "/quality/auditlogs" },
            { label: "Module Users", route: "/quality/moduleusers" }
        ]
    },
    {
        name: "Purchase Management",
        icon: "shopping_cart",
        comingSoon: false,
        route: "/purchase",
        items: [
            { label: "Overview", route: "/purchase/overview" },
            { label: "Demand & Stock", route: "/purchase/demand" },
            { label: "Supplier SOP & SQP", route: "/purchase/suppliers" },
            { label: "Req Orders (Requisitions)", route: "/purchase/requisitions" },
            { label: "Purchase Orders & Lead Time", route: "/purchase/orders" },
            { label: "Audit Logs", route: "/purchase/auditlogs" },
            { label: "Module Users", route: "/purchase/moduleusers" }
        ]
    },
    {
        name: "Product Lifecycle",
        icon: "category",
        comingSoon: true,
        items: [
            "Product Design",
            "Change Requests",
            "Version Control",
            "Product Approvals",
            "PLM Reports"
        ]
    },
    // ─── ROW 2 ───
    {
        name: "Finance",
        icon: "account_balance",
        comingSoon: true,
        items: [
            "General Ledger",
            "Accounts Payable",
            "Accounts Receivable",
            "Journal Entries",
            "Invoicing",
            "Payments",
            "Budgets",
            "Tax Management",
            "Financial Reports"
        ]
    },
    {
        name: "Project Management",
        icon: "assignment",
        comingSoon: false,
        route: "/project",
        items: [
            { label: "Overview", route: "/project/overview" },
            { label: "All Projects", route: "/project/projects" },
            { label: "Add Project", route: "/project/addproject" },
            { label: "Organizations", route: "/project/organizations" },
            { label: "Audit Logs", route: "/project/auditlogs" },
            { label: "User Management", route: "/project/moduleusers" }
        ]
    },
    {
        name: "Quality Management",
        icon: "verified",
        comingSoon: false,
        route: "/quality",
        items: [
            { label: "Overview", route: "/quality/overview" },
            { label: "Incoming Quality Control (IQC)", route: "/quality/iqc" },
            { label: "IQC Criteria Master", route: "/quality/criteria" },
            { label: "Non-Conformance Reports (NCR)", route: "/quality/ncr" },
            { label: "Audit Logs", route: "/quality/auditlogs" },
            { label: "Module Users", route: "/quality/moduleusers" }
        ]
    },
    {
        name: "Logistics",
        icon: "local_shipping",
        comingSoon: true,
        items: [
            "Shipments",
            "Delivery Notes",
            "Fleet Management",
            "Route Planning",
            "Tracking",
            "Freight Management",
            "Logistics Reports"
        ]
    },
    {
        name: "Analytics & Reporting",
        icon: "analytics",
        comingSoon: true,
        items: [
            "KPI Dashboard",
            "Custom Reports",
            "Data Visualization",
            "Scheduled Reports",
            "Export Center",
            "Predictive Analytics"
        ]
    },
    // ─── ROW 3 ───
    {
        name: "Treasury",
        icon: "savings",
        comingSoon: true,
        items: [
            "Bank Accounts",
            "Cash Flow",
            "Bank Reconciliation",
            "Investments",
            "Loans",
            "Treasury Reports"
        ]
    },
    {
        name: "Maintenance",
        icon: "build",
        comingSoon: true,
        items: [
            "Work Orders",
            "Preventive Maintenance",
            "Corrective Maintenance",
            "Spare Parts",
            "Maintenance Schedule",
            "Maintenance Reports"
        ]
    },
    {
        name: "Asset Management",
        icon: "business",
        comingSoon: true,
        items: [
            "Asset Register",
            "Depreciation",
            "Asset Transfers",
            "Asset Disposal",
            "Maintenance Schedule",
            "Asset Reports"
        ]
    },
    {
        name: "Customer Service",
        icon: "support_agent",
        comingSoon: true,
        items: [
            "Tickets",
            "SLA Management",
            "Knowledge Base",
            "Customer Portal",
            "Escalations",
            "Service Reports"
        ]
    },
    {
        name: "Human Resources",
        icon: "people",
        comingSoon: false,
        route: "/hr",
        items: [
            { label: "Employee Code Criteria", route: "/hr/codecriteria" },
            { label: "Employee Management", route: "/hr/employees" },
            "Leave Management",
            "Attendance",
            "Payroll",
            "Recruitment",
            "Performance",
            "Training"
        ]
    },
    // ─── ROW 4+ ───
    {
        name: "Procurement / Purchase",
        icon: "shopping_cart",
        comingSoon: false,
        route: "/purchase",
        items: [
            { label: "Overview", route: "/purchase/overview" },
            { label: "Demand & Stock", route: "/purchase/demand" },
            { label: "Supplier SOP & SQP", route: "/purchase/suppliers" },
            { label: "Req Orders (Requisitions)", route: "/purchase/requisitions" },
            { label: "Purchase Orders & Lead Time", route: "/purchase/orders" },
            { label: "Audit Logs", route: "/purchase/auditlogs" },
            { label: "Module Users", route: "/purchase/moduleusers" }
        ]
    },
    {
        name: "Governance & Risk",
        icon: "shield",
        comingSoon: true,
        items: [
            "Risk Register",
            "Compliance",
            "Audit Management",
            "Policy Management",
            "Incident Management",
            "GRC Reports"
        ]
    },
    {
        name: "EHS",
        icon: "health_and_safety",
        comingSoon: true,
        items: [
            "Incident Reporting",
            "Safety Inspections",
            "Hazard Assessment",
            "Training Records",
            "Environmental Monitoring",
            "EHS Reports"
        ]
    }
];

// Map module names to their routes (for services panel filtering)
const MODULE_ROUTES = {
    'Auth & Security':        '/auth',
    'Part Management':        '/part',
    'RM Management':          '/rawmaterial',
    'Supplier Management':    '/supplier',
    'Machine Management':     '/machine',
    'Workflow & Costing':     '/workflow',
    'Project Management':     '/project',
    'Human Resources':        '/hr',
    'Procurement':            '/procurement',
    'Inventory Management':   '/inventory',
    'Warehouse Management':   '/warehouse',
    'Manufacturing':          '/manufacturing',
    'Product Lifecycle':      '/plm',
    'Finance':                '/finance',
    'Quality Management':     '/quality',
    'Logistics':              '/logistics',
    'Analytics & Reporting':  '/analytics',
    'Treasury':               '/treasury',
    'Maintenance':            '/maintenance',
    'Asset Management':       '/asset',
    'Customer Service':       '/customerservice',
    'Governance & Risk':      '/governance',
    'EHS':                    '/ehs',
};

// Build services grid — filtered by user's module access
async function renderServices() {
    const grid = document.getElementById('servicesGrid');

    // Fetch user's allowed modules from API
    let allowedModules = null; // null = show all (super admin or no token)
    try {
        const token = localStorage.getItem('access_token');
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const identity = typeof payload.sub === 'string' ? JSON.parse(payload.sub) : payload.sub;
            // Super admins see everything
            if (!identity.is_super_admin) {
                const tid = identity.tenant_id || '';
                const uid = identity.user_id || '';
                const email = identity.email || '';
                const res = await fetch('/api/v1/security/user-module-access', {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Tenant-ID': tid,
                        'X-User-ID': uid,
                        'X-User-Email': email
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.show_all) {
                        allowedModules = null; // show everything
                    } else if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                        allowedModules = new Set(data.data.map(m => m.module));
                    }
                }
            }
        }
    } catch (e) { /* fail open */ }

    const visibleServices = allowedModules === null ? services : services.filter(svc => {
        if (allowedModules.has(svc.name)) return true;
        if ((svc.name.includes('Purchase') || svc.name.includes('Procurement')) && 
            (allowedModules.has('Purchase Management') || allowedModules.has('Purchase') || allowedModules.has('Procurement') || allowedModules.has('Procurement / Purchase'))) {
            return true;
        }
        return false;
    });

    grid.innerHTML = visibleServices.map((service, i) => `
        <div class="service-category" id="svc-${i}">
            <div class="service-category-header" onclick="toggleServiceCard(${i})">
                <div class="cat-icon">
                    <span class="material-icons-outlined">${service.icon}</span>
                </div>
                <h4>${service.name}</h4>
                ${service.comingSoon ? '<span class="coming-soon">Coming Soon</span>' : ''}
                <span class="material-icons-outlined svc-toggle-icon">expand_less</span>
            </div>
            <ul class="service-list" id="svc-list-${i}">
                ${(service.items || []).map(item => {
                    const label = typeof item === 'string' ? item : item.label;
                    const route = typeof item === 'object' ? item.route : null;
                    if (route) {
                        return `<li onclick="window.location.href='${route}'" style="cursor:pointer"><span>${label}</span></li>`;
                    }
                    return `<li><span>${label}</span>${service.comingSoon ? '<span class="cs-badge">Soon</span>' : ''}</li>`;
                }).join('')}
            </ul>
        </div>
    `).join('');
}

let servicesExpanded = true;

function toggleServiceCard(index) {
    const list = document.getElementById('svc-list-' + index);
    const card = document.getElementById('svc-' + index);
    card.classList.toggle('collapsed');
    list.style.display = card.classList.contains('collapsed') ? 'none' : '';
}

function toggleAllServices() {
    servicesExpanded = !servicesExpanded;
    document.querySelectorAll('.service-category').forEach((card, i) => {
        const list = document.getElementById('svc-list-' + i);
        if (list) {
            card.classList.toggle('collapsed', !servicesExpanded);
            list.style.display = servicesExpanded ? '' : 'none';
        }
    });
    const btn = document.getElementById('toggleAllServicesBtn');
    if (btn) btn.innerHTML = servicesExpanded
        ? '<span class="material-icons-outlined">unfold_less</span> Collapse All'
        : '<span class="material-icons-outlined">unfold_more</span> Expand All';
}

// Toggle services panel
// Toggle services panel
function toggleServices() {
    const panel = document.getElementById('servicesPanel') || document.getElementById('servicesDrawer');
    const overlay = document.getElementById('overlay');
    const trigger = document.querySelector('.services-trigger') || document.querySelector('.services-btn');

    if (!panel) return;

    panel.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
    if (trigger) trigger.classList.toggle('active');
}

// Global search
function handleSearch(query) {
    const resultsEl = document.getElementById('searchResults');

    if (!query.trim()) {
        resultsEl.classList.remove('active');
        return;
    }

    const q = query.toLowerCase();
    const results = [];

    services.forEach(service => {
        if (service.name.toLowerCase().includes(q)) {
            results.push({
                title: service.name,
                category: 'Service',
                icon: service.icon,
                comingSoon: service.comingSoon,
                route: service.route || null
            });
        }
        service.items.forEach(item => {
            const label = typeof item === 'string' ? item : item.label;
            const route = typeof item === 'object' ? item.route : null;
            if (label.toLowerCase().includes(q)) {
                results.push({
                    title: label,
                    category: service.name,
                    icon: service.icon,
                    comingSoon: service.comingSoon,
                    route: route
                });
            }
        });
    });

    if (results.length === 0) {
        resultsEl.innerHTML = '<div class="search-no-results">No services found</div>';
    } else {
        resultsEl.innerHTML = results.slice(0, 10).map(r => `
            <div class="search-result-item" ${r.route ? `onclick="window.location.href='${r.route}'" style="cursor:pointer"` : ''}>
                <span class="material-icons-outlined sr-icon">${r.icon}</span>
                <div class="sr-text">
                    <div class="sr-title">${r.title}</div>
                    <div class="sr-category">${r.category}</div>
                </div>
                ${r.comingSoon ? '<span class="coming-soon-badge">Coming Soon</span>' : ''}
            </div>
        `).join('');
    }

    resultsEl.classList.add('active');
}

// Close search on click outside
document.addEventListener('click', function (e) {
    const searchBox = document.querySelector('.search-box');
    const resultsEl = document.getElementById('searchResults');
    if (searchBox && searchBox.contains && !searchBox.contains(e.target)) {
        if (resultsEl) resultsEl.classList.remove('active');
    }
});

// Theme toggle
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

// ─── USER MENU ───
function toggleUserMenu() {
    const d = document.getElementById('userDropdown');
    if (d) d.classList.toggle('active');
}

// Close dropdown on outside click
document.addEventListener('click', function(e) {
    const menu = document.getElementById('userMenu');
    const dropdown = document.getElementById('userDropdown');
    if (menu && !menu.contains(e.target) && dropdown) {
        dropdown.classList.remove('active');
    }
});

// ─── MODAL HELPERS ───
function openModal(id) { const el = document.getElementById(id); if (el) el.classList.add('active'); }
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('active'); }

// ─── PROFILE ───
function openProfile() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const tenant = JSON.parse(localStorage.getItem('tenant') || '{}');
    document.getElementById('profileName').textContent = (user.first_name || '') + ' ' + (user.last_name || '') || user.email || '-';
    document.getElementById('profileEmail').textContent = user.email || '-';
    document.getElementById('profileRole').textContent = localStorage.getItem('user_type') === 'super_admin' ? 'Super Admin' : 'Organization User';
    document.getElementById('profileOrg').textContent = tenant.name || '-';
    closeUserDropdown();
    openModal('profileModal');
}

// ─── ACCOUNT ───
function openAccount() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('accFirstName').value = user.first_name || '';
    document.getElementById('accLastName').value = user.last_name || '';
    document.getElementById('accPhone').value = user.phone || '';
    closeUserDropdown();
    openModal('accountModal');
}

async function updateAccount(e) {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    const data = {
        first_name: document.getElementById('accFirstName').value.trim(),
        last_name: document.getElementById('accLastName').value.trim(),
        phone: document.getElementById('accPhone').value.trim()
    };
    const currentPwd = document.getElementById('accCurrentPwd').value;
    const newPwd = document.getElementById('accNewPwd').value;
    if (currentPwd && newPwd) {
        data.current_password = currentPwd;
        data.new_password = newPwd;
    }
    try {
        const res = await fetch('/api/v1/auth/account', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            // Update local storage
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            user.first_name = data.first_name;
            user.last_name = data.last_name;
            user.phone = data.phone;
            localStorage.setItem('user', JSON.stringify(user));
            closeModal('accountModal');
            alert('Account updated successfully');
        } else {
            alert(result.message || 'Update failed');
        }
    } catch(err) {
        alert('Failed to update account');
    }
}

// ─── LOGOUT ───
async function logout() {
    const token = localStorage.getItem('access_token');
    const userEmail = localStorage.getItem('user_email');
    const tenantId = localStorage.getItem('tenant_id');

    try {
        await fetch('/api/v1/auth/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? 'Bearer ' + token : '',
                'X-User-Email': userEmail || '',
                'X-Tenant-ID': tenantId || ''
            }
        });
    } catch(e) {}

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    localStorage.removeItem('tenant_id');
    localStorage.removeItem('user_type');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_name');
    sessionStorage.clear();
    window.location.href = '/login';
}

function closeUserDropdown() {
    const d = document.getElementById('userDropdown');
    if (d) d.classList.remove('active');
}

// ─── USER STORAGE KEY HELPER ───
function _getUserModuleStorageKey(prefix) {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const uid = user.id || user.email || 'guest';
        return `${prefix}_${uid}`;
    } catch(e) {
        return `${prefix}_guest`;
    }
}

// ─── MODULE TRACKING (user-scoped) ───
function trackModule(name, icon, route) {
    if (!name || !route) return;
    const currentKey = _getUserModuleStorageKey('current_module_route');
    const recentKey = _getUserModuleStorageKey('recent_modules');

    localStorage.setItem(currentKey, route);
    localStorage.setItem('current_module_route', route); // backward compatibility fallback

    let recent = [];
    try {
        recent = JSON.parse(localStorage.getItem(recentKey) || '[]');
    } catch(e) { recent = []; }

    recent = recent.filter(m => m.route !== route);
    recent.unshift({ name, icon, route, timestamp: Date.now() });
    recent = recent.slice(0, 10);

    localStorage.setItem(recentKey, JSON.stringify(recent));
    localStorage.setItem('recent_modules', JSON.stringify(recent)); // backward compatibility fallback

    if (typeof renderDashSidebar === 'function') {
        renderDashSidebar();
    }
}

// Automatic tracking for known routes on page load
function _autoTrackCurrentModule() {
    const path = window.location.pathname;
    if (path === '/' || path === '/login' || path === '/signup') return;

    const KNOWN_ROUTES = [
        { prefix: '/part', name: 'Part Management', icon: 'settings_input_component' },
        { prefix: '/auth', name: 'Auth & Security', icon: 'security' },
        { prefix: '/project', name: 'Project Management', icon: 'assignment' },
        { prefix: '/procurement', name: 'Procurement', icon: 'shopping_cart' },
        { prefix: '/hr', name: 'Human Resources', icon: 'people' },
        { prefix: '/rawmaterial', name: 'Raw Materials', icon: 'inventory_2' },
        { prefix: '/machine', name: 'Machine Management', icon: 'precision_manufacturing' },
        { prefix: '/supplier', name: 'Supplier Management', icon: 'handshake' },
        { prefix: '/workflow', name: 'Process Routings', icon: 'account_tree' },
        { prefix: '/inventory', name: 'Inventory Management', icon: 'warehouse' },
        { prefix: '/finance', name: 'Finance', icon: 'account_balance' },
    ];

    const matched = KNOWN_ROUTES.find(r => path.startsWith(r.prefix));
    if (matched) {
        trackModule(matched.name, matched.icon, path);
    }
}

// ─── AUTH GUARD ───
function requireAuth() {
    const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/login';
        return false;
    }
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp && Date.now() / 1000 > payload.exp) {
            logout();
            return false;
        }
    } catch(e) { logout(); return false; }
    return true;
}

// Init
(function () {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    renderServices();
    _autoTrackCurrentModule();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const nameEl = document.getElementById('headerUserName');
    if (nameEl) nameEl.textContent = (user.first_name || user.email || 'User');
})();
