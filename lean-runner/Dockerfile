FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=120

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl git ca-certificates build-essential libgmp-dev \
    && rm -rf /var/lib/apt/lists/*

RUN curl https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -sSf | sh -s -- -y

ENV PATH="/root/.elan/bin:${PATH}"

WORKDIR /app
COPY lean-runner/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --retries 6 --default-timeout=120 -r /app/requirements.txt

COPY lean-runner/app /app/app

WORKDIR /workspace/mesh_project
COPY mesh/mesh_project /workspace/mesh_project
RUN lake update && lake exe cache get

EXPOSE 9008

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9008"]
