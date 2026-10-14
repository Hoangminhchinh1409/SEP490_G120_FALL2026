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
  const [isNotamModalOpen, setIsNotamModalOpen] = useState(false);
  const [previewArticle, setPreviewArticle] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // New Article Form State
  const initialArticleState = {
    id: null,
    title: '',
    category: 'Thị trường & Vận hành',
    author: 'Nguyễn Quản Lý',
    summary: '',
    content: '',
    image: '',
    status: 'PUBLISHED'
  };
  const [newArticle, setNewArticle] = useState(initialArticleState);

  // NOTAM Form State
  const [notamData, setNotamData] = useState({
    level: 'URGENT',
    title: '',
    content: ''
  });

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
  const pendingCount = articles.filter(a => a.status === 'PENDING').length;
  const totalViews = articles.reduce((sum, a) => sum + (Number(a.views) || 0), 0);
  const publishedRate = totalBlogs > 0 ? ((publishedCount / totalBlogs) * 100).toFixed(1) : '0';

  // Filtered Articles
  const filteredArticles = useMemo(() => {
    return articles.filter(item => {
      if (selectedStatus === 'PUBLISHED' && item.status !== 'PUBLISHED') return false;
      if (selectedStatus === 'DRAFT' && item.status !== 'DRAFT') return false;
      if (selectedStatus === 'PENDING' && item.status !== 'PENDING') return false;

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

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredArticles.map(a => a.id));
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
      status: item.status || 'PUBLISHED'
    });
    setIsCreateModalOpen(true);
  };

  const handleSaveArticle = async (e) => {
    e.preventDefault();
    if (!newArticle.title.trim()) {
      showToast('Vui lòng nhập tiêu đề bài viết', 'error');
      return;
    }

    try {
      const payload = {
        title: newArticle.title.trim(),
        summary: newArticle.summary || '',
        content: newArticle.content || '',
        category: newArticle.category,
        author: newArticle.author || 'Nguyễn Quản Lý',
        status: newArticle.status,
        image: newArticle.image || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80'
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

  const handleApprovePending = async (id) => {
    try {
      await managerApi.approveBlog(id);
      showToast('Đã duyệt và phát hành bài viết ngay lập tức!');
      fetchBlogs();
    } catch (err) {
      console.error('Lỗi duyệt bài viết:', err);
      showToast(err.message || 'Lỗi khi phê duyệt bài viết', 'error');
    }
  };

  const handleDeleteArticle = async (id) => {
    try {
      await managerApi.deleteBlog(id);
      showToast('Đã lưu trữ / gỡ bài viết khỏi hệ thống!');
      fetchBlogs();
    } catch (err) {
      console.error('Lỗi xóa bài viết:', err);
      showToast(err.message || 'Lỗi khi xóa bài viết', 'error');
    }
  };

  const handleSendNotam = (e) => {
    e.preventDefault();
    if (!notamData.title.trim()) {
      showToast('Vui lòng nhập tiêu đề phát tin khẩn NOTAM', 'error');
      return;
    }
    setIsNotamModalOpen(false);
    showToast(`Đã phát lệnh NOTAM tới toàn bộ tài xế và đối tác kho bãi!`);
    setNotamData({ level: 'URGENT', title: '', content: '' });
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

        {/* Pending Review Metric */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow relative overflow-hidden border border-outline-variant/30">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-xs text-on-tertiary-container uppercase tracking-wider font-semibold">Chờ duyệt xuất bản</span>
            <span className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-on-tertiary-container">
              <span className="material-symbols-outlined text-[18px]">rate_review</span>
            </span>
          </div>
          <div className="mt-space-md flex items-baseline justify-between">
            <div className="flex items-baseline gap-space-xs">
              <span className="text-3xl font-black text-primary">{pendingCount}</span>
              <span className="font-body-sm text-xs text-outline font-medium">bài cần xét</span>
            </div>
            <span className={`px-2 py-0.5 rounded font-label-sm text-xs font-bold ${pendingCount > 0 ? 'bg-orange-100 text-orange-700' : 'bg-surface-container text-outline'}`}>
              {pendingCount > 0 ? 'Cần duyệt' : 'Đã duyệt hết'}
            </span>
          </div>
          <div className="w-full bg-surface-container-low h-1.5 rounded-full mt-space-md overflow-hidden">
            <div className="bg-on-tertiary-container h-full rounded-full" style={{ width: `${totalBlogs > 0 ? (pendingCount / totalBlogs) * 100 : 0}%` }}></div>
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

      {/* Filtration Panel & Category Bar */}
      <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-space-md border border-outline-variant/30">
        {/* Search and Status Tabs */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-space-md">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none">manage_search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tiêu đề, từ khóa chuyên ngành, tác giả..."
              className="w-full h-10 pl-10 pr-space-md bg-surface-container-low rounded-xl font-body-sm text-xs text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-secondary transition-all"
            />
          </div>

          {/* Quick Status Filters */}
          <div className="flex items-center gap-space-xs bg-surface-container-low p-1 rounded-xl self-start md:self-auto overflow-x-auto max-w-full">
            <button
              onClick={() => setSelectedStatus('ALL')}
              className={`px-3 py-1.5 rounded-lg font-label-md text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                selectedStatus === 'ALL'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              Tất cả ({articles.length})
            </button>
            <button
              onClick={() => setSelectedStatus('PUBLISHED')}
              className={`px-3 py-1.5 rounded-lg font-label-md text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                selectedStatus === 'PUBLISHED'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              Đã xuất bản (58)
            </button>
            <button
              onClick={() => setSelectedStatus('DRAFT')}
              className={`px-3 py-1.5 rounded-lg font-label-md text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                selectedStatus === 'DRAFT'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              Bản nháp (7)
            </button>
            <button
              onClick={() => setSelectedStatus('PENDING')}
              className={`px-3 py-1.5 rounded-lg font-label-md text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                selectedStatus === 'PENDING'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              Chờ duyệt xuất bản (3)
            </button>
          </div>
        </div>

        {/* Horizontal Category Selector Chips */}
        <div className="flex items-center gap-space-xs overflow-x-auto py-0.5 no-scrollbar border-t border-surface-container-low pt-space-sm">
          <span className="font-label-sm text-xs text-outline uppercase tracking-wider shrink-0 mr-space-xs font-semibold">Chuyên mục:</span>
          {[
            { key: 'ALL', label: 'Tất cả chuyên mục' },
            { key: 'Thị trường & Vận hành', label: 'Thị trường & Vận hành' },
            { key: 'Công nghệ & AI Chuỗi cung ứng', label: 'Công nghệ & AI Chuỗi cung ứng' },
            { key: 'Hạ tầng Ga hàng không', label: 'Hạ tầng Ga hàng không' },
            { key: 'Chính sách & Hải quan', label: 'Chính sách & Hải quan' },
            { key: 'Thông báo nội bộ', label: 'Thông báo nội bộ' }
          ].map(cat => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3 py-1 rounded-full font-label-sm text-xs font-medium shrink-0 transition-colors cursor-pointer ${
                selectedCategory === cat.key
                  ? 'bg-primary text-on-primary font-semibold'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              }`}
              type="button"
            >
              {cat.label}
            </button>
          ))}
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

        {/* Responsive Scrollable Data Grid */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[1020px]">
            <thead>
              <tr className="bg-surface-container-low text-outline font-label-sm text-xs uppercase tracking-wider">
                <th className="py-space-sm px-space-lg w-12 text-center">
                  <input
                    checked={selectedIds.length === filteredArticles.length && filteredArticles.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded bg-surface-container-lowest text-primary accent-primary cursor-pointer"
                    type="checkbox"
                  />
                </th>
                <th className="py-space-sm px-space-md">Hình ảnh &amp; Tiêu đề bài viết</th>
                <th className="py-space-sm px-space-md w-44">Chuyên mục</th>
                <th className="py-space-sm px-space-md w-48">Tác giả</th>
                <th className="py-space-sm px-space-md w-28 text-right">Lượt đọc</th>
                <th className="py-space-sm px-space-md w-36">Ngày đăng</th>
                <th className="py-space-sm px-space-md w-44">Trạng thái</th>
                <th className="py-space-sm px-space-lg w-32 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container font-body-md text-xs text-on-surface">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-outline">
                    <Spin size="small" /> <span className="ml-2">Đang tải danh sách bài viết từ cơ sở dữ liệu...</span>
                  </td>
                </tr>
              ) : filteredArticles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-outline">
                    Không tìm thấy bài viết nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredArticles.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-container-low/50 transition-colors group">
                    <td className="py-space-md px-space-lg text-center">
                      <input
                        checked={selectedIds.includes(item.id)}
                        onChange={() => handleToggleSelect(item.id)}
                        className="w-4 h-4 rounded bg-surface-container-lowest text-primary accent-primary cursor-pointer"
                        type="checkbox"
                      />
                    </td>
                    <td className="py-space-md px-space-md max-w-md">
                      <div className="flex items-center gap-space-md">
                        {item.image ? (
                          <img
                            className="w-16 h-12 rounded-lg object-cover bg-surface-container shrink-0 shadow-sm"
                            src={item.image}
                            alt={item.title}
                          />
                        ) : (
                          <div className="w-16 h-12 rounded-lg bg-surface-container-high flex flex-col items-center justify-center text-outline shrink-0">
                            <span className="material-symbols-outlined text-[20px]">calendar_clock</span>
                            <span className="font-label-sm text-[9px] uppercase tracking-wider">Lên lịch</span>
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <button
                            onClick={() => setPreviewArticle(item)}
                            className="font-headline-sm text-xs font-bold text-primary hover:text-secondary truncate block text-left group-hover:text-secondary transition-colors cursor-pointer"
                            title={item.title}
                          >
                            {item.title}
                          </button>
                          <span className="font-body-sm text-[11px] text-outline truncate mt-0.5">{item.summary}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-space-md px-space-md">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container-high text-primary font-label-sm text-[11px] font-semibold truncate">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-space-md px-space-md">
                      <div className="flex items-center gap-space-xs">
                        <div className={`w-6 h-6 rounded-full ${item.authorColor} font-label-sm text-xs flex items-center justify-center font-bold`}>
                          {item.authorInitial}
                        </div>
                        <span className="font-label-md text-xs text-on-surface truncate font-medium">{item.author}</span>
                      </div>
                    </td>
                    <td className="py-space-md px-space-md text-right font-data-mono text-xs font-bold text-primary">
                      {item.views > 0 ? item.views.toLocaleString('vi-VN') : '0 (Chờ duyệt)'}
                    </td>
                    <td className="py-space-md px-space-md font-data-mono text-xs text-outline">
                      {item.publishDate}
                    </td>
                    <td className="py-space-md px-space-md">
                      {item.status === 'PUBLISHED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-secondary-fixed text-secondary font-label-sm text-xs font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                          {item.statusLabel}
                        </span>
                      ) : item.status === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-orange-100 text-orange-700 font-label-sm text-xs font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container"></span>
                          Chờ duyệt xuất bản
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container text-outline font-label-sm text-xs font-medium">
                          Bản nháp
                        </span>
                      )}
                    </td>
                    <td className="py-space-md px-space-lg text-right">
                      <div className="flex items-center justify-end gap-1">
                        {item.status === 'PENDING' ? (
                          <button
                            onClick={() => handleApprovePending(item.id)}
                            className="px-2.5 py-1 rounded-lg bg-on-tertiary-container text-white font-label-sm text-xs font-bold hover:bg-orange-600 transition-colors shadow-sm whitespace-nowrap cursor-pointer"
                            title="Duyệt bài ngay"
                            type="button"
                          >
                            Duyệt ngay
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-secondary hover:bg-surface-container transition-colors cursor-pointer"
                              title="Sửa bài"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button
                              onClick={() => setPreviewArticle(item)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
                              title="Xem bài"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </button>
                            <button
                              onClick={() => handleDeleteArticle(item.id)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-error hover:bg-surface-container transition-colors cursor-pointer"
                              title="Gỡ bài"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[18px]">archive</span>
                            </button>
                          </>
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
              Hiển thị <span className="font-semibold text-on-surface">1 - {filteredArticles.length}</span> trên tổng số <span className="font-semibold text-on-surface">{totalBlogs}</span> bài viết
            </span>
            <div className="h-4 w-[1px] bg-surface-container hidden sm:block"></div>
            <div className="hidden sm:flex items-center gap-space-xs font-label-sm text-xs text-outline">
              <span>Xem mỗi trang:</span>
              <select className="bg-surface-container-low text-on-surface rounded px-2 py-0.5 border-0 focus:ring-1 focus:ring-secondary font-label-sm text-xs cursor-pointer">
                <option>10 bài</option>
                <option>20 bài</option>
                <option>50 bài</option>
              </select>
            </div>
          </div>

          {/* Pagination Nav Controls */}
          <div className="flex items-center gap-space-xs">
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container hover:text-on-surface disabled:opacity-40 transition-colors" disabled type="button">
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <button className="w-8 h-8 rounded-lg bg-primary text-on-primary font-label-md text-xs font-bold" type="button">
              1
            </button>
            <button className="w-8 h-8 rounded-lg text-on-surface-variant hover:bg-surface-container font-label-md text-xs font-medium transition-colors" type="button">
              2
            </button>
            <button className="w-8 h-8 rounded-lg text-on-surface-variant hover:bg-surface-container font-label-md text-xs font-medium transition-colors" type="button">
              3
            </button>
            <span className="w-6 text-center text-outline font-label-md text-xs">...</span>
            <button className="w-8 h-8 rounded-lg text-on-surface-variant hover:bg-surface-container font-label-md text-xs font-medium transition-colors" type="button">
              7
            </button>
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container hover:text-on-surface transition-colors" type="button">
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Editorial Insights & Content Engagement Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        {/* Readership Distribution by Category */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between border border-outline-variant/30">
          <div>
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container">
              <span className="font-label-lg text-sm text-primary font-bold">Thị phần Độc giả theo Chuyên mục</span>
              <span className="material-symbols-outlined text-outline text-[18px]">pie_chart</span>
            </div>
            <div className="mt-space-md space-y-space-sm">
              <div>
                <div className="flex justify-between font-label-sm text-xs mb-1">
                  <span className="text-on-surface">Thị trường &amp; Vận hành</span>
                  <span className="font-data-mono font-bold text-primary">42.8%</span>
                </div>
                <div className="h-2 w-full bg-surface-container-low rounded-full overflow-hidden">
                  <div className="h-full bg-secondary rounded-full" style={{ width: '42.8%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between font-label-sm text-xs mb-1">
                  <span className="text-on-surface">Công nghệ &amp; AI Chuỗi cung ứng</span>
                  <span className="font-data-mono font-bold text-primary">28.5%</span>
                </div>
                <div className="h-2 w-full bg-surface-container-low rounded-full overflow-hidden">
                  <div className="h-full bg-primary-container rounded-full" style={{ width: '28.5%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between font-label-sm text-xs mb-1">
                  <span className="text-on-surface">Hạ tầng Ga hàng không</span>
                  <span className="font-data-mono font-bold text-primary">18.2%</span>
                </div>
                <div className="h-2 w-full bg-surface-container-low rounded-full overflow-hidden">
                  <div className="h-full bg-surface-container-highest rounded-full" style={{ width: '18.2%' }}></div>
                </div>
              </div>
            </div>
          </div>
          <div className="pt-space-md mt-space-md border-t border-surface-container-low flex items-center justify-between font-body-sm text-xs text-outline">
            <span>Tăng trưởng trung bình</span>
            <span className="font-data-mono font-bold text-secondary">+12.4% so với tuần trước</span>
          </div>
        </div>

        {/* Editorial Queue & Approval Dispatch */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between border border-outline-variant/30">
          <div>
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container">
              <span className="font-label-lg text-sm text-primary font-bold">Quy trình Kiểm duyệt Bản thảo</span>
              <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-700 font-label-sm text-xs font-bold">
                2 Chờ duyệt
              </span>
            </div>
            <div className="mt-space-md space-y-space-sm">
              <div className="p-space-sm rounded-lg bg-surface-container-low flex items-center justify-between">
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="font-label-md text-xs text-primary font-bold truncate">Kế hoạch Điều vận Cao điểm Tết 2027</span>
                  <span className="font-body-sm text-[11px] text-outline">Nộp bởi: Phòng Vận Hành • 45 phút trước</span>
                </div>
                <button
                  onClick={() => showToast('Đã duyệt bài: Kế hoạch Điều vận Cao điểm')}
                  className="px-3 py-1 rounded bg-primary text-on-primary font-label-sm text-xs font-semibold hover:bg-primary-container transition-colors shrink-0 cursor-pointer"
                  type="button"
                >
                  Duyệt
                </button>
              </div>
              <div className="p-space-sm rounded-lg bg-surface-container-low flex items-center justify-between">
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="font-label-md text-xs text-primary font-bold truncate">Cẩm nang Tiêu chuẩn IATA Cargo iQ 2026</span>
                  <span className="font-body-sm text-[11px] text-outline">Nộp bởi: Ban An Toàn Bay • 2 giờ trước</span>
                </div>
                <button
                  onClick={() => showToast('Đã duyệt bài: Cẩm nang Tiêu chuẩn IATA')}
                  className="px-3 py-1 rounded bg-primary text-on-primary font-label-sm text-xs font-semibold hover:bg-primary-container transition-colors shrink-0 cursor-pointer"
                  type="button"
                >
                  Duyệt
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={() => setSelectedStatus('PENDING')}
            className="inline-flex items-center gap-space-xs font-label-md text-xs text-secondary hover:underline pt-space-md mt-space-md border-t border-surface-container-low text-left cursor-pointer"
          >
            <span>Xem tất cả danh sách chờ duyệt</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>

        {/* Quick Dispatch CMS Shortcuts */}
        <div className="bg-primary text-on-primary p-space-lg rounded-xl shadow-md flex flex-col justify-between relative overflow-hidden border border-primary-container">
          <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-secondary rounded-full opacity-20 blur-xl pointer-events-none"></div>
          <div className="z-10">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-orange-400 text-[22px]">campaign</span>
              <span className="font-label-lg text-sm font-bold">Kênh Phát tin Khẩn cấp (NOTAM)</span>
            </div>
            <p className="font-body-sm text-xs text-white/80 mt-space-sm leading-relaxed">
              Phát hành cảnh báo thời tiết bão, đình công cảng quốc tế hoặc sự cố kỹ thuật hạ tầng bay ngay lập tức lên bảng tin điều hành và cổng thông tin đối tác.
            </p>
          </div>
          <div className="mt-space-lg z-10 flex flex-col gap-space-xs">
            <button
              onClick={() => setIsNotamModalOpen(true)}
              className="w-full py-2.5 px-space-md rounded-xl bg-on-tertiary-container text-white font-label-md text-xs font-bold hover:brightness-110 transition-colors shadow-sm flex items-center justify-center gap-space-xs cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">warning</span>
              <span>Phát hành Thông cáo Khẩn</span>
            </button>
            <span className="font-body-sm text-white/60 text-center text-[11px]">
              Gửi thông báo tức thời tới 1.240 tài xế và đối tác kho bãi
            </span>
          </div>
        </div>
      </div>

      {/* Modal: Write New Article */}
      {/* Modal: Write / Edit Article */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface-container-lowest w-full max-w-xl rounded-2xl shadow-2xl border border-outline-variant/40 overflow-hidden flex flex-col">
            <div className="p-5 bg-primary text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl">post_add</span>
                <h3 className="font-bold text-base">
                  {newArticle.id ? `Chỉnh sửa bài viết #${newArticle.id}` : 'Soạn thảo Bản tin / Báo cáo Chuyên ngành'}
                </h3>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveArticle} className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-primary uppercase">Tiêu đề bài viết *</label>
                <input
                  type="text"
                  required
                  value={newArticle.title}
                  onChange={e => setNewArticle({ ...newArticle, title: e.target.value })}
                  className="h-10 px-3 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                  placeholder="Nhập tiêu đề tin tức nổi bật..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-primary uppercase">Chuyên mục</label>
                  <select
                    value={newArticle.category}
                    onChange={e => setNewArticle({ ...newArticle, category: e.target.value })}
                    className="h-10 px-3 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary cursor-pointer"
                  >
                    <option value="Thị trường & Vận hành">Thị trường & Vận hành</option>
                    <option value="Công nghệ & AI Chuỗi cung ứng">Công nghệ & AI Chuỗi cung ứng</option>
                    <option value="Hạ tầng Ga hàng không">Hạ tầng Ga hàng không</option>
                    <option value="Chính sách & Hải quan">Chính sách & Hải quan</option>
                    <option value="Thông báo nội bộ">Thông báo nội bộ</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-primary uppercase">Tác giả</label>
                  <input
                    type="text"
                    value={newArticle.author}
                    onChange={e => setNewArticle({ ...newArticle, author: e.target.value })}
                    className="h-10 px-3 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-primary uppercase">Ảnh đại diện (URL)</label>
                <input
                  type="url"
                  value={newArticle.image}
                  onChange={e => setNewArticle({ ...newArticle, image: e.target.value })}
                  className="h-10 px-3 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                  placeholder="https://images.unsplash.com/... (để trống nếu dùng ảnh tự động)"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-primary uppercase">Tóm tắt ngắn (Excerpt)</label>
                <textarea
                  rows={2}
                  value={newArticle.summary}
                  onChange={e => setNewArticle({ ...newArticle, summary: e.target.value })}
                  className="p-3 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary resize-none"
                  placeholder="Mô tả tóm tắt 1-2 câu hiển thị ở danh sách bài viết..."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-primary uppercase">Nội dung chi tiết (Đoạn văn / Markdown)</label>
                <textarea
                  rows={6}
                  value={newArticle.content}
                  onChange={e => setNewArticle({ ...newArticle, content: e.target.value })}
                  className="p-3 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary resize-none font-mono"
                  placeholder="Soạn thảo nội dung chi tiết bài viết (hỗ trợ ### Tiêu đề mục, - Gạch đầu dòng, > Trích dẫn, **chữ in đậm**)..."
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-outline">Trạng thái:</label>
                  <select
                    value={newArticle.status}
                    onChange={e => setNewArticle({ ...newArticle, status: e.target.value })}
                    className="h-8 px-2 bg-surface-container rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    <option value="PUBLISHED">Xuất bản ngay</option>
                    <option value="DRAFT">Lưu bản nháp</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white shadow-md hover:bg-primary-container cursor-pointer"
                  >
                    {newArticle.id ? 'Lưu cập nhật' : 'Lưu & Phát hành'}
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
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary font-bold text-xs">
                  {previewArticle.category}
                </span>
                <span className="text-xs text-outline font-data-mono">{previewArticle.publishDate}</span>
                <span className="text-xs text-outline">• Tác giả: <strong>{previewArticle.author}</strong></span>
              </div>
              <h2 className="text-xl font-bold text-primary">{previewArticle.title}</h2>
              <p className="text-sm text-on-surface-variant leading-relaxed font-medium">{previewArticle.summary}</p>
              <div className="p-4 bg-surface-container-low rounded-xl text-xs text-on-surface-variant leading-relaxed">
                NEXLOG Logistics Network tự hào mang đến các báo cáo định kỳ hàng tuần dành riêng cho các doanh nghiệp chuỗi cung ứng, nhà vận tải hàng không và các đối tác ủy quyền trung chuyển.
              </div>
            </div>
            <div className="p-4 bg-surface-container-low border-t border-outline-variant/30 flex justify-end">
              <button
                onClick={() => setPreviewArticle(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white cursor-pointer"
              >
                Đóng xem trước
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Emergency NOTAM Broadcast */}
      {isNotamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl border border-outline-variant/40 overflow-hidden flex flex-col">
            <div className="p-5 bg-red-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl">campaign</span>
                <h3 className="font-bold text-base">Phát hành Thông Cáo Khẩn (NOTAM)</h3>
              </div>
              <button onClick={() => setIsNotamModalOpen(false)} className="text-white/80 hover:text-white cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSendNotam} className="p-6 flex flex-col gap-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                Lưu ý: Thông cáo NOTAM sẽ đẩy thông báo đẩy (Push Notification) tức thời tới tất cả điện thoại của tài xế đang trong ca trực và hiển thị dải cờ đỏ trên Cổng đối tác.
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-primary uppercase">Tiêu đề cảnh báo *</label>
                <input
                  type="text"
                  required
                  value={notamData.title}
                  onChange={e => setNotamData({ ...notamData, title: e.target.value })}
                  className="h-10 px-3 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-red-600"
                  placeholder="Vd: Cảnh báo bão số 3 ảnh hưởng ga Nội Bài từ 18h00..."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-primary uppercase">Chi tiết chỉ đạo vận hành</label>
                <textarea
                  rows={4}
                  value={notamData.content}
                  onChange={e => setNotamData({ ...notamData, content: e.target.value })}
                  className="p-3 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-red-600 resize-none"
                  placeholder="Hướng dẫn tài xế, đội xe và thủ kho thực hiện che chắn bạt, điều chỉnh giờ giao nhận..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNotamModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-red-700 text-white shadow-md hover:bg-red-800 cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">send</span>
                  <span>Phát thông cáo ngay</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
