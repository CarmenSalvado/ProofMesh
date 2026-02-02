FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PYTHONPATH="/app:${PYTHONPATH}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl git ca-certificates build-essential libgmp-dev \
    && rm -rf /var/lib/apt/lists/*

# Install elan (Lean version manager)
RUN curl https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -sSf | sh -s -- -y

ENV PATH="/root/.elan/bin:${PATH}"

WORKDIR /app
COPY lean-runner/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --retries 6 --default-timeout=120 -r /app/requirements.txt

COPY lean-runner/app /app/app

# Copy mesh_project files (but NOT .lake cache - that's mounted as volume)
WORKDIR /workspace/mesh_project
COPY mesh/mesh_project/lakefile.toml mesh/mesh_project/lean-toolchain mesh/mesh_project/lake-manifest.json ./
COPY mesh/mesh_project/*.lean ./
COPY mesh/mesh_project/MeshProject ./MeshProject

# Create entrypoint script to fetch cache on first run if needed
RUN echo '#!/bin/bash\n\
set -e\n\
cd /workspace/mesh_project\n\
if [ ! -d ".lake/packages" ]; then\n\
  echo "Fetching Lean packages and Mathlib cache..."\n\
  lake update\n\
  lake exe cache get || true\n\
fi\n\
exec "$@"' > /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 9008

ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9008"]
