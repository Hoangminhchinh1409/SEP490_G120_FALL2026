const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const pool = require("./config/db");
const apiRoutes = require("./routes");

const app = express();
const PORT = process.env.PORT || 9999;

app.use(cors({
    origin: "http://localhost:3000",
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
    res.json({ message: "NEXLOG Express Backend is running!" });
});

// Original routes
const managerRoutes = require("./routes/managerRoutes");
app.use("/api/manager", managerRoutes);

// Chi's new API routes
app.use("/api", apiRoutes);

app.listen(PORT, async () => {
    try {
        await pool.query("SELECT 1");
        console.log("PostgreSQL connected successfully!");
    } catch (error) {
        console.error("PostgreSQL connection failed:", error.message);
    }
    console.log(`Server running at http://localhost:${PORT}`);
});