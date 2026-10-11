const jwt = require("jsonwebtoken");
const config = require("../config");
const Admin = require("../models/Admin");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");

const authenticate = asyncHandler(async (req, _res, next) => {
  const token = req.cookies ? req.cookies[config.cookieName] : null;
  if (!token) {
    throw new AppError(401, "Authentication required");
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch (err) {
    throw new AppError(401, "Invalid or expired session");
  }

  const admin = await Admin.findById(payload.sub);
  if (!admin) {
    throw new AppError(401, "Account no longer exists");
  }

  req.admin = admin;
  next();
});

function requireAdmin(req, _res, next) {
  if (!req.admin || req.admin.role !== "admin") {
    return next(new AppError(403, "Admin privileges required"));
  }
  next();
}

module.exports = { authenticate, requireAdmin };
