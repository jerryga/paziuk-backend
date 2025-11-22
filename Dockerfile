# Use the official lightweight Node.js image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Cloud Run injects the PORT environment variable
ENV PORT=8080

# Start the server
CMD ["npm", "start"]