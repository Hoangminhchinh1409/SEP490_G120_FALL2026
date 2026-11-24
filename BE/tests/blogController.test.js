const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const prismaConfigPath = require.resolve(path.resolve(__dirname, '../config/prisma'));
const blogControllerPath = require.resolve(path.resolve(__dirname, '../controllers/blogController'));

let currentMockPrisma = () => {
  throw new Error('prisma mock not configured');
};

require.cache[prismaConfigPath] = {
  id: prismaConfigPath,
  filename: prismaConfigPath,
  loaded: true,
  exports: new Proxy(
    {},
    {
      get(_target, prop) {
        return currentMockPrisma()[prop];
      }
    }
  )
};

delete require.cache[blogControllerPath];
const blogController = require('../controllers/blogController');

const createMockRes = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  }
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Blog Controller - Luồng Bảng Tin & Tin Tức (news_posts)', () => {
  let dbRows;
  let userRows;

  beforeEach(() => {
    userRows = [
      { id: 20, full_name: 'Nguyễn Hoàng Sơn', username: 'nhsonn', role_id: 2 }
    ];

    dbRows = [
      {
        id: 1,
        author_id: 20,
        title: 'Bài viết A',
        summary: 'Tóm tắt A',
        content: 'Nội dung A',
        category: 'Thị trường & Vận hành',
        view_count: 10,
        published_time: '2026-11-10T08:00:00.000Z',
        created_at: '2026-11-10T07:00:00.000Z',
        updated_at: '2026-11-10T07:00:00.000Z',
        status: 'PUBLISHED',
        is_featured: true,
        cover_image_link: 'https://example.com/a.jpg'
      },
      {
        id: 2,
        author_id: 20,
        title: 'Bài viết B (Nháp)',
        summary: 'Tóm tắt B',
        content: 'Nội dung B',
        category: 'Thị trường & Vận hành',
        view_count: 3,
        published_time: null,
        created_at: '2026-11-11T07:00:00.000Z',
        updated_at: '2026-11-11T07:00:00.000Z',
        status: 'DRAFT',
        is_featured: false,
        cover_image_link: null
      },
      {
        id: 3,
        author_id: 20,
        title: 'Bài liên quan 1',
        summary: 'Tóm tắt 3',
        content: 'Nội dung 3',
        category: 'Thị trường & Vận hành',
        view_count: 5,
        published_time: '2026-11-12T08:00:00.000Z',
        created_at: '2026-11-12T07:00:00.000Z',
        updated_at: '2026-11-12T07:00:00.000Z',
        status: 'PUBLISHED',
        is_featured: false,
        cover_image_link: null
      },
      {
        id: 4,
        author_id: 20,
        title: 'Bài liên quan 2',
        summary: 'Tóm tắt 4',
        content: 'Nội dung 4',
        category: 'Thị trường & Vận hành',
        view_count: 7,
        published_time: '2026-11-13T08:00:00.000Z',
        created_at: '2026-11-13T07:00:00.000Z',
        updated_at: '2026-11-13T07:00:00.000Z',
        status: 'PUBLISHED',
        is_featured: false,
        cover_image_link: null
      },
      {
        id: 5,
        author_id: 20,
        title: 'Bài liên quan 3',
        summary: 'Tóm tắt 5',
        content: 'Nội dung 5',
        category: 'Thị trường & Vận hành',
        view_count: 9,
        published_time: '2026-11-14T08:00:00.000Z',
        created_at: '2026-11-14T07:00:00.000Z',
        updated_at: '2026-11-14T07:00:00.000Z',
        status: 'PUBLISHED',
        is_featured: false,
        cover_image_link: null
      },
      {
        id: 6,
        author_id: 20,
        title: 'Bài liên quan 4',
        summary: 'Tóm tắt 6',
        content: 'Nội dung 6',
        category: 'Thị trường & Vận hành',
        view_count: 11,
        published_time: '2026-11-15T08:00:00.000Z',
        created_at: '2026-11-15T07:00:00.000Z',
        updated_at: '2026-11-15T07:00:00.000Z',
        status: 'PUBLISHED',
        is_featured: false,
        cover_image_link: null
      },
      {
        id: 7,
        author_id: 20,
        title: 'Bài chuyên mục khác',
        summary: 'Tóm tắt 7',
        content: 'Nội dung 7',
        category: 'Công nghệ & AI',
        view_count: 20,
        published_time: '2026-11-15T08:00:00.000Z',
        created_at: '2026-11-15T07:00:00.000Z',
        updated_at: '2026-11-15T07:00:00.000Z',
        status: 'PUBLISHED',
        is_featured: false,
        cover_image_link: null
      }
    ];

    const attachUsers = (row) => {
      const u = userRows.find((usr) => Number(usr.id) === Number(row.author_id));
      return { ...row, users: u ? { id: u.id, full_name: u.full_name, username: u.username } : null };
    };

    const matchesWhere = (r, where = {}) => {
      for (const [k, cond] of Object.entries(where)) {
        if (k === 'OR') {
          const hit = cond.some((sub) => matchesWhere(r, sub));
          if (!hit) return false;
          continue;
        }
        if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
          if (cond.in && !cond.in.map(String).includes(String(r[k]))) return false;
          if (cond.not !== undefined && String(r[k]) === String(cond.not)) return false;
          if (cond.equals !== undefined) {
            const a = String(r[k] ?? '');
            const b = String(cond.equals);
            if (cond.mode === 'insensitive' ? a.toLowerCase() !== b.toLowerCase() : a !== b) return false;
          }
          if (cond.contains !== undefined) {
            const a = String(r[k] ?? '');
            const b = String(cond.contains);
            const ok = cond.mode === 'insensitive'
              ? a.toLowerCase().includes(b.toLowerCase())
              : a.includes(b);
            if (!ok) return false;
          }
        } else if (String(r[k]) !== String(cond)) {
          return false;
        }
      }
      return true;
    };

    const mockDb = {
      users: {
        async findFirst() {
          return userRows[0] || null;
        }
      },
      news_posts: {
        async findMany({ where = {}, orderBy, take } = {}) {
          let rows = dbRows.filter((r) => matchesWhere(r, where)).map(attachUsers);
          if (orderBy?.id === 'desc') {
            rows.sort((a, b) => Number(b.id) - Number(a.id));
          }
          if (typeof take === 'number') {
            rows = rows.slice(0, take);
          }
          return rows;
        },
        async findFirst({ orderBy } = {}) {
          const sorted = [...dbRows].sort((a, b) =>
            orderBy?.id === 'desc' ? Number(b.id) - Number(a.id) : Number(a.id) - Number(b.id)
          );
          return sorted[0] || null;
        },
        async findUnique({ where }) {
          await delay(15);
          const found = dbRows.find((r) => Number(r.id) === Number(where.id));
          return found ? { ...attachUsers(found) } : null;
        },
        async create({ data }) {
          const nextId = dbRows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
          const created = {
            ...data,
            id: data.id ? Number(data.id) : nextId,
            author_id: Number(data.author_id)
          };
          dbRows.push(created);
          return attachUsers(created);
        },
        async update({ where, data }) {
          await delay(15);
          const idx = dbRows.findIndex((r) => Number(r.id) === Number(where.id));
          if (idx < 0) {
            const err = new Error('Record not found');
            err.code = 'P2025';
            throw err;
          }
          dbRows[idx] = { ...dbRows[idx], ...data };
          return attachUsers(dbRows[idx]);
        },
        async delete({ where }) {
          const idx = dbRows.findIndex((r) => Number(r.id) === Number(where.id));
          if (idx < 0) {
            const err = new Error('Record not found');
            err.code = 'P2025';
            throw err;
          }
          const [removed] = dbRows.splice(idx, 1);
          return removed;
        }
      }
    };

    currentMockPrisma = () => mockDb;
  });

  test('BUG-NWD-01: Guest không thể xem bài viết chưa xuất bản (DRAFT/UNPUBLISHED)', async () => {
    const req = { params: { id: '2' } };
    const res = createMockRes();
    await blogController.getPublicBlogById(req, res);

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { success: false, message: 'Bài viết không tồn tại' });
    assert.equal(dbRows.find((r) => r.id === 2).view_count, 3);
  });

  test('BUG-NWD-04: Hai request song song gọi GET /api/blogs/1 tăng đúng +2 lượt xem (10 -> 12)', async () => {
    const res1 = createMockRes();
    const res2 = createMockRes();

    await Promise.all([
      blogController.getPublicBlogById({ params: { id: '1' } }, res1),
      blogController.getPublicBlogById({ params: { id: '1' } }, res2)
    ]);

    assert.equal(res1.statusCode, 200);
    assert.equal(res2.statusCode, 200);
    assert.equal(res1.body.blog.views, 11);
    assert.equal(res2.body.blog.views, 12);
    assert.equal(dbRows.find((r) => r.id === 1).view_count, 12);
  });

  test('BUG-NWD-05: Lỗi DB/kết nối khác P2025 phải trả HTTP 500 thay vì 404', async () => {
    const origError = console.error;
    console.error = () => {};
    try {
      const prevDb = currentMockPrisma();
      currentMockPrisma = () => ({
        ...prevDb,
        news_posts: {
          ...prevDb.news_posts,
          async findUnique() {
            throw new Error('TypeError: fetch failed');
          }
        }
      });

      const res = createMockRes();
      await blogController.getPublicBlogById({ params: { id: '1' } }, res);

      assert.equal(res.statusCode, 500);
      assert.deepEqual(res.body, { success: false, message: 'Internal server error' });
    } finally {
      console.error = origError;
    }
  });

  test('BUG-NWD-05 (404 case): Không tìm thấy bài hoặc ID không hợp lệ trả về HTTP 404', async () => {
    const resNotFound = createMockRes();
    await blogController.getPublicBlogById({ params: { id: '999999' } }, resNotFound);
    assert.equal(resNotFound.statusCode, 404);
    assert.deepEqual(resNotFound.body, { success: false, message: 'Bài viết không tồn tại' });

    const resInvalidId = createMockRes();
    await blogController.getPublicBlogById({ params: { id: 'abc' } }, resInvalidId);
    assert.equal(resInvalidId.statusCode, 404);
    assert.deepEqual(resInvalidId.body, { success: false, message: 'Bài viết không tồn tại' });
  });

  test('BUG-NWD-06: Khi prisma ném exception, API trả HTTP 500 chung và không lộ error.message', async () => {
    const logged = [];
    const origError = console.error;
    console.error = (...args) => logged.push(args);
    try {
      const prevDb = currentMockPrisma();
      currentMockPrisma = () => ({
        ...prevDb,
        news_posts: {
          ...prevDb.news_posts,
          findUnique() {
            throw new Error('ECONNREFUSED sensitive-internal-host:5432');
          }
        }
      });

      const res = createMockRes();
      await blogController.getPublicBlogById({ params: { id: '1' } }, res);

      assert.equal(res.statusCode, 500);
      assert.deepEqual(res.body, { success: false, message: 'Internal server error' });
      assert.equal('error' in res.body, false);
      assert.equal(logged.length, 1);
    } finally {
      console.error = origError;
    }
  });

  test('BUG-NWD-07: Khi update lượt xem bị lỗi, ghi log server và trả views đúng dữ liệu DB cũ', async () => {
    const logged = [];
    const origError = console.error;
    console.error = (...args) => logged.push(args);
    try {
      const prevDb = currentMockPrisma();
      currentMockPrisma = () => ({
        ...prevDb,
        news_posts: {
          ...prevDb.news_posts,
          async update() {
            const err = new Error('permission denied for table news_posts');
            err.code = '42501';
            throw err;
          }
        }
      });

      const res = createMockRes();
      await blogController.getPublicBlogById({ params: { id: '1' } }, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.blog.views, 10);
      assert.equal(logged.length >= 1, true);
    } finally {
      console.error = origError;
    }
  });

  test('BUG-NWD-08: API chi tiết trả về trường related tối đa 3 bài PUBLISHED cùng chuyên mục (trừ bài hiện tại)', async () => {
    const res = createMockRes();
    await blogController.getPublicBlogById({ params: { id: '1' } }, res);

    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.body.related));
    assert.equal(res.body.related.length, 3);
    for (const rel of res.body.related) {
      assert.notEqual(rel.id, 1);
      assert.equal(rel.status, 'PUBLISHED');
      assert.equal(rel.category, 'Thị trường & Vận hành');
    }
  });

  test('getPublicBlogs: Trả về author từ users, is_featured và publishedAt/createdAt', async () => {
    const res = createMockRes();
    await blogController.getPublicBlogs({ query: {} }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    const article1 = res.body.blogs.find((b) => b.id === 1);
    assert.ok(article1);
    assert.equal(article1.author, 'Nguyễn Hoàng Sơn');
    assert.equal(article1.is_featured, true);
    assert.equal(article1.publishedAt, '2026-11-10T08:00:00.000Z');
    assert.equal(article1.createdAt, '2026-11-10T07:00:00.000Z');
  });

  test('createBlog: Đăng bài thành công với req.user.id vào news_posts', async () => {
    const req = {
      user: { id: 20 },
      body: {
        title: 'Tin mới kiểm thử',
        summary: 'Tóm tắt ngắn',
        content: 'Nội dung chi tiết bài viết',
        category: 'Công nghệ & AI',
        status: 'PUBLISHED',
        image: 'https://example.com/cover.jpg',
        is_featured: true
      }
    };
    const res = createMockRes();
    await blogController.createBlog(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.blog.title, 'Tin mới kiểm thử');
    assert.equal(res.body.blog.status, 'PUBLISHED');
    assert.equal(res.body.blog.is_featured, true);
    assert.equal(res.body.blog.author, 'Nguyễn Hoàng Sơn');
    assert.equal(res.body.blog.image, 'https://example.com/cover.jpg');
  });

  test('createBlog: Tự động xử lý lệch sequence khóa chính (P2002) bằng MAX(id) + 1', async () => {
    let simulatedSeq = 7; // Collides with id=7
    const prevDb = currentMockPrisma();
    currentMockPrisma = () => ({
      ...prevDb,
      news_posts: {
        ...prevDb.news_posts,
        async create({ data }) {
          const candidateId = data.id !== undefined ? Number(data.id) : simulatedSeq++;
          if (dbRows.some((r) => Number(r.id) === candidateId)) {
            const err = new Error('Unique constraint failed on id');
            err.code = 'P2002';
            throw err;
          }
          const created = { ...data, id: candidateId, author_id: Number(data.author_id) };
          dbRows.push(created);
          return { ...created, users: userRows[0] };
        }
      }
    });

    const req = {
      user: { id: 20 },
      body: {
        title: 'Bài viết sau khi sửa sequence',
        summary: 'Tóm tắt',
        content: 'Nội dung đầy đủ',
        category: 'Thị trường & Vận hành',
        status: 'PUBLISHED'
      }
    };
    const res = createMockRes();
    await blogController.createBlog(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.blog.id, 8);
  });

  test('updateBlog, updateBlogStatus & deleteBlog: Cập nhật, đổi trạng thái và xóa bài viết thành công', async () => {
    const updateRes = createMockRes();
    await blogController.updateBlog(
      { params: { id: '2' }, body: { title: 'Tiêu đề mới', is_featured: true } },
      updateRes
    );
    assert.equal(updateRes.statusCode, 200);
    assert.equal(updateRes.body.blog.title, 'Tiêu đề mới');
    assert.equal(updateRes.body.blog.is_featured, true);

    const statusRes = createMockRes();
    await blogController.updateBlogStatus(
      { params: { id: '2' }, body: { status: 'PUBLISHED' } },
      statusRes
    );
    assert.equal(statusRes.statusCode, 200);
    assert.equal(statusRes.body.blog.status, 'PUBLISHED');

    const delRes = createMockRes();
    await blogController.deleteBlog({ params: { id: '2' } }, delRes);
    assert.equal(delRes.statusCode, 200);
    assert.equal(dbRows.some((r) => r.id === 2), false);
  });
});
