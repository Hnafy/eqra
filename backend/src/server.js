const app = require("./app");
const config = require("./config");
const { connectDb } = require("./config/db");
const { ensureAdmin } = require("./utils/seedAdmin");

async function start() {
  try {
    await connectDb();

    // Bootstrap the first admin from environment variables when configured.
    if (config.adminEmail && config.adminPassword) {
      try {
        const result = await ensureAdmin({ updateExisting: false });
        if (result.created) {
          console.log(`[seed:admin] created admin ${result.email}`);
        }
      } catch (err) {
        console.warn("[seed:admin] skipped:", err.message);
      }
    }

    app.listen(config.port, () => {
      console.log(`[server] listening on http://127.0.0.1:${config.port} (${config.env})`);
      console.log(`[server] Python API: ${config.pythonApiUrl}`);
    });
  } catch (err) {
    console.error("[server] failed to start:", err.message);
    process.exit(1);
  }
}

start();
