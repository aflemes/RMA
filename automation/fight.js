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
    if (fightLoopRunning) return;
    if (!state.target) return;
    if (currentHealthPercentage <= RMA_CONFIG.MIN_HEALTH_HEALING_THRESHOLD) return;

    const tid = players[0].temp.target_id;
    const animating = players[0].temp.animate_until > Date.now();

    if (tid !== -1) {
        rmaLog('[RMA Fight] tick | target_id =', tid,
            '| animating =', animating,
            '| combatSeen =', combatAnimationSeen,
            '| lastDispatch =', lastAttackDispatchTime > 0 ? (Date.now() - lastAttackDispatchTime) + 'ms ago' : 'never'
        );
    }

    if (animating) {
        if (!combatAnimationSeen) {
            rmaLog('[RMA Fight] Combat confirmed via animation!');
            combatAnimationSeen = true;
            lastAttackDispatchTime = 0;
        }
        return;
    }

    if (tid !== -1) {
        if (combatAnimationSeen) return;

        if (lastAttackDispatchTime > 0) {
            const elapsed = Date.now() - lastAttackDispatchTime;
            if (elapsed < STUCK_TIMEOUT) return;
            rmaLog(`[RMA Fight] STUCK: no animation after ${elapsed}ms — retrying`);
            lastAttackDispatchTime = 0;
            combatAnimationSeen = false;
        } else {
            return;
        }
    } else {
        combatAnimationSeen = false;
        lastAttackDispatchTime = 0;
    }

    if (Timers.running("set_target")) return;
    if (movementInProgress(players[0]) && lastAttackDispatchTime === 0) return;

    rmaLog(`[RMA Fight] Dispatching (${lastAttackDispatchTime === 0 ? 'first attack' : 'RETRY'})`);

    fightLoopRunning = true;
    try {
        const dispatched = await executeAttack();
        if (dispatched) {
            lastAttackDispatchTime = Date.now();
            combatAnimationSeen = false;
            rmaLog('[RMA Fight] Attack dispatched, watching for animation...');
        } else {
            lastAttackDispatchTime = 0;
        }
    } catch (e) {
        lastAttackDispatchTime = 0;
        console.error('[RMA Fight] Unexpected error in fight loop:', e);
    } finally {
        fightLoopRunning = false;
    }
}, 1000);


