'use client';

import React, { useState, useMemo } from 'react';
import { sanitizeEmailHtml, stripHtmlToText } from '@/lib/sanitize-html';
import { Eye, FileText } from 'lucide-react';

interface SafeEmailBodyProps {
    content: string;
    className?: string;
}

export function SafeEmailBody({ content, className = '' }: SafeEmailBodyProps) {
    const [viewMode, setViewMode] = useState<'formatted' | 'text'>('formatted');

    // Memoize sanitized HTML and stripped plain text to prevent unnecessary recalculations
    const sanitizedHtml = useMemo(() => sanitizeEmailHtml(content), [content]);
    const plainText = useMemo(() => stripHtmlToText(content), [content]);

    return (
        <div className="space-y-1.5">
            <div className="flex justify-end items-center gap-2">
                <button
                    type="button"
                    onClick={() => setViewMode(viewMode === 'formatted' ? 'text' : 'formatted')}
                    className="text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-zinc-200 flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded bg-neutral-200/50 dark:bg-zinc-800/50"
                    title={viewMode === 'formatted' ? 'Switch to plain text view' : 'Switch to formatted view'}
                >
                    {viewMode === 'formatted' ? (
                        <>
                            <FileText size={10} />
                            <span>Plain Text</span>
                        </>
                    ) : (
                        <>
                            <Eye size={10} />
                            <span>Formatted</span>
                        </>
                    )}
                </button>
            </div>

            {viewMode === 'formatted' ? (
                <div
                    className={`text-[11px] font-medium text-neutral-600 dark:text-zinc-300 bg-neutral-100/60 dark:bg-zinc-900/60 p-2.5 rounded-lg max-h-[120px] overflow-y-auto break-words font-sans space-y-1 [&_h3]:font-bold [&_h3]:text-neutral-900 dark:[&_h3]:text-white [&_h3]:text-xs [&_p]:text-[11px] [&_p]:leading-relaxed [&_strong]:font-semibold [&_strong]:text-neutral-900 dark:[&_strong]:text-zinc-200 [&_a]:text-orange-500 [&_a]:underline hover:[&_a]:text-orange-600 ${className}`}
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
            ) : (
                <div
                    className={`text-[11px] font-mono text-neutral-600 dark:text-zinc-400 bg-neutral-100/60 dark:bg-zinc-900/60 p-2.5 rounded-lg max-h-[120px] overflow-y-auto break-all whitespace-pre-wrap ${className}`}
                >
                    {plainText}
                </div>
            )}
        </div>
    );
}
