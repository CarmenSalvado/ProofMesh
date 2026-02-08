FROM python:3.12-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Elan (Lean version manager)
ENV ELAN_HOME="/root/.elan"
ENV PATH="$ELAN_HOME/bin:$PATH"
RUN curl -L https://github.com/leanprover/elan/releases/download/v3.0.0/elan-x86_64-unknown-linux-gnu.tar.gz -o elan.tar.gz && \
    tar -xzf elan.tar.gz && \
    ./elan-init -y --default-toolchain leanprover/lean4:v4.27.0 && \
    rm elan.tar.gz elan-init

# Python dependencies
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# App code
COPY backend/alembic.ini /app/alembic.ini
COPY backend/alembic /app/alembic
COPY backend/app /app/app
COPY backend/scripts /app/scripts
COPY mesh /app/mesh

# Entrypoint
COPY backend/scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV APP_RELOAD=false
EXPOSE 8000

CMD ["/entrypoint.sh"]
