FROM node:alpine

ENV PORT=3000
ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

RUN npm run build

EXPOSE $PORT

CMD ["npm", "start"]
