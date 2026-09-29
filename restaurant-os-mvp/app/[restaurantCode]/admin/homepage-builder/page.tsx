'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Undo2, Redo2, Save, Loader2, Check, Smartphone, Tablet, Monitor,
  Eye, ArrowLeft, ExternalLink, Sparkles
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

import { HomepageBuilderService } from '@/services/homepage-builder.service';
import { BannerService } from '@/services/banner.service';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { getCached, setCache, hasFreshCache } from '@/lib/data-cache';
import { requestManager } from '@/lib/cache/request-manager';
import { SyncIndicator } from '@/components/admin/SyncIndicator';
import { LoadingState } from '@/components/ui/LoadingState';
import SharedHomepageLayout from '@/components/shared/homepage/SharedHomepageLayout';
import { useBuilderState } from '@/components/admin/homepage-builder/useBuilderState';
import SectionManager from '@/components/admin/homepage-builder/SectionManager';
import PropertiesPanel from '@/components/admin/homepage-builder/PropertiesPanel';
import { CartProvider } from '@/context/CartContext';

export default function HomepageBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const restaurantCode = (params?.restaurantCode as string) || '';
  const { restaurantId, loading: restaurantLoading } = useRestaurantId();

  const cacheKey = `homepage-builder-${restaurantId || restaurantCode}`;
  const cached = getCached<any>(cacheKey);

  const [dataLoading, setDataLoading] = useState(!cached);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [previewMode, setPreviewMode] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  const { state, dispatch, undo, redo, canUndo, canRedo } = useBuilderState();

  // Hydrate immediately from cache on first render
  useEffect(() => {
    if (cached) {
      if (cached.theme) dispatch({ type: 'SET_THEME', theme: cached.theme });
      if (cached.profile) dispatch({ type: 'UPDATE_PROFILE', profile: cached.profile });
      if (cached.sections) dispatch({ type: 'SET_SECTIONS', sections: cached.sections });
      dispatch({ type: 'SET_HOMEPAGE_DATA', data: cached });
    }
  }, []);

  const loadData = useCallback(async (force = false) => {
    const targetId = restaurantId || restaurantCode;
    if (!targetId) return;
    const key = `homepage-builder-${targetId}`;

    const currentCached = getCached<any>(key);
    if (currentCached && !state.profile?.name) {
      if (currentCached.theme) dispatch({ type: 'SET_THEME', theme: currentCached.theme });
      if (currentCached.profile) dispatch({ type: 'UPDATE_PROFILE', profile: currentCached.profile });
      if (currentCached.sections) dispatch({ type: 'SET_SECTIONS', sections: currentCached.sections });
      dispatch({ type: 'SET_HOMEPAGE_DATA', data: currentCached });
      setDataLoading(false);
    }

    if (!force && hasFreshCache(key)) {
      setDataLoading(false);
      return;
    }

    if (!currentCached && !state.profile?.name) {
      setDataLoading(true);
    } else {
      setIsSyncing(true);
    }

    try {
      const homepageData = await requestManager.coalesce(key, () => 
        HomepageBuilderService.getHomepageData(restaurantId || targetId, '', 'admin')
      , 3);

      if (homepageData) {
        dispatch({ type: 'SET_THEME', theme: homepageData.theme });
        dispatch({ type: 'UPDATE_PROFILE', profile: homepageData.profile });
        dispatch({ type: 'SET_SECTIONS', sections: homepageData.sections });
        dispatch({ type: 'SET_HOMEPAGE_DATA', data: homepageData });
        setCache(key, homepageData, { ttlMs: 15 * 60 * 1000 });
        if (restaurantId) setCache(`homepage-builder-${restaurantId}`, homepageData, { ttlMs: 15 * 60 * 1000 });
        setLastSync(new Date());
      }
    } catch (err) {
      console.error('Failed to load homepage builder:', err);
      toast.error('Failed to load homepage data');
    } finally {
      setDataLoading(false);
      setIsSyncing(false);
    }
  }, [restaurantId, restaurantCode, state.profile?.name, dispatch]);

  // Load Initial Data
  useEffect(() => {
    if (!restaurantLoading && (restaurantId || restaurantCode)) {
      loadData();
    }
  }, [restaurantId, restaurantCode, restaurantLoading, loadData]);

  // Refresh banners from DB
  const refreshBanners = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const freshBanners = await BannerService.getBanners(restaurantId, false);
      dispatch({ type: 'SET_HOMEPAGE_DATA', data: { ...state.data, banners: freshBanners } });
    } catch (err) {
      console.error('[Admin] Failed to refresh banners:', err);
    }
  }, [restaurantId, dispatch, state.data]);

  // Section / Content update handler
  const handleUpdate = useCallback(
    (type: string, payload: any) => {
      if (type === 'sections') {
        dispatch({ type: 'SET_SECTIONS', sections: payload });
        dispatch({ type: 'SET_DIRTY', isDirty: true });
      } else if (type === 'profile') {
        dispatch({ type: 'UPDATE_PROFILE', profile: payload });
        dispatch({ type: 'SET_DIRTY', isDirty: true });
      } else if (type === 'update_section_data') {
        dispatch({ type: 'UPDATE_SECTION_DATA', section: payload.section, payload: payload.data });
        dispatch({ type: 'SET_DIRTY', isDirty: true });
      }
    },
    [dispatch]
  );

  // Save full state
  const handleSave = useCallback(async () => {
    if (!restaurantId || saving) return;
    setSaving(true);
    setSaveStatus('saving');

    try {
      await HomepageBuilderService.saveFullState(restaurantId, state);

      const targetId = restaurantId || restaurantCode;
      const currentData = state.data || state;
      setCache(`homepage-builder-${targetId}`, currentData);
      if (restaurantId) setCache(`homepage-builder-${restaurantId}`, currentData);
      setLastSync(new Date());

      dispatch({ type: 'SET_DIRTY', isDirty: false });
      setSaveStatus('saved');
      toast.success('Homepage published successfully!');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: any) {
      console.error('Save failed:', err);
      toast.error(`Save failed: ${err?.message || 'Unknown error'}`);
      setSaveStatus('idle');
    } finally {
      setSaving(false);
    }
  }, [restaurantId, restaurantCode, state, saving, dispatch]);

  // Keyboard Shortcuts (Cmd+Z, Cmd+Shift+Z, Cmd+S)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, handleSave]);

  if (dataLoading) return <LoadingState message="Launching Studio Editor..." fullScreen />;

  // Find currently selected section
  const selectedSection = state.sections.find(
    (s) => s.id === state.selectedSectionId || s.section_type === state.selectedSectionId || (s as any).type === state.selectedSectionId
  ) || null;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100 select-none">
      {/* ═══ Top Studio Toolbar ═══ */}
      <header className="h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 shrink-0 z-50">
        {/* Left: Navigation & Branding */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="size-9 rounded-xl border border-slate-200/80 hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors"
            title="Go Back"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 font-display">
                {state.profile?.name || 'Restaurant'}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200/60">
                Studio
              </span>
            </div>
            <p className="text-[11px] text-slate-500">Homepage Builder</p>
          </div>
        </div>

        {/* Center: Device Viewport Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setPreviewMode('mobile')}
            aria-label="Mobile preview"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              previewMode === 'mobile'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Smartphone className="size-3.5" />
            <span className="hidden sm:inline">Mobile (390px)</span>
          </button>
          <button
            onClick={() => setPreviewMode('tablet')}
            aria-label="Tablet preview"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              previewMode === 'tablet'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Tablet className="size-3.5" />
            <span className="hidden sm:inline">Tablet (768px)</span>
          </button>
          <button
            onClick={() => setPreviewMode('desktop')}
            aria-label="Desktop preview"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              previewMode === 'desktop'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Monitor className="size-3.5" />
            <span className="hidden sm:inline">Desktop</span>
          </button>
        </div>

        {/* Right: Actions (Undo/Redo, View Live, Publish) */}
        <div className="flex items-center gap-2.5">
          <SyncIndicator isSyncing={isSyncing} lastSync={lastSync} onRefresh={() => loadData(true)} />
          <div className="flex items-center border border-slate-200/80 rounded-xl overflow-hidden bg-white">
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Undo2 className="size-4" />
            </button>
            <div className="w-px h-4 bg-slate-200" />
            <button
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Redo2 className="size-4" />
            </button>
          </div>

          <a
            href={`/${restaurantCode || restaurantId}/customer/home/1`}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <ExternalLink className="size-3.5" />
            <span>View Live</span>
          </a>

          <button
            onClick={handleSave}
            disabled={saving || !state.isDirty}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
              state.isDirty
                ? 'bg-orange-600 hover:bg-orange-700 text-white active:scale-95'
                : saveStatus === 'saved'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : saveStatus === 'saved' ? (
              <Check className="size-3.5" />
            ) : (
              <Save className="size-3.5" />
            )}
            <span>{saving ? 'Publishing...' : saveStatus === 'saved' ? 'Published!' : 'Publish Changes'}</span>
          </button>
        </div>
      </header>

      {/* ═══ 3-Panel Studio Layout ═══ */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Section Manager */}
        <aside className="w-80 shrink-0 h-full overflow-hidden hidden md:block">
          <SectionManager
            sections={state.sections}
            selectedSectionId={state.selectedSectionId}
            dispatch={dispatch}
          />
        </aside>

        {/* Center Canvas: Live Homepage Preview */}
        <main className="flex-1 h-full overflow-y-auto bg-slate-200/70 p-4 sm:p-8 flex justify-center items-start">
          <div
            className={`transition-all duration-300 mx-auto ${
              previewMode === 'mobile'
                ? 'w-[390px] min-h-[780px] shadow-2xl rounded-[2.5rem] border-[6px] border-slate-900 overflow-hidden bg-slate-50'
                : previewMode === 'tablet'
                ? 'w-[768px] min-h-[850px] shadow-2xl rounded-3xl border-4 border-slate-800 overflow-hidden bg-slate-50'
                : 'w-full max-w-6xl shadow-xl rounded-2xl border border-slate-200/80 overflow-hidden bg-slate-50'
            }`}
          >
            <CartProvider>
              <SharedHomepageLayout
                mode="admin"
                restaurantId={restaurantId!}
                profile={state.profile}
                theme={state.theme}
                sections={state.sections}
                data={state.data}
                onUpdate={handleUpdate}
                addToCart={() => {}}
                updateQuantity={() => {}}
                getItemQtyInCart={() => 0}
                addSpecialToCart={() => {}}
                onSearchClick={() => {}}
                onCategoryClick={() => {}}
                onServiceClick={() => {}}
                onServicesHeaderClick={() => {}}
                onBannersChange={refreshBanners}
                selectedSectionId={state.selectedSectionId}
                onSelectSection={(sectionId) => dispatch({ type: 'SELECT_SECTION', sectionId })}
              />
            </CartProvider>
          </div>
        </main>

        {/* Right Panel: Content Configuration */}
        <aside className="w-84 shrink-0 h-full overflow-hidden hidden lg:block">
          <PropertiesPanel
            selectedSection={selectedSection}
            state={state}
            dispatch={dispatch}
          />
        </aside>
      </div>
    </div>
  );
}
