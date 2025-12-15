import React, { useState, useEffect, useRef } from 'react';
import { ReadingContent, GeneratedAsset, AppState } from './types';
import * as geminiService from './services/geminiService';
import * as videoGenService from './services/videoGenService';
import ReadingCard from './components/ReadingCard';
import { Bot, Calendar, Search, AlertCircle, Loader2, Sparkles, Zap } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    date: new Date().toISOString().split('T')[0],
    readings: [],
    assets: {},
    isLoading: false,
    isAutoMode: false,
    error: null,
  });

  // Reference to avoid closure stale state issues in async chains if needed, 
  // though we mostly rely on useEffect for the reactive chain.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // --- AUTOMATION EFFECT 1: Trigger Assets when Readings are loaded ---
  useEffect(() => {
    if (state.isAutoMode && state.readings.length > 0) {
      // Check if ANY generation is currently in progress globally to avoid rate limits
      const isGeneratingSomething = Object.values(state.assets).some(
        a => a.isGeneratingImage || a.isGeneratingAudio || a.isGeneratingVideo
      );

      if (isGeneratingSomething) return;

      // Find the FIRST reading that needs processing (sequential processing)
      const pendingReading = state.readings.find(reading => {
        const asset = state.assets[reading.id];
        const hasImages = asset.imageUrls && asset.imageUrls.length > 0;
        return !hasImages || !asset.audioUrl;
      });

      if (pendingReading) {
        handleGenerateAllAssets(pendingReading);
      }
    }
  }, [state.readings, state.assets, state.isAutoMode]);

  // --- AUTOMATION EFFECT 2: Trigger Video when Assets are ready ---
  useEffect(() => {
    if (state.isAutoMode) {
      // 1. Check if ANY video is currently rendering to enforce "one by one"
      const isRenderingVideo = Object.values(state.assets).some(a => a.isGeneratingVideo);
      if (isRenderingVideo) return;

      // 2. Find the FIRST asset that is ready to render
      const readyAsset = Object.values(state.assets).find((asset: GeneratedAsset) => {
        const hasImages = asset.imageUrls && asset.imageUrls.length > 0;
        return hasImages && asset.audioUrl && !asset.videoUrl && !asset.isGeneratingVideo;
      });

      // 3. Trigger render for that specific asset
      if (readyAsset) {
        const reading = state.readings.find(r => r.id === readyAsset.readingId);
        if (reading) {
          handleRenderVideo(reading);
        }
      }
    }
  }, [state.assets, state.isAutoMode]);

  const handleFetchReadings = async (enableAutoMode: boolean = false) => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      readings: [],
      isAutoMode: enableAutoMode
    }));

    try {
      const readings = await geminiService.fetchDailyReadings(state.date);

      // Initialize assets state for each reading
      const initialAssets: Record<string, GeneratedAsset> = {};
      readings.forEach(r => {
        initialAssets[r.id] = {
          readingId: r.id,
          isGeneratingAudio: false,
          isGeneratingImage: false,
          isGeneratingVideo: false,
          imageUrls: [] // Init empty array
        };
      });

      setState(prev => ({
        ...prev,
        readings,
        assets: initialAssets,
        isLoading: false
        // isAutoMode remains what it was set to at start of function
      }));
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        isAutoMode: false, // Stop auto mode on error
        error: err.message || "Error al obtener lecturas"
      }));
    }
  };

  const handleGenerateAllAssets = async (reading: ReadingContent) => {
    // Prevent double trigger
    if (stateRef.current.assets[reading.id]?.isGeneratingImage) return;

    setState(prev => ({
      ...prev,
      assets: {
        ...prev.assets,
        [reading.id]: {
          ...prev.assets[reading.id],
          isGeneratingImage: true,
          isGeneratingAudio: true
        }
      }
    }));

    try {
      const [imagesResult, audioResult] = await Promise.allSettled([
        geminiService.generateReadingImage(reading),
        geminiService.generateReadingAudio(reading.text)
      ]);

      const newImageUrls = imagesResult.status === 'fulfilled' ? imagesResult.value : [];
      const newAudioUrl = audioResult.status === 'fulfilled' ? audioResult.value : undefined;

      if (imagesResult.status === 'rejected') console.error("Error imagen:", imagesResult.reason);
      if (audioResult.status === 'rejected') console.error("Error audio:", audioResult.reason);

      setState(prev => ({
        ...prev,
        assets: {
          ...prev.assets,
          [reading.id]: {
            ...prev.assets[reading.id],
            imageUrls: newImageUrls.length > 0 ? newImageUrls : prev.assets[reading.id].imageUrls,
            audioUrl: newAudioUrl || prev.assets[reading.id].audioUrl,
            isGeneratingImage: false,
            isGeneratingAudio: false
          }
        }
      }));

    } catch (err) {
      console.error("Error general generando assets", err);
      setState(prev => ({
        ...prev,
        assets: {
          ...prev.assets,
          [reading.id]: {
            ...prev.assets[reading.id],
            isGeneratingImage: false,
            isGeneratingAudio: false
          }
        }
      }));
    }
  };

  const handleRenderVideo = async (reading: ReadingContent) => {
    // Check ref to avoid rapid-fire effect duplicates
    const currentAsset = stateRef.current.assets[reading.id];
    const hasImages = currentAsset.imageUrls && currentAsset.imageUrls.length > 0;

    if (!hasImages || !currentAsset.audioUrl || currentAsset.isGeneratingVideo || currentAsset.videoUrl) return;

    setState(prev => ({
      ...prev,
      assets: {
        ...prev.assets,
        [reading.id]: { ...prev.assets[reading.id], isGeneratingVideo: true }
      }
    }));

    try {
      // Add a small delay if in auto mode to prevent browser freezing if multiple trigger at once
      if (state.isAutoMode) {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));
      }

      const videoUrl = await videoGenService.generateVideoFile(reading, currentAsset);

      setState(prev => ({
        ...prev,
        assets: {
          ...prev.assets,
          [reading.id]: {
            ...prev.assets[reading.id],
            videoUrl: videoUrl,
            isGeneratingVideo: false
          }
        }
      }));
    } catch (error) {
      console.error("Error rendering video", error);
      // Don't alert in auto mode to avoid blocking UI
      if (!state.isAutoMode) alert("Error al renderizar el video. Por favor intenta de nuevo.");

      setState(prev => ({
        ...prev,
        assets: {
          ...prev.assets,
          [reading.id]: { ...prev.assets[reading.id], isGeneratingVideo: false }
        }
      }));
    }
  };

  return (
    <div className="min-h-screen bg-black text-gray-100 pb-20">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-lg shadow-lg shadow-indigo-500/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">EvangelioAuto Studio</h1>
              <p className="text-xs text-gray-400">Automatización de Contenido Católico con IA</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-48">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="date"
                value={state.date}
                onChange={(e) => setState({ ...state, date: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <button
                onClick={() => handleFetchReadings(false)}
                disabled={state.isLoading || state.isAutoMode}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 border border-gray-700"
              >
                {state.isLoading && !state.isAutoMode ? <Loader2 className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />}
                Solo Buscar
              </button>

              <button
                onClick={() => handleFetchReadings(true)}
                disabled={state.isLoading || state.isAutoMode}
                className="flex-1 md:flex-none flex items-center justify-center gap-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold rounded-lg hover:from-indigo-500 hover:to-purple-500 transition-all shadow-[0_0_15px_rgba(99,102,241,0.5)] disabled:opacity-50"
              >
                {state.isAutoMode ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                {state.isAutoMode ? 'Procesando...' : 'AUTOMATIZAR TODO'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* API Key Warning */}
        {!process.env.API_KEY && (
          <div className="mb-8 p-4 bg-red-900/20 border border-red-800 rounded-lg flex items-center gap-3 text-red-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">API KEY no detectada. Por favor configura tu entorno con <code>process.env.API_KEY</code> para usar Gemini.</p>
          </div>
        )}

        {state.error && (
          <div className="mb-8 p-4 bg-red-900/20 border border-red-800 rounded-lg flex items-center gap-3 text-red-200 animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="w-5 h-5" />
            <p>{state.error}</p>
          </div>
        )}

        {/* Auto Mode Status Banner */}
        {state.isAutoMode && (
          <div className="mb-8 p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-full">
                <Zap className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-bold text-indigo-300">Modo Automático Activado</h3>
                <p className="text-xs text-indigo-400">Extrayendo lecturas → Generando IA (3 Imágenes) → Renderizando Videos → Auto-descargando...</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-xs bg-black/40 px-3 py-1 rounded text-gray-400 border border-white/5">
                No cierres esta pestaña
              </span>
            </div>
          </div>
        )}

        {/* Intro State */}
        {!state.isLoading && state.readings.length === 0 && !state.error && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-900 mb-6 border border-gray-800">
              <Sparkles className="w-8 h-8 text-indigo-500" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Automatización Litúrgica</h2>
            <p className="text-gray-400 max-w-lg mx-auto mb-8">
              Genera 4 videos verticales (Shorts/Reels) automáticamente para: 1ra Lectura, Salmo, 2da Lectura y Evangelio.
            </p>

            <button
              onClick={() => handleFetchReadings(true)}
              className="px-8 py-4 bg-white text-black font-bold rounded-full text-lg hover:bg-gray-200 transition-transform hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center gap-2 mx-auto"
            >
              <Sparkles className="w-5 h-5" />
              COMENZAR AUTOMATIZACIÓN
            </button>
          </div>
        )}

        {/* Readings List */}
        <div className="space-y-8">
          {state.readings.map((reading) => (
            <ReadingCard
              key={reading.id}
              reading={reading}
              asset={state.assets[reading.id]}
              onGenerateAssets={handleGenerateAllAssets}
              onGenerateVideo={handleRenderVideo}
            />
          ))}
        </div>

        {/* Footer Note */}
        {state.readings.length > 0 && (
          <div className="mt-12 text-center text-xs text-gray-600 border-t border-gray-800 pt-8">
            <p>
              Nota: El renderizado de video se realiza localmente.
              Si estás en modo automático, los archivos se descargarán a tu carpeta de Descargas predeterminada uno por uno.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;