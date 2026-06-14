let currentHealthPercentage;

setInterval(() => {
    let hp, maxHp;
    if (typeof skills !== 'undefined' && skills && skills[0] && skills[0].health) {
        hp = skills[0].health.current;
        maxHp = skills[0].health.level;
    } else if (players && players[0] && players[0].temp) {
        hp = players[0].temp.hp || players[0].health;
        maxHp = players[0].temp.max_hp || players[0].max_health;
    }
    if (!hp || !maxHp) return;

    currentHealthPercentage = hp / maxHp * 100;

    if (currentHealthPercentage <= RMA_CONFIG.MIN_HEALTH_HEALING_THRESHOLD && players[0].temp.target_id === -1) {
        if (!hasHealthItem()) {
            return;
        }

        Player.eat_food();
    }
}, 1000);