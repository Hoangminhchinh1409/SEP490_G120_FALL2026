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

const supabase = require("./config/supabase");
const prisma = require("./config/prisma");
const apiRoutes = require("./routes");

const app = express();
app.set("trust proxy", true);
const PORT = process.env.PORT || 9999;
const frontendOrigin = new URL(
    process.env.FRONTEND_URL || "http://localhost:3000"
).origin;

app.use(compression());
app.use(helmet());

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

app.listen(PORT, async () => {
    try {
        const { error } = await supabase.from("orders").select("id").limit(1);
        if (error) {
            console.error("PostgreSQL (Supabase) connection failed:", error.message);
        } else {
            console.log("PostgreSQL (Supabase) connected successfully!");
            // Khởi động các Background Jobs của Phân hệ Quản lý
            initManagerJobs();
        }
    } catch (error) {
        console.error("PostgreSQL connection failed:", error.message);
    }
    console.log(`Server running at http://localhost:${PORT}`);
});
