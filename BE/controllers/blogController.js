const supabase = require('../config/supabase');

const blogViewLocks = new Map();

const withBlogViewLock = async (blogId, fn) => {
  const key = String(blogId);
  const prev = blogViewLocks.get(key) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  const chained = prev.catch(() => {}).then(() => next);
  blogViewLocks.set(key, chained);
  await prev.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (blogViewLocks.get(key) === chained) {
      blogViewLocks.delete(key);
    }
  }
};

const isValidBlogId = (id) => /^[1-9]\d*$/.test(String(id ?? '').trim());
const isNotFoundDbError = (err) => err?.code === 'PGRST116' || err?.code === '22P02';

const normalizeStatus = (status) => {
  const upper = String(status || 'DRAFT').trim().toUpperCase();
  if (['PUBLISHED', 'UNPUBLISHED', 'DRAFT'].includes(upper)) {
    return upper;
  }
  return 'DRAFT';
};

const getStatusLabel = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized === 'PUBLISHED') return 'Đã đăng';
  if (normalized === 'UNPUBLISHED') return 'Đã gỡ';
  return 'Bản nháp';
};

const extractMissingColumnName = (err) => {
  if (!err) return null;
  const msg = `${err.message || ''} ${err.details || ''} ${err.hint || ''}`;
  const pgrstMatch = msg.match(/Could not find the '([^']+)' column/i);
  if (pgrstMatch) return pgrstMatch[1];
  const pgMatch = msg.match(/column "([^"]+)" (?:of relation "[^"]+" )?does not exist/i);
  if (pgMatch) return pgMatch[1];
  return null;
};

const isDuplicatePrimaryKeyError = (err) => {
  if (!err) return false;
  const msg = `${err.message || ''} ${err.details || ''}`;
  return (
    err.code === '23505' ||
    /duplicate key value violates unique constraint/i.test(msg)
  );
};

const isNullIdError = (err) => {
  if (!err) return false;
  const msg = `${err.message || ''} ${err.details || ''}`;
  return err.code === '23502' && /\bid\b/i.test(msg);
};

const getNextNewsPostId = async () => {
  try {
    const { data, error } = await supabase
      .from('news_posts')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);
    if (error) return null;
    const maxId = Array.isArray(data) && data.length > 0 ? Number(data[0]?.id) || 0 : 0;
    return maxId + 1;
  } catch {
    return null;
  }
};

const safeInsertNewsPost = async (payload) => {
  const currentPayload = { ...payload };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabase
      .from('news_posts')
      .insert(currentPayload)
      .select('*, users(id, full_name, username)')
      .single();

    if (!error) {
      return { data, error: null };
    }

    const missingCol = extractMissingColumnName(error);
    if (missingCol && Object.prototype.hasOwnProperty.call(currentPayload, missingCol)) {
      delete currentPayload[missingCol];
      continue;
    }

    if (isDuplicatePrimaryKeyError(error) || isNullIdError(error)) {
      const nextId = await getNextNewsPostId();
      if (nextId !== null) {
        currentPayload.id =
          currentPayload.id !== undefined && Number(currentPayload.id) >= nextId
            ? Number(currentPayload.id) + 1
            : nextId;
        continue;
      }
    }

    return { data: null, error };
  }

  return { data: null, error: new Error('Exceeded retries while inserting news post') };
};

const safeUpdateNewsPost = async (postId, payload) => {
  const currentPayload = { ...payload };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (Object.keys(currentPayload).length === 0) {
      return await supabase
        .from('news_posts')
        .select('*, users(id, full_name, username)')
        .eq('id', postId)
        .single();
    }

    const { data, error } = await supabase
      .from('news_posts')
      .update(currentPayload)
      .eq('id', postId)
      .select('*, users(id, full_name, username)')
      .single();

    if (!error) {
      return { data, error: null };
    }

    const missingCol = extractMissingColumnName(error);
    if (missingCol && Object.prototype.hasOwnProperty.call(currentPayload, missingCol)) {
      delete currentPayload[missingCol];
      continue;
    }

    return { data: null, error };
  }

  return { data: null, error: new Error('Exceeded retries while updating news post') };
};

const resolveAuthorId = async (req) => {
  const reqUserId = Number(req?.user?.id || req?.body?.author_id);
  if (Number.isInteger(reqUserId) && reqUserId > 0) {
    return reqUserId;
  }

  try {
    const { data: users } = await supabase
      .from('users')
      .select('id, role_id')
      .in('role_id', [2, 1])
      .order('id', { ascending: true })
      .limit(1);
    if (Array.isArray(users) && users.length > 0 && users[0]?.id) {
      return Number(users[0].id);
    }
  } catch {
    return null;
  }
  return null;
};

