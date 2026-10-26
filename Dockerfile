FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --omit=dev

COPY --chown=node:node src ./src

RUN mkdir -p /app/media/images && \
    chown -R node:node /app/media

EXPOSE 3000

USER node

CMD ["node", "src/index.js"]