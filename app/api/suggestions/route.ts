import type { NextRequest } from "next/server";

import { getPrisma } from "@/lib/prisma";
import {
  BODY_MAX,
  RATE_PER_DAY,
  RATE_PER_MIN,
  validateSuggestion,
} from "@/lib/suggestions";

// The site's one write endpoint (feature 015): validate → honeypot → rate
// limit → insert. 201 only after the insert commits (ack-after-commit). No
// suggestion bodies, IPs, or secrets are ever logged; nothing personal is
// stored — the limiter sees IPs in memory only.

// In-memory sliding windows per IP. Every POST counts — accepted, rejected,
// honeypot — the limiter protects CPU and the DB connection, not just
// storage (research R5). Single-container deployment; resets on restart.
const hits = new Map<string, number[]>();
const DAY_MS = 86_400_000;
const MIN_MS = 60_000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < DAY_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) {
    // Bounded memory: drop the oldest entries wholesale under pathological
    // traffic; honest visitors just get a fresh window.
    for (const key of Array.from(hits.keys()).slice(0, 5_000)) hits.delete(key);
  }
  const lastMinute = recent.filter((t) => now - t < MIN_MS).length;
  return lastMinute > RATE_PER_MIN || recent.length > RATE_PER_DAY;
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

function json(body: object, status: number): Response {
  return Response.json(body, { status });
}

export async function POST(request: NextRequest): Promise<Response> {
  if (rateLimited(clientIp(request))) {
    return json({ ok: false, code: "rate_limited" }, 429);
  }

  const text = await request.text();
  if (text.length > BODY_MAX) {
    return json({ ok: false, code: "invalid_body" }, 400);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return json({ ok: false, code: "invalid_body" }, 400);
  }

  const result = validateSuggestion(raw);
  if (!result.ok) {
    return json({ ok: false, code: result.code }, 400);
  }
  if ("honeypot" in result) {
    // Success-shaped, nothing stored: bots learn nothing.
    return json({ ok: true }, 201);
  }

  try {
    await getPrisma().suggestion.create({ data: result.data });
  } catch {
    // No error details with request content in logs; the code says enough.
    console.error("suggestions: insert failed (storage unavailable)");
    return json({ ok: false, code: "storage_unavailable" }, 503);
  }
  return json({ ok: true }, 201);
}
