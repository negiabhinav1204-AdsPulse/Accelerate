FROM python:3.13-slim

# Install bash
RUN apt-get update && \
    apt-get install -y bash && \
    rm -rf /var/lib/apt/lists/*

# Create a user and group with UID/GID 1001
RUN addgroup --gid 1001 accelerate && \
    adduser --disabled-password --gecos "" --uid 1001 --gid 1001 accelerate

# Set working directory
ENV APP_DIR=/app
WORKDIR $APP_DIR

# Playwright browser path (shared location accessible by all users)
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers

# Copy requirements and install
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Install Playwright browsers for crawl4ai web scraping
RUN playwright install-deps && \
    mkdir -p $PLAYWRIGHT_BROWSERS_PATH && \
    playwright install chromium && \
    chmod -R 755 $PLAYWRIGHT_BROWSERS_PATH && \
    rm -rf /var/lib/apt/lists/*

# Copy app code
COPY . .

# Give full permissions to accelerate user
RUN chown -R accelerate:accelerate $APP_DIR && \
    chmod -R 777 $APP_DIR

# Switch to non-root user
USER accelerate

# Expose FastAPI port
EXPOSE 8080

# Workers: set via UVICORN_WORKERS env var (default: 1).
# Rule of thumb: 2 * CPU_REQUEST for async apps (all I/O bound, no CPU work).
# Each worker is a separate process with its own event loop.
ENV UVICORN_WORKERS=1

# Start the app
CMD uvicorn src.agentic_platform.api.server:app \
    --host 0.0.0.0 \
    --port 8080 \
    --workers ${UVICORN_WORKERS}
