const DEBUG = false;
const PREFIX = "[TikTok DisplayName]";

function noop() {}

function write(level, args) {
  console[level](PREFIX, ...args);
}

export const logger = DEBUG
  ? {
      debug: (...args) => write("debug", args),
      info: (...args) => write("info", args),
      warn: (...args) => write("warn", args),
      error: (...args) => write("error", args)
    }
  : {
      debug: noop,
      info: noop,
      warn: noop,
      error: noop
    };
