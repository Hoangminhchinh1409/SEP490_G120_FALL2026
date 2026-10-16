"use client";
import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { API_URL } from "@/src/api/apiConfig";


const CATEGORIES = [
    "Tất cả",
    "Thị trường & Vận hành",
    "Công nghệ & AI Chuỗi cung ứng",
    "Hạ tầng Ga hàng không",
    "Chính sách & Hải quan",
    "Thông báo nội bộ"
];

// Hàm hỗ trợ phân tích nội dung bài viết và hiển thị định dạng chuẩn
function renderArticleContent(content) {
    if (!content) return null;
    const lines = content.split("\n");
    const elements = [];
    let currentList = [];

    const flushList = () => {
        if (currentList.length > 0) {
            elements.push(
                <ul key={`ul-${elements.length}`} className="my-4 space-y-2.5 pl-6 list-disc text-on-surface font-body-md">
                    {currentList.map((item, idx) => (
                        <li key={idx} className="leading-relaxed">
                            {renderInlineText(item)}
                        </li>
                    ))}
                </ul>
            );
            currentList = [];
        }
    };

    lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
            flushList();
            return;
        }

        if (trimmed.startsWith("### ")) {
            flushList();
            elements.push(
                <h3 key={`h3-${idx}`} className="font-headline-md text-2xl text-primary font-bold mt-8 mb-3 tracking-tight">
                    {trimmed.replace(/^###\s+/, "")}
                </h3>
            );
        } else if (trimmed.startsWith("## ")) {
            flushList();
            elements.push(
                <h2 key={`h2-${idx}`} className="font-headline-lg text-3xl text-primary font-bold mt-10 mb-4 tracking-tight border-b border-surface-container pb-2">
                    {trimmed.replace(/^##\s+/, "")}
                </h2>
            );
        } else if (trimmed.startsWith("> ")) {
            flushList();
            elements.push(
                <blockquote key={`quote-${idx}`} className="my-6 p-space-md border-l-4 border-on-tertiary-container bg-surface-container-low rounded-r-xl italic font-body-lg text-primary text-lg leading-relaxed shadow-sm">
                    {trimmed.replace(/^>\s+/, "")}
                </blockquote>
            );
        } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            currentList.push(trimmed.replace(/^[-*]\s+/, ""));
        } else if (/^\d+\.\s+/.test(trimmed)) {
            flushList();
            elements.push(
                <div key={`p-${idx}`} className="font-body-md text-on-surface leading-relaxed text-base my-3 flex items-start gap-2">
                    <span className="font-bold text-secondary">{trimmed.match(/^\d+\./)[0]}</span>
                    <span>{renderInlineText(trimmed.replace(/^\d+\.\s+/, ""))}</span>
                </div>
            );
        } else {
            flushList();
            elements.push(
                <p key={`p-${idx}`} className="font-body-md text-on-surface/90 leading-relaxed text-base my-4">
                    {renderInlineText(trimmed)}
                </p>
            );
        }
    });

    flushList();
    return elements;
}

function renderInlineText(text) {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={i} className="font-bold text-primary">{part.slice(2, -2)}</strong>;
        }
        return part;
    });
}

