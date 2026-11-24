"use client";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { API_URL } from "@/src/api/apiConfig";
import BlogDetailView from "./components/BlogDetailView";
import BlogListView from "./components/BlogListView";

const CATEGORIES = [
    "Tất cả",
    "Thị trường & Vận hành",
    "Công nghệ & AI",
    "Hạ tầng Ga hàng không",
    "Chính sách & Hải quan",
    "Thông báo nội bộ"
];

const getArticleTimestamp = (item) => {
    const raw = item?.publishedAt || item?.createdAt || item?.created_at;
    if (raw) {
        const ts = new Date(raw).getTime();
        if (!Number.isNaN(ts)) return ts;
    }
    return 0;
};

const BlogPage = () => {
    // Danh sách bài viết
    const [articles, setArticles] = useState([]);
    const [listLoading, setListLoading] = useState(true);

    // Trạng thái bộ lọc và phân trang
    const [selectedCategory, setSelectedCategory] = useState("Tất cả");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState("newest");
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 6; // Quy định 6 bài viết / trang

    // Bài viết được chọn xem chi tiết (nếu null -> hiển thị danh sách)
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState(null);
    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] = useState(false);
    const activeRequestRef = useRef(0);

    // Fetch danh sách bài viết đã xuất bản từ backend
    useEffect(() => {
        let mounted = true;
        const fetchBlogs = async () => {
            try {
                const res = await fetch(`${API_URL}/blogs`);
                const data = await res.json();
                if (mounted && data.success && Array.isArray(data.blogs)) {
                    setArticles(data.blogs);
                }
            } catch (error) {
                console.error("Lỗi khi tải danh sách tin tức từ server:", error);
            } finally {
                if (mounted) setListLoading(false);
            }
        };

        fetchBlogs();
        return () => {
            mounted = false;
        };
    }, []);

    // Tải chi tiết bài viết từ API (tăng 1 lượt xem và lấy bài viết liên quan)
    const loadArticleById = useCallback(async (id, fallbackArticle = null) => {
        const normalizedId = String(id ?? "").trim();
        if (!/^[1-9]\d*$/.test(normalizedId)) {
            activeRequestRef.current += 1;
            setSelectedArticle(null);
            setDetailError("Bài viết không tồn tại hoặc đã bị gỡ");
            setDetailLoading(false);
            return;
        }

        const requestToken = ++activeRequestRef.current;
        setDetailError(null);
        if (fallbackArticle) {
            setSelectedArticle(fallbackArticle);
            setDetailLoading(false);
        } else {
            setSelectedArticle(null);
            setDetailLoading(true);
        }

        try {
            const res = await fetch(`${API_URL}/blogs/${normalizedId}`);
            let data = null;
            try {
                data = await res.json();
            } catch {
                data = null;
            }

            if (requestToken !== activeRequestRef.current) return;

            if (res.status === 404 || !res.ok || !data?.success || !data?.blog) {
                setSelectedArticle(null);
                setDetailError(
                    res.status === 404
                        ? "Bài viết không tồn tại hoặc đã bị gỡ"
                        : (data?.message || "Không thể tải bài viết. Vui lòng thử lại sau.")
                );
                return;
            }

            setSelectedArticle({
                ...data.blog,
                relatedBlogs: Array.isArray(data.related) ? data.related : []
            });
            setArticles((prev) =>
                prev.map((a) =>
                    String(a.id) === String(data.blog.id)
                        ? { ...a, views: data.blog.views }
                        : a
                )
            );
        } catch (err) {
            if (requestToken !== activeRequestRef.current) return;
            console.error("Lỗi lấy chi tiết bài viết từ API:", err);
            if (!fallbackArticle) {
                setSelectedArticle(null);
                setDetailError("Không thể kết nối máy chủ để tải bài viết.");
            }
        } finally {
            if (requestToken === activeRequestRef.current) {
                setDetailLoading(false);
            }
        }
    }, []);

    // Đồng bộ URL parameter (?id=...) khi mở trang hoặc nhấn back/forward
    useEffect(() => {
        const handleUrlSync = () => {
            if (typeof window === "undefined") return;
            const params = new URLSearchParams(window.location.search);
            const id = params.get("id");

            if (id !== null && id !== "") {
                loadArticleById(id);
            } else if (params.has("id")) {
                loadArticleById("");
            } else {
                activeRequestRef.current += 1;
                setSelectedArticle(null);
                setDetailError(null);
                setDetailLoading(false);
            }
        };

        handleUrlSync();
        window.addEventListener("popstate", handleUrlSync);
        return () => window.removeEventListener("popstate", handleUrlSync);
    }, [loadArticleById]);

    // Lọc và sắp xếp bài viết
    const filteredArticles = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return articles
            .filter((item) => {
                const matchCategory =
                    selectedCategory === "Tất cả" ||
                    item.category === selectedCategory ||
                    (selectedCategory === "Công nghệ & AI" && item.category === "Công nghệ & AI Chuỗi cung ứng");
                const matchSearch =
                    q === "" ||
                    item.title?.toLowerCase().includes(q) ||
                    item.summary?.toLowerCase().includes(q) ||
                    item.content?.toLowerCase().includes(q);
                return matchCategory && matchSearch;
            })
            .sort((a, b) => {
                if (sortBy === "views") return (Number(b.views) || 0) - (Number(a.views) || 0);
                if (sortBy === "title") return (a.title || "").localeCompare(b.title || "", "vi");
                const diff = getArticleTimestamp(b) - getArticleTimestamp(a);
                if (diff !== 0) return diff;
                return (Number(b.id) || 0) - (Number(a.id) || 0);
            });
    }, [articles, selectedCategory, searchQuery, sortBy]);

    // Tính toán phân trang
    const totalPages = Math.max(1, Math.ceil(filteredArticles.length / pageSize));
    const activePage = Math.min(currentPage, totalPages);
    const paginatedArticles = useMemo(() => {
        const startIndex = (activePage - 1) * pageSize;
        return filteredArticles.slice(startIndex, startIndex + pageSize);
    }, [filteredArticles, activePage, pageSize]);

    // Xử lý chuyển bài viết & cập nhật URL
    const handleSelectArticle = (article) => {
        if (!article?.id) return;
        if (typeof window !== "undefined") {
            window.history.pushState({}, "", `/blog?id=${article.id}`);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
        loadArticleById(article.id, article);
    };

    const handleBackToList = () => {
        activeRequestRef.current += 1;
        setSelectedArticle(null);
        setDetailError(null);
        setDetailLoading(false);
        if (typeof window !== "undefined") {
            window.history.pushState({}, "", `/blog`);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const handleSelectCategoryFromDetail = (category) => {
        setSelectedCategory(category || "Tất cả");
        setCurrentPage(1);
        handleBackToList();
    };

    const handleCopyLink = async () => {
        if (typeof window === "undefined") return;
        const url = window.location.href;
        let copiedOk = false;

        try {
            if (navigator?.clipboard && typeof navigator.clipboard.writeText === "function") {
                await navigator.clipboard.writeText(url);
                copiedOk = true;
            }
        } catch {
            copiedOk = false;
        }

        if (!copiedOk && typeof document !== "undefined") {
            try {
                const textarea = document.createElement("textarea");
                textarea.value = url;
                textarea.setAttribute("readonly", "");
                textarea.style.position = "fixed";
                textarea.style.left = "-9999px";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                copiedOk = Boolean(document.execCommand && document.execCommand("copy"));
                document.body.removeChild(textarea);
            } catch {
                copiedOk = false;
            }
        }

        if (copiedOk) {
            setCopied(true);
            setCopyError(false);
            setTimeout(() => setCopied(false), 2500);
        } else {
            setCopied(false);
            setCopyError(true);
            setTimeout(() => setCopyError(false), 3000);
        }
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
            const gridEl = document.getElementById("articles-grid-top");
            if (gridEl) {
                gridEl.scrollIntoView({ behavior: "smooth" });
            } else {
                window.scrollTo({ top: 380, behavior: "smooth" });
            }
        }
    };

    // Bài viết tiêu điểm (ưu tiên bài có is_featured === true, mới nhất)
    const featuredArticle = useMemo(() => {
        return articles.find((a) => a.is_featured) || articles[0] || null;
    }, [articles]);

    // 4 bài đọc nhiều nhất cho widget sidebar
    const trendingArticles = useMemo(() => {
        return [...articles].sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0)).slice(0, 4);
    }, [articles]);

    return (
        <div className="bg-surface font-body-md text-body-md text-on-surface antialiased min-h-screen flex flex-col justify-between">
            {/* Header chung */}
            <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(15,43,92,0.06)] border-b border-surface-container/60">
                <div className="h-20 w-full px-margin-lg flex items-center justify-between">
                    <div className="flex items-center gap-space-lg">
                        <Link className="flex items-center gap-space-xs group" data-path="trang-chu" href="/">
                            <span className="font-headline-lg text-headline-lg text-primary tracking-tight">
                                NEX<span className="text-on-tertiary-container">LOG</span>
                            </span>
                            <span className="hidden xl:inline-block px-space-xs py-0.5 rounded bg-surface-container-low text-secondary font-label-sm text-label-sm uppercase tracking-wider">
                                AeroCargo
                            </span>
                        </Link>
                        <nav className="hidden lg:flex items-center gap-space-lg ml-space-md">
                            <Link className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" href="/#about">
                                Về NEXLOG
                            </Link>
                            <Link className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" href="/#services">
                                Dịch vụ
                            </Link>
                            <Link className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" href="/#clients">
                                Khách hàng &amp; Đối tác
                            </Link>
                            <Link className="font-label-lg text-label-lg text-secondary font-bold" href="/blog">
                                Tin tức &amp; Sự kiện
                            </Link>
                            <Link className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" href="/#faq">
                                Hỏi đáp
                            </Link>
                        </nav>
                    </div>

                    <div className="flex items-center gap-space-sm">
                        {/* Đã gỡ nút Đăng nhập hệ thống trên trang tin tức công khai cho khách hàng */}
                    </div>
                </div>
            </header>

            {/* Nội dung trang: Chi tiết, Thông báo không tìm thấy, hoặc Danh sách */}
            <main className="flex-1 pt-20">
                {detailLoading ? (
                    <div className="w-full px-margin-lg py-space-xl">
                        <div className="max-w-3xl mx-auto bg-surface-container-lowest p-space-xl rounded-2xl shadow-sm border border-surface-container-low text-center flex flex-col items-center gap-space-sm">
                            <span className="material-symbols-outlined text-4xl text-secondary animate-spin">progress_activity</span>
                            <p className="font-headline-sm text-primary">Đang tải nội dung bài viết...</p>
                        </div>
                    </div>
                ) : detailError ? (
                    <div className="w-full px-margin-lg py-space-xl">
                        <div className="max-w-2xl mx-auto bg-surface-container-lowest p-space-xl rounded-2xl shadow-sm border border-surface-container-low text-center flex flex-col items-center gap-space-md">
                            <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center text-secondary">
                                <span className="material-symbols-outlined text-4xl">article</span>
                            </div>
                            <h1 className="font-headline-lg text-2xl text-primary font-bold">
                                {detailError}
                            </h1>
                            <p className="font-body-md text-on-surface-variant max-w-md">
                                Liên kết bài viết bạn truy cập không hợp lệ, không tồn tại hoặc bài viết đã bị gỡ khỏi hệ thống.
                            </p>
                            <button
                                onClick={handleBackToList}
                                type="button"
                                className="inline-flex items-center gap-2 px-space-lg py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-lg transition-colors cursor-pointer shadow-sm"
                            >
                                <span className="material-symbols-outlined text-base">arrow_back</span>
                                Quay lại danh sách tin tức
                            </button>
                        </div>
                    </div>
                ) : selectedArticle ? (
                    <BlogDetailView
                        selectedArticle={selectedArticle}
                        handleBackToList={handleBackToList}
                        handleSelectArticle={handleSelectArticle}
                        handleCopyLink={handleCopyLink}
                        copied={copied}
                        copyError={copyError}
                        trendingArticles={trendingArticles}
                        onSelectCategory={handleSelectCategoryFromDetail}
                    />
                ) : (
                    <BlogListView
                        CATEGORIES={CATEGORIES}
                        selectedCategory={selectedCategory}
                        setSelectedCategory={setSelectedCategory}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        sortBy={sortBy}
                        setSortBy={setSortBy}
                        setCurrentPage={setCurrentPage}
                        featuredArticle={featuredArticle}
                        filteredArticles={filteredArticles}
                        paginatedArticles={paginatedArticles}
                        activePage={activePage}
                        totalPages={totalPages}
                        pageSize={pageSize}
                        handlePageChange={handlePageChange}
                        handleSelectArticle={handleSelectArticle}
                        trendingArticles={trendingArticles}
                        listLoading={listLoading}
                    />
                )}
            </main>

            {/* Footer chung */}
            <footer className="w-full bg-primary text-surface-container-high mt-auto">
                <div className="w-full px-margin-lg py-space-xl">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg pb-space-xl">
                        <div className="lg:col-span-7 flex flex-col gap-space-sm">
                            <div className="font-headline-lg text-headline-lg text-on-primary tracking-tight">CÔNG TY CỔ PHẦN LOGISTICS NEXLOG</div>
                            <p className="font-body-md text-body-md text-surface-dim">Cổng thông tin logistics và điều phối vận chuyển hàng không thông minh đa phương thức, kiểm soát chuỗi cung ứng chuẩn xác tuyệt đối.</p>
                            <div className="flex flex-col gap-space-xs font-body-md text-body-md text-surface-container mt-space-sm">
                                <p className="flex items-center gap-space-xs"><span className="material-symbols-outlined text-secondary-fixed text-sm">verified</span><span>Giấy phép ĐKKD: 0108992834 do Sở KH&amp;ĐT cấp ngày 15/04/2018</span></p>
                                <p className="flex items-center gap-space-xs"><span className="material-symbols-outlined text-secondary-fixed text-sm">location_on</span><span>Trụ sở chính: Tầng 12A, NEXLOG Aviation Tower, Đường Trường Sơn, Phường 2, Tân Bình, TP. Hồ Chí Minh</span></p>
                                <p className="flex items-center gap-space-xs"><span className="material-symbols-outlined text-secondary-fixed text-sm">phone_in_talk</span><span>Hotline hỗ trợ: <strong className="text-on-primary">1900 3133</strong></span></p>
                                <p className="flex items-center gap-space-xs"><span className="material-symbols-outlined text-secondary-fixed text-sm">mail</span><span>Email tiếp nhận thông tin: <strong className="text-on-primary">contact@nexlog.vn</strong></span></p>
                            </div>
                            <div className="mt-space-md"><a className="font-label-md text-label-md text-secondary-fixed hover:text-on-primary transition-colors underline decoration-outline-variant underline-offset-4" data-path="chinh-sach-bao-mat" href="#">Chính sách bảo mật dữ liệu &amp; vận hành</a></div>
                        </div>
                        <div className="lg:col-span-5 flex flex-col justify-start bg-primary-container p-space-lg rounded-xl shadow-lg">
                            <h3 className="font-headline-md text-headline-md text-on-primary uppercase tracking-tight">Đăng ký nhận bản tin từ NEXLOG</h3>
                            <p className="font-body-md text-body-md text-surface-variant mt-space-xs mb-space-md">Cập nhật biến động cước vận chuyển hàng không, lịch trình bay và cảnh báo tắc nghẽn cảng biển hàng tuần.</p>
                            <form className="flex flex-col sm:flex-row gap-space-xs" onSubmit={(e) => e.preventDefault()}>
                                <input className="flex-1 px-space-md py-space-sm rounded-lg bg-surface text-on-surface font-body-md text-body-md placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary" placeholder="Nhập email doanh nghiệp của bạn..." type="email" />
                                <button className="px-space-lg py-space-sm bg-on-tertiary-container hover:bg-tertiary-container text-on-primary font-label-lg text-label-lg rounded-lg transition-colors text-center whitespace-nowrap cursor-pointer" type="submit">Đăng ký</button>
                            </form>
                            <div className="flex items-center gap-space-xs mt-space-sm text-surface-dim font-label-sm text-label-sm"><span className="material-symbols-outlined text-sm text-secondary-fixed">shield</span><span>Bảo vệ quyền riêng tư theo tiêu chuẩn IATA Security.</span></div>
                        </div>
                    </div>
                    <div className="pt-space-md flex flex-col sm:flex-row items-center justify-between gap-space-sm text-surface-dim font-label-sm text-label-sm border-t border-surface-container/20">
                        <p>© 2026 NEXLOG Logistics JSC. All rights reserved.</p>
                        <p>Hệ thống giám sát không gian điều vận hàng không thông minh quốc tế.</p>
                    </div>
                </div>
            </footer>

            {/* Nút Chat hỗ trợ nổi */}
            <div className="fixed bottom-space-lg right-space-lg z-50">
                <button aria-label="Hỗ trợ trực tuyến" className="w-14 h-14 rounded-full bg-on-tertiary-container text-on-primary shadow-xl hover:bg-tertiary-container flex items-center justify-center transition-all cursor-pointer" type="button">
                    <span className="material-symbols-outlined text-2xl">chat</span>
                </button>
            </div>
        </div>
    );
};

export default BlogPage;
