'use client';

import React from 'react';

export default function HomepageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 animate-pulse">
      {/* Header skeleton */}
      <div className="h-16 sm:h-20 bg-white border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 sm:size-12 rounded-xl bg-slate-200" />
          <div className="flex flex-col gap-2">
            <div className="w-28 sm:w-36 h-4 rounded-md bg-slate-200" />
            <div className="w-16 h-3 rounded-md bg-slate-100" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-10 rounded-xl bg-slate-200" />
          <div className="size-10 rounded-xl bg-slate-200" />
        </div>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Banner Skeleton */}
        <div className="aspect-[16/9] sm:aspect-[21/9] max-h-[360px] rounded-2xl sm:rounded-3xl bg-slate-200 w-full" />

        {/* Categories Skeleton */}
        <div className="space-y-4">
          <div className="w-32 h-6 rounded-md bg-slate-200" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2 shrink-0">
                <div className="size-16 sm:size-20 rounded-full bg-slate-200" />
                <div className="w-12 h-3 rounded-md bg-slate-100" />
              </div>
            ))}
          </div>
        </div>

        {/* Specials Skeleton */}
        <div className="space-y-4">
          <div className="w-40 h-6 rounded-md bg-slate-200" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 p-3 space-y-3">
                <div className="aspect-[16/9] rounded-xl bg-slate-200" />
                <div className="w-3/4 h-4 rounded-md bg-slate-200" />
                <div className="w-1/2 h-3 rounded-md bg-slate-100" />
                <div className="flex justify-between items-center pt-2">
                  <div className="w-16 h-5 rounded-md bg-slate-200" />
                  <div className="w-20 h-8 rounded-xl bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Popular Items Skeleton */}
        <div className="space-y-4">
          <div className="w-36 h-6 rounded-md bg-slate-200" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl bg-white border border-slate-200/80 p-3 space-y-3">
                <div className="aspect-[4/3] rounded-xl bg-slate-200" />
                <div className="w-3/4 h-4 rounded-md bg-slate-200" />
                <div className="flex justify-between items-center pt-2">
                  <div className="w-12 h-4 rounded-md bg-slate-200" />
                  <div className="w-14 h-7 rounded-lg bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
