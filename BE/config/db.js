const { Pool } = require("pg");

// Làm sạch tham số sslmode trong connectionString để tránh việc pg-connection-string
// ghi đè object ssl { rejectUnauthorized: false } bằng chế độ verify-full mặc định của Supabase
const rawConnectionString = process.env.DATABASE_URL || "";
const cleanConnectionString = rawConnectionString.replace(/([?&])sslmode=[^&]*/, "");

const isLocalhost = cleanConnectionString.includes("localhost") || cleanConnectionString.includes("127.0.0.1");

const pool = new Pool({
  connectionString: cleanConnectionString,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
  ssl: cleanConnectionString && !isLocalhost
    ? { rejectUnauthorized: false }
    : false
});

pool.on("error", (err) => {
  console.warn("[PG Pool] Idle client disconnected:", err?.message || err);
});

module.exports = pool;
