const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { jwtSecret } = require("../config/env");
const { createHttpError } = require("../utils/httpError");

async function authenticate(req, _res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return next(createHttpError(401, "Missing or invalid authorization header"));
  }

  const token = authorization.slice("Bearer ".length);

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findById(decoded.sub);

    if (!user) {
      return next(createHttpError(401, "User no longer exists"));
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(createHttpError(401, "Invalid or expired token"));
  }
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(createHttpError(403, "You do not have permission to perform this action"));
    }

    return next();
  };
}

module.exports = {
  authenticate,
  requireRole,
};
