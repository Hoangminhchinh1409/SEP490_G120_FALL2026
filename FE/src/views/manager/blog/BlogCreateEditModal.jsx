import React from 'react';
import { managerApi } from '../../../api/managerApi';

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
  if (!isOpen) return null;

  return (
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
            onClick={onClose}
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
                    onClose();
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
                    onClose();
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
  );
}

