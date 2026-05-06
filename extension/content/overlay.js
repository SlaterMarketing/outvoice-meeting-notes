const CONSENT_KEY = "consentVersion";
const CONSENT_VALUE = "1";

const READY_STATUS = "Ready to record this tab. Tap Start when you’re ready.";

/**
 * @param {string} href
 * @returns {"meet" | "zoom" | "teams" | null}
 */
function detectMeetingPlatform(href) {
  try {
    const u = new URL(href);
    const h = u.hostname;
    const p = u.pathname;
    if (h === "meet.google.com") {
      if (/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i.test(p)) return "meet";
      if (p !== "/" && !p.startsWith("/landing")) return "meet";
    }
    if (h === "zoom.us" || h.endsWith(".zoom.us")) {
      if (p.includes("/wc/") || p.includes("/j/") || p.includes("/meet")) return "zoom";
      if (h.startsWith("app.") && p.includes("/wc")) return "zoom";
    }
    if (
      h.includes("teams.microsoft.com") ||
      h === "teams.live.com" ||
      h.endsWith(".teams.live.com")
    ) {
      return "teams";
    }
    return null;
  } catch {
    return null;
  }
}

function iconUrl() {
  return chrome.runtime.getURL("outvoice.png");
}

/**
 * @param {Element} el
 * @returns {boolean}
 */
function isElementVisible(el) {
  if (!(el instanceof HTMLElement)) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const cs = getComputedStyle(el);
  if (cs.visibility === "hidden" || cs.display === "none") return false;
  return true;
}

/**
 * Meet's `#browser-extension-center-buttons` can layout to 0×0 until it has children — still the right slot.
 * @param {HTMLElement} el
 */
function isDisplayedForToolbarDock(el) {
  if (!el.isConnected) return false;
  const cs = getComputedStyle(el);
  return cs.display !== "none" && cs.visibility !== "hidden";
}

/**
 * @returns {HTMLElement | null}
 */
function findMeetInCallActionsRow() {
  const nodes = document.querySelectorAll('[role="button"][aria-label]');
  /** @type {HTMLElement | null} */
  let leave = null;
  for (const btn of nodes) {
    if (!(btn instanceof HTMLElement)) continue;
    const label = (btn.getAttribute("aria-label") || "").toLowerCase();
    const looksLeave =
      (label.includes("leave") && (label.includes("call") || label.includes("meeting"))) ||
      label.includes("hang up") ||
      label.includes("end the call");
    if (!looksLeave) continue;
    leave = btn;
    break;
  }
  if (!leave) return null;
  /** @type {HTMLElement | null} */
  let row = leave.parentElement;
  for (let d = 0; d < 10 && row; d++) {
    if (!(row instanceof HTMLElement)) break;
    const cs = getComputedStyle(row);
    const disp = cs.display;
    if (
      (disp === "flex" || disp === "inline-flex") &&
      row.childElementCount >= 2 &&
      row.contains(leave)
    ) {
      return row;
    }
    row = row.parentElement;
  }
  return null;
}

/**
 * @param {HTMLElement} hostEl
 * @returns {"toolbar" | "prejoin" | "undocked"}
 */
