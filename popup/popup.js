const POPUP_STATE = {
  auth: null,
  trust: null,
  tab: null
};

function getTrustLevelFromCoins(coins) {
  if (typeof coins !== "number") return "Guest";
  if (coins < 500) return "Bronze";
  if (coins < 2000) return "Silver";
  if (coins < 5000) return "Gold";
  return "Platinum";
}

function getDomainFromUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return "";
  }
}

function getScoreColor(score) {
  if (typeof score !== "number") return "#9e9e9e";
  if (score >= 70) return "#1a7a4a";
  if (score >= 40) return "#f0a500";
  return "#e53935";
}

function selectEl(id) {
  return document.getElementById(id);
}

function updateAuthUI() {
  const nameEl = selectEl("popup-user-name");
  const levelEl = selectEl("popup-trust-level");
  const authSection = selectEl("popup-auth-section");
  const pageSection = selectEl("popup-page-section");

  const isLoggedIn = POPUP_STATE.auth && POPUP_STATE.auth.isLoggedIn;

  if (!isLoggedIn) {
    nameEl.textContent = "Not connected";
    levelEl.textContent = "Guest";
    levelEl.style.background = "#e5e7eb";
    authSection.classList.remove("hidden");
    pageSection.classList.add("hidden");
  } else {
    const user = POPUP_STATE.auth.user || {};
    const coins = POPUP_STATE.auth.coins || 0;
    nameEl.textContent = user.full_name || user.email || "Connected";
    const level = getTrustLevelFromCoins(coins);
    levelEl.textContent = level;
    levelEl.style.background = "#e0f2e9";
    authSection.classList.add("hidden");
    pageSection.classList.remove("hidden");
  }
}

function updateTrustUI() {
  const data = POPUP_STATE.trust;
  const domainEl = selectEl("popup-domain");
  const scoreValEl = selectEl("popup-score-value");
  const scoreFillEl = selectEl("popup-score-bar-fill");
  const gemCountEl = selectEl("popup-gem-count");
  const junkCountEl = selectEl("popup-junk-count");
  const gemBtn = selectEl("popup-gem-btn");
  const junkBtn = selectEl("popup-junk-btn");

  const domain = POPUP_STATE.tab ? getDomainFromUrl(POPUP_STATE.tab.url) : "";
  domainEl.textContent = domain || "-";

  if (!data) {
    scoreValEl.textContent = "-";
    scoreFillEl.style.width = "0%";
    scoreFillEl.style.backgroundColor = "#9e9e9e";
    gemCountEl.textContent = "💎 0";
    junkCountEl.textContent = "🗑️ 0";
    gemBtn.classList.remove("popup-chip-active");
    junkBtn.classList.remove("popup-chip-active");
    return;
  }

  const score = typeof data.trust_score === "number" ? Math.round(data.trust_score) : null;
  if (score === null) {
    scoreValEl.textContent = "-";
    scoreFillEl.style.width = "0%";
    scoreFillEl.style.backgroundColor = "#9e9e9e";
  } else {
    scoreValEl.textContent = score.toString();
    const width = Math.max(0, Math.min(100, score));
    scoreFillEl.style.width = `${width}%`;
    scoreFillEl.style.backgroundColor = getScoreColor(score);
  }

  gemCountEl.textContent = `💎 ${data.gem_count ?? 0}`;
  junkCountEl.textContent = `🗑️ ${data.junk_count ?? 0}`;

  gemBtn.classList.remove("popup-chip-active");
  junkBtn.classList.remove("popup-chip-active");
  if (data.user_rating === "gem") {
    gemBtn.classList.add("popup-chip-active");
  } else if (data.user_rating === "junk") {
    junkBtn.classList.add("popup-chip-active");
  }
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response);
    });
  });
}

async function loadAuthState() {
  const state = await sendMessage({ type: "GET_AUTH_STATE" });
  POPUP_STATE.auth = state || { isLoggedIn: false, user: null, coins: 0 };
  updateAuthUI();
}

async function loadCurrentTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      POPUP_STATE.tab = tabs && tabs[0] ? tabs[0] : null;
      resolve(POPUP_STATE.tab);
    });
  });
}

async function loadPageTrust() {
  if (!POPUP_STATE.tab) return;

  const url = POPUP_STATE.tab.url;
  const domain = getDomainFromUrl(url);

  const data = await sendMessage({
    type: "GET_PAGE_TRUST",
    payload: { url, domain }
  });

  POPUP_STATE.trust = data || null;
  updateTrustUI();
}

async function handleConnectAccountClick() {
  chrome.tabs.create({
    url: "https://trust-layer-flow.base44.app",
    active: true
  });
}

async function handleLoginFlowClick() {
  try {
    chrome.windows.create({
      url: "https://trust-layer-flow.base44.app",
      type: "popup",
      width: 480,
      height: 640
    });
  } catch (e) {
    chrome.tabs.create({
      url: "https://trust-layer-flow.base44.app",
      active: true
    });
  }
}

async function handleLogoutClick() {
  await sendMessage({ type: "LOGOUT" });
  POPUP_STATE.auth = { isLoggedIn: false, user: null, coins: 0 };
  POPUP_STATE.trust = null;
  updateAuthUI();
  updateTrustUI();
}

async function handleSignalClick(type) {
  if (!POPUP_STATE.auth || !POPUP_STATE.auth.isLoggedIn || !POPUP_STATE.tab) {
    return;
  }

  const url = POPUP_STATE.tab.url;
  const domain = getDomainFromUrl(url);
  const page_title = POPUP_STATE.tab.title || domain;

  const payload = {
    url,
    page_title,
    domain,
    categories: [],
    signal_type: type,
    rating: type
  };

  const result = await sendMessage({
    type: "SUBMIT_SIGNAL",
    payload
  });

  if (result && typeof result.new_trust_score === "number") {
    POPUP_STATE.trust = {
      ...(POPUP_STATE.trust || {}),
      trust_score: result.new_trust_score,
      user_rating: type
    };
    updateTrustUI();
  }

  if (result && typeof result.total_coins === "number") {
    POPUP_STATE.auth.coins = result.total_coins;
    updateAuthUI();
  }
}

async function init() {
  const connectBtn = selectEl("connect-account-btn");
  const loginFlowBtn = selectEl("login-flow-btn");
  const logoutBtn = selectEl("logout-btn");
  const gemBtn = selectEl("popup-gem-btn");
  const junkBtn = selectEl("popup-junk-btn");
  const openAppLink = selectEl("open-app-link");

  connectBtn.addEventListener("click", handleConnectAccountClick);
  if (loginFlowBtn) {
    loginFlowBtn.addEventListener("click", handleLoginFlowClick);
  }
  logoutBtn.addEventListener("click", handleLogoutClick);

  const showWidgetBtn = selectEl("show-widget-btn");
  if (showWidgetBtn) {
    showWidgetBtn.addEventListener("click", async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            try { localStorage.removeItem("trusteam_widget_hidden"); } catch(e) {}
            location.reload();
          }
        });
      }
      window.close();
    });
  }

  gemBtn.addEventListener("click", () => handleSignalClick("gem"));
  junkBtn.addEventListener("click", () => handleSignalClick("junk"));

  openAppLink.addEventListener("click", () => {
    chrome.tabs.create({
      url: "https://trust-layer-flow.base44.app"
    });
  });

  await loadCurrentTab();
  await loadAuthState();
  await loadPageTrust();
}

document.addEventListener("DOMContentLoaded", init);

