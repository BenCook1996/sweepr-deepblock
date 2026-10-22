FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json ./
COPY server.js sweepr-client.js outreach-seed-deepblock.json ./
COPY website ./website

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000 8080

CMD ["node", "server.js"]
