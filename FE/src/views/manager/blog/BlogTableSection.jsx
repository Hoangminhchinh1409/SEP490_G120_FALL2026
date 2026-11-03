import React from 'react';
import { Spin } from 'antd';

export function BlogTableSection({
  filteredArticles,
  paginatedArticles,
  loading,
  selectedIds,
  handleSelectAll,
  handleToggleSelect,
  showToast,
  setDeleteConfirmTarget,
  handlePublishAgain,
  handleUnpublish,
  handleOpenEditModal,
  setPreviewArticle,
  pageSize,
  setPageSize,
  currentPage,
  setCurrentPage,
  totalPages
}) {
  return (
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

      {/* Data Grid */}
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
            ) : paginatedArticles.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-outline">
                  <div className="flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-4xl text-outline/50">inbox</span>
                    <span>Không tìm thấy bài viết nào phù hợp với bộ lọc hiện tại</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedArticles.map((item) => (
                <tr key={item.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="py-3 px-space-lg">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => handleToggleSelect(item.id)}
                        className="w-4 h-4 rounded text-secondary accent-secondary cursor-pointer shrink-0"
                      />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPreviewArticle(item)}
                            className="font-bold text-xs text-primary hover:text-secondary line-clamp-1 text-left cursor-pointer transition-colors"
                          >
                            {item.title}
                          </button>
                          {item.is_featured && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold uppercase shrink-0">
                              Nổi bật
                            </span>
                          )}
                        </div>
                        {item.summary && (
                          <span className="text-[11px] text-outline line-clamp-1">
                            {item.summary}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-space-md">
                    <span className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface font-semibold text-[11px]">
                      {item.category}
                    </span>
                  </td>

                  <td className="py-3 px-space-md">
                    {item.status === 'PUBLISHED' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[11px] border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                        Đã đăng
                      </span>
                    )}
                    {item.status === 'DRAFT' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold text-[11px] border border-amber-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                        Bản nháp
                      </span>
                    )}
                    {item.status === 'UNPUBLISHED' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        Đã gỡ
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-space-md font-data-mono text-[11px] text-outline">
                    {item.publishDate || (item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : '—')}
                  </td>

                  <td className="py-3 px-space-md text-right font-data-mono font-semibold text-primary text-[11px]">
                    {(Number(item.views) || 0).toLocaleString('vi-VN')}
                  </td>

                  <td className="py-3 px-space-lg text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEditModal(item)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-outline hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
                        title="Chỉnh sửa bài viết"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>

                      {item.status === 'PUBLISHED' ? (
                        <button
                          onClick={() => handleUnpublish(item.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-outline hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                          title="Gỡ bài khỏi website"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility_off</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePublishAgain(item.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-outline hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="Đăng xuất bản bài viết"
                        >
                          <span className="material-symbols-outlined text-[16px]">publish</span>
                        </button>
                      )}

                      <button
                        onClick={() => setDeleteConfirmTarget({ type: 'single', article: item })}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-outline hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Xoá bài viết"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk actions and Pagination Footer */}
      <div className="p-space-md bg-surface-container-low/60 border-t border-surface-container flex flex-col sm:flex-row items-center justify-between gap-space-md">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-outline hover:text-primary">
            <input
              type="checkbox"
              checked={paginatedArticles.length > 0 && selectedIds.length === paginatedArticles.length}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded text-secondary accent-secondary cursor-pointer"
            />
            <span>Chọn tất cả ({selectedIds.length} đã chọn)</span>
          </label>

          {selectedIds.length > 0 && (
            <button
              onClick={() => setDeleteConfirmTarget({ type: 'bulk', count: selectedIds.length })}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-bold hover:bg-red-100 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">delete</span>
              <span>Xóa {selectedIds.length} bài</span>
            </button>
          )}

          <div className="flex items-center gap-2 text-xs text-outline pl-2 border-l border-surface-container">
            <span>Hiển thị:</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-surface-container-low rounded-lg text-xs font-medium text-on-surface border border-surface-container cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
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
  );
}

