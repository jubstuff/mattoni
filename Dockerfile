# Build stage for client
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Build stage for server
FROM node:20-alpine AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Install production dependencies for server
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy built server
COPY --from=server-build /app/server/dist ./server/dist

# Copy built client to be served by Express
COPY --from=client-build /app/client/dist ./client/dist

# Create data directory for SQLite
RUN mkdir -p /app/server/data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

WORKDIR /app/server
CMD ["node", "dist/index.js"]
