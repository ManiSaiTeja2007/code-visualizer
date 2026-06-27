FROM python:3.11-slim

# Install system dependencies (graphviz is required by the CFG flow renderer)
RUN apt-get update && \
    apt-get install -y --no-install-recommends graphviz && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

EXPOSE 8000

# Start FastAPI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
