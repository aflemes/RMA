const rmaLog = (...args) => { if (RMA_CONFIG.LOGS_ENABLED) console.log(...args); };

// Use event delegation on #rma so the listener survives Reef re-renders
document.getElementById('rma').addEventListener('click', (e) => {
    if (!e.target.closest('#fight .start')) return;
    const reachableTargets = findReachableObjects((obj) => obj?.activities.includes("Attack"));
    const uniqueEnemies = reachableTargets.reduce((acc, target) => {
        if (!acc.some(t => t.name === target.name)) acc.push(target);
        return acc;
    }, []);
    buildReachableEnnemiesList(uniqueEnemies);
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
    if (!state.target) { rmaLog('[RMADBG] GATE: !state.target'); return; };
    if (currentHealthPercentage <= RMA_CONFIG.MIN_HEALTH_HEALING_THRESHOLD) { rmaLog('[RMADBG] GATE: health too low'); return; };

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

    // === Delay between kills ===
    if (combatEndTime > 0) {
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
            rmaLog('[RMADBG] Combat just ended — setting kill cooldown');
            combatEndTime = Date.now();
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


