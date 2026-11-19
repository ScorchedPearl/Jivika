FROM python:3.12-slim

WORKDIR /app

# System libraries needed by opencv-python (cv2) and xgboost
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies (CPU-only torch keeps the image small)
COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=180 --retries=10 --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

# Copy application code and model weights
COPY . .

EXPOSE 5000

# docker-compose picks which service this container runs
CMD ["sh", "-c", "python -m flask --app ${ML_APP} run --host 0.0.0.0 --port 5000"]
