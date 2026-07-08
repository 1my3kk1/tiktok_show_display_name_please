const VERSION = chrome.runtime.getManifest().version;
document.getElementById("version").innerText = `v${VERSION}`;