const BlogPage = () => {
    // Danh sách bài viết
    const [articles, setArticles] = useState([]);

    // Trạng thái bộ lọc và phân trang
    const [selectedCategory, setSelectedCategory] = useState("Tất cả");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState("newest");
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 6; // Yêu cầu: Nếu nhiều hơn 6 bài viết thì chuyển sang trang sau

    // Bài viết được chọn xem chi tiết (nếu null -> hiển thị danh sách)
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [copied, setCopied] = useState(false);

    // Fetch dữ liệu từ backend
    useEffect(() => {
        const fetchBlogs = async () => {
            try {
                const res = await fetch(`${API_URL}/blogs`);
                const data = await res.json();
                if (data.success && Array.isArray(data.blogs) && data.blogs.length > 0) {
                    setArticles(data.blogs);
                }
            } catch (error) {
                console.error("Lỗi khi tải danh sách tin tức từ server:", error);
            }
        };

        fetchBlogs();
    }, []);

    // Đồng bộ URL parameter (?id=...) khi mở trang hoặc nhấn back/forward
    useEffect(() => {
        const handleUrlSync = async () => {
            if (typeof window === "undefined") return;
            const params = new URLSearchParams(window.location.search);
            const id = params.get("id");

            if (id) {
                const existing = articles.find((a) => a.id.toString() === id.toString());
                if (existing) {
                    setSelectedArticle(existing);
                }
                // Đồng thời gọi API lấy bản ghi chi tiết và tăng lượt xem
                try {
                    const res = await fetch(`${API_URL}/blogs/${id}`);
                    const data = await res.json();
                    if (data.success && data.blog) {
                        setSelectedArticle({
                            ...data.blog,
                            relatedBlogs: data.related || []
                        });
                    }
                } catch (err) {
                    console.error("Lỗi lấy chi tiết bài viết từ API:", err);
                }
            } else {
                setSelectedArticle(null);
            }
        };

        handleUrlSync();
        window.addEventListener("popstate", handleUrlSync);
        return () => window.removeEventListener("popstate", handleUrlSync);
    }, [articles]);

    // Chọn xem chi tiết bài viết
    const handleSelectArticle = async (article) => {
        setSelectedArticle(article);
        window.scrollTo({ top: 0, behavior: "smooth" });

        if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.set("id", article.id);
            window.history.pushState({ articleId: article.id }, "", url.toString());
        }

        // Tăng view & lấy bài viết liên quan từ backend
        try {
            const res = await fetch(`${API_URL}/blogs/${article.id}`);
            const data = await res.json();
            if (data.success && data.blog) {
                setSelectedArticle({
                    ...data.blog,
                    relatedBlogs: data.related || []
                });
            }
        } catch (err) {
            console.error("Lỗi cập nhật lượt xem bài viết:", err);
        }
    };

    // Quay lại danh sách tin tức
    const handleBackToList = () => {
        setSelectedArticle(null);
        window.scrollTo({ top: 0, behavior: "smooth" });

        if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("id");
            window.history.pushState({}, "", url.pathname);
        }
    };

    // Sao chép link bài viết
    const handleCopyLink = () => {
        if (typeof window !== "undefined") {
            navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Lọc và sắp xếp danh sách bài viết
    const filteredArticles = useMemo(() => {
        let result = [...articles];

        // Lọc chuyên mục
        if (selectedCategory !== "Tất cả") {
            result = result.filter((a) => a.category === selectedCategory);
        }

        // Lọc tìm kiếm
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (a) =>
                    a.title?.toLowerCase().includes(q) ||
                    a.summary?.toLowerCase().includes(q) ||
                    a.author?.toLowerCase().includes(q) ||
                    a.category?.toLowerCase().includes(q)
            );
        }

        // Sắp xếp
        if (sortBy === "views") {
            result.sort((a, b) => (b.views || 0) - (a.views || 0));
        } else if (sortBy === "title") {
            result.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        } else {
            // "newest"
            result.sort((a, b) => b.id - a.id);
        }

        return result;
    }, [articles, selectedCategory, searchQuery, sortBy]);

    // Tính toán phân trang
    const totalPages = Math.max(1, Math.ceil(filteredArticles.length / pageSize));
    const activePage = Math.min(currentPage, totalPages);

    // Lấy bài viết của trang hiện tại
    const paginatedArticles = useMemo(() => {
        const start = (activePage - 1) * pageSize;
        return filteredArticles.slice(start, start + pageSize);
    }, [filteredArticles, activePage, pageSize]);

    // Chuyển trang và cuộn lên
    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
            const gridSection = document.getElementById("articles-grid-top");
            if (gridSection) {
                gridSection.scrollIntoView({ behavior: "smooth", block: "start" });
            } else {
                window.scrollTo({ top: 380, behavior: "smooth" });
            }
        }
    };

    // Bài viết tiêu điểm (bài đầu tiên trong danh sách)
    const featuredArticle = articles[0] || null;

    // 4 bài đọc nhiều nhất cho widget sidebar
    const trendingArticles = useMemo(() => {
        return [...articles].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 4);
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
                        <nav className="hidden lg:flex items-center gap-space-lg ml-space-md" data-active-classes="text-secondary font-headline-sm">
                            <Link className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" href="/#about">
                                Về NEXLOG
                            </Link>
                            <Link className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" href="/#services">
                                Dịch vụ
                            </Link>
                            <Link className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" href="/#clients">
                                Khách hàng
                            </Link>
                            <button
                                onClick={handleBackToList}
                                className="font-label-lg text-label-lg text-secondary font-headline-sm transition-colors cursor-pointer"
                            >
                                Tin tức
                            </button>
                            <Link className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" href="/#contact">
                                Liên hệ
                            </Link>
                        </nav>
                    </div>
                    <div className="flex items-center gap-space-md">
                        <a className="hidden md:flex items-center gap-space-xs text-primary font-headline-sm text-headline-sm hover:text-secondary transition-colors" href="tel:19003133">
                            <span className="material-symbols-outlined text-secondary">call</span>
                            <span>1900 3133</span>
                        </a>
                        <div className="hidden sm:flex items-center gap-space-sm">
                            <Link className="px-space-md py-space-sm rounded-xl font-label-lg text-label-lg text-primary-container bg-surface-container-low hover:bg-primary-container hover:text-on-primary transition-all" href="/#tracking">
                                Tra cứu
                            </Link>
                            <a className="px-space-md py-space-sm rounded-xl font-label-lg text-label-lg text-on-primary bg-on-tertiary-container hover:bg-tertiary-container transition-all" href="tel:19003133">
                                Nhận tư vấn
                            </a>
                        </div>
                        <div className="flex items-center font-label-md text-label-md text-on-surface-variant">
                            <span className="font-headline-sm text-primary">VI</span>
                            <span className="mx-space-xs text-outline-variant">|</span>
                            <span className="hover:text-on-surface cursor-pointer">EN</span>
                        </div>
                        <img alt="Profile" className="w-8 h-8 rounded-full object-cover shadow-sm ml-space-xs" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDmW2mEHscI8ywmuR-goxPYNT6WbtPICxUhM77K-grZ0b40JJgHGs8RwcDXPPnJv7PA747w4ShJqRTmbJVt9vX8PkqQYCZ1QY4PLmhsmEKLM6Rs8DA1zvB1E_5x82nlkeue-fig8EHHKWweiOsJ_b8jCx6qO2mlJkWjgdBaogzYI1UZsfNdqcOB_v3ogVnHa8Drq6oztuFl4N00Do5zLh0eCB4WkGpxq1XrpTjmoHRI5KBImYDcEphj" />
                    </div>
                </div>
            </header>

            <main className="w-full pt-20 bg-surface min-h-screen">
                {/* Dải gradient trang trí */}
                <div className="w-full h-1 bg-gradient-to-r from-primary via-on-tertiary-container to-secondary"></div>

                {/* =========================================================================
                    TRƯỜNG HỢP 1: XEM CHI TIẾT TOÀN BỘ BÀI VIẾT KHI ĐƯỢC CHỌN
                ========================================================================= */}
                {selectedArticle ? (
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
                ) : (
                    /* =========================================================================
                        TRƯỜNG HỢP 2: DANH SÁCH BÀI VIẾT VÀ PHÂN TRANG CHUẨN 6 BÀI/TRANG
                    ========================================================================= */
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
                                            <p className="text-on-surface-variant text-body-md max-w-md">
                                                Không có bài viết nào phù hợp với từ khóa &quot;{searchQuery}&quot; trong chuyên mục này.
                                            </p>
                                            <button
                                                onClick={() => {
                                                    setSearchQuery("");
                                                    setSelectedCategory("Tất cả");
                                                }}
                                                className="mt-space-xs px-space-md py-2 rounded-xl bg-primary text-on-primary font-label-md"
                                                type="button"
                                            >
                                                Đặt lại bộ lọc
                                            </button>
                                        </div>
                                    ) : (
                                        /* 2-Column Card Grid hiển thị chính xác tối đa 6 bài viết mỗi trang */
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                                            {paginatedArticles.map((article) => (
                                                <article
                                                    key={article.id}
                                                    className="bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group border border-surface-container-low"
                                                >
                                                    {/* Hình ảnh đại diện bài viết */}
                                                    <div
                                                        onClick={() => handleSelectArticle(article)}
                                                        className="relative h-48 w-full overflow-hidden bg-surface-container cursor-pointer"
                                                    >
                                                        <img
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                            src={article.image || "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80"}
                                                            alt={article.title}
                                                        />
                                                        <span className="absolute top-space-xs left-space-xs px-2 py-0.5 rounded bg-surface-container-lowest/90 backdrop-blur font-label-sm text-label-sm text-secondary font-semibold shadow-sm">
                                                            {article.category}
                                                        </span>
                                                    </div>

                                                    {/* Nội dung card */}
                                                    <div className="p-space-md flex-1 flex flex-col justify-between">
                                                        <div className="flex flex-col gap-space-xs">
                                                            <span className="font-data-mono text-label-sm text-on-surface-variant">
                                                                {article.publishDate || "Mới đăng"} • 4 phút đọc
                                                            </span>
                                                            <h3
                                                                onClick={() => handleSelectArticle(article)}
                                                                className="font-headline-sm text-headline-sm text-primary hover:text-secondary transition-colors line-clamp-2 cursor-pointer"
                                                            >
                                                                {article.title}
                                                            </h3>
                                                            <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2">
                                                                {article.summary}
                                                            </p>
                                                        </div>

                                                        <div className="mt-space-md pt-space-xs flex items-center justify-between font-label-md text-label-md text-on-surface-variant border-t border-surface-container-low">
                                                            <span className="flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-sm">person</span>
                                                                <span className="truncate max-w-[140px]">{article.author}</span>
                                                            </span>
                                                            <button
                                                                onClick={() => handleSelectArticle(article)}
                                                                type="button"
                                                                className="text-secondary group-hover:translate-x-1 transition-transform flex items-center font-semibold cursor-pointer"
                                                            >
                                                                Chi tiết <span className="material-symbols-outlined text-sm">chevron_right</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                    )}

                                    {/* =========================================================
                                        THANH PHÂN TRANG: TỰ ĐỘNG CHUYỂN TRANG NẾU HƠN 6 BÀI VIẾT
                                    ========================================================= */}
                                    {filteredArticles.length > 0 && (
                                        <nav
                                            aria-label="Phân trang danh sách bài viết"
                                            className="flex flex-col sm:flex-row items-center justify-between gap-space-sm bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-low mt-space-sm"
                                        >
                                            {/* Thống kê số lượng bài viết đang hiển thị */}
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

                                            {/* Nút điều hướng các trang */}
                                            <div className="flex items-center gap-1.5">
                                                {/* Nút Trước */}
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

                                                {/* Các nút số trang (1, 2, ...) */}
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

                                                {/* Nút Sau */}
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
