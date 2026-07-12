import crypto from "crypto";

interface DecodedToken {
  iss: string;
  aud: string;
  sub: string;
  email?: string;
  uid: string;
  [key: string]: any;
}

// Memory cache for Google's public certificates
let cachedCerts: Record<string, string> | null = null;
let certsExpiryTime = 0;

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedCerts && now < certsExpiryTime) {
    return cachedCerts;
  }

  const res = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
  if (!res.ok) {
    throw new Error("Failed to fetch Google public certificates for JWT verification");
  }

  // Read cache-control header to determine TTL
  const cacheControl = res.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : 3600 * 1000;

  cachedCerts = await res.json();
  certsExpiryTime = now + maxAge;
  return cachedCerts!;
}

/**
 * Verifies a Firebase ID Token (JWT) on the server side using Google's public certificates.
 * Also supports mock tokens format "mock_<email>_<uid>" in development mode.
 */
export async function verifyIdToken(token: string): Promise<DecodedToken> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("Firebase Project ID not configured in environment variables");
  }

  const isDev = process.env.NODE_ENV === "development";

  // In development mode, allow bypass with mock tokens formatted as "mock_email_uid"
  if (isDev && token.startsWith("mock_")) {
    const parts = token.split("_");
    const email = parts[1] || "user@example.com";
    const uid = parts.slice(2).join("_") || `mock_${Date.now()}`;
    return {
      iss: `https://securetoken.google.com/${projectId}`,
      aud: projectId,
      sub: uid,
      uid,
      email,
      isMock: true,
    };
  }

  // Parse JWT components
  const tokenParts = token.split(".");
  if (tokenParts.length !== 3) {
    throw new Error("Invalid JWT token format");
  }

  const [headerB64, payloadB64, signatureB64] = tokenParts;

  let header: { kid?: string; alg?: string };
  let payload: DecodedToken;

  try {
    header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch (err) {
    throw new Error("Failed to decode token headers/payload JSON");
  }

  if (header.alg !== "RS256") {
    throw new Error("Invalid signature algorithm. Expected RS256");
  }

  if (!header.kid) {
    throw new Error("Missing 'kid' in token header");
  }

  // Fetch Google certs and retrieve the correct certificate for the 'kid'
  const certs = await getGooglePublicCerts();
  let publicKeyPem = certs[header.kid];
  if (!publicKeyPem) {
    // If kid not found, re-fetch certs to handle key rotation
    cachedCerts = null;
    const freshCerts = await getGooglePublicCerts();
    publicKeyPem = freshCerts[header.kid];
    if (!publicKeyPem) {
      throw new Error(`Public key certificate not found for kid: ${header.kid}`);
    }
  }

  // Verify signature
  const verified = crypto.verify(
    "sha256",
    Buffer.from(`${headerB64}.${payloadB64}`),
    publicKeyPem,
    Buffer.from(signatureB64, "base64url")
  );

  if (!verified) {
    throw new Error("Invalid cryptographical token signature");
  }

  // Verify claims
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowSeconds) {
    throw new Error("Auth token has expired");
  }

  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error(`Invalid token issuer: ${payload.iss}`);
  }

  if (payload.aud !== projectId) {
    throw new Error(`Invalid token audience: ${payload.aud}`);
  }

  // Firebase user ID is in sub
  payload.uid = payload.sub;

  return payload;
}

/**
 * Extracts and verifies ID token from Authorization header.
 */
export async function authenticateRequest(req: Request): Promise<DecodedToken> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const token = authHeader.split("Bearer ")[1];
  return verifyIdToken(token);
}

/**
 * Verifies if the request belongs to an Admin.
 */
export async function verifyAdminRequest(req: Request): Promise<DecodedToken> {
  const user = await authenticateRequest(req);
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admincraftstyle@gmail.com";

  if (user.email !== adminEmail && user.email !== "admin@craftstyle.com") {
    throw new Error("Forbidden: Administrator privileges required");
  }

  return user;
}
