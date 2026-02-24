// --------------------------------------------------
// PRIVATE GITHUB AUTO UPDATE
// --------------------------------------------------

const GITHUB_OWNER = "Agustin09812";
const GITHUB_REPO = "neurolinks-control-app";
const GITHUB_TOKEN = "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";

async function checkForUpdates() {

  try {

    const localVersion = await window.api.getAppVersion();

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          "Authorization": `Bearer ${GITHUB_TOKEN}`,
          "Accept": "application/vnd.github+json"
        }
      }
    );

    if (!response.ok) {
      console.error("GitHub API error");
      return;
    }

    const data = await response.json();

    const remoteVersion = data.tag_name.replace("v", "");

    if (isNewerVersion(remoteVersion, localVersion)) {

      const asset = data.assets[0];
      if (!asset) return;

      showUpdateModal(remoteVersion, asset.browser_download_url);

    }

  } catch (err) {
    console.error("Update check failed:", err);
  }
}

function isNewerVersion(remote, local) {

  const r = remote.split('.').map(Number);
  const l = local.split('.').map(Number);

  for (let i = 0; i < r.length; i++) {
    if ((r[i] || 0) > (l[i] || 0)) return true;
    if ((r[i] || 0) < (l[i] || 0)) return false;
  }

  return false;
}

function showUpdateModal(version, url) {

  const confirmUpdate = confirm(
    `Nueva versión disponible (${version}).\n\n¿Deseas descargarla ahora?`
  );

  if (!confirmUpdate) return;

  window.api.openExternal(url);
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(checkForUpdates, 3000);
});