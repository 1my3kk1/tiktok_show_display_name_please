// ==UserScript==
// @name                TikTok Show Display Name Please
// @namespace           https://github.com/1my3kk1
// @version             0.1.1
// @description         Thay thế username bằng display name (nickname) trên TikTok Web, vẫn hiện @username nhỏ bên cạnh
// @author              yekki
// @license             MIT
// @match               https://www.tiktok.com/*
// @icon                https://www.tiktok.com/favicon.ico
// @grant               GM_addStyle
// @run-at              document-start
// ==/UserScript==

(function () {
  "use strict";

  // ──────────────────────────────────────────────
  // Style
  // ──────────────────────────────────────────────
  GM_addStyle(`
    .tde-username {
      color: inherit;
      font-size: 0.82em;
      margin-left: 0.25em;
      opacity: 0.7;
      text-decoration: none;
    }
  `);

  // ──────────────────────────────────────────────
  // Logger
  // ──────────────────────────────────────────────
  const DEBUG = false;
  const PREFIX = "[TikTok DisplayName]";

  const logger = DEBUG
    ? {
        debug: (...args) => console.debug(PREFIX, ...args),
        info: (...args) => console.info(PREFIX, ...args),
        warn: (...args) => console.warn(PREFIX, ...args),
        error: (...args) => console.error(PREFIX, ...args),
      }
    : {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      };

  // ──────────────────────────────────────────────
  // Cache
  // ──────────────────────────────────────────────
  const users = new Map();

  function addUser(uniqueId, nickname) {
    if (
      typeof uniqueId !== "string" ||
      uniqueId.length === 0 ||
      typeof nickname !== "string" ||
      nickname.length === 0 ||
      users.has(uniqueId)
    ) {
      return false;
    }
    users.set(uniqueId, nickname);
    return true;
  }

  function addUsers(entries) {
    let added = 0;
    for (const entry of entries) {
      if (addUser(entry.uniqueId, entry.nickname)) added += 1;
    }
    return added;
  }

  function getNickname(uniqueId) {
    return users.get(uniqueId);
  }

  function hasUser(uniqueId) {
    return users.has(uniqueId);
  }

  function getUserCount() {
    return users.size;
  }

  // ──────────────────────────────────────────────
  // Collector — deep traversal for {uniqueId, nickname}
  // ──────────────────────────────────────────────
  function collect(source) {
    const result = [];
    const seen = new WeakSet();
    const seenUsers = new Set();
    visit(source, result, seen, seenUsers);
    return result;
  }

  function visit(value, result, seen, seenUsers) {
    if (!isObjectLike(value) || seen.has(value)) return;
    seen.add(value);

    if (
      typeof value.uniqueId === "string" &&
      typeof value.nickname === "string" &&
      !seenUsers.has(value.uniqueId)
    ) {
      seenUsers.add(value.uniqueId);
      result.push({ uniqueId: value.uniqueId, nickname: value.nickname });
    }

    if (Array.isArray(value)) {
      for (const item of value) visit(item, result, seen, seenUsers);
      return;
    }

    for (const child of Object.values(value)) {
      visit(child, result, seen, seenUsers);
    }
  }

  function isObjectLike(value) {
    return value !== null && typeof value === "object";
  }

  // ──────────────────────────────────────────────
  // Hydration — parse SSR data
  // ──────────────────────────────────────────────
  const HYDRATION_SELECTOR = "#__UNIVERSAL_DATA_FOR_REHYDRATION__";
  let didHydrate = false;

  function hydrateInitialUsers() {
    if (didHydrate) return;
    const script = document.querySelector(HYDRATION_SELECTOR);
    if (!script) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", hydrateInitialUsers, {
          once: true,
        });
      } else {
        logger.warn("Hydration script not found");
      }
      return;
    }
    didHydrate = true;
    try {
      const data = JSON.parse(script.textContent || "{}");
      const collected = collect(data);
      const added = addUsers(collected);
      logger.info("Hydration parsed", {
        collected: collected.length,
        added,
        cacheSize: getUserCount(),
      });
    } catch (error) {
      logger.error("Failed to parse hydration data", error);
    }
  }

  // ──────────────────────────────────────────────
  // Runtime interceptor — patch Response.prototype.json
  // ──────────────────────────────────────────────
  function setupRuntimeInterceptor() {
    if (Response.prototype.json.__tdeHooked) return;

    const originalJson = Response.prototype.json;

    function patchedJson(...args) {
      return originalJson.apply(this, args).then((data) => {
        const collected = collect(data);
        if (collected.length > 0) {
          const newIds = getNewUniqueIds(collected);
          const added = addUsers(collected);
          if (added > 0) {
            retryPendingUsers(newIds);
            logger.info("Runtime users collected", {
              received: collected.length,
              added,
              cacheSize: getUserCount(),
            });
          }
        }
        return data;
      });
    }

    Object.defineProperty(patchedJson, "__tdeHooked", { value: true });
    Response.prototype.json = patchedJson;
  }

  function getNewUniqueIds(entries) {
    const ids = new Set();
    for (const user of entries) {
      if (typeof user.uniqueId === "string" && !hasUser(user.uniqueId)) {
        ids.add(user.uniqueId);
      }
    }
    return ids;
  }

  // ──────────────────────────────────────────────
  // Replacer — DOM manipulation
  // ──────────────────────────────────────────────
  const PROFILE_SELECTOR = 'a[href^="/@"]';
  const ENHANCED_ATTRIBUTE = "data-display-name-enhanced";
  const USERNAME_CLASS = "tde-username";
  const MAX_PENDING_ANCHORS = 500;

  const pendingAnchors = new Map();
  let pendingAnchorCount = 0;

  function processNode(node) {
    if (node?.nodeType === Node.TEXT_NODE) {
      return enhanceClosestAnchor(node.parentElement);
    }
    if (!isElement(node)) return 0;

    let replaced = 0;
    replaced += enhanceClosestAnchor(node);

    if (node.matches(PROFILE_SELECTOR)) {
      replaced += enhanceAnchor(node);
    }

    for (const anchor of node.querySelectorAll(PROFILE_SELECTOR)) {
      replaced += enhanceAnchor(anchor);
    }

    return replaced;
  }

  function enhanceClosestAnchor(element) {
    const anchor = element?.closest?.(PROFILE_SELECTOR);
    return anchor ? enhanceAnchor(anchor) : 0;
  }

  function boQuaPhanTu(anchor) {
    return anchor.closest('[class*="UlAccountList"]') !== null;
  }

  function enhanceAnchor(anchor) {
    if (anchor.getAttribute(ENHANCED_ATTRIBUTE) === "1") return 0;
    if (boQuaPhanTu(anchor)) return 0;

    const uniqueId = getUniqueIdFromAnchor(anchor);
    if (!uniqueId) {
      logger.warn("Profile selector matched without username", anchor.href);
      return 0;
    }

    const nickname = getNickname(uniqueId);
    if (!nickname) {
      logger.debug("Cache miss", uniqueId);
      trackPendingAnchor(uniqueId, anchor);
      return 0;
    }

    logger.debug("Cache hit", uniqueId);

    if (!replaceAnchorText(anchor, uniqueId, nickname)) return 0;

    anchor.setAttribute(ENHANCED_ATTRIBUTE, "1");
    return 1;
  }

  function retryPendingUsers(uniqueIds) {
    let replaced = 0;
    for (const uniqueId of uniqueIds) {
      const anchors = pendingAnchors.get(uniqueId);
      if (!anchors) continue;

      for (const anchor of anchors) {
        if (
          !anchor.isConnected ||
          anchor.getAttribute(ENHANCED_ATTRIBUTE) === "1"
        ) {
          pendingAnchorCount -= 1;
          anchors.delete(anchor);
          continue;
        }
        replaced += enhanceAnchor(anchor);
        pendingAnchorCount -= 1;
        anchors.delete(anchor);
      }

      if (anchors.size === 0) pendingAnchors.delete(uniqueId);
    }

    if (replaced > 0) logger.debug("Pending anchors retried", { replaced });
    return replaced;
  }

  function replaceAnchorText(anchor, uniqueId, nickname) {
    const textTarget = findTextTarget(anchor, uniqueId);
    if (!textTarget) {
      logger.warn("No replaceable text found for username", uniqueId);
      return false;
    }

    textTarget.textContent = nickname;

    const username = document.createElement("span");
    username.className = USERNAME_CLASS;
    username.textContent = `@${uniqueId}`;
    textTarget.insertAdjacentElement("afterend", username);
    return true;
  }

  function findTextTarget(anchor, uniqueId) {
    const expected = uniqueId.toLowerCase();
    const walker = document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      const text = textNode.nodeValue.trim();
      const normalized = text.replace(/^@/, "").toLowerCase();
      if (normalized === expected) {
        return textNode.parentElement || anchor;
      }
    }
    return null;
  }

  function getUniqueIdFromAnchor(anchor) {
    const href = anchor.getAttribute("href");
    if (!href || !href.startsWith("/@")) return "";
    const pathname = href.split("?")[0].split("#")[0];
    const uniqueId = pathname.slice(2).split("/")[0];
    return decodeURIComponent(uniqueId);
  }

  function isElement(node) {
    return node?.nodeType === Node.ELEMENT_NODE;
  }

  function trackPendingAnchor(uniqueId, anchor) {
    if (pendingAnchorCount >= MAX_PENDING_ANCHORS) prunePendingAnchors();
    if (pendingAnchorCount >= MAX_PENDING_ANCHORS) return;

    let anchors = pendingAnchors.get(uniqueId);
    if (!anchors) {
      anchors = new Set();
      pendingAnchors.set(uniqueId, anchors);
    }
    if (!anchors.has(anchor)) {
      anchors.add(anchor);
      pendingAnchorCount += 1;
    }
  }

  function prunePendingAnchors() {
    for (const [uniqueId, anchors] of pendingAnchors) {
      for (const anchor of anchors) {
        if (
          !anchor.isConnected ||
          anchor.getAttribute(ENHANCED_ATTRIBUTE) === "1"
        ) {
          anchors.delete(anchor);
          pendingAnchorCount -= 1;
        }
      }
      if (anchors.size === 0) pendingAnchors.delete(uniqueId);
    }
  }

  // ──────────────────────────────────────────────
  // Observer
  // ──────────────────────────────────────────────
  let observer = null;

  function startObserver() {
    if (observer) return;
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", startObserver, {
        once: true,
      });
      return;
    }

    observer = new MutationObserver(handleMutations);
    observer.observe(document.body, { childList: true, subtree: true });
    logger.info("MutationObserver started");
    processNode(document.body);
  }

  function handleMutations(mutations) {
    let addedNodes = 0;
    let replaced = 0;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        addedNodes += 1;
        replaced += processNode(node);
      }
    }
    if (addedNodes > 0 && replaced > 0) {
      logger.debug("Mutation batch processed", { addedNodes, replaced });
    }
  }

  // ──────────────────────────────────────────────
  // Boot
  // ──────────────────────────────────────────────
  setupRuntimeInterceptor();
  hydrateInitialUsers();
  startObserver();
})();
