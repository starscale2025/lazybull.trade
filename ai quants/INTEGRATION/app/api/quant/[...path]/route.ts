/**
 * Server-side proxy to the ai-quants FastAPI service.
 *
 * Browser calls /api/quant/bs → this route → http://localhost:8000/api/bs
 *
 * Why proxy:
 *   - hides the Python service URL
 *   - lets you add auth, rate limiting, and edge caching here
 *   - lets the Python service run inside a private network in prod
 */
import { NextRequest, NextResponse } from "next/server";

const QUANT_INTERNAL = process.env.QUANT_INTERNAL_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const url = `${QUANT_INTERNAL}/api/${path.join("/")}`;
  const body = await req.text();
  const upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });
  const data = await upstream.text();
  return new NextResponse(data, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const upstream = await fetch(`${QUANT_INTERNAL}/${path.join("/")}`, { cache: "no-store" });
  const data = await upstream.text();
  return new NextResponse(data, { status: upstream.status, headers: { "Content-Type": "application/json" } });
}
