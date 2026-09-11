FROM mcr.microsoft.com/playwright:v1.58.2-jammy AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
COPY packages/cli/package.json packages/cli/

RUN npm ci

COPY . .
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.58.2-jammy AS production

ENV NODE_ENV=production \
    PORT=3000 \
    RGAAUDIT_DATA_DIR=/data

WORKDIR /app
COPY --from=build /app /app

RUN mkdir -p /data && chown -R pwuser:pwuser /data /app

USER pwuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "start"]
