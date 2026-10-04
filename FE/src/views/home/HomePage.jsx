/* eslint-disable @next/next/no-img-element */

'use client';
import React, { useState } from 'react';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('awb');

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(15,43,92,0.06)]"><div className="h-20 w-full px-margin-lg flex items-center justify-between"><div className="flex items-center gap-space-lg"><a className="flex items-center gap-space-xs group" data-path="trang-chu" href="#"><span className="font-headline-lg text-headline-lg text-primary tracking-tight">NEX<span className="text-on-tertiary-container">LOG</span></span><span className="hidden xl:inline-block px-space-xs py-0.5 rounded bg-surface-container-low text-secondary font-label-sm text-label-sm uppercase tracking-wider">AeroCargo</span></a><nav className="hidden lg:flex items-center gap-space-lg ml-space-md" data-active-classes="text-secondary font-headline-sm"><a className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" data-path="ve-nexlog" href="#">Về NEXLOG</a><a className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" data-path="dich-vu" href="#">Dịch vụ</a><a className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" data-path="khach-hang" href="#">Khách hàng</a><a className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" data-path="tin-tuc" href="/blog">Tin tức</a><a className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" data-path="lien-he" href="#">Liên hệ</a></nav></div><div className="flex items-center gap-space-md"><a className="hidden md:flex items-center gap-space-xs text-primary font-headline-sm text-headline-sm hover:text-secondary transition-colors" href="tel:19003133"><span className="material-symbols-outlined text-secondary">call</span><span>1900 3133</span></a><div className="hidden sm:flex items-center gap-space-sm"><a className="px-space-md py-space-sm rounded-xl font-label-lg text-label-lg text-primary-container bg-surface-container-low hover:bg-primary-container hover:text-on-primary transition-all" data-path="tra-cuu-van-don" href="#">Tra cứu</a><a className="px-space-md py-space-sm rounded-xl font-label-lg text-label-lg text-on-primary bg-on-tertiary-container hover:bg-tertiary-container transition-all" data-path="nhan-tu-van" href="#">Nhận tư vấn</a></div><div className="flex items-center font-label-md text-label-md text-on-surface-variant"><span className="font-headline-sm text-primary">VI</span><span className="mx-space-xs text-outline-variant">|</span><span className="hover:text-on-surface cursor-pointer">EN</span></div><img alt="Profile" className="w-8 h-8 rounded-full object-cover shadow-sm ml-space-xs" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDmW2mEHscI8ywmuR-goxPYNT6WbtPICxUhM77K-grZ0b40JJgHGs8RwcDXPPnJv7PA747w4ShJqRTmbJVt9vX8PkqQYCZ1QY4PLmhsmEKLM6Rs8DA1zvB1E_5x82nlkeue-fig8EHHKWweiOsJ_b8jCx6qO2mlJkWjgdBaogzYI1UZsfNdqcOB_v3ogVnHa8Drq6oztuFl4N00Do5zLh0eCB4WkGpxq1XrpTjmoHRI5KBImYDcEphj" /></div></div></header><main className="w-full pt-20 bg-surface min-h-screen"><div className="flex flex-col w-full">
            {/*  1. HERO SECTION & TRACKING WIDGET  */}
            <section className="relative w-full overflow-hidden bg-primary pb-space-xl text-on-primary">
                {/*  Hero Image Background with Cinematic Overlay  */}
                <div className="absolute inset-0 z-0">
                    <img alt="Trung tâm điều vận hàng không NEXLOG" className="w-full h-full object-cover object-center opacity-45 scale-105 transition-transform duration-1000 ease-out" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDmW2mEHscI8ywmuR-goxPYNT6WbtPICxUhM77K-grZ0b40JJgHGs8RwcDXPPnJv7PA747w4ShJqRTmbJVt9vX8PkqQYCZ1QY4PLmhsmEKLM6Rs8DA1zvB1E_5x82nlkeue-fig8EHHKWweiOsJ_b8jCx6qO2mlJkWjgdBaogzYI1UZsfNdqcOB_v3ogVnHa8Drq6oztuFl4N00Do5zLh0eCB4WkGpxq1XrpTjmoHRI5KBImYDcEphj" />
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/95 via-primary-container/85 to-primary"></div>
                    <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-secondary-container/20 blur-3xl pointer-events-none"></div>
                </div>
                <div className="relative z-10 w-full px-margin-lg pt-space-xl pb-space-lg flex flex-col items-center max-w-7xl mx-auto">
                    {/*  Badge Brand Authority  */}
                    <div className="inline-flex items-center gap-space-xs px-space-md py-1 rounded-full bg-surface-container-lowest/10 backdrop-blur-md shadow-sm mb-space-md">
                        <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse"></span>
                        <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary-fixed">Hệ thống Điều vận Hàng không Thế hệ mới 4.0</span>
                    </div>
                    {/*  Main Heading & Subtitle  */}
                    <div className="text-center max-w-4xl mb-space-xl">
                        <h1 className="font-headline-xl text-headline-xl md:font-display-lg md:text-display-lg text-on-primary tracking-tight font-extrabold uppercase">
                            Giải pháp Logistics &amp; Điều vận Hàng không <span className="text-on-tertiary-container">Toàn diện</span>
                        </h1>
                        <p className="font-body-lg text-body-lg text-surface-dim mt-space-sm max-w-2xl mx-auto">
                            Tối ưu hóa chuỗi cung ứng với công nghệ định tuyến thông minh và tốc độ vượt trội. Kết nối liền mạch toàn cầu từ cửa ngõ Việt Nam.
                        </p>
                    </div>
                    {/*  Central Multi-layer Tracking Widget  */}
                    <div className="w-full max-w-4xl bg-surface-container-lowest text-on-surface rounded-xl shadow-2xl p-space-md md:p-space-lg">
                        {/*  Tabs Header  */}
                        <div className="flex items-center gap-space-xs md:gap-space-sm bg-surface-container-low p-1.5 rounded-lg mb-space-lg" id="search-tabs">
                            <button className={`flex-1 flex items-center justify-center gap-space-xs py-space-sm px-space-md rounded-lg font-headline-sm text-headline-sm transition-all ${activeTab === 'awb' ? 'bg-surface-container-lowest text-on-tertiary-container shadow-sm' : 'text-on-surface-variant hover:text-primary'}`} id="tab-btn-awb" onClick={() => setActiveTab('awb')} type="button">
                                <span className="material-symbols-outlined text-base">local_shipping</span>
                                <span>Tra cứu vận đơn</span>
                            </button>
                            <button className={`flex-1 flex items-center justify-center gap-space-xs py-space-sm px-space-md rounded-lg font-headline-sm text-headline-sm transition-all ${activeTab === 'invoice' ? 'bg-surface-container-lowest text-on-tertiary-container shadow-sm' : 'text-on-surface-variant hover:text-primary'}`} id="tab-btn-invoice" onClick={() => setActiveTab('invoice')} type="button">
                                <span className="material-symbols-outlined text-base">receipt_long</span>
                                <span>Tra cứu hóa đơn</span>
                            </button>
                        </div>
                        {/*  Tab 1: Tra cứu vận đơn (Active)  */}
                        <div className={`${activeTab === 'awb' ? 'flex' : 'hidden'} flex-col gap-space-md`} id="tab-panel-awb">
                            {/*  Row 1: AWB Number & Radio In/Out  */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-space-md items-center">
                                <div className="md:col-span-8">
                                    <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">
                                        Mã vận đơn (Hawb / Mawb)
                                    </label>
                                    <div className="relative flex items-center">
                                        <span className="absolute left-space-md material-symbols-outlined text-outline text-lg pointer-events-none">tag</span>
                                        <input className="w-full pl-10 pr-space-md py-3 rounded-lg bg-surface-container-low text-on-surface font-data-mono text-data-mono focus:outline-none focus:bg-surface-container-lowest shadow-inner" id="awb-input" placeholder="VD: 180-87429103..." type="text" defaultValue="180-87429103" />
                                    </div>
                                </div>
                                <div className="md:col-span-4 flex flex-col justify-end">
                                    <span className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">Loại vận chuyển</span>
                                    <div className="flex items-center gap-space-lg h-[46px] px-space-md bg-surface-container-low rounded-lg">
                                        <label className="inline-flex items-center gap-space-xs cursor-pointer">
                                            <input defaultChecked className="w-4 h-4 text-primary accent-primary" name="cargo-flow" type="radio" value="inbound" />
                                            <span className="font-label-lg text-label-lg text-on-surface font-semibold">Nhập khẩu</span>
                                        </label>
                                        <label className="inline-flex items-center gap-space-xs cursor-pointer">
                                            <input className="w-4 h-4 text-primary accent-primary" name="cargo-flow" type="radio" value="outbound" />
                                            <span className="font-label-lg text-label-lg text-on-surface font-semibold">Xuất khẩu</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            {/*  Row 2: Airline Select, Origin, Destination, Date  */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
                                <div>
                                    <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">Hãng bay</label>
                                    <div className="relative">
                                        <select className="w-full px-space-md py-2.5 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md appearance-none focus:outline-none focus:bg-surface-container-lowest cursor-pointer">
                                            <option value="all">Tất cả hãng bay</option>
                                            <option value="vn">Vietnam Airlines Cargo</option>
                                            <option value="sq">Singapore Airlines</option>
                                            <option value="qr">Qatar Airways Cargo</option>
                                            <option value="br">EVA Air Cargo</option>
                                            <option value="ke">Korean Air Cargo</option>
                                            <option value="ek">Emirates SkyCargo</option>
                                        </select>
                                        <span className="material-symbols-outlined absolute right-space-sm top-3 text-outline pointer-events-none text-lg">expand_more</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">Cảng đi</label>
                                    <div className="relative">
                                        <input className="w-full px-space-md py-2.5 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest" type="text" defaultValue="SGN - Tân Sơn Nhất" />
                                        <span className="material-symbols-outlined absolute right-space-sm top-3 text-outline text-lg pointer-events-none">flight_takeoff</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">Cảng đến</label>
                                    <div className="relative">
                                        <input className="w-full px-space-md py-2.5 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest" type="text" defaultValue="HAN - Nội Bài" />
                                        <span className="material-symbols-outlined absolute right-space-sm top-3 text-outline text-lg pointer-events-none">flight_land</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">Ngày vận hành</label>
                                    <div className="relative">
                                        <input className="w-full px-space-md py-2.5 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest" type="text" defaultValue="24/10/2025" />
                                        <span className="material-symbols-outlined absolute right-space-sm top-3 text-outline text-lg pointer-events-none">calendar_today</span>
                                    </div>
                                </div>
                            </div>
                            {/*  Dispatch Search Action CTA  */}
                            <div className="mt-space-xs">
                                <button className="w-full py-3.5 px-space-lg rounded-lg bg-on-tertiary-container hover:bg-tertiary-container active:scale-[0.99] text-on-primary font-headline-md text-headline-md font-bold uppercase tracking-wider flex items-center justify-center gap-space-xs shadow-md transition-all" onClick={() => {}} type="button">
                                    <span className="material-symbols-outlined text-2xl">search</span>
                                    <span>TRA CỨU VẬN ĐƠN</span>
                                </button>
                            </div>
                            {/*  Live Result Drawer Demo  */}
                            <div className="mt-space-xs bg-surface-container-low rounded-lg p-space-md flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md" id="quick-track-result">
                                <div className="flex items-center gap-space-md">
                                    <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-secondary">
                                        <span className="material-symbols-outlined">airlines</span>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-space-xs">
                                            <span className="font-headline-sm text-headline-sm text-primary">AWB: 180-87429103</span>
                                            <span className="px-2 py-0.5 rounded text-label-sm font-label-sm uppercase bg-surface-container-high text-secondary">Đang bay (In-Transit)</span>
                                        </div>
                                        <p className="font-body-sm text-body-sm text-on-surface-variant">SGN (TP.HCM) ➔ HAN (Hà Nội) • VN Cargo Flight 728</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-space-lg w-full md:w-auto justify-between md:justify-end">
                                    <div className="text-right">
                                        <span className="font-label-sm text-label-sm text-on-surface-variant block uppercase">ETA dự kiến</span>
                                        <span className="font-data-mono text-data-mono font-bold text-on-surface">Hôm nay, 18:45</span>
                                    </div>
                                    <a className="px-space-md py-2 rounded bg-surface-container-lowest text-secondary font-label-md text-label-md font-bold shadow-sm hover:bg-secondary-fixed transition-colors" href="#">Chi tiết</a>
                                </div>
                            </div>
                        </div>
                        {/*  Tab 2 & 3 Placeholder Panels for Smooth Tab Interaction  */}
                        <div className={`${activeTab === 'invoice' ? 'flex' : 'hidden'} flex-col gap-space-md`} id="tab-panel-invoice">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-xs pb-space-xs border-b border-surface-container">
                                <p className="font-body-md text-body-md text-on-surface-variant flex items-center gap-space-xs">
                                    <span className="material-symbols-outlined text-secondary text-base">verified_user</span>
                                    <span>Tra cứu &amp; Tải hóa đơn điện tử (e-Invoice) của dịch vụ vận tải, lưu kho và thủ tục hàng hóa NEXLOG.</span>
                                </p>
                                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider hidden md:inline-block">Thông tư 78 / NĐ-123</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                                <div>
                                    <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">Mã tra cứu hóa đơn / Số hóa đơn</label>
                                    <div className="relative flex items-center">
                                        <span className="absolute left-space-md material-symbols-outlined text-outline text-lg pointer-events-none">receipt_long</span>
                                        <input className="w-full pl-10 pr-space-md py-2.5 rounded-lg bg-surface-container-low text-on-surface font-data-mono text-data-mono focus:outline-none focus:bg-surface-container-lowest shadow-inner" placeholder="VD: 24AA/26E-0012894 hoặc Mã CQT" type="text" defaultValue="24AA/26E-0012894" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">Mã số thuế bên mua (MST)</label>
                                    <div className="relative flex items-center">
                                        <span className="absolute left-space-md material-symbols-outlined text-outline text-lg pointer-events-none">corporate_fare</span>
                                        <input className="w-full pl-10 pr-space-md py-2.5 rounded-lg bg-surface-container-low text-on-surface font-data-mono text-data-mono focus:outline-none focus:bg-surface-container-lowest shadow-inner" placeholder="Nhập mã số thuế doanh nghiệp (10 hoặc 13 số)" type="text" defaultValue="0102030405" />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                                <div>
                                    <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">Khoảng thời gian phát hành</label>
                                    <div className="grid grid-cols-2 gap-space-xs">
                                        <div className="relative flex items-center">
                                            <input className="w-full px-space-md py-2.5 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest" type="text" defaultValue="01/05/2026" />
                                            <span className="material-symbols-outlined absolute right-space-sm text-outline text-lg pointer-events-none">calendar_today</span>
                                        </div>
                                        <div className="relative flex items-center">
                                            <input className="w-full px-space-md py-2.5 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest" type="text" defaultValue="24/10/2026" />
                                            <span className="material-symbols-outlined absolute right-space-sm text-outline text-lg pointer-events-none">event</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">Mã xác thực (Captcha)</label>
                                    <div className="flex items-center gap-space-xs">
                                        <div className="relative flex-1 flex items-center">
                                            <span className="absolute left-space-md material-symbols-outlined text-outline text-lg pointer-events-none">security</span>
                                            <input className="w-full pl-10 pr-space-md py-2.5 rounded-lg bg-surface-container-low text-on-surface font-data-mono text-data-mono focus:outline-none focus:bg-surface-container-lowest shadow-inner" placeholder="Nhập 6 ký tự" type="text" defaultValue="NX89K2" />
                                        </div>
                                        <div className="flex items-center gap-space-xs bg-surface-container-low px-space-sm py-2 rounded-lg border border-outline-variant/40">
                                            <span className="font-data-mono text-headline-sm font-bold tracking-widest text-primary px-space-xs bg-surface-container-lowest rounded select-none">NX89K2</span>
                                            <button className="text-outline hover:text-primary transition-colors flex items-center justify-center p-1 rounded" title="Đổi mã khác" type="button">
                                                <span className="material-symbols-outlined text-lg">refresh</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-space-xs">
                                <button className="w-full py-3.5 px-space-lg rounded-lg bg-on-tertiary-container hover:bg-tertiary-container active:scale-[0.99] text-on-primary font-headline-md text-headline-md font-bold uppercase tracking-wider flex items-center justify-center gap-space-xs shadow-md transition-all" type="button">
                                    <span className="material-symbols-outlined text-2xl">search</span>
                                    <span>TRA CỨU HÓA ĐƠN</span>
                                </button>
                            </div>
                            <div className="mt-space-xs bg-surface-container-low rounded-lg p-space-md flex flex-col gap-space-sm border border-surface-container-high" id="invoice-result-card">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs pb-space-xs border-b border-surface-container">
                                    <div className="flex items-center gap-space-xs flex-wrap">
                                        <span className="material-symbols-outlined text-secondary">receipt</span>
                                        <span className="font-headline-sm text-headline-sm text-primary font-bold">Hóa đơn GTGT #HD-2026-98124</span>
                                        <span className="px-2 py-0.5 rounded text-label-sm font-label-sm bg-surface-container-high text-secondary font-semibold flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>Đã phát hành / Đã ký số CQT
                                        </span>
                                    </div>
                                    <span className="font-label-sm text-label-sm text-on-surface-variant font-data-mono">Ký ngày: 18/10/2026 14:22</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm py-space-xs">
                                    <div className="flex flex-col">
                                        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Ngày lập</span>
                                        <span className="font-data-mono text-body-md font-semibold text-on-surface">18/10/2026</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Khách hàng / Doanh nghiệp</span>
                                        <span className="font-body-md text-body-md font-semibold text-on-surface line-clamp-1">CÔNG TY TNHH LOGISTICS TOÀN CẦU</span>
                                    </div>
                                    <div className="flex flex-col md:text-right">
                                        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Tổng tiền thanh toán</span>
                                        <span className="font-data-mono text-headline-sm font-bold text-on-tertiary-container">124.500.000 VNĐ</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-end gap-space-sm pt-space-xs">
                                    <button className="inline-flex items-center gap-space-xs px-space-md py-2 rounded-lg bg-surface-container-lowest text-primary font-label-md text-label-md font-semibold shadow-sm hover:bg-secondary-fixed transition-colors" type="button">
                                        <span className="material-symbols-outlined text-base">description</span>
                                        <span>Xem hóa đơn (PDF)</span>
                                    </button>
                                    <button className="inline-flex items-center gap-space-xs px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold shadow-sm hover:bg-primary-container transition-colors" type="button">
                                        <span className="material-symbols-outlined text-base">code</span>
                                        <span>Tải XML</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            {/*  2. SERVICES SECTION  */}
            <section className="w-full py-space-xl bg-surface">
                <div className="w-full px-margin-lg max-w-7xl mx-auto">
                    {/*  Section Header  */}
                    <div className="text-center max-w-3xl mx-auto mb-space-xl">
                        <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">Danh mục Giải pháp</span>
                        <h2 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight mt-1">Dịch Vụ Cung Cấp</h2>
                        <p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs">
                            NEXLOG cung cấp các giải pháp Logistics Hàng Không và quản lý chuỗi cung ứng hàng hoá chuyên nghiệp, khép kín với tiêu chuẩn vận hành toàn cầu.
                        </p>
                    </div>
                    {/*  6 Service Cards Grid  */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter-lg">
                        {/*  Service 1  */}
                        <div className="group bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                            <div>
                                <div className="w-14 h-14 rounded-lg bg-surface-container-high flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-all mb-space-md">
                                    <span className="material-symbols-outlined text-3xl">domain</span>
                                </div>
                                <h3 className="font-headline-md text-headline-md text-primary font-bold mb-space-xs group-hover:text-secondary transition-colors">
                                    Nhà ga hàng hoá
                                </h3>
                                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                                    Xử lý tiếp nhận, phân loại và lưu trữ hàng hóa hàng không đạt tiêu chuẩn quốc tế IATA. Hệ thống băng chuyền cơ giới hóa kiểm soát pallet ULD chính xác tuyệt đối.
                                </p>
                            </div>
                            <div className="pt-space-md flex items-center justify-between">
                                <span className="font-label-md text-label-md text-secondary font-semibold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                    Khám phá giải pháp <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </span>
                                <span className="font-label-sm text-label-sm text-outline-variant">IATA Standard</span>
                            </div>
                        </div>
                        {/*  Service 2  */}
                        <div className="group bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                            <div>
                                <div className="w-14 h-14 rounded-lg bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed-variant group-hover:bg-on-tertiary-container group-hover:text-on-primary transition-all mb-space-md">
                                    <span className="material-symbols-outlined text-3xl">forklift</span>
                                </div>
                                <h3 className="font-headline-md text-headline-md text-primary font-bold mb-space-xs group-hover:text-secondary transition-colors">
                                    Ga hàng hóa kéo dài
                                </h3>
                                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                                    (Off-airport Cargo Terminal) - Thủ tục hải quan và gom hàng linh hoạt gần các khu công nghiệp trọng điểm, rút ngắn thời gian thông quan từ nhà máy ra đường băng.
                                </p>
                            </div>
                            <div className="pt-space-md flex items-center justify-between">
                                <span className="font-label-md text-label-md text-secondary font-semibold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                    Khám phá giải pháp <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </span>
                                <span className="font-label-sm text-label-sm text-outline-variant">Off-Airport Hub</span>
                            </div>
                        </div>
                        {/*  Service 3  */}
                        <div className="group bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                            <div>
                                <div className="w-14 h-14 rounded-lg bg-surface-container-high flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-all mb-space-md">
                                    <span className="material-symbols-outlined text-3xl">warehouse</span>
                                </div>
                                <h3 className="font-headline-md text-headline-md text-primary font-bold mb-space-xs group-hover:text-secondary transition-colors">
                                    Dịch vụ kho vận
                                </h3>
                                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                                    Hệ thống kho ngoại quan, kho mát/lạnh tự động hóa và quản lý kiểm kê thời gian thực WMS. Chuỗi cung ứng lạnh bảo toàn vắc-xin, dược phẩm và linh kiện vi điện tử.
                                </p>
                            </div>
                            <div className="pt-space-md flex items-center justify-between">
                                <span className="font-label-md text-label-md text-secondary font-semibold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                    Khám phá giải pháp <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </span>
                                <span className="font-label-sm text-label-sm text-outline-variant">Smart WMS</span>
                            </div>
                        </div>
                        {/*  Service 4  */}
                        <div className="group bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                            <div>
                                <div className="w-14 h-14 rounded-lg bg-surface-container-high flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-all mb-space-md">
                                    <span className="material-symbols-outlined text-3xl">local_shipping</span>
                                </div>
                                <h3 className="font-headline-md text-headline-md text-primary font-bold mb-space-xs group-hover:text-secondary transition-colors">
                                    Dịch vụ vận tải
                                </h3>
                                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                                    Đội xe chuyên dụng liên tỉnh kết nối sân bay với cam kết giao hàng an toàn, đúng giờ. Giám sát hành trình và kiểm soát nhiệt độ thùng hàng bằng cảm biến IoT liên tục.
                                </p>
                            </div>
                            <div className="pt-space-md flex items-center justify-between">
                                <span className="font-label-md text-label-md text-secondary font-semibold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                    Khám phá giải pháp <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </span>
                                <span className="font-label-sm text-label-sm text-outline-variant">GPS / Telematics</span>
                            </div>
                        </div>
                        {/*  Service 5  */}
                        <div className="group bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                            <div>
                                <div className="w-14 h-14 rounded-lg bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed-variant group-hover:bg-on-tertiary-container group-hover:text-on-primary transition-all mb-space-md">
                                    <span className="material-symbols-outlined text-3xl">markunread_mailbox</span>
                                </div>
                                <h3 className="font-headline-md text-headline-md text-primary font-bold mb-space-xs group-hover:text-secondary transition-colors">
                                    Địa điểm CPN tập trung
                                </h3>
                                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                                    Trung tâm khai thác chuyển phát nhanh công nghệ cao, xử lý hàng triệu bưu gửi/ngày. Tích hợp máy soi chiếu an ninh tự động và luồng phân tách dữ liệu e-commerce.
                                </p>
                            </div>
                            <div className="pt-space-md flex items-center justify-between">
                                <span className="font-label-md text-label-md text-secondary font-semibold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                    Khám phá giải pháp <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </span>
                                <span className="font-label-sm text-label-sm text-outline-variant">High-Velocity</span>
                            </div>
                        </div>
                        {/*  Service 6  */}
                        <div className="group bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                            <div>
                                <div className="w-14 h-14 rounded-lg bg-surface-container-high flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-all mb-space-md">
                                    <span className="material-symbols-outlined text-3xl">school</span>
                                </div>
                                <h3 className="font-headline-md text-headline-md text-primary font-bold mb-space-xs group-hover:text-secondary transition-colors">
                                    Dịch vụ đào tạo
                                </h3>
                                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                                    Đào tạo nghiệp vụ logistics chuẩn quốc tế, cấp chứng chỉ IATA DGR (Hàng nguy hiểm), LAR (Động vật sống) và chuyển giao mô hình số hóa vận hành kho hàng không.
                                </p>
                            </div>
                            <div className="pt-space-md flex items-center justify-between">
                                <span className="font-label-md text-label-md text-secondary font-semibold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                    Khám phá giải pháp <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </span>
                                <span className="font-label-sm text-label-sm text-outline-variant">IATA Academy</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            {/*  3. STATISTICS SECTION (TẠI SAO CHỌN NEXLOG)  */}
            <section className="w-full py-space-xl bg-primary-container text-on-primary relative overflow-hidden">
                {/*  Ambient glowing accents  */}
                <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-secondary/20 blur-3xl pointer-events-none"></div>
                <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-on-tertiary-container/10 blur-3xl pointer-events-none"></div>
                <div className="w-full px-margin-lg max-w-7xl mx-auto relative z-10">
                    {/*  Header with Logo presence  */}
                    <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-space-xl">
                        <img alt="NEXLOG" className="h-10 w-auto mb-space-sm brightness-0 invert" src="https://lh3.googleusercontent.com/aida/AEtjO1W8kT1iPjj86E43d5Dzj5e6y4fBeFMRg60lZdkxv_n1ZZHpbt1-ZRWonxZEakogYoCJifwzAfOMVU5yjoHyOfxqOxnaQp_uKcoHV55doI2kt0UKgXR1IJEzYf0PYf3IakZYvURTlluVKCBUDINipcXRVs7itJF5n5s6c0enyeviiC2sktuNlSTjdJaIboRxAMEXxIJEK40SZDOJslcnQ_y_LfxRLDL5gzP30-O30ehgFax9Wl1SBhlETOw" />
                        <h2 className="font-headline-xl text-headline-xl text-on-primary font-bold tracking-tight">
                            Tại sao bạn nên lựa chọn NEXLOG
                        </h2>
                        <p className="font-body-lg text-body-lg text-surface-dim mt-space-xs">
                            Hạ tầng logistics hàng không quy mô hàng đầu khu vực, quy chuẩn công nghệ tiên tiến cùng năng lực phục vụ tuyệt đối cho mọi chuyến bay.
                        </p>
                    </div>
                    {/*  4 Key Metrics Cards  */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter-lg">
                        {/*  Metric 1  */}
                        <div className="bg-surface-container-lowest/10 backdrop-blur-md rounded-xl p-space-lg text-center flex flex-col items-center justify-center hover:bg-surface-container-lowest/15 transition-all shadow-lg">
                            <div className="w-12 h-12 rounded-full bg-on-tertiary-container/20 text-on-tertiary-container flex items-center justify-center mb-space-sm">
                                <span className="material-symbols-outlined text-3xl">military_tech</span>
                            </div>
                            <span className="font-display-lg text-display-lg font-extrabold text-on-primary tracking-tight">20 năm</span>
                            <span className="font-headline-sm text-headline-sm text-secondary-fixed mt-1">Xây dựng &amp; Phát triển</span>
                            <p className="font-body-sm text-body-sm text-surface-dim mt-space-xs">Khẳng định vị thế tiên phong trong quản lý ga hàng hóa hàng không Việt Nam</p>
                        </div>
                        {/*  Metric 2  */}
                        <div className="bg-surface-container-lowest/10 backdrop-blur-md rounded-xl p-space-lg text-center flex flex-col items-center justify-center hover:bg-surface-container-lowest/15 transition-all shadow-lg">
                            <div className="w-12 h-12 rounded-full bg-secondary-fixed-dim/20 text-secondary-fixed-dim flex items-center justify-center mb-space-sm">
                                <span className="material-symbols-outlined text-3xl">groups</span>
                            </div>
                            <span className="font-display-lg text-display-lg font-extrabold text-on-primary tracking-tight">2.000+</span>
                            <span className="font-headline-sm text-headline-sm text-secondary-fixed mt-1">Nhân sự Chuyên nghiệp</span>
                            <p className="font-body-sm text-body-sm text-surface-dim mt-space-xs">Đội ngũ kỹ thuật viên, điều vận viên được cấp chứng chỉ chuẩn IATA toàn cầu</p>
                        </div>
                        {/*  Metric 3  */}
                        <div className="bg-surface-container-lowest/10 backdrop-blur-md rounded-xl p-space-lg text-center flex flex-col items-center justify-center hover:bg-surface-container-lowest/15 transition-all shadow-lg">
                            <div className="w-12 h-12 rounded-full bg-on-tertiary-container/20 text-on-tertiary-container flex items-center justify-center mb-space-sm">
                                <span className="material-symbols-outlined text-3xl">foundation</span>
                            </div>
                            <span className="font-display-lg text-display-lg font-extrabold text-on-primary tracking-tight">1.000.000 m²</span>
                            <span className="font-headline-sm text-headline-sm text-secondary-fixed mt-1">Cơ sở vật chất</span>
                            <p className="font-body-sm text-body-sm text-surface-dim mt-space-xs">Diện tích kho bãi, bến bãi đỗ xe và ga hàng hóa phân bổ khắp các cảng HKQT</p>
                        </div>
                        {/*  Metric 4  */}
                        <div className="bg-surface-container-lowest/10 backdrop-blur-md rounded-xl p-space-lg text-center flex flex-col items-center justify-center hover:bg-surface-container-lowest/15 transition-all shadow-lg">
                            <div className="w-12 h-12 rounded-full bg-secondary-fixed-dim/20 text-secondary-fixed-dim flex items-center justify-center mb-space-sm">
                                <span className="material-symbols-outlined text-3xl">rv_hookup</span>
                            </div>
                            <span className="font-display-lg text-display-lg font-extrabold text-on-primary tracking-tight">1.500</span>
                            <span className="font-headline-sm text-headline-sm text-secondary-fixed mt-1">Đầu xe vận chuyển</span>
                            <p className="font-body-sm text-body-sm text-surface-dim mt-space-xs">Xe tải gắn nâng thủy lực, xe lạnh, container chuyên dụng kết nối liên vận 24/7</p>
                        </div>
                    </div>
                </div>
            </section>
            {/*  4. CUSTOMERS & NEWS SECTION  */}
            <section className="w-full py-space-xl bg-surface">
                <div className="w-full px-margin-lg max-w-7xl mx-auto flex flex-col gap-space-xl">
                    {/*  Part A: Customers & Global Partners  */}
                    <div>
                        <div className="flex flex-col md:flex-row md:items-end justify-between mb-space-lg">
                            <div>
                                <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">Mạng lưới Liên minh</span>
                                <h2 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight mt-1">Khách Hàng Của Chúng Tôi</h2>
                            </div>
                            <p className="font-body-md text-body-md text-on-surface-variant max-w-md mt-2 md:mt-0">
                                Hơn 120 đối tác hàng không quốc tế và hãng vận chuyển toàn cầu tin tưởng lựa chọn hạ tầng NEXLOG mỗi ngày.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
                            {/*  Airlines Group  */}
                            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
                                <div className="flex items-center gap-space-xs mb-space-md text-primary">
                                    <span className="material-symbols-outlined text-secondary">flight</span>
                                    <span className="font-headline-sm text-headline-sm font-bold uppercase tracking-wider">Hãng Hàng Không Quốc Tế</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-md">
                                    <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col items-center justify-center text-center">
                                        <span className="font-headline-sm text-headline-sm font-bold text-primary">Vietnam Airlines</span>
                                        <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">Cargo Division</span>
                                    </div>
                                    <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col items-center justify-center text-center">
                                        <span className="font-headline-sm text-headline-sm font-bold text-primary">Singapore Airlines</span>
                                        <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">SIA Cargo</span>
                                    </div>
                                    <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col items-center justify-center text-center">
                                        <span className="font-headline-sm text-headline-sm font-bold text-primary">Korean Air</span>
                                        <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">Cargo Hub</span>
                                    </div>
                                    <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col items-center justify-center text-center">
                                        <span className="font-headline-sm text-headline-sm font-bold text-primary">Cathay Cargo</span>
                                        <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">Pacific Network</span>
                                    </div>
                                    <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col items-center justify-center text-center">
                                        <span className="font-headline-sm text-headline-sm font-bold text-primary">Emirates</span>
                                        <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">SkyCargo</span>
                                    </div>
                                    <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col items-center justify-center text-center">
                                        <span className="font-headline-sm text-headline-sm font-bold text-primary">Qatar Airways</span>
                                        <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">Cargo Network</span>
                                    </div>
                                </div>
                            </div>
                            {/*  Forwarders Group  */}
                            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
                                <div className="flex items-center gap-space-xs mb-space-md text-primary">
                                    <span className="material-symbols-outlined text-secondary">hub</span>
                                    <span className="font-headline-sm text-headline-sm font-bold uppercase tracking-wider">Forwarder Toàn Cầu</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-md">
                                    <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col items-center justify-center text-center">
                                        <span className="font-headline-sm text-headline-sm font-bold text-primary">DHL Global</span>
                                        <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">Forwarding</span>
                                    </div>
                                    <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col items-center justify-center text-center">
                                        <span className="font-headline-sm text-headline-sm font-bold text-primary">DB Schenker</span>
                                        <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">Logistics AG</span>
                                    </div>
                                    <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col items-center justify-center text-center">
                                        <span className="font-headline-sm text-headline-sm font-bold text-primary">Kuehne+Nagel</span>
                                        <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">Air Logistics</span>
                                    </div>
                                    <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col items-center justify-center text-center">
                                        <span className="font-headline-sm text-headline-sm font-bold text-primary">Expeditors</span>
                                        <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">International</span>
                                    </div>
                                    <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col items-center justify-center text-center">
                                        <span className="font-headline-sm text-headline-sm font-bold text-primary">Nippon Express</span>
                                        <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">Global Freight</span>
                                    </div>
                                    <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col items-center justify-center text-center">
                                        <span className="font-headline-sm text-headline-sm font-bold text-primary">DSV Panalpina</span>
                                        <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">Air &amp; Sea Hub</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/*  Part B: Popular News (Tin tức phổ biến)  */}
                    <div>
                        <div className="flex items-center justify-between mb-space-lg">
                            <div>
                                <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">Thị trường &amp; Vận hành</span>
                                <h2 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight mt-1">Tin Tức Phổ Biến</h2>
                            </div>
                            <a className="hidden sm:inline-flex items-center gap-space-xs font-label-lg text-label-lg text-secondary font-semibold hover:text-primary transition-colors" href="/blog">
                                <span>Xem tất cả tin tức</span>
                                <span className="material-symbols-outlined text-base">arrow_forward</span>
                            </a>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter-lg">
                            {/*  Article 1  */}
                            <article className="group bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col">
                                <div className="relative h-48 overflow-hidden">
                                    <img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" data-alt="Bến bãi trung chuyển logistics thông minh vào ban đêm với xe tải điện công nghệ cao và hệ thống điều hành số hóa tự động NEXLOG, ánh sáng xanh dịu chuẩn xác cao cấp." src="https://lh3.googleusercontent.com/aida-public/AB6AXuArNbkfRl6D5FuYOG6vB_Y3ELP52vw1is0YNbH_nfACOXj8Idx8hNLcemERF2en7AM80eOnsXuIGgzA1dqLG7To98Mn2xKPlKHV4BVyeONdwtaCMKhLwvsLt3XY1uw-aohLxCm-fZhMJmCm8R1PR4h1NnYGmTW7hW-wvhYbeY2BjIZUSUX-4yljBQqT7YI2b6D9gPKdrMiJsxcr9ejBoEQclPa7E_Pf0gZ49-EPYxst97KNjOpL7AFg" />
                                    <div className="absolute top-space-sm left-space-sm px-space-sm py-1 rounded bg-primary text-on-primary font-data-mono text-label-sm font-bold">
                                        06.06.2026
                                    </div>
                                </div>
                                <div className="p-space-lg flex-1 flex flex-col justify-between">
                                    <div>
                                        <span className="font-label-sm text-label-sm text-on-tertiary-container uppercase font-bold tracking-wide">Công nghệ Vận tải</span>
                                        <h3 className="font-headline-sm text-headline-sm font-bold text-primary mt-1 mb-space-sm group-hover:text-secondary transition-colors line-clamp-2">
                                            NEXLOG ĐẨY MẠNH ĐÀO TẠO AI ỨNG DỤNG TRONG QUẢN LÝ CHUỖI CUNG ỨNG
                                        </h3>
                                        <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-3">
                                            Triển khai mô hình học máy tự động hóa phân bổ luồng hàng và dự báo tải trọng container, nâng cao năng suất điều vận lên 38%.
                                        </p>
                                    </div>
                                    <div className="pt-space-md">
                                        <a className="font-label-md text-label-md text-secondary font-semibold group-hover:text-on-tertiary-container inline-flex items-center gap-1 transition-colors" href="#">
                                            Tìm hiểu thêm <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                        </a>
                                    </div>
                                </div>
                            </article>
                            {/*  Article 2  */}
                            <article className="group bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col">
                                <div className="relative h-48 overflow-hidden">
                                    <img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" data-alt="Ga hàng hóa kéo dài quy mô lớn hiện đại Off-Airport Cargo Terminal tại Bắc Ninh với đội xe chuyên dụng và cần trục nâng pallet công nghiệp tiêu chuẩn IATA." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCixbsEmDqyWSrUZ_qv9qbLnb0UZCyjJ0pnYbxhgINUCf82EBKYvc0vVGQKtPap6WzfYwe_pGwtMo0e2XdZDXFdIdsY9hwEh22ybmaPOmdYHauJLTvPj6EAnRj-VEn2M7HYh5w-q0VeiH8-O1gkL4cYKFUtv-K2eKJul520sNRMevnAJmOHqvS4U4_FG09449Skdv6Xxy-BnRYv-OxlAVliHODYGiSnxHLRzUmvoTgmi6xchzs1zISZ" />
                                    <div className="absolute top-space-sm left-space-sm px-space-sm py-1 rounded bg-primary text-on-primary font-data-mono text-label-sm font-bold">
                                        02.06.2026
                                    </div>
                                </div>
                                <div className="p-space-lg flex-1 flex flex-col justify-between">
                                    <div>
                                        <span className="font-label-sm text-label-sm text-on-tertiary-container uppercase font-bold tracking-wide">Hạ tầng Ga hàng không</span>
                                        <h3 className="font-headline-sm text-headline-sm font-bold text-primary mt-1 mb-space-sm group-hover:text-secondary transition-colors line-clamp-2">
                                            MỞ RỘNG GA HÀNG HÓA KÉO DÀI TẠI KHU VỰC KINH TẾ TRỌNG ĐIỂM PHÍA BẮC
                                        </h3>
                                        <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-3">
                                            Nghiệm thu trung tâm gom hàng thông quan quy mô 150.000m² tại Bắc Ninh, kết nối trực tiếp sân bay Quốc tế Nội Bài chỉ 25 phút vận chuyển.
                                        </p>
                                    </div>
                                    <div className="pt-space-md">
                                        <a className="font-label-md text-label-md text-secondary font-semibold group-hover:text-on-tertiary-container inline-flex items-center gap-1 transition-colors" href="#">
                                            Tìm hiểu thêm <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                        </a>
                                    </div>
                                </div>
                            </article>
                            {/*  Article 3  */}
                            <article className="group bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col">
                                <div className="relative h-48 overflow-hidden">
                                    <img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" data-alt="Máy bay vận tải hàng hóa cỡ lớn Boeing 777F tại sân đỗ ban đêm với ánh đèn chiếu sáng kỹ thuật và trung tâm điều khiển bốc dỡ hàng không hiện đại." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCwMReD87TCCemzZgkOR-3UYZbjuCmiAiFbAiif8KJymHZVGaf5HGxILent9AMylwSQCrPSUdRRZJw6flXqp_UaQgeJkk8NVDtE40CU8ygSNnfqXs3N_Hbt7bk93ZT7tJ8f05x15lsSw2EfT3mUz2Cn4t2GTjL2Zwj9YR9VEZYXmM3IVeA2hLMNGmugTlSGEtTFbxEOWY0M-6wx-1UK2W9fPvPZD6pA_5Fe42js3XzQUCCnTi1akBrk" />
                                    <div className="absolute top-space-sm left-space-sm px-space-sm py-1 rounded bg-primary text-on-primary font-data-mono text-label-sm font-bold">
                                        28.05.2026
                                    </div>
                                </div>
                                <div className="p-space-lg flex-1 flex flex-col justify-between">
                                    <div>
                                        <span className="font-label-sm text-label-sm text-on-tertiary-container uppercase font-bold tracking-wide">Chuyển đổi số</span>
                                        <h3 className="font-headline-sm text-headline-sm font-bold text-primary mt-1 mb-space-sm group-hover:text-secondary transition-colors line-clamp-2">
                                            NÂNG CẤP HỆ THỐNG TRUY XUẤT THỜI GIAN THỰC IOT CHO MẠNG LƯỚI VẬN TẢI
                                        </h3>
                                        <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-3">
                                            Đưa vào vận hành thiết bị cảm biến telematics thế hệ mới kiểm soát nhiệt độ độ ẩm hàng dược phẩm trên toàn bộ 1.500 đầu xe container.
                                        </p>
                                    </div>
                                    <div className="pt-space-md">
                                        <a className="font-label-md text-label-md text-secondary font-semibold group-hover:text-on-tertiary-container inline-flex items-center gap-1 transition-colors" href="#">
                                            Tìm hiểu thêm <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                        </a>
                                    </div>
                                </div>
                            </article>
                        </div>
                    </div>
                </div>
            </section>
            {/*  Interactive Script for Tab Switching & Search Simulation  */}
            
        </div></main><footer className="w-full bg-primary text-surface-container-high"><div className="w-full px-margin-lg py-space-xl"><div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg pb-space-xl"><div className="lg:col-span-7 flex flex-col gap-space-sm"><div className="font-headline-lg text-headline-lg text-on-primary tracking-tight">CÔNG TY CỔ PHẦN LOGISTICS NEXLOG</div><p className="font-body-md text-body-md text-surface-dim">Cổng thông tin logistics và điều phối vận chuyển hàng không thông minh đa phương thức, kiểm soát chuỗi cung ứng chuẩn xác tuyệt đối.</p><div className="flex flex-col gap-space-xs font-body-md text-body-md text-surface-container mt-space-sm"><p className="flex items-center gap-space-xs"><span className="material-symbols-outlined text-secondary-fixed text-sm">verified</span><span>Giấy phép ĐKKD: 0108992834 do Sở KH&amp;ĐT cấp ngày 15/04/2018</span></p><p className="flex items-center gap-space-xs"><span className="material-symbols-outlined text-secondary-fixed text-sm">location_on</span><span>Trụ sở chính: Tầng 12A, NEXLOG Aviation Tower, Đường Trường Sơn, Phường 2, Tân Bình, TP. Hồ Chí Minh</span></p><p className="flex items-center gap-space-xs"><span className="material-symbols-outlined text-secondary-fixed text-sm">phone_in_talk</span><span>Hotline hỗ trợ: <strong className="text-on-primary">1900 3133</strong></span></p><p className="flex items-center gap-space-xs"><span className="material-symbols-outlined text-secondary-fixed text-sm">mail</span><span>Email tiếp nhận thông tin: <strong className="text-on-primary">contact@nexlog.vn</strong></span></p></div><div className="mt-space-md"><a className="font-label-md text-label-md text-secondary-fixed hover:text-on-primary transition-colors underline decoration-outline-variant underline-offset-4" data-path="chinh-sach-bao-mat" href="#">Chính sách bảo mật dữ liệu &amp; vận hành</a></div></div><div className="lg:col-span-5 flex flex-col justify-start bg-primary-container p-space-lg rounded-xl shadow-lg"><h3 className="font-headline-md text-headline-md text-on-primary uppercase tracking-tight">Đăng ký nhận bản tin từ NEXLOG</h3><p className="font-body-md text-body-md text-surface-variant mt-space-xs mb-space-md">Cập nhật biến động cước vận chuyển hàng không, lịch trình bay và cảnh báo tắc nghẽn cảng biển hàng tuần.</p><form className="flex flex-col sm:flex-row gap-space-xs" onSubmit={(e) => e.preventDefault()}><input className="flex-1 px-space-md py-space-sm rounded-lg bg-surface text-on-surface font-body-md text-body-md placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary" placeholder="Nhập email doanh nghiệp của bạn..." type="email" /><button className="px-space-lg py-space-sm bg-on-tertiary-container hover:bg-tertiary-container text-on-primary font-label-lg text-label-lg rounded-lg transition-colors text-center whitespace-nowrap" type="submit">Đăng ký</button></form><div className="flex items-center gap-space-xs mt-space-sm text-surface-dim font-label-sm text-label-sm"><span className="material-symbols-outlined text-sm text-secondary-fixed">shield</span><span>Bảo vệ quyền riêng tư theo tiêu chuẩn IATA Security.</span></div></div></div><div className="pt-space-md flex flex-col sm:flex-row items-center justify-between gap-space-sm text-surface-dim font-label-sm text-label-sm"><p>© 2025 NEXLOG Logistics JSC. All rights reserved.</p><p>Hệ thống giám sát không gian điều vận hàng không thông minh quốc tế.</p></div></div></footer><div className="fixed bottom-space-lg right-space-lg z-50"><button aria-label="Hỗ trợ trực tuyến" className="w-14 h-14 rounded-full bg-on-tertiary-container text-on-primary shadow-xl hover:bg-tertiary-container flex items-center justify-center transition-all" type="button"><span className="material-symbols-outlined text-2xl">chat</span></button></div>
    </>
  );
}
