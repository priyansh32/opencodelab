FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=4173

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/docker/serve-static.mjs ./serve-static.mjs

EXPOSE 4173

CMD ["node", "serve-static.mjs"]
