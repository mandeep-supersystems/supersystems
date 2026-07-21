// SHOP FLOOR CONTROL JS
async function submitShopFloorLog() {
    const payload = {
        production_order_no: document.getElementById('sfOrderNo').value,
        part_number: document.getElementById('sfPartNo').value,
        operation_code: document.getElementById('sfOpCode').value,
        operator: document.getElementById('sfOperator').value,
        qty_produced: parseFloat(document.getElementById('sfProduced').value || 0),
        qty_rejected: parseFloat(document.getElementById('sfRejected').value || 0)
    };

    if (!payload.production_order_no || !payload.part_number) {
        showToast('Production order and part number are required', 'error');
        return;
    }

    try {
        const res = await fetch(API + '/shop-floor/log-op', {
            method: 'POST', headers: HEADERS, body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            showToast(json.message);
            showSection('productionorders');
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error logging shop floor operation', 'error'); }
}
