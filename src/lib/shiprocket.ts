let cachedToken: string | null = null;
let tokenExpiry = 0;

/**
 * Authenticates with Shiprocket API and retrieves cacheable Bearer token.
 */
export async function getShiprocketToken(): Promise<string | null> {
  const email = process.env.SHIPROCKET_EMAIL;
  const pass = process.env.SHIPROCKET_PASSWORD;

  if (!email || !pass || email.includes("YOUR_") || pass.includes("YOUR_")) {
    return null;
  }

  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  try {
    const res = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    });

    if (!res.ok) {
      console.warn("Shiprocket auth endpoint rejected credentials.");
      return null;
    }

    const data = await res.json();
    if (data.token) {
      cachedToken = data.token;
      // Cache token for 23 hours (normally valid for 24+ hours)
      tokenExpiry = now + 23 * 60 * 60 * 1000;
      return cachedToken;
    }
  } catch (err) {
    console.error("Error authenticating with Shiprocket API:", err);
  }
  return null;
}
