const jwt = require("jsonwebtoken");
const config = require("../config");
const Admin = require("../models/Admin");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");

function expiresToMs(value) {
  const match = /^(\d+)([smhd])$/.exec(String(value || "").trim());
  if (!match) return 24 * 60 * 60 * 1000;
  const amount = parseInt(match[1], 10);
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
  return amount * unit;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    maxAge: expiresToMs(config.jwtExpiresIn),
    path: "/",
  };
}

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    throw new AppError(400, "Email and password are required");
  }

  const admin = await Admin.findOne({ email: String(email).toLowerCase().trim() });
  if (!admin) {
    throw new AppError(401, "Invalid email or password");
  }

  const ok = await admin.comparePassword(String(password));
  if (!ok) {
    throw new AppError(401, "Invalid email or password");
  }

  const token = jwt.sign({ sub: admin._id.toString(), role: admin.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });

  res.cookie(config.cookieName, token, cookieOptions());
  res.json({ admin: admin.toJSON() });
});

const logout = asyncHandler(async (_req, res) => {
  res.clearCookie(config.cookieName, { ...cookieOptions(), maxAge: undefined });
  res.json({ success: true });
});

const me = asyncHandler(async (req, res) => {
  res.json({ admin: req.admin.toJSON() });
});

module.exports = { login, logout, me };