const formatNewsPost = (b, viewsOverride) => {
  const authorName =
    b?.users?.full_name ||
    b?.users?.username ||
    b?.author ||
    'Ban Quản Trị NEXLOG';
  const status = normalizeStatus(b.status);
  const views =
    viewsOverride !== undefined
      ? viewsOverride
      : Number(b.view_count ?? b.views ?? 0) || 0;
  const publishedTime = b.published_time || b.published_at || null;
  const image = b.cover_image_link ?? b.image_url ?? null;

  return {
    id: b.id,
    author_id: b.author_id,
    title: b.title,
    summary: b.summary,
    content: b.content,
    category: b.category,
    author: authorName,
    authorInitial:
      b.author_initial ||
      authorName.trim().charAt(0).toUpperCase() ||
      'N',
    authorColor: b.author_color || 'bg-secondary text-white',
    views,
    publishDate: publishedTime
      ? new Date(publishedTime).toLocaleDateString('vi-VN')
      : null,
    publishedAt: publishedTime,
    createdAt: b.created_at || null,
    created_at: b.created_at || null,
    is_featured: Boolean(b.is_featured),
    status,
    statusLabel: getStatusLabel(status),
    image
  };
};

/**
 * Blog Controller — Nhóm chức năng Tin tức Website & Quản lý Bản tin
 * - Guest: Xem danh sách bài viết đã xuất bản (PUBLISHED) & Xem chi tiết bài viết.
 * - Manager: Quản lý bài viết trên bảng news_posts.
 */

// ==========================================
// A. PUBLIC WEBSITE NEWS
// ==========================================

const getPublicBlogs = async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = supabase
      .from('news_posts')
      .select('*, users(id, full_name, username)')
      .in('status', ['PUBLISHED', 'Published'])
      .order('id', { ascending: false });

    if (category && category !== 'ALL' && category !== 'Tất cả') {
      query = query.eq('category', category);
    }

    if (search) {
      const safeSearch = String(search).replace(/[,()]/g, ' ').trim();
      if (safeSearch) {
        query = query.or(`title.ilike.%${safeSearch}%,summary.ilike.%${safeSearch}%`);
      }
    }

    const { data: blogs, error } = await query;
    if (error) throw error;

    const formatted = (blogs || []).map((b) => formatNewsPost(b));

    return res.json({
      success: true,
      total: formatted.length,
      blogs: formatted
    });
  } catch (error) {
    console.error('Get Public Blogs Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getPublicBlogById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidBlogId(id)) {
      return res.status(404).json({ success: false, message: 'Bài viết không tồn tại' });
    }
    const blogId = String(id).trim();

    const result = await withBlogViewLock(blogId, async () => {
      const { data: currentBlog, error: fetchErr } = await supabase
        .from('news_posts')
        .select('*, users(id, full_name, username)')
        .eq('id', blogId)
        .single();

      if (fetchErr) {
        if (isNotFoundDbError(fetchErr)) {
          return { status: 404, body: { success: false, message: 'Bài viết không tồn tại' } };
        }
        console.error('Get Public Blog Details DB Error:', fetchErr);
        return { status: 500, body: { success: false, message: 'Internal server error' } };
      }

      if (!currentBlog || normalizeStatus(currentBlog.status) !== 'PUBLISHED') {
        return { status: 404, body: { success: false, message: 'Bài viết không tồn tại' } };
      }

      const currentViews = Number(currentBlog.view_count ?? currentBlog.views ?? 0) || 0;
      let finalViews = currentViews;
      try {
        const updateRes = await supabase
          .from('news_posts')
          .update({ view_count: currentViews + 1 })
          .eq('id', blogId);
        const updateErr = updateRes?.error;
        if (updateErr) {
          console.error('Update Blog Views Error:', updateErr);
        } else {
          finalViews = currentViews + 1;
        }
      } catch (updateEx) {
        console.error('Update Blog Views Exception:', updateEx);
      }

      return { currentBlog, finalViews };
    });

    if (result.status) {
      return res.status(result.status).json(result.body);
    }

    const { currentBlog, finalViews } = result;

    let related = [];
    if (currentBlog.category) {
      try {
        const { data: relatedBlogs, error: relatedErr } = await supabase
          .from('news_posts')
          .select('*, users(id, full_name, username)')
          .in('status', ['PUBLISHED', 'Published'])
          .eq('category', currentBlog.category)
          .neq('id', currentBlog.id)
          .order('id', { ascending: false })
          .limit(3);

        if (relatedErr) {
          console.error('Get Related Blogs Error:', relatedErr);
        } else if (Array.isArray(relatedBlogs)) {
          related = relatedBlogs.map((b) => formatNewsPost(b));
        }
      } catch (relEx) {
        console.error('Get Related Blogs Exception:', relEx);
      }
    }

    return res.json({
      success: true,
      blog: formatNewsPost(currentBlog, finalViews),
      related
    });
  } catch (error) {
    console.error('Get Public Blog Details Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==========================================
// B. MANAGER BLOG MANAGEMENT
// ==========================================

const getBlogs = async (req, res) => {
  try {
    const { status, category, search } = req.query;

    let query = supabase
      .from('news_posts')
      .select('*, users(id, full_name, username)')
      .order('id', { ascending: false });

    if (status && status !== 'ALL') {
      query = query.ilike('status', status);
    }
    if (category && category !== 'ALL') {
      query = query.eq('category', category);
    }
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data: blogsList, error } = await query;
    if (error) throw error;

    const formatted = (blogsList || []).map((b) => formatNewsPost(b));

    const totalBlogs = formatted.length;
    const publishedBlogs = formatted.filter((b) => b.status === 'PUBLISHED').length;
    const draftBlogs = formatted.filter((b) => b.status === 'DRAFT').length;
    const unpublishedBlogs = formatted.filter((b) => b.status === 'UNPUBLISHED').length;
    const totalViews = formatted.reduce((sum, b) => sum + Number(b.views || 0), 0);

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
    return res.status(500).json({ message: 'Lỗi khi tải danh sách tin tức' });
  }
};

const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidBlogId(id)) {
      return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
    }
    const { data: blog, error } = await supabase
      .from('news_posts')
      .select('*, users(id, full_name, username)')
      .eq('id', String(id).trim())
      .single();

    if (error) {
      if (isNotFoundDbError(error)) {
        return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
      }
      throw error;
    }

    if (!blog) {
      return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
    }

    return res.json({ blog: formatNewsPost(blog) });
  } catch (error) {
    console.error('getBlogById Error:', error);
    return res.status(500).json({ message: 'Lỗi tải chi tiết bài viết' });
  }
};

