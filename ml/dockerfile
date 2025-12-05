# Use official Python image
FROM python:3.11-slim

# Set working directory inside container
WORKDIR /app

# Copy only requirements first (for faster caching)
COPY requirements.txt ./

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the ML app
COPY . .

# Expose port for FastAPI
EXPOSE 6000

# Command to run FastAPI
CMD ["python", "main.py"]
