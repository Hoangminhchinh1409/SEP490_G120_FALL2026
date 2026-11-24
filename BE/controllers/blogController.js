const prisma = require('../config/prisma');
const cloudinaryService = require('../services/cloudinaryService');
const { serializePrisma, toBigInt, toNum } = require('../utils/prismaHelper');

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
const isNotFoundDbError = (err) => err?.code === 'P2025' || err?.code === 'PGRST116' || err?.code === '22P02';

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

const getNextNewsPostId = async () => {
  try {
    const latest = await prisma.news_posts.findFirst({
      select: { id: true },
      orderBy: { id: 'desc' }
    });
    const maxId = latest ? Number(latest.id) || 0 : 0;
    return maxId + 1;
  } catch {
    return null;
  }
};

const safeInsertNewsPost = async (payload) => {
  const currentPayload = { ...payload };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const data = await prisma.news_posts.create({
        data: currentPayload,
        include: { users: { select: { id: true, full_name: true, username: true } } }
      });
      return { data: serializePrisma(data), error: null };
    } catch (error) {
      if (error?.code === 'P2002') {
        const nextId = await getNextNewsPostId();
        if (nextId !== null) {
          const curNum = Number(currentPayload.id || 0);
          currentPayload.id = BigInt(curNum >= nextId ? curNum + 1 : nextId);
          continue;
        }
      }
      return { data: null, error };
    }
  }

  return { data: null, error: new Error('Exceeded retries while inserting news post') };
};