const createBlog = async (req, res) => {
  try {
    const { title, summary, content, category, status, image, is_featured } = req.body;

    if (!title?.trim() || !category?.trim() || !content?.trim()) {
      return res.status(400).json({
        message: 'Vui lòng điền đầy đủ các trường bắt buộc: Tiêu đề, Chuyên mục, Nội dung.'
      });
    }

    if (title.trim().length > 200) {
      return res.status(400).json({ message: 'Tiêu đề không được vượt quá 200 ký tự.' });
    }
    if (summary && summary.trim().length > 200) {
      return res.status(400).json({ message: 'Tóm tắt không được vượt quá 200 ký tự.' });
    }
    if (category.trim().length > 50) {
      return res.status(400).json({ message: 'Chuyên mục không được vượt quá 50 ký tự.' });
    }
    if (image && image.trim().length > 255) {
      return res.status(400).json({ message: 'Link ảnh bìa không được vượt quá 255 ký tự.' });
    }

    const rawStatus = status ? String(status).trim().toUpperCase() : 'DRAFT';
    if (!['PUBLISHED', 'UNPUBLISHED', 'DRAFT'].includes(rawStatus)) {
      return res.status(400).json({ message: 'Trạng thái bài viết không hợp lệ.' });
    }

    const authorId = await resolveAuthorId(req);
    if (!authorId) {
      return res.status(400).json({ message: 'Không xác định được tài khoản tác giả.' });
    }

    const nowIso = new Date().toISOString();
    const insertPayload = {
      author_id: authorId,
      title: title.trim(),
      summary: summary?.trim() || '',
      content: content.trim(),
      category: category.trim(),
      cover_image_link: image?.trim() || null,
      is_featured: Boolean(is_featured),
      view_count: 0,
      published_time: rawStatus === 'PUBLISHED' ? nowIso : null,
      status: rawStatus,
      created_at: nowIso,
      updated_at: nowIso
    };

    const { data: newBlog, error } = await safeInsertNewsPost(insertPayload);

    if (error) throw error;

    return res.status(201).json({
      message: rawStatus === 'PUBLISHED' ? 'Đăng bài viết thành công!' : 'Lưu bản nháp thành công!',
      blog: formatNewsPost(newBlog)
    });
  } catch (error) {
    console.error('createBlog Error:', error);
    return res.status(500).json({ message: 'Lỗi tạo bài viết' });
  }
};

