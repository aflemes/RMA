const rmaLog = (...args) => { if (RMA_CONFIG.LOGS_ENABLED) console.log(...args); };

const FOOD_ITEMS = {
    "Frog": 3, "Perch": 3, "Cooked Baby Squid": 4, "Trout": 4,
    "Sardine": 5, "Jellyfish": 5, "Pike": 6, "Blue Marine Fish": 7,
    "Salmon": 8, "Sand Crab": 8, "Lion Fish": 9, "Mud Crab": 9,
    "Pearl Clam": 10, "Bass": 10, "Seahorse": 10, "Angelfish": 11,
    "Common Starfish": 11, "Red Star": 12, "Lobster": 12, "Eel": 12,
    "Swordfish": 13, "Squalidae": 14, "Rock Squid": 14, "Dolphin": 15,
    "Manta Ray": 15, "White Shark": 16, "King Crab": 16, "Giant Squid": 16,
    "Cowfish": 16, "Hammer Shark": 17, "Reef Manta Ray": 18, "Gray Shark": 19,
    "Cooked Deep Sea Octopus": 19, "Cooked Spiny Sea Star": 20, "King Seahorse": 22,
    "Giant Catfish": 23, "Baby Whale": 24, "Whale Shark": 25,
    "Cooked Blue Marlin": 26, "Sunfish": 28, "Tomato": 2, "Rat Meat": 2,
    "Chicken Leg": 2, "Onion": 2, "Ham": 3, "Potato": 3, "Corn": 4,
    "Apple": 6, "Banana": 8, "Carrot": 8, "Pineapple": 10, "Strawberry": 13
};

// Use event delegation on #rma so the listener survives Reef re-renders
document.getElementById('rma').addEventListener('click', (e) => {
    if (e.target.closest('#fight .start')) {
        const reachableTargets = findReachableObjects((obj) => obj?.activities.includes("Attack"));
        const uniqueEnemies = reachableTargets.reduce((acc, target) => {
            if (!acc.some(t => t.name === target.name)) acc.push(target);
            return acc;
        }, []);
        buildReachableEnnemiesList(uniqueEnemies);
    }
    if (e.target.closest('.nearby-toggle')) {
        state.nearbyMode = !state.nearbyMode;
        if (state.nearbyMode) {
            state.target = null;
            rmaLog('[RMA Fight] Nearby mode ON — will auto-target closest enemy');
        } else {
            rmaLog('[RMA Fight] Nearby mode OFF');
        }
        e.target.closest('.nearby-toggle').classList.toggle('active', state.nearbyMode);
    }
});

const buildReachableEnnemiesList = (uniqueEnemies) => {
    const enemies = document.querySelector('#enemies');

    enemies.querySelectorAll('.enemyCard').forEach(card => card.parentElement.removeChild(card));

    for (const enemy of uniqueEnemies) {
        const newCard = document.createElement('div');
        newCard.classList.add('enemyCard');
        newCard.innerHTML = `<div class="name">${enemy.name}</div>`;

        newCard.addEventListener('click', (e) => {
            if (newCard.classList.contains('active')) {
                state.target = null;
                newCard.classList.remove('active');
            } else {
                if (state.nearbyMode) {
                    state.nearbyMode = false;
                    const nearbyBtn = document.querySelector('.nearby-toggle');
                    if (nearbyBtn) nearbyBtn.classList.remove('active');
                }
                state.target = enemy;
                newCard.classList.add('active');
            }
        });

        enemies.appendChild(newCard);
    }
}

const executeAttack = async () => {
    const { path: pathToTarget, item: closestTarget } = findClosestReachableObject(obj => obj?.name === state.target.name);

    if (!closestTarget) {
        rmaLog('[RMA Fight] executeAttack: no reachable target found for', state.target?.name);
        return false;
    }

    rmaLog('[RMA Fight] executeAttack: moving to', closestTarget.name, `@ (${closestTarget.i}, ${closestTarget.j})`);
    players[0].path = pathToTarget;

    const moved = await waitUntil(
        () => !movementInProgress(players[0]) && !Timers.running("set_target"),
        1500,
        10000
    ).then(() => true).catch(() => {
        rmaLog('[RMA Fight] executeAttack: waitUntil timed out — player may still be moving');
        return false;
    });

    rmaLog('[RMA Fight] executeAttack: movement settled =', moved,
        '| still moving =', movementInProgress(players[0]),
        '| set_target timer =', Timers.running("set_target"));

    if (!state.target) {
        rmaLog('[RMA Fight] executeAttack: target was cleared during movement, aborting');
        return false;
    }

    await sleep(getRandomInt(RMA_CONFIG.FIGHT_DELAY_MIN, RMA_CONFIG.FIGHT_DELAY_MAX));

    active_menu = -1;
    BigMenu.show(active_menu);

    const obj = obj_g(on_map[current_map][closestTarget.i] && on_map[current_map][closestTarget.i][closestTarget.j]);
    if (!obj) {
        rmaLog('[RMA Fight] executeAttack: target object gone from map at dispatch time');
        return false;
    }

    rmaLog('[RMA Fight] executeAttack: dispatching attack on', obj.name);
    selected = { i: closestTarget.i, j: closestTarget.j };
    selected_object = obj;
    obj.fn(obj.activities[0].toLowerCase(), obj, players[0]);

    return true;
};

