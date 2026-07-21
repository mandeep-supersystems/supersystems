// ADJUSTMENTS JS
async function executeAdjustment() {
    const payload = {
        part_number: document.getElementById('adjPartNumber').value,
        adjustment_qty: parseFloat(document.getElementById('adjQty').value || 0),
        reason: document.getElementById('adjReason').value
    };

    if (!payload.part_number || payload.adjustment_qty === 0) {
        showToast('Part number and non-zero adjustment required', 'error');
        return;
    }

    try {
        const res = await fetch(API + '/adjustments', {
            method: 'POST', headers: HEADERS, body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            showToast(json.message);
            showSection('stocklevels');
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Adjustment failed', 'error'); }
}
