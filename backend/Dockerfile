FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.lock .
RUN pip install --no-cache-dir --require-hashes -r requirements.lock

COPY . .

# Create the data directory before switching users so the non-root account
# owns it (and can therefore write uploads here at runtime).
RUN mkdir -p /app/data/documents \
    && useradd -r -u 1000 -g root -d /app -s /sbin/nologin vaapp \
    && chown -R vaapp:root /app

USER vaapp

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
