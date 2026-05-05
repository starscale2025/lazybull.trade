"""Merge duplicate nodes in graph.json caused by AST+semantic ID drift.

Heuristic: nodes are duplicates if they share (source_file, normalized_label).
Normalization strips parens, dots, and common suffixes like "()", " (...)" so:
  - "make_features()"
  - "make_features (technical indicators)"
  - "shared.features.make_features"
all collapse to "make_features".

Canonical ID priority: AST node (has source_location line number) > semantic.
"""
from __future__ import annotations
import json, re
from pathlib import Path
from collections import defaultdict

GRAPH = Path(__file__).parent / "graph.json"


AMBIGUOUS = {"init", "main", "forward", "build", "run", "report", "fit", "transform", "predict_proba"}


def normalize_label(label: str) -> str:
    s = label.strip()
    s = re.sub(r"\(.*?\)", "", s)         # drop parens
    s = re.sub(r"\s+\[.*?\]", "", s)      # drop brackets
    s = s.split(".")[-1]                   # drop dotted prefixes (shared.features.make_features → make_features)
    s = re.sub(r"[^a-zA-Z0-9_]", "_", s)
    return s.lower().strip("_")


def is_safe_to_merge(norm: str, group: list[dict]) -> bool:
    """Skip ambiguous names — same label can mean different functions in same file."""
    if not norm or norm.isdigit():
        return False
    if norm in AMBIGUOUS:
        return False
    # any node with no source_location is risky if there's another with a different qualifier in id
    ids = [n.get("id", "") for n in group]
    # if IDs encode different parent classes (e.g. mlp_init vs standardscaler_init), don't merge
    suffixes = {i.rsplit("_", 1)[0].rsplit("_", 1)[-1] for i in ids}
    if len(suffixes) > 1 and norm in {"init", "forward", "fit", "predict", "transform"}:
        return False
    return True


def main():
    data = json.loads(GRAPH.read_text())
    nodes = data.get("nodes", [])
    edges = data.get("links", []) or data.get("edges", [])
    print(f"BEFORE: {len(nodes)} nodes, {len(edges)} edges")

    # group by (source_file, normalized_label)
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for n in nodes:
        if "id" not in n:
            continue
        src = n.get("source_file") or ""
        norm = normalize_label(n.get("label", n["id"]))
        # only group within same file — different files with same label name are NOT aliases
        groups[(src, norm)].append(n)

    # build remap: alias_id -> canonical_id
    remap: dict[str, str] = {}
    merged_count = 0
    for (src, norm), grp in groups.items():
        if len(grp) <= 1 or not src or not norm:
            continue
        if not is_safe_to_merge(norm, grp):
            continue
        # canonical: prefer one with source_location set (AST), else longest id
        canonical = max(grp, key=lambda n: (
            1 if n.get("source_location") else 0,
            len(n.get("id", "")),
        ))
        for n in grp:
            if n["id"] != canonical["id"]:
                remap[n["id"]] = canonical["id"]
                merged_count += 1
        if len(grp) > 1:
            ids = [n["id"] for n in grp]
            print(f"  merge [{src}::{norm}]: {ids} → {canonical['id']}")

    print(f"\n{merged_count} nodes will be merged into canonical IDs")

    # rewrite edges with remapped IDs (deduplicate identical edges)
    seen_edges = set()
    new_edges = []
    for e in edges:
        s = remap.get(e.get("source"), e.get("source"))
        t = remap.get(e.get("target"), e.get("target"))
        if not s or not t or s == t:
            continue
        key = (s, t, e.get("relation", ""), e.get("confidence", ""))
        if key in seen_edges:
            continue
        seen_edges.add(key)
        e2 = dict(e)
        e2["source"] = s
        e2["target"] = t
        new_edges.append(e2)

    # filter nodes — drop aliased ones
    new_nodes = [n for n in nodes if n["id"] not in remap]

    # write back (preserving original schema with "links" or "edges")
    if "links" in data:
        data["nodes"] = new_nodes
        data["links"] = new_edges
    else:
        data["nodes"] = new_nodes
        data["edges"] = new_edges
    GRAPH.write_text(json.dumps(data, indent=2))
    print(f"\nAFTER:  {len(new_nodes)} nodes, {len(new_edges)} edges")
    print(f"        ({len(nodes)-len(new_nodes)} nodes merged, {len(edges)-len(new_edges)} edges deduplicated)")


if __name__ == "__main__":
    main()
