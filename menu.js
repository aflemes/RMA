let rma = new Reef('#rma', {
    data: {
        title: 'RPG MO Assistant',
    },
    template: function (props) {
        return `
            <div id="rma-menu">
                <div id="rma-tab-bar" class="flex">
                    <button class="rma-tab active" data-tab="fight">Fight</button>
                    <button class="rma-tab" data-tab="builder">Builder</button>
                    <button class="rma-tab" data-tab="settings">&#9881;</button>
                </div>

                <div data-tab-content="fight" class="rma-tab-content active">
                    <div id="automation">
                        <div id="fight">
                            <div class="sub-section">Fight</div>
                            <div id="enemies"></div>
                            <button class="start">Refresh ennemies</button>
                            <div class="fight-delay-config">
                                <div class="delay-label">Pre-attack delay (ms)</div>
                                <div class="flex gap-10">
                                    <input id="fight-delay-min" type="number" min="0" step="100" value="${typeof RMA_CONFIG !== 'undefined' ? RMA_CONFIG.FIGHT_DELAY_MIN : 300}" placeholder="Min" />
                                    <input id="fight-delay-max" type="number" min="0" step="100" value="${typeof RMA_CONFIG !== 'undefined' ? RMA_CONFIG.FIGHT_DELAY_MAX : 1200}" placeholder="Max" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div data-tab-content="builder" class="rma-tab-content">
                    <div id="rma-builder"></div>
                </div>

                <div data-tab-content="settings" class="rma-tab-content">
                    <div class="sub-section">Settings</div>
                    <div id="rma-settings-panel">
                        <div class="settings-group">
                            <span class="settings-label">Attack retry interval (ms)</span>
                            <input type="number" id="rma-attack-retry-interval" min="1000" step="500" value="${typeof RMA_CONFIG !== 'undefined' ? RMA_CONFIG.ATTACK_RETRY_INTERVAL : 5000}" />
                        </div>
                        <div class="settings-group">
                            <span class="settings-label">Delay between kills (ms)</span>
                            <input type="number" id="rma-delay-between-kills" min="0" step="100" value="${typeof RMA_CONFIG !== 'undefined' ? RMA_CONFIG.DELAY_BETWEEN_KILLS : 1000}" />
                        </div>
                        <div class="settings-group">
                            <span class="settings-label">Stop fight when life under %</span>
                            <input type="number" id="rma-min-health" min="0" max="100" step="5" value="${typeof RMA_CONFIG !== 'undefined' ? RMA_CONFIG.MIN_HEALTH_HEALING_THRESHOLD : 85}" />
                        </div>
                        <div class="settings-group">
                            <span class="settings-label">Enable logs</span>
                            <label class="rma-toggle-switch">
                                <input type="checkbox" id="rma-logs-enabled" ${typeof RMA_CONFIG !== 'undefined' && RMA_CONFIG.LOGS_ENABLED ? 'checked' : ''} />
                                <span class="rma-toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
});

/*
<div data-tab-content="farming" class="rma-tab-content">
    <div id="farming">
        <div class="sub-section">Farming</div>
        <div id="seeds"></div>
        <button class="refresh">Refresh available seeds</button>
    </div>
</div>
 */

rma.render();

// Toggle panel collapsed/expanded
document.getElementById('rma-header').addEventListener('click', (e) => {
    if (e.target.closest('#rma-header')._wasDragging) return;
    const container = document.getElementById('rma-container');
    const isCollapsed = container.classList.contains('collapsed');
    container.classList.toggle('collapsed', !isCollapsed);
    container.classList.toggle('expanded', isCollapsed);
});

// Draggable panel
(function () {
    const container = document.getElementById('rma-container');
    const header = document.getElementById('rma-header');
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', (e) => {
        // Only drag on left click
        if (e.button !== 0) return;
        isDragging = true;
        header._wasDragging = false;
        startX = e.clientX;
        startY = e.clientY;
        const rect = container.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            header._wasDragging = true;
        }
        container.style.left = `${startLeft + dx}px`;
        container.style.top = `${startTop + dy}px`;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
})();

// Tab switching — CSS-only, no re-render to preserve dynamic DOM content
document.getElementById('rma').addEventListener('click', (e) => {
    const tabBtn = e.target.closest('.rma-tab');
    if (!tabBtn) return;
    const tab = tabBtn.getAttribute('data-tab');
    if (!tab) return;

    document.querySelectorAll('.rma-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.rma-tab-content').forEach(content => content.classList.remove('active'));

    tabBtn.classList.add('active');
    const content = document.querySelector(`[data-tab-content="${tab}"]`);
    if (content) content.classList.add('active');
});

// Settings inputs — event delegation since Reef re-renders content
document.getElementById('rma').addEventListener('change', (e) => {
    if (e.target.id === 'fight-delay-min') {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 0) RMA_CONFIG.FIGHT_DELAY_MIN = val;
    }
    if (e.target.id === 'fight-delay-max') {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 0) RMA_CONFIG.FIGHT_DELAY_MAX = val;
    }
    if (e.target.id === 'rma-attack-retry-interval') {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 1000) RMA_CONFIG.ATTACK_RETRY_INTERVAL = val;
    }
    if (e.target.id === 'rma-delay-between-kills') {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 0) RMA_CONFIG.DELAY_BETWEEN_KILLS = val;
    }
    if (e.target.id === 'rma-min-health') {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 0 && val <= 100) RMA_CONFIG.MIN_HEALTH_HEALING_THRESHOLD = val;
    }
    if (e.target.id === 'rma-logs-enabled') {
        RMA_CONFIG.LOGS_ENABLED = e.target.checked;
    }
});

const addTextToScript = (text, newLine = true) => {
    const scriptElement = document.getElementById("builder-script");

    if (scriptElement.value === '') {
        scriptElement.value = `${text}`;
    } else {
        scriptElement.value = `${scriptElement.value}${newLine ? '\n' : ''}${text}`;
    }
}

const addOrReplaceSelection = (newText, newLine = true) => {
    const textarea = document.getElementById("builder-script");

    var len = textarea.value.length;
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var sel = textarea.value.substring(start, end);

    if(sel === '') {
        addTextToScript(newText, newLine);
    }

    textarea.value = textarea.value.substring(0, start) + newText + textarea.value.substring(end, len);
}

const clickHandler = async function (event) {
    if (!rmaBuilder) return;
    var action = event.target.getAttribute('data-rma-action');
    
    if (event.target.id === "hud" && rmaBuilder.data.state === STATE_BUILDER_TARGETING) {
        const clickedPosition = translateMousePosition(mouse_screen.x, mouse_screen.y);
        addOrReplaceSelection(`[${clickedPosition.i},${clickedPosition.j}]`, false);

        rmaBuilder.data.state = STATE_BUILDER_STOPPED;
    }

    switch(action) {
        case 'builder-add-action':
            const selectedActionValue = document.getElementById("builder-available-actions").value;
            addTextToScript(selectedActionValue);
            break;

        case 'builder-run':
            rmaBuilder.data.state = STATE_BUILDER_RUNNING;
            await executeScript().catch(e => {});
            break;

        case 'builder-stop':
            rmaBuilder.data.state = STATE_BUILDER_STOPPED;
            rmaBuilder.data.actions = rmaBuilder.data.actions.map(action => { 
                action.isRunning = false;
                return action;
             })
            break;

        case 'builder-target':
            rmaBuilder.data.state = STATE_BUILDER_TARGETING;
            break;

        case 'builder-save':
            const scriptText = document.getElementById("builder-script").value;

            var a = document.createElement("a");
            a.download = "my-script.rma";
            a.href = window.URL.createObjectURL(new Blob([scriptText], { type: "text/plain" }));
            a.click();

            break;

        case "builder-compile-script":
            compileScript();
            break;
    }
};

document.addEventListener('click', clickHandler, false);

const keyupHandler = function (event) {
    // Don't let the game handle keyup when writing inside the script builder
    if(event.target.id === "builder-script") {
        event.stopPropagation();
        event.preventDefault();
        event.stopImmediatePropagation();
    }
};

document.addEventListener('keyup', keyupHandler, false);

const changeHandler = function (event) {
    // Don't let the game handle onchange when writing inside the script builder
    if (event.target.id === "builder-script") {
        event.stopPropagation();
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    var action = event.target.getAttribute('data-rma-action');

    if (!action) return;
};

document.addEventListener('change', changeHandler, false);
