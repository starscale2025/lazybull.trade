#!/usr/bin/env python3
"""One-shot uploader for the LAZYBULL quant service → its Hugging Face Space.

Uses huggingface_hub, which auto-handles LFS for the big weight files — no
git-lfs, no manual git needed. Also swaps in the Docker README so HF rebuilds
the Space as Docker (it's currently a bare `sdk: static` template).

    hf auth login            # once — paste a WRITE token from hf.co/settings/tokens
    python3 deploy_to_hf.py
"""

from huggingface_hub import HfApi

REPO = "shaurya2077/lazybull-quant"
SRC = "/Users/shaurya555/Desktop/lazybulllllll/laztbull/ai quants"

api = HfApi()

print("uploading service + weights (173MB via LFS — give it a minute)…")
api.upload_folder(
    folder_path=SRC,
    repo_id=REPO,
    repo_type="space",
    ignore_patterns=[
        ".venv/*", ".venv/**",
        "**/__pycache__/*", "**/__pycache__/**", "*.pyc",
        ".git/*", ".git/**", ".DS_Store",
        "data/cache/*", "data/cache/**",
        "graphify-out/*", "graphify-out/**",
        "INTEGRATION/*", "INTEGRATION/**",
        "*.log",
        # handled separately / not wanted in the Space:
        "README.md", "hf-README.md", "DEPLOY.md", "deploy_to_hf.py",
    ],
)

print("setting the Docker README (flips the Space from static → docker)…")
api.upload_file(
    path_or_fileobj=f"{SRC}/hf-README.md",
    path_in_repo="README.md",
    repo_id=REPO,
    repo_type="space",
)

print("\n✅ done. Open the Space page — it will show 'Building' for a few")
print("   minutes, then 'Running'. Then hit /health.")
