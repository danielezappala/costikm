# Build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY client/package*.json ./client/

RUN npm ci
RUN npm ci --prefix client

COPY server ./server
COPY client ./client

RUN npm run build --prefix client \
  && mkdir -p server/public \
  && cp -r client/dist/* server/public/

# Runtime stage
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY --from=build /app/server/public ./server/public

EXPOSE 4000
CMD ["node", "server/index.js"]
