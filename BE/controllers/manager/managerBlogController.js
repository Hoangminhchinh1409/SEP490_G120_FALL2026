const supabase = require('../../config/supabase');

/**
 * Controller Quản lý Tin tức Website NEXLOG (UC-44 - Screen 46 & Screen 47)
 * - Vòng đời bài viết (BR-48): DRAFT (Bản nháp) ➔ PUBLISHED (Đã đăng) ➔ UNPUBLISHED (Đã gỡ - có thể đăng lại).
 * - 5 Chuyên mục chuẩn:
 *   1. Tin hoạt động ALS
 *   2. Thông báo vận tải hàng không
 *   3. Quy định & Thủ tục hải quan
 *   4. Dịch vụ chuỗi lạnh (Cold Chain)
 *   5. Tin khuyến mãi & Đối tác
 * - Validation: Tiêu đề ≤ 200 ký tự, Tóm tắt ≤ 200 ký tự, báo lỗi MSG69 nếu thiếu trường bắt buộc.
 */
const managerBlogController = {
  // 1. Danh sách bài viết (Screen 46)
  getBlogs: async (req, res) => {
    try {
      const { status, category, search } = req.query;

      let query = supabase
        .from('blogs')
        .select('*')
        .order('id', { ascending: false });

      if (status && status !== 'ALL') {
        query = query.eq('status', status);
      }
      if (category && category !== 'ALL') {
        query = query.eq('category', category);
      }
      if (search) {
        query = query.ilike('title', `%${search}%`);
      }

      const { data: blogsList, error } = await query;
      if (error) throw error;

      const totalBlogs = blogsList?.length || 0;
      const publishedBlogs = (blogsList || []).filter((b) => b.status === 'PUBLISHED').length;
      const draftBlogs = (blogsList || []).filter((b) => b.status === 'DRAFT').length;
      const unpublishedBlogs = (blogsList || []).filter((b) => b.status === 'UNPUBLISHED').length;
      const totalViews = (blogsList || []).reduce((sum, b) => sum + Number(b.views || 0), 0);

      const formatted = (blogsList || []).map((b) => ({
        id: b.id,
        title: b.title,
        summary: b.summary,
        content: b.content,
        category: b.category,
        author: b.author || 'Ban Truyền Thông ALS',
        authorInitial: b.author_initial || 'A',
        authorColor: b.author_color || 'bg-secondary text-white',
        views: b.views || 0,
        status: b.status || 'DRAFT',
        statusLabel:
          b.status === 'PUBLISHED'
            ? 'Đã đăng'
            : b.status === 'UNPUBLISHED'
            ? 'Đã gỡ'
            : 'Bản nháp',
        image: b.image_url,
        is_featured: Boolean(b.is_featured),
        publishDate: b.published_at ? new Date(b.published_at).toLocaleDateString('vi-VN') : null,
        created_at: b.created_at
      }));

      return res.json({
        blogs: formatted,
        stats: {
          totalBlogs,
          publishedBlogs,
          draftBlogs,
          unpublishedBlogs,
          totalViews
        }
      });
    } catch (error) {
      console.error('getBlogs Error:', error);
      return res.status(500).json({ message: 'Lỗi khi tải danh sách tin tức', error: error.message });
    }
  },

  // 2. Chi tiết bài viết
  getBlogById: async (req, res) => {
    try {
      const { id } = req.params;
      const { data: blog, error } = await supabase
        .from('blogs')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !blog) {
        return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
      }

      return res.json({ blog });
    } catch (error) {
      console.error('getBlogById Error:', error);
      return res.status(500).json({ message: 'Lỗi tải chi tiết bài viết', error: error.message });
    }
  },

  // 3. Tạo mới bài viết (Screen 47)
  createBlog: async (req, res) => {
    try {
      const { title, summary, content, category, author, status, image, is_featured } = req.body;

      // MSG69: Bắt buộc tiêu đề, chuyên mục, nội dung
      if (!title?.trim() || !category?.trim() || !content?.trim()) {
        return res.status(400).json({
          message: 'Vui lòng điền đầy đủ các trường bắt buộc: Tiêu đề, Chuyên mục, Nội dung (MSG69).'
        });
      }

      if (title.length > 200) {
        return res.status(400).json({ message: 'Tiêu đề không được vượt quá 200 ký tự (Screen 47).' });
      }
      if (summary && summary.length > 200) {
        return res.status(400).json({ message: 'Tóm tắt không được vượt quá 200 ký tự (Screen 47).' });
      }

      const statusVal = status || 'DRAFT';
      const initial = (author || 'M').charAt(0).toUpperCase();

      const { data: newBlog, error } = await supabase
        .from('blogs')
        .insert({
          title: title.trim(),
          summary: summary?.trim() || '',
          content: content.trim(),
          category: category.trim(),
          author: author || 'Ban Quản Trị NEXLOG',
          author_initial: initial,
          author_color: 'bg-secondary text-white',
          views: 0,
          status: statusVal,
          status_label: statusVal === 'PUBLISHED' ? 'Đã đăng' : 'Bản nháp',
          image_url: image || null,
          published_at: statusVal === 'PUBLISHED' ? new Date().toISOString() : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({
        message: statusVal === 'PUBLISHED' ? 'Đăng bài viết thành công (MSG25)!' : 'Lưu bản nháp thành công!',
        blog: newBlog
      });
    } catch (error) {
      console.error('createBlog Error:', error);
      return res.status(500).json({ message: 'Lỗi tạo bài viết', error: error.message });
    }
  },

  // 4. Cập nhật bài viết (Screen 47)
  updateBlog: async (req, res) => {
    try {
      const { id } = req.params;
      const { title, summary, content, category, author, status, image } = req.body;

      if (title && title.length > 200) {
        return res.status(400).json({ message: 'Tiêu đề không được vượt quá 200 ký tự.' });
      }

      const updatePayload = { updated_at: new Date().toISOString() };
      if (title !== undefined) updatePayload.title = title.trim();
      if (summary !== undefined) updatePayload.summary = summary.trim();
      if (content !== undefined) updatePayload.content = content.trim();
      if (category !== undefined) updatePayload.category = category.trim();
      if (author !== undefined) {
        updatePayload.author = author;
        updatePayload.author_initial = author.charAt(0).toUpperCase();
      }
      if (status !== undefined) {
        updatePayload.status = status;
        updatePayload.status_label =
          status === 'PUBLISHED'
            ? 'Đã đăng'
            : status === 'UNPUBLISHED'
            ? 'Đã gỡ'
            : 'Bản nháp';
        if (status === 'PUBLISHED') updatePayload.published_at = new Date().toISOString();
      }
      if (image !== undefined) updatePayload.image_url = image;

      const { data: updatedBlog, error } = await supabase
        .from('blogs')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return res.json({ message: 'Cập nhật bài viết thành công (MSG25)!', blog: updatedBlog });
    } catch (error) {
      console.error('updateBlog Error:', error);
      return res.status(500).json({ message: 'Lỗi cập nhật bài viết', error: error.message });
    }
  },

  // 5. Đổi trạng thái bài viết (Đăng bài, Gỡ bài, Đăng lại - BR-48)
  updateBlogStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body; // 'PUBLISHED', 'UNPUBLISHED', 'DRAFT'

      if (!['PUBLISHED', 'UNPUBLISHED', 'DRAFT'].includes(status)) {
        return res.status(400).json({ message: 'Trạng thái bài viết không hợp lệ (BR-48).' });
      }

      const updateData = {
        status,
        status_label:
          status === 'PUBLISHED'
            ? 'Đã đăng'
            : status === 'UNPUBLISHED'
            ? 'Đã gỡ'
            : 'Bản nháp',
        updated_at: new Date().toISOString()
      };

      if (status === 'PUBLISHED') {
        updateData.published_at = new Date().toISOString();
      }

      const { data: updated, error } = await supabase
        .from('blogs')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const msg =
        status === 'PUBLISHED'
          ? 'Đã xuất bản bài viết lên trang tin tức NEXLOG thành công!'
          : status === 'UNPUBLISHED'
          ? 'Đã gỡ bài viết khỏi trang tin tức (có thể đăng lại bất kỳ lúc nào).'
          : 'Đã chuyển bài viết về Bản nháp.';

      return res.json({ message: msg, blog: updated });
    } catch (error) {
      console.error('updateBlogStatus Error:', error);
      return res.status(500).json({ message: 'Lỗi đổi trạng thái bài viết', error: error.message });
    }
  },

  // 6. Xóa bài viết (Screen 46 - MSG24 / MSG25)
  deleteBlog: async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase.from('blogs').delete().eq('id', id);
      if (error) throw error;

      return res.json({ message: 'Đã xóa bài viết thành công (MSG25).' });
    } catch (error) {
      console.error('deleteBlog Error:', error);
      return res.status(500).json({ message: 'Lỗi xóa bài viết', error: error.message });
    }
  }
};

module.exports = managerBlogController;