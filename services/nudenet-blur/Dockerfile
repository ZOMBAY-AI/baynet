FROM python:3.11-slim

WORKDIR /app

# Install system deps for opencv
RUN apt-get update -qq && apt-get install -y -qq libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

# Install Python deps
RUN pip install --no-cache-dir flask nudenet opencv-python-headless pillow gunicorn

COPY main.py .

# Cloud Run sets PORT env var
ENV PORT=8080

# Pre-download NudeNet model during build (not at runtime)
RUN python -c "from nudenet import NudeDetector; NudeDetector()"

CMD exec gunicorn --bind :$PORT --workers 1 --threads 2 --timeout 120 main:app
