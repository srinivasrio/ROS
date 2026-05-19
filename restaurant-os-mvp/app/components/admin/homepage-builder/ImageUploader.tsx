'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Image as ImageIcon, Link, Loader2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase';

interface ImageUploaderProps {
    currentUrl: string;
    onImageChange: (url: string) => void;
    aspectRatio?: string;
    bucket?: string;
    folder?: string;
    compact?: boolean;
}

export default function ImageUploader({
    currentUrl,
    onImageChange,
    aspectRatio = '16/9',
    bucket = 'menu-images',
    folder = 'homepage',
    compact = false,
}: ImageUploaderProps) {
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback(async (file: File) => {
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be under 5MB');
            return;
        }

        setError('');
        setUploading(true);

        try {
            const supabase = createClient();
            const ext = file.name.split('.').pop() || 'jpg';
            const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(fileName, file, { cacheControl: '3600', upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(fileName);

            onImageChange(publicUrl);
        } catch (err: any) {
            console.error('Upload failed:', err);
            setError(err.message || 'Upload failed');
            // Fallback: use local object URL as a data URL
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    onImageChange(e.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        } finally {
            setUploading(false);
        }
    }, [bucket, folder, onImageChange]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFileSelect(file);
    }, [handleFileSelect]);

    const handleUrlSubmit = () => {
        if (urlInput.trim()) {
            onImageChange(urlInput.trim());
            setShowUrlInput(false);
            setUrlInput('');
        }
    };

    const handleRemoveImage = () => {
        onImageChange('');
    };

    if (compact) {
        return (
            <div className="space-y-2">
                {/* Preview */}
                {currentUrl && (
                    <div className="relative rounded-lg overflow-hidden border border-neutral-200 group" style={{ aspectRatio }}>
                        <img src={currentUrl} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-white rounded-lg text-black hover:bg-neutral-100 transition-colors" title="Replace">
                                <Upload size={14} />
                            </button>
                            <button onClick={handleRemoveImage} className="p-2 bg-white rounded-lg text-red-600 hover:bg-red-50 transition-colors" title="Remove">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Upload Controls */}
                <div className="flex gap-1.5">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
                    >
                        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        {uploading ? 'Uploading...' : currentUrl ? 'Replace' : 'Upload'}
                    </button>
                    <button
                        onClick={() => setShowUrlInput(!showUrlInput)}
                        className="px-3 py-2 text-xs font-semibold border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                    >
                        <Link size={12} />
                    </button>
                </div>

                {/* URL Input */}
                <AnimatePresence>
                    {showUrlInput && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="flex gap-1.5">
                                <input
                                    type="text"
                                    value={urlInput}
                                    onChange={e => setUrlInput(e.target.value)}
                                    placeholder="Paste image URL..."
                                    className="flex-1 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-violet-400"
                                    onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
                                />
                                <button onClick={handleUrlSubmit} className="px-2.5 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700">Go</button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {error && <p className="text-[10px] text-red-500 font-medium">{error}</p>}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
            </div>
        );
    }

    // ─── Full Mode ───
    return (
        <div className="space-y-2">
            {currentUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-neutral-200 group" style={{ aspectRatio }}>
                    <img src={currentUrl} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg text-xs font-bold text-black hover:bg-neutral-100 transition-colors shadow-lg">
                            <Upload size={14} /> Replace
                        </button>
                        <button onClick={handleRemoveImage} className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 transition-colors shadow-lg">
                            <Trash2 size={14} /> Remove
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    className={`relative rounded-xl border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center py-8 gap-2 ${dragActive ? 'border-violet-400 bg-violet-50/30' : 'border-neutral-200 hover:border-violet-300 hover:bg-violet-50/10'}`}
                    onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{ aspectRatio }}
                >
                    {uploading ? (
                        <Loader2 size={24} className="animate-spin text-violet-500" />
                    ) : (
                        <>
                            <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center">
                                <ImageIcon size={20} className="text-black" />
                            </div>
                            <p className="text-xs font-semibold text-black">Drop image here or click to upload</p>
                            <p className="text-[10px] text-black">PNG, JPG, WebP • Max 5MB</p>
                        </>
                    )}
                </div>
            )}

            <div className="flex gap-1.5">
                <button onClick={() => setShowUrlInput(!showUrlInput)} className="text-[10px] font-semibold text-violet-600 hover:text-violet-700 transition-colors">
                    or paste URL
                </button>
            </div>

            <AnimatePresence>
                {showUrlInput && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="flex gap-1.5">
                            <input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://example.com/image.jpg" className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-violet-400" onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()} />
                            <button onClick={handleUrlSubmit} className="px-3 py-2 text-xs font-bold bg-violet-600 text-white rounded-lg hover:bg-violet-700">Set</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {error && <p className="text-[10px] text-red-500 font-medium mt-1">{error}</p>}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
        </div>
    );
}
