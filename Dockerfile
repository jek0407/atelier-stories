FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY workers/requirements.txt workers/requirements.txt
RUN python3 -m venv /opt/image-worker && /opt/image-worker/bin/pip install --no-cache-dir -r workers/requirements.txt
COPY --chown=node:node . .
RUN mkdir -p data && chown node:node data
ENV HOST=0.0.0.0 PORT=3000 PYTHON_BIN=/opt/image-worker/bin/python DATA_DIR=/app/data
USER node
EXPOSE 3000
CMD ["node", "server/index.js"]
