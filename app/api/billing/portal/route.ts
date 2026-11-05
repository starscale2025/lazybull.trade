// GET /api/billing/portal — send the user to where their subscription is
// managed. Lemon Squeezy has a customer portal; its URLs are pre-signed and
// die 24 hours after they were minted, so the order of preference is:
//   1. a fresh URL from the Lemon Squeezy API (needs LEMONSQUEEZY_API_KEY);
//   2. the URL the last webhook delivered, if it is under a day old;
//   3. the store's portal login page, where the customer signs in by email.
// Razorpay has no portal: /account explains how to cancel there instead.
// Nothing here is a fake destination — every branch lands on a real page.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { lsApiKey, lsStoreSubdomain } from "@/lib/billing/config";
import { currentSubscription, subscriptionsFor } from "@/lib/billing/subscriptions";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

async function freshPortalUrl(providerSubId: string): Promise<string | null> {
  const key = lsApiKey();
  if (!key) return null;
  try {
    const r = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${encodeURIComponent(providerSubId)}`, {
      headers: { Accept: "application/vnd.api+json", Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: { attributes?: { urls?: { customer_portal?: string } } } };
    const url = j.data?.attributes?.urls?.customer_portal;
    return typeof url === "string" && url.startsWith("https://") ? url : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const session = await auth();
  const origin = new URL(req.url).origin;
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/signin?callbackUrl=/account", origin), 302);
  }
  const rows = await subscriptionsFor(session.user.id).catch(() => []);
  const current = currentSubscription(rows);
  if (!current) {
    return NextResponse.redirect(new URL("/account?notice=no_subscription", origin), 302);
  }
  if (current.provider !== "lemonsqueezy") {
    return NextResponse.redirect(new URL(`/account?notice=${current.provider}`, origin), 302);
  }
  const fresh = await freshPortalUrl(current.providerSubId);
  if (fresh) return NextResponse.redirect(fresh, 302);
  if (current.portalUrl && Date.now() - current.updatedAt.getTime() < DAY_MS) {
    return NextResponse.redirect(current.portalUrl, 302);
  }
  const store = lsStoreSubdomain();
  if (store) return NextResponse.redirect(`https://${store}.lemonsqueezy.com/billing`, 302);
  return NextResponse.redirect(new URL("/account?notice=no_portal", origin), 302);
}
