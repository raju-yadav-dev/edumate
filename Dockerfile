# Multi-stage Dockerfile for EduMate Backend Production Deployment
FROM node:20-alpine AS builder

WORKDIR /app

# Install server dependencies
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm ci --prefix server

# Copy application source code
COPY . .

# Expose backend API port
EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "server/server.js"]
