---
title: Lazybull Quant AI
emoji: 📈
colorFrom: green
colorTo: gray
sdk: docker
app_port: 8000
pinned: false
---

# Lazybull Quant AI

FastAPI service serving the trained option-pricing + directional models behind
lazybull.trade's /quant AI bots. Built from the Dockerfile in this Space (CPU
torch). CORS allows `lazybull.us` / `*.lazybull.us` / `*.vercel.app`.

When this Space is running, the site's AI cards read **Source: Python NN**;
when it's asleep or unset they fall back to a deterministic TS surrogate
labelled **Mock**. Health check: `/health`.
