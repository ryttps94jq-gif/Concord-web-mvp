/**
 * Concord Lens — Content Script
 *
 * Detects site context, extracts page content, sends to background for
 * analysis, and injects the floating overlay panel with results.
 */

const DETECTORS = {
  "reddit.com": "reddit",
  "github.com": "github",
  "twitter.com": "twitter",
  "x.com": "twitter",
  "amazon.com": "amazon",
  "news.ycombinator.com": "hn",
};

function detectContext() {
  const hostname = window.location.hostname.replace("www.", "");
  for (const [domain, lens] of Object.entries(DETECTORS)) {
    if (hostname.includes(domain)) return lens;
  }
  return "generic";
}

function extractRedditThread() {
  const title = document.querySelector("h1")?.textContent || document.title;
  const postBody = document.querySelector("[data-test-id='post-content']")?.textContent
    || document.querySelector(".expando")?.textContent || "";
  const comments = [];
  document.querySelectorAll("[data-testid='comment'],.comment .md").forEach((el, i) => {
    if (i < 20) comments.push(el.textContent.slice(0, 500));
  });
  return { title, text: postBody.slice(0, 3000), comments };
}

function extractGithubContent() {
  const title = document.querySelector(".js-issue-title, .gh-header-title")?.textContent || document.title;
  const body = document.querySelector(".comment-body, .markdown-body")?.textContent || "";
  const files = [];
  document.querySelectorAll(".file-header .file-info a").forEach((el, i) => {
    if (i < 10) files.push(el.textContent.trim());
  });
  return { title, text: body.slice(0, 5000), files };
}

function extractTweets() {
  const tweets = [];
  document.querySelectorAll("[data-testid='tweetText']").forEach((el, i) => {
    if (i < 10) tweets.push(el.textContent);
  });
  return { title: document.title, text: tweets.join("\n\n").slice(0, 5000), tweets };
}

function extractPageContent(lens) {
  switch (lens) {
    case "reddit": return extractRedditThread();
    case "github": return extractGithubContent();
    case "twitter": return extractTweets();
    case "generic":
    default:
      return { title: document.title, text: document.body.innerText.slice(0, 5000) };
  }
}

async function analyze(lens, content) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: "ANALYZE",
      lens,
      content,
      url: window.location.href,
    }, (resp) => {
      resolve(resp || { ok: false, error: "No response" });
    });
  });
}

function renderAnalysis(analysis) {
  const anchors = (analysis.anchors || []).slice(0, 5);
  const anchorHtml = anchors.length
    ? `<div class="concord-anchors">${anchors.map(a =>
        `<div class="concord-anchor"><span class="concord-anchor-title">${escapeHtml(a.title || a.id)}</span></div>`
      ).join("")}</div>`
    : "";

  const contradictions = analysis.contradictions?.length
    ? `<div class="concord-contradictions"><strong>${analysis.contradictions.length} contradictions detected</strong></div>`
    : "";

  return `
    <div class="concord-header">
      <span class="concord-logo">◆ Concord Lens</span>
      <span class="concord-lens-type">${escapeHtml(analysis.lens || "generic")}</span>
      <button class="concord-close" onclick="this.closest('#concord-overlay').remove()">×</button>
    </div>
    <div class="concord-body">
      ${analysis.summary ? `<p class="concord-summary">${escapeHtml(analysis.summary)}</p>` : ""}
      ${anchorHtml}
      ${contradictions}
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

function injectOverlay(analysis) {
  const existing = document.getElementById("concord-overlay");
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.id = "concord-overlay";
  panel.innerHTML = renderAnalysis(analysis);
  document.body.appendChild(panel);
}

// Main
(async () => {
  try {
    const settings = await new Promise(resolve => {
      chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, resolve);
    });
    if (settings && settings.enabled === false) return;

    const lens = detectContext();
    const content = extractPageContent(lens);
    const analysis = await analyze(lens, content);
    if (analysis && analysis.ok) {
      injectOverlay(analysis);
    }
  } catch {
    // Silent — extension should never interfere with page
  }
})();
