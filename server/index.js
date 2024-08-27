const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const puppeteer = require('puppeteer');
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'client')));

// async function isPageActive(page) {
//     try {
//         return await page.evaluate(() => document.visibilityState === 'visible');
//     } catch (error) {
//         return undefined;
//     }
// }


io.on('connection', async (socket) => {
    console.log('New client connected');
    const device = { ...puppeteer.KnownDevices['iPhone 15 Pro'] };
    // device.name = 'Amogus';
    device.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
    device.viewport.deviceScaleFactor = 1;
    device.viewport.isMobile = false;
    device.viewport.hasTouch = false;
    device.viewport.isLandscape = true;
    console.log(device);

    let lastTabId = 0;
    let activeTabId = 0;
    const tabs = {};
    const browser = await puppeteer.launch({
        executablePath: process.env.NODE_ENV === "production" ? process.env.PUPPETEER_EXECUTABLE_PATH : puppeteer.executablePath(),
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--no-zygote"
        ]
    });

    async function startScreencast(tabId) {
        await tabs[tabId].client.send('Page.startScreencast', {
            format: 'jpeg',
            quality: 75,
            everyNthFrame: 2
        });
    }

    async function stopScreencast(tabId) {
        await tabs[tabId].client.send('Page.stopScreencast');
    };

    async function createTab(page = undefined) {
        tabs[lastTabId] = {};
        tabs[lastTabId].page = page || await browser.newPage();
        await tabs[lastTabId].page.emulate(device);
        await tabs[lastTabId].page.setViewport({ width: 1500, height: 1000 });
        tabs[lastTabId].page.on('dialog', async (dialog) => {
            console.log(dialog.message());
            await dialog.accept(); // might show usr laret
        });
        await tabs[lastTabId].page.evaluateOnNewDocument(() => {
            const newProto = navigator.__proto__;
            delete newProto.webdriver;
            navigator.__proto__ = newProto;
        });
        const client = tabs[lastTabId].client = await tabs[lastTabId].page.createCDPSession();
        client.on('Page.screencastFrame', async ({ data, sessionId }) => {
            socket.emit('screenshot', data);
            await client.send('Page.screencastFrameAck', { sessionId });
        });
        socket.emit("tabCreated", lastTabId);
        await tabs[lastTabId].page.goto('https://google.com');
        return lastTabId++;
    }

    async function deleteTab(tabId) {
        await stopScreencast(tabId);
        await tabs[tabId].client.detach();
        await tabs[tabId].page.close();
        delete tabs[tabId];
    }

    async function switchTab(tabId) {
        if (tabs[activeTabId]) {
            await stopScreencast(activeTabId);
        }
        await startScreencast(tabId);
        await tabs[tabId].page.bringToFront();
        activeTabId = tabId;
    }

    // browser.on('targetchanged', switchToActivePage);
    // browser.on('targetactivated', switchToActivePage);
    browser.on('targetcreated', async (target) => {
        const page = await target.page();
        for (const realPage of await browser.pages()) {
            if (page === realPage) {
                console.log("open", target);
                for (const tabId in tabs) {
                    if (tabs[tabId].page === page) {
                        return;
                    }
                }
                await createTab(page);
            }
        }
    });
    browser.on('targetdestroyed', async (target) => {
        try {
            console.log("close", target);
            const page = await target.page();
            for (const tabId in tabs) {
                if (tabs[tabId].page === page) {
                    await deleteTab(tabId);
                }
            }
        } catch { }
    });

    await createTab((await browser.pages())[0]);
    await startScreencast(0);

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

    async function closeConnection() {
        try {
            console.log('uh oh');
            clearInterval(missingframesidk);
            clearInterval(lastInputInterval);
            const pages = await browser.pages();
            for (let page of pages) {
                await page.close();
            }
        } catch (e) { console.error(e) } finally {
            await browser.close();
            console.log('nvm :)');
        }
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
            const screenshot = await tabs[activeTabId].page.screenshot({ type: 'jpeg', quality: 75 });
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
        const page = tabs[activeTabId].page;
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
        const page = tabs[activeTabId].page;
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
        const page = tabs[activeTabId].page;
        if (data.action === 'back') {
            await page.goBack();
        } else if (data.action === 'forward') {
            await page.goForward();
        } else if (data.action === 'refresh') {
            await page.reload();
        } else if (data.action === 'go' && data.url) {
            await page.goto(data.url);
        }
        console.log(data);
    });

    socket.on('scroll', async (data) => {
        lastInput = 0;
        const page = tabs[activeTabId].page;
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

    socket.on("createTab", async () => {
        lastInput = 0;
        await createTab();
        console.log("newTab");
    });

    socket.on("switchTab", async (data) => {
        lastInput = 0;
        await switchTab(data);
        console.log(data);
    });

    socket.on("deleteTab", async (data) => {
        lastInput = 0;
        if (Object.keys(tabs).length === 1) {
            return;
        }
        await deleteTab(data);
        let closest = Infinity;
        for (const tab in tabs) {
            if (tab < Infinity) {
                closest = tab;
            }
        }
        console.log(closest);
        await switchTab(closest);
        console.log(data);
    });

    socket.on('disconnect', closeConnection);
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});