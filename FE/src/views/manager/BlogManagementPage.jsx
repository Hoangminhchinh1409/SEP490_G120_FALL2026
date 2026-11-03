"use client";
import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { managerApi } from '../../api/managerApi';
import { BlogCreateEditModal } from './blog/BlogCreateEditModal';
import { BlogPreviewModal, BlogDeleteModal } from './blog/BlogModals';
import { BlogTableSection } from './blog/BlogTableSection';

export default function BlogManagementPage() {
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
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

  // Real-time calculations
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

      {/* Filtration Panel */}
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

      {/* Articles Table Component */}
      <BlogTableSection
        filteredArticles={filteredArticles}
        paginatedArticles={paginatedArticles}
        loading={loading}
        selectedIds={selectedIds}
        handleSelectAll={handleSelectAll}
        handleToggleSelect={handleToggleSelect}
        showToast={showToast}
        setDeleteConfirmTarget={setDeleteConfirmTarget}
        handlePublishAgain={handlePublishAgain}
        handleUnpublish={handleUnpublish}
        handleOpenEditModal={handleOpenEditModal}
        setPreviewArticle={setPreviewArticle}
        pageSize={pageSize}
        setPageSize={setPageSize}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
      />

      {/* Modal: Write / Edit Article */}
      <BlogCreateEditModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        newArticle={newArticle}
        setNewArticle={setNewArticle}
        handleSaveArticle={handleSaveArticle}
        setPreviewArticle={setPreviewArticle}
        showToast={showToast}
        fetchBlogs={fetchBlogs}
      />

      {/* Modal: Preview Article */}
      <BlogPreviewModal
        previewArticle={previewArticle}
        onClose={() => setPreviewArticle(null)}
        setDeleteConfirmTarget={setDeleteConfirmTarget}
        handleOpenEditModal={handleOpenEditModal}
      />

      {/* Modal: Delete Confirmation */}
      <BlogDeleteModal
        deleteConfirmTarget={deleteConfirmTarget}
        onClose={() => !isDeleting && setDeleteConfirmTarget(null)}
        isDeleting={isDeleting}
        handleBulkDelete={handleBulkDelete}
        handleDeleteArticle={handleDeleteArticle}
      />
    </div>
  );
}
