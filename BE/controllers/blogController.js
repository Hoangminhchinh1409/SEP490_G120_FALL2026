const supabase = require('../config/supabase');

/**
 * Blog Controller — Nhóm chức năng Tin tức Website & Quản lý Bản tin (UC-44 & UC-45 — Screen 45, 46, 47)
 * - Guest (UC-45): Xem danh sách bài viết đã xuất bản (PUBLISHED) & Xem chi tiết bài viết.
 * - Manager (UC-44): Quản lý bài viết (DRAFT ➔ PUBLISHED ➔ UNPUBLISHED, BR-48, MSG69, MSG25).
 */

// ==========================================
// A. PUBLIC WEBSITE NEWS (UC-45 - Screen 45)
// ==========================================

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

    const formatted = (blogs || []).map((b) => ({
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
    console.error('Get Public Blogs Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const getPublicBlogById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: currentBlog, error: fetchErr } = await supabase
      .from('blogs')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !currentBlog) {
      return res.status(404).json({ success: false, message: 'Bài viết không tồn tại' });
    }

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
    console.error('Get Public Blog Details Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

// ==========================================
// B. MANAGER BLOG MANAGEMENT (UC-44 - Screen 46 & Screen 47)
// ==========================================

const getBlogs = async (req, res) => {
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
};

const getBlogById = async (req, res) => {
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
};

const createBlog = async (req, res) => {
  try {
    const { title, summary, content, category, author, status, image } = req.body;

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
};

const updateBlog = async (req, res) => {
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
};

const updateBlogStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

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
};

const approveBlog = (req, res) => {
  req.body = { ...req.body, status: 'PUBLISHED' };
  return updateBlogStatus(req, res);
};

const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('blogs').delete().eq('id', id);
    if (error) throw error;

    return res.json({ message: 'Đã xóa bài viết thành công (MSG25).' });
  } catch (error) {
    console.error('deleteBlog Error:', error);
    return res.status(500).json({ message: 'Lỗi xóa bài viết', error: error.message });
  }
};

module.exports = {
  getPublicBlogs,
  getPublicBlogById,
  getBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  updateBlogStatus,
  approveBlog,
  deleteBlog
};
