# Scaffold for Issue 02 (Identity Service). Add src/index.ts, then wire this
# service into infra/podman-compose.yaml. Build context is this directory.
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["node", "dist/index.js"]
