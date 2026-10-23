import React from "react";

export function renderInlineText(text) {
    if (!text) return "";
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={i} className="font-bold text-primary">{part.slice(2, -2)}</strong>;
        }
        return part;
    });
}

export function renderArticleContent(content) {
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
