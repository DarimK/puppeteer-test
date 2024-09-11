const socket = io((window.location.hostname === "localhost") ? "/" : "https://puppeteer-test-ptgg.onrender.com/");
const keys = {};
const mouse = {};
const lastMousePos = {};
let isDragging = false;
let frameTotal = 0;
setInterval(() => {
    console.log(frameTotal);
    frameTotal = 0;
}, 1000);

socket.emit('browse');

socket.on('screenshot', (data) => {
    document.getElementById('screen').src = 'data:image/png;base64,' + data;
    frameTotal++;
});

// socket.on("tabCreated", (data) => {
//     const tab = document.createElement("div");
//     tab.style.display = "inline";
//     const open = document.createElement("button");
//     open.innerHTML = data;
//     open.onclick = () => {
//         socket.emit("switchTab", data);
//     };
//     const close = document.createElement("button");
//     close.innerHTML = "x";
//     close.onclick = () => {
//         socket.emit("deleteTab", data);
//         document.getElementById("tabs").removeChild(tab);
//     };
//     tab.appendChild(open);
//     tab.appendChild(close);
//     document.getElementById("tabs").appendChild(tab);
//     console.log(data);
// });

document.addEventListener('mousedown', (event) => {
    const img = document.getElementById('screen');
    const rect = img.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        mouse.x = x;
        mouse.y = y;
        mouse[event.button] = 1;
        socket.emit('mouse', mouse);
    }
});

document.addEventListener('mousemove', (event) => {
    const img = document.getElementById('screen');
    const rect = img.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        mouse.x = x;
        mouse.y = y;
    }
});
setInterval(() => {
    if (lastMousePos.x !== mouse.x || lastMousePos.y !== mouse.y) {
        lastMousePos.x = mouse.x;
        lastMousePos.y = mouse.y;
        socket.emit('mouse', mouse);
    }
}, 100);

document.addEventListener('mouseup', (event) => {
    const img = document.getElementById('screen');
    const rect = img.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        mouse.x = x;
        mouse.y = y;
        mouse[event.button] = 0;
        socket.emit('mouse', mouse);
        delete mouse[event.button];
    }
});

document.addEventListener('keydown', (event) => {
    if (!keys[event.key]) {
        keys[event.key] = 1;
        socket.emit('keyboard', keys);
    }
});
document.addEventListener('keyup', (event) => {
    if (keys[event.key]) {
        keys[event.key] = 0;
        socket.emit('keyboard', keys);
        delete keys[event.key];
    }
});


document.getElementById('go').addEventListener('click', () => {
    const url = document.getElementById('urlInput').value;
    socket.emit('navigation', { action: 'go', url });
});

document.getElementById('back').addEventListener('click', () => {
    socket.emit('navigation', { action: 'back' });
});

document.getElementById('forward').addEventListener('click', () => {
    socket.emit('navigation', { action: 'forward' });
});

document.getElementById('refresh').addEventListener('click', () => {
    socket.emit('navigation', { action: 'refresh' });
});

document.getElementById('scrollUp').addEventListener('click', () => {
    socket.emit('scroll', { direction: 'up' });
});

document.getElementById('scrollDown').addEventListener('click', () => {
    socket.emit('scroll', { direction: 'down' });
});

document.getElementById('scrollLeft').addEventListener('click', () => {
    socket.emit('scroll', { direction: 'left' });
});

document.getElementById('scrollRight').addEventListener('click', () => {
    socket.emit('scroll', { direction: 'right' });
});

// document.getElementById('createTab').addEventListener('click', () => {
//     socket.emit('createTab');
// });

document.getElementById('captureBtn').addEventListener('click', () => {
    socket.emit('scrapePage');
});

socket.on('imageUrls', (data) => {
    console.log(data);
    let total = 0;
    const imagesList = document.getElementById('images');
    imagesList.innerHTML = '';
    data.forEach((obj) => {
        const mainLi = document.createElement('li');
        const url = document.createElement('code');
        url.innerHTML = obj.url;
        mainLi.appendChild(url);
        const ol = document.createElement('ol');
        obj.images.forEach((img) => {
            if (img) {
                const imgUrl = document.createElement('code');
                imgUrl.innerHTML = img;
                const li = document.createElement('li');
                li.appendChild(imgUrl);
                ol.appendChild(li);
                total++;
            }
        });
        mainLi.appendChild(ol);
        imagesList.appendChild(mainLi);
    });
    const totalImages = document.getElementById('total');
    totalImages.innerHTML = `Total: ${total}`;
});

socket.on('error', (error) => {
    alert('Error: ' + error);
});