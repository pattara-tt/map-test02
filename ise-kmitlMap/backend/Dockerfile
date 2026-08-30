# ── SciMap Backend (Express API) ──
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# รันด้วย user ที่ไม่ใช่ root
RUN addgroup -S app && adduser -S app -G app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER app
EXPOSE 4000
CMD ["node", "src/server.js"]
