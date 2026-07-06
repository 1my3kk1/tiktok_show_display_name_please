const AUTHORS = [
  {
    name: "yekki",
    role: "Donothing",
    avatar: "../avatar/yekki.png",
    github: "https://github.com/1my3kk1"
  },
  {
    name: "opencode",
    role: "Developer",
    avatar: "../avatar/opencode.png",
    github: "https://github.com/anomalyco/opencode"
  },
  {
    name: "codex",
    role: "Developer",
    avatar: "../avatar/codex.png",
    github: "https://github.com/openai/codex"
  }
];

const VERSION = chrome.runtime.getManifest().version;

function createAvatar(author) {
  const wrapper = document.createElement("div");
  wrapper.className = "avatar-wrapper";

  const tooltip = document.createElement("div");
  tooltip.className = "tooltip";
  tooltip.innerHTML = `
    <div class="tooltip-name">${author.name}</div>
    <div class="tooltip-role">${author.role}</div>
  `;
  wrapper.appendChild(tooltip);

  if (author.avatar) {
    const img = document.createElement("img");
    img.className = "avatar";
    img.src = author.avatar;
    img.alt = author.name;
    wrapper.appendChild(img);
  } else {
    const fallback = document.createElement("div");
    fallback.className = "avatar-fallback";
    fallback.textContent = author.name.charAt(0).toUpperCase();
    wrapper.appendChild(fallback);
  }

  wrapper.addEventListener("click", () => {
    if (author.github) {
      chrome.tabs.create({ url: author.github });
    }
  });

  return wrapper;
}

function init() {
  const group = document.getElementById("avatarGroup");
  AUTHORS.forEach(author => {
    group.appendChild(createAvatar(author));
  });

  document.getElementById("version").textContent = `Version ${VERSION}`;
}

document.addEventListener("DOMContentLoaded", init);
