async function extractImages(page, url = page.url()) {
    try {
        if (url && url !== page.url()) {
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 120000
            });
        }

        const imageUrls = await page.evaluate(() =>
            Array.from(document.images, img => img.src)
        );

        return { url, images: imageUrls };
    } catch (error) {
        console.error(`Error extracting images from ${url}:`, error);
        return { url, images: null };
    }
}

const extractImagesFromUrls = async (urls, pages) => {
    const results = [];

    const processQueue = async (id) => {
        if (!pages[id].inUse) {
            pages[id].inUse = true;
            while (urls.length > 0) {
                const url = urls.shift();
                const result = await extractImages(pages[id].page, url);
                results.push(result);
            }
            pages[id].inUse = false;
        }
    };

    const workers = [];
    for (const id in pages) {
        workers.push(processQueue(id));
    }
    await Promise.all(workers);

    return results;
}

function scrape(socket, pages) {
    socket.on('imageUrls', async (urls) => {
        try {
            const images = await extractImagesFromUrls(urls, pages);
            socket.emit('imageUrls', images);
        } catch (error) {
            socket.emit('error', error.toString());
            console.error(error);
        }
    });
}

async function scrapePage(socket, page) {
    socket.emit('imageUrls', [await extractImages(page)]);
}

module.exports = { scrape, scrapePage };