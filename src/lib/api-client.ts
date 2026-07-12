import { auth } from "./firebase";

/**
 * Generates standard client headers with Firebase ID token (JWT) or mock JWT in dev environment.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      headers["Authorization"] = `Bearer ${token}`;
    } catch (e) {
      console.warn("Failed to get Firebase ID token:", e);
    }
  } else {
    // Check if we are in development mode and have a mock user
    const isDev = process.env.NODE_ENV === "development";
    if (isDev && typeof window !== "undefined") {
      const mockUser = localStorage.getItem("craftstyle_mock_user");
      if (mockUser) {
        try {
          const parsed = JSON.parse(mockUser);
          if (parsed && parsed.uid) {
            headers["Authorization"] = `Bearer mock_${parsed.email || "user@example.com"}_${parsed.uid}`;
          }
        } catch (e) {}
      }
    }
  }

  return headers;
}
