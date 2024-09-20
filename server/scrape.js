async function extractImages(page, url = page.url()) {
    try {
        if (url && url !== page.url()) {
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 300000
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

async function extractImagesFromUrls(urls, pages) {
    const results = [];

    for (const id in pages) {
        if (!pages[id].inUse) {
            pages[id].inUse = true;
            while (urls.length > 0) {
                const url = urls.shift();
                const result = await extractImages(pages[id].page, url);
                results.push(result);
            }
            pages[id].inUse = false;
            break;
        }
    }

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

async function grabEverything(socket, page) {
    await page.setRequestInterception(true);

    page.on('request', async (request) => {
        if (request.resourceType() === 'image') {
            try {
                const imageUrl = request.url();

                const base64Image = await page.evaluate(async (url) => {
                    try {
                        const response = await fetch(url);
                        const blob = await response.blob();
                        const reader = new FileReader();

                        return new Promise((resolve, reject) => {
                            reader.onloadend = () => {
                                const base64data = reader.result.split(',')[1];
                                resolve(base64data);
                            };
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                    } catch {
                        return null;
                    }
                }, imageUrl);

                if (base64Image) {
                    const contentType = request.headers()['content-type'] || 'image/jpeg'; // Default to jpeg if unknown
                    socket.emit('fileData', { contentType, fileData: base64Image });
                }
            } catch { }
            request.abort();
        } else {
            request.continue();
        }
    });
}

module.exports = { scrape, scrapePage, grabEverything };