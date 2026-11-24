"use client";
import React, { useMemo, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  Quote,
  Minus,
  Link2,
  ImagePlus,
  Eye,
  Columns2,
  PenLine,
  Maximize2,
  Minimize2,
  Upload,
  X
} from "lucide-react";
import { uploadApi } from "../../../api/uploadApi";
import {
  getContentMetrics,
  renderArticleContent,
  sanitizeUrl
} from "../../blog/components/BlogContentRenderer";

const VIEW_MODES = [
  { id: "EDIT", label: "Soạn thảo", icon: PenLine },
  { id: "SPLIT", label: "Song song", icon: Columns2 },
  { id: "PREVIEW", label: "Xem trước", icon: Eye }
];

function ToolbarBtn({ title, onClick, active = false, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`h-7 min-w-7 px-1.5 rounded-lg inline-flex items-center justify-center text-xs font-semibold transition-colors cursor-pointer ${
        active
          ? "bg-primary text-on-primary shadow-xs"
          : "text-on-surface-variant hover:bg-surface-container hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  value = "",
  onChange,
  showToast,
  placeholder = "Soạn thảo nội dung bài viết tại đây..."
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const [viewMode, setViewMode] = useState("EDIT");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Popover chèn liên kết
  const [activeToolPanel, setActiveToolPanel] = useState(null); // null | 'LINK' | 'IMAGE'
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("https://");

  // Popover chèn hình ảnh
  const [imageCaption, setImageCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const metrics = useMemo(() => getContentMetrics(value), [value]);

  const updateContentAndSelect = (nextValue, selStart, selEnd) => {
    onChange(nextValue);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        if (typeof selStart === "number" && typeof selEnd === "number") {
          el.setSelectionRange(selStart, selEnd);
        }
      });
    }
  };

  // Đảm bảo ở chế độ có vùng soạn thảo khi thao tác toolbar
  const ensureEditableView = () => {
    if (viewMode === "PREVIEW") {
      setViewMode("SPLIT");
    }
  };

  const wrapSelection = (prefix, suffix, defaultPlaceholder) => {
    ensureEditableView();
    const el = textareaRef.current;
    const text = value || "";
    const start = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;
    const selected = text.slice(start, end);

    // Nếu vùng chọn đã được bọc bởi prefix/suffix -> bỏ định dạng (toggle)
    if (
      selected &&
      text.slice(Math.max(0, start - prefix.length), start) === prefix &&
      text.slice(end, end + suffix.length) === suffix
    ) {
      const unwrapped =
        text.slice(0, start - prefix.length) +
        selected +
        text.slice(end + suffix.length);
      updateContentAndSelect(
        unwrapped,
        start - prefix.length,
        end - prefix.length
      );
      return;
    }

    const inner = selected || defaultPlaceholder;
    const next = text.slice(0, start) + prefix + inner + suffix + text.slice(end);
    const nextStart = start + prefix.length;
    const nextEnd = nextStart + inner.length;
    updateContentAndSelect(next, nextStart, nextEnd);
  };

  const applyBlockFormat = (type) => {
    ensureEditableView();
    const el = textareaRef.current;
    const text = value || "";
    const start = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;

    const lineStart = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const rawLineEnd = text.indexOf("\n", end);
    const lineEnd = rawLineEnd === -1 ? text.length : rawLineEnd;

    const block = text.slice(lineStart, lineEnd);
    const lines = block.split("\n");

    const stripBlockPrefix = (line) =>
      line
        .replace(/^#{1,4}\s+/, "")
        .replace(/^>\s?/, "")
        .replace(/^[-*]\s+/, "")
        .replace(/^\d+\.\s+/, "");

    let transformed;
    if (type === "P") {
      transformed = lines.map(stripBlockPrefix);
    } else if (type === "H2") {
      transformed = lines.map((line) => {
        const clean = stripBlockPrefix(line) || "Tiêu đề phần";
        return line.startsWith("## ") ? clean : `## ${clean}`;
      });
    } else if (type === "H3") {
      transformed = lines.map((line) => {
        const clean = stripBlockPrefix(line) || "Tiêu đề mục";
        return line.startsWith("### ") ? clean : `### ${clean}`;
      });
    } else if (type === "QUOTE") {
      transformed = lines.map((line) => {
        const clean = stripBlockPrefix(line) || "Nội dung trích dẫn nổi bật...";
        return line.startsWith("> ") ? clean : `> ${clean}`;
      });
    } else if (type === "UL") {
      const allBullet = lines.every((l) => /^[-*]\s+/.test(l));
      transformed = lines.map((line, i) => {
        const clean = stripBlockPrefix(line);
        if (allBullet) return clean;
        return `- ${clean || (i === 0 ? "Mục danh sách" : "")}`.trimEnd();
      });
    } else if (type === "OL") {
      const allOrdered = lines.every((l) => /^\d+\.\s+/.test(l));
      transformed = lines.map((line, i) => {
        const clean = stripBlockPrefix(line);
        if (allOrdered) return clean;
        return `${i + 1}. ${clean || (i === 0 ? "Mục thứ nhất" : "")}`.trimEnd();
      });
    } else {
      transformed = lines;
    }

    const replacement = transformed.join("\n");
    const next = text.slice(0, lineStart) + replacement + text.slice(lineEnd);
    updateContentAndSelect(next, lineStart, lineStart + replacement.length);
  };

  const insertAtCursor = (snippet) => {
    ensureEditableView();
    const el = textareaRef.current;
    const text = value || "";
    const start = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const needLeadingNewline = before.length > 0 && !before.endsWith("\n");
    const needTrailingNewline = after.length > 0 && !after.startsWith("\n");

    const insertion =
      (needLeadingNewline ? "\n\n" : "") +
      snippet +
      (needTrailingNewline ? "\n\n" : "\n");

    const next = before + insertion + after;
    const caret = before.length + insertion.length;
    updateContentAndSelect(next, caret, caret);
  };

  const openLinkPanel = () => {
    ensureEditableView();
    const el = textareaRef.current;
    const text = value || "";
    const selected = el ? text.slice(el.selectionStart, el.selectionEnd).trim() : "";
    setLinkText(selected || "");
    setLinkUrl("https://");
    setActiveToolPanel((prev) => (prev === "LINK" ? null : "LINK"));
  };

  const handleConfirmLink = () => {
    const safe = sanitizeUrl(linkUrl);
    if (!safe) {
      showToast?.("Đường dẫn liên kết phải bắt đầu bằng https://, http:// hoặc /", "error");
      return;
    }
    const label = linkText.trim() || safe;
    const el = textareaRef.current;
    const text = value || "";
    const start = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;
    const md = `[${label}](${safe})`;
    const next = text.slice(0, start) + md + text.slice(end);
    updateContentAndSelect(next, start + md.length, start + md.length);
    setActiveToolPanel(null);
  };

  const handleConfirmImageUrl = () => {
    const safe = sanitizeUrl(imageUrl);
    if (!safe) {
      showToast?.("URL hình ảnh không hợp lệ (cần bắt đầu bằng https:// hoặc http://)", "error");
      return;
    }
    const caption = imageCaption.trim() || "Hình ảnh minh họa";
    insertAtCursor(`![${caption}](${safe})`);
    setImageUrl("");
    setImageCaption("");
    setActiveToolPanel(null);
  };

  const handleUploadInlineImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingImage(true);
      const uploaded = await uploadApi.uploadToCloudinary(file, "nexlog/blogs");
      const caption = imageCaption.trim() || file.name.replace(/\.[^.]+$/, "");
      insertAtCursor(`![${caption}](${uploaded.url})`);
      setImageCaption("");
      setImageUrl("");
      setActiveToolPanel(null);
      showToast?.("Đã tải ảnh lên Cloudinary và chèn vào bài viết!", "success");
    } catch (err) {
      showToast?.(err?.message || "Không thể tải ảnh lên Cloudinary", "error");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleKeyDown = (e) => {
    const isMod = e.ctrlKey || e.metaKey;
    if (isMod) {
      const k = e.key.toLowerCase();
      if (k === "b") {
        e.preventDefault();
        wrapSelection("**", "**", "chữ in đậm");
        return;
      }
      if (k === "i") {
        e.preventDefault();
        wrapSelection("*", "*", "chữ in nghiêng");
        return;
      }
      if (k === "u") {
        e.preventDefault();
        wrapSelection("__", "__", "chữ gạch chân");
        return;
      }
      if (k === "k") {
        e.preventDefault();
        openLinkPanel();
        return;
      }
    }

    if (e.key === "Escape" && isFullscreen) {
      e.preventDefault();
      setIsFullscreen(false);
      return;
    }

    // Tự động tiếp tục danh sách / trích dẫn khi nhấn Enter
    if (e.key === "Enter" && !e.shiftKey) {
      const el = textareaRef.current;
      if (!el) return;
      const text = value || "";
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (start !== end) return;

      const lineStart = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      const currentLine = text.slice(lineStart, start);

      const bulletMatch = /^([-*]\s+)(.*)$/.exec(currentLine);
      const orderedMatch = /^(\d+)\.\s+(.*)$/.exec(currentLine);
      const quoteMatch = /^(>\s?)(.*)$/.exec(currentLine);

      if (bulletMatch) {
        e.preventDefault();
        if (!bulletMatch[2].trim()) {
          // Xóa dấu đầu dòng trống
          const next = text.slice(0, lineStart) + text.slice(start);
          updateContentAndSelect(next, lineStart, lineStart);
        } else {
          const prefix = `\n${bulletMatch[1]}`;
          const next = text.slice(0, start) + prefix + text.slice(end);
          updateContentAndSelect(next, start + prefix.length, start + prefix.length);
        }
      } else if (orderedMatch) {
        e.preventDefault();
        if (!orderedMatch[2].trim()) {
          const next = text.slice(0, lineStart) + text.slice(start);
          updateContentAndSelect(next, lineStart, lineStart);
        } else {
          const nextNum = Number(orderedMatch[1]) + 1;
          const prefix = `\n${nextNum}. `;
          const next = text.slice(0, start) + prefix + text.slice(end);
          updateContentAndSelect(next, start + prefix.length, start + prefix.length);
        }
      } else if (quoteMatch) {
        e.preventDefault();
        if (!quoteMatch[2].trim()) {
          const next = text.slice(0, lineStart) + text.slice(start);
          updateContentAndSelect(next, lineStart, lineStart);
        } else {
          const prefix = "\n> ";
          const next = text.slice(0, start) + prefix + text.slice(end);
          updateContentAndSelect(next, start + prefix.length, start + prefix.length);
        }
      }
    }
  };

  const containerClass = isFullscreen
    ? "fixed inset-3 sm:inset-6 z-[70] bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/60 flex flex-col overflow-hidden"
    : "rounded-xl border border-outline-variant/50 bg-surface-container-lowest flex flex-col overflow-hidden focus-within:ring-1 focus-within:ring-secondary focus-within:border-secondary transition-all";

  return (
    <div className={containerClass}>
      {/* Toolbar */}
      <div className="px-2.5 py-2 bg-surface-container-low border-b border-surface-container flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {/* Nhóm tiêu đề */}
          <ToolbarBtn title="Đoạn văn thường (Xóa định dạng dòng)" onClick={() => applyBlockFormat("P")}>
            <Pilcrow className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Tiêu đề phần (H2)" onClick={() => applyBlockFormat("H2")}>
            <Heading2 className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Tiêu đề mục (H3)" onClick={() => applyBlockFormat("H3")}>
            <Heading3 className="w-3.5 h-3.5" />
          </ToolbarBtn>

          <span className="w-px h-4 bg-outline-variant/50 mx-1" />

          {/* Nhóm định dạng chữ */}
          <ToolbarBtn title="In đậm (Ctrl+B)" onClick={() => wrapSelection("**", "**", "chữ in đậm")}>
            <Bold className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="In nghiêng (Ctrl+I)" onClick={() => wrapSelection("*", "*", "chữ in nghiêng")}>
            <Italic className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Gạch chân (Ctrl+U)" onClick={() => wrapSelection("__", "__", "chữ gạch chân")}>
            <Underline className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Gạch ngang" onClick={() => wrapSelection("~~", "~~", "văn bản")}>
            <Strikethrough className="w-3.5 h-3.5" />
          </ToolbarBtn>

          <span className="w-px h-4 bg-outline-variant/50 mx-1" />

          {/* Nhóm danh sách & khối */}
          <ToolbarBtn title="Danh sách gạch đầu dòng" onClick={() => applyBlockFormat("UL")}>
            <List className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Danh sách đánh số" onClick={() => applyBlockFormat("OL")}>
            <ListOrdered className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Khối trích dẫn nổi bật" onClick={() => applyBlockFormat("QUOTE")}>
            <Quote className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Đường phân cách ngang" onClick={() => insertAtCursor("---")}>
            <Minus className="w-3.5 h-3.5" />
          </ToolbarBtn>

          <span className="w-px h-4 bg-outline-variant/50 mx-1" />

          {/* Chèn liên kết & ảnh */}
          <ToolbarBtn
            title="Chèn liên kết (Ctrl+K)"
            active={activeToolPanel === "LINK"}
            onClick={openLinkPanel}
          >
            <Link2 className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            title="Chèn ảnh minh họa vào bài viết"
            active={activeToolPanel === "IMAGE"}
            onClick={() =>
              setActiveToolPanel((prev) => (prev === "IMAGE" ? null : "IMAGE"))
            }
          >
            <ImagePlus className="w-3.5 h-3.5" />
          </ToolbarBtn>
        </div>

        {/* Chế độ hiển thị & Fullscreen */}
        <div className="flex items-center gap-1.5">
          <div className="inline-flex items-center bg-surface-container rounded-lg p-0.5">
            {VIEW_MODES.map((mode) => {
              const Icon = mode.icon;
              const isActive = viewMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setViewMode(mode.id)}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 transition-all cursor-pointer ${
                    isActive
                      ? "bg-surface-container-lowest text-primary shadow-xs"
                      : "text-outline hover:text-primary"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{mode.label}</span>
                </button>
              );
            })}
          </div>

          <ToolbarBtn
            title={isFullscreen ? "Thu nhỏ (Esc)" : "Mở rộng toàn màn hình"}
            active={isFullscreen}
            onClick={() => setIsFullscreen((prev) => !prev)}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </ToolbarBtn>
        </div>
      </div>

      {/* Sub-bar: Chèn liên kết */}
      {activeToolPanel === "LINK" && (
        <div className="px-3 py-2.5 bg-blue-50/70 border-b border-blue-200/80 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-primary uppercase">Chèn liên kết:</span>
          <input
            type="text"
            value={linkText}
            onChange={(e) => setLinkText(e.target.value)}
            placeholder="Văn bản hiển thị (VD: Xem báo giá)"
            className="h-8 px-2.5 bg-white rounded-lg border border-outline-variant/50 text-xs flex-1 min-w-[150px] focus:outline-none focus:border-secondary"
          />
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleConfirmLink();
              }
            }}
            placeholder="https://..."
            className="h-8 px-2.5 bg-white rounded-lg border border-outline-variant/50 text-xs flex-1 min-w-[180px] font-mono focus:outline-none focus:border-secondary"
          />
          <button
            type="button"
            onClick={handleConfirmLink}
            className="h-8 px-3 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary-container cursor-pointer"
          >
            Chèn link
          </button>
          <button
            type="button"
            onClick={() => setActiveToolPanel(null)}
            className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-outline hover:bg-white cursor-pointer"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-bar: Chèn hình ảnh vào nội dung */}
      {activeToolPanel === "IMAGE" && (
        <div className="px-3 py-2.5 bg-emerald-50/70 border-b border-emerald-200/80 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-primary uppercase">Chèn ảnh:</span>
          <input
            type="text"
            value={imageCaption}
            onChange={(e) => setImageCaption(e.target.value)}
            placeholder="Chú thích ảnh (tùy chọn)"
            className="h-8 px-2.5 bg-white rounded-lg border border-outline-variant/50 text-xs w-44 focus:outline-none focus:border-secondary"
          />
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleConfirmImageUrl();
              }
            }}
            placeholder="Dán URL ảnh (https://...) hoặc tải tệp"
            className="h-8 px-2.5 bg-white rounded-lg border border-outline-variant/50 text-xs flex-1 min-w-[180px] font-mono focus:outline-none focus:border-secondary"
          />
          <button
            type="button"
            onClick={handleConfirmImageUrl}
            className="h-8 px-3 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary-container cursor-pointer"
          >
            Chèn URL
          </button>
          <label className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 inline-flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>{uploadingImage ? "Đang tải..." : "Tải ảnh lên"}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              disabled={uploadingImage}
              onChange={handleUploadInlineImage}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={() => setActiveToolPanel(null)}
            className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-outline hover:bg-white cursor-pointer"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editor & Live Preview Body */}
      <div
        className={`grid ${
          viewMode === "SPLIT" ? "grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-surface-container" : "grid-cols-1"
        } ${isFullscreen ? "flex-1 min-h-0" : ""}`}
      >
        {(viewMode === "EDIT" || viewMode === "SPLIT") && (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`w-full p-3.5 bg-surface-container-low/40 text-[13px] leading-relaxed text-on-surface focus:outline-none focus:bg-surface-container-lowest resize-y font-sans ${
              isFullscreen ? "h-full min-h-[360px]" : "min-h-[260px] max-h-[420px]"
            }`}
          />
        )}

        {(viewMode === "PREVIEW" || viewMode === "SPLIT") && (
          <div
            className={`p-4 bg-surface-container-lowest overflow-y-auto ${
              isFullscreen ? "h-full min-h-[360px]" : "min-h-[260px] max-h-[420px]"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-outline mb-2 pb-1.5 border-b border-surface-container flex items-center justify-between">
              <span>Bản xem trước hiển thị trên website</span>
              <span className="font-mono">{metrics.readingMinutes > 0 ? `~${metrics.readingMinutes} phút đọc` : ""}</span>
            </div>
            {metrics.isEmpty ? (
              <p className="text-xs text-outline italic py-8 text-center">
                Chưa có nội dung để xem trước. Hãy nhập hoặc chọn định dạng trên thanh công cụ...
              </p>
            ) : (
              <div className="prose prose-sm max-w-none text-on-surface">
                {renderArticleContent(value)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Status Bar */}
      <div className="px-3 py-1.5 bg-surface-container-low border-t border-surface-container flex flex-wrap items-center justify-between gap-2 text-[11px] text-outline">
        <span className="hidden sm:inline">
          Phím tắt: <strong>Ctrl+B</strong> Đậm • <strong>Ctrl+I</strong> Nghiêng •{" "}
          <strong>Ctrl+U</strong> Gạch chân • <strong>Ctrl+K</strong> Chèn link
        </span>
        <div className="flex items-center gap-3 font-mono ml-auto">
          <span>{metrics.wordCount.toLocaleString("vi-VN")} từ</span>
          <span>•</span>
          <span>{metrics.charCount.toLocaleString("vi-VN")} ký tự</span>
          {metrics.readingMinutes > 0 && (
            <>
              <span>•</span>
              <span>~{metrics.readingMinutes} phút đọc</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
