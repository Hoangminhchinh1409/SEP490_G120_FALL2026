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

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
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