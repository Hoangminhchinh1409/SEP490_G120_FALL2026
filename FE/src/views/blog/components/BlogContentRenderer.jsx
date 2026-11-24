import React from "react";

const SAFE_URL_REGEX = /^(https?:\/\/|\/)/i;

export function sanitizeUrl(rawUrl) {
    if (typeof rawUrl !== "string") return null;
    const trimmed = rawUrl.trim();
    if (!trimmed) return null;
    if (SAFE_URL_REGEX.test(trimmed)) return trimmed;
    if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
    return null;
}

const decodeBasicEntities = (text) =>
    text
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'");

export function normalizeHtmlToMarkdown(rawContent) {
    if (!rawContent || typeof rawContent !== "string") return "";
    const hasHtmlTag = /<\/?(p|h[1-6]|ul|ol|li|blockquote|strong|b|em|i|u|s|del|br|hr|a|img|div|pre|code)\b[^>]*>/i.test(
        rawContent
    );
    if (!hasHtmlTag) return rawContent;

    let text = rawContent
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");

    text = text
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<hr\s*\/?>/gi, "\n---\n")
        .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
        .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
        .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
        .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n")
        .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) =>
            inner
                .split("\n")
                .map((l) => (l.trim() ? `> ${l.trim()}` : ""))
                .join("\n")
        )
        .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, listInner) => {
            let index = 0;
            return `\n${listInner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__, item) => {
                index += 1;
                return `${index}. ${item.trim()}\n`;
            })}\n`;
        })
        .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, listInner) =>
            `\n${listInner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__, item) => `- ${item.trim()}\n`)}\n`
        )
        .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
        .replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi, "\n![$2]($1)\n")
        .replace(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*\/?>/gi, "\n![$1]($2)\n")
        .replace(/<img[^>]*src=["']([^"']+)["'][^>]*\/?>/gi, "\n![Hình ảnh]($1)\n")
        .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
        .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**")
        .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*")
        .replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, "__$1__")
        .replace(/<(del|s)[^>]*>([\s\S]*?)<\/\1>/gi, "~~$2~~")
        .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
        .replace(/<\/(p|div)>/gi, "\n\n")
        .replace(/<(p|div)[^>]*>/gi, "");

    text = text.replace(/<\/?[a-zA-Z][^>]*>/g, "");
    return decodeBasicEntities(text).replace(/\n{3,}/g, "\n\n").trim();
}

export function stripContentToPlainText(content) {
    const normalized = normalizeHtmlToMarkdown(content || "");
    return normalized
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^>\s?/gm, "")
        .replace(/^[-*]\s+/gm, "")
        .replace(/^\d+\.\s+/gm, "")
        .replace(/^(-{3,}|\*{3,})$/gm, "")
        .replace(/(\*\*|__|~~|`|\*)/g, "")
        .trim();
}

export function getContentMetrics(content) {
    const plain = stripContentToPlainText(content);
    const hasImage = /!\[[^\]]*\]\((https?:\/\/|\/)[^)]+\)/i.test(normalizeHtmlToMarkdown(content || ""));
    const words = plain ? plain.split(/\s+/).filter(Boolean) : [];
    const wordCount = words.length;
    const charCount = plain.length;
    const readingMinutes = wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 200)) : 0;
    return {
        wordCount,
        charCount,
        readingMinutes,
        isEmpty: wordCount === 0 && !hasImage
    };
}

const INLINE_TOKEN_REGEX =
    /(\[[^\]]+\]\([^)]+\)|\*\*[^*\n]+?\*\*|__[^_\n]+?__|~~[^~\n]+?~~|`[^`\n]+?`|\*[^*\n]+?\*)/g;

export function renderInlineText(text, keyPrefix = "inl") {
    if (!text) return "";
    const parts = String(text).split(INLINE_TOKEN_REGEX);
    return parts.map((part, i) => {
        if (!part) return null;
        const key = `${keyPrefix}-${i}`;

        const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
        if (linkMatch) {
            const safeHref = sanitizeUrl(linkMatch[2]);
            if (safeHref) {
                return (
                    <a
                        key={key}
                        href={safeHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-secondary underline decoration-secondary/50 underline-offset-2 hover:text-primary font-medium transition-colors"
                    >
                        {renderInlineText(linkMatch[1], `${key}-a`)}
                    </a>
                );
            }
            return linkMatch[1];
        }

        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
            return (
                <strong key={key} className="font-bold text-primary">
                    {renderInlineText(part.slice(2, -2), `${key}-b`)}
                </strong>
            );
        }

        if (part.startsWith("__") && part.endsWith("__") && part.length > 4) {
            return (
                <u key={key} className="underline decoration-primary/60 underline-offset-2">
                    {renderInlineText(part.slice(2, -2), `${key}-u`)}
                </u>
            );
        }

        if (part.startsWith("~~") && part.endsWith("~~") && part.length > 4) {
            return (
                <del key={key} className="line-through text-outline">
                    {renderInlineText(part.slice(2, -2), `${key}-s`)}
                </del>
            );
        }

        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
            return (
                <code
                    key={key}
                    className="px-1.5 py-0.5 rounded bg-surface-container text-primary font-mono text-[0.9em]"
                >
                    {part.slice(1, -1)}
                </code>
            );
        }

        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
            return (
                <em key={key} className="italic">
                    {renderInlineText(part.slice(1, -1), `${key}-i`)}
                </em>
            );
        }

        return part;
    });
}

