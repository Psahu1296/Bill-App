# Step 1: Build frontend
FROM node:18-alpine AS builder

WORKDIR /app/pos-frontend
COPY pos-frontend/package*.json ./
RUN npm install
COPY pos-frontend/ .
RUN npm run build

# Step 2: Setup backend
FROM node:18-alpine

# Set working dir
WORKDIR /app

# Copy backend code
COPY pos-backend/ ./pos-backend
COPY --from=builder /app/pos-frontend/dist /app/pos-frontend/dist

WORKDIR /app/pos-backend
RUN npm install

# Expose your backend port
EXPOSE 5000

# Start backend
CMD ["node", "app.js"]
