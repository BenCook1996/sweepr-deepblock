FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json ./
COPY server.js sweepr-client.js outreach-seed-deepblock.json ./
COPY website ./website

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

USER node

CMD ["node", "server.js"]
