// --------------------------------------------------
// AUTOUPDATE
// --------------------------------------------------

let updateData = null;

window.api.onUpdateAvailable((data) => {

  updateData = data;

  const badge = document.getElementById("updates-badge");
  if (badge) {
    badge.style.display = "inline-block";
    badge.innerText = "1";
  }

  addNotification(
    "update",
    `Nueva versión ${data.version} disponible`,
    "Hacé clic en Actualizaciones en el menú lateral para instalarla.",
    `update-${data.version}`
  );

});

window.api.onUpdateDownloaded(() => {

  const badge = document.getElementById("updates-badge");

  if (badge) {
    badge.style.display = "none";
  }

});

function openUpdateModal() {

  if (!updateData) return;

  const version = document.getElementById("update-modal-version");
  const notes = document.getElementById("update-modal-notes");

  version.textContent = "Versión " + updateData.version;

  const releaseNotes = updateData.notes || [];

  if (Array.isArray(releaseNotes)) {
    notes.innerHTML = releaseNotes.map(n => "• " + n).join("<br>");
  } else {
    notes.textContent = releaseNotes;
  }

  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("updateModal"));
  modal.show();

}

document.getElementById("btnModalUpdate")?.addEventListener("click", () => {

  if (!confirm("¿Descargar e instalar la nueva versión?")) return;

  window.api.startUpdate();

});

window.api.onUpdateProgress((percent) => {

  const progress = document.getElementById("update-progress");
  const bar = document.getElementById("update-progress-bar");

  if (!progress) return;

  progress.classList.remove("d-none");
  bar.style.width = percent + "%";

});
