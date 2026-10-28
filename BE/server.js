const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
require("dotenv").config();

const supabase = require("./config/supabase");
const apiRoutes = require("./routes");

const app = express();
const PORT = process.env.PORT || 9999;

app.use(compression());

app.use(cors({
    origin: (origin, callback) => {
        // Cho phép các request từ trình duyệt cục bộ (localhost, 127.0.0.1) hoặc không có origin (như curl / Postman)
        if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            callback(null, true);
        } else {
            callback(null, true);
        }
    },
    credentials: true
}));

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
