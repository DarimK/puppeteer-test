const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const puppeteer = require('puppeteer');
require('dotenv').config();
const { browse } = require('./browse');
const { scrape, scrapePage } = require('./scrape');
const { scrapeB, fetchFile } = require('./browserless');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: 'https://render.com',
        methods: ['GET', 'POST']
    }
});
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, '..', 'client')));

const MAX_PAGES = 5;
const device = { ...puppeteer.KnownDevices['iPhone 15 Pro'] };
device.name = 'Amogus';
device.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
device.viewport.width = 720;
device.viewport.height = 480;
device.viewport.deviceScaleFactor = 1;
device.viewport.isMobile = false;
device.viewport.hasTouch = false;
device.viewport.isLandscape = true;

let browser;
let pages = {};
(async () => {
    browser = await puppeteer.launch({
        executablePath: process.env.NODE_ENV === 'production' ? process.env.PUPPETEER_EXECUTABLE_PATH : puppeteer.executablePath(),
        headless: 'new',
        defaultViewport: null,
        protocolTimeout: 60000,
        args: [
            '--incognito',
            '--enable-low-end-device-mode',
            '--disable-features=FileSystemAPI',
            '--disable-file-system',
            '--no-file-access-from-files',
            '--enable-fast-text-encoding',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--no-sandbox',
            '--no-zygote',
            '--disable-software-rasterizer', // Offload rendering to CPU
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-extensions',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--mute-audio', // Disable audio
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-features=site-per-process', // Reduces memory overhead
            '--disable-background-timer-throttling', // Prevents Chrome from throttling timers in the background
            '--disable-crash-reporter', // Disables crash reporter
            '--disable-sync', // Disables syncing to reduce background load
            '--disable-component-extensions-with-background-pages', // Disables extensions that run background pages
            '--disable-speech-api',
            '--disable-prompt-on-repost', // Disables prompts related to reposting data
            '--disable-hang-monitor', // Disables the hang monitor that tries to diagnose browser hangs
            '--noerrdialogs', // Disables all error dialogs
            '--disable-domain-reliability', // Disables Chrome's domain reliability feature
            '--disable-translate', // Disables the translation feature
            '--disable-renderer-accessibility',
            '--disable-threaded-scrolling',
            '--disable-threaded-animation',
            '--disable-accelerated-2d-canvas',
            '--disable-accelerated-mjpeg-decode',
            '--disable-accelerated-video-decode',
            '--disable-background-media-suspend',
            '--disable-background-video-track',
            '--disable-devtools',
        ]
    });

    for (let i = 0; i < MAX_PAGES; i++) {
        const page = await browser.newPage();
        await page.emulate(device);
        await page.evaluateOnNewDocument(() => {
            const newProto = navigator.__proto__;
            delete newProto.webdriver;
            navigator.__proto__ = newProto;
        });
        
        // await page.setRequestInterception(true);
        // page.on('request', (request) => {
        //     const resourceType = request.resourceType();
        //     if (['image', 'script', 'document'].includes(resourceType)) {
        //         request.continue();
        //     } else {
        //         request.abort();
        //     }
        // });
        pages[i] = { page, inUse: false };
    }

    browser.on('targetcreated', async (target) => {
        const page = await target.page();
        if (page) {
            await page.close();
        }
    });

    (await browser.pages())[0].close();
})();

io.on('connection', (socket) => {
    console.log('New client connected');

    let pageInUse = undefined;
    socket.on('browse', () => {
        for (const id in pages) {
            if (!pages[id].inUse) {
                pages[id].inUse = true;
                pageInUse = id;
                browse(socket, pages[id].page);
                break;
            }
        }
    });

    socket.on('scrapePage', () => scrapePage(socket, pages[pageInUse].page));

    socket.on('fetchFile', (url) => fetchFile(socket, url));

    socket.on('scrape', () => scrape(socket, pages));

    socket.on('scrapeB', () => scrapeB(socket));

    socket.on('disconnect', () => {
        console.log('Client disconnected');

        if (pageInUse) {
            pages[pageInUse].inUse = false;
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

process.on('exit', async () => {
    if (browser) {
        await browser.close();
    }
});