// PURCHASE ORDERS & LEAD TIME TRACKING JS
async function loadPurchaseOrders() {
    const tbody = document.getElementById('purchaseOrdersBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/orders', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
            tbody.innerHTML = json.data.map(po => `
                <tr style="cursor:pointer;" onclick="window.location.href='/purchase/order/${po.id}'">
                    <td><strong>${po.po_no}</strong></td>
                    <td>${po.req_no}</td>
                    <td>${po.supplier_name}</td>
                    <td><span class="badge badge-info">${po.part_or_rm_code}</span></td>
                    <td><strong>${po.order_qty}</strong></td>
                    <td><strong>₹${po.total_amount.toLocaleString()}</strong></td>
                    <td><span class="lt-badge">${po.lead_time_days} Days</span></td>
                    <td>${po.promised_delivery_date || '-'}</td>
                    <td>
                        <span class="lt-revision-badge" style="cursor:pointer;" onclick="window.location.href='/purchase/order/${po.id}'" title="Click to view full lead time change history">
                            ${po.lead_time_change_count} Revisions
                        </span>
                    </td>
                    <td><span class="badge badge-success">${po.status}</span></td>
                    <td onclick="event.stopPropagation()">
                        <button class="btn-action" title="Open Full Detail Page & Lead Time History" onclick="window.location.href='/purchase/order/${po.id}'">
                            <span class="material-icons-outlined">visibility</span>
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;">No purchase orders found.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:red;">Error loading purchase orders.</td></tr>';
    }
}