export function renderArticleContent(content) {
    if (!content) return null;
    const normalized = normalizeHtmlToMarkdown(content);
    const lines = normalized.split("\n");
    const elements = [];
    let bulletList = [];
    let orderedList = [];
    let quoteLines = [];

    const flushBullets = () => {
        if (bulletList.length > 0) {
            elements.push(
                <ul
                    key={`ul-${elements.length}`}
                    className="my-4 space-y-2 pl-6 list-disc text-on-surface font-body-md"
                >
                    {bulletList.map((item, idx) => (
                        <li key={idx} className="leading-relaxed">
                            {renderInlineText(item, `ul-${elements.length}-${idx}`)}
                        </li>
                    ))}
                </ul>
            );
            bulletList = [];
        }
    };

    const flushOrdered = () => {
        if (orderedList.length > 0) {
            elements.push(
                <ol
                    key={`ol-${elements.length}`}
                    className="my-4 space-y-2 pl-6 list-decimal text-on-surface font-body-md"
                >
                    {orderedList.map((item, idx) => (
                        <li key={idx} className="leading-relaxed">
                            {renderInlineText(item, `ol-${elements.length}-${idx}`)}
                        </li>
                    ))}
                </ol>
            );
            orderedList = [];
        }
    };

    const flushQuotes = () => {
        if (quoteLines.length > 0) {
            elements.push(
                <blockquote
                    key={`quote-${elements.length}`}
                    className="my-5 p-4 border-l-4 border-on-tertiary-container bg-surface-container-low rounded-r-xl italic font-body-lg text-primary text-base sm:text-lg leading-relaxed shadow-sm space-y-1.5"
                >
                    {quoteLines.map((qLine, idx) => (
                        <p key={idx}>{renderInlineText(qLine, `q-${elements.length}-${idx}`)}</p>
                    ))}
                </blockquote>
            );
            quoteLines = [];
        }
    };

    const flushAll = () => {
        flushBullets();
        flushOrdered();
        flushQuotes();
    };

    lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
            flushAll();
            return;
        }

        const imgMatch = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed);
        if (imgMatch) {
            flushAll();
            const safeSrc = sanitizeUrl(imgMatch[2]);
            if (safeSrc) {
                const altText = imgMatch[1]?.trim() || "Hình ảnh minh họa bài viết";
                elements.push(
                    <figure key={`img-${idx}`} className="my-6 flex flex-col items-center gap-2">
                        <img
                            src={safeSrc}
                            alt={altText}
                            className="w-full max-h-[460px] object-cover rounded-xl border border-surface-container shadow-sm"
                        />
                        {imgMatch[1]?.trim() && (
                            <figcaption className="text-xs text-outline italic text-center">
                                {imgMatch[1].trim()}
                            </figcaption>
                        )}
                    </figure>
                );
            }
            return;
        }

        if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
            flushAll();
            elements.push(<hr key={`hr-${idx}`} className="my-6 border-surface-container" />);
        } else if (trimmed.startsWith("#### ")) {
            flushAll();
            elements.push(
                <h4 key={`h4-${idx}`} className="text-lg text-primary font-bold mt-6 mb-2 tracking-tight">
                    {renderInlineText(trimmed.replace(/^####\s+/, ""), `h4-${idx}`)}
                </h4>
            );
        } else if (trimmed.startsWith("### ")) {
            flushAll();
            elements.push(
                <h3
                    key={`h3-${idx}`}
                    className="font-headline-md text-xl sm:text-2xl text-primary font-bold mt-7 mb-3 tracking-tight"
                >
                    {renderInlineText(trimmed.replace(/^###\s+/, ""), `h3-${idx}`)}
                </h3>
            );
        } else if (trimmed.startsWith("## ")) {
            flushAll();
            elements.push(
                <h2
                    key={`h2-${idx}`}
                    className="font-headline-lg text-2xl sm:text-3xl text-primary font-bold mt-8 mb-4 tracking-tight border-b border-surface-container pb-2"
                >
                    {renderInlineText(trimmed.replace(/^##\s+/, ""), `h2-${idx}`)}
                </h2>
            );
        } else if (trimmed.startsWith("# ")) {
            flushAll();
            elements.push(
                <h2
                    key={`h1-${idx}`}
                    className="font-headline-lg text-2xl sm:text-3xl text-primary font-extrabold mt-8 mb-4 tracking-tight"
                >
                    {renderInlineText(trimmed.replace(/^#\s+/, ""), `h1-${idx}`)}
                </h2>
            );
        } else if (trimmed.startsWith(">")) {
            flushBullets();
            flushOrdered();
            quoteLines.push(trimmed.replace(/^>\s?/, ""));
        } else if (/^[-*]\s+/.test(trimmed)) {
            flushOrdered();
            flushQuotes();
            bulletList.push(trimmed.replace(/^[-*]\s+/, ""));
        } else if (/^\d+\.\s+/.test(trimmed)) {
            flushBullets();
            flushQuotes();
            orderedList.push(trimmed.replace(/^\d+\.\s+/, ""));
        } else {
            flushAll();
            elements.push(
                <p
                    key={`p-${idx}`}
                    className="font-body-md text-on-surface/90 leading-relaxed text-base my-3.5"
                >
                    {renderInlineText(trimmed, `p-${idx}`)}
                </p>
            );
        }
    });

    flushAll();
    return elements;
}
