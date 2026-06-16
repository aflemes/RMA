chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        switch(request?.notification) {
            case "RMA_CAPTCHA_ACTIVE":
                chrome.notifications.create('RMA_CAPTCHA_ACTIVE', {
                    type: 'basic',
                    iconUrl: 'img/notification.png',
                    title: 'RPG MO Captcha',
                    message: 'You need to answer the captcha !',
                    priority: 2,
                });

                chrome.windows.getCurrent(function (w) {
                    w.focus();
                    chrome.tabs.getSelected(w.id,
                        function (response) {
                            alert(response.url);
                        });
                });

                window.focus();
                break;
        }

        if (request?.download) {
            // todo download file with request.download.content and request.download.filename
        }

        if (request?.type === 'NOPECHA_SUBMIT') {
            handleNopechaSubmit(request).then(sendResponse);
            return true;
        }

        if (request?.type === 'NOPECHA_POLL') {
            handleNopechaPoll(request).then(sendResponse);
            return true;
        }

        if (request?.type === 'NOPECHA_STATUS') {
            handleNopechaStatus(request).then(sendResponse);
            return true;
        }
    }
);

async function handleNopechaSubmit({ imageUrl, apiKey }) {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = 'Basic ' + apiKey;

    try {
        const submitRes = await fetch('https://api.nopecha.com/v1/recognition/textcaptcha', {
            method: 'POST',
            headers,
            body: JSON.stringify({ image_data: [imageUrl] })
        });

        if (!submitRes.ok) {
            const errText = await submitRes.text().catch(() => '');
            console.log('[RMA NopeCHA] Submit failed:', submitRes.status, errText);
            return { error: `Submit failed (${submitRes.status}): ${errText}` };
        }

        const submit = await submitRes.json();
        const jobId = submit.data;
        if (!jobId) {
            console.log('[RMA NopeCHA] No job ID:', JSON.stringify(submit));
            return { error: 'No job ID in response' };
        }

        console.log('[RMA NopeCHA] Job submitted, ID:', jobId);
        return { jobId };
    } catch (e) {
        console.log('[RMA NopeCHA] Submit error:', e);
        return { error: e.message };
    }
}

async function handleNopechaPoll({ jobId, apiKey }) {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = 'Basic ' + apiKey;

    try {
        const pollRes = await fetch(`https://api.nopecha.com/v1/recognition/textcaptcha?id=${jobId}`, { headers });
        if (!pollRes.ok) return { status: 'retry' };

        const poll = await pollRes.json();

        if (poll.data && Array.isArray(poll.data) && poll.data.length > 0) {
            const solution = String(poll.data[0]).trim();
            console.log('[RMA NopeCHA] Solution:', JSON.stringify(solution));
            return { result: solution };
        }

        return { status: 'retry' };
    } catch (e) {
        console.log('[RMA NopeCHA] Poll error:', e);
        return { status: 'retry' };
    }
}

async function handleNopechaStatus({ apiKey }) {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = 'Basic ' + apiKey;

    try {
        const url = apiKey
            ? `https://api.nopecha.com/v1/status?key=${apiKey}`
            : 'https://api.nopecha.com/v1/status';
        const res = await fetch(url, { headers });
        if (!res.ok) return { error: 'Status fetch failed: ' + res.status };
        const data = await res.json();
        return { credit: data.credit, quota: data.quota };
    } catch (e) {
        return { error: e.message };
    }
}