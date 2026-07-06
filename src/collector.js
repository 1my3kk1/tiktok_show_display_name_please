export function collect(source) {
  const users = [];
  const seen = new WeakSet();
  const seenUsers = new Set();

  visit(source, users, seen, seenUsers);

  return users;
}

function visit(value, users, seen, seenUsers) {
  if (!isObjectLike(value) || seen.has(value)) {
    return;
  }

  seen.add(value);

  if (hasUserShape(value) && !seenUsers.has(value.uniqueId)) {
    seenUsers.add(value.uniqueId);
    users.push({
      uniqueId: value.uniqueId,
      nickname: value.nickname
    });
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      visit(item, users, seen, seenUsers);
    }
    return;
  }

  for (const child of Object.values(value)) {
    visit(child, users, seen, seenUsers);
  }
}

function hasUserShape(value) {
  return typeof value.uniqueId === "string" && typeof value.nickname === "string";
}

function isObjectLike(value) {
  return value !== null && typeof value === "object";
}