function dockMeetHost(hostEl) {
  const toolbar = document.getElementById("browser-extension-center-buttons");
  if (toolbar instanceof HTMLElement && isDisplayedForToolbarDock(toolbar)) {
    if (!toolbar.contains(hostEl)) {
      toolbar.appendChild(hostEl);
    }
    hostEl.classList.add("outvoice-meet-docked");
    hostEl.classList.remove("outvoice-meet-prejoin");
    hostEl.classList.remove("outvoice-meet-toolbar-fallback");
    return "toolbar";
  }

  /** Pre-join / green room: mic + camera row (class name shifts but often XhYcN). */
  const candidates = document.querySelectorAll("div.XhYcN");
  /** @type {HTMLElement | null} */
  let prejoin = null;
  for (const node of candidates) {
    if (!(node instanceof HTMLElement) || !isElementVisible(node)) continue;
    if (node.contains(hostEl)) {
      prejoin = node;
      break;
    }
    if (!prejoin || node.getBoundingClientRect().width > prejoin.getBoundingClientRect().width) {
      prejoin = node;
    }
  }

  if (prejoin) {
    if (!prejoin.contains(hostEl)) {
      prejoin.appendChild(hostEl);
    }
    hostEl.classList.add("outvoice-meet-docked");
    hostEl.classList.add("outvoice-meet-prejoin");
    hostEl.classList.remove("outvoice-meet-toolbar-fallback");
    return "prejoin";
  }

  const actionsRow = findMeetInCallActionsRow();
  if (actionsRow && isElementVisible(actionsRow)) {
    if (!actionsRow.contains(hostEl)) {
      actionsRow.appendChild(hostEl);
    }
    hostEl.classList.add("outvoice-meet-docked");
    hostEl.classList.remove("outvoice-meet-prejoin");
    hostEl.classList.add("outvoice-meet-toolbar-fallback");
    return "toolbar";
  }

  hostEl.classList.remove("outvoice-meet-docked");
  hostEl.classList.remove("outvoice-meet-prejoin");
  hostEl.classList.remove("outvoice-meet-toolbar-fallback");
  if (hostEl.parentElement && hostEl.parentElement !== document.documentElement) {
    document.documentElement.appendChild(hostEl);
  }
  return "undocked";
}

/**
 * @param {"meet" | "zoom" | "teams"} platform
 * @returns {{
 *   host: HTMLDivElement;
 *   panel: HTMLDivElement;
 *   mini: HTMLButtonElement;
 *   status: HTMLDivElement;
 *   startFrame: HTMLIFrameElement;
 *   btnStop: HTMLButtonElement | null;
 *   collapse: HTMLButtonElement | null;
 *   toggle: HTMLInputElement | null;
 * }}
 */
function buildOverlay(platform) {
  const existing = document.getElementById("outvoice-overlay-host");
  if (existing) {
    return /** @type {any} */ (existing._outvoiceRefs);
  }

  const isMeet = platform === "meet";
  const host = document.createElement("div");
  host.id = "outvoice-overlay-host";
  if (isMeet) host.classList.add("outvoice-meet-native");

  const panel = document.createElement("div");
  panel.id = "outvoice-overlay-panel";

  const status = document.createElement("div");
  status.id = "outvoice-overlay-status";
  status.textContent = isMeet ? "" : READY_STATUS;

  const actions = document.createElement("div");
  actions.id = "outvoice-overlay-actions";
  const startFrame = document.createElement("iframe");
  startFrame.id = "outvoice-start-bridge";
  startFrame.title = "Record with Outvoice";
  startFrame.src = chrome.runtime.getURL("record-bridge.html");
  if (isMeet) {
    startFrame.setAttribute("scrolling", "no");
    startFrame.style.overflow = "hidden";
    startFrame.style.border = "none";
    startFrame.style.display = "block";
  }

  /** @type {HTMLButtonElement | null} */
  let btnStop = null;
  if (!isMeet) {
    btnStop = document.createElement("button");
    btnStop.type = "button";
    btnStop.textContent = "Stop";
    btnStop.className = "secondary";
    btnStop.disabled = true;
    actions.append(startFrame, btnStop);
  } else {
    actions.append(startFrame);
  }

  /** @type {HTMLButtonElement | null} */
  let collapse = null;
  /** @type {HTMLInputElement | null} */
  let toggle = null;

  if (!isMeet) {
    const brand = document.createElement("div");
    brand.id = "outvoice-overlay-brand";
    const img = document.createElement("img");
    img.src = iconUrl();
    img.alt = "";
    const title = document.createElement("span");
    title.id = "outvoice-overlay-title";
    title.textContent = "Outvoice";
    brand.append(img, title);

    const toggleLabel = document.createElement("label");
    toggleLabel.id = "outvoice-overlay-toggle";
    toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.id = "outvoice-overlay-autostart";
    const toggleText = document.createElement("span");
    toggleText.textContent = "Start automatically when I join";
    toggleLabel.append(toggle, toggleText);

    collapse = document.createElement("button");
    collapse.type = "button";
    collapse.id = "outvoice-overlay-collapse";
    collapse.title = "Minimize";
    collapse.textContent = "−";

    panel.append(brand, status, actions, toggleLabel, collapse);
  } else {
    panel.append(status, actions);
  }

  host.appendChild(panel);

  const mini = document.createElement("button");
  mini.type = "button";
  mini.id = "outvoice-overlay-min";
  const miniImg = document.createElement("img");
  miniImg.src = iconUrl();
  miniImg.alt = "";
  mini.appendChild(miniImg);

  host.appendChild(mini);
  document.documentElement.appendChild(host);

  const refs = { host, panel, mini, status, startFrame, btnStop, collapse, toggle };
  /** @type {any} */ (refs)._recording = false;
  /** @type {any} */ (refs)._allowStart = true;
  /** @type {any} */ (refs)._meetStyle = isMeet;
  /** @type {any} */ (host)._outvoiceRefs = refs;
  return refs;
}

