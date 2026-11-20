FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-vie tesseract-ocr-eng poppler-utils && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PAPER_REVIEW_STORAGE=/app/data/paper-review
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data/paper-review && chown -R node:node /app/data
VOLUME ["/app/data"]

USER node

EXPOSE 3000

CMD ["node", "dist/server.js"]
