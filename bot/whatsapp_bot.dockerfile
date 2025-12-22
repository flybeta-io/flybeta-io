# Use the official lightweight Node.js image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package definitions
COPY package*.json ./

# Install dependencies (Express, PG, Axios)
RUN npm install

# Copy the rest of your app code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
