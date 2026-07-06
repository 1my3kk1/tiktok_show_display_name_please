import { logger } from "./logger.js";
import { processNode } from "./replacer.js";

let observer = null;

export function startObserver() {
  if (observer) {
    return;
  }

  if (!document.body) {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
    return;
  }

  observer = new MutationObserver(handleMutations);
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

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
