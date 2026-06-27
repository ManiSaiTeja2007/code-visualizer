# Stage 1: Build static assets
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package descriptors and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and compile production bundles
COPY . .
RUN npm run build

# Stage 2: Serve static files using Nginx
FROM nginx:alpine

# Copy custom Nginx configuration if needed, otherwise use default
# Copy compiled static assets from builder stage to Nginx serve directory
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
