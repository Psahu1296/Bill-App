FROM node:20-alpine

# Build tools needed for better-sqlite3 native module
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Data directory for SQLite persistent volume
RUN mkdir -p /data

ENV NODE_ENV=production
ENV DATABASE_PATH=/data/dhaba-pos.db
ENV PORT=8080

EXPOSE 8080
CMD ["node", "dist/server.js"]
