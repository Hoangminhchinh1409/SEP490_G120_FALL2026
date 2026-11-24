const express = require("express");
const { getPublicBlogs, getPublicBlogById } = require("../controllers/blogController");

const router = express.Router();

router.get("/", getPublicBlogs);
router.get("/:id", getPublicBlogById);

module.exports = router;
