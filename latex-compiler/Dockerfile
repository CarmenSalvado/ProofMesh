FROM python:3.12-slim

WORKDIR /app

# Install a minimal TeXLive set for math papers (AMS + fonts)
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-base \
    texlive-latex-recommended \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    texlive-science \
    texlive-lang-spanish \
    latexmk \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY app/ app/

EXPOSE 9009

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9009"]
