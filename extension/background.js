/**
 * Concord Lens — Background Service Worker
 *
 * API bridge between content scripts and the Concord backend.
 * Handles ANALYZE messages by calling lens macros via the macro gateway.
 */

const CONCORD_API = "http://localhost:5050";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "ANALYZE") {
    fetch(`${CONCORD_API}/api/macros/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: "lens",
        name: `${msg.lens}.analyze`,
        input: { content: msg.content, url: msg.url },
      }),
    })
      .then(r => r.json())
      .then(data => sendResponse(data))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // Async response
  }

  if (msg.type === "GET_SETTINGS") {
    chrome.storage.local.get(["enabled", "apiUrl"], (data) => {
      sendResponse({
        enabled: data.enabled !== false,
        apiUrl: data.apiUrl || CONCORD_API,
      });
    });
    return true;
  }

  if (msg.type === "SET_SETTINGS") {
    chrome.storage.local.set(msg.settings, () => {
      sendResponse({ ok: true });
    });
    return true;
  }
});