const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidBlogId(id)) {
      return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
    }
    const blogId = String(id).trim();
    const { title, summary, content, category, status, image, is_featured } = req.body;

    if (title !== undefined && !title?.trim()) {
      return res.status(400).json({ message: 'Tiêu đề không được để trống.' });
    }
    if (title && title.trim().length > 200) {
      return res.status(400).json({ message: 'Tiêu đề không được vượt quá 200 ký tự.' });
    }
    if (summary && summary.trim().length > 200) {
      return res.status(400).json({ message: 'Tóm tắt không được vượt quá 200 ký tự.' });
    }
    if (category !== undefined && !category?.trim()) {
      return res.status(400).json({ message: 'Chuyên mục không được để trống.' });
    }
    if (category && category.trim().length > 50) {
      return res.status(400).json({ message: 'Chuyên mục không được vượt quá 50 ký tự.' });
    }
    if (image && image.trim().length > 255) {
      return res.status(400).json({ message: 'Link ảnh bìa không được vượt quá 255 ký tự.' });
    }
    if (content !== undefined && !content?.trim()) {
      return res.status(400).json({ message: 'Nội dung không được để trống.' });
    }

    let normalizedStatus;
    if (status !== undefined) {
      normalizedStatus = String(status).trim().toUpperCase();
      if (!['PUBLISHED', 'UNPUBLISHED', 'DRAFT'].includes(normalizedStatus)) {
        return res.status(400).json({ message: 'Trạng thái bài viết không hợp lệ.' });
      }
    }

    const nowIso = new Date().toISOString();
    const updatePayload = { updated_at: nowIso };
    if (title !== undefined) updatePayload.title = title.trim();
    if (summary !== undefined) updatePayload.summary = summary.trim();
    if (content !== undefined) updatePayload.content = content.trim();
    if (category !== undefined) updatePayload.category = category.trim();
    if (normalizedStatus !== undefined) {
      updatePayload.status = normalizedStatus;
      if (normalizedStatus === 'PUBLISHED') updatePayload.published_time = nowIso;
    }
    if (image !== undefined) updatePayload.cover_image_link = image?.trim() || null;
    if (is_featured !== undefined) updatePayload.is_featured = Boolean(is_featured);

    const { data: updatedBlog, error } = await safeUpdateNewsPost(blogId, updatePayload);

    if (error) {
      if (isNotFoundDbError(error)) {
        return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
      }
      throw error;
    }

    if (!updatedBlog) {
      return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
    }

    return res.json({
      message: 'Cập nhật bài viết thành công!',
      blog: formatNewsPost(updatedBlog)
    });
  } catch (error) {
    console.error('updateBlog Error:', error);
    return res.status(500).json({ message: 'Lỗi cập nhật bài viết' });
  }
};

const updateBlogStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidBlogId(id)) {
      return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
    }
    const rawStatus = req.body?.status ? String(req.body.status).trim().toUpperCase() : '';

    if (!['PUBLISHED', 'UNPUBLISHED', 'DRAFT'].includes(rawStatus)) {
      return res.status(400).json({ message: 'Trạng thái bài viết không hợp lệ.' });
    }

    const nowIso = new Date().toISOString();
    const updateData = {
      status: rawStatus,
      updated_at: nowIso
    };

    if (rawStatus === 'PUBLISHED') {
      updateData.published_time = nowIso;
    }

    const { data: updated, error } = await safeUpdateNewsPost(String(id).trim(), updateData);

    if (error) {
      if (isNotFoundDbError(error)) {
        return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
      }
      throw error;
    }

    if (!updated) {
      return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
    }

    const msg =
      rawStatus === 'PUBLISHED'
        ? 'Đã xuất bản bài viết lên trang tin tức NEXLOG thành công!'
        : rawStatus === 'UNPUBLISHED'
        ? 'Đã gỡ bài viết khỏi trang tin tức (có thể đăng lại bất kỳ lúc nào).'
        : 'Đã chuyển bài viết về Bản nháp.';

    return res.json({ message: msg, blog: formatNewsPost(updated) });
  } catch (error) {
    console.error('updateBlogStatus Error:', error);
    return res.status(500).json({ message: 'Lỗi đổi trạng thái bài viết' });
  }
};

const approveBlog = (req, res) => {
  req.body = { ...req.body, status: 'PUBLISHED' };
  return updateBlogStatus(req, res);
};

const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidBlogId(id)) {
      return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
    }
    const blogId = String(id).trim();
    const { error } = await supabase.from('news_posts').delete().eq('id', blogId);
    if (error) throw error;

    return res.json({ message: 'Đã xóa bài viết thành công.' });
  } catch (error) {
    console.error('deleteBlog Error:', error);
    return res.status(500).json({ message: 'Lỗi xóa bài viết' });
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
