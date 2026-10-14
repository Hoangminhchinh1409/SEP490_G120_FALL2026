const pool = require("../config/db");

// Lấy danh sách bài viết đã xuất bản công khai
const getPublicBlogs = async (req, res) => {
    try {
        const { category, search } = req.query;
        let query = `
            SELECT 
                id, 
                title, 
                summary, 
                content, 
                category, 
                author, 
                author_initial AS "authorInitial", 
                author_color AS "authorColor", 
                views, 
                TO_CHAR(published_at, 'DD.MM.YYYY') AS "publishDate", 
                status, 
                status_label AS "statusLabel", 
                image_url AS image
            FROM blogs 
            WHERE status = 'PUBLISHED'
        `;
        const params = [];

        if (category && category !== 'ALL' && category !== 'Tất cả') {
            params.push(category);
            query += ` AND category = $${params.length}`;
        }

        if (search) {
            params.push(`%${search.toLowerCase()}%`);
            query += ` AND (LOWER(title) LIKE $${params.length} OR LOWER(summary) LIKE $${params.length} OR LOWER(author) LIKE $${params.length})`;
        }

        query += ` ORDER BY id DESC`;

        const result = await pool.query(query, params);

        return res.json({
            success: true,
            total: result.rows.length,
            blogs: result.rows
        });
    } catch (error) {
        console.error("Get Public Blogs Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

// Lấy chi tiết một bài viết và tăng lượt xem
const getPublicBlogById = async (req, res) => {
    try {
        const { id } = req.params;

        // Tăng view
        await pool.query(`UPDATE blogs SET views = views + 1 WHERE id = $1`, [id]);

        const result = await pool.query(`
            SELECT 
                id, 
                title, 
                summary, 
                content, 
                category, 
                author, 
                author_initial AS "authorInitial", 
                author_color AS "authorColor", 
                views, 
                TO_CHAR(published_at, 'DD.MM.YYYY') AS "publishDate", 
                status, 
                status_label AS "statusLabel", 
                image_url AS image
            FROM blogs 
            WHERE id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy bài viết" });
        }

        // Lấy bài viết liên quan (cùng chuyên mục hoặc mới nhất khác id này)
        const currentBlog = result.rows[0];
        const relatedResult = await pool.query(`
            SELECT 
                id, 
                title, 
                summary, 
                category, 
                author, 
                views, 
                TO_CHAR(published_at, 'DD.MM.YYYY') AS "publishDate", 
                image_url AS image
            FROM blogs 
            WHERE status = 'PUBLISHED' AND id != $1
            ORDER BY (category = $2) DESC, id DESC
            LIMIT 3
        `, [id, currentBlog.category]);

        return res.json({
            success: true,
            blog: currentBlog,
            related: relatedResult.rows
        });
    } catch (error) {
        console.error("Get Public Blog By ID Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

module.exports = {
    getPublicBlogs,
    getPublicBlogById
};
