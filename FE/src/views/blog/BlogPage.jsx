"use client";
import React from "react";

const BlogPage = () => {
    return (
        <div className="bg-surface font-body-md text-body-md text-on-surface antialiased">


            <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(15,43,92,0.06)]"><div className="h-20 w-full px-margin-lg flex items-center justify-between"><div className="flex items-center gap-space-lg"><a className="flex items-center gap-space-xs group" data-path="trang-chu" href="/"><span className="font-headline-lg text-headline-lg text-primary tracking-tight">NEX<span className="text-on-tertiary-container">LOG</span></span><span className="hidden xl:inline-block px-space-xs py-0.5 rounded bg-surface-container-low text-secondary font-label-sm text-label-sm uppercase tracking-wider">AeroCargo</span></a><nav className="hidden lg:flex items-center gap-space-lg ml-space-md" data-active-classes="text-secondary font-headline-sm"><a className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" data-path="ve-nexlog" href="#">Về NEXLOG</a><a className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" data-path="dich-vu" href="#">Dịch vụ</a><a className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" data-path="khach-hang" href="#">Khách hàng</a><a className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" data-path="tin-tuc" href="/blog">Tin tức</a><a className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" data-path="lien-he" href="#">Liên hệ</a></nav></div><div className="flex items-center gap-space-md"><a className="hidden md:flex items-center gap-space-xs text-primary font-headline-sm text-headline-sm hover:text-secondary transition-colors" href="tel:19003133"><span className="material-symbols-outlined text-secondary">call</span><span>1900 3133</span></a><div className="hidden sm:flex items-center gap-space-sm"><a className="px-space-md py-space-sm rounded-xl font-label-lg text-label-lg text-primary-container bg-surface-container-low hover:bg-primary-container hover:text-on-primary transition-all" data-path="tra-cuu-van-don" href="#">Tra cứu</a><a className="px-space-md py-space-sm rounded-xl font-label-lg text-label-lg text-on-primary bg-on-tertiary-container hover:bg-tertiary-container transition-all" data-path="nhan-tu-van" href="#">Nhận tư vấn</a></div><div className="flex items-center font-label-md text-label-md text-on-surface-variant"><span className="font-headline-sm text-primary">VI</span><span className="mx-space-xs text-outline-variant">|</span><span className="hover:text-on-surface cursor-pointer">EN</span></div><img alt="Profile" className="w-8 h-8 rounded-full object-cover shadow-sm ml-space-xs" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDmW2mEHscI8ywmuR-goxPYNT6WbtPICxUhM77K-grZ0b40JJgHGs8RwcDXPPnJv7PA747w4ShJqRTmbJVt9vX8PkqQYCZ1QY4PLmhsmEKLM6Rs8DA1zvB1E_5x82nlkeue-fig8EHHKWweiOsJ_b8jCx6qO2mlJkWjgdBaogzYI1UZsfNdqcOB_v3ogVnHa8Drq6oztuFl4N00Do5zLh0eCB4WkGpxq1XrpTjmoHRI5KBImYDcEphj" /></div></div></header><main className="w-full pt-20 bg-surface min-h-screen"><div className="flex flex-col w-full">
                {/* Top Ambient Glow Line */}
                <div className="w-full h-1 bg-gradient-to-r from-primary via-on-tertiary-container to-secondary"></div>
                {/* Header & Filter Sub-Navigation Section */}
                <section className="w-full px-margin-lg py-space-xl bg-surface-container-lowest shadow-sm">
                    <div className="max-w-7xl mx-auto flex flex-col gap-space-lg">
                        {/* Breadcrumb */}
                        <nav aria-label="Breadcrumb" className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface-variant">
                            <a className="hover:text-secondary flex items-center gap-1 transition-colors" href="/">
                                <span className="material-symbols-outlined text-sm">home</span>
                                Trang chủ
                            </a>
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
                                    <input className="w-full pl-11 pr-space-md py-space-sm rounded-xl bg-surface text-on-surface font-body-md text-body-md placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary transition-all shadow-sm" placeholder="Tìm kiếm báo cáo, mã chuyến bay, công nghệ kho hoặc quy chuẩn IATA..." type="text" />
                                </div>
                                {/* Quick Sort Selector */}
                                <div className="flex items-center gap-space-xs bg-surface px-space-md py-space-sm rounded-xl shadow-sm text-on-surface">
                                    <span className="material-symbols-outlined text-outline text-lg">tune</span>
                                    <span className="font-label-md text-label-md text-on-surface-variant">Sắp xếp:</span>
                                    <select className="bg-transparent font-label-lg text-label-lg text-primary focus:outline-none cursor-pointer">
                                        <option>Mới nhất trước</option>
                                        <option>Xem nhiều nhất</option>
                                        <option>Báo cáo quan trọng</option>
                                    </select>
                                </div>
                            </div>
                            {/* Category Filter Tabs */}
                            <div className="flex items-center gap-space-xs overflow-x-auto pb-1 scrollbar-none">
                                <button className="px-space-md py-1.5 rounded-full font-label-lg text-label-lg bg-primary text-on-primary shadow-sm whitespace-nowrap" type="button">
                                    Tất cả
                                </button>
                                <button className="px-space-md py-1.5 rounded-full font-label-lg text-label-lg bg-surface-container hover:bg-surface-container-high text-on-surface whitespace-nowrap transition-colors" type="button">
                                    Thị trường &amp; Vận hành
                                </button>
                                <button className="px-space-md py-1.5 rounded-full font-label-lg text-label-lg bg-surface-container hover:bg-surface-container-high text-on-surface whitespace-nowrap transition-colors" type="button">
                                    Công nghệ &amp; AI Chuỗi cung ứng
                                </button>
                                <button className="px-space-md py-1.5 rounded-full font-label-lg text-label-lg bg-surface-container hover:bg-surface-container-high text-on-surface whitespace-nowrap transition-colors" type="button">
                                    Hạ tầng Ga hàng không
                                </button>
                                <button className="px-space-md py-1.5 rounded-full font-label-lg text-label-lg bg-surface-container hover:bg-surface-container-high text-on-surface whitespace-nowrap transition-colors" type="button">
                                    Chính sách &amp; Hải quan
                                </button>
                                <button className="px-space-md py-1.5 rounded-full font-label-lg text-label-lg bg-surface-container hover:bg-surface-container-high text-on-surface whitespace-nowrap transition-colors" type="button">
                                    Thông báo nội bộ
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
                {/* Featured Bento Section */}
                <section className="w-full px-margin-lg py-space-xl">
                    <div className="max-w-7xl mx-auto">
                        <div className="relative bg-surface-container-lowest rounded-xl shadow-md overflow-hidden grid grid-cols-1 lg:grid-cols-12 group">
                            {/* Visual Column (Inspired by airport cargo hub photography) */}
                            <div className="lg:col-span-7 relative min-h-[380px] lg:min-h-[460px] overflow-hidden">
                                <img className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" data-alt="A sprawling modern air cargo logistics center at twilight illuminated with cool neon and warm runway lights, large automated freight distribution warehouse with glass facade revealing multi-tier robotic AGV sorting belts, cargo transport trucks lined at loading docks and a widebody freighter jet parked on the apron in deep navy and vibrant amber tones." src="https://lh3.googleusercontent.com/aida-public/AB6AXuARy739AeSBPD3orKjnYwlWNCrNFrm50AhGiHjWyjmGPhZXqmlkc3vm0cdPD3jHwM6BIvIQJLtBafd25_m9Duv_y9SuFR1oXeyvWFbvDpwVQb2217Cm_AfA86sD9gqNfVu8yvmJubO1ZASsyvcbdIsNhknW-EbNU6D-KNsK-CfWw71Bx2Ke3QRU6k_aPSmqPtWVna6SHRKutTveozdkmTKKTPFX-IMZiZKcUyk-dZhbijNjNT7MlOCG" />
                                <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-primary/20 lg:to-surface-container-lowest"></div>
                                {/* Floating Live Dispatch Badge */}
                                <div className="absolute top-space-md left-space-md flex items-center gap-space-xs px-space-sm py-1 rounded bg-primary/80 backdrop-blur-md text-on-primary font-label-sm text-label-sm uppercase tracking-widest shadow-lg">
                                    <span className="material-symbols-outlined text-secondary-fixed text-base">flight_takeoff</span>
                                    Hub Miền Bắc • Nội Bài (HAN)
                                </div>
                                {/* Bottom Visual Tag */}
                                <div className="absolute bottom-space-md left-space-md hidden sm:flex items-center gap-space-xs text-on-primary font-label-sm text-label-sm bg-inverse-surface/80 backdrop-blur px-space-sm py-1 rounded">
                                    <span className="material-symbols-outlined text-on-tertiary-container text-sm">hub</span>
                                    <span>Diện tích vận hành mở rộng: 150.000 m²</span>
                                </div>
                            </div>
                            {/* Featured Content Column */}
                            <div className="lg:col-span-5 p-space-lg lg:p-space-xl flex flex-col justify-between bg-surface-container-lowest">
                                <div className="flex flex-col gap-space-sm">
                                    <div className="flex items-center gap-space-xs">
                                        <span className="px-space-sm py-0.5 rounded bg-tertiary-container text-on-tertiary-container font-label-sm text-label-sm uppercase tracking-wider font-bold">
                                            Thị trường &amp; Vận hành
                                        </span>
                                        <span className="text-on-surface-variant font-data-mono text-label-sm">• TIÊU ĐIỂM THÁNG</span>
                                    </div>
                                    <a className="font-headline-lg text-headline-lg text-primary hover:text-secondary transition-colors tracking-tight line-clamp-3" href="#">
                                        NEXLOG Chính Thức Mở Rộng Ga Hàng Hóa Kéo Dài 150.000m² Tại Vùng Kinh Tế Trọng Điểm Phía Bắc
                                    </a>
                                    <p className="font-body-md text-body-md text-on-surface-variant line-clamp-4">
                                        Nhằm giải tỏa triệt để áp lực luân chuyển hàng hóa cho Sân bay Quốc tế Nội Bài, trung tâm gom hàng thông minh (Off-Airport Hub) được đầu tư đồng bộ hệ thống robot tự động AGV, sàn nâng tự động ULD và hệ thống thông quan điện tử tích hợp 24/7, rút ngắn thời gian xử lý mặt đất xuống 45 phút.
                                    </p>
                                </div>
                                <div className="pt-space-md mt-space-md bg-surface-container-low p-space-md rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                                    <div className="flex items-center gap-space-xs">
                                        <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-headline-sm">
                                            NX
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-label-lg text-label-lg text-primary">Ban Điều Hành NEXLOG</span>
                                            <span className="font-body-sm text-body-sm text-on-surface-variant">28.05.2026 • 5 phút đọc</span>
                                        </div>
                                    </div>
                                    <a className="inline-flex items-center gap-1 font-label-lg text-label-lg text-on-tertiary-container hover:text-tertiary-container font-semibold transition-colors" href="#">
                                        Đọc toàn bộ bài viết
                                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                {/* Main Body: 2-Column Responsive Layout */}
                <main className="w-full px-margin-lg pb-space-xl">
                    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-start">
                        {/* LEFT COLUMN: Main Articles Grid (8 cols) */}
                        <div className="lg:col-span-8 flex flex-col gap-space-lg">
                            <div className="flex items-center justify-between pb-space-xs">
                                <div className="flex items-center gap-space-xs">
                                    <span className="material-symbols-outlined text-secondary">feed</span>
                                    <h2 className="font-headline-md text-headline-md text-primary tracking-tight">Bài Viết Mới Xuất Bản</h2>
                                </div>
                                <span className="font-data-mono text-label-sm text-on-surface-variant">Trang 1 / 12 (Tổng 68 bài phân tích)</span>
                            </div>
                            {/* 2-Column Card Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                                {/* Article Card 1 */}
                                <article className="bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group">
                                    <div className="relative h-48 w-full overflow-hidden bg-surface-container">
                                        <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" data-alt="Modern pharmaceutical cold chain air freight container with digital IoT temperature sensors glowing inside an aircraft cargo hold, cold vapor and pristine blue medical cargo storage environment." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCbv4ygPYi7NiHzgM1_ydVsfl2TUEWdf9VsgKmPPj8zF44x0qGF7ZlyPJblgS2UBFp1vtdDOOu2ZqU2RRzb31XDrHM3nC3aoH7jgVtSR73r1ElvklxSzeGhDEKQTHW6QayEW0wC_RFkplJcHSu1i0gKshLNb3gfkI2eXxKIYqFlIuQWiBHrhwD1amEmOGR1KNLnjzB_ahhkqM8S5iYMd9YpMwp4YzsfvX6vbTxNEFGQkV-Tjzuoacb8" />
                                        <span className="absolute top-space-xs left-space-xs px-2 py-0.5 rounded bg-surface-container-lowest/90 backdrop-blur font-label-sm text-label-sm text-secondary font-semibold">
                                            Công nghệ &amp; AI
                                        </span>
                                    </div>
                                    <div className="p-space-md flex-1 flex flex-col justify-between">
                                        <div className="flex flex-col gap-space-xs">
                                            <span className="font-data-mono text-label-sm text-on-surface-variant">24.05.2026 • 4 phút đọc</span>
                                            <a className="font-headline-sm text-headline-sm text-primary hover:text-secondary transition-colors line-clamp-2" href="#">
                                                Ứng dụng AI và Cảm biến IoT Trong Giám Sát Nhiệt Độ Chuỗi Cung Ứng Lạnh Vận Chuyển Hàng Không
                                            </a>
                                            <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2">
                                                Cơ chế kích hoạt cảnh báo biến thiên 0.1°C tức thì theo tiêu chuẩn IATA CEIV Pharma qua vệ tinh LEO trên các tuyến bay đường dài.
                                            </p>
                                        </div>
                                        <div className="mt-space-md pt-space-xs flex items-center justify-between font-label-md text-label-md text-on-surface-variant">
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm">person</span>
                                                TS. Đặng Minh Quân
                                            </span>
                                            <span className="text-secondary group-hover:translate-x-1 transition-transform flex items-center">
                                                Chi tiết <span className="material-symbols-outlined text-sm">chevron_right</span>
                                            </span>
                                        </div>
                                    </div>
                                </article>
                                {/* Article Card 2 */}
                                <article className="bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group">
                                    <div className="relative h-48 w-full overflow-hidden bg-surface-container">
                                        <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" data-alt="Aviation safety inspectors examining lithium battery dangerous goods shipments with specialized warning labels and digital handheld barcode scanners on an air cargo sorting floor." src="https://lh3.googleusercontent.com/aida-public/AB6AXuB5-qe4DqRTnoFW4k7pwPpDzPUGkxfcG7DvCDN6wsIBCZsKLLXf2v7YnquNQVcIfKAFZG5jDIUiAegFEYeqK-ZcZB7iaHDC2thdnGKahae8jooA-w3nFukTDfCUOKpzI5Y9v6xbEXtRr5qPLUnKDJRau4p3cVbc-xpDqfT2q1j3y2tkkBgI4OaqZd7kOxz07eNC0YMFlwkDUNocSBfAYU4-3U-Vz5TEbprA3QTuKIoe97wRnUVJoT-I" />
                                        <span className="absolute top-space-xs left-space-xs px-2 py-0.5 rounded bg-surface-container-lowest/90 backdrop-blur font-label-sm text-label-sm text-on-tertiary-container font-semibold">
                                            Chính sách &amp; Quy chuẩn
                                        </span>
                                    </div>
                                    <div className="p-space-md flex-1 flex flex-col justify-between">
                                        <div className="flex flex-col gap-space-xs">
                                            <span className="font-data-mono text-label-sm text-on-surface-variant">20.05.2026 • 6 phút đọc</span>
                                            <a className="font-headline-sm text-headline-sm text-primary hover:text-secondary transition-colors line-clamp-2" href="#">
                                                IATA Công Bố Quy Chuẩn Mới Về Vận Tải Hàng Hóa Nguy Hiểm (DGR) Bản 2026: Doanh Nghiệp Cần Lưu Ý Gì?
                                            </a>
                                            <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2">
                                                Những điều chỉnh nghiêm ngặt liên quan đến đóng gói pin Lithium ion và chứng nhận điện tử e-DGD bắt buộc trên các hãng bay thành viên.
                                            </p>
                                        </div>
                                        <div className="mt-space-md pt-space-xs flex items-center justify-between font-label-md text-label-md text-on-surface-variant">
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm">person</span>
                                                Ban Pháp Chế NEXLOG
                                            </span>
                                            <span className="text-secondary group-hover:translate-x-1 transition-transform flex items-center">
                                                Chi tiết <span className="material-symbols-outlined text-sm">chevron_right</span>
                                            </span>
                                        </div>
                                    </div>
                                </article>
                                {/* Article Card 3 */}
                                <article className="bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group">
                                    <div className="relative h-48 w-full overflow-hidden bg-surface-container">
                                        <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" data-alt="Digital logistics dashboard showcasing global air cargo freight rates, world map flight paths connecting East Asia to North America with upward market graph lines and fuel index metrics." src="https://lh3.googleusercontent.com/aida-public/AB6AXuA3MFZ7kfiysIkDnH56wemTxk68o_IPmEP3KWYeKzfBvdH__EvjBIMWfXVajnoRq7NXan31LGub1gKc7jpLelTIUeEC9_BUUGZzzUv96n4VoxKoJJQXpqIU5O4cj85uUuryMT66nYmGLDFdHXt-tRQDI8i_tGb3xn6FJxycQqDdUCbhU7yvMGvqpbcl0u3_gfzvi3m04k8k4taTsyl28cjU4gMKeRPPjAyupTZFIv4urnrE7cGQrc7K" />
                                        <span className="absolute top-space-xs left-space-xs px-2 py-0.5 rounded bg-surface-container-lowest/90 backdrop-blur font-label-sm text-label-sm text-secondary font-semibold">
                                            Thị trường
                                        </span>
                                    </div>
                                    <div className="p-space-md flex-1 flex flex-col justify-between">
                                        <div className="flex flex-col gap-space-xs">
                                            <span className="font-data-mono text-label-sm text-on-surface-variant">16.05.2026 • 8 phút đọc</span>
                                            <a className="font-headline-sm text-headline-sm text-primary hover:text-secondary transition-colors line-clamp-2" href="#">
                                                Biến Động Cước Vận Tải Hàng Không Tuyến Châu Á - Bắc Mỹ Quý II/2026: Phân Tích &amp; Dự Báo
                                            </a>
                                            <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2">
                                                Tải trọng belly-hold phục hồi, biến động phụ phí nhiên liệu và chiến lược booking sớm để bảo toàn chi phí chuỗi cung ứng mùa cao điểm.
                                            </p>
                                        </div>
                                        <div className="mt-space-md pt-space-xs flex items-center justify-between font-label-md text-label-md text-on-surface-variant">
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm">person</span>
                                                Lê Hải Anh (Chuyên gia Phân tích)
                                            </span>
                                            <span className="text-secondary group-hover:translate-x-1 transition-transform flex items-center">
                                                Chi tiết <span className="material-symbols-outlined text-sm">chevron_right</span>
                                            </span>
                                        </div>
                                    </div>
                                </article>
                                {/* Article Card 4 */}
                                <article className="bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group">
                                    <div className="relative h-48 w-full overflow-hidden bg-surface-container">
                                        <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" data-alt="Commercial cargo jet interior showing precision loaded aluminum ULD containers strapped down with heavy duty netting, aeronautical logistics technicians verifying weight and balance." src="https://lh3.googleusercontent.com/aida-public/AB6AXuAjRAkduew4-Y3znz3f8DmZW4b1WggxEshtDDU-Xvvw2D861SVCeYtHRqGHrW_8Jn715G3qdk5rB6ORob-TwdTnxnGxTY2KpMIVnW6P-1MhIY6RrPvVynJamP1-SrQweUWdkOhGihFLTpalp3JTWuakjIwfI8KZFOUL3VEYtxaKmIyWCfeuZpRRoFXlyong8AQLl3GxlWW9L0oaWp1tHGVpLPa8HI9OYV-cIMkBUH5M6bRv-wlbcsoG" />
                                        <span className="absolute top-space-xs left-space-xs px-2 py-0.5 rounded bg-surface-container-lowest/90 backdrop-blur font-label-sm text-label-sm text-secondary font-semibold">
                                            Hợp tác quốc tế
                                        </span>
                                    </div>
                                    <div className="p-space-md flex-1 flex flex-col justify-between">
                                        <div className="flex flex-col gap-space-xs">
                                            <span className="font-data-mono text-label-sm text-on-surface-variant">12.05.2026 • 3 phút đọc</span>
                                            <a className="font-headline-sm text-headline-sm text-primary hover:text-secondary transition-colors line-clamp-2" href="#">
                                                NEXLOG Hợp Tác Chiến Lược Cùng Đối Tác Hàng Không Quốc Tế Tối Ưu Hóa Tải Trọng ULD
                                            </a>
                                            <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2">
                                                Ký kết thỏa thuận chia sẻ không gian khoang tải mở rộng cùng các hãng hàng không hàng đầu thế giới, đảm bảo slot bay cố định trong 365 ngày.
                                            </p>
                                        </div>
                                        <div className="mt-space-md pt-space-xs flex items-center justify-between font-label-md text-label-md text-on-surface-variant">
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm">person</span>
                                                Văn phòng Tổng Giám Đốc
                                            </span>
                                            <span className="text-secondary group-hover:translate-x-1 transition-transform flex items-center">
                                                Chi tiết <span className="material-symbols-outlined text-sm">chevron_right</span>
                                            </span>
                                        </div>
                                    </div>
                                </article>
                                {/* Article Card 5 */}
                                <article className="bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group">
                                    <div className="relative h-48 w-full overflow-hidden bg-surface-container">
                                        <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" data-alt="High tech customs clearance checkpoint in an air freight airport terminal, automated green lane biometric scanners and customs officials clearing pallets of semiconductors and electronics." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCBh8zGm9hVL-pTHTAJdsK_QgfhHffiBKlydsx-l6rLtrgl4d5N8XKoDPmxd82N-klJ1cft1MMUa_l7RhRHrQJHSB_lbzkCtNB12JgXANWK4qjURzwlXRRresCYrJPovWNMbpdPRDFM3zOgr0ti68BJZW9VYU97rI4UDdeP2zmw-OudZxQluXRyCzmjC-SWQfmSySBNOOWvgoAmeR1PP_XfVJwiWeRT3UFNWLBPkP00Zq_7dEY3C-fn" />
                                        <span className="absolute top-space-xs left-space-xs px-2 py-0.5 rounded bg-surface-container-lowest/90 backdrop-blur font-label-sm text-label-sm text-primary font-semibold">
                                            Hải quan
                                        </span>
                                    </div>
                                    <div className="p-space-md flex-1 flex flex-col justify-between">
                                        <div className="flex flex-col gap-space-xs">
                                            <span className="font-data-mono text-label-sm text-on-surface-variant">08.05.2026 • 5 phút đọc</span>
                                            <a className="font-headline-sm text-headline-sm text-primary hover:text-secondary transition-colors line-clamp-2" href="#">
                                                Quy Trình Thông Quan Nhanh Tại Ga Hàng Hóa Off-Airport Cho Hàng Điện Tử Xuất Khẩu
                                            </a>
                                            <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2">
                                                Hướng dẫn chi tiết quy trình soi chiếu an ninh hàng không sớm từ nhà máy đến thẳng cửa máy bay nhằm triệt tiêu rủi ro trễ chuyến.
                                            </p>
                                        </div>
                                        <div className="mt-space-md pt-space-xs flex items-center justify-between font-label-md text-label-md text-on-surface-variant">
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm">person</span>
                                                Tổ Thông Quan Tiên Phong
                                            </span>
                                            <span className="text-secondary group-hover:translate-x-1 transition-transform flex items-center">
                                                Chi tiết <span className="material-symbols-outlined text-sm">chevron_right</span>
                                            </span>
                                        </div>
                                    </div>
                                </article>
                                {/* Article Card 6 */}
                                <article className="bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group">
                                    <div className="relative h-48 w-full overflow-hidden bg-surface-container">
                                        <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" data-alt="Aviation logistics training simulator and control room, young logistics coordinators analyzing flight schedules and warehouse automated conveyor systems on wide curved digital monitors." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCez5TF4nNAuiTkutPb5mRFg01lqktQTevKCwooJ2DVTBQmSzxlVIgXu-xqybV7xxDiBov-jGsIgkGV5hS8Eup2fF90q6G4DHB1PQfCuiEri5xyYBDgC5PpwqNdZlO0eFbn8Vl1fl45Xh0Np-eVnSSVCsmDt9qsWYh9pjq5nG_tP8s9cf7-UVBEBXI5M10b_paj_g1Xa0DoWzWG2mT9tBrd2hp8yD94sz4DtbiCy9FY3CGjKw-BOAoI" />
                                        <span className="absolute top-space-xs left-space-xs px-2 py-0.5 rounded bg-surface-container-lowest/90 backdrop-blur font-label-sm text-label-sm text-secondary font-semibold">
                                            Đào tạo &amp; Nhân lực
                                        </span>
                                    </div>
                                    <div className="p-space-md flex-1 flex flex-col justify-between">
                                        <div className="flex flex-col gap-space-xs">
                                            <span className="font-data-mono text-label-sm text-on-surface-variant">02.05.2026 • 4 phút đọc</span>
                                            <a className="font-headline-sm text-headline-sm text-primary hover:text-secondary transition-colors line-clamp-2" href="#">
                                                Đào Tạo Nguồn Nhân Lực Chất Lượng Cao Đáp Ứng Chuyển Đổi Số Kho Vận Thông Minh
                                            </a>
                                            <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2">
                                                Chương trình đào tạo chuyển giao công nghệ quản trị WMS/TMS thế hệ mới theo chuẩn hiệp hội vận tải hàng không quốc tế FIATA.
                                            </p>
                                        </div>
                                        <div className="mt-space-md pt-space-xs flex items-center justify-between font-label-md text-label-md text-on-surface-variant">
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm">person</span>
                                                Học Viện NEXLOG Academy
                                            </span>
                                            <span className="text-secondary group-hover:translate-x-1 transition-transform flex items-center">
                                                Chi tiết <span className="material-symbols-outlined text-sm">chevron_right</span>
                                            </span>
                                        </div>
                                    </div>
                                </article>
                            </div>
                            {/* Professional Enterprise Pagination */}
                            <nav aria-label="Phân trang danh sách bài viết" className="flex flex-col sm:flex-row items-center justify-between gap-space-sm bg-surface-container-lowest p-space-md rounded-xl shadow-sm mt-space-sm">
                                <div className="font-body-sm text-body-sm text-on-surface-variant">
                                    Hiển thị <span className="font-semibold text-primary">1 - 6</span> trên tổng số <span className="font-semibold text-primary">68</span> bài viết
                                </div>
                                <div className="flex items-center gap-1">
                                    <button className="px-space-sm py-1.5 rounded-lg font-label-md text-label-md text-outline bg-surface-container-low cursor-not-allowed flex items-center gap-1" disabled="" type="button">
                                        <span className="material-symbols-outlined text-base">chevron_left</span>
                                        Trước
                                    </button>
                                    <button className="w-8 h-8 rounded-lg font-label-md text-label-md bg-primary text-on-primary font-bold" type="button">1</button>
                                    <button className="w-8 h-8 rounded-lg font-label-md text-label-md text-on-surface hover:bg-surface-container transition-colors" type="button">2</button>
                                    <button className="w-8 h-8 rounded-lg font-label-md text-label-md text-on-surface hover:bg-surface-container transition-colors" type="button">3</button>
                                    <span className="px-1 text-outline">...</span>
                                    <button className="w-8 h-8 rounded-lg font-label-md text-label-md text-on-surface hover:bg-surface-container transition-colors" type="button">12</button>
                                    <button className="px-space-sm py-1.5 rounded-lg font-label-md text-label-md text-primary bg-surface-container hover:bg-surface-container-high transition-colors flex items-center gap-1" type="button">
                                        Sau
                                        <span className="material-symbols-outlined text-base">chevron_right</span>
                                    </button>
                                </div>
                            </nav>
                        </div>
                        {/* RIGHT COLUMN: Deep Intelligence Sidebar (4 cols) */}
                        <aside className="lg:col-span-4 flex flex-col gap-space-lg">
                            {/* Widget 1: Free Downloadable Whitepaper / E-Book */}
                            <div className="relative rounded-xl overflow-hidden bg-primary text-on-primary p-space-lg shadow-lg flex flex-col justify-between">
                                {/* Background Abstract Graphic Accents */}
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
                                    <button className="w-full py-space-sm px-space-md rounded-xl bg-on-tertiary-container hover:bg-tertiary-container text-on-primary font-label-lg text-label-lg font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all" type="button">
                                        <span className="material-symbols-outlined text-lg">download</span>
                                        Tải PDF Báo Cáo Miễn Phí
                                    </button>
                                    <span className="block text-center font-label-sm text-label-sm text-surface-dim mt-2">
                                        Dành riêng cho doanh nghiệp XNK và đơn vị Logistics
                                    </span>
                                </div>
                            </div>
                            {/* Widget 2: Trending & Most Read Articles */}
                            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
                                <div className="flex items-center justify-between pb-space-xs border-b border-surface-container">
                                    <div className="flex items-center gap-space-xs">
                                        <span className="material-symbols-outlined text-on-tertiary-container">trending_up</span>
                                        <h3 className="font-headline-sm text-headline-sm text-primary">Tin Đọc Nhiều Nhất</h3>
                                    </div>
                                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Tuần này</span>
                                </div>
                                <div className="flex flex-col divide-y divide-surface-container-low">
                                    {/* Trending Item 01 */}
                                    <a className="py-space-sm flex items-start gap-space-md group" href="#">
                                        <span className="font-display-lg text-headline-xl text-surface-dim group-hover:text-secondary transition-colors font-bold leading-none select-none">
                                            01
                                        </span>
                                        <div className="flex flex-col gap-1">
                                            <span className="font-label-sm text-label-sm text-secondary font-semibold uppercase">Hạ tầng</span>
                                            <h4 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors line-clamp-2">
                                                Tiến độ xây dựng nhà ga hàng hóa Cảng Hàng Không Quốc Tế Long Thành giai đoạn 1
                                            </h4>
                                            <span className="font-data-mono text-label-sm text-on-surface-variant flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs">visibility</span> 12.450 lượt đọc
                                            </span>
                                        </div>
                                    </a>
                                    {/* Trending Item 02 */}
                                    <a className="py-space-sm flex items-start gap-space-md group" href="#">
                                        <span className="font-display-lg text-headline-xl text-surface-dim group-hover:text-secondary transition-colors font-bold leading-none select-none">
                                            02
                                        </span>
                                        <div className="flex flex-col gap-1">
                                            <span className="font-label-sm text-label-sm text-on-tertiary-container font-semibold uppercase">Thị trường</span>
                                            <h4 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors line-clamp-2">
                                                Chiến lược đặt tải (Charters) mùa cao điểm điện tử và dệt may cuối năm
                                            </h4>
                                            <span className="font-data-mono text-label-sm text-on-surface-variant flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs">visibility</span> 9.820 lượt đọc
                                            </span>
                                        </div>
                                    </a>
                                    {/* Trending Item 03 */}
                                    <a className="py-space-sm flex items-start gap-space-md group" href="#">
                                        <span className="font-display-lg text-headline-xl text-surface-dim group-hover:text-secondary transition-colors font-bold leading-none select-none">
                                            03
                                        </span>
                                        <div className="flex flex-col gap-1">
                                            <span className="font-label-sm text-label-sm text-primary font-semibold uppercase">Công nghệ</span>
                                            <h4 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors line-clamp-2">
                                                So sánh hiệu năng giữa RFID thế hệ mới và mã vạch 2D trong điều vận mâm kéo ULD
                                            </h4>
                                            <span className="font-data-mono text-label-sm text-on-surface-variant flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs">visibility</span> 7.140 lượt đọc
                                            </span>
                                        </div>
                                    </a>
                                    {/* Trending Item 04 */}
                                    <a className="py-space-sm flex items-start gap-space-md group" href="#">
                                        <span className="font-display-lg text-headline-xl text-surface-dim group-hover:text-secondary transition-colors font-bold leading-none select-none">
                                            04
                                        </span>
                                        <div className="flex flex-col gap-1">
                                            <span className="font-label-sm text-label-sm text-secondary font-semibold uppercase">Chính sách</span>
                                            <h4 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors line-clamp-2">
                                                Thủ tục khai báo trước hải quan điện tử (e-Manifest) với chuyến bay chuyên dụng
                                            </h4>
                                            <span className="font-data-mono text-label-sm text-on-surface-variant flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs">visibility</span> 5.890 lượt đọc
                                            </span>
                                        </div>
                                    </a>
                                </div>
                            </div>
                            {/* Widget 3: Weekly Insights Newsletter */}
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
                                    <button className="w-full py-space-sm bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg rounded-lg transition-colors flex items-center justify-center gap-2" type="submit">
                                        <span>Xác nhận đăng ký</span>
                                        <span className="material-symbols-outlined text-base">send</span>
                                    </button>
                                </form>
                                <div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm pt-space-xs">
                                    <span className="material-symbols-outlined text-xs text-secondary">verified_user</span>
                                    <span>Cam kết tuyệt đối không gửi thư rác. Hủy bất cứ lúc nào.</span>
                                </div>
                            </div>
                            {/* Widget 4: Popular Topic Cloud */}
                            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
                                <div className="flex items-center gap-space-xs">
                                    <span className="material-symbols-outlined text-secondary">tag</span>
                                    <h3 className="font-headline-sm text-headline-sm text-primary">Chủ Đề Phổ Biến</h3>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <a className="px-space-sm py-1 rounded bg-surface-container-low hover:bg-surface-container-high text-primary font-label-sm text-label-sm transition-colors" href="#">
                                        #LogisticsHangKhong
                                    </a>
                                    <a className="px-space-sm py-1 rounded bg-surface-container-low hover:bg-surface-container-high text-primary font-label-sm text-label-sm transition-colors" href="#">
                                        #IATA2026
                                    </a>
                                    <a className="px-space-sm py-1 rounded bg-surface-container-low hover:bg-surface-container-high text-primary font-label-sm text-label-sm transition-colors" href="#">
                                        #KhoThongMinh
                                    </a>
                                    <a className="px-space-sm py-1 rounded bg-surface-container-low hover:bg-surface-container-high text-primary font-label-sm text-label-sm transition-colors" href="#">
                                        #AIChuoiCungUng
                                    </a>
                                    <a className="px-space-sm py-1 rounded bg-surface-container-low hover:bg-surface-container-high text-primary font-label-sm text-label-sm transition-colors" href="#">
                                        #SanBayLongThanh
                                    </a>
                                    <a className="px-space-sm py-1 rounded bg-surface-container-low hover:bg-surface-container-high text-primary font-label-sm text-label-sm transition-colors" href="#">
                                        #OffAirportHub
                                    </a>
                                    <a className="px-space-sm py-1 rounded bg-surface-container-low hover:bg-surface-container-high text-primary font-label-sm text-label-sm transition-colors" href="#">
                                        #PharmaLogistics
                                    </a>
                                    <a className="px-space-sm py-1 rounded bg-surface-container-low hover:bg-surface-container-high text-primary font-label-sm text-label-sm transition-colors" href="#">
                                        #AirwayBillTracking
                                    </a>
                                    <a className="px-space-sm py-1 rounded bg-surface-container-low hover:bg-surface-container-high text-primary font-label-sm text-label-sm transition-colors" href="#">
                                        #RobotAGV
                                    </a>
                                </div>
                            </div>
                            {/* Operational Helpdesk Card */}
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
                </main>
                {/* Interactive JavaScript for Quick Tab Filtering and Newsletter Interaction */}

            </div></main><footer className="w-full bg-primary text-surface-container-high"><div className="w-full px-margin-lg py-space-xl"><div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg pb-space-xl"><div className="lg:col-span-7 flex flex-col gap-space-sm"><div className="font-headline-lg text-headline-lg text-on-primary tracking-tight">CÔNG TY CỔ PHẦN LOGISTICS NEXLOG</div><p className="font-body-md text-body-md text-surface-dim">Cổng thông tin logistics và điều phối vận chuyển hàng không thông minh đa phương thức, kiểm soát chuỗi cung ứng chuẩn xác tuyệt đối.</p><div className="flex flex-col gap-space-xs font-body-md text-body-md text-surface-container mt-space-sm"><p className="flex items-center gap-space-xs"><span className="material-symbols-outlined text-secondary-fixed text-sm">verified</span><span>Giấy phép ĐKKD: 0108992834 do Sở KH&amp;ĐT cấp ngày 15/04/2018</span></p><p className="flex items-center gap-space-xs"><span className="material-symbols-outlined text-secondary-fixed text-sm">location_on</span><span>Trụ sở chính: Tầng 12A, NEXLOG Aviation Tower, Đường Trường Sơn, Phường 2, Tân Bình, TP. Hồ Chí Minh</span></p><p className="flex items-center gap-space-xs"><span className="material-symbols-outlined text-secondary-fixed text-sm">phone_in_talk</span><span>Hotline hỗ trợ: <strong className="text-on-primary">1900 3133</strong></span></p><p className="flex items-center gap-space-xs"><span className="material-symbols-outlined text-secondary-fixed text-sm">mail</span><span>Email tiếp nhận thông tin: <strong className="text-on-primary">contact@nexlog.vn</strong></span></p></div><div className="mt-space-md"><a className="font-label-md text-label-md text-secondary-fixed hover:text-on-primary transition-colors underline decoration-outline-variant underline-offset-4" data-path="chinh-sach-bao-mat" href="#">Chính sách bảo mật dữ liệu &amp; vận hành</a></div></div><div className="lg:col-span-5 flex flex-col justify-start bg-primary-container p-space-lg rounded-xl shadow-lg"><h3 className="font-headline-md text-headline-md text-on-primary uppercase tracking-tight">Đăng ký nhận bản tin từ NEXLOG</h3><p className="font-body-md text-body-md text-surface-variant mt-space-xs mb-space-md">Cập nhật biến động cước vận chuyển hàng không, lịch trình bay và cảnh báo tắc nghẽn cảng biển hàng tuần.</p><form className="flex flex-col sm:flex-row gap-space-xs" onSubmit={(e) => e.preventDefault()}><input className="flex-1 px-space-md py-space-sm rounded-lg bg-surface text-on-surface font-body-md text-body-md placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary" placeholder="Nhập email doanh nghiệp của bạn..." type="email" /><button className="px-space-lg py-space-sm bg-on-tertiary-container hover:bg-tertiary-container text-on-primary font-label-lg text-label-lg rounded-lg transition-colors text-center whitespace-nowrap" type="submit">Đăng ký</button></form><div className="flex items-center gap-space-xs mt-space-sm text-surface-dim font-label-sm text-label-sm"><span className="material-symbols-outlined text-sm text-secondary-fixed">shield</span><span>Bảo vệ quyền riêng tư theo tiêu chuẩn IATA Security.</span></div></div></div><div className="pt-space-md flex flex-col sm:flex-row items-center justify-between gap-space-sm text-surface-dim font-label-sm text-label-sm"><p>© 2025 NEXLOG Logistics JSC. All rights reserved.</p><p>Hệ thống giám sát không gian điều vận hàng không thông minh quốc tế.</p></div></div></footer><div className="fixed bottom-space-lg right-space-lg z-50"><button aria-label="Hỗ trợ trực tuyến" className="w-14 h-14 rounded-full bg-on-tertiary-container text-on-primary shadow-xl hover:bg-tertiary-container flex items-center justify-center transition-all" type="button"><span className="material-symbols-outlined text-2xl">chat</span></button></div>
        </div>
    );
};

export default BlogPage;
