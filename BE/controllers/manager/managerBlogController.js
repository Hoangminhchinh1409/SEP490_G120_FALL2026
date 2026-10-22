const supabase = require('../../config/supabase');

// 6. BLOGS: Quản lý bản tin & báo cáo chuyên ngành
const getBlogs = async (req, res) => {
    try {
        const { data: blogsList, error: bErr } = await supabase
            .from('blogs')
            .select('*')
            .order('id', { ascending: false });

        if (bErr) throw bErr;

        const totalBlogs = blogsList?.length || 0;
        const publishedBlogs = (blogsList || []).filter(b => b.status === 'PUBLISHED').length;
        const draftBlogs = (blogsList || []).filter(b => b.status === 'DRAFT').length;
        const pendingBlogs = (blogsList || []).filter(b => b.status === 'PENDING').length;
        const totalViews = (blogsList || []).reduce((sum, b) => sum + Number(b.views || 0), 0);

        const formatted = (blogsList || []).map(b => ({
            id: b.id,
            title: b.title,
            summary: b.summary,
            content: b.content,
            category: b.category,
            author: b.author,
            authorInitial: b.author_initial,
            authorColor: b.author_color,
            views: b.views,
            status: b.status,
            statusLabel: b.status_label,
            image: b.image_url,
            publishDate: b.published_at ? new Date(b.published_at).toLocaleDateString('vi-VN') : null
        }));

        return res.json({
            blogs: formatted,
            stats: {
                totalBlogs,
                publishedBlogs,
                draftBlogs,
                pendingBlogs,
                totalViews
            }
        });
    } catch (error) {
        console.error("Get Blogs Error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

const createBlog = async (req, res) => {
    try {
        const { title, summary, content, category, author, status, image } = req.body;
        const initial = (author || 'Q').charAt(0).toUpperCase();
        const statusText = status || 'PUBLISHED';
        const statusLabel = statusText === 'DRAFT' ? 'Bản nháp' : (statusText === 'PENDING' ? 'Chờ duyệt xuất bản' : 'Đã xuất bản');

        const { data: newBlog, error } = await supabase
            .from('blogs')
            .insert({
                title,
                summary: summary || '',
                content: content || '',
                category: category || 'Thị trường & Vận hành',
                author: author || 'Nguyễn Quản Lý',
                author_initial: initial,
                author_color: 'bg-secondary text-white',
                views: 0,
                status: statusText,
                status_label: statusLabel,
                image_url: image || null,
                published_at: statusText === 'PUBLISHED' ? new Date().toISOString() : null
            })
            .select('id, title, category, status, published_at')
            .single();

        if (error) throw error;

        return res.status(201).json({
            message: "Tạo bài viết thành công",
            blog: {
                ...newBlog,
                publishDate: newBlog.published_at ? new Date(newBlog.published_at).toLocaleDateString('vi-VN') : null
            }
        });
    } catch (error) {
        console.error("Create Blog Error:", error);
        return res.status(500).json({ message: "Lỗi tạo bài viết", error: error.message });
    }
};

const approveBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('blogs')
            .update({
                status: 'PUBLISHED',
                status_label: 'Đã xuất bản',
                published_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;
        return res.json({ message: "Duyệt xuất bản bài viết thành công" });
    } catch (error) {
        console.error("Approve Blog Error:", error);
        return res.status(500).json({ message: "Duyệt bài viết thất bại", error: error.message });
    }
};

const deleteBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('blogs').delete().eq('id', id);
        if (error) throw error;
        return res.json({ message: "Xoá bài viết thành công" });
    } catch (error) {
        console.error("Delete Blog Error:", error);
        return res.status(500).json({ message: "Xoá bài viết thất bại", error: error.message });
    }
};

const updateBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, summary, content, category, author, status, image } = req.body;
        const updatePayload = { updated_at: new Date().toISOString() };
        if (title !== undefined) updatePayload.title = title;
        if (summary !== undefined) updatePayload.summary = summary;
        if (content !== undefined) updatePayload.content = content;
        if (category !== undefined) updatePayload.category = category;
        if (author !== undefined) {
            updatePayload.author = author;
            updatePayload.author_initial = author.charAt(0).toUpperCase();
        }
        if (status !== undefined) {
            updatePayload.status = status;
            updatePayload.status_label = status === 'DRAFT' ? 'Bản nháp' : (status === 'PENDING' ? 'Chờ duyệt xuất bản' : 'Đã xuất bản');
            if (status === 'PUBLISHED') updatePayload.published_at = new Date().toISOString();
        }
        if (image !== undefined) updatePayload.image_url = image;

        const { data: updatedBlog, error } = await supabase
            .from('blogs')
            .update(updatePayload)
            .eq('id', id)
            .select('id, title, category, status, published_at')
            .single();

        if (error || !updatedBlog) {
            return res.status(404).json({ message: "Không tìm thấy bài viết để cập nhật" });
        }

        return res.json({
            message: "Cập nhật bài viết thành công",
            blog: {
                ...updatedBlog,
                publishDate: updatedBlog.published_at ? new Date(updatedBlog.published_at).toLocaleDateString('vi-VN') : null
            }
        });
    } catch (error) {
        console.error("Update Blog Error:", error);
        return res.status(500).json({ message: "Lỗi cập nhật bài viết", error: error.message });
    }
};

module.exports = {
  getBlogs,
  createBlog,
  updateBlog,
  approveBlog,
  deleteBlog
};