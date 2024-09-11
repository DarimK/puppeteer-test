const navigateOptions = { waitUntil: 'networkidle2', timeout: 120000 };

// async function isPageActive(page) {
//     try {
//         return await page.evaluate(() => document.visibilityState === 'visible');
//     } catch (error) {
//         return undefined;
//     }
// }

async function browse(socket, page) {
    page.on('dialog', async (dialog) => {
        console.log(dialog.message());
        await dialog.accept(); // might show usr laret
    });
    await page.goto('https://google.com', navigateOptions);

    let lastInput = 0;
    const lastInputInterval = setInterval(() => {
        // console.log(lastInput);
        if (lastInput >= 60) {
            if (socket.connected) {
                socket.disconnect();
            } else {
                closeConnection();
            }
        } else {
            lastInput++;
        }
    }, 1000);

    function closeConnection() {
        console.log('uh oh');
        clearInterval(missingframesidk);
        clearInterval(lastInputInterval);
    }

    // page.on('console', msg => console.log('Page LOG:', msg.text()));
    // page.on('load', () => {
    //     console.log("load");
    // });
    // await page.setRequestInterception(true);
    // page.on('request', request => {
    //     if (request.isNavigationRequest()) {
    //         setTimeout(() => {
    //             request.continue();
    //         }, 1000);
    //         console.log("nav");
    //     } else {
    //         request.continue();
    //     }
    // });

    async function capture() {
        try {
            const screenshot = await page.screenshot({ type: 'jpeg', quality: 25, timeout: 5000 });
            socket.emit('screenshot', screenshot.toString('base64'));
        } catch (error) {
            console.error(error);
        }
    }

    // let i = 0;
    // function thing() {//this thing executes await on queue, setinterval add screenshots to queue
    //     timeout = setTimeout(async () => {
    //         // console.log(i, callbackQueue.length); i++;
    //         // console.log(await browser.pages());
    //         if (await isPageActive(page) === false) {
    //             await page.bringToFront();//doesnt work
    //         }
    //         while (callbackQueue.length > 0) {
    //             try {
    //                 if (await isPageActive(page)) {
    //                     await callbackQueue[0]();//porbaly can fix dis
    //                 }
    //             } catch (error) {
    //                 console.error('Navigation timeout:', error);
    //             } finally { callbackQueue.shift(); }
    //         }
    //         callbackQueue.push(() => { return capture() });
    //         if (timeout) thing();
    //     }, 10);
    // }
    // thing();

    const missingframesidk = setInterval(capture, 1000);

    //setup touch as well
    socket.on('mouse', async (data) => {//distinguish between left,right,middle (maybe add back,fwd)
        lastInput = 0;
        try {
            const viewport = page.viewport();
            const x = data.x * viewport.width;
            const y = data.y * viewport.height;
            await page.mouse.move(x, y);
            if (data[0]) {
                await page.mouse.down({ button: 'left' });
            } else {
                await page.mouse.up({ button: 'left' });
            }
            if (data[1]) {
                await page.mouse.down({ button: 'middle' });
            } else {
                await page.mouse.up({ button: 'middle' });
            }
            if (data[2]) {
                await page.mouse.down({ button: 'right' });
            } else {
                await page.mouse.up({ button: 'right' });
            }
        } catch { }
        console.log(data);
    });

    const keys = {};
    socket.on('keyboard', async (data) => {
        lastInput = 0;
        try {
            for (const key in data) {
                if (keys[key] && data[key]) {
                    continue;
                }
                keys[key] = true;
                if (data[key]) {
                    await page.keyboard.down(key);
                } else {
                    await page.keyboard.up(key);
                    delete keys[key];
                }
            }
        } catch { }
        console.log(data);
    });

    socket.on('navigation', async (data) => {
        lastInput = 0;
        if (data.action === 'back') {
            await page.goBack(navigateOptions);
        } else if (data.action === 'forward') {
            await page.goForward(navigateOptions);
        } else if (data.action === 'refresh') {
            await page.reload(navigateOptions);
        } else if (data.action === 'go' && data.url) {
            await page.goto(data.url, navigateOptions);
        }
        console.log(data);
    });

    socket.on('scroll', async (data) => {
        lastInput = 0;
        try {
            if (data.direction === 'up') {
                await page.evaluate(() => window.scrollBy(0, -100));
            } else if (data.direction === 'down') {
                await page.evaluate(() => window.scrollBy(0, 100));
            } else if (data.direction === 'left') {
                await page.evaluate(() => window.scrollBy(-100, 0));
            } else if (data.direction === 'right') {
                await page.evaluate(() => window.scrollBy(100, 0));
            }
        } catch { }
        console.log(data);
    });

    socket.on('disconnect', closeConnection);
}

module.exports = { browse };