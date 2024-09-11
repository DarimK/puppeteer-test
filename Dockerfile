FROM ghcr.io/puppeteer/puppeteer:22.15.0

ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

COPY package*.json .
RUN npm ci
COPY . .
CMD [ "node", "server/index.js" ]