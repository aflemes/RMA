let lastNotificationSent = new Date();

setInterval(() => {
    if (!document.querySelector('#captcha_form')){
        return;
    }

    if (document.querySelector('#captcha_form').style.display === "block") {
        if ((new Date().getTime() / 1000) - (lastNotificationSent.getTime() / 1000) >= 20) {
            notify("RMA_CAPTCHA_ACTIVE");
            lastNotificationSent = new Date();
        }
    }
}, 2000);
