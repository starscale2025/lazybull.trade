# LAZYBULL Quant AI — FastAPI + trained torch models.
#
# IMPORTANT: build this image with a LOCAL build context. The 173MB weights/
# directory is gitignored (reproducible via models/*/train.py), so a platform
# that git-clones your repo will NOT have the weights and every model would
# fall back. Deploy with a tool that uploads the local directory:
#   • Fly.io:   fly deploy            (builds from this folder — weights included)
#   • Railway:  railway up            (uploads local context)
#   • Docker:   docker build -t lazybull-quant .  then push the image to a registry
#
# CORS already allows lazybull.us / *.lazybull.us / *.vercel.app (serve.py).

FROM python:3.12-slim

WORKDIR /app

# CPU-only torch keeps the image ~1GB instead of ~5GB (no CUDA payload).
COPY requirements.txt .
RUN pip install --no-cache-dir \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      -r requirements.txt

# App code + the trained weights (see .dockerignore — weights/ is KEPT).
COPY . .

# PaaS inject $PORT; default 8000 for a local `docker run`.
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn serve:app --host 0.0.0.0 --port ${PORT:-8000}"]
