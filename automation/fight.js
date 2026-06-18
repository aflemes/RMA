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
const runFromFight = () => {
    rmaLog('[RMA Fight] Running from fight...');
    if (typeof Socket !== 'undefined' && Socket.send) {
        Socket.send("run_from_fight", {});
    }
    state.target = null;
    if (typeof Archery !== 'undefined' && Archery.force_stop_shooting) {
        Archery.force_stop_shooting();
    }
    rmaLog('[RMA Fight] Combat stopped');
};

document.getElementById('rma').addEventListener('click', (e) => {
    if (e.target.closest('#fight .start')) {
        const reachableTargets = findReachableObjects((obj) => obj?.activities.includes("Attack"));
        const uniqueEnemies = reachableTargets.reduce((acc, target) => {
            if (!acc.some(t => t.name === target.name)) acc.push(target);
            return acc;
        }, []);
        buildReachableEnnemiesList(uniqueEnemies);

        const nonAttackMonsters = findReachableObjects(obj =>
            obj?.params?.hp && !obj.activities?.includes('Attack')
        );
        if (nonAttackMonsters.length > 0) {
            const unique = nonAttackMonsters.filter((o, i, a) => a.findIndex(x => x.name === o.name) === i);
            rmaLog('[RMA DEBUG] Monsters WITHOUT Attack activity:', unique.map(o => ({ name: o.name, activities: o.activities, hp: o.params?.hp, level: o.params?.level })));
        }
    }
    if (e.target.closest('.nearby-toggle')) {
        state.nearbyMode = !state.nearbyMode;
        if (state.nearbyMode) {
            state.target = null;
            state.targetNames.clear();
            document.querySelectorAll('.enemyCard.active').forEach(c => c.classList.remove('active'));
            if (!homePosition) {
                homePosition = { i: players[0].i, j: players[0].j };
                rmaLog('[RMA Fight] Home position set at (' + homePosition.i + ',' + homePosition.j + ')');
            }
            returningToHome = false;
            rmaLog('[RMA Fight] Nearby mode ON — will auto-target closest enemy');
        } else {
            rmaLog('[RMA Fight] Nearby mode OFF');
        }
        e.target.closest('.nearby-toggle').classList.toggle('active', state.nearbyMode);
    }
});

const rebuildDropsFromSelected = () => {
    rmaDropIds.clear();
    rmaKeepIds.clear();
    rmaDropChances.clear();
    document.querySelectorAll('.enemyCard.active').forEach(card => {
        if (!card.dataset.drops) return;
        const drops = JSON.parse(card.dataset.drops);
        for (const drop of drops) {
            rmaDropIds.add(drop.id);
            rmaKeepIds.add(drop.id);
            rmaDropChances.set(drop.id, drop.chance);
        }
    });
    rmaLog('[RMA Fight] Drops rebuilt - total:', rmaDropIds.size);
    if (typeof window.refreshLootDropsList === 'function') window.refreshLootDropsList();
};

const buildReachableEnnemiesList = (uniqueEnemies) => {
    const enemies = document.querySelector('#enemies');

    enemies.querySelectorAll('.enemyCard').forEach(card => card.parentElement.removeChild(card));

    for (const enemy of uniqueEnemies) {
        const newCard = document.createElement('div');
        newCard.classList.add('enemyCard');
        newCard.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;"><span class="name">${enemy.name}</span><button class="drops-btn" style="width:auto;padding:2px 8px;font-size:11px;">Drops</button></div>`;

        const drops = (enemy.params && enemy.params.drops) || [];
        newCard.dataset.drops = JSON.stringify(
            drops.filter(d => d.id).map(d => ({ id: d.id, chance: d.chance ?? 0 }))
        );

        newCard.addEventListener('click', (e) => {
            if (e.target.closest('.drops-btn')) return;
            if (newCard.classList.contains('active')) {
                state.targetNames.delete(enemy.name);
                if (state.target && state.target.name === enemy.name) {
                    state.target = null;
                }
                newCard.classList.remove('active');
                rebuildDropsFromSelected();
            } else {
                if (state.nearbyMode) {
                    state.nearbyMode = false;
                    const nearbyBtn = document.querySelector('.nearby-toggle');
                    if (nearbyBtn) nearbyBtn.classList.remove('active');
                }
                if (!homePosition) {
                    homePosition = { i: players[0].i, j: players[0].j };
                    rmaLog('[RMA Fight] Home position set at (' + homePosition.i + ',' + homePosition.j + ')');
                }
                returningToHome = false;
                state.targetNames.add(enemy.name);
                newCard.classList.add('active');
                rebuildDropsFromSelected();
            }
        });

        newCard.querySelector('.drops-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const tabBtn = document.querySelector('.rma-tab[data-tab="drops"]');
            if (tabBtn) tabBtn.click();
        });

        enemies.appendChild(newCard);
    }
}

