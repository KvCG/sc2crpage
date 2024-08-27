# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy only the necessary files for installing dependencies
COPY package-lock.json package.json ./
RUN npm ci

# Copy the rest of the source code
COPY src ./src
COPY tsconfig.node.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY scripts ./scripts

# Build the application
RUN npm run build

# Stage 2: Create the final image
FROM node:20-alpine

WORKDIR /app

# Copy the build output from the builder stage
COPY --from=builder /app/dist ./dist

# Optionally copy other runtime-only files like package.json
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm ci --production

CMD ["node", "dist/webserver/server.cjs"]

EXPOSE 3000
