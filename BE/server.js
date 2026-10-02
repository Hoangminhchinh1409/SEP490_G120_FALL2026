const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./config/db");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 9999;

app.use(cors({
    origin: "http://localhost:3000",
    credentials: true
}));

app.use(express.json());

app.get("/", (req, res) => {
    res.json({ message: "NEXLOG Backend is running!" });
});

app.use("/api/auth", authRoutes);

app.listen(PORT, async () => {
    try {
        await pool.query("SELECT 1");
        console.log("PostgreSQL connected successfully!");
    } catch (error) {
        console.error("PostgreSQL connection failed:", error.message);
    }

    console.log(`Server running at http://localhost:${PORT}`);
});