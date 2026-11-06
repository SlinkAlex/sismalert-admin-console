const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";
const STORAGE_KEY = "sismalert_admin_jws_session_v1";

function base64UrlEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function generateLocalFallbackJWS(userPayload) {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + 15 * 60;
  const refreshExpSec = nowSec + 7 * 24 * 60 * 60;
  const jti =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `jti-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWS" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: userPayload.uid,
      email: userPayload.email,
      role: "admin",
      jti,
      iat: nowSec,
      exp: expSec
    })
  );

  const enc = new TextEncoder();
  const key = await window.crypto.subtle.importKey(
    "raw",
    enc.encode("sismalert_jws_access_secret_key_2026_iujo_cybercrew_hs256"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await window.crypto.subtle.sign("HMAC", key, enc.encode(`${header}.${payload}`));
  const sigHex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const signature = base64UrlEncode(sigHex);

  return {
    accessToken: `${header}.${payload}.${signature}`,
    refreshToken: `${header}.${signature.slice(0, 24)}`,
    tokenType: "Bearer JWS",
    algorithm: "HS256",
    jti,
    issuedAt: nowSec * 1000,
    expiresAt: expSec * 1000,
    refreshExpiresAt: refreshExpSec * 1000,
    signatureHash: signature.slice(0, 20),
    rotationCount: (userPayload.rotationCount || 0) + 1
  };
}

export async function issueAdminJWSSession(userPayload) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${BACKEND_URL}/api/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...userPayload, role: "admin" }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const session = { ...data.session, rotationCount: 1 };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      return session;
    }
  } catch {
    // Fallback local
  }
  const fallback = await generateLocalFallbackJWS(userPayload);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
  return fallback;
}

export async function refreshAdminJWSSession(currentSession, userPayload) {
  const prevCount = currentSession?.rotationCount || 1;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refreshToken: currentSession?.refreshToken,
        userFallback: { ...userPayload, role: "admin" }
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const session = { ...data.session, rotationCount: prevCount + 1 };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      return session;
    }
  } catch {
    // Fallback local
  }
  const rotated = await generateLocalFallbackJWS({ ...userPayload, rotationCount: prevCount });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rotated));
  return rotated;
}

export function getStoredAdminJWSSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAdminJWSSession() {
  localStorage.removeItem(STORAGE_KEY);
}
