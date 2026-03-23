const BASE_URL = "https://api.base44.app/api/apps/69b13e3366aa63081f267024/functions";

async function request(path, options = {}) {
  try {
    const fullUrl = `${BASE_URL}${path}`;
    console.log("[Trusteam SW] fetch:", fullUrl);
    const response = await fetch(fullUrl, {
      headers: {
        "Content-Type": "application/json",
        "api_key": "3e21bc07f7a342eb9dc5403afed064a1",
        ...(options.headers || {})
      },
      ...options
    });
    console.log("[Trusteam SW] response status:", response.status);

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
  if (!token) {
    console.log("[Trusteam SW] getPageTrust: no token, skipping");
    return null;
  }
  console.log("[Trusteam SW] getPageTrust calling API for:", domain);
  try {
    const result = await request("/getPageTrust", {
      method: "POST",
      headers: {
        "x-user-token": token
      },
      body: JSON.stringify({ url, domain })
    });
    console.log("[Trusteam SW] getPageTrust result:", result ? "success" : "null");
    return result;
  } catch (e) {
    console.error("[Trusteam SW] getPageTrust error:", e.message);
    return null;
  }
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
    // Decode JWT payload (base64) to get user info without API call
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    console.log("[Trusteam SW] JWT payload:", JSON.stringify(payload));
    if (!payload) return null;
    // Return user object from JWT payload
    return {
      email: payload.email || payload.sub || null,
      name: payload.name || payload.email || null,
      coins: payload.coins || 0,
      id: payload.sub || payload.id || null
    };
  } catch (error) {
    console.error("Trusteam JWT decode error:", error);
    return null;
  }
}

const STORAGE_KEYS = {
  TOKEN: "trusteam_token",
  USER: "trusteam_user",
  COINS: "trusteam_coins"
};

async function getAuthState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER, STORAGE_KEYS.COINS],
      (result) => {
        const token = result[STORAGE_KEYS.TOKEN] || null;
        const user = result[STORAGE_KEYS.USER] || null;
        const coins = typeof result[STORAGE_KEYS.COINS] === "number" ? result[STORAGE_KEYS.COINS] : 0;
        resolve({
          isLoggedIn: Boolean(token && user),
          user,
          token,
          coins
        });
      }
    );
  });
}

async function setAuthState({ token, user, coins }) {
  return new Promise((resolve) => {
    const data = {};
    if (typeof token !== "undefined") data[STORAGE_KEYS.TOKEN] = token;
    if (typeof user !== "undefined") data[STORAGE_KEYS.USER] = user;
    if (typeof coins !== "undefined") data[STORAGE_KEYS.COINS] = coins;
    chrome.storage.local.set(data, () => resolve());
  });
}

async function clearAuthState() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(
      [STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER, STORAGE_KEYS.COINS],
      () => resolve()
    );
  });
}

function openBase44AppTab() {
  const appUrl = "https://trust-layer-flow.base44.app";
  chrome.tabs.create({ url: appUrl, active: true });
}

async function tryReadTokenFromTab(tabId) {
  if (typeof tabId !== "number") return;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        try {
          if (!window.localStorage) return null;
          const value = window.localStorage.getItem("base44_access_token");
          return value || null;
        } catch (e) {
          return null;
        }
      }
    });

    if (!results || !results[0] || !results[0].result) return;
    const token = results[0].result;
    if (!token) return;

    const user = await verifyAuth(token);
    if (!user) {
      return;
    }

    const initialCoins = typeof user.coins === "number" ? user.coins : 0;
    await setAuthState({ token, user, coins: initialCoins });
  } catch (error) {
    console.error("Trusteam token read error:", error);
  }
}

function setupBase44TokenListener() {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete" || !tab || !tab.url) {
      return;
    }

    let url;
    try {
      url = new URL(tab.url);
    } catch {
      return;
    }

    if (url.hostname !== "trust-layer-flow.base44.app") {
      return;
    }

    tryReadTokenFromTab(tabId);
  });
}

function checkActiveTabForToken() {
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0] || !tabs[0].url) return;
      let url;
      try {
        url = new URL(tabs[0].url);
      } catch {
        return;
      }
      if (url.hostname !== "trust-layer-flow.base44.app") return;
      tryReadTokenFromTab(tabs[0].id);
    });
  } catch (error) {
    console.error("Trusteam active tab check error:", error);
  }
}

