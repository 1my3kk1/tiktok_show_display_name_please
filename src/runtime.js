(() => {
  const MESSAGE_TYPE = "TDE_RUNTIME_USERS";
  const originalJson = Response.prototype.json;

  if (Response.prototype.json.__tdeHooked) {
    return;
  }

  function patchedJson(...args) {
    return originalJson.apply(this, args).then((data) => {
      const users = collect(data);

      if (users.length > 0) {
        window.postMessage(
          {
            source: "TikTok DisplayName",
            type: MESSAGE_TYPE,
            users
          },
          window.location.origin
        );
      }

      return data;
    });
  }

  Object.defineProperty(patchedJson, "__tdeHooked", {
    value: true
  });

  Response.prototype.json = patchedJson;

  function collect(source) {
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

    if (
      typeof value.uniqueId === "string" &&
      typeof value.nickname === "string" &&
      !seenUsers.has(value.uniqueId)
    ) {
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

  function isObjectLike(value) {
    return value !== null && typeof value === "object";
  }
})();
