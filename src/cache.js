const users = new Map();

export function addUser(uniqueId, nickname) {
  if (!isValidUser(uniqueId, nickname) || users.has(uniqueId)) {
    return false;
  }

  users.set(uniqueId, nickname);
  return true;
}

export function addUsers(entries) {
  let added = 0;

  for (const entry of entries) {
    if (addUser(entry.uniqueId, entry.nickname)) {
      added += 1;
    }
  }

  return added;
}

export function getNickname(uniqueId) {
  return users.get(uniqueId);
}

export function hasUser(uniqueId) {
  return users.has(uniqueId);
}

export function getUserCount() {
  return users.size;
}

function isValidUser(uniqueId, nickname) {
  return (
    typeof uniqueId === "string" &&
    uniqueId.length > 0 &&
    typeof nickname === "string" &&
    nickname.length > 0
  );
}
