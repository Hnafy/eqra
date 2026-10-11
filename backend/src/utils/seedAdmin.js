const Admin = require("../models/Admin");
const config = require("../config");

async function ensureAdmin({ updateExisting = false } = {}) {
  if (!config.adminEmail || !config.adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed an admin");
  }

  const email = config.adminEmail.toLowerCase().trim();
  const existing = await Admin.findOne({ email });
  const passwordHash = await Admin.hashPassword(config.adminPassword);

  if (existing) {
    if (updateExisting) {
      existing.passwordHash = passwordHash;
      await existing.save();
      return { created: false, updated: true, email };
    }
    return { created: false, updated: false, email };
  }

  await Admin.create({ email, passwordHash, role: "admin" });
  return { created: true, updated: false, email };
}

module.exports = { ensureAdmin };

if (require.main === module) {
  (async () => {
    const { connectDb, mongoose } = require("../config/db");
    try {
      await connectDb();
      const result = await ensureAdmin({ updateExisting: true });
      console.log("[seed:admin]", result);
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      console.error("[seed:admin] failed:", err.message);
      process.exit(1);
    }
  })();
}