function main() {
  try {
    if (!chrome.runtime?.id) return;
  } catch {
    return;
  }

  const platform = detectMeetingPlatform(window.location.href);
  if (!platform) return;

  const EXT_ORIGIN = new URL(chrome.runtime.getURL("record-bridge.html")).origin;

  /**
   * Use '*' so interim iframe documents (inheriting meet.google.com) do not make
   * postMessage throw before record-bridge.html commits; the bridge validates ev.origin.
   * @param {ReturnType<typeof buildOverlay>} ui
   * @param {unknown} data
   * @returns {boolean}
   */
  function postToBridge(ui, data) {
    if (!ui.startFrame?.isConnected) return false;
    let w;
    try {
      w = ui.startFrame.contentWindow;
    } catch {
      return false;
    }
    if (!w || w === window) return false;
    try {
      w.postMessage(data, "*");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * @param {ReturnType<typeof buildOverlay>} ui
   */
  function postStartBridgeState(ui) {
    const rec = /** @type {any} */ (ui)._recording;
    const allow = /** @type {any} */ (ui)._allowStart;
    const meetStyle = !!/** @type {any} */ (ui)._meetStyle;
    const meetPrejoin = ui.host.classList.contains("outvoice-meet-prejoin");
    postToBridge(ui, {
      type: "outvoice-state",
      parentAllows: allow,
      recording: rec,
      meetStyle,
      meetPrejoin,
    });
  }

  /**
   * @param {ReturnType<typeof buildOverlay>} ui
   * @param {number} [attempt]
   */
  function syncStartBridgeInit(ui, attempt = 0) {
    chrome.runtime.sendMessage({ type: "OUTVOICE_WHOAMI" }, (r) => {
      if (chrome.runtime.lastError || r?.tabId == null) return;
      const meetStyle = !!/** @type {any} */ (ui)._meetStyle;
      const meetPrejoin = ui.host.classList.contains("outvoice-meet-prejoin");
      const ok = postToBridge(ui, {
        type: "outvoice-init",
        tabId: r.tabId,
        tabUrl: location.href,
        tabTitle: document.title,
        meetStyle,
        meetPrejoin,
      });
      postStartBridgeState(ui);
      if (!ok && attempt < 60) {
        window.setTimeout(() => syncStartBridgeInit(ui, attempt + 1), 50);
      }
    });
  }

  /**
   * @param {ReturnType<typeof buildOverlay>} ui
   * @param {boolean} recording
   * @param {boolean} [done]
   */
  function applyRecordingUi(ui, recording, done) {
    /** @type {any} */ (ui)._recording = recording;
    if (ui.btnStop) ui.btnStop.disabled = !recording;
    postStartBridgeState(ui);
    ui.status.classList.remove("recording");
    if (recording || done) {
      ui.status.classList.remove("error");
    }

    const meet = !!/** @type {any} */ (ui)._meetStyle;

    if (recording) {
      ui.status.classList.add("recording");
      if (!meet) {
        ui.status.textContent =
          "Recording this tab… keep it open. Tap Stop when the meeting ends.";
      } else if (!ui.status.classList.contains("error")) {
        ui.status.textContent = "";
      }
      ui.mini.classList.add("dot");
    } else {
      ui.mini.classList.remove("dot");
      if (meet) {
        if (!ui.status.classList.contains("error")) {
          ui.status.textContent = "";
        }
      } else if (done) {
        ui.status.textContent = "Sent. Open your library for notes.";
      } else {
        ui.status.textContent = READY_STATUS;
      }
    }
  }

  const ui = buildOverlay(platform);

  if (platform === "meet") {
    const hostEl = ui.host;
    let lastMeetDockMode = "";
    function tickDockMeet() {
      try {
        if (!chrome.runtime?.id) return;
      } catch {
        return;
      }
      const mode = dockMeetHost(hostEl);
      if (mode !== lastMeetDockMode) {
        lastMeetDockMode = mode;
        syncStartBridgeInit(ui, 0);
      }
    }
    tickDockMeet();
    const moMeet = new MutationObserver(() => tickDockMeet());
    moMeet.observe(document.documentElement, { childList: true, subtree: true });
  }

  ui.startFrame.addEventListener("load", () => {
    syncStartBridgeInit(ui);
  });

  chrome.storage.sync.get([CONSENT_KEY, "accessToken", "outvoiceAutostart"], (r) => {
    const consented = r[CONSENT_KEY] === CONSENT_VALUE;
    const signedIn = !!r.accessToken;
    /** @type {any} */ (ui)._allowStart = consented && signedIn;
    if (ui.toggle) ui.toggle.checked = !!r.outvoiceAutostart;

    if (!consented || !signedIn) {
      ui.status.textContent = consented
        ? "Sign in from the extension icon, then use Start."
        : "Open the extension and continue past the notice, then sign in.";
    }

    if (!consented || !signedIn) {
      if (ui.toggle) ui.toggle.disabled = true;
    }
    postStartBridgeState(ui);
  });

  ui.toggle?.addEventListener("change", () => {
    chrome.storage.sync.set({ outvoiceAutostart: /** @type {HTMLInputElement} */ (ui.toggle).checked });
  });

  ui.collapse?.addEventListener("click", () => {
    ui.panel.style.display = "none";
    ui.mini.classList.add("visible");
  });

  ui.mini.addEventListener("click", () => {
    ui.mini.classList.remove("visible");
    ui.panel.style.display = "flex";
  });

  window.addEventListener("message", (ev) => {
    if (ev.origin !== EXT_ORIGIN) return;
    if (ev.data?.type === "outvoice-stopped") {
      if (!ev.data.ok) {
        ui.status.classList.add("error");
        ui.status.textContent = globalThis.outvoiceFriendlyRuntimeError(
          ev.data.error || "Could not stop."
        );
        postStartBridgeState(ui);
      } else {
        applyRecordingUi(ui, false, true);
      }
      return;
    }
    if (ev.data?.type !== "outvoice-started") return;
    ui.status.classList.remove("error");
    if (!ev.data.ok) {
      ui.status.classList.add("error");
      ui.status.textContent = globalThis.outvoiceFriendlyRuntimeError(
        ev.data.error || "Could not start."
      );
      postStartBridgeState(ui);
      return;
    }
    void chrome.storage.sync.get([CONSENT_KEY, "accessToken"]).then((s) => {
      if (s[CONSENT_KEY] !== CONSENT_VALUE || !s.accessToken) {
        postStartBridgeState(ui);
        return;
      }
      applyRecordingUi(ui, true);
    }).catch(() => {
      /* Invalidated extension context, etc. */
    });
  });

  ui.btnStop?.addEventListener("click", async () => {
    if (ui.btnStop) ui.btnStop.disabled = true;
    try {
      await chrome.runtime.sendMessage({ type: "OUTVOICE_STOP_CAPTURE" });
      applyRecordingUi(ui, false, true);
    } catch (e) {
      ui.status.classList.add("error");
      ui.status.textContent = globalThis.outvoiceFriendlyRuntimeError(
        e instanceof Error ? e : "Could not stop."
      );
      applyRecordingUi(ui, false);
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== "OUTVOICE_UI") return;
    if (msg.error) {
      ui.status.classList.remove("recording");
      ui.status.classList.add("error");
      ui.status.textContent = globalThis.outvoiceFriendlyRuntimeError(msg.error);
      applyRecordingUi(ui, false);
      return;
    }
    if (msg.recording) {
      applyRecordingUi(ui, true);
    } else {
      applyRecordingUi(ui, false, !!msg.done);
    }
  });
}

main();
