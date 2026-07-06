import { hydrateInitialUsers } from "./hydrate.js";
import { addUsers, getUserCount, hasUser } from "./cache.js";
import { logger } from "./logger.js";
import { startObserver } from "./observer.js";
import { retryPendingUsers } from "./replacer.js";

const RUNTIME_MESSAGE_TYPE = "TDE_RUNTIME_USERS";

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin) {
    return;
  }

  if (event.data?.type !== RUNTIME_MESSAGE_TYPE || !Array.isArray(event.data.users)) {
    return;
  }

  const newUniqueIds = getNewUniqueIds(event.data.users);
  const added = addUsers(event.data.users);

  if (added > 0) {
    retryPendingUsers(newUniqueIds);

    logger.info("Runtime users collected", {
      received: event.data.users.length,
      added,
      cacheSize: getUserCount()
    });
  }
});

hydrateInitialUsers();
startObserver();

function getNewUniqueIds(users) {
  const uniqueIds = new Set();

  for (const user of users) {
    if (typeof user.uniqueId === "string" && !hasUser(user.uniqueId)) {
      uniqueIds.add(user.uniqueId);
    }
  }

  return uniqueIds;
}