let fightLoopRunning = false;
let lastAttackDispatchTime = 0;
let combatAnimationSeen = false;
let combatDomWaitStart = 0;
let combatEndTime = 0;
const STUCK_TIMEOUT = 3000;

const getTargetEntity = () => {
    const tid = players[0].temp.target_id;
    if (tid === -1) return null;
    for (let i = 0; i < players.length; i++) {
        if (players[i].id === tid) return players[i];
    }
    return null;
};

setInterval(async () => {
    rmaLog('[RMADBG] === TICK START ===');
    if (fightLoopRunning) { rmaLog('[RMADBG] GATE: fightLoopRunning'); return; };
    if (currentHealthPercentage <= RMA_CONFIG.MIN_HEALTH_HEALING_THRESHOLD) { rmaLog('[RMADBG] GATE: health too low'); return; };

    // Nearby mode: auto-find closest enemy when no target
    if (!state.target) {
        if (!state.nearbyMode) { rmaLog('[RMADBG] GATE: !state.target'); return; };
        const nearest = findClosestReachableObject(obj => obj?.activities.includes("Attack"));
        if (!nearest.item) { rmaLog('[RMADBG] GATE: no enemies nearby'); return; };
        state.target = nearest.item;
        combatEndTime = 0;
        rmaLog('[RMA Fight] Nearby mode: targeting', state.target.name);
    }

    const tid = players[0].temp.target_id;
    const animating = players[0].temp.animate_until > Date.now();
    const domEl = document.querySelector('#enemy_healthbar:not(.hidden), .enemy_healthbar:not(.hidden)');
    const moving = movementInProgress(players[0]);
    const setTargetRunning = Timers.running("set_target");
    const retryInterval = RMA_CONFIG.ATTACK_RETRY_INTERVAL || 5000;
    const killDelay = RMA_CONFIG.DELAY_BETWEEN_KILLS || 1000;

    rmaLog('[RMADBG] state:',
        'tid=' + tid,
        '| animate_until=' + players[0].temp.animate_until,
        '| animating=' + animating,
        '| combatSeen=' + combatAnimationSeen,
        '| lastDispatch=' + (lastAttackDispatchTime > 0 ? (Date.now() - lastAttackDispatchTime) + 'ms ago' : 'never'),
        '| domWaitStart=' + (combatDomWaitStart > 0 ? (Date.now() - combatDomWaitStart) + 'ms ago' : '0'),
        '| enemyHb=' + (domEl ? 'visible' : 'hidden/missing'),
        '| moving=' + moving,
        '| setTarget=' + setTargetRunning,
        '| retryInterval=' + retryInterval,
        '| killDelay=' + killDelay,
        '| combatEndTime=' + (combatEndTime > 0 ? (Date.now() - combatEndTime) + 'ms ago' : '0')
    );

    // === Delay between kills / post-combat healing ===
    if (combatEndTime > 0) {
        const foodThreshold = RMA_CONFIG.FOOD_HEAL_THRESHOLD || 0;
        if (foodThreshold > 0 && currentHealthPercentage < foodThreshold) {
            rmaLog('[RMADBG] Health ' + currentHealthPercentage + '% < ' + foodThreshold + '% — eating food');
            if (typeof Player !== 'undefined' && Player.eat_food) {
                Player.eat_food();
            }
            rmaLog('[RMADBG] === TICK END (healing) ===');
            return;
        }
        const sinceKill = Date.now() - combatEndTime;
        if (sinceKill < killDelay) {
            rmaLog('[RMADBG] Kill cooldown: ' + sinceKill + 'ms < ' + killDelay + 'ms — waiting');
            rmaLog('[RMADBG] === TICK END (kill cooldown) ===');
            return;
        }
        rmaLog('[RMADBG] Kill cooldown expired');
        combatEndTime = 0;
    }

    // === DOM combat confirmation ===
    if (combatDomWaitStart > 0) {
        rmaLog('[RMADBG] BRANCH: DOM wait active');
        if (domEl) {
            rmaLog('[RMA Fight] Combat confirmed via enemy_healthbar!');
            combatDomWaitStart = 0;
            combatAnimationSeen = true;
            lastAttackDispatchTime = 0;
            rmaLog('[RMADBG] === TICK END (DOM confirmed) ===');
            return;
        }
        const domElapsed = Date.now() - combatDomWaitStart;
        if (domElapsed < retryInterval) {
            rmaLog('[RMADBG] DOM still waiting, elapsed=' + domElapsed + 'ms < ' + retryInterval + 'ms — returning');
            rmaLog('[RMADBG] === TICK END (DOM wait) ===');
            return;
        }
        rmaLog('[RMA Fight] enemy_healthbar not found after ' + domElapsed + 'ms — retrying');
        combatDomWaitStart = 0;
        lastAttackDispatchTime = 0;
    }

    if (animating) {
        rmaLog('[RMADBG] BRANCH: animating');
        if (!combatAnimationSeen) {
            rmaLog('[RMA Fight] Combat confirmed via animation!');
            combatAnimationSeen = true;
            lastAttackDispatchTime = 0;
        }
        rmaLog('[RMADBG] === TICK END (animating) ===');
        return;
    }

    if (tid !== -1) {
        rmaLog('[RMADBG] BRANCH: tid !== -1');
        if (combatAnimationSeen) {
            rmaLog('[RMADBG] combatAnimationSeen=true — combat ongoing, returning');
            rmaLog('[RMADBG] === TICK END (combat ongoing) ===');
            return;
        }

        if (lastAttackDispatchTime > 0) {
            const elapsed = Date.now() - lastAttackDispatchTime;
            rmaLog('[RMADBG] lastDispatch > 0, elapsed=' + elapsed + 'ms');
            if (elapsed < STUCK_TIMEOUT) {
                rmaLog('[RMADBG] elapsed < STUCK_TIMEOUT — waiting');
                rmaLog('[RMADBG] === TICK END (waiting for animation) ===');
                return;
            }
            rmaLog(`[RMA Fight] STUCK: no animation after ${elapsed}ms — retrying`);
            lastAttackDispatchTime = 0;
            combatAnimationSeen = false;
        } else {
            rmaLog('[RMADBG] lastDispatch === 0, combatDomWaitStart=' + combatDomWaitStart);
            if (combatDomWaitStart === 0) {
                rmaLog('[RMA Fight] Stale target detected — retrying');
                lastAttackDispatchTime = 0;
                combatAnimationSeen = false;
            } else {
                rmaLog('[RMADBG] DOM wait will handle this, returning');
                rmaLog('[RMADBG] === TICK END (defer to DOM wait) ===');
                return;
            }
        }
    } else {
        rmaLog('[RMADBG] BRANCH: tid === -1');
        if (combatAnimationSeen) {
            rmaLog('[RMADBG] Combat just ended');
            combatEndTime = Date.now();
            const foodThreshold = RMA_CONFIG.FOOD_HEAL_THRESHOLD || 0;
            if (foodThreshold > 0 && currentHealthPercentage < foodThreshold) {
                rmaLog('[RMA Fight] Health ' + currentHealthPercentage + '% < ' + foodThreshold + '% — eating food');
                if (typeof Player !== 'undefined' && Player.eat_food) {
                    Player.eat_food();
                }
            }
            if (state.nearbyMode) {
                state.target = null;
                rmaLog('[RMADBG] Nearby mode: cleared target for next enemy');
            }
        }
        combatAnimationSeen = false;
        lastAttackDispatchTime = 0;
    }

    if (setTargetRunning) {
        rmaLog('[RMADBG] GATE: set_target timer running — returning');
        rmaLog('[RMADBG] === TICK END (set_target) ===');
        return;
    }
    if (moving && lastAttackDispatchTime === 0) {
        rmaLog('[RMADBG] GATE: movement in progress — returning');
        rmaLog('[RMADBG] === TICK END (moving) ===');
        return;
    }

    rmaLog(`[RMA Fight] Dispatching (${lastAttackDispatchTime === 0 ? 'first attack' : 'RETRY'})`);

    fightLoopRunning = true;
    try {
        const dispatched = await executeAttack();
        if (dispatched) {
            combatDomWaitStart = Date.now();
            lastAttackDispatchTime = Date.now();
            combatAnimationSeen = false;
            rmaLog('[RMA Fight] Attack dispatched, watching for enemy_healthbar...');
        } else {
            lastAttackDispatchTime = 0;
            combatDomWaitStart = 0;
        }
    } catch (e) {
        lastAttackDispatchTime = 0;
        combatDomWaitStart = 0;
        console.error('[RMA Fight] Unexpected error in fight loop:', e);
    } finally {
        fightLoopRunning = false;
    }
    rmaLog('[RMADBG] === TICK END (after dispatch) ===');
}, 1000);


