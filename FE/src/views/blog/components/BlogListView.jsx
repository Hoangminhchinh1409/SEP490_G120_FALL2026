import React from "react";
import Link from "next/link";

export default function BlogListView({
    CATEGORIES,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    setCurrentPage,
    featuredArticle,
    filteredArticles,
    paginatedArticles,
    activePage,
    totalPages,
    pageSize,
    handlePageChange,
    handleSelectArticle,
    trendingArticles
}) {
    return (
        <div className="flex flex-col w-full">
            {/* Header & Filter Sub-Navigation Section */}
            <section className="w-full px-margin-lg py-space-xl bg-surface-container-lowest shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col gap-space-lg">
                    {/* Breadcrumb */}
                    <nav aria-label="Breadcrumb" className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface-variant">
                        <Link className="hover:text-secondary flex items-center gap-1 transition-colors" href="/">
                            <span className="material-symbols-outlined text-sm">home</span>
                            Trang chủ
                        </Link>
                        <span className="text-outline-variant">/</span>
                        <span className="text-primary font-headline-sm">Tin tức &amp; Sự kiện</span>
                    </nav>

                    {/* Section Title & Meta Overview */}
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-space-xs px-space-sm py-1 rounded bg-surface-container-high text-primary font-label-sm text-label-sm uppercase tracking-wider mb-space-sm">
                                <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse"></span>
                                NEXLOG Intelligence &amp; Global Fleet Dispatch
                            </div>
                            <h1 className="font-headline-xl text-headline-xl text-primary tracking-tight">
                                TIN TỨC &amp; BẢN TIN CHUYÊN NGÀNH LOGISTICS
                            </h1>
                            <p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs">
                                Cập nhật xu hướng điều vận hàng không thông minh, phân tích biến động chuỗi cung ứng toàn cầu, tiến bộ công nghệ AI/IoT kho vận và chỉ thị vận hành từ NEXLOG AeroCargo.
                            </p>
                        </div>

                        {/* Live Telemetry KPI Pill */}
                        <div className="flex items-center gap-space-md p-space-sm rounded-xl bg-surface-container-low shadow-sm">
                            <div className="flex flex-col">
                                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Sản lượng điều vận 24h</span>
                                <span className="font-headline-md text-headline-md text-primary">3.482 <span className="font-label-md text-secondary">Tấn AWB</span></span>
                            </div>
                            <div className="w-px h-8 bg-surface-container-highest"></div>
                            <div className="flex flex-col">
                                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Độ trễ toàn mạng</span>
                                <span className="font-headline-md text-headline-md text-secondary-container">0.04% <span className="font-label-sm text-on-surface-variant">chuẩn IATA</span></span>
                            </div>
                        </div>
                    </div>

                    {/* Search & Category Filters */}
                    <div className="flex flex-col gap-space-md pt-space-sm">
                        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-space-sm">
                            {/* Search Input */}
                            <div className="relative flex-1">
                                <span className="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-outline">search</span>
                                <input
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full pl-11 pr-space-md py-space-sm rounded-xl bg-surface text-on-surface font-body-md text-body-md placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary transition-all shadow-sm"
                                    placeholder="Tìm kiếm báo cáo, mã chuyến bay, công nghệ kho hoặc quy chuẩn IATA..."
                                    type="text"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-space-md top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                                    >
                                        <span className="material-symbols-outlined text-base">close</span>
                                    </button>
                                )}
                            </div>

                            {/* Quick Sort Selector */}
                            <div className="flex items-center gap-space-xs bg-surface px-space-md py-space-sm rounded-xl shadow-sm text-on-surface">
                                <span className="material-symbols-outlined text-outline text-lg">tune</span>
                                <span className="font-label-md text-label-md text-on-surface-variant">Sắp xếp:</span>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="bg-transparent font-label-lg text-label-lg text-primary focus:outline-none cursor-pointer"
                                >
                                    <option value="newest">Mới nhất trước</option>
                                    <option value="views">Xem nhiều nhất</option>
                                    <option value="title">Tiêu đề (A - Z)</option>
                                </select>
                            </div>
                        </div>

                        {/* Category Filter Tabs */}
                        <div className="flex items-center gap-space-xs overflow-x-auto pb-1 scrollbar-none">
                            {CATEGORIES.map((cat) => {
                                const isActive = selectedCategory === cat;
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => {
                                            setSelectedCategory(cat);
                                            setCurrentPage(1);
                                        }}
                                        className={`px-space-md py-1.5 rounded-full font-label-lg text-label-lg whitespace-nowrap transition-all cursor-pointer ${
                                            isActive
                                                ? "bg-primary text-on-primary shadow-sm font-bold"
                                                : "bg-surface-container hover:bg-surface-container-high text-on-surface"
                                        }`}
                                        type="button"
                                    >
                                        {cat}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>

            {/* Featured Bento Section (Bài viết nổi bật đầu trang) */}
            {featuredArticle && !searchQuery && selectedCategory === "Tất cả" && (
                <section className="w-full px-margin-lg py-space-xl">
                    <div className="max-w-7xl mx-auto">
                        <div className="relative bg-surface-container-lowest rounded-xl shadow-md overflow-hidden grid grid-cols-1 lg:grid-cols-12 group border border-surface-container-low">
                            {/* Cột hình ảnh */}
                            <div
                                onClick={() => handleSelectArticle(featuredArticle)}
                                className="lg:col-span-7 relative min-h-[380px] lg:min-h-[460px] overflow-hidden cursor-pointer"
                            >
                                <img
                                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                                    src={featuredArticle.image || "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80"}
                                    alt={featuredArticle.title}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-primary/20 lg:to-surface-container-lowest"></div>
                                <div className="absolute top-space-md left-space-md flex items-center gap-space-xs px-space-sm py-1 rounded bg-primary/80 backdrop-blur-md text-on-primary font-label-sm text-label-sm uppercase tracking-widest shadow-lg">
                                    <span className="material-symbols-outlined text-secondary-fixed text-base">flight_takeoff</span>
                                    Hub Miền Bắc • Nội Bài (HAN)
                                </div>
                                <div className="absolute bottom-space-md left-space-md hidden sm:flex items-center gap-space-xs text-on-primary font-label-sm text-label-sm bg-inverse-surface/80 backdrop-blur px-space-sm py-1 rounded">
                                    <span className="material-symbols-outlined text-on-tertiary-container text-sm">hub</span>
                                    <span>Diện tích vận hành mở rộng: 150.000 m²</span>
                                </div>
                            </div>

                            {/* Cột thông tin */}
                            <div className="lg:col-span-5 p-space-lg lg:p-space-xl flex flex-col justify-between bg-surface-container-lowest">
                                <div className="flex flex-col gap-space-sm">
                                    <div className="flex items-center gap-space-xs">
                                        <span className="px-space-sm py-0.5 rounded bg-tertiary-container text-on-tertiary-container font-label-sm text-label-sm uppercase tracking-wider font-bold">
                                            {featuredArticle.category}
                                        </span>
                                        <span className="text-on-surface-variant font-data-mono text-label-sm">• TIÊU ĐIỂM THÁNG</span>
                                    </div>
                                    <h2
                                        onClick={() => handleSelectArticle(featuredArticle)}
                                        className="font-headline-lg text-headline-lg text-primary hover:text-secondary transition-colors tracking-tight line-clamp-3 cursor-pointer"
                                    >
                                        {featuredArticle.title}
                                    </h2>
                                    <p className="font-body-md text-body-md text-on-surface-variant line-clamp-4">
                                        {featuredArticle.summary}
                                    </p>
                                </div>

                                <div className="pt-space-md mt-space-md bg-surface-container-low p-space-md rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                                    <div className="flex items-center gap-space-xs">
                                        <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-headline-sm">
                                            {featuredArticle.authorInitial || "NX"}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-label-lg text-label-lg text-primary">{featuredArticle.author}</span>
                                            <span className="font-body-sm text-body-sm text-on-surface-variant">
                                                {featuredArticle.publishDate} • 5 phút đọc
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleSelectArticle(featuredArticle)}
                                        type="button"
                                        className="inline-flex items-center gap-1 font-label-lg text-label-lg text-on-tertiary-container hover:text-tertiary-container font-semibold transition-colors cursor-pointer"
                                    >
                                        Đọc toàn bộ bài viết
                                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Thân trang: 2 cột (8 Cột Danh Sách Bài Viết + 4 Cột Sidebar) */}
            <section id="articles-grid-top" className="w-full px-margin-lg pb-space-xl">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-start">
                    {/* CỘT TRÁI: Grid bài viết & Thanh Phân Trang (8 cols) */}
                    <div className="lg:col-span-8 flex flex-col gap-space-lg">
                        <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
                            <div className="flex items-center gap-space-xs">
                                <span className="material-symbols-outlined text-secondary">feed</span>
                                <h2 className="font-headline-md text-headline-md text-primary tracking-tight">
                                    {selectedCategory === "Tất cả" ? "Bài Viết Mới Xuất Bản" : `Chuyên mục: ${selectedCategory}`}
                                </h2>
                            </div>
                            <span className="font-data-mono text-label-sm text-on-surface-variant">
                                Trang {activePage} / {totalPages} (Tổng {filteredArticles.length} bài viết)
                            </span>
                        </div>

                        {/* Khi không tìm thấy bài viết */}
                        {filteredArticles.length === 0 ? (
                            <div className="bg-surface-container-lowest p-space-xl rounded-xl text-center flex flex-col items-center justify-center gap-space-sm border border-surface-container-low">
                                <span className="material-symbols-outlined text-4xl text-outline">search_off</span>
                                <h3 className="font-headline-md text-primary">Không tìm thấy bài viết nào</h3>
                                <p className="font-body-md text-on-surface-variant max-w-md">
                                    Không có bài viết phù hợp với từ khóa &quot;{searchQuery}&quot; trong chuyên mục &quot;{selectedCategory}&quot;.
                                </p>
                                <button
                                    onClick={() => {
                                        setSearchQuery("");
                                        setSelectedCategory("Tất cả");
                                        setCurrentPage(1);
                                    }}
                                    type="button"
                                    className="px-space-md py-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-label-md transition-colors cursor-pointer"
                                >
                                    Xóa bộ lọc tìm kiếm
                                </button>
                            </div>
                        ) : (
                            /* Grid hiển thị danh sách bài viết */
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                                {paginatedArticles.map((article) => (
                                    <article
                                        key={article.id}
                                        onClick={() => handleSelectArticle(article)}
                                        className="bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col justify-between group border border-surface-container-low cursor-pointer"
                                    >
                                        <div>
                                            <div className="relative h-48 overflow-hidden bg-surface-container">
                                                <img
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                    src={article.image || "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80"}
                                                    alt={article.title}
                                                />
                                                <div className="absolute top-space-sm left-space-sm">
                                                    <span className="px-space-xs py-0.5 rounded bg-surface-container-lowest/90 backdrop-blur-md text-secondary font-label-sm text-label-sm uppercase tracking-wider font-bold shadow-xs">
                                                        {article.category}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="p-space-md flex flex-col gap-space-xs">
                                                <div className="flex items-center gap-space-xs font-data-mono text-label-sm text-on-surface-variant">
                                                    <span>{article.publishDate || "Vừa cập nhật"}</span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-0.5">
                                                        <span className="material-symbols-outlined text-xs">visibility</span>
                                                        {(article.views || 0).toLocaleString("vi-VN")}
                                                    </span>
                                                </div>
                                                <h3 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors line-clamp-2">
                                                    {article.title}
                                                </h3>
                                                <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-3">
                                                    {article.summary}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="p-space-md pt-0 flex items-center justify-between border-t border-surface-container-low mt-space-xs">
                                            <div className="flex items-center gap-space-xs">
                                                <div className={`w-7 h-7 rounded-full ${article.authorColor || "bg-primary-container text-on-primary"} flex items-center justify-center font-headline-sm text-xs`}>
                                                    {article.authorInitial || "NX"}
                                                </div>
                                                <span className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1 max-w-[130px]">
                                                    {article.author}
                                                </span>
                                            </div>
                                            <span className="text-secondary font-label-md text-label-md font-semibold group-hover:translate-x-1 transition-transform inline-flex items-center gap-0.5">
                                                Chi tiết
                                                <span className="material-symbols-outlined text-base">arrow_forward</span>
                                            </span>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}

                        {/* Phân trang chuẩn 6 bài/trang */}
                        {totalPages > 1 && (
                            <nav
                                aria-label="Pagination Navigation"
                                className="flex flex-col sm:flex-row items-center justify-between gap-space-sm bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-low mt-space-sm"
                            >
                                <div className="font-body-sm text-body-sm text-on-surface-variant">
                                    Hiển thị{" "}
                                    <span className="font-semibold text-primary">
                                        {(activePage - 1) * pageSize + 1} -{" "}
                                        {Math.min(activePage * pageSize, filteredArticles.length)}
                                    </span>{" "}
                                    trên tổng số{" "}
                                    <span className="font-semibold text-primary">
                                        {filteredArticles.length}
                                    </span>{" "}
                                    bài viết
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => handlePageChange(activePage - 1)}
                                        disabled={activePage === 1}
                                        className={`px-space-sm py-1.5 rounded-lg font-label-md text-label-md flex items-center gap-1 transition-all ${
                                            activePage === 1
                                                ? "text-outline bg-surface-container-low cursor-not-allowed opacity-50"
                                                : "text-primary bg-surface-container hover:bg-surface-container-high cursor-pointer"
                                        }`}
                                        type="button"
                                    >
                                        <span className="material-symbols-outlined text-base">chevron_left</span>
                                        Trước
                                    </button>

                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                                        const isCurrent = pageNum === activePage;
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => handlePageChange(pageNum)}
                                                className={`w-8 h-8 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
                                                    isCurrent
                                                        ? "bg-primary text-on-primary font-bold shadow-sm"
                                                        : "text-on-surface hover:bg-surface-container"
                                                }`}
                                                type="button"
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}

                                    <button
                                        onClick={() => handlePageChange(activePage + 1)}
                                        disabled={activePage === totalPages}
                                        className={`px-space-sm py-1.5 rounded-lg font-label-md text-label-md flex items-center gap-1 transition-all ${
                                            activePage === totalPages
                                                ? "text-outline bg-surface-container-low cursor-not-allowed opacity-50"
                                                : "text-primary bg-surface-container hover:bg-surface-container-high cursor-pointer"
                                        }`}
                                        type="button"
                                    >
                                        Sau
                                        <span className="material-symbols-outlined text-base">chevron_right</span>
                                    </button>
                                </div>
                            </nav>
                        )}
                    </div>

                    {/* CỘT PHẢI: Deep Intelligence Sidebar (4 cols) */}
                    <aside className="lg:col-span-4 flex flex-col gap-space-lg">
                        {/* Widget 1: Báo Cáo Chuyên Sâu */}
                        <div className="relative rounded-xl overflow-hidden bg-primary text-on-primary p-space-lg shadow-lg flex flex-col justify-between">
                            <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-secondary/30 blur-2xl pointer-events-none"></div>
                            <div className="absolute -left-10 -bottom-10 w-32 h-32 rounded-full bg-on-tertiary-container/20 blur-xl pointer-events-none"></div>
                            <div className="relative z-10 flex flex-col gap-space-sm">
                                <div className="flex items-center gap-space-xs text-on-tertiary-container font-label-sm text-label-sm uppercase tracking-wider font-bold">
                                    <span className="material-symbols-outlined text-sm">menu_book</span>
                                    BÁO CÁO ĐỘC QUYỀN
                                </div>
                                <h3 className="font-headline-md text-headline-md text-on-primary tracking-tight">
                                    Toàn Cảnh Vận Tải Hàng Không Việt Nam &amp; Đông Nam Á 2026
                                </h3>
                                <p className="font-body-sm text-body-sm text-surface-container">
                                    Tài liệu 56 trang phân tích chuyên sâu về công suất cảng hàng không mới Long Thành, chi phí cước biển - bay kết hợp (Sea-Air) và dự báo chu kỳ 2026-2030.
                                </p>
                                <div className="p-space-sm rounded-lg bg-primary-container flex items-center gap-space-sm my-space-xs">
                                    <span className="material-symbols-outlined text-secondary-fixed text-2xl">picture_as_pdf</span>
                                    <div className="flex flex-col">
                                        <span className="font-label-md text-label-md text-on-primary">NEXLOG_Annual_AirCargo_Report_2026.pdf</span>
                                        <span className="font-data-mono text-label-sm text-surface-dim">Dung lượng: 14.8 MB • Định dạng song ngữ</span>
                                    </div>
                                </div>
                            </div>
                            <div className="relative z-10 pt-space-sm">
                                <button className="w-full py-space-sm px-space-md rounded-xl bg-on-tertiary-container hover:bg-tertiary-container text-on-primary font-label-lg text-label-lg font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer" type="button">
                                    <span className="material-symbols-outlined text-lg">download</span>
                                    Tải PDF Báo Cáo Miễn Phí
                                </button>
                                <span className="block text-center font-label-sm text-label-sm text-surface-dim mt-2">
                                    Dành riêng cho doanh nghiệp XNK và đơn vị Logistics
                                </span>
                            </div>
                        </div>

                        {/* Widget 2: Tin Đọc Nhiều Nhất */}
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

                        {/* Widget 3: Bản Tin Hàng Không */}
                        <div className="bg-surface-container rounded-xl p-space-lg shadow-sm flex flex-col gap-space-sm">
                            <div className="w-10 h-10 rounded-lg bg-surface-container-lowest text-primary flex items-center justify-center shadow-sm">
                                <span className="material-symbols-outlined text-secondary">forward_to_inbox</span>
                            </div>
                            <h3 className="font-headline-md text-headline-md text-primary tracking-tight">
                                Đăng Ký Nhận Bản Tin Hàng Không
                            </h3>
                            <p className="font-body-md text-body-md text-on-surface-variant">
                                Phân tích tỷ giá cước, lịch trình chuyến bay hàng tuần và cảnh báo điều hành độc quyền từ đội ngũ phân tích NEXLOG.
                            </p>
                            <form className="flex flex-col gap-space-xs mt-space-xs" onSubmit={(e) => e.preventDefault()}>
                                <input className="px-space-md py-space-sm rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary shadow-sm" placeholder="nhan.su@doanhnghiep.vn" required="" type="email" />
                                <button className="w-full py-space-sm bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer" type="submit">
                                    <span>Xác nhận đăng ký</span>
                                    <span className="material-symbols-outlined text-base">send</span>
                                </button>
                            </form>
                            <div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm pt-space-xs">
                                <span className="material-symbols-outlined text-xs text-secondary">verified_user</span>
                                <span>Cam kết tuyệt đối không gửi thư rác. Hủy bất cứ lúc nào.</span>
                            </div>
                        </div>

                        {/* Widget 4: Chủ Đề Phổ Biến */}
                        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md border border-surface-container-low">
                            <div className="flex items-center gap-space-xs">
                                <span className="material-symbols-outlined text-secondary">tag</span>
                                <h3 className="font-headline-sm text-headline-sm text-primary">Chủ Đề Phổ Biến</h3>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.filter((c) => c !== "Tất cả").map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => {
                                            setSelectedCategory(c);
                                            setCurrentPage(1);
                                        }}
                                        className="px-space-sm py-1 rounded bg-surface-container-low hover:bg-surface-container-high text-primary font-label-sm text-label-sm transition-colors cursor-pointer"
                                        type="button"
                                    >
                                        #{c.replace(/\s+/g, "")}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Hotline */}
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
            </section>
        </div>
    );
}
