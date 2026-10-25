"use client";
import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Spin } from 'antd';
import { managerApi } from '../../api/managerApi';

export default function BlogManagementPage() {
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL'); // 'ALL', 'PUBLISHED', 'DRAFT', 'PENDING'
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Modals & toast
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [previewArticle, setPreviewArticle] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New Article Form State
  const initialArticleState = {
    id: null,
    title: '',
    category: 'Thị trường & Vận hành',
    author: 'Nguyễn Quản Lý',
    summary: '',
    content: '',
    image: '',
    status: 'PUBLISHED',
    is_featured: false
  };
  const [newArticle, setNewArticle] = useState(initialArticleState);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchBlogs = () => {
    setLoading(true);
    managerApi.getBlogs()
      .then(res => {
        const blogList = Array.isArray(res) ? res : (res?.blogs || []);
        setArticles(blogList);
      })
      .catch(error => {
        console.error('Lỗi khi tải danh sách tin tức:', error);
        showToast('Không thể kết nối máy chủ để lấy danh sách tin tức', 'error');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let isMounted = true;
    managerApi.getBlogs()
      .then(res => {
        const blogList = Array.isArray(res) ? res : (res?.blogs || []);
        if (isMounted) setArticles(blogList);
      })
      .catch(error => {
        console.error('Lỗi khi tải danh sách tin tức:', error);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  // Real-time calculations from PostgreSQL
  const totalBlogs = articles.length;
  const publishedCount = articles.filter(a => a.status === 'PUBLISHED').length;
  const draftCount = articles.filter(a => a.status === 'DRAFT').length;
  const unpublishedCount = articles.filter(a => a.status === 'UNPUBLISHED').length;
  const totalViews = articles.reduce((sum, a) => sum + (Number(a.views) || 0), 0);
  const publishedRate = totalBlogs > 0 ? ((publishedCount / totalBlogs) * 100).toFixed(1) : '0';

  // Filtered Articles
  const filteredArticles = useMemo(() => {
    return articles.filter(item => {
      if (selectedStatus === 'PUBLISHED' && item.status !== 'PUBLISHED') return false;
      if (selectedStatus === 'DRAFT' && item.status !== 'DRAFT') return false;
      if (selectedStatus === 'UNPUBLISHED' && item.status !== 'UNPUBLISHED') return false;

      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchCat = item.category?.toLowerCase().includes(q);
        const matchAuth = item.author?.toLowerCase().includes(q);
        return matchTitle || matchCat || matchAuth;
      }
      return true;
    });
  }, [articles, selectedStatus, selectedCategory, searchQuery]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedArticles = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredArticles.slice(start, start + pageSize);
  }, [filteredArticles, safeCurrentPage, pageSize]);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleStatusChange = (status) => {
    setSelectedStatus(status);
    setCurrentPage(1);
  };

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    setCurrentPage(1);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(paginatedArticles.map(a => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleOpenCreateModal = () => {
    setNewArticle(initialArticleState);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setNewArticle({
      id: item.id,
      title: item.title || '',
      category: item.category || 'Thị trường & Vận hành',
      author: item.author || 'Nguyễn Quản Lý',
      summary: item.summary || '',
      content: item.content || '',
      image: item.image || item.image_url || '',
      status: item.status || 'PUBLISHED',
      is_featured: Boolean(item.is_featured)
    });
    setIsCreateModalOpen(true);
  };

  const handleSaveArticle = async (e) => {
    e.preventDefault();
    if (!newArticle.title?.trim()) {
      showToast('Vui lòng nhập tiêu đề bài viết', 'error');
      return;
    }
    if (!newArticle.content?.trim()) {
      showToast('Vui lòng nhập nội dung bài viết', 'error');
      return;
    }

    try {
      const payload = {
        title: newArticle.title.trim(),
        summary: newArticle.summary || '',
        content: newArticle.content.trim(),
        category: newArticle.category,
        author: newArticle.author || 'Nguyễn Quản Lý',
        status: newArticle.status,
        image: newArticle.image || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
        is_featured: Boolean(newArticle.is_featured)
      };

      if (newArticle.id) {
        await managerApi.updateBlog(newArticle.id, payload);
        showToast('Cập nhật bài viết thành công!');
      } else {
        await managerApi.createBlog(payload);
        showToast('Đã thêm bài viết mới vào hệ thống thành công!');
      }

      setIsCreateModalOpen(false);
      setNewArticle(initialArticleState);
      fetchBlogs();
    } catch (err) {
      console.error('Lỗi lưu bài viết:', err);
      showToast(err.message || 'Lỗi khi lưu bài viết', 'error');
    }
  };

  const handleUnpublish = async (id) => {
    try {
      await managerApi.updateBlogStatus(id, 'UNPUBLISHED');
      showToast('Đã gỡ bài viết khỏi website thành công!');
      fetchBlogs();
    } catch (err) {
      console.error('Lỗi khi gỡ bài viết:', err);
      showToast(err.message || 'Lỗi khi gỡ bài viết', 'error');
    }
  };

  const handlePublishAgain = async (id) => {
    try {
      await managerApi.approveBlog(id);
      showToast('Đã đăng lại bài viết thành công lên website!');
      fetchBlogs();
    } catch (err) {
      console.error('Lỗi xuất bản bài viết:', err);
      showToast(err.message || 'Lỗi khi đăng bài viết', 'error');
    }
  };

  const handleDeleteArticle = async (id) => {
    try {
      setIsDeleting(true);
      await managerApi.deleteBlog(id);
      showToast('Đã xoá bài viết thành công khỏi hệ thống!');
      setSelectedIds(prev => prev.filter(x => x !== id));
      if (newArticle?.id === id) {
        setIsCreateModalOpen(false);
      }
      setDeleteConfirmTarget(null);
      fetchBlogs();
    } catch (err) {
      console.error('Lỗi xóa bài viết:', err);
      showToast(err.message || 'Lỗi khi xóa bài viết', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    try {
      setIsDeleting(true);
      await Promise.all(selectedIds.map(id => managerApi.deleteBlog(id)));
      showToast(`Đã xoá thành công ${selectedIds.length} bài viết đã chọn!`);
      setSelectedIds([]);
      setDeleteConfirmTarget(null);
      fetchBlogs();
    } catch (err) {
      console.error('Lỗi xóa hàng loạt bài viết:', err);
      showToast(err.message || 'Lỗi khi xóa các bài viết đã chọn', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col w-full space-y-space-lg text-on-surface">
      {/* Toast Alert Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl border animate-slide-up ${
          toastMessage.type === 'error' 
            ? 'bg-red-950/95 text-red-200 border-red-700/60' 
            : 'bg-slate-900/95 text-white border-blue-500/40'
        }`}>
          <span className="material-symbols-outlined text-[22px] text-secondary">
            {toastMessage.type === 'error' ? 'error' : 'task_alt'}
          </span>
          <span className="font-body-md text-sm font-medium">{toastMessage.msg}</span>
        </div>
      )}

      {/* Editorial Head Section */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-sm relative overflow-hidden border border-outline-variant/30">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-surface-container-low rounded-full pointer-events-none opacity-50 blur-2xl"></div>
        <div className="flex flex-col gap-space-xs z-10">
          <div className="flex items-center gap-space-sm flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-primary tracking-tight">
              Quản lý Tin Tức &amp; Bản Tin Chuyên Ngành
            </h1>
            <span className="px-3 py-1 rounded-full bg-surface-container-high text-secondary font-label-sm text-xs font-bold uppercase tracking-wider">
              Tổng: {articles.length} bài viết
            </span>
          </div>
          <p className="font-body-md text-sm text-on-surface-variant max-w-3xl">
            Hệ thống biên tập, kiểm duyệt và xuất bản các phân tích thị trường logistics, thông cáo báo chí, và cẩm nang vận tải hàng không.
          </p>
        </div>

        <div className="flex items-center gap-space-sm flex-wrap z-10 shrink-0">
          <Link
            href="/blog"
            target="_blank"
            className="inline-flex items-center gap-space-xs px-4 py-2.5 rounded-xl bg-surface-container-low text-primary font-label-lg text-sm font-semibold hover:bg-surface-container transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            <span>Xem trang Tin tức công khai</span>
          </Link>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-space-xs px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-lg text-sm font-bold hover:bg-primary-container active:scale-[0.99] transition-all shadow-sm cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            <span>+ Viết bài mới</span>
          </button>
        </div>
      </div>

      {/* Telemetry Metrics & Editorial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {/* Published Metric */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow relative overflow-hidden border border-outline-variant/30">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-xs text-outline uppercase tracking-wider font-semibold">Đã xuất bản (Live)</span>
            <span className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </span>
          </div>
          <div className="mt-space-md flex items-baseline justify-between">
            <div className="flex items-baseline gap-space-xs">
              <span className="text-3xl font-black text-primary">{publishedCount}</span>
              <span className="font-body-sm text-xs text-outline font-medium">bài viết</span>
            </div>
            <span className="font-data-mono text-xs text-secondary font-bold">{publishedRate}% tổng số</span>
          </div>
          <div className="w-full bg-surface-container-low h-1.5 rounded-full mt-space-md overflow-hidden">
            <div className="bg-secondary h-full rounded-full" style={{ width: `${publishedRate}%` }}></div>
          </div>
        </div>

        {/* Drafts Metric */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow relative overflow-hidden border border-outline-variant/30">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-xs text-outline uppercase tracking-wider font-semibold">Bản nháp / Đang biên tập</span>
            <span className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">edit_note</span>
            </span>
          </div>
          <div className="mt-space-md flex items-baseline justify-between">
            <div className="flex items-baseline gap-space-xs">
              <span className="text-3xl font-black text-on-surface">{draftCount}</span>
              <span className="font-body-sm text-xs text-outline font-medium">bản thảo</span>
            </div>
            <span className="font-data-mono text-xs text-outline font-semibold">{draftCount > 0 ? 'Cần hoàn thiện' : 'Đã hoàn tất'}</span>
          </div>
          <div className="w-full bg-surface-container-low h-1.5 rounded-full mt-space-md overflow-hidden">
            <div className="bg-outline h-full rounded-full" style={{ width: `${totalBlogs > 0 ? (draftCount / totalBlogs) * 100 : 0}%` }}></div>
          </div>
        </div>

        {/* Unpublished Metric */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow relative overflow-hidden border border-outline-variant/30">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-xs text-outline uppercase tracking-wider font-semibold">Đã gỡ khỏi website</span>
            <span className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-outline">
              <span className="material-symbols-outlined text-[18px]">visibility_off</span>
            </span>
          </div>
          <div className="mt-space-md flex items-baseline justify-between">
            <div className="flex items-baseline gap-space-xs">
              <span className="text-3xl font-black text-on-surface">{unpublishedCount}</span>
              <span className="font-body-sm text-xs text-outline font-medium">bài đã gỡ</span>
            </div>
            <span className="font-data-mono text-xs text-outline font-semibold">{unpublishedCount > 0 ? 'Có thể đăng lại' : 'Không có'}</span>
          </div>
          <div className="w-full bg-surface-container-low h-1.5 rounded-full mt-space-md overflow-hidden">
            <div className="bg-outline/50 h-full rounded-full" style={{ width: `${totalBlogs > 0 ? (unpublishedCount / totalBlogs) * 100 : 0}%` }}></div>
          </div>
        </div>

        {/* Monthly Readership Metric */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow relative overflow-hidden border border-outline-variant/30">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-xs text-outline uppercase tracking-wider font-semibold">Lượt xem thực tế</span>
            <span className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[18px]">trending_up</span>
            </span>
          </div>
          <div className="mt-space-md flex items-baseline justify-between">
            <div className="flex items-baseline gap-space-xs">
              <span className="text-3xl font-black text-primary">{totalViews.toLocaleString('vi-VN')}</span>
              <span className="font-body-sm text-xs text-outline font-medium">đọc</span>
            </div>
            <span className="font-data-mono text-xs text-secondary font-bold">Tổng lượt đọc</span>
          </div>
          <div className="w-full flex items-center gap-1 mt-space-md">
            <div className="h-1.5 flex-1 rounded bg-secondary"></div>
            <div className="h-1.5 flex-1 rounded bg-secondary"></div>
            <div className="h-1.5 flex-1 rounded bg-secondary"></div>
            <div className="h-1.5 flex-1 rounded bg-secondary opacity-75"></div>
            <div className="h-1.5 flex-1 rounded bg-surface-container-high"></div>
          </div>
        </div>
      </div>

      {/* Filtration Panel matching Figure 43 */}
      <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-outline-variant/30">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {/* (1) Trạng thái */}
          <div className="md:col-span-3 flex flex-col gap-1.5">
            <label className="text-xs font-bold text-outline uppercase tracking-wider">Trạng thái</label>
            <select
              value={selectedStatus}
              onChange={e => handleStatusChange(e.target.value)}
              className="w-full h-10 px-3 bg-surface-container-low rounded-xl text-xs font-medium text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-secondary cursor-pointer border border-transparent focus:border-secondary"
            >
              <option value="ALL">Tất cả ({articles.length})</option>
              <option value="PUBLISHED">Đã đăng ({publishedCount})</option>
              <option value="DRAFT">Bản nháp ({draftCount})</option>
              <option value="UNPUBLISHED">Đã gỡ ({unpublishedCount})</option>
            </select>
          </div>

          {/* (2) Chuyên mục */}
          <div className="md:col-span-4 flex flex-col gap-1.5">
            <label className="text-xs font-bold text-outline uppercase tracking-wider">Chuyên mục</label>
            <select
              value={selectedCategory}
              onChange={e => handleCategoryChange(e.target.value)}
              className="w-full h-10 px-3 bg-surface-container-low rounded-xl text-xs font-medium text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-secondary cursor-pointer border border-transparent focus:border-secondary"
            >
              <option value="ALL">Tất cả chuyên mục</option>
              <option value="Thị trường & Vận hành">Thị trường & Vận hành</option>
              <option value="Công nghệ & AI">Công nghệ & AI</option>
              <option value="Hạ tầng Ga hàng không">Hạ tầng Ga hàng không</option>
              <option value="Chính sách & Hải quan">Chính sách & Hải quan</option>
              <option value="Thông báo nội bộ">Thông báo nội bộ</option>
            </select>
          </div>

          {/* (3) Tìm kiếm tiêu đề */}
          <div className="md:col-span-5 flex flex-col gap-1.5">
            <label className="text-xs font-bold text-outline uppercase tracking-wider">Tìm kiếm</label>
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Tiêu đề bài viết..."
                className="w-full h-10 pl-9 pr-3 bg-surface-container-low rounded-xl text-xs text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-secondary transition-all border border-transparent focus:border-secondary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Articles Table Container */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col border border-outline-variant/30">
        {/* Header of the Table */}
        <div className="px-space-lg py-space-md bg-surface-container-low/60 flex items-center justify-between border-b border-surface-container">
          <div className="flex items-center gap-space-sm">
            <span className="font-label-lg text-sm text-primary font-bold">Danh sách Bản tin &amp; Báo cáo</span>
            <span className="px-2 py-0.5 rounded bg-surface-container-highest text-secondary font-data-mono text-xs font-semibold">
              {filteredArticles.length} bài viết
            </span>
          </div>
          <div className="flex items-center gap-space-sm">
            <button
              onClick={() => showToast('Đã kích hoạt bộ lọc chuyên sâu.')}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              title="Lọc chuyên sâu"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </button>
            <button
              onClick={() => showToast('Đang tải tệp báo cáo tin tức CSV...')}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              title="Xuất dữ liệu Excel/CSV"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">file_download</span>
            </button>
          </div>
        </div>

        {/* Data Grid matching Figure 43 (6 columns) */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-container-low text-outline font-label-sm text-xs uppercase tracking-wider border-b border-surface-container">
                <th className="py-3 px-space-lg">Tiêu đề</th>
                <th className="py-3 px-space-md w-52">Chuyên mục</th>
                <th className="py-3 px-space-md w-36">Trạng thái</th>
                <th className="py-3 px-space-md w-36">Ngày đăng</th>
                <th className="py-3 px-space-md w-28 text-right">Lượt xem</th>
                <th className="py-3 px-space-lg w-40 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container font-body-md text-xs text-on-surface">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-outline">
                    <Spin size="small" /> <span className="ml-2">Đang tải danh sách bài viết từ cơ sở dữ liệu...</span>
                  </td>
                </tr>
              ) : filteredArticles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-outline">
                    {articles.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-2 py-6">
                        <span className="material-symbols-outlined text-4xl text-outline/60">newspaper</span>
                        <span className="font-semibold text-sm text-on-surface">Chưa có bài viết nào trong cơ sở dữ liệu</span>
                        <span className="text-xs text-outline">Nhấn &quot;+ Viết bài mới&quot; ở trên để tạo bài viết đầu tiên</span>
                      </div>
                    ) : (
                      'Không tìm thấy bài viết nào phù hợp với bộ lọc hiện tại.'
                    )}
                  </td>
                </tr>
              ) : (
                paginatedArticles.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-container-low/50 transition-colors group">
                    <td className="py-space-md px-space-lg max-w-md">
                      <div className="flex flex-col min-w-0">
                        <button
                          onClick={() => setPreviewArticle(item)}
                          className="font-headline-sm text-xs font-bold text-primary hover:text-secondary truncate block text-left group-hover:text-secondary transition-colors cursor-pointer"
                          title={item.title}
                        >
                          {item.title}
                        </button>
                        {item.summary && (
                          <span className="font-body-sm text-[11px] text-outline truncate mt-0.5">{item.summary}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-space-md px-space-md">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm text-[11px] font-semibold truncate">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-space-md px-space-md">
                      {item.status === 'PUBLISHED' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-label-sm text-xs font-semibold border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          Đã đăng
                        </span>
                      ) : item.status === 'UNPUBLISHED' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-high text-outline font-label-sm text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
                          Đã gỡ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-label-sm text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          Bản nháp
                        </span>
                      )}
                    </td>
                    <td className="py-space-md px-space-md font-data-mono text-xs text-outline">
                      {item.status === 'DRAFT' ? '—' : (item.publishDate || '—')}
                    </td>
                    <td className="py-space-md px-space-md text-right font-data-mono text-xs font-bold text-primary">
                      {item.status === 'DRAFT' ? '—' : (item.views || 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-space-md px-space-lg text-right">
                      {/* Thao tác matching Figure 43: Sửa · Gỡ (Đã đăng), Sửa · Xóa (Bản nháp), Sửa · Đăng lại (Đã gỡ) */}
                      <div className="flex items-center justify-end gap-1.5 text-xs font-medium">
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="text-secondary hover:underline cursor-pointer font-semibold"
                          type="button"
                        >
                          Sửa
                        </button>
                        <span className="text-outline/40">·</span>
                        {item.status === 'PUBLISHED' ? (
                          <button
                            onClick={() => handleUnpublish(item.id)}
                            className="text-amber-700 hover:underline cursor-pointer"
                            type="button"
                          >
                            Gỡ
                          </button>
                        ) : item.status === 'UNPUBLISHED' ? (
                          <button
                            onClick={() => handlePublishAgain(item.id)}
                            className="text-emerald-700 hover:underline cursor-pointer font-semibold"
                            type="button"
                          >
                            Đăng lại
                          </button>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmTarget({ type: 'single', article: item })}
                            className="text-red-600 hover:underline cursor-pointer"
                            type="button"
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Performance Statistics Footer */}
        <div className="p-space-md bg-surface-container-lowest border-t border-surface-container flex flex-col md:flex-row items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-md">
            <span className="font-body-sm text-xs text-outline">
              Hiển thị <span className="font-semibold text-on-surface">
                {filteredArticles.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} - {Math.min(currentPage * pageSize, filteredArticles.length)}
              </span> trên tổng số <span className="font-semibold text-on-surface">{filteredArticles.length}</span> bài viết
            </span>
            <div className="h-4 w-[1px] bg-surface-container hidden sm:block"></div>
            <div className="hidden sm:flex items-center gap-space-xs font-label-sm text-xs text-outline">
              <span>Xem mỗi trang:</span>
              <select 
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-surface-container-low text-on-surface rounded px-2 py-0.5 border-0 focus:ring-1 focus:ring-secondary font-label-sm text-xs cursor-pointer"
              >
                <option value={10}>10 bài</option>
                <option value={20}>20 bài</option>
                <option value={50}>50 bài</option>
              </select>
            </div>
          </div>

          {/* Pagination Nav Controls */}
          <div className="flex items-center gap-space-xs">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container hover:text-on-surface disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed" 
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) {
                  acc.push('ellipsis-' + p);
                }
                acc.push(p);
                return acc;
              }, [])
              .map((item) => {
                if (typeof item === 'string') {
                  return <span key={item} className="w-6 text-center text-outline font-label-md text-xs">...</span>;
                }
                return (
                  <button
                    key={item}
                    onClick={() => setCurrentPage(item)}
                    className={`w-8 h-8 rounded-lg font-label-md text-xs font-bold cursor-pointer transition-colors ${
                      currentPage === item
                        ? 'bg-primary text-on-primary'
                        : 'text-on-surface-variant hover:bg-surface-container font-medium'
                    }`}
                    type="button"
                  >
                    {item}
                  </button>
                );
              })}
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container hover:text-on-surface disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed" 
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Write New Article */}
      {/* Modal: Write / Edit Article matching Figure 44 */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface-container-lowest w-full max-w-2xl rounded-2xl shadow-2xl border border-outline-variant/40 overflow-hidden flex flex-col">
            <div className="p-5 bg-surface-container-low border-b border-surface-container flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-lg text-primary">
                  {newArticle.id ? 'Sửa bài viết' : 'Viết bài'}
                </h3>
                <span className="px-3 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                  {newArticle.status === 'PUBLISHED' ? 'Đã đăng' : 'Bản nháp'}
                </span>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-outline hover:text-on-surface cursor-pointer p-1 rounded-lg hover:bg-surface-container"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveArticle} className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              {/* (1) Tiêu đề * */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-primary uppercase">Tiêu đề *</label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={newArticle.title}
                  onChange={e => setNewArticle({ ...newArticle, title: e.target.value })}
                  className="h-10 px-3 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-secondary border border-transparent focus:border-secondary"
                  placeholder="Nhập tiêu đề bài viết..."
                />
              </div>

              {/* (2) Chuyên mục * và (3) Ảnh bìa */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-primary uppercase">Chuyên mục *</label>
                  <select
                    value={newArticle.category}
                    onChange={e => setNewArticle({ ...newArticle, category: e.target.value })}
                    className="h-10 px-3 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-secondary cursor-pointer border border-transparent focus:border-secondary"
                  >
                    <option value="Chính sách & Hải quan">Chính sách & Hải quan</option>
                    <option value="Thị trường & Vận hành">Thị trường & Vận hành</option>
                    <option value="Công nghệ & AI">Công nghệ & AI</option>
                    <option value="Hạ tầng Ga hàng không">Hạ tầng Ga hàng không</option>
                    <option value="Thông báo nội bộ">Thông báo nội bộ</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-primary uppercase">Ảnh bìa</label>
                  <input
                    type="text"
                    value={newArticle.image}
                    onChange={e => setNewArticle({ ...newArticle, image: e.target.value })}
                    className="h-10 px-3 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-secondary border border-transparent focus:border-secondary"
                    placeholder="URL ảnh bìa (hoặc Cloudinary)..."
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-primary uppercase">Tóm tắt ngắn (Excerpt - Tối đa 200 ký tự)</label>
                  <span className={`text-[11px] font-mono ${newArticle.summary?.length > 200 ? 'text-red-500 font-bold' : 'text-outline'}`}>
                    {newArticle.summary?.length || 0}/200
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={200}
                  value={newArticle.summary}
                  onChange={e => setNewArticle({ ...newArticle, summary: e.target.value })}
                  className="p-3 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary resize-none"
                  placeholder="Mô tả tóm tắt ngắn gọn hiển thị tại thẻ tin tức danh sách..."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-primary uppercase">Nội dung chi tiết (Rich text / Markdown) *</label>
                <textarea
                  rows={6}
                  required
                  value={newArticle.content}
                  onChange={e => setNewArticle({ ...newArticle, content: e.target.value })}
                  className="p-3 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary resize-none font-mono"
                  placeholder="Soạn thảo nội dung chi tiết bài viết (hỗ trợ ### Tiêu đề mục, - Gạch đầu dòng, > Trích dẫn, **chữ in đậm**)..."
                />
              </div>

              {/* Checkbox Đặt làm bài nổi bật */}
              <div className="p-3 bg-surface-container-low rounded-xl flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-primary">
                  <input
                    type="checkbox"
                    checked={Boolean(newArticle.is_featured)}
                    onChange={e => setNewArticle({ ...newArticle, is_featured: e.target.checked })}
                    className="w-4 h-4 rounded text-secondary accent-secondary cursor-pointer"
                  />
                  <span>Đặt làm bài viết nổi bật (Hiển thị đầu trang chủ &amp; banner tin tức)</span>
                </label>
                <span className="text-[11px] text-outline">Featured Post</span>
              </div>

              {/* Action buttons (Screen 47: Lưu nháp, Xem trước, Đăng bài) */}
              <div className="flex flex-wrap justify-between items-center pt-3 border-t border-surface-container gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer"
                >
                  Hủy
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setPreviewArticle(newArticle);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface-container text-primary hover:bg-surface-container-high cursor-pointer transition-colors"
                  >
                    Xem trước
                  </button>

                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault();
                      if (!newArticle.title?.trim()) {
                        showToast('Vui lòng nhập tiêu đề bài viết', 'error');
                        return;
                      }
                      try {
                        const payload = { 
                          ...newArticle, 
                          content: newArticle.content?.trim() || 'Nội dung đang được soạn thảo...',
                          status: 'DRAFT',
                          is_featured: Boolean(newArticle.is_featured)
                        };
                        if (newArticle.id) await managerApi.updateBlog(newArticle.id, payload);
                        else await managerApi.createBlog(payload);
                        showToast('Đã lưu bản nháp thành công!');
                        setIsCreateModalOpen(false);
                        fetchBlogs();
                      } catch (err) {
                        showToast(err.message || 'Lỗi lưu bản nháp', 'error');
                      }
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-surface-container-low text-primary hover:bg-surface-container border border-surface-container cursor-pointer transition-colors"
                  >
                    Lưu bản nháp
                  </button>

                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault();
                      if (!newArticle.title?.trim() || !newArticle.content?.trim()) {
                        showToast('Vui lòng điền đủ Tiêu đề và Nội dung bài viết', 'error');
                        return;
                      }
                      try {
                        const payload = { 
                          ...newArticle, 
                          title: newArticle.title.trim(),
                          content: newArticle.content.trim(),
                          status: 'PUBLISHED',
                          is_featured: Boolean(newArticle.is_featured)
                        };
                        if (newArticle.id) await managerApi.updateBlog(newArticle.id, payload);
                        else await managerApi.createBlog(payload);
                        showToast('Đã xuất bản bài viết thành công!');
                        setIsCreateModalOpen(false);
                        fetchBlogs();
                      } catch (err) {
                        showToast(err.message || 'Lỗi đăng bài viết', 'error');
                      }
                    }}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-secondary text-on-secondary shadow-md hover:bg-secondary-container cursor-pointer transition-all"
                  >
                    Đăng bài
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Preview Article */}
      {previewArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface-container-lowest w-full max-w-2xl rounded-2xl shadow-2xl border border-outline-variant/40 overflow-hidden flex flex-col">
            <div className="p-4 bg-primary text-white flex items-center justify-between">
              <span className="font-bold text-sm">Xem trước Bản tin</span>
              <button onClick={() => setPreviewArticle(null)} className="text-white/80 hover:text-white cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              {previewArticle.image && (
                <img src={previewArticle.image} alt={previewArticle.title} className="w-full h-56 object-cover rounded-xl" />
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary font-bold text-xs">
                  {previewArticle.category}
                </span>
                {previewArticle.publishDate && (
                  <span className="text-xs text-outline font-data-mono">{previewArticle.publishDate}</span>
                )}
                <span className="text-xs text-outline">• Tác giả: <strong>{previewArticle.author || 'Ban Biên Tập'}</strong></span>
                {previewArticle.is_featured && (
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">
                    Nổi bật
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-primary">{previewArticle.title}</h2>
              {previewArticle.summary && (
                <p className="text-sm text-on-surface-variant leading-relaxed font-medium italic border-l-2 border-secondary pl-3">
                  {previewArticle.summary}
                </p>
              )}
              <div className="text-xs text-on-surface leading-relaxed whitespace-pre-line bg-surface-container-low/50 p-4 rounded-xl">
                {previewArticle.content || 'Nội dung bài viết đang được soạn thảo...'}
              </div>
            </div>
            <div className="p-4 bg-surface-container-low border-t border-outline-variant/30 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const target = previewArticle;
                  setPreviewArticle(null);
                  setDeleteConfirmTarget({ type: 'single', article: target });
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>Xoá bài viết</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = previewArticle;
                    setPreviewArticle(null);
                    handleOpenEditModal(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-surface-container text-primary hover:bg-surface-container-high cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  <span>Chỉnh sửa</span>
                </button>
                <button
                  onClick={() => setPreviewArticle(null)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white cursor-pointer"
                >
                  Đóng xem trước
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Modal: Delete Confirmation */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl border border-outline-variant/40 overflow-hidden flex flex-col">
            <div className="p-5 bg-red-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">delete_forever</span>
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Xác nhận xoá bài viết</h3>
                  <span className="text-[11px] text-red-100">Hành động này không thể hoàn tác</span>
                </div>
              </div>
              <button
                onClick={() => !isDeleting && setDeleteConfirmTarget(null)}
                className="text-white/80 hover:text-white cursor-pointer"
                disabled={isDeleting}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 flex flex-col gap-3">
              {deleteConfirmTarget.type === 'bulk' ? (
                <p className="text-sm text-on-surface leading-relaxed">
                  Bạn có chắc chắn muốn xoá vĩnh viễn <strong className="text-red-600">{deleteConfirmTarget.count}</strong> bài viết đã chọn? Toàn bộ nội dung bài viết sẽ bị xoá khỏi cơ sở dữ liệu.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-on-surface leading-relaxed">
                    Bạn có chắc chắn muốn xoá bài viết này không?
                  </p>
                  <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container">
                    <span className="font-bold text-xs text-primary line-clamp-2">
                      {deleteConfirmTarget.article?.title}
                    </span>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-outline">
                      <span>Chuyên mục: <strong>{deleteConfirmTarget.article?.category}</strong></span>
                      {deleteConfirmTarget.article?.id && (
                        <>
                          <span>•</span>
                          <span>ID: #{deleteConfirmTarget.article?.id}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-surface-container-low border-t border-surface-container flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirmTarget.type === 'bulk') {
                    handleBulkDelete();
                  } else {
                    handleDeleteArticle(deleteConfirmTarget.article?.id);
                  }
                }}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-red-600 text-white shadow-md hover:bg-red-700 cursor-pointer transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Spin size="small" />
                    <span>Đang xoá...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    <span>Xác nhận xoá</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
