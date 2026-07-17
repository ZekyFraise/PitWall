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

export function showEventModal(event, onOptionPicked) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const box = document.createElement("div");
  box.className = "modal-box";
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  function renderChoice() {
    const optionsHtml = event.options
      ? event.options
          .map(
            (o, i) => `
        <button class="primary event-option" data-idx="${i}">
          ${o.label}
          ${o.tradeoff ? `<span class="event-tradeoff">${o.tradeoff}</span>` : ""}
        </button>`
          )
          .join("")
      : `<button class="primary" data-idx="-1">OK</button>`;
    box.innerHTML = `
      <h3>${event.title ?? "Événement"}</h3>
      <p>${event.text ?? ""}</p>
      <div class="modal-actions event-modal-actions">${optionsHtml}</div>`;

    box.querySelectorAll("[data-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        if (idx < 0) {
          overlay.remove();
          return;
        }
        const resultText = onOptionPicked(idx);
        renderResult(resultText);
      });
    });
  }

  function renderResult(resultText) {
    box.innerHTML = `
      <h3>${event.title ?? "Événement"}</h3>
      <p>${resultText ?? ""}</p>
      <div class="modal-actions">
        <button class="primary" data-role="close-result">Fermer</button>
      </div>`;
    box.querySelector('[data-role="close-result"]').addEventListener("click", () => overlay.remove());
  }

  renderChoice();
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
