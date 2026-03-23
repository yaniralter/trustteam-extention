(() => {
  try {
    if (window.location.hostname !== "trust-layer-flow.base44.app") {
      return;
    }
    if (!window.localStorage) {
      return;
    }
    const token = window.localStorage.getItem("base44_access_token");
    if (!token) {
      return;
    }
    try {
      chrome.runtime.sendMessage({ type: "SAVE_TOKEN", token }, (response) => {
        try {
          if (response && response.success) {
            window.dispatchEvent(new CustomEvent("trusteam_token_saved"));
          }
        } catch (e) {
          // Ignore
        }
      });
    } catch (e) {
      // Ignore if runtime is not available
    }
  } catch (e) {
    // Ignore any unexpected errors
  }
})();

