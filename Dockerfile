# Etapa 1: compila el frontend Angular
FROM node:24-alpine AS web
WORKDIR /app/frontend-angular
COPY frontend-angular/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend-angular/ ./
RUN npm run build

# Etapa 2: API Express que sirve la API y el frontend compilado
FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=4010 \
    DATA_DIR=/data
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY backend/src ./src
COPY --from=web /app/frontend-angular/dist /app/frontend-angular/dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 4010
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:4010/api/salud || exit 1
CMD ["node", "--no-warnings", "src/server.js"]