window.rmaDebugMap = (radius = 15) => {
    const px = players[0].i, py = players[0].j;
    const results = [];
    for (let i = Math.max(0, px - radius); i < Math.min(map_size_x, px + radius); i++) {
        for (let j = Math.max(0, py - radius); j < Math.min(map_size_y, py + radius); j++) {
            if (on_map[current_map][i] && on_map[current_map][i][j]) {
                const tileId = on_map[current_map][i][j].id;
                const obj = objects_data[tileId];
                if (obj) {
                    results.push({
                        pos: `(${i},${j})`,
                        tileId,
                        name: obj.name,
                        activities: obj.activities,
                        hp: obj.params?.hp,
                        level: obj.params?.level,
                        type: obj.params?.type
                    });
                }
            }
        }
    }
    console.table(results);
    return results;
};

const findTargetDirectly = (name) => {
    for (let i = 0; i < map_size_x; i++) {
        for (let j = 0; j < map_size_y; j++) {
            if (on_map[current_map][i] && on_map[current_map][i][j]) {
                const tileId = on_map[current_map][i][j].id;
                const obj = objects_data[tileId];
                if (obj && obj.name === name) {
                    return { ...obj, i, j, _direct: true };
                }
            }
        }
    }
    return null;
};

const executeAttack = async () => {
    let result = findClosestReachableObject(obj => obj?.name === state.target.name);
    let closestTarget = result?.item;
    let pathToTarget = result?.path;

    if (!closestTarget) {
        rmaLog('[RMA Fight] executeAttack: findClosestReachableObject failed, trying direct lookup');
        closestTarget = findTargetDirectly(state.target.name);
        if (!closestTarget) {
            rmaLog('[RMA Fight] executeAttack: target not found on map for', state.target?.name);
            return false;
        }
        rmaLog('[RMA Fight] executeAttack: found target directly at', `(${closestTarget.i},${closestTarget.j})`);
    }

    let dist = Math.abs(players[0].i - closestTarget.i) + Math.abs(players[0].j - closestTarget.j);
    rmaLog('[RMA Fight] executeAttack: target', closestTarget.name, `@ (${closestTarget.i},${closestTarget.j})`, 'dist=' + dist);

    // Only move if not already in attack range
    if (dist > 2) {
        rmaLog('[RMA Fight] executeAttack: moving closer');
        if (!pathToTarget || pathToTarget.length === 0) {
            pathToTarget = findPathFromTo(players[0], { i: closestTarget.i, j: closestTarget.j }, players[0]);
        }
        if (!pathToTarget || pathToTarget.length === 0) {
            rmaLog('[RMA Fight] executeAttack: no path to target');
            return false;
        }
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

        if (!moved) {
            rmaLog('[RMA Fight] executeAttack: movement did not settle — aborting');
            return false;
        }

        if (!state.target) {
            rmaLog('[RMA Fight] executeAttack: target was cleared during movement, aborting');
            return false;
        }

        dist = Math.abs(players[0].i - closestTarget.i) + Math.abs(players[0].j - closestTarget.j);
        if (dist > 2) {
            rmaLog('[RMA Fight] executeAttack: target too far after move (dist=' + dist + '), aborting');
            return false;
        }
    } else {
        rmaLog('[RMA Fight] executeAttack: already in range, skipping movement');
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
let fightTickTimer = null;
let fightLowHealthRetryCount = 0;
const MAX_FIGHT_HEALTH_RETRIES = 3;

let homePosition = null;
let lastCombatTime = Date.now();
let returningToHome = false;
const IDLE_RETURN_TIMEOUT = 5000;

const getTargetEntity = () => {
    const tid = players[0].temp.target_id;
    if (tid === -1) return null;
    for (let i = 0; i < players.length; i++) {
        if (players[i].id === tid) return players[i];
    }
    return null;
};

let captchaActive = false;
let captchaSolving = false;

const checkCaptcha = () => {
    const form = document.querySelector('#captcha_form');
    const display = form ? form.style.display : 'no-form';
    const offsetP = form ? form.offsetParent : null;
    const visible = form && display !== 'none' && offsetP !== null;
    if (visible && !captchaActive) {
        captchaActive = true;
        captchaSolving = false;
        console.log('[RMA Captcha] Captcha detected');
    } else if (!visible && captchaActive) {
        captchaActive = false;
        captchaSolving = false;
        if (nopechaBanned) {
            nopechaBanned = false;
            console.log('[RMA Captcha] Captcha cleared — will retry NopeCHA next captcha');
        }
        console.log('[RMA Captcha] Captcha cleared');
    }
    return visible;
};

const getCaptchaImageUrl = () => {
    const div = document.querySelector('#captcha_img_div');
    if (!div) { console.log('[RMA Captcha] #captcha_img_div not found'); return null; }
    const bg = div.style.backgroundImage;
    if (!bg) { console.log('[RMA Captcha] No background-image on captcha div'); return null; }
    const url = bg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
    console.log('[RMA Captcha] Image URL length:', url.length);
    return url;
};

const solveCaptcha = async () => {
    const imageUrl = getCaptchaImageUrl();
    if (!imageUrl) return null;

    console.log('[RMA NopeCHA] Submitting captcha image...');

    try {
        const result = await sendNopechaRequest({ imageUrl });
        console.log('[RMA NopeCHA] Solution received:', JSON.stringify(result));
        return result;
    } catch (e) {
        console.log('[RMA NopeCHA] Error:', e);
        return null;
    }
};

const closeCaptchaBonusForm = () => {
    const check = () => {
        const form = document.getElementById('captcha_bonus_assign_form');
        if (form && form.style.display !== 'none') {
            form.style.display = 'none';
            console.log('[RMA Captcha] Closed bonus form');
        }
    };
    check();
    for (let i = 0; i < 10; i++) setTimeout(check, (i + 1) * 500);
};

const tryAutoSolveCaptcha = async () => {
    if (captchaSolving) {
        console.log('[RMA Captcha] Already solving, skipping');
        return;
    }

    captchaSolving = true;
    console.log('[RMA Captcha] Starting auto-solve...');

    let attempts = 0;
    const MAX_PER_IMAGE = 3;

    try {
        while (captchaActive) {
            const solution = await solveCaptcha();

            if (!solution) {
                if (typeof nopechaBanned !== 'undefined' && nopechaBanned) {
                    console.log('[RMA Captcha] NopeCHA daily limit reached, stopping auto-solve');
                    break;
                }
                console.log('[RMA Captcha] No solution obtained, will retry');
                await sleep(2000);
                attempts++;
                if (attempts >= MAX_PER_IMAGE) {
                    Captcha.refresh();
                    console.log('[RMA Captcha] Refreshed captcha image');
                    attempts = 0;
                    await sleep(2000);
                }
                continue;
            }

            const input = document.querySelector('#captcha_input');
            if (!input) {
                console.log('[RMA Captcha] #captcha_input not found, aborting');
                break;
            }

            input.value = solution;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            console.log('[RMA Captcha] Filled input with:', solution);

            await sleep(500);

            if (typeof Captcha !== 'undefined' && Captcha.submit) {
                Captcha.submit();
                console.log('[RMA Captcha] Captcha submitted');
            } else {
                console.log('[RMA Captcha] Captcha.submit not available');
                break;
            }

            await sleep(1500);

            if (!captchaActive) {
                console.log('[RMA Captcha] Captcha solved');
                closeCaptchaBonusForm();
                break;
            }

            attempts++;
            console.log('[RMA Captcha] Attempt', attempts, 'failed');

            if (attempts >= MAX_PER_IMAGE) {
                if (typeof Captcha !== 'undefined' && Captcha.refresh) {
                    Captcha.refresh();
                    console.log('[RMA Captcha] Refreshed captcha image');
                }
                attempts = 0;
                await sleep(2000);
            }
        }
    } catch (e) {
        console.log('[RMA Captcha] Error in tryAutoSolveCaptcha:', e);
    } finally {
        captchaSolving = false;
    }
};

const fightTick = async () => {
    rmaLog('[RMADBG] === TICK START ===');
    if (checkCaptcha()) {
        if (!captchaSolving && !nopechaBanned) {
            tryAutoSolveCaptcha();
        }
        scheduleNextFightTick(nopechaBanned ? 10000 : 5000);
        return;
    }
    if (fightLoopRunning) { rmaLog('[RMADBG] GATE: fightLoopRunning'); scheduleNextFightTick(); return; };
    if (currentHealthPercentage <= RMA_CONFIG.MIN_HEALTH_HEALING_THRESHOLD) {
        rmaLog('[RMADBG] GATE: health too low');
        scheduleNextFightTick();
        return;
    }
    const inCombat = (typeof players !== 'undefined' && players && players[0] && players[0].temp && players[0].temp.target_id !== -1) || combatAnimationSeen || combatDomWaitStart > 0;
    const foodThreshold = RMA_CONFIG.FOOD_HEAL_THRESHOLD || 0;
    if (inCombat && foodThreshold > 0 && currentHealthPercentage < foodThreshold) {
        rmaLog('[RMA Fight] Health ' + currentHealthPercentage.toFixed(1) + '% below ' + foodThreshold + '% while in combat — running from fight');
        runFromFight();
        combatAnimationSeen = false;
        lastAttackDispatchTime = 0;
        combatDomWaitStart = 0;
        combatEndTime = 0;
        scheduleNextFightTick(1000);
        return;
    }

    // Pre-combat health check (only when auto-attack is active)
    if ((state.target || state.targetNames?.size > 0 || state.nearbyMode) && typeof players !== 'undefined' && players && players[0] && players[0].temp && players[0].temp.target_id === -1 && !movementInProgress(players[0])) {
        const foodThreshold = RMA_CONFIG.FOOD_HEAL_THRESHOLD || 0;
        if (foodThreshold > 0 && currentHealthPercentage < foodThreshold) {
            if (!hasHealthItem()) {
                fightLowHealthRetryCount++;
                rmaLog('[RMA Fight] Low health (' + currentHealthPercentage.toFixed(1) + '%) and no food — attempt ' + fightLowHealthRetryCount + '/' + MAX_FIGHT_HEALTH_RETRIES);
                if (fightLowHealthRetryCount < MAX_FIGHT_HEALTH_RETRIES) {
                    rmaLog('[RMADBG] === TICK END (healing retry) ===');
                    scheduleNextFightTick();
                    return;
                }
                rmaLog('[RMA Fight] No food after ' + MAX_FIGHT_HEALTH_RETRIES + ' attempts — logging out');
                fightLoopRunning = true;
                if (fightTickTimer) { clearTimeout(fightTickTimer); fightTickTimer = null; }
                const logoutEl = document.getElementById('logout_link');
                if (logoutEl) logoutEl.click();
                return;
            }
            fightLowHealthRetryCount = 0;
            rmaLog('[RMADBG] Health ' + currentHealthPercentage + '% < ' + foodThreshold + '% — eating food');
            if (typeof Player !== 'undefined' && Player.eat_food) {
                Player.eat_food();
            }
            rmaLog('[RMADBG] === TICK END (healing) ===');
            scheduleNextFightTick();
            return;
        }
    }
    fightLowHealthRetryCount = 0;

    // Find closest target among selected names or nearby mode
    if (!state.target) {
        if (state.targetNames.size > 0) {
            const closest = findClosestReachableObject(obj =>
                obj?.activities.includes("Attack") && state.targetNames.has(obj.name)
            );
            if (closest.item) {
                state.target = closest.item;
                combatEndTime = 0;
                rmaLog('[RMA Fight] Targeting closest selected:', state.target.name);
            } else {
                rmaLog('[RMADBG] GATE: none of the selected targets found nearby');
            }
        } else if (!state.nearbyMode) {
            rmaLog('[RMADBG] GATE: !state.target');
        } else {
            const nearest = findClosestReachableObject(obj => obj?.activities.includes("Attack"));
            if (nearest.item) {
                state.target = nearest.item;
                combatEndTime = 0;
                rmaLog('[RMA Fight] Nearby mode: targeting', state.target.name);
            } else {
                rmaLog('[RMADBG] GATE: no enemies nearby');
            }
        }
    }

    // Idle return: if no target found for IDLE_RETURN_TIMEOUT ms, walk back to home
    if (!state.target) {
        if (!homePosition && (state.targetNames.size > 0 || state.nearbyMode)) {
            homePosition = { i: players[0].i, j: players[0].j };
            lastCombatTime = Date.now();
            rmaLog('[RMA Fight] Home position auto-set at (' + homePosition.i + ',' + homePosition.j + ')');
        }
        if (homePosition) {
            if (returningToHome) {
                const distToHome = Math.abs(players[0].i - homePosition.i) + Math.abs(players[0].j - homePosition.j);
                if (distToHome <= 2) {
                    returningToHome = false;
                    lastCombatTime = Date.now();
                    rmaLog('[RMA Fight] Reached home position');
                } else {
                    const path = findPathFromTo(players[0], homePosition, players[0]);
                    if (path && path.length > 0) {
                        players[0].path = path;
                    }
                    scheduleNextFightTick(1000);
                    return;
                }
            } else if (Date.now() - lastCombatTime >= IDLE_RETURN_TIMEOUT) {
                returningToHome = true;
                rmaLog('[RMA Fight] Idle ' + (Date.now() - lastCombatTime) + 'ms — returning to home');
                const path = findPathFromTo(players[0], homePosition, players[0]);
                if (path && path.length > 0) {
                    players[0].path = path;
                }
                scheduleNextFightTick(1000);
                return;
            } else {
                scheduleNextFightTick();
                return;
            }
        } else {
            scheduleNextFightTick();
            return;
        }
    }

    if (returningToHome) {
        returningToHome = false;
        rmaLog('[RMA Fight] Found target while returning home — attacking');
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
        '| tickInterval=' + (RMA_CONFIG.FIGHT_TICK_INTERVAL || 1000),
        '| retryInterval=' + retryInterval,
        '| killDelay=' + killDelay,
        '| combatEndTime=' + (combatEndTime > 0 ? (Date.now() - combatEndTime) + 'ms ago' : '0')
    );

    // === Delay between kills / post-combat healing ===
    if (combatEndTime > 0) {
        const foodThreshold = RMA_CONFIG.FOOD_HEAL_THRESHOLD || 0;
        if (foodThreshold > 0 && currentHealthPercentage < foodThreshold) {
            if (!hasHealthItem()) {
                fightLowHealthRetryCount++;
                rmaLog('[RMA Fight] Low health (' + currentHealthPercentage.toFixed(1) + '%) and no food — attempt ' + fightLowHealthRetryCount + '/' + MAX_FIGHT_HEALTH_RETRIES);
                if (fightLowHealthRetryCount < MAX_FIGHT_HEALTH_RETRIES) {
                    rmaLog('[RMADBG] === TICK END (healing retry) ===');
                    scheduleNextFightTick();
                    return;
                }
                rmaLog('[RMA Fight] No food after ' + MAX_FIGHT_HEALTH_RETRIES + ' attempts — logging out');
                fightLoopRunning = true;
                if (fightTickTimer) { clearTimeout(fightTickTimer); fightTickTimer = null; }
                const logoutEl = document.getElementById('logout_link');
                if (logoutEl) logoutEl.click();
                return;
            }
            fightLowHealthRetryCount = 0;
            rmaLog('[RMADBG] Health ' + currentHealthPercentage + '% < ' + foodThreshold + '% — eating food');
            if (typeof Player !== 'undefined' && Player.eat_food) {
                Player.eat_food();
            }
            rmaLog('[RMADBG] === TICK END (healing) ===');
            scheduleNextFightTick();
            return;
        }
        const sinceKill = Date.now() - combatEndTime;
        if (sinceKill < killDelay) {
            rmaLog('[RMADBG] Kill cooldown: ' + sinceKill + 'ms < ' + killDelay + 'ms — waiting');
            rmaLog('[RMADBG] === TICK END (kill cooldown) ===');
            scheduleNextFightTick();
            return;
        }
        rmaLog('[RMADBG] Kill cooldown expired');
        combatEndTime = 0;
        // If already in combat (tid set, healthbar visible), mark combat as seen
        if (tid !== -1 || domEl) {
            rmaLog('[RMADBG] Player already in combat — resuming');
            combatAnimationSeen = true;
            lastAttackDispatchTime = 0;
        }
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
            scheduleNextFightTick();
            return;
        }
        const domElapsed = Date.now() - combatDomWaitStart;
        if (domElapsed < retryInterval) {
            rmaLog('[RMADBG] DOM still waiting, elapsed=' + domElapsed + 'ms < ' + retryInterval + 'ms — returning');
            rmaLog('[RMADBG] === TICK END (DOM wait) ===');
            scheduleNextFightTick();
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
        scheduleNextFightTick();
        return;
    }

    if (tid !== -1) {
        rmaLog('[RMADBG] BRANCH: tid !== -1');
        if (combatAnimationSeen) {
            rmaLog('[RMADBG] combatAnimationSeen=true — combat ongoing, returning');
            rmaLog('[RMADBG] === TICK END (combat ongoing) ===');
            scheduleNextFightTick();
            return;
        }

        if (lastAttackDispatchTime > 0) {
            const elapsed = Date.now() - lastAttackDispatchTime;
            rmaLog('[RMADBG] lastDispatch > 0, elapsed=' + elapsed + 'ms');
            if (elapsed < STUCK_TIMEOUT) {
                rmaLog('[RMADBG] elapsed < STUCK_TIMEOUT — waiting');
                rmaLog('[RMADBG] === TICK END (waiting for animation) ===');
                scheduleNextFightTick();
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
                scheduleNextFightTick();
                return;
            }
        }
    } else {
        rmaLog('[RMADBG] BRANCH: tid === -1');
        if (combatAnimationSeen) {
            rmaLog('[RMADBG] Combat just ended');
            combatEndTime = Date.now();
            lastCombatTime = Date.now();
            const foodThreshold = RMA_CONFIG.FOOD_HEAL_THRESHOLD || 0;
            if (foodThreshold > 0 && currentHealthPercentage < foodThreshold) {
                if (hasHealthItem()) {
                    rmaLog('[RMA Fight] Health ' + currentHealthPercentage + '% < ' + foodThreshold + '% — eating food');
                    if (typeof Player !== 'undefined' && Player.eat_food) {
                        Player.eat_food();
                    }
                } else {
                    rmaLog('[RMA Fight] Health low but no food available');
                }
            }
            if (typeof window.executeAutoDestroy === 'function') {
                const destroyed = window.executeAutoDestroy();
                if (destroyed > 0) rmaLog('[RMA Loot] Destroyed', destroyed, 'items after kill');
            }
            if (state.nearbyMode || state.targetNames.size > 0) {
                state.target = null;
                rmaLog('[RMADBG] Cleared target for next enemy');
            }
        }
        combatAnimationSeen = false;
        lastAttackDispatchTime = 0;
    }

    if (setTargetRunning) {
        rmaLog('[RMADBG] GATE: set_target timer running — returning');
        rmaLog('[RMADBG] === TICK END (set_target) ===');
        scheduleNextFightTick();
        return;
    }
    if (moving && lastAttackDispatchTime === 0) {
        rmaLog('[RMADBG] GATE: movement in progress — returning');
        rmaLog('[RMADBG] === TICK END (moving) ===');
        scheduleNextFightTick();
        return;
    }

    if (!state.target) {
        rmaLog('[RMADBG] GATE: target cleared before dispatch');
        scheduleNextFightTick();
        return;
    }

    rmaLog(`[RMA Fight] Dispatching (${lastAttackDispatchTime === 0 ? 'first attack' : 'RETRY'})`);

    fightLoopRunning = true;
    try {
        const dispatched = await executeAttack();
        if (dispatched) {
            if (!homePosition) {
                homePosition = { i: players[0].i, j: players[0].j };
                rmaLog('[RMA Fight] Home position set at (' + homePosition.i + ',' + homePosition.j + ')');
            }
            lastCombatTime = Date.now();
            combatDomWaitStart = Date.now();
            lastAttackDispatchTime = Date.now();
            combatAnimationSeen = false;
            returningToHome = false;
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
    rmaLog('[RMADBG] === TICK END (after dispatch, dispatched=' + (combatDomWaitStart > 0) + ') ===');
    if (combatDomWaitStart > 0) {
        scheduleNextFightTick(RMA_CONFIG.ATTACK_RETRY_INTERVAL || 5000);
    } else {
        scheduleNextFightTick();
    }
};

const scheduleNextFightTick = (overrideDelay) => {
    if (fightTickTimer) clearTimeout(fightTickTimer);
    const interval = overrideDelay || RMA_CONFIG.FIGHT_TICK_INTERVAL || 1000;
    fightTickTimer = setTimeout(fightTick, interval);
};
window.scheduleNextFightTick = scheduleNextFightTick;

scheduleNextFightTick();