function scanAllTabsForToken() {
  try {
    chrome.tabs.query({}, (tabs) => {
      if (!tabs || !tabs.length) return;
      tabs.forEach((tab) => {
        if (!tab || !tab.url) return;
        let url;
        try {
          url = new URL(tab.url);
        } catch {
          return;
        }
        if (url.hostname !== "trust-layer-flow.base44.app") return;
        tryReadTokenFromTab(tab.id);
      });
    });
  } catch (error) {
    console.error("Trusteam scan all tabs error:", error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  scanAllTabsForToken();
});

chrome.runtime.onStartup.addListener(() => {
  scanAllTabsForToken();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "GET_AUTH_STATE": {
        const state = await getAuthState();
        console.log("[Trusteam SW] GET_AUTH_STATE:", state.isLoggedIn ? "logged in" : "not logged in");
        if (!state.isLoggedIn) {
          // Try to recover token from active Trusteam tab
          checkActiveTabForToken();
          // Wait a moment then re-check storage
          await new Promise((resolve) => setTimeout(resolve, 500));
          const retryState = await getAuthState();
          sendResponse(retryState);
        } else {
          sendResponse(state);
        }
        break;
      }
      case "GET_PAGE_TRUST": {
        const { url, domain } = message.payload || {};
        const { token } = await getAuthState();
        if (!token) {
          sendResponse(null);
          break;
        }
        const data = await getPageTrust(url, domain, token);
        sendResponse(data);
        break;
      }
      case "SUBMIT_SIGNAL": {
        const state = await getAuthState();
        if (!state || !state.token) {
          sendResponse(null);
          break;
        }

        const token = state.token;
        const payload = message.payload || {};
        const rating = message.rating || payload.rating || payload.signal_type || "gem";
        const categories = payload.categories || [];

        let url = payload.url;
        let domain = payload.domain;
        let page_title = payload.page_title;

        if (!url && sender && sender.tab && sender.tab.url) {
          url = sender.tab.url;
          try {
            domain = new URL(url).hostname;
          } catch {
            domain = "";
          }
          page_title = (sender.tab && sender.tab.title) || domain;
        }

        const body = {
          url,
          rating,
          page_title,
          domain,
          categories
        };

        try {
          const submitUrl = `${BASE_URL}/submitSignal`;
          const submitRes = await fetch(submitUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              api_key: "3e21bc07f7a342eb9dc5403afed064a1",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(body)
          });

          console.log("[Trusteam SW] submitSignal status:", submitRes.status);
          const submitBody = await submitRes.text();
          console.log("[Trusteam SW] submitSignal body:", submitBody.substring(0, 200));

          const submitResult = submitRes.ok ? JSON.parse(submitBody) : null;
          const trustData = url && domain ? await getPageTrust(url, domain, token) : null;

          if (submitResult && typeof submitResult.coins_earned === "number") {
            const newCoins = (state.coins || 0) + submitResult.coins_earned;
            await setAuthState({ coins: newCoins });
            submitResult.total_coins = newCoins;
          }

          sendResponse({
            success: true,
            trust: trustData,
            ...(submitResult || {})
          });
        } catch (e) {
          console.error("Trusteam SUBMIT_SIGNAL error:", e);
          sendResponse({ success: false });
        }

        break;
      }
      case "SAVE_TOKEN": {
        try {
          const token = message && message.token;
          if (!token) {
            sendResponse({ success: false });
            break;
          }
          const user = await verifyAuth(token);
          if (!user) {
            sendResponse({ success: false });
            break;
          }
          const initialCoins = typeof user.coins === "number" ? user.coins : 0;
          await setAuthState({ token, user, coins: initialCoins });
          sendResponse({ success: true });
        } catch (e) {
          console.error("Trusteam SAVE_TOKEN error:", e);
          sendResponse({ success: false });
        }
        break;
      }
      case "CHECK_TOKEN_AND_OPEN_APP": {
        const state = await getAuthState();
        if (!state || !state.token) {
          openBase44AppTab();
          sendResponse({ hasToken: false });
        } else {
          sendResponse({ hasToken: true });
        }
        break;
      }
      case "OPEN_APP_PAGE": {
        const page = message.page || "GemFeed";
        const explicitUrl =
          typeof message.url === "string" && message.url.trim() ? message.url.trim() : null;
        const appUrl =
          explicitUrl || `https://trust-layer-flow.base44.app/${page}`;
        let targetHost = "trust-layer-flow.base44.app";
        try {
          targetHost = new URL(appUrl).hostname;
        } catch {
          // keep default
        }
        console.log("[Trusteam SW] OPEN_APP_PAGE received, page:", page, "url:", appUrl);
        chrome.tabs.query({}, (tabs) => {
          const existing = (tabs || []).find((t) => {
            try {
              return t.url && new URL(t.url).hostname === targetHost;
            } catch {
              return false;
            }
          });
          if (existing && existing.id != null) {
            console.log("[Trusteam SW] Updating existing tab:", existing.id);
            chrome.tabs.update(existing.id, { active: true, url: appUrl });
          } else {
            console.log("[Trusteam SW] Creating new tab:", appUrl);
            chrome.tabs.create({ url: appUrl, active: true });
          }
        });
        sendResponse({ success: true });
        break;
      }
      case "LOGOUT": {
        await clearAuthState();
        sendResponse({ success: true });
        break;
      }
      default:
        break;
    }
  })();

  return true;
});

setupBase44TokenListener();
checkActiveTabForToken();

