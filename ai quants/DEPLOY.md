# Deploy the Quant AI service → make /quant show "Python NN", not "Mock"

The browser calls this FastAPI service directly. In production the site reads
`NEXT_PUBLIC_QUANTAI_URL`; when it's empty (the current state) every AI bot
throws "quant API not configured" and falls back to the deterministic TS
surrogate labelled **Mock**. Three steps fix it.

## Free option (no card): Hugging Face Spaces

16 GB RAM, HTTPS, zero billing setup. It sleeps when idle — the first hit after
a nap may show Mock, then flips to Python NN once warm.

1. huggingface.co → sign up (free) → **New Space** → SDK: **Docker** → blank.
2. Clone the Space and copy this service into it, weights via Git LFS:

   ```bash
   git clone https://huggingface.co/spaces/<you>/lazybull-quant
   cd lazybull-quant
   git lfs install
   git lfs track "*.pt" "*.pkl"
   SRC="/Users/shaurya555/Desktop/lazybulllllll/laztbull/ai quants"
   cp "$SRC"/{serve.py,requirements.txt,Dockerfile,hf-README.md} .
   cp -r "$SRC"/{models,shared,weights} .
   mv hf-README.md README.md          # HF needs this frontmatter at the root
   git add .gitattributes .
   git commit -m "lazybull quant service"
   git push
   ```

3. HF builds the Docker image and serves it at
   `https://<you>-lazybull-quant.hf.space` → open `/health` to confirm.

Then jump to **step 2** below (set `NEXT_PUBLIC_QUANTAI_URL` + redeploy).

## 1 · Deploy this folder (with the weights) — paid hosts (Fly / Railway)

`weights/` (173 MB) is gitignored — reproducible, but the running service
needs it — so deploy with a tool that uploads your **local** directory, not a
git-connected build (which wouldn't have the weights).

**Fly.io** (recommended — builds from this folder, free HTTPS, idles cheap):

```bash
cd "ai quants"
fly launch --no-deploy     # creates fly.toml; name it e.g. lazybull-quant
fly deploy                 # builds the Dockerfile here → weights ship in the image
# → note the URL, e.g. https://lazybull-quant.fly.dev
```

**Railway** (alternative — `railway up` uploads local context):

```bash
cd "ai quants"
railway init && railway up
# → copy the generated https://…up.railway.app domain
```

Check it: open `https://YOUR-URL/health` → JSON, not an error.

## 2 · Point the site at it

Vercel → Project → Settings → Environment Variables:

```
NEXT_PUBLIC_QUANTAI_URL = https://YOUR-URL        # no trailing slash
```

## 3 · Redeploy the Next app

`NEXT_PUBLIC_*` is baked in at **build** time, so a fresh deploy is required —
push a commit or hit "Redeploy" in Vercel. After it's live, the /quant AI
cards flip to **Source: Python NN**.

### Notes
- Must be **HTTPS** — lazybull.us is HTTPS, so an `http://` service URL is
  blocked as mixed content.
- CORS already allows `lazybull.us` / `*.lazybull.us` / `*.vercel.app`
  (`serve.py`) — no change needed.
- The CPU-only Dockerfile lands ~1 GB. A tiny always-on instance is plenty;
  free tiers work but cold-start on first hit (the site's 8s timeout tolerates
  one warm-up; a second Run All is instant).
