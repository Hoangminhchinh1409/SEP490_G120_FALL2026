import React from 'react';
import { Spin } from 'antd';

export function BlogPreviewModal({
  previewArticle,
  onClose,
  setDeleteConfirmTarget,
  handleOpenEditModal
}) {
  if (!previewArticle) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-surface-container-lowest w-full max-w-2xl rounded-2xl shadow-2xl border border-outline-variant/40 overflow-hidden flex flex-col">
        <div className="p-4 bg-primary text-white flex items-center justify-between">
          <span className="font-bold text-sm">Xem trước Bản tin</span>
          <button onClick={onClose} className="text-white/80 hover:text-white cursor-pointer">
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
              onClose();
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
                onClose();
                handleOpenEditModal(target);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-surface-container text-primary hover:bg-surface-container-high cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              <span>Chỉnh sửa</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white cursor-pointer"
            >
              Đóng xem trước
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BlogDeleteModal({
  deleteConfirmTarget,
  onClose,
  isDeleting,
  handleBulkDelete,
  handleDeleteArticle
}) {
  if (!deleteConfirmTarget) return null;

  return (
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
            onClick={() => !isDeleting && onClose()}
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
            onClick={onClose}
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
  );
}

