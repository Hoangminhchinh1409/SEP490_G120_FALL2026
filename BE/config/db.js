const { Pool } = require("pg");

// Làm sạch tham số sslmode trong connectionString để tránh việc pg-connection-string
// ghi đè object ssl { rejectUnauthorized: false } bằng chế độ verify-full mặc định của Supabase
const rawConnectionString = process.env.DATABASE_URL || "";
const cleanConnectionString = rawConnectionString.replace(/([?&])sslmode=[^&]*/, "");

const isLocalhost = cleanConnectionString.includes("localhost") || cleanConnectionString.includes("127.0.0.1");

const pool = new Pool({
  connectionString: cleanConnectionString,
  ssl: cleanConnectionString && !isLocalhost
    ? { rejectUnauthorized: false }
    : false
});

module.exports = pool;
