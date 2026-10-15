const supabase = require("../config/supabase");

// Lấy danh sách bài viết đã xuất bản công khai
const getPublicBlogs = async (req, res) => {
    try {
        const { category, search } = req.query;
        let query = supabase
            .from('blogs')
            .select(`
                id, 
                title, 
                summary, 
                content, 
                category, 
                author, 
                author_initial, 
                author_color, 
                views, 
                published_at, 
                status, 
                status_label, 
                image_url
            `)
            .eq('status', 'PUBLISHED')
            .order('id', { ascending: false });

        if (category && category !== 'ALL' && category !== 'Tất cả') {
            query = query.eq('category', category);
        }

        if (search) {
            query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%,author.ilike.%${search}%`);
        }

        const { data: blogs, error } = await query;
        if (error) throw error;

        const formatted = (blogs || []).map(b => ({
            id: b.id,
            title: b.title,
            summary: b.summary,
            content: b.content,
            category: b.category,
            author: b.author,
            authorInitial: b.author_initial,
            authorColor: b.author_color,
            views: b.views,
            publishDate: b.published_at ? new Date(b.published_at).toLocaleDateString('vi-VN') : null,
            status: b.status,
            statusLabel: b.status_label,
            image: b.image_url
        }));

        return res.json({
            success: true,
            total: formatted.length,
            blogs: formatted
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

        const { data: currentBlog, error: fetchErr } = await supabase
            .from('blogs')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchErr || !currentBlog) {
            return res.status(404).json({ success: false, message: "Bài viết không tồn tại" });
        }

        // Tăng view
        await supabase
            .from('blogs')
            .update({ views: (currentBlog.views || 0) + 1 })
            .eq('id', id);

        return res.json({
            success: true,
            blog: {
                id: currentBlog.id,
                title: currentBlog.title,
                summary: currentBlog.summary,
                content: currentBlog.content,
                category: currentBlog.category,
                author: currentBlog.author,
                authorInitial: currentBlog.author_initial,
                authorColor: currentBlog.author_color,
                views: (currentBlog.views || 0) + 1,
                publishDate: currentBlog.published_at ? new Date(currentBlog.published_at).toLocaleDateString('vi-VN') : null,
                status: currentBlog.status,
                statusLabel: currentBlog.status_label,
                image: currentBlog.image_url
            }
        });
    } catch (error) {
        console.error("Get Public Blog Details Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

module.exports = {
    getPublicBlogs,
    getPublicBlogById
};
