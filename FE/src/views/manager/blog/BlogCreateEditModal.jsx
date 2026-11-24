import React, { useState } from 'react';
import { managerApi } from '../../../api/managerApi';
import { uploadApi } from '../../../api/uploadApi';
import RichTextEditor from './RichTextEditor';
import { getContentMetrics } from '../../blog/components/BlogContentRenderer';

export function BlogCreateEditModal({
  isOpen,
  onClose,
  newArticle,
  setNewArticle,
  handleSaveArticle,
  setPreviewArticle,
  showToast,
  fetchBlogs
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  if (!isOpen) return null;

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingCover(true);
      const uploaded = await uploadApi.uploadToCloudinary(file, 'nexlog/blogs');
      setNewArticle(prev => ({ ...prev, image: uploaded.url }));
      showToast('Đã tải ảnh bìa lên Cloudinary!', 'success');
    } catch (err) {
      showToast(err.message || 'Không thể tải ảnh bìa lên Cloudinary', 'error');
    } finally {
      setUploadingCover(false);
      e.target.value = '';
    }
  };

  const statusBadgeLabel =
    newArticle.status === 'PUBLISHED'
      ? 'Đã đăng'
      : newArticle.status === 'UNPUBLISHED'
      ? 'Đã gỡ'
      : 'Bản nháp';

  const buildPayload = (status) => ({
    title: (newArticle.title || '').trim(),
    summary: (newArticle.summary || '').trim(),
    content:
      status === 'DRAFT'
        ? (newArticle.content?.trim() || 'Nội dung đang được soạn thảo...')
        : (newArticle.content || '').trim(),
    category: newArticle.category,
    author: newArticle.author || 'Nguyễn Quản Lý',
    status,
    image: newArticle.image || '',
    is_featured: Boolean(newArticle.is_featured)
  });

  const submitWithStatus = async (status) => {
    if (isSubmitting) return;
    if (!newArticle.title?.trim()) {
      showToast('Vui lòng nhập tiêu đề bài viết', 'error');
      return;
    }
    const isContentEmpty = getContentMetrics(newArticle.content).isEmpty;
    if (status === 'PUBLISHED' && isContentEmpty) {
      showToast('Vui lòng điền đủ Tiêu đề và Nội dung bài viết', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = buildPayload(status);
      if (newArticle.id) {
        await managerApi.updateBlog(newArticle.id, payload);
      } else {
        await managerApi.createBlog(payload);
      }
      showToast(
        status === 'PUBLISHED'
          ? 'Đã xuất bản bài viết thành công!'
          : 'Đã lưu bản nháp thành công!'
      );
      onClose();
      fetchBlogs();
    } catch (err) {
      showToast(
        err.message || (status === 'PUBLISHED' ? 'Lỗi đăng bài viết' : 'Lỗi lưu bản nháp'),
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-surface-container-lowest w-full max-w-5xl rounded-2xl shadow-2xl border border-outline-variant/40 overflow-hidden flex flex-col">
        <div className="p-5 bg-surface-container-low border-b border-surface-container flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-lg text-primary">
              {newArticle.id ? 'Sửa bài viết' : 'Viết bài'}
            </h3>
            <span className="px-3 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
              {statusBadgeLabel}
            </span>
          </div>
          <button 
            onClick={onClose}
            className="text-outline hover:text-on-surface cursor-pointer p-1 rounded-lg hover:bg-surface-container"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSaveArticle} className="p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
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
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newArticle.image}
                  onChange={e => setNewArticle({ ...newArticle, image: e.target.value })}
                  className="flex-1 h-10 px-3 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-secondary border border-transparent focus:border-secondary"
                  placeholder="URL ảnh bìa Cloudinary..."
                />
                <label className="h-10 px-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold flex items-center cursor-pointer whitespace-nowrap">
                  {uploadingCover ? 'Đang tải...' : 'Tải ảnh'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingCover}
                    onChange={handleCoverUpload}
                  />
                </label>
              </div>
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
            <label className="text-xs font-bold text-primary uppercase">Nội dung chi tiết *</label>
            <RichTextEditor
              value={newArticle.content}
              onChange={(nextContent) => setNewArticle(prev => ({ ...prev, content: nextContent }))}
              showToast={showToast}
              placeholder="Soạn thảo nội dung chi tiết bài viết (dùng thanh công cụ hoặc Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+K)..."
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

          {/* Action buttons */}
          <div className="flex flex-wrap justify-between items-center pt-3 border-t border-surface-container gap-2">
            <button
              type="button"
              onClick={onClose}
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
                disabled={isSubmitting}
                onClick={(e) => {
                  e.preventDefault();
                  submitWithStatus('DRAFT');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-surface-container-low text-primary hover:bg-surface-container border border-surface-container cursor-pointer transition-colors disabled:opacity-50"
              >
                Lưu bản nháp
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={(e) => {
                  e.preventDefault();
                  submitWithStatus('PUBLISHED');
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-secondary text-on-secondary shadow-md hover:bg-secondary-container cursor-pointer transition-all disabled:opacity-50"
              >
                Đăng bài
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

