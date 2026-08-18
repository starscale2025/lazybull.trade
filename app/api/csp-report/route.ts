import { clientIp, underLimit } from "@/lib/rate-limit";

// Collector for the report-only CSP in next.config.ts. Browsers POST an
// application/csp-report JSON body here on every violation; one compact warn
// line per report makes the promote-to-enforced decision readable from server
// logs instead of end users' consoles. Always responds 204: a reporter must
// never be error-looped, and the endpoint holds nothing worth probing.

const MAX_BODY_BYTES = 8_000;
// Per-minute caps — a broken page can emit a report per resource, so allow a
// burst per IP but keep a global lid on log volume.
const MAX_PER_IP = 20;
const MAX_GLOBAL = 200;

// Report fields are attacker-controlled (this endpoint is unauthenticated and
// anyone can POST): newlines would let a caller forge extra log lines in this
// collector's own format, which matters because these logs are the evidence for
// promoting the CSP to enforced. Flatten whitespace and clamp per field.
const logSafe = (v: unknown) => String(v ?? "?").replace(/[\r\n\t]/g, " ").slice(0, 200);

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  if (await underLimit("csp-report", ip, MAX_PER_IP, MAX_GLOBAL)) {
    try {
      const declared = Number(req.headers.get("content-length") ?? 0);
      if (declared <= MAX_BODY_BYTES) {
        const text = await req.text();
        if (text.length <= MAX_BODY_BYTES) {
          const r = (JSON.parse(text)?.["csp-report"] ?? {}) as Record<string, unknown>;
          console.warn(
            `csp-report: ${logSafe(r["violated-directive"])} blocked ${logSafe(r["blocked-uri"])} on ${logSafe(r["document-uri"])}`,
          );
        }
      }
    } catch {
      // Malformed or non-JSON reports are dropped — never 4xx/5xx a reporter.
    }
  } else {
    // Say so once: otherwise a throttled window is indistinguishable from a
    // quiet one when reading the promote-to-enforced evidence.
    console.warn("csp-report: throttled — reports dropped this window");
  }
  return new Response(null, { status: 204 });
}
