let currentHealthPercentage;
let loggedOutLowHealth = false;
let lowHealthRetryCount = 0;
const MAX_LOW_HEALTH_RETRIES = 3;

setInterval(() => {
    let hp, maxHp;
    if (typeof skills !== 'undefined' && skills && skills[0] && skills[0].health) {
        hp = skills[0].health.current;
        maxHp = skills[0].health.level;
    } else if (typeof players !== 'undefined' && players && players[0] && players[0].temp) {
        hp = players[0].temp.hp || players[0].health;
        maxHp = players[0].temp.max_hp || players[0].max_health;
    }
    if (!hp || !maxHp) return;

    currentHealthPercentage = hp / maxHp * 100;

    if ((state.target || state.targetNames?.size > 0 || state.nearbyMode) && currentHealthPercentage <= RMA_CONFIG.MIN_HEALTH_HEALING_THRESHOLD && players[0].temp.target_id === -1) {
        if (!hasHealthItem()) {
            lowHealthRetryCount++;
            console.log('[RMA Healing] Low health and no food — attempt ' + lowHealthRetryCount + '/' + MAX_LOW_HEALTH_RETRIES);

            if (lowHealthRetryCount < MAX_LOW_HEALTH_RETRIES) {
                return;
            }

            if (!loggedOutLowHealth) {
                loggedOutLowHealth = true;
                console.log('[RMA Healing] Low health and no food after ' + MAX_LOW_HEALTH_RETRIES + ' attempts — logging out');
                if (typeof fightLoopRunning !== 'undefined') fightLoopRunning = true;
                if (typeof fightTickTimer !== 'undefined' && fightTickTimer) {
                    clearTimeout(fightTickTimer);
                    fightTickTimer = null;
                }
                const logoutEl = document.getElementById('logout_link');
                if (logoutEl) logoutEl.click();
            }
            return;
        }

        lowHealthRetryCount = 0;
        Player.eat_food();
    } else {
        lowHealthRetryCount = 0;
    }
}, 1000);