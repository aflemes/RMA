let rmaDropIds = new Set();
let rmaKeepIds = new Set();
let rmaDropChances = new Map();

const getItemName = (itemId) => {
    try { return item_base[itemId].name; } catch (e) { return 'Item ' + itemId; }
};

const formatChance = (chance) => {
    if (chance === undefined || chance === null) return '';
    return (chance * 100).toFixed(2) + '%';
};

const getChanceClass = (chance) => {
    if (chance === undefined || chance === null) return '';
    const pct = chance * 100;
    if (pct < 1) return 'drop-rare';
    if (pct <= 3) return 'drop-uncommon';
    return 'drop-common';
};

window.refreshLootDropsList = () => {
    const container = document.querySelector('#loot-drops-list');
    if (!container) return;

    container.innerHTML = '';

    if (rmaDropIds.size === 0) {
        container.innerHTML = '<div class="loot-empty">No drops loaded. Click <b>Drops</b> on a monster in FIGHT tab.</div>';
        return;
    }

    const desc = document.createElement('div');
    desc.className = 'loot-desc';
    desc.innerHTML = '<span class="loot-desc-marked">&#10003; Kept</span> — marked items are <b>kept</b> in inventory. Unmarked items will be <b>auto-destroyed</b> during combat.';
    container.appendChild(desc);

    const inventory = players[0].temp.inventory;

    const sorted = [...rmaDropIds].sort((a, b) => {
        const ca = rmaDropChances.get(a) ?? 1;
        const cb = rmaDropChances.get(b) ?? 1;
        return ca - cb;
    });

    for (const id of sorted) {
        const chance = rmaDropChances.get(id);
        const kept = rmaKeepIds.has(id);
        const count = inventory.filter(i => i && !i.selected && i.id === id).length;
        const card = document.createElement('div');
        const chanceClass = getChanceClass(chance);
        card.classList.add('inventory-item');
        if (kept) card.classList.add('marked');
        if (chanceClass) card.classList.add(chanceClass);
        card.innerHTML = `<div class="inv-item-check">${kept ? '&#10003;' : ''}</div><div class="inv-item-name">${getItemName(id)}</div><div class="inv-item-chance">${formatChance(chance)}</div><div class="inv-item-count">in inventory: ${count}</div>`;

        card.addEventListener('click', () => {
            if (rmaKeepIds.has(id)) {
                rmaKeepIds.delete(id);
            } else {
                rmaKeepIds.add(id);
            }
            window.refreshLootDropsList();
        });

        container.appendChild(card);
    }
};

const executeDestroyItems = (itemsToDestroy) => {
    if (itemsToDestroy.length === 0) return;
    const seenIds = new Set();
    for (const item of itemsToDestroy) {
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        rmaLog('[RMA Loot] Auto-destroy', getItemName(item.id), '- id:', item.id);
        Socket.send("inventory_destroy", { item_id: item.id, all: true });
    }
};

let autoDestroyTimer = null;

window.scheduleNextAutoDestroy = () => {
    if (autoDestroyTimer) {
        clearTimeout(autoDestroyTimer);
        autoDestroyTimer = null;
    }
    if (!RMA_CONFIG.AUTO_DESTROY_ENABLED) {
        rmaLog('[RMA Loot] Auto-destroy disabled');
        return;
    }
    const interval = (RMA_CONFIG.AUTO_DESTROY_INTERVAL || 60) * 1000;
    rmaLog('[RMA Loot] Auto-destroy scheduled every', interval / 1000, 's');
    autoDestroyTimer = setTimeout(runAutoDestroy, interval);
};

const runAutoDestroy = () => {
    if (!RMA_CONFIG.AUTO_DESTROY_ENABLED) {
        autoDestroyTimer = null;
        return;
    }
    if (state.target && rmaDropIds.size > 0) {
        rmaLog('[RMA Loot] Auto-destroy cycle: checking inventory for', rmaDropIds.size, 'item types');
        const inventory = players[0].temp.inventory;
        const toDestroy = [];
        for (let i = 0; i < inventory.length; i++) {
            const item = inventory[i];
            if (item && !item.selected && rmaDropIds.has(item.id) && !rmaKeepIds.has(item.id)) {
                toDestroy.push(item);
            }
        }
        if (toDestroy.length > 0) {
            rmaLog('[RMA Loot] Auto-destroy:', toDestroy.length, 'items found');
            executeDestroyItems(toDestroy);
        }
    }
    window.scheduleNextAutoDestroy();
};

window.scheduleNextAutoDestroy();