const safeUpdateNewsPost = async (postId, payload) => {
  const bigId = BigInt(String(postId).trim());
  try {
    const data = await prisma.news_posts.update({
      where: { id: bigId },
      data: payload,
      include: { users: { select: { id: true, full_name: true, username: true } } }
    });
    return { data: serializePrisma(data), error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const resolveAuthorId = async (req) => {
  const reqUserId = Number(req?.user?.id || req?.body?.author_id);
  if (Number.isInteger(reqUserId) && reqUserId > 0) {
    return reqUserId;
  }

  try {
    const user = await prisma.users.findFirst({
      where: { role_id: { in: [2n, 1n] } },
      select: { id: true, role_id: true },
      orderBy: { id: 'asc' }
    });
    if (user?.id) {
      return Number(user.id);
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
    id: toNum(b.id),
    author_id: toNum(b.author_id),
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

// ==========================================
// A. PUBLIC WEBSITE NEWS
// ==========================================

const getPublicBlogs = async (req, res) => {
  try {
    const { category, search } = req.query;
    const where = {
      status: { in: ['PUBLISHED', 'Published'] }
    };

    if (category && category !== 'ALL' && category !== 'Tất cả') {
      where.category = category;
    }

    if (search) {
      const safeSearch = String(search).replace(/[,()]/g, ' ').trim();
      if (safeSearch) {
        where.OR = [
          { title: { contains: safeSearch, mode: 'insensitive' } },
          { summary: { contains: safeSearch, mode: 'insensitive' } }
        ];
      }
    }

    const blogs = await prisma.news_posts.findMany({
      where,
      include: { users: { select: { id: true, full_name: true, username: true } } },
      orderBy: { id: 'desc' }
    });

    const formatted = serializePrisma(blogs || []).map((b) => formatNewsPost(b));

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
    const bigBlogId = BigInt(blogId);

    const result = await withBlogViewLock(blogId, async () => {
      let currentBlog;
      try {
        currentBlog = await prisma.news_posts.findUnique({
          where: { id: bigBlogId },
          include: { users: { select: { id: true, full_name: true, username: true } } }
        });
      } catch (fetchErr) {
        if (isNotFoundDbError(fetchErr)) {
          return { status: 404, body: { success: false, message: 'Bài viết không tồn tại' } };
        }
        console.error('Get Public Blog Details DB Error:', fetchErr);
        return { status: 500, body: { success: false, message: 'Internal server error' } };
      }

      if (!currentBlog || normalizeStatus(currentBlog.status) !== 'PUBLISHED') {
        return { status: 404, body: { success: false, message: 'Bài viết không tồn tại' } };
      }

      const serializedBlog = serializePrisma(currentBlog);
      const currentViews = Number(serializedBlog.view_count ?? serializedBlog.views ?? 0) || 0;
      let finalViews = currentViews;
      try {
        await prisma.news_posts.update({
          where: { id: bigBlogId },
          data: { view_count: currentViews + 1 }
        });
        finalViews = currentViews + 1;
      } catch (updateEx) {
        console.error('Update Blog Views Exception:', updateEx);
      }

      return { currentBlog: serializedBlog, finalViews };
    });

    if (result.status) {
      return res.status(result.status).json(result.body);
    }

    const { currentBlog, finalViews } = result;

    let related = [];
    if (currentBlog.category) {
      try {
        const relatedBlogs = await prisma.news_posts.findMany({
          where: {
            status: { in: ['PUBLISHED', 'Published'] },
            category: currentBlog.category,
            id: { not: bigBlogId }
          },
          include: { users: { select: { id: true, full_name: true, username: true } } },
          orderBy: { id: 'desc' },
          take: 3
        });

        if (Array.isArray(relatedBlogs)) {
          related = serializePrisma(relatedBlogs).map((b) => formatNewsPost(b));
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
    const where = {};

    if (status && status !== 'ALL') {
      where.status = { equals: String(status).trim(), mode: 'insensitive' };
    }
    if (category && category !== 'ALL') {
      where.category = category;
    }
    if (search) {
      where.title = { contains: String(search).trim(), mode: 'insensitive' };
    }

    const blogsList = await prisma.news_posts.findMany({
      where,
      include: { users: { select: { id: true, full_name: true, username: true } } },
      orderBy: { id: 'desc' }
    });

    const formatted = serializePrisma(blogsList || []).map((b) => formatNewsPost(b));

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

    const blog = await prisma.news_posts.findUnique({
      where: { id: BigInt(String(id).trim()) },
      include: { users: { select: { id: true, full_name: true, username: true } } }
    });

    if (!blog) {
      return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
    }

    return res.json({ blog: formatNewsPost(serializePrisma(blog)) });
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

    let resolvedImage = image?.trim() || null;
    if (resolvedImage && resolvedImage.startsWith('data:')) {
      resolvedImage = await cloudinaryService.uploadDataUriIfNeeded(resolvedImage, 'nexlog/blogs');
    }
    if (resolvedImage && resolvedImage.length > 255) {
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

    const now = new Date();
    const insertPayload = {
      author_id: toBigInt(authorId),
      title: title.trim(),
      summary: summary?.trim() || '',
      content: content.trim(),
      category: category.trim(),
      cover_image_link: resolvedImage,
      is_featured: Boolean(is_featured),
      view_count: 0,
      published_time: rawStatus === 'PUBLISHED' ? now : null,
      status: rawStatus,
      created_at: now,
      updated_at: now
    };

    const { data: newBlog, error } = await safeInsertNewsPost(insertPayload);
    if (error) throw error;

    return res.status(201).json({
      message: rawStatus === 'PUBLISHED' ? 'Đăng bài viết thành công!' : 'Lưu bản nháp thành công!',
      blog: formatNewsPost(newBlog)
    });
  } catch (error) {
    console.error('createBlog Error:', error);
    return res.status(error.statusCode || 500).json({ message: error.message || 'Lỗi tạo bài viết' });
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

    let resolvedImage = image?.trim() || null;
    if (resolvedImage && resolvedImage.startsWith('data:')) {
      resolvedImage = await cloudinaryService.uploadDataUriIfNeeded(resolvedImage, 'nexlog/blogs');
    }
    if (resolvedImage && resolvedImage.length > 255) {
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

    const now = new Date();
    const updatePayload = { updated_at: now };
    if (title !== undefined) updatePayload.title = title.trim();
    if (summary !== undefined) updatePayload.summary = summary.trim();
    if (content !== undefined) updatePayload.content = content.trim();
    if (category !== undefined) updatePayload.category = category.trim();
    if (normalizedStatus !== undefined) {
      updatePayload.status = normalizedStatus;
      if (normalizedStatus === 'PUBLISHED') updatePayload.published_time = now;
    }
    if (image !== undefined) updatePayload.cover_image_link = resolvedImage;
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
    return res.status(error.statusCode || 500).json({ message: error.message || 'Lỗi cập nhật bài viết' });
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

    const now = new Date();
    const updateData = {
      status: rawStatus,
      updated_at: now
    };

    if (rawStatus === 'PUBLISHED') {
      updateData.published_time = now;
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
    await prisma.news_posts.delete({
      where: { id: BigInt(String(id).trim()) }
    });

    return res.json({ message: 'Đã xóa bài viết thành công.' });
  } catch (error) {
    if (isNotFoundDbError(error)) {
      return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
    }
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
