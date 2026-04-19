# Use Node.js slim image
FROM node:24-slim

# Set working directory
WORKDIR /app

# Copy server package files first for better caching
COPY server/package*.json ./server/

# Install dependencies
RUN cd server && npm install --production

# Copy the rest of the application
COPY . .

# Create directory for SQLite database
RUN mkdir -p /app/data && chmod 777 /app/data

# Set environment variables
ENV PORT=5000
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/fitness_aura.sqlite

# Expose port
EXPOSE 5000

# Start the application
CMD ["node", "server/server.js"]
