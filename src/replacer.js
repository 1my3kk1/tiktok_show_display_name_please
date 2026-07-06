import { getNickname } from "./cache.js";
import { logger } from "./logger.js";

const PROFILE_SELECTOR = 'a[href^="/@"]';
const ENHANCED_ATTRIBUTE = "data-display-name-enhanced";
const USERNAME_CLASS = "tde-username";
const MAX_PENDING_ANCHORS = 500;

const pendingAnchors = new Map();
let pendingAnchorCount = 0;

export function processNode(node) {
  if (node?.nodeType === Node.TEXT_NODE) {
    return enhanceClosestAnchor(node.parentElement);
  }

  if (!isElement(node)) {
    return 0;
  }

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

  if (!anchor) {
    return 0;
  }

  return enhanceAnchor(anchor);
}

function boQuaPhanTu(anchor) {
  return anchor.closest('[class*="UlAccountList"]') !== null;
}

export function enhanceAnchor(anchor) {
  if (anchor.getAttribute(ENHANCED_ATTRIBUTE) === "1") {
    return 0;
  }

  if (boQuaPhanTu(anchor)) {
    return 0;
  }
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

  if (!replaceAnchorText(anchor, uniqueId, nickname)) {
    return 0;
  }

  anchor.setAttribute(ENHANCED_ATTRIBUTE, "1");
  return 1;
}

export function retryPendingUsers(uniqueIds) {
  let replaced = 0;

  for (const uniqueId of uniqueIds) {
    const anchors = pendingAnchors.get(uniqueId);

    if (!anchors) {
      continue;
    }

    for (const anchor of anchors) {
      if (!anchor.isConnected || anchor.getAttribute(ENHANCED_ATTRIBUTE) === "1") {
        pendingAnchorCount -= 1;
        anchors.delete(anchor);
        continue;
      }

      replaced += enhanceAnchor(anchor);
      pendingAnchorCount -= 1;
      anchors.delete(anchor);
    }

    if (anchors.size === 0) {
      pendingAnchors.delete(uniqueId);
    }
  }

  if (replaced > 0) {
    logger.debug("Pending anchors retried", { replaced });
  }

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

  if (!href || !href.startsWith("/@")) {
    return "";
  }

  const pathname = href.split("?")[0].split("#")[0];
  const uniqueId = pathname.slice(2).split("/")[0];

  return decodeURIComponent(uniqueId);
}

function isElement(node) {
  return node?.nodeType === Node.ELEMENT_NODE;
}

function trackPendingAnchor(uniqueId, anchor) {
  if (pendingAnchorCount >= MAX_PENDING_ANCHORS) {
    prunePendingAnchors();
  }

  if (pendingAnchorCount >= MAX_PENDING_ANCHORS) {
    return;
  }

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
      if (!anchor.isConnected || anchor.getAttribute(ENHANCED_ATTRIBUTE) === "1") {
        anchors.delete(anchor);
        pendingAnchorCount -= 1;
      }
    }

    if (anchors.size === 0) {
      pendingAnchors.delete(uniqueId);
    }
  }
}
