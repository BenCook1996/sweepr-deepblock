FROM node:24.22.1-bookworm-slim

RUN apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY server.js sweepr-client.js outreach-seed-deepblock.json ./
COPY website ./website

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000 8080

CMD ["node", "server.js"]
