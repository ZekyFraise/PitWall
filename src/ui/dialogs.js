let toastContainer = null;
let saveBannerContainer = null;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message, type = "error") {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

// Bigger, top-center, longer-lived than the corner toast — reserved for the explicit
// "Sauvegarder" button, not the silent auto-saves that happen after other actions.
function ensureSaveBannerContainer() {
  if (!saveBannerContainer) {
    saveBannerContainer = document.createElement("div");
    saveBannerContainer.className = "save-banner-container";
    document.body.appendChild(saveBannerContainer);
  }
  return saveBannerContainer;
}

export function showSaveBanner(message, type = "success") {
  const container = ensureSaveBannerContainer();
  const banner = document.createElement("div");
  banner.className = `save-banner save-banner-${type}`;
  banner.textContent = message;
  container.appendChild(banner);

  requestAnimationFrame(() => banner.classList.add("visible"));
  setTimeout(() => {
    banner.classList.remove("visible");
    setTimeout(() => banner.remove(), 250);
  }, 3000);
}

// Splits a tradeoff string into one line per outcome branch. Branches are separated by
// "·" (e.g. probability-labeled outcomes); all comma-separated effects within a branch
// stay together on that branch's line, right behind its probability/label prefix.
function formatTradeoffLines(tradeoff) {
  if (!tradeoff) return [];
  return tradeoff
    .split("·")
    .map((line) => line.trim())
    .filter(Boolean);
}

const DEFAULT_RESULT_ICONS = { good: "🎉", bad: "⚠️", neutral: "ℹ️" };
const resultModalQueue = [];
let resultModalShowing = false;

function drainResultModalQueue() {
  const next = resultModalQueue.shift();
  if (!next) {
    resultModalShowing = false;
    return;
  }
  resultModalShowing = true;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box result-modal result-modal-${next.tone}">
      <div class="result-icon">${next.icon}</div>
      <h3>${next.title}</h3>
      <p>${next.text}</p>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => {
    overlay.remove();
    drainResultModalQueue();
  };
  overlay.addEventListener("click", close);
  setTimeout(close, 5000);
}

// Big centered popup — reserved for notable RACE results (win/podium/DNF) only. Event/dilemma
// outcomes used to go through this too, but that was reverted on request: a dilemma resolution
// now surfaces through the small corner toast instead (showResultToast below), the centered
// modal felt too intrusive for something that happens most weeks. Queued rather than stacked:
// only one shown at a time, so multiple podiums the same week don't pile up dimmed backgrounds.
export function showResultModal(title, text, tone = "neutral", icon = null) {
  resultModalQueue.push({ title, text, tone, icon: icon ?? DEFAULT_RESULT_ICONS[tone] ?? DEFAULT_RESULT_ICONS.neutral });
  if (!resultModalShowing) drainResultModalQueue();
}

const RESULT_TOAST_TYPE = { good: "success", bad: "error", neutral: "info" };

// Small bottom-right corner popup (reuses the existing toast system) for event/dilemma
// outcomes — title + text combined on one toast, auto-dismiss like any other toast.
export function showResultToast(title, text, tone = "neutral", icon = null) {
  const displayIcon = icon ?? DEFAULT_RESULT_ICONS[tone] ?? DEFAULT_RESULT_ICONS.neutral;
  showToast(`${displayIcon} ${title} — ${text}`, RESULT_TOAST_TYPE[tone] ?? "info");
}

export function showEventModal(event, onOptionPicked) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const box = document.createElement("div");
  box.className = "modal-box";
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Dilemma options don't carry an explicit accept/decline tag in the event data — coloring
  // buttons by inferred position (first=green, last=gray) wasn't reliable across all 26
  // dilemmas, so every option now gets the same neutral styling instead of a guessed tone.
  const optionsHtml = event.options
    ? event.options
        .map(
          (o, i) => `
        <button class="secondary event-option" data-idx="${i}">
          ${o.label}
          ${o.tradeoff ? `<div class="event-tradeoff">${formatTradeoffLines(o.tradeoff).map((line) => `<div>${line}</div>`).join("")}</div>` : ""}
        </button>`
        )
        .join("")
    : `<button class="secondary" data-idx="-1">OK</button>`;
  box.innerHTML = `
    <h3>${event.title ?? "Événement"}</h3>
    <p>${event.text ?? ""}</p>
    <div class="modal-actions event-modal-actions">${optionsHtml}</div>`;

  box.querySelectorAll("[data-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      // Apply consequences and close immediately — no confirmation step. The outcome is
      // surfaced through the small corner toast rather than a second choice screen.
      const result = idx >= 0 ? onOptionPicked(idx) : null;
      overlay.remove();
      if (result && result.text) {
        showResultToast(result.title ?? event.title, result.text, result.tone ?? "neutral");
      }
    });
  });
}

// Negotiation window that overlays the game (recruitment, per explicit request — "chaque
// phase de négociation sera dans une fenêtre en superposition") — stays open across a rejected
// offer instead of closing, showing the refusal message and a suggested counter-offer inline
// so the player can adjust and resubmit without reopening. onSubmit must return the same
// {ok, error?, counterOffer?} shape as negotiateSigning (state.js).
export function showNegotiationModal(title, subtitle, initialOffer, onSubmit) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const box = document.createElement("div");
  box.className = "modal-box negotiation-modal";
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  function renderContent(offerValue, message) {
    box.innerHTML = `
      <h3>${title}</h3>
      <p>${subtitle}</p>
      ${message ? `<p class="warn-text">${message}</p>` : ""}
      <label class="negotiation-offer-label">
        Offre proposée
        <input type="number" min="0" step="500" data-role="offer-input" value="${offerValue}" />
        €
      </label>
      <div class="modal-actions">
        <button class="secondary" data-role="cancel">Annuler</button>
        <button class="primary" data-role="submit">Proposer</button>
      </div>`;
    box.querySelector('[data-role="cancel"]').addEventListener("click", () => overlay.remove());
    box.querySelector('[data-role="submit"]').addEventListener("click", () => {
      const value = Number(box.querySelector('[data-role="offer-input"]').value) || 0;
      const result = onSubmit(value);
      if (result.ok) {
        overlay.remove();
      } else {
        renderContent(result.counterOffer ?? value, result.error);
      }
    });
  }
  renderContent(initialOffer, null);
}

export function showConfirm(message, onConfirm) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <p>${message}</p>
      <div class="modal-actions">
        <button class="secondary" data-role="cancel">Annuler</button>
        <button class="primary" data-role="confirm">Confirmer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('[data-role="cancel"]').addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.querySelector('[data-role="confirm"]').addEventListener("click", () => {
    overlay.remove();
    onConfirm();
  });
}
