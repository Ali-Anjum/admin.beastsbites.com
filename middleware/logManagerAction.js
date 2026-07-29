const Log = require("../Models/LogSchema");

function sanitizePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const clone = { ...payload };

  if ("password" in clone) {
    clone.password = "[REDACTED]";
  }

  return clone;
}

function logManagerAction(action = "") {
  return function managerLogger(req, res, next) {
    if (!req.user) {
      return next();
    }

    res.on("finish", async () => {
      try {
        await Log.create({
          actor_username: req.user.username,
          actor_role: req.user.role,
          method: req.method,
          route: req.originalUrl,
          action,
          payload: sanitizePayload(req.method === "GET" ? req.query : req.body),
          status_code: res.statusCode
        });
      } catch (err) {
        console.error("Failed to store action log:", err.message);
      }
    });

    return next();
  };
}

module.exports = logManagerAction;
