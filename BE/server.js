const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const helmet = require("helmet");
require("dotenv").config();

if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
    console.error("JWT_SECRET is required to start the backend.");
    process.exit(1);
}

// Đảm bảo BigInt trả về từ Prisma được serialize chuẩn sang JSON (Number)
BigInt.prototype.toJSON = function () {
    const n = Number(this);
    return Number.isSafeInteger(n) ? n : this.toString();
};

const prisma = require("./config/prisma");
const apiRoutes = require("./routes");

const app = express();
app.set("trust proxy", true);
const PORT = process.env.PORT || 9999;
const frontendOrigin = new URL(
    process.env.FRONTEND_URL || "http://localhost:3000"
).origin;

app.use(compression());
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
    origin: (origin, callback) => {
        callback(null, origin === frontendOrigin);
    },
    credentials: true
}));

app.use("/api/auth", express.json({ limit: "100kb" }));
app.use("/api/auth", express.urlencoded({ limit: "100kb", extended: true }));
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
    res.json({ message: "NEXLOG Express Backend is running!" });
});

// API routes (aggregated via routes/index.js)
app.use("/api", apiRoutes);

app.use((req, res) => {
    res.status(404).json({
        message: `Cannot ${req.method} ${req.originalUrl}`
    });
});

app.use((err, req, res, next) => {
    console.error("[Server Error]:", err.message || err);
    if (err.type === "entity.too.large") {
        return res.status(413).json({
            message: "Dung lượng tệp tải lên quá lớn. Vui lòng chọn tệp nhỏ hơn."
        });
    }
    res.status(err.status || 500).json({
        message: err.message || "Internal Server Error"
    });
});

const { initManagerJobs } = require("./jobs/managerJobs");

let managerJobsStarted = false;

const connectPostgresWithRetry = async (attempt = 1, maxQuickRetries = 4) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        console.log("PostgreSQL (Prisma) connected successfully!");
        if (!managerJobsStarted) {
            managerJobsStarted = true;
            // Khởi động các Background Jobs của Phân hệ Quản lý
            initManagerJobs();
        }
    } catch (error) {
        const delayMs = attempt <= maxQuickRetries
            ? Math.min(15000, 1500 * Math.pow(2, attempt - 1))
            : 30000;
        console.warn(
            `[PostgreSQL] Kết nối lần ${attempt} thất bại (${error?.message || error}). Tự động thử lại sau ${Math.round(delayMs / 1000)}s...`
        );
        setTimeout(() => {
            connectPostgresWithRetry(attempt + 1, maxQuickRetries);
        }, delayMs);
    }
};

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    connectPostgresWithRetry();
});
