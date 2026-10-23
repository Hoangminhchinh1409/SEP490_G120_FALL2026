import React from "react";
import Link from "next/link";
import { renderArticleContent } from "./BlogContentRenderer";

export default function BlogDetailView({
    selectedArticle,
    handleBackToList,
    handleSelectArticle,
    handleCopyLink,
    copied,
    trendingArticles
}) {
    if (!selectedArticle) return null;

    return (
        <div className="w-full px-margin-lg py-space-xl">
            <div className="max-w-7xl mx-auto">
                {/* Breadcrumb và Nút Quay lại */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-space-md border-b border-surface-container mb-space-lg">
                    <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-space-xs font-label-md text-label-md text-on-surface-variant">
                        <Link className="hover:text-secondary flex items-center gap-1 transition-colors" href="/">
                            <span className="material-symbols-outlined text-sm">home</span>
                            Trang chủ
                        </Link>
                        <span className="text-outline-variant">/</span>
                        <button onClick={handleBackToList} className="hover:text-secondary transition-colors cursor-pointer">
                            Tin tức &amp; Sự kiện
                        </button>
                        <span className="text-outline-variant">/</span>
                        <span className="text-secondary font-semibold">{selectedArticle.category}</span>
                    </nav>

                    <button
                        onClick={handleBackToList}
                        type="button"
                        className="inline-flex items-center gap-2 px-space-md py-2 rounded-xl bg-surface-container-low hover:bg-primary hover:text-on-primary text-primary font-headline-sm transition-all shadow-sm cursor-pointer group"
                    >
                        <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">
                            arrow_back
                        </span>
                        Quay lại danh sách tin tức
                    </button>
                </div>

                {/* Bố cục 2 cột: Cột trái bài viết chi tiết (8 cols), Cột phải Sidebar (4 cols) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-start">
                    {/* Cột chi tiết bài viết */}
                    <article className="lg:col-span-8 bg-surface-container-lowest p-space-lg sm:p-space-xl rounded-2xl shadow-sm border border-surface-container-low flex flex-col gap-space-md">
                        {/* Chuyên mục & Tiêu đề bài viết */}
                        <div className="flex flex-col gap-space-sm">
                            <div className="flex items-center gap-space-xs">
                                <span className="px-space-sm py-1 rounded bg-secondary/10 text-secondary font-label-sm text-label-sm uppercase tracking-wider font-bold inline-flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                                    {selectedArticle.category}
                                </span>
                                {selectedArticle.statusLabel && (
                                    <span className="px-space-xs py-0.5 rounded bg-surface-container text-on-surface-variant font-data-mono text-label-sm">
                                        {selectedArticle.statusLabel}
                                    </span>
                                )}
                            </div>

                            <h1 className="font-headline-xl text-3xl sm:text-4xl lg:text-5xl text-primary font-bold tracking-tight leading-tight">
                                {selectedArticle.title}
                            </h1>

                            {/* Metadata Row */}
                            <div className="flex flex-wrap items-center justify-between gap-space-sm py-space-sm border-y border-surface-container my-space-xs">
                                <div className="flex items-center gap-space-sm">
                                    <div className={`w-11 h-11 rounded-full ${selectedArticle.authorColor || "bg-primary-container text-on-primary"} flex items-center justify-center font-headline-sm font-bold shadow-sm`}>
                                        {selectedArticle.authorInitial || (selectedArticle.author ? selectedArticle.author[0] : "N")}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-headline-sm text-headline-sm text-primary">
                                            {selectedArticle.author || "Ban Điều Hành NEXLOG"}
                                        </span>
                                        <span className="font-data-mono text-label-sm text-on-surface-variant flex items-center gap-space-xs">
                                            <span>{selectedArticle.publishDate || "Mới xuất bản"}</span>
                                            <span>•</span>
                                            <span>5 phút đọc</span>
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-space-sm">
                                    <span className="flex items-center gap-1 font-data-mono text-label-md text-on-surface-variant bg-surface-container-low px-space-sm py-1.5 rounded-lg">
                                        <span className="material-symbols-outlined text-sm text-secondary">visibility</span>
                                        {(selectedArticle.views || 0).toLocaleString("vi-VN")} lượt đọc
                                    </span>

                                    <button
                                        onClick={handleCopyLink}
                                        type="button"
                                        title="Sao chép liên kết"
                                        className="p-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-primary transition-colors flex items-center gap-1 text-label-md"
                                    >
                                        <span className="material-symbols-outlined text-base">
                                            {copied ? "check" : "share"}
                                        </span>
                                        <span className="hidden sm:inline">{copied ? "Đã chép link!" : "Chia sẻ"}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Đoạn mở đầu nổi bật (Sapo) */}
                        {selectedArticle.summary && (
                            <div className="p-space-md sm:p-space-lg rounded-xl bg-surface-container-low/70 border-l-4 border-on-tertiary-container font-body-lg text-lg text-primary font-medium italic leading-relaxed">
                                {selectedArticle.summary}
                            </div>
                        )}

                        {/* Hình ảnh đại diện lớn */}
                        {selectedArticle.image && (
                            <figure className="relative w-full rounded-xl overflow-hidden shadow-md my-space-xs">
                                <img
                                    src={selectedArticle.image}
                                    alt={selectedArticle.title}
                                    className="w-full max-h-[500px] object-cover"
                                />
                                <figcaption className="p-space-xs bg-surface-container-high/80 text-on-surface-variant text-label-sm text-center">
                                    Hình ảnh: Trung tâm điều phối vận tải hàng không quốc tế NEXLOG AeroCargo
                                </figcaption>
                            </figure>
                        )}

                        {/* Nội dung bài viết đầy đủ */}
                        <div className="prose prose-lg max-w-none text-on-surface my-space-sm">
                            {renderArticleContent(selectedArticle.content || selectedArticle.summary)}
                        </div>

                        {/* Danh sách Tags */}
                        <div className="pt-space-md border-t border-surface-container flex flex-wrap items-center gap-2">
                            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold mr-1">Chủ đề:</span>
                            <span className="px-space-sm py-1 rounded bg-surface-container-low hover:bg-surface-container text-primary font-label-sm cursor-pointer transition-colors">
                                #LogisticsHangKhong
                            </span>
                            <span className="px-space-sm py-1 rounded bg-surface-container-low hover:bg-surface-container text-primary font-label-sm cursor-pointer transition-colors">
                                #NEXLOGAeroCargo
                            </span>
                            <span className="px-space-sm py-1 rounded bg-surface-container-low hover:bg-surface-container text-primary font-label-sm cursor-pointer transition-colors">
                                #{selectedArticle.category?.replace(/\s+/g, "")}
                            </span>
                            <span className="px-space-sm py-1 rounded bg-surface-container-low hover:bg-surface-container text-primary font-label-sm cursor-pointer transition-colors">
                                #IATA2026
                            </span>
                        </div>

                        {/* Author Profile Box */}
                        <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col sm:flex-row items-center gap-space-md mt-space-sm">
                            <div className={`w-14 h-14 rounded-full ${selectedArticle.authorColor || "bg-primary-container text-on-primary"} flex items-center justify-center font-headline-lg font-bold shadow-sm shrink-0`}>
                                {selectedArticle.authorInitial || (selectedArticle.author ? selectedArticle.author[0] : "N")}
                            </div>
                            <div className="flex flex-col text-center sm:text-left">
                                <span className="font-headline-sm text-headline-sm text-primary">
                                    Tác giả: {selectedArticle.author || "Ban Điều Hành NEXLOG"}
                                </span>
                                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                                    Đội ngũ chuyên gia phân tích chuỗi cung ứng hàng không và cố vấn điều hành logistics đa phương thức tại NEXLOG Corporation.
                                </p>
                            </div>
                        </div>

                        {/* Thanh điều hướng bài trước / bài sau & Nút quay lại */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-space-sm pt-space-md border-t border-surface-container mt-space-sm">
                            <button
                                onClick={handleBackToList}
                                type="button"
                                className="w-full sm:w-auto px-space-md py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                            >
                                <span className="material-symbols-outlined text-base">arrow_back</span>
                                Xem tất cả bài viết khác
                            </button>

                            <button
                                onClick={handleCopyLink}
                                type="button"
                                className="w-full sm:w-auto px-space-md py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-label-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-base">link</span>
                                {copied ? "Đã sao chép liên kết!" : "Sao chép liên kết bài viết"}
                            </button>
                        </div>

                        {/* Bài viết liên quan */}
                        {selectedArticle.relatedBlogs && selectedArticle.relatedBlogs.length > 0 && (
                            <div className="pt-space-lg border-t border-surface-container mt-space-md">
                                <h3 className="font-headline-md text-headline-md text-primary font-bold mb-space-md flex items-center gap-2">
                                    <span className="material-symbols-outlined text-secondary">auto_stories</span>
                                    Bài Viết Liên Quan
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-gutter">
                                    {selectedArticle.relatedBlogs.map((rel) => (
                                        <div
                                            key={rel.id}
                                            onClick={() => handleSelectArticle(rel)}
                                            className="group bg-surface-container-low rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-all flex flex-col"
                                        >
                                            <div className="relative h-32 overflow-hidden bg-surface-container">
                                                <img
                                                    src={rel.image || "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80"}
                                                    alt={rel.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            </div>
                                            <div className="p-3 flex-1 flex flex-col justify-between">
                                                <div>
                                                    <span className="text-secondary font-label-sm font-semibold block text-xs">
                                                        {rel.category}
                                                    </span>
                                                    <h4 className="font-headline-sm text-sm font-bold text-primary group-hover:text-secondary line-clamp-2 mt-1">
                                                        {rel.title}
                                                    </h4>
                                                </div>
                                                <span className="font-data-mono text-label-sm text-on-surface-variant text-xs mt-2">
                                                    {rel.publishDate}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </article>

                    {/* Cột phải Sidebar (Thông tin hỗ trợ & Tin đọc nhiều) */}
                    <aside className="lg:col-span-4 flex flex-col gap-space-lg">
                        {/* Widget Tải Báo Cáo */}
                        <div className="relative rounded-xl overflow-hidden bg-primary text-on-primary p-space-lg shadow-lg flex flex-col justify-between">
                            <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-secondary/30 blur-2xl pointer-events-none"></div>
                            <div className="relative z-10 flex flex-col gap-space-sm">
                                <div className="flex items-center gap-space-xs text-on-tertiary-container font-label-sm text-label-sm uppercase tracking-wider font-bold">
                                    <span className="material-symbols-outlined text-sm">menu_book</span>
                                    BÁO CÁO ĐỘC QUYỀN
                                </div>
                                <h3 className="font-headline-md text-headline-md text-on-primary tracking-tight">
                                    Toàn Cảnh Vận Tải Hàng Không Việt Nam 2026
                                </h3>
                                <p className="font-body-sm text-body-sm text-surface-container">
                                    Tài liệu 56 trang phân tích chu kỳ cước Sea-Air và công suất cảng hàng không mới Long Thành.
                                </p>
                                <div className="p-space-sm rounded-lg bg-primary-container flex items-center gap-space-sm my-space-xs">
                                    <span className="material-symbols-outlined text-secondary-fixed text-2xl">picture_as_pdf</span>
                                    <div className="flex flex-col">
                                        <span className="font-label-md text-label-md text-on-primary">NEXLOG_Annual_AirCargo_2026.pdf</span>
                                        <span className="font-data-mono text-label-sm text-surface-dim">Dung lượng: 14.8 MB</span>
                                    </div>
                                </div>
                            </div>
                            <div className="relative z-10 pt-space-sm">
                                <button className="w-full py-space-sm px-space-md rounded-xl bg-on-tertiary-container hover:bg-tertiary-container text-on-primary font-label-lg text-label-lg font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all" type="button">
                                    <span className="material-symbols-outlined text-lg">download</span>
                                    Tải PDF Báo Cáo Miễn Phí
                                </button>
                            </div>
                        </div>

                        {/* Widget Tin đọc nhiều nhất */}
                        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md border border-surface-container-low">
                            <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
                                <div className="flex items-center gap-space-xs">
                                    <span className="material-symbols-outlined text-on-tertiary-container">trending_up</span>
                                    <h3 className="font-headline-sm text-headline-sm text-primary">Tin Đọc Nhiều Nhất</h3>
                                </div>
                                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Tuần này</span>
                            </div>
                            <div className="flex flex-col divide-y divide-surface-container-low">
                                {trendingArticles.map((item, idx) => (
                                    <div
                                        key={item.id}
                                        onClick={() => handleSelectArticle(item)}
                                        className="py-space-sm flex items-start gap-space-md group cursor-pointer"
                                    >
                                        <span className="font-display-lg text-headline-xl text-surface-dim group-hover:text-secondary transition-colors font-bold leading-none select-none">
                                            0{idx + 1}
                                        </span>
                                        <div className="flex flex-col gap-1">
                                            <span className="font-label-sm text-label-sm text-secondary font-semibold uppercase">
                                                {item.category}
                                            </span>
                                            <h4 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors line-clamp-2">
                                                {item.title}
                                            </h4>
                                            <span className="font-data-mono text-label-sm text-on-surface-variant flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs">visibility</span>
                                                {(item.views || 0).toLocaleString("vi-VN")} lượt đọc
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Widget Hotline hỗ trợ */}
                        <div className="p-space-md rounded-xl bg-surface-container-high flex items-center justify-between">
                            <div className="flex items-center gap-space-sm">
                                <span className="material-symbols-outlined text-secondary text-2xl">support_agent</span>
                                <div className="flex flex-col">
                                    <span className="font-headline-sm text-headline-sm text-primary">Cần tư vấn đặt tải gấp?</span>
                                    <span className="font-body-sm text-body-sm text-on-surface-variant">Trực điều vận 24/7 toàn quốc</span>
                                </div>
                            </div>
                            <a className="px-space-sm py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md whitespace-nowrap hover:bg-primary-container transition-colors" href="tel:19003133">
                                1900 3133
                            </a>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}
