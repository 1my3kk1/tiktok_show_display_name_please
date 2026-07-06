import { addUsers, getUserCount } from "./cache.js";
import { collect } from "./collector.js";
import { logger } from "./logger.js";

const HYDRATION_SELECTOR = "#__UNIVERSAL_DATA_FOR_REHYDRATION__";

let didHydrate = false;

export function hydrateInitialUsers() {
  if (didHydrate) {
    return;
  }

  const script = document.querySelector(HYDRATION_SELECTOR);

  if (!script) {
    scheduleHydrationRetry();
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
      cacheSize: getUserCount()
    });
  } catch (error) {
    logger.error("Failed to parse hydration data", error);
  }
}

function scheduleHydrationRetry() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hydrateInitialUsers, { once: true });
    return;
  }

  logger.warn("Hydration script not found");
}
