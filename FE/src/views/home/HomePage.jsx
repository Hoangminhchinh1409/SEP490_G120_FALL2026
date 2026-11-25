"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { API_URL } from "@/src/api/apiConfig";
import { orderApi } from "@/src/api/orderApi";
import ConsultationBookingModal from "@/src/components/home/ConsultationBookingModal";
import {
  SECTION_IDS,
  easeInOutCubic,
  getArticleTimestamp,
} from "./sections/homePageData";
import HomeHeaderSection from "./sections/HomeHeaderSection";
import HomeHeroSection from "./sections/HomeHeroSection";
import HomeServicesSection from "./sections/HomeServicesSection";
import HomePortalsFaqNewsSection from "./sections/HomePortalsFaqNewsSection";
import HomeFooterSection from "./sections/HomeFooterSection";

export default function HomePage() {
  const [isConsultationOpen, setIsConsultationOpen] = useState(false);
  const [blogs, setBlogs] = useState([]);
  const [blogsLoading, setBlogsLoading] = useState(true);

  const [invoiceCode, setInvoiceCode] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState(null);
  const [invoiceNotice, setInvoiceNotice] = useState(null);
  const [activeSection, setActiveSection] = useState("");
  const scrollRafRef = useRef(null);

  const cancelScrollAnimation = useCallback(() => {
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
  }, []);

  const scrollToSection = useCallback(
    (e, sectionId) => {
      if (e) e.preventDefault();
      cancelScrollAnimation();

      let targetY = 0;
      if (sectionId) {
        const el = document.getElementById(sectionId);
        if (!el) return;
        const headerOffset = 80;
        targetY = Math.max(
          0,
          el.getBoundingClientRect().top + window.scrollY - headerOffset,
        );
      }

      window.history.replaceState(
        null,
        "",
        sectionId ? `#${sectionId}` : window.location.pathname,
      );
      setActiveSection(sectionId || "");

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (prefersReducedMotion) {
        window.scrollTo(0, targetY);
        return;
      }

      const startY = window.scrollY;
      const distance = targetY - startY;
      if (Math.abs(distance) < 2) {
        window.scrollTo(0, targetY);
        return;
      }

      const duration = 650;
      let startTime = null;

      const step = (timestamp) => {
        if (startTime === null) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeInOutCubic(progress);
        window.scrollTo(0, startY + distance * eased);

        if (progress < 1) {
          scrollRafRef.current = requestAnimationFrame(step);
        } else {
          scrollRafRef.current = null;
        }
      };

      scrollRafRef.current = requestAnimationFrame(step);
    },
    [cancelScrollAnimation],
  );

  useEffect(() => {
    let ticking = false;
    const updateActiveSection = () => {
      ticking = false;
      if (window.scrollY < 160) {
        setActiveSection("");
        return;
      }
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 24
      ) {
        setActiveSection("lien-he");
        return;
      }
      for (let i = SECTION_IDS.length - 1; i >= 0; i -= 1) {
        const id = SECTION_IDS[i];
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 130) {
          setActiveSection(id);
          return;
        }
      }
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateActiveSection);
      }
    };

    const onUserInterrupt = () => {
      cancelScrollAnimation();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onUserInterrupt, { passive: true });
    window.addEventListener("touchstart", onUserInterrupt, { passive: true });

    return () => {
      cancelScrollAnimation();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onUserInterrupt);
      window.removeEventListener("touchstart", onUserInterrupt);
    };
  }, [cancelScrollAnimation]);

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    try {
      const data = await orderApi.getPublicInvoiceCaptcha();
      setCaptchaCode(data?.captcha_code || "");
      setCaptchaToken(data?.captcha_token || "");
    } catch {
      setCaptchaCode("");
      setCaptchaToken("");
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const initCaptcha = async () => {
      try {
        const data = await orderApi.getPublicInvoiceCaptcha();
        if (mounted) {
          setCaptchaCode(data?.captcha_code || "");
          setCaptchaToken(data?.captcha_token || "");
        }
      } catch {
        if (mounted) {
          setCaptchaCode("");
          setCaptchaToken("");
        }
      }
    };
    initCaptcha();
    return () => {
      mounted = false;
    };
  }, []);

  const handleRefreshCaptcha = () => {
    setCaptchaInput("");
    loadCaptcha();
  };

  const handleInvoiceSearch = async (e) => {
    e.preventDefault();
    if (!invoiceCode.trim() || !taxCode.trim()) {
      setInvoiceResult(null);
      setInvoiceNotice({
        type: "error",
        message:
          "Vui lòng nhập đầy đủ mã tra cứu / số hóa đơn và mã số thuế bên mua.",
      });
      return;
    }
    if (!captchaInput.trim() || !captchaToken) {
      setInvoiceResult(null);
      setInvoiceNotice({
        type: "error",
        message:
          "Vui lòng nhập mã xác thực (Captcha) hoặc bấm làm mới mã xác thực.",
      });
      return;
    }

    setInvoiceLoading(true);
    setInvoiceNotice(null);
    try {
      const data = await orderApi.lookupPublicInvoice({
        invoice_number: invoiceCode.trim(),
        tax_code: taxCode.trim(),
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        captcha_code: captchaInput.trim(),
        captcha_token: captchaToken,
      });
      setInvoiceResult(data?.invoice || null);
      setInvoiceNotice(null);
      setCaptchaInput("");
      loadCaptcha();
    } catch (err) {
      setInvoiceResult(null);
      setInvoiceNotice({
        type: "error",
        message:
          err?.message ||
          "Không thể tra cứu hóa đơn lúc này. Vui lòng thử lại sau.",
      });
      setCaptchaInput("");
      loadCaptcha();
    } finally {
      setInvoiceLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const fetchLatestBlogs = async () => {
      try {
        const res = await fetch(`${API_URL}/blogs`);
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && data?.success && Array.isArray(data.blogs)) {
          const sorted = [...data.blogs]
            .sort((a, b) => getArticleTimestamp(b) - getArticleTimestamp(a))
            .slice(0, 3);
          setBlogs(sorted);
        }
      } catch {
        // Bỏ qua khi backend chưa sẵn sàng để trang chủ vẫn hiển thị bình thường
      } finally {
        if (mounted) setBlogsLoading(false);
      }
    };

    fetchLatestBlogs();
    return () => {
      mounted = false;
    };
  }, []);

  const handleOpenConsultation = useCallback(() => {
    setIsConsultationOpen(true);
  }, []);

  return (
    <>
      <HomeHeaderSection
        activeSection={activeSection}
        scrollToSection={scrollToSection}
        onOpenConsultation={handleOpenConsultation}
      />

      <main className="w-full pt-20 bg-surface min-h-screen">
        <div className="flex flex-col w-full">
          <HomeHeroSection
            onOpenConsultation={handleOpenConsultation}
            scrollToSection={scrollToSection}
            invoiceCode={invoiceCode}
            setInvoiceCode={setInvoiceCode}
            taxCode={taxCode}
            setTaxCode={setTaxCode}
            fromDate={fromDate}
            setFromDate={setFromDate}
            toDate={toDate}
            setToDate={setToDate}
            captchaInput={captchaInput}
            setCaptchaInput={setCaptchaInput}
            captchaCode={captchaCode}
            captchaLoading={captchaLoading}
            invoiceLoading={invoiceLoading}
            invoiceResult={invoiceResult}
            invoiceNotice={invoiceNotice}
            handleRefreshCaptcha={handleRefreshCaptcha}
            handleInvoiceSearch={handleInvoiceSearch}
          />

          <HomeServicesSection />

          <HomePortalsFaqNewsSection
            blogs={blogs}
            blogsLoading={blogsLoading}
          />
        </div>
      </main>

      <HomeFooterSection onOpenConsultation={handleOpenConsultation} />

      {isConsultationOpen && (
        <ConsultationBookingModal
          open={isConsultationOpen}
          onCancel={() => setIsConsultationOpen(false)}
        />
      )}
    </>
  );
}
