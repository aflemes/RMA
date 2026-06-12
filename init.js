/**
 * Inject menu.html into page and create <script> tags containing all scripts
 **/

fetch(chrome.runtime.getURL('/menu.html')).then(r => r.text()).then(html => {
    document.querySelector("#wrapper").insertAdjacentHTML('beforeend', html);

    const scripts = [
        "utils.js",
        "libs/reef.min.js",
        "menu.js",
        "builder/actions.js", 
        "builder/builder.js",
        "captcha-notifier.js",
        "automation/healing.js", 
        "automation/fight.js", 
        "automation/farming.js"
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
        chrome.runtime.sendMessage(evt.detail);
    }, false);
});
