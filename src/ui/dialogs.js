let toastContainer = null;

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

export function showEventModal(event, onOptionPicked) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const box = document.createElement("div");
  box.className = "modal-box";
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Dilemma options don't carry an explicit accept/decline tag in the event data, so tone is
  // inferred from position — by convention across every dilemma in events.js, the first option
  // is the most cooperative/accepting one and the last is the outright refusal, with any
  // middle options being a compromise. First = green, last (when there's more than one option)
  // = gray, middle = neutral.
  const optionsHtml = event.options
    ? event.options
        .map((o, i) => {
          const isLast = i === event.options.length - 1 && event.options.length > 1;
          const toneClass = i === 0 ? "btn-green" : isLast ? "secondary" : "primary";
          return `
        <button class="${toneClass} event-option" data-idx="${i}">
          ${o.label}
          ${o.tradeoff ? `<div class="event-tradeoff">${formatTradeoffLines(o.tradeoff).map((line) => `<div>${line}</div>`).join("")}</div>` : ""}
        </button>`;
        })
        .join("")
    : `<button class="primary" data-idx="-1">OK</button>`;
  box.innerHTML = `
    <h3>${event.title ?? "Événement"}</h3>
    <p>${event.text ?? ""}</p>
    <div class="modal-actions event-modal-actions">${optionsHtml}</div>`;

  box.querySelectorAll("[data-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      // Apply consequences and close immediately — no confirmation step. The outcome is
      // surfaced through an auto-dismissing toast rather than a second modal screen.
      const result = idx >= 0 ? onOptionPicked(idx) : null;
      overlay.remove();
      if (result && result.text) {
        showToast(result.text, result.tone === "bad" ? "error" : "success");
      }
    });
  });
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
