/**
 * Inject menu.html into page and create <script> tags containing all scripts
 **/

fetch(chrome.runtime.getURL('/menu.html')).then(r => r.text()).then(html => {
    document.querySelector("#wrapper").insertAdjacentHTML('beforeend', html);

    const logoEl = document.getElementById('rma-logo');
    if (logoEl) logoEl.src = chrome.runtime.getURL('img/rma-logo.png');

    const scripts = [
        "utils.js",
        "libs/reef.min.js",
        "menu.js",
        "builder/actions.js", 
        "builder/builder.js",
        "captcha-notifier.js",
        "automation/healing.js", 
        "automation/fight.js", 
        "automation/farming.js",
        "automation/inventory.js"
    ];

    // Load scripts sequentially so each one finishes before the next starts.
    // Parallel injection (a plain for-loop) causes race conditions where later
    // scripts run before earlier ones finish defining their globals.
    const loadNext = (index) => {
        if (index >= scripts.length) return;
        const s = document.createElement('script');
        s.src = chrome.runtime.getURL(scripts[index]);
        s.onload = function () {
            this.remove();
            loadNext(index + 1);
        };
        s.onerror = function () {
            console.error('[RMA] Failed to load script:', scripts[index]);
            this.remove();
            loadNext(index + 1);
        };
        (document.head || document.documentElement).appendChild(s);
    };
    loadNext(0);

    window.addEventListener("PassToBackground", function (evt) {
        try { chrome.runtime.sendMessage(evt.detail).catch(() => {}); } catch(e) {}
    }, false);

    window.addEventListener('NopechaStatusRequest', async (evt) => {
        const { apiKey } = evt.detail;
        try {
            const result = await chrome.runtime.sendMessage({ type: 'NOPECHA_STATUS', apiKey });
            window.dispatchEvent(new CustomEvent('NopechaStatusResponse', { detail: result }));
        } catch (e) {
            window.dispatchEvent(new CustomEvent('NopechaStatusResponse', { detail: { error: e.message } }));
        }
    }, false);

    window.addEventListener('NopechaRequest', async (evt) => {
        const { id, imageUrl, apiKey } = evt.detail;

        try {
            const submitRes = await chrome.runtime.sendMessage({ type: 'NOPECHA_SUBMIT', imageUrl, apiKey });
            if (!submitRes || submitRes.error) {
                window.dispatchEvent(new CustomEvent('NopechaResponse', {
                    detail: { id, error: submitRes?.error || 'Submit failed' }
                }));
                return;
            }

            const { jobId } = submitRes;

            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 2000));

                const pollRes = await chrome.runtime.sendMessage({ type: 'NOPECHA_POLL', jobId, apiKey });
                if (!pollRes) continue;

                if (pollRes.result) {
                    const digits = pollRes.result.replace(/\D/g, '');
                    window.dispatchEvent(new CustomEvent('NopechaResponse', {
                        detail: { id, result: digits }
                    }));
                    return;
                }
            }

            window.dispatchEvent(new CustomEvent('NopechaResponse', {
                detail: { id, error: 'Polling timeout after 30 attempts' }
            }));
        } catch (e) {
            window.dispatchEvent(new CustomEvent('NopechaResponse', {
                detail: { id, error: e.message }
            }));
        }
    }, false);
});
