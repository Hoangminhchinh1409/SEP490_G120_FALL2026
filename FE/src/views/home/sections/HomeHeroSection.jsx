/* eslint-disable @next/next/no-img-element */

"use client";
import React from "react";
import { orderApi } from "@/src/api/orderApi";
import {
  HIGHLIGHT_ITEMS,
  formatInvoiceDateTime,
  formatInvoiceDateOnly,
} from "./homePageData";

export default function HomeHeroSection({
  onOpenConsultation,
  scrollToSection,
  invoiceCode,
  setInvoiceCode,
  taxCode,
  setTaxCode,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  captchaInput,
  setCaptchaInput,
  captchaCode,
  captchaLoading,
  invoiceLoading,
  invoiceResult,
  invoiceNotice,
  handleRefreshCaptcha,
  handleInvoiceSearch,
}) {
  return (
    <section className="relative w-full overflow-hidden bg-primary pb-space-xl text-on-primary">
      <div className="absolute inset-0 z-0">
        <img
          alt="Hệ thống điều phối vận tải thông minh NEXLOG"
          className="w-full h-full object-cover object-center opacity-35 scale-105"
          src="/nexlog-banner.png"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/95 via-primary-container/85 to-primary" />
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-secondary-container/20 blur-3xl pointer-events-none" />
      </div>

      <div className="relative z-10 w-full px-margin-lg pt-space-xl pb-space-lg flex flex-col items-center max-w-7xl mx-auto">
        <div className="inline-flex items-center gap-space-xs px-space-md py-1 rounded-full bg-surface-container-lowest/10 backdrop-blur-md shadow-sm mb-space-md">
          <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse" />
          <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary-fixed">
            Hệ thống điều phối vận tải thông minh
          </span>
        </div>

        <div className="text-center max-w-4xl mb-space-xl">
          <h1 className="font-headline-xl text-headline-xl md:font-display-lg md:text-display-lg text-on-primary tracking-tight font-extrabold">
            Một nền tảng cho mọi{" "}
            <span className="text-on-tertiary-container">
              chuyến hàng của bạn
            </span>
          </h1>
          <p className="font-body-lg text-body-lg text-surface-dim mt-space-sm max-w-2xl mx-auto">
            NEXLOG kết nối khách hàng, điều phối viên và tài xế trên cùng một hệ
            thống: đặt đơn, lập chuyến, giám sát GPS và tra cứu hành trình theo
            thời gian thực.
          </p>
          <div className="mt-space-lg flex flex-wrap items-center justify-center gap-space-sm">
            <button
              type="button"
              onClick={onOpenConsultation}
              className="px-6 py-3 rounded-xl font-label-lg text-on-primary bg-on-tertiary-container hover:bg-tertiary-container shadow-lg hover:shadow-xl transition-all cursor-pointer font-bold inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-xl">
                assignment_add
              </span>
              <span>Gửi yêu cầu vận chuyển &amp; Báo giá</span>
            </button>
            <a
              href="#quy-trinh"
              onClick={(e) => scrollToSection(e, "quy-trinh")}
              className="px-5 py-3 rounded-xl font-label-lg text-on-primary bg-surface-container-lowest/20 hover:bg-surface-container-lowest/30 backdrop-blur-md transition-all cursor-pointer font-semibold inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-xl">route</span>
              <span>Xem quy trình vận chuyển</span>
            </a>
          </div>
        </div>

        {/* Tra cứu hóa đơn điện tử (#tra-cuu-hoa-don) */}
        <form
          id="tra-cuu-hoa-don"
          onSubmit={handleInvoiceSearch}
          className="w-full max-w-4xl bg-surface-container-lowest text-on-surface rounded-xl shadow-2xl p-space-md md:p-space-lg mb-space-xl flex flex-col gap-space-md scroll-mt-24"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-xs pb-space-sm border-b border-surface-container">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-on-tertiary-container">
                receipt_long
              </span>
              <div>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
                  Tra cứu hóa đơn
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Tra cứu &amp; Tải hóa đơn điện tử (e-Invoice) của dịch vụ vận
                  tải NEXLOG.
                </p>
              </div>
            </div>
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider hidden md:inline-block">
              Thông tư 78 / NĐ-123
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <div>
              <label
                htmlFor="invoice-code-input"
                className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1"
              >
                Mã tra cứu hóa đơn / Số hóa đơn
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-space-md material-symbols-outlined text-outline text-lg pointer-events-none">
                  receipt_long
                </span>
                <input
                  id="invoice-code-input"
                  value={invoiceCode}
                  onChange={(e) => setInvoiceCode(e.target.value)}
                  className="w-full pl-10 pr-space-md py-2.5 rounded-lg bg-surface-container-low text-on-surface font-data-mono text-data-mono focus:outline-none focus:bg-surface-container-lowest shadow-inner"
                  placeholder="Nhập mã tra cứu hoặc số hóa đơn"
                  type="text"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="invoice-tax-input"
                className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1"
              >
                Mã số thuế bên mua (MST)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-space-md material-symbols-outlined text-outline text-lg pointer-events-none">
                  corporate_fare
                </span>
                <input
                  id="invoice-tax-input"
                  value={taxCode}
                  onChange={(e) => setTaxCode(e.target.value)}
                  className="w-full pl-10 pr-space-md py-2.5 rounded-lg bg-surface-container-low text-on-surface font-data-mono text-data-mono focus:outline-none focus:bg-surface-container-lowest shadow-inner"
                  placeholder="Nhập mã số thuế doanh nghiệp (10 hoặc 13 số)"
                  type="text"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <div>
              <span className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1">
                Khoảng thời gian phát hành
              </span>
              <div className="grid grid-cols-2 gap-space-xs">
                <input
                  aria-label="Từ ngày"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-space-sm py-2.5 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest"
                  type="date"
                />
                <input
                  aria-label="Đến ngày"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-space-sm py-2.5 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest"
                  type="date"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="invoice-captcha-input"
                className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1"
              >
                Mã xác thực (Captcha)
              </label>
              <div className="flex items-center gap-space-xs">
                <div className="relative flex-1 flex items-center">
                  <span className="absolute left-space-md material-symbols-outlined text-outline text-lg pointer-events-none">
                    security
                  </span>
                  <input
                    id="invoice-captcha-input"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    className="w-full pl-10 pr-space-md py-2.5 rounded-lg bg-surface-container-low text-on-surface font-data-mono text-data-mono uppercase focus:outline-none focus:bg-surface-container-lowest shadow-inner"
                    placeholder="Nhập 6 ký tự"
                    maxLength={6}
                    type="text"
                  />
                </div>
                <div className="flex items-center gap-space-xs bg-surface-container-low px-space-sm py-2 rounded-lg border border-outline-variant/40">
                  <span className="font-data-mono text-headline-sm font-bold tracking-widest text-primary px-space-xs bg-surface-container-lowest rounded select-none min-w-[84px] text-center">
                    {captchaLoading ? "..." : captchaCode || "------"}
                  </span>
                  <button
                    onClick={handleRefreshCaptcha}
                    disabled={captchaLoading}
                    className="text-outline hover:text-primary transition-colors flex items-center justify-center p-1 rounded cursor-pointer disabled:opacity-50"
                    title="Đổi mã khác"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-lg">
                      refresh
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button
            disabled={invoiceLoading}
            className="w-full py-3.5 px-space-lg rounded-lg bg-on-tertiary-container hover:bg-tertiary-container active:scale-[0.99] text-on-primary font-headline-md text-headline-md font-bold uppercase tracking-wider flex items-center justify-center gap-space-xs shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            type="submit"
          >
            <span className="material-symbols-outlined text-2xl">search</span>
            <span>
              {invoiceLoading ? "ĐANG TRA CỨU..." : "TRA CỨU HÓA ĐƠN"}
            </span>
          </button>

          {invoiceNotice && (
            <div
              role="status"
              className={`rounded-lg p-space-md font-body-sm text-body-sm flex items-start gap-space-xs border ${
                invoiceNotice.type === "error"
                  ? "bg-error-container/30 text-error border-error/30"
                  : "bg-surface-container-low text-on-surface-variant border-surface-container-high"
              }`}
            >
              <span className="material-symbols-outlined text-base shrink-0 mt-0.5">
                {invoiceNotice.type === "error" ? "error" : "info"}
              </span>
              <span>{invoiceNotice.message}</span>
            </div>
          )}

          {invoiceResult && (
            <div
              id="invoice-result-card"
              className="mt-space-xs bg-surface-container-low rounded-lg p-space-md flex flex-col gap-space-sm border border-surface-container-high"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs pb-space-xs border-b border-surface-container">
                <div className="flex items-center gap-space-xs flex-wrap">
                  <span className="material-symbols-outlined text-secondary">
                    receipt
                  </span>
                  <span className="font-headline-sm text-headline-sm text-primary font-bold">
                    Hóa đơn GTGT #{invoiceResult.invoice_number}
                  </span>
                  <span className="px-2 py-0.5 rounded text-label-sm font-label-sm bg-surface-container-high text-secondary font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    {invoiceResult.status_label || "Đã phát hành"}
                  </span>
                </div>
                {invoiceResult.issued_at && (
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-data-mono">
                    Phát hành: {formatInvoiceDateTime(invoiceResult.issued_at)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-space-sm py-space-xs">
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                    Ngày lập / Mã đơn
                  </span>
                  <span className="font-data-mono text-body-md font-semibold text-on-surface">
                    {formatInvoiceDateOnly(invoiceResult.issued_at)} •{" "}
                    {invoiceResult.order_code}
                  </span>
                </div>
                <div className="flex flex-col md:col-span-2">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                    Khách hàng / Doanh nghiệp (MST: {invoiceResult.tax_code})
                  </span>
                  <span className="font-body-md text-body-md font-semibold text-on-surface line-clamp-1">
                    {invoiceResult.customer_name}
                  </span>
                </div>
                <div className="flex flex-col md:text-right">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                    Tổng tiền thanh toán (VAT {invoiceResult.vat_rate}%)
                  </span>
                  <span className="font-data-mono text-headline-sm font-bold text-on-tertiary-container">
                    {Math.round(
                      Number(invoiceResult.total_amount) || 0,
                    ).toLocaleString("vi-VN")}{" "}
                    VNĐ
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs border-t border-surface-container">
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Tiền hàng:{" "}
                  <strong className="text-on-surface">
                    {Math.round(
                      Number(invoiceResult.subtotal_amount) || 0,
                    ).toLocaleString("vi-VN")}{" "}
                    VNĐ
                  </strong>{" "}
                  • Thuế GTGT:{" "}
                  <strong className="text-on-surface">
                    {Math.round(
                      Number(invoiceResult.vat_amount) || 0,
                    ).toLocaleString("vi-VN")}{" "}
                    VNĐ
                  </strong>
                </span>

                <div className="flex flex-wrap items-center gap-space-sm">
                  <a
                    href={orderApi.getPublicInvoiceFileUrl(
                      invoiceResult.download_token,
                      "pdf",
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-space-xs px-space-md py-2 rounded-lg bg-surface-container-lowest text-primary font-label-md text-label-md font-semibold shadow-sm hover:bg-secondary-fixed transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">
                      description
                    </span>
                    <span>Xem hóa đơn (PDF)</span>
                  </a>
                  <a
                    href={orderApi.getPublicInvoiceFileUrl(
                      invoiceResult.download_token,
                      "xml",
                    )}
                    download
                    className="inline-flex items-center gap-space-xs px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold shadow-sm hover:bg-primary-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">
                      code
                    </span>
                    <span>Tải XML</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* 4 Quick Highlights */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {HIGHLIGHT_ITEMS.map((item) => (
            <div
              key={item.title}
              className="bg-surface-container-lowest/10 backdrop-blur-md rounded-xl p-space-md border border-surface-container-lowest/15 flex flex-col gap-space-xs"
            >
              <div className="w-10 h-10 rounded-lg bg-on-tertiary-container/20 text-on-tertiary-container flex items-center justify-center mb-1">
                <span className="material-symbols-outlined text-2xl">
                  {item.icon}
                </span>
              </div>
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-primary">
                {item.title}
              </h3>
              <p className="font-body-sm text-body-sm text-surface-dim leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
