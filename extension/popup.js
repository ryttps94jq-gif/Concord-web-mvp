/**
 * Concord Lens — Popup Script
 */

const enabledEl = document.getElementById("enabled");
const apiUrlEl = document.getElementById("apiUrl");
const statusEl = document.getElementById("status");

// Load settings
chrome.storage.local.get(["enabled", "apiUrl"], (data) => {
  enabledEl.checked = data.enabled !== false;
  apiUrlEl.value = data.apiUrl || "http://localhost:5050";
  checkConnection(apiUrlEl.value);
});

// Save on change
enabledEl.addEventListener("change", () => {
  chrome.storage.local.set({ enabled: enabledEl.checked });
});

apiUrlEl.addEventListener("change", () => {
  chrome.storage.local.set({ apiUrl: apiUrlEl.value });
  checkConnection(apiUrlEl.value);
});

async function checkConnection(url) {
  try {
    const resp = await fetch(`${url}/api/health`, { method: "GET" });
    if (resp.ok) {
      statusEl.textContent = "Connected to Concord";
      statusEl.style.color = "#00d4ff";
    } else {
      statusEl.textContent = `HTTP ${resp.status}`;
      statusEl.style.color = "#ff4444";
    }
  } catch {
    statusEl.textContent = "Not connected";
    statusEl.style.color = "#ff4444";
  }
}
