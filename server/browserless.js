const axios = require('axios');
const cheerio = require('cheerio');

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
};

const options = {
    headers,
    timeout: 30000,
    responseType: 'text'
};

async function extractImagesFromUrlsBrowserless(urls) {
    const fetchImages = async (url) => {
        try {
            const { data } = await axios.get(url, options);
            const $ = cheerio.load(data);

            const imageUrls = $('img').map((i, img) => $(img).attr('src')).get();

            return { url, images: imageUrls };
        } catch (error) {
            console.error(`Error fetching images from ${url}:`, error);
            return { url, images: null };
        }
    };

    const imageUrlsPerPage = await Promise.all(urls.map(fetchImages));

    return imageUrlsPerPage;
}

function scrapeB(socket) {
    socket.on('imageUrls', async (urls) => {
        try {
            const images = await extractImagesFromUrlsBrowserless(urls);
            socket.emit('imageUrls', images);
        } catch (error) {
            socket.emit('error', error.toString());
            console.error(error);
        }
    });
}

async function fetchFile(socket, url, base64 = true) {
    try {
        if (url.startsWith('data:')) {
            const [header, fileData] = url.split(',');
            const contentType = header.split(':')[1].split(';')[0];

            socket.emit('fileData', { contentType, fileData });
        } else {
            const newOptions = { ...options };
            newOptions.responseType = 'arraybuffer';
            const response = await axios.get(url, newOptions);

            const contentType = response.headers['content-type'];
            const fileData = base64 ? Buffer.from(response.data, 'binary').toString('base64') : response.data;

            socket.emit('fileData', { contentType, fileData });
        }
    } catch (error) {
        socket.emit('error', error.toString());
        console.error(error);
    }
}

module.exports = { scrapeB, fetchFile };