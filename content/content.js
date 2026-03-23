(function () {
  if (window.__trusteam_widget_initialized__) {
    return;
  }
  window.__trusteam_widget_initialized__ = true;

  if (location.protocol === "chrome:" || location.protocol === "chrome-extension:") {
    return;
  }

  const PRIMARY_COLOR = "#1a7a4a";

  let widgetRoot = null;
  let gemButton = null;
  let junkButton = null;
  let statusText = null;
  let toastEl = null;
  let currentState = {
    isLoggedIn: false,
    user: null,
    token: null,
    trust: null,
    collapsed: false
  };

  function getDomain() {
    return window.location.hostname || "";
  }

  function getUrl() {
    return window.location.href || "";
  }

  function getScoreColor(score) {
    if (typeof score !== "number") return "#9e9e9e";
    if (score >= 70) return "#1a7a4a";
    if (score >= 40) return "#f0a500";
    if (score >= 0) return "#e53935";
    return "#9e9e9e";
  }

  function getGaugeSVG(score, small) {
    const hasScore = typeof score === "number" && !isNaN(score);
    const s = hasScore ? score : 50;
    const angle = -180 + (s / 100) * 180;
    const rad = (angle * Math.PI) / 180;
    const cx = 60;
    const cy = 60;
    const r = 52;
    const tipX = cx + r * Math.cos(rad);
    const tipY = cy + r * Math.sin(rad);
    const tailX = cx - 10 * Math.cos(rad);
    const tailY = cy - 10 * Math.sin(rad);
    const w = small ? 52 : 110;
    const h = small ? 32 : 65;
    return `<svg width="${w}" height="${h}" viewBox="0 0 120 68">
    <defs>
      <linearGradient id="tGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#e53935"/>
        <stop offset="50%" style="stop-color:#f0a500"/>
        <stop offset="100%" style="stop-color:#1a7a4a"/>
      </linearGradient>
    </defs>
    <path d="M 8 60 A 52 52 0 0 1 112 60" fill="none" stroke="#ddd" stroke-width="12" stroke-linecap="round"/>
    <path d="M 8 60 A 52 52 0 0 1 112 60" fill="none" stroke="url(#tGrad)" stroke-width="12" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy}" x2="${tipX}" y2="${tipY}" stroke="${hasScore ? "#222" : "#aaa"}" stroke-width="${small ? 5 : 3.5}" stroke-linecap="round"/>
    ${!small ? `<line x1="${cx}" y1="${cy}" x2="${tailX}" y2="${tailY}" stroke="#222" stroke-width="3.5" stroke-linecap="round"/>` : ""}
    <circle cx="${cx}" cy="${cy}" r="${small ? 7 : 6}" fill="#333"/>
    <circle cx="${cx}" cy="${cy}" r="${small ? 3.5 : 3}" fill="#f0f0f0"/>
  </svg>`;
  }

  function updateBadge(score) {
    if (!widgetRoot || !widgetRoot._gaugeEl) return;
    const isCollapsed = widgetRoot.classList.contains("trusteam-collapsed");
    widgetRoot._gaugeEl.innerHTML = getGaugeSVG(score, isCollapsed);
  }

  function updateGaugeTooltip(data) {
    if (!widgetRoot || !widgetRoot._gaugeTooltip) return;
    if (!data || typeof data.trust_score !== "number") {
      widgetRoot._gaugeTooltip.textContent = "No ratings yet";
      if (widgetRoot._gaugeEl) widgetRoot._gaugeEl.title = "No ratings yet";
      return;
    }
    const trustScore = data.trust_score;
    const score = Math.round(trustScore);
    const gems = data.gem_count || 0;
    const junks = data.junk_count || 0;
    const total = data.total_ratings || gems + junks || 0;
    const details = `Score: ${trustScore}/100 · 💎 ${gems} · 🗑️ ${junks} · ${total} ratings`;
    widgetRoot._gaugeTooltip.textContent = `Score: ${score}/100 · 💎 ${gems} · 🗑️ ${junks} · ${total} ratings`;
    if (widgetRoot._gaugeEl) widgetRoot._gaugeEl.title = details;
  }

  function updateSocialSignals(data) {
    if (!widgetRoot) return;
    // Friends Gem banner
    if (widgetRoot._friendsBanner) {
      const friends = data && data.friends_gems;
      if (friends && friends.length > 0) {
        widgetRoot._friendsBanner.textContent = "💎 Your friends rated this a Gem!";
        widgetRoot._friendsBanner.style.display = "block";
      } else {
        widgetRoot._friendsBanner.style.display = "none";
      }
    }
    // Junk warning
    if (widgetRoot._junkWarning) {
      const junkCount = data && data.junk_count || 0;
      const totalRatings = data && data.total_ratings || 0;
      const trustScore = data && data.trust_score;
      if (typeof trustScore === "number" && trustScore < 35 && totalRatings >= 3) {
        widgetRoot._junkWarning.textContent = `⚠️ Warning — ${junkCount} people marked this as Junk`;
        widgetRoot._junkWarning.style.display = "block";
        widgetRoot._junkWarning.style.animation = "trusteam-pulse-red 1.5s ease-in-out 3";
      } else {
        widgetRoot._junkWarning.style.display = "none";
        widgetRoot._junkWarning.style.animation = "none";
      }
    }
  }

  function updateButtons(userRating) {
    if (!gemButton || !junkButton) return;
    gemButton.classList.remove("trusteam-btn-active");
    junkButton.classList.remove("trusteam-btn-active");
    if (userRating === "gem") {
      gemButton.classList.add("trusteam-btn-active");
    } else if (userRating === "junk") {
      junkButton.classList.add("trusteam-btn-active");
    }
  }

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("trusteam-toast-visible");
    setTimeout(() => {
      toastEl && toastEl.classList.remove("trusteam-toast-visible");
    }, 2000);
  }

  function setLoggedOutView() {
    if (!statusText || !gemButton || !junkButton) return;
    gemButton.style.display = "none";
    junkButton.style.display = "none";
    statusText.style.display = "block";
    if (widgetRoot && widgetRoot._userInfoEl) {
      widgetRoot._userInfoEl.style.display = "none";
    }
    if (widgetRoot && widgetRoot._inviteSection) {
      widgetRoot._inviteSection.style.display = "none";
    }
  }

  function setLoggedInView() {
    if (!statusText || !gemButton || !junkButton) return;
    gemButton.style.display = "inline-flex";
    junkButton.style.display = "inline-flex";
    statusText.style.display = "none";
    if (widgetRoot && widgetRoot._userInfoEl && currentState.user) {
      const user = currentState.user;
      const displayName =
        user.full_name ||
        user.name ||
        user.username ||
        (user.email ? user.email.split("@")[0] : null) ||
        (user.sub ? user.sub.split("@")[0] : null) ||
        "Connected";
      widgetRoot._userInfoEl.textContent = "👤 " + displayName;
      widgetRoot._userInfoEl.style.display = "block";
    }
    if (widgetRoot && widgetRoot._inviteSection) {
      widgetRoot._inviteSection.style.display = "";
    }
  }

  function createWidget() {
    widgetRoot = document.createElement("div");
    widgetRoot.className = "trusteam-widget";

    // --- TOP ROW ---
    const topRow = document.createElement("div");
    topRow.className = "trusteam-top-row";

    // Gauge
    const gaugeEl = document.createElement("div");
    gaugeEl.className = "trusteam-gauge";
    gaugeEl.innerHTML = getGaugeSVG(null, false);

    const gaugeTooltip = document.createElement("div");
    gaugeTooltip.className = "trusteam-gauge-tooltip";
    gaugeTooltip.style.cssText = `
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #222;
  color: white;
  font-size: 11px;
  padding: 6px 10px;
  border-radius: 8px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 9999999;
`;
    gaugeTooltip.textContent = "No ratings yet";
    widgetRoot.style.position = "fixed";
    widgetRoot.style.overflow = "visible";
    gaugeEl.style.position = "relative";
    gaugeEl.appendChild(gaugeTooltip);
    widgetRoot._gaugeTooltip = gaugeTooltip;

    gaugeEl.addEventListener("mouseenter", () => {
      if (widgetRoot._gaugeTooltip) {
        widgetRoot._gaugeTooltip.style.opacity = "1";
      }
    });
    gaugeEl.addEventListener("mouseleave", () => {
      if (widgetRoot._gaugeTooltip) {
        widgetRoot._gaugeTooltip.style.opacity = "0";
      }
    });

    // Junk button
    junkButton = document.createElement("button");
    junkButton.className = "trusteam-btn trusteam-btn-junk";
    junkButton.innerHTML = '<div class="trusteam-btn-icon">🗑️</div>Junk';

    // Gem button
    gemButton = document.createElement("button");
    gemButton.className = "trusteam-btn trusteam-btn-gem";
    gemButton.innerHTML = '<div class="trusteam-btn-icon">💎</div>Gem';

    // Status text (logged out)
    statusText = document.createElement("div");
    statusText.className = "trusteam-status-text";
    statusText.textContent = "Connect Trusteam →";

    // Toggle button
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "trusteam-toggle-btn";
    toggleBtn.textContent = "−";
    toggleBtn.title = "Minimize";

    const closeBtn = document.createElement("button");
    closeBtn.className = "trusteam-close-btn";
    closeBtn.textContent = "×";
    closeBtn.title = "Close Trusteam";

    topRow.appendChild(gaugeEl);
    topRow.appendChild(junkButton);
    topRow.appendChild(gemButton);
    topRow.appendChild(statusText);
    topRow.appendChild(toggleBtn);
    topRow.appendChild(closeBtn);

    // --- BOTTOM ROW ---
    const bottomRow = document.createElement("div");
    bottomRow.className = "trusteam-bottom-row";

    const feedBtn = document.createElement("button");
    feedBtn.className = "trusteam-nav-btn trusteam-nav-btn-feed";
    feedBtn.innerHTML = "📰 Feed";

    const profileBtn = document.createElement("button");
    profileBtn.className = "trusteam-nav-btn trusteam-nav-btn-profile";
    profileBtn.innerHTML = "👤 Profile";

    bottomRow.appendChild(feedBtn);
    bottomRow.appendChild(profileBtn);

    const teamBtn = document.createElement("button");
    teamBtn.className = "trusteam-nav-btn trusteam-nav-btn-team";
    teamBtn.innerHTML = "👥 Team";
    bottomRow.appendChild(teamBtn);

    // Toast
    toastEl = document.createElement("div");
    toastEl.className = "trusteam-toast";

    widgetRoot.appendChild(topRow);
    widgetRoot.appendChild(bottomRow);

    const friendsBanner = document.createElement("div");
    friendsBanner.className = "trusteam-friends-banner";
    friendsBanner.style.cssText = `
  display: none;
  width: 100%;
  background: #e8f5e9;
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 12px;
  color: #1a7a4a;
  font-weight: 600;
`;
    widgetRoot.insertBefore(friendsBanner, bottomRow);
    widgetRoot._friendsBanner = friendsBanner;

    const junkWarning = document.createElement("div");
    junkWarning.className = "trusteam-junk-warning";
    junkWarning.style.cssText = `
  display: none;
  width: 100%;
  background: #ffebee;
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 12px;
  color: #e53935;
  font-weight: 600;
  animation: trusteam-pulse-red 1.5s ease-in-out 3;
`;
    widgetRoot.insertBefore(junkWarning, bottomRow);
    widgetRoot._junkWarning = junkWarning;

    const inviteSection = document.createElement("div");
    inviteSection.className = "trusteam-invite-section";

    const inviteBtn = document.createElement("button");
    inviteBtn.className = "trusteam-invite-btn";
    inviteBtn.type = "button";

    const inviteBtnText = document.createElement("span");
    inviteBtnText.textContent = "🔗 Extend your Trust Team";

    const inviteTooltipIcon = document.createElement("span");
    inviteTooltipIcon.className = "trusteam-invite-tooltip-icon";
    inviteTooltipIcon.textContent = " ⓘ";

    const inviteTooltipBox = document.createElement("div");
    inviteTooltipBox.className = "trusteam-tooltip-box";
    inviteTooltipBox.textContent =
      "The bigger your network, the smarter your trust scores. Your friends get better recommendations, and so do you — everyone wins when your Trust Team grows.";

    inviteTooltipIcon.appendChild(inviteTooltipBox);
    inviteBtn.appendChild(inviteBtnText);
    inviteBtn.appendChild(inviteTooltipIcon);

    inviteSection.appendChild(inviteBtn);
    widgetRoot.insertBefore(inviteSection, bottomRow);
    widgetRoot._inviteSection = inviteSection;

    inviteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (inviteTooltipIcon.contains(e.target)) {
        return;
      }
      try {
        chrome.runtime.sendMessage({ type: "GET_AUTH_STATE" }, (state) => {
          if (chrome.runtime.lastError) {
            showToast("Could not load account. Try again.");
            return;
          }
          const user = state && state.user;
          const userId = user && (user.id != null ? user.id : user.sub);
          if (userId === null || userId === undefined || userId === "") {
            showToast("Connect your account to invite friends.");
            return;
          }
          const inviteUrl = `https://app.trusteam.me/JoinPage?ref=${encodeURIComponent(String(userId))}`;
          const done = () => showToast("🔗 Invite link copied!");
          if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            navigator.clipboard.writeText(inviteUrl).then(done).catch(() => {
              try {
                const ta = document.createElement("textarea");
                ta.value = inviteUrl;
                ta.setAttribute("readonly", "");
                ta.style.position = "fixed";
                ta.style.left = "-9999px";
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
                done();
              } catch {
                showToast("Could not copy link.");
              }
            });
          } else {
            try {
              const ta = document.createElement("textarea");
              ta.value = inviteUrl;
              ta.setAttribute("readonly", "");
              ta.style.position = "fixed";
              ta.style.left = "-9999px";
              document.body.appendChild(ta);
              ta.select();
              document.execCommand("copy");
              document.body.removeChild(ta);
              done();
            } catch {
              showToast("Could not copy link.");
            }
          }
        });
      } catch (err) {
        showToast("Could not copy link.");
      }
    });

    const userInfoEl = document.createElement("div");
    userInfoEl.className = "trusteam-user-info";
    userInfoEl.style.cssText = `
  font-size: 11px;
  color: #888;
  text-align: center;
  width: 100%;
  padding-top: 4px;
  border-top: 1px solid #e0e0e0;
`;
    userInfoEl.style.display = "none";
    widgetRoot.appendChild(userInfoEl);
    widgetRoot._userInfoEl = userInfoEl;

    widgetRoot.appendChild(toastEl);

    document.documentElement.appendChild(widgetRoot);

    // Store gauge element for updates
    widgetRoot._gaugeEl = gaugeEl;

    setLoggedOutView();

    // Toggle collapse
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!widgetRoot) return;
      currentState.collapsed = !currentState.collapsed;
      widgetRoot.classList.toggle("trusteam-collapsed", currentState.collapsed);
      toggleBtn.textContent = currentState.collapsed ? "+" : "−";
      toggleBtn.title = currentState.collapsed ? "Expand" : "Minimize";
      updateBadge(currentState.trust ? currentState.trust.trust_score : null);
    });

    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      try { localStorage.setItem("trusteam_widget_hidden", "true"); } catch(err) {}
      if (widgetRoot) widgetRoot.style.display = "none";
    });

    // Nav buttons
    feedBtn.addEventListener("click", () => {
      console.log("[Trusteam] Feed button clicked, sending OPEN_APP_PAGE");
      try {
        chrome.runtime.sendMessage(
          {
            type: "OPEN_APP_PAGE",
            page: "GemFeed"
          },
          (response) => {
            console.log("[Trusteam] OPEN_APP_PAGE response:", response);
            if (chrome.runtime.lastError) {
              console.log("[Trusteam] lastError:", chrome.runtime.lastError.message);
            }
          }
        );
      } catch (e) {
        console.log("[Trusteam] feedBtn error:", e.message);
      }
    });

    profileBtn.addEventListener("click", () => {
      try {
        chrome.runtime.sendMessage(
          {
            type: "OPEN_APP_PAGE",
            page: "Profile"
          },
          () => {}
        );
      } catch (e) {}
    });

    teamBtn.addEventListener("click", () => {
      try {
        chrome.runtime.sendMessage(
          {
            type: "OPEN_APP_PAGE",
            url: "https://app.trusteam.me/team"
          },
          () => {}
        );
      } catch (e) {}
    });

    // Status text click
    statusText.addEventListener("click", () => {
      try {
        chrome.runtime.sendMessage({ type: "CHECK_TOKEN_AND_OPEN_APP" }, () => {});
      } catch (e) {
        // Extension context may be invalidated; ignore
      }
    });

    // Gem / Junk clicks
    gemButton.addEventListener("click", () => {
      try {
        chrome.runtime.sendMessage({ type: "SUBMIT_SIGNAL", rating: "gem" }, (response) => {
          if (response && response.trust) {
            currentState.trust = response.trust;
            updateBadge(response.trust.trust_score);
            updateSocialSignals(response.trust);
            updateGaugeTooltip(response.trust);
            updateButtons(response.trust.user_rating);
          } else {
            refreshTrust();
          }
        });
      } catch (e) {}
    });

    junkButton.addEventListener("click", () => {
      try {
        chrome.runtime.sendMessage({ type: "SUBMIT_SIGNAL", rating: "junk" }, (response) => {
          if (response && response.trust) {
            currentState.trust = response.trust;
            updateBadge(response.trust.trust_score);
            updateSocialSignals(response.trust);
            updateGaugeTooltip(response.trust);
            updateButtons(response.trust.user_rating);
          } else {
            refreshTrust();
          }
        });
      } catch (e) {}
    });
  }

  function getPageMeta() {
    return {
      url: getUrl(),
      domain: getDomain(),
      page_title: document.title || getDomain()
    };
  }

  function detectCategories() {
    const categories = [];
    const url = window.location.hostname.toLowerCase();
    const title = (document.title || "").toLowerCase();
    const metaKeywords = (document.querySelector('meta[name="keywords"]')?.content || "").toLowerCase();
    const metaDesc = (document.querySelector('meta[name="description"]')?.content || "").toLowerCase();
    const text = (title + " " + metaKeywords + " " + metaDesc).toLowerCase();
    // Domain-based detection
    const domainMap = {
      "techcrunch.com": "Tech",
      "wired.com": "Tech",
      "theverge.com": "Tech",
      "venturebeat.com": "Tech",
      "arstechnica.com": "Tech",
      "zdnet.com": "Tech",
      "wsj.com": "Finance",
      "bloomberg.com": "Finance",
      "forbes.com": "Finance",
      "reuters.com": "Finance",
      "ft.com": "Finance",
      "calcalist.co.il": "Finance",
      "bbc.com": "News",
      "cnn.com": "News",
      "nytimes.com": "News",
      "theguardian.com": "News",
      "ynet.co.il": "News",
      "haaretz.co.il": "News",
      "walla.co.il": "News",
      "mako.co.il": "News",
      "healthline.com": "Health",
      "webmd.com": "Health",
      "mayoclinic.org": "Health",
      "nationalgeographic.com": "Science",
      "nature.com": "Science",
      "scientificamerican.com": "Science",
      "bonappetit.com": "Food",
      "allrecipes.com": "Food",
      "foodnetwork.com": "Food",
      "tripadvisor.com": "Travel",
      "airbnb.com": "Travel",
      "booking.com": "Travel",
      "espn.com": "Sports",
      "sport5.co.il": "Sports",
      "one.co.il": "Sports",
      "ign.com": "Gaming",
      "kotaku.com": "Gaming",
      "gamespot.com": "Gaming",
      "openai.com": "AI",
      "anthropic.com": "AI",
      "huggingface.co": "AI"
    };
    for (const [domain, category] of Object.entries(domainMap)) {
      if (url.includes(domain)) {
        categories.push(category);
        break;
      }
    }
    // Keyword-based detection (if no domain match)
    if (categories.length === 0) {
      const keywordMap = {
        Tech: [
          "technology",
          "software",
          "hardware",
          "startup",
          "app",
          "coding",
          "programming",
          "developer"
        ],
        AI: ["artificial intelligence", "machine learning", "chatgpt", "openai", "llm", "neural"],
        Finance: ["stock", "market", "invest", "finance", "economy", "crypto", "bitcoin", "trading"],
        Health: ["health", "medical", "doctor", "disease", "fitness", "diet", "wellness"],
        Science: ["science", "research", "study", "discovery", "space", "climate", "biology"],
        News: ["breaking news", "politics", "government", "election", "president", "war", "conflict"],
        Food: ["recipe", "cooking", "food", "restaurant", "eat", "cuisine", "chef"],
        Travel: ["travel", "hotel", "flight", "vacation", "destination", "tourism"],
        Sports: ["sport", "football", "basketball", "soccer", "athlete", "game", "match", "league"],
        Gaming: ["game", "gaming", "console", "playstation", "xbox", "nintendo", "esport"],
        Entertainment: ["movie", "film", "music", "celebrity", "entertainment", "tv show", "netflix"]
      };
      for (const [category, keywords] of Object.entries(keywordMap)) {
        if (keywords.some((kw) => text.includes(kw))) {
          categories.push(category);
          if (categories.length >= 2) break;
        }
      }
    }
    return categories.length > 0 ? categories : ["General"];
  }

  function handleSignalClick(type) {
    if (!currentState.isLoggedIn) {
      return;
    }
    const meta = getPageMeta();
    const payload = {
      url: meta.url,
      page_title: meta.page_title,
      domain: meta.domain,
      categories: detectCategories(),
      signal_type: type,
      rating: type
    };

    try {
      chrome.runtime.sendMessage(
        {
          type: "SUBMIT_SIGNAL",
          payload
        },
        (response) => {
          if (!response || response.success === false) {
            return;
          }
          if (typeof response.new_trust_score === "number") {
            currentState.trust = {
              ...(currentState.trust || {}),
              trust_score: response.new_trust_score,
              user_rating: type
            };
            updateBadge(response.new_trust_score);
            updateButtons(type);
          }
          if (typeof response.coins_earned === "number" && response.coins_earned > 0) {
            showToast(`+${response.coins_earned} coins 🪙`);
          }
        }
      );
    } catch (e) {
      // Extension context may be invalidated; ignore
    }
  }

  function refreshTrust() {
    const meta = getPageMeta();
    try {
      chrome.runtime.sendMessage(
        {
          type: "GET_PAGE_TRUST",
          payload: {
            url: meta.url,
            domain: meta.domain
          }
        },
        (data) => {
          if (!data) {
            updateBadge(null);
            updateGaugeTooltip(null);
            updateButtons(null);
            return;
          }
          currentState.trust = data;
          updateBadge(data.trust_score);
          updateSocialSignals(data);
          updateGaugeTooltip(data);
          updateButtons(data.user_rating);
        }
      );
    } catch (e) {
      // Extension context may be invalidated; ignore
    }
  }

  function checkAuthWithRetry(retries = 3) {
    try {
      chrome.runtime.sendMessage({ type: "GET_AUTH_STATE" }, (state) => {
        if (chrome.runtime.lastError) return;
        if (state && state.isLoggedIn) {
          currentState.isLoggedIn = true;
          currentState.user = state.user;
          currentState.token = state.token;
          setLoggedInView();
          refreshTrust();
        } else if (retries > 0) {
          setTimeout(() => checkAuthWithRetry(retries - 1), 1500);
        } else {
          setLoggedOutView();
          updateBadge(null);
        }
      });
    } catch (e) {
      // Ignore errors during auth retry
    }
  }

  function init() {
    try {
      if (localStorage.getItem("trusteam_widget_hidden") === "true") return;
    } catch(err) {}

    // Verify extension context is valid
    if (typeof chrome === "undefined" || !chrome.runtime) {
      console.warn("[Trusteam] chrome.runtime not available - extension context invalid");
      setLoggedOutView();

      // Retry when chrome.runtime becomes available again
      if (!window.__trusteam_runtime_retry_started__) {
        window.__trusteam_runtime_retry_started__ = true;
        let attempts = 0;
        const maxAttempts = 30;
        const intervalId = window.setInterval(() => {
          attempts += 1;
          if (typeof chrome !== "undefined" && chrome.runtime) {
            window.clearInterval(intervalId);
            window.__trusteam_runtime_retry_started__ = false;
            init();
          } else if (attempts >= maxAttempts) {
            window.clearInterval(intervalId);
            window.__trusteam_runtime_retry_started__ = false;
          }
        }, 1000);
      }

      return;
    }

    createWidget();
    initDrag();

    const isAppPage = window.location.hostname === "trust-layer-flow.base44.app";
    if (isAppPage) {
      setTimeout(() => checkAuthWithRetry(), 2000);
    } else {
      checkAuthWithRetry();
    }

    // If we're on the Trust Layer Flow app, push the token directly to the background
    try {
      if (window.location.hostname === "trust-layer-flow.base44.app" && window.localStorage) {
        const token = window.localStorage.getItem("base44_access_token");
        if (token) {
          chrome.runtime.sendMessage({ type: "SAVE_TOKEN", token });
        }
      }
    } catch (e) {
      // Ignore if localStorage or runtime is not accessible
    }
  }

  chrome.runtime.onMessage.addListener(function (message) {
    try {
      if (message && message.type === "EXTENSION_READY") {
        init();
      }
    } catch (e) {
      // Ignore if extension context is invalid
    }
  });

  window.addEventListener("trusteam_token_saved", () => {
    checkAuthWithRetry();
  });

  function initDrag() {
    if (!widgetRoot) return;
    // Restore saved position
    try {
      const saved = localStorage.getItem("trusteam_widget_pos");
      if (saved) {
        const parsed = JSON.parse(saved);
        const left = parsed && parsed.left;
        const top = parsed && parsed.top;
        if (left && top) {
          widgetRoot.style.left = left;
          widgetRoot.style.top = top;
          widgetRoot.style.bottom = "auto";
          widgetRoot.style.transform = "none";
        }
      }
    } catch (e) {}

    let isDragging = false;
    let startX, startY;

    widgetRoot.addEventListener("mousedown", (e) => {
      // Only drag from the widget background, not buttons or gauge SVG
      if (
        e.target.tagName === "BUTTON" ||
        e.target.tagName === "svg" ||
        e.target.tagName === "line" ||
        e.target.tagName === "circle" ||
        e.target.tagName === "path" ||
        (e.target.closest && e.target.closest("button"))
      ) {
        return;
      }
      isDragging = true;
      const rect = widgetRoot.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
      widgetRoot.style.cursor = "grabbing";
      widgetRoot.style.transition = "none";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const newLeft = e.clientX - startX;
      const newTop = e.clientY - startY;
      // Keep within viewport bounds
      const maxLeft = window.innerWidth - widgetRoot.offsetWidth - 8;
      const maxTop = window.innerHeight - widgetRoot.offsetHeight - 8;
      const clampedLeft = Math.max(8, Math.min(newLeft, maxLeft));
      const clampedTop = Math.max(8, Math.min(newTop, maxTop));
      widgetRoot.style.left = clampedLeft + "px";
      widgetRoot.style.top = clampedTop + "px";
      widgetRoot.style.bottom = "auto";
      widgetRoot.style.transform = "none";
    });

    document.addEventListener("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;
      widgetRoot.style.cursor = "";
      widgetRoot.style.transition = "";
      // Save position
      try {
        localStorage.setItem(
          "trusteam_widget_pos",
          JSON.stringify({
            left: widgetRoot.style.left,
            top: widgetRoot.style.top
          })
        );
      } catch (e) {}
    });
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    init();
  } else {
    window.addEventListener("DOMContentLoaded", init);
  }
})();

