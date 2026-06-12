let rma = new Reef('#rma', {
    data: {
        title: 'RPG MO Assistant',
    },
    template: function (props) {
        return `
            <div id="rma-menu">
                <div id="automation">
                    <div id="fight">
                        <div class="sub-section">Fight</div>
                        <div id="enemies"></div>
                        <button class="start">Refresh ennemies</button>
                        <div class="fight-delay-config">
                            <div class="delay-label">Delay between kills (ms)</div>
                            <div class="flex gap-10">
                                <input id="fight-delay-min" type="number" min="0" step="100" value="${typeof RMA_CONFIG !== 'undefined' ? RMA_CONFIG.FIGHT_DELAY_MIN : 300}" placeholder="Min" />
                                <input id="fight-delay-max" type="number" min="0" step="100" value="${typeof RMA_CONFIG !== 'undefined' ? RMA_CONFIG.FIGHT_DELAY_MAX : 1200}" placeholder="Max" />
                            </div>
                        </div>
                    </div>
                </div>

                <div id="rma-builder"></div>
            </div>
        `;
    }
});

/*
<div id="farming">
    <div class="sub-section">Farming</div>
    <div id="seeds"></div>
    <button class="refresh">Refresh available seeds</button>
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

// Delay config inputs — event delegation since Reef re-renders content
document.getElementById('rma').addEventListener('change', (e) => {
    if (e.target.id === 'fight-delay-min') {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 0) RMA_CONFIG.FIGHT_DELAY_MIN = val;
    }
    if (e.target.id === 'fight-delay-max') {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 0) RMA_CONFIG.FIGHT_DELAY_MAX = val;
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
