const BASE_URL = "https://api.base44.com/api/apps/69b13e3366aa63081f267024/functions";

async function request(path, options = {}) {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Trusteam API error:", error);
    return null;
  }
}

async function getPageTrust(url, domain, token) {
  if (!token) return null;
  return await request("/getPageTrust", {
    method: "POST",
    headers: {
      "x-user-token": token
    },
    body: JSON.stringify({ url, domain })
  });
}

async function submitSignal(data, token) {
  if (!token) return null;
  return await request("/submitSignal", {
    method: "POST",
    headers: {
      "x-user-token": token
    },
    body: JSON.stringify(data)
  });
}

async function verifyAuth(token) {
  if (!token) return null;
  try {
    const response = await fetch(
      "https://api.base44.com/api/apps/69b13e3366aa63081f267024/auth/me",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-token": token
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Trusteam auth error:", error);
    return null;
  }
}

