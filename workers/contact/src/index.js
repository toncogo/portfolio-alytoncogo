const MAX_BODY_BYTES = 16 * 1024;
const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const RESEND_URL = "https://api.resend.com/emails";

function jsonResponse(body, status, origin = "") {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });

  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Vary", "Origin");
  }

  return new Response(JSON.stringify(body), { status, headers });
}

async function readLimitedJson(request) {
  const declaredSize = Number(request.headers.get("Content-Length") || 0);
  if (declaredSize > MAX_BODY_BYTES) return null;
  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function normalizedText(value, maxLength) {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim();
  if (
    normalized.length < 1 ||
    normalized.length > maxLength ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function validateContact(input) {
  const name = normalizedText(input.name, 80);
  const email = normalizedText(input.email, 254)?.toLowerCase();
  const subject = normalizedText(input.subject, 120);
  const phoneRaw = normalizedText(input.phone, 32);
  const turnstileToken = normalizedText(input.turnstileToken, 2048);
  const phoneDigits = phoneRaw?.replace(/\D/g, "");
  const nationalPhone =
    phoneDigits?.startsWith("55") && phoneDigits.length > 11
      ? phoneDigits.slice(2)
      : phoneDigits;

  if (
    !name ||
    name.length < 2 ||
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) ||
    !subject ||
    subject.length < 2 ||
    !nationalPhone ||
    !/^\d{10,11}$/u.test(nationalPhone) ||
    !turnstileToken
  ) {
    return null;
  }

  return {
    name,
    email,
    subject,
    phone: nationalPhone,
    turnstileToken,
    honeypot: typeof input.website === "string" ? input.website.slice(0, 200) : "",
  };
}

async function verifyTurnstile(token, ip, env, expectedHostname) {
  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: ip,
    }),
    signal: AbortSignal.timeout(6000),
  });

  if (!response.ok) return false;
  const result = await response.json();
  return (
    result.success === true &&
    result.hostname === expectedHostname &&
    result.action === "contact"
  );
}

async function sendContact(contact, env) {
  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.CONTACT_FROM_EMAIL,
      to: [env.CONTACT_EMAIL],
      reply_to: contact.email,
      subject: "Contact via portfolio: " + contact.subject,
      text: [
        "New contact received via the portfolio.",
        "",
        "Name: " + contact.name,
        "Phone: " + contact.phone,
        "E-mail: " + contact.email,
        "Website: " + contact.website,
        "Subject: " + contact.subject,
      ].join("\n"),
    }),
    signal: AbortSignal.timeout(8000),
  });

  return response.ok;
}

export default {
  async fetch(request, env) {
    let expectedOrigin;
    try {
      expectedOrigin = new URL(env.SITE_ORIGIN).origin;
    } catch {
      return jsonResponse({ error: "Service temporarily unavailable." }, 503);
    }

    const requestOrigin = request.headers.get("Origin") || "";
    if (requestOrigin !== expectedOrigin) {
      return jsonResponse({ error: "Unauthorized origin." }, 403);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": expectedOrigin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "600",
          Vary: "Origin",
        },
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, 405, expectedOrigin);
    }

    if (!request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
      return jsonResponse({ error: "Invalid submission format." }, 415, expectedOrigin);
    }

    if (
      !env.CONTACT_LIMITER ||
      !env.TURNSTILE_SECRET_KEY ||
      !env.RESEND_API_KEY ||
      !env.CONTACT_EMAIL ||
      !env.CONTACT_FROM_EMAIL
    ) {
      return jsonResponse({ error: "Service temporarily unavailable." }, 503, expectedOrigin);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "anonymous";
    const rate = await env.CONTACT_LIMITER.limit({ key: ip });
    if (!rate.success) {
      return jsonResponse(
        { error: "Too many attempts. Please wait a minute and try again." },
        429,
        expectedOrigin,
      );
    }

    const input = await readLimitedJson(request);
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return jsonResponse({ error: "Review the data and try again." }, 400, expectedOrigin);
    }

    const contact = validateContact(input);
    if (!contact) {
      return jsonResponse({ error: "Review the form fields." }, 400, expectedOrigin);
    }

    // Honeypot submissions receive a generic success and are never forwarded.
    if (contact.honeypot) {
      return jsonResponse({ ok: true }, 202, expectedOrigin);
    }

    let expectedHostname;
    try {
      expectedHostname = new URL(expectedOrigin).hostname;
    } catch {
      return jsonResponse({ error: "Service temporarily unavailable." }, 503, expectedOrigin);
    }

    try {
      const verified = await verifyTurnstile(
        contact.turnstileToken,
        ip,
        env,
        expectedHostname,
      );
      if (!verified) {
        return jsonResponse(
          { error: "The verification has expired. Please complete it again." },
          400,
          expectedOrigin,
        );
      }

      const sent = await sendContact(contact, env);
      if (!sent) {
        return jsonResponse(
          { error: "Unable to send right now. Please try again later." },
          502,
          expectedOrigin,
        );
      }

      return jsonResponse({ ok: true }, 201, expectedOrigin);
    } catch {
      return jsonResponse(
        { error: "Unable to send right now. Please try again later." },
        502,
        expectedOrigin,
      );
    }
  },
};
