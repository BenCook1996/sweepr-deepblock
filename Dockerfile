FROM node:24-bookworm-slim

RUN apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY server.js sweepr-client.js outreach-seed-deepblock.json ./
COPY website ./website
COPY data ./data
COPY scripts ./scripts
COPY extension/manifest.json ./extension/manifest.json
COPY extension/_locales ./extension/_locales
COPY extension/rules ./extension/rules

RUN mkdir -p /app/data/.cache /app/dist/store-listings && chown -R node:node /app/data /app/dist /app/website /app/extension /app/scripts

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node

CMD ["node", "server.js"]
