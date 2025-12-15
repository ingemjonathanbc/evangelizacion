import React, { useEffect, useRef } from 'react';
import { ReadingContent, GeneratedAsset } from '../types';
import { Loader2, RefreshCw, Video, PlayCircle, Film, CheckCircle } from 'lucide-react';
import VideoPreview from './VideoPreview';

interface ReadingCardProps {
  reading: ReadingContent;
  asset: GeneratedAsset;
  onGenerateAssets: (reading: ReadingContent) => void;
  onGenerateVideo: (reading: ReadingContent) => void;
}

const ReadingCard: React.FC<ReadingCardProps> = ({ 
  reading, 
  asset, 
  onGenerateAssets,
  onGenerateVideo
}) => {
  const isGeneratingAssets = asset.isGeneratingImage || asset.isGeneratingAudio;
  const isGeneratingVideo = asset.isGeneratingVideo;
  
  // Updated check for multiple images
  const hasImages = asset.imageUrls && asset.imageUrls.length > 0;
  const hasAssets = hasImages && asset.audioUrl;
  const hasVideo = asset.videoUrl;

  // Track the last downloaded URL to prevent loop but allow new generations to download
  const lastDownloadedUrl = useRef<string | null>(null);

  useEffect(() => {
    if (hasVideo && asset.videoUrl && asset.videoUrl !== lastDownloadedUrl.current) {
      // Auto-download logic
      const link = document.createElement('a');
      link.href = asset.videoUrl;
      link.download = `video-${reading.id}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Mark as downloaded
      lastDownloadedUrl.current = asset.videoUrl;
    }
  }, [hasVideo, asset.videoUrl, reading.id]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col xl:flex-row shadow-xl">
      {/* Left: Text Content */}
      <div className="flex-1 p-6 border-b xl:border-b-0 xl:border-r border-gray-800 flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="inline-block px-2 py-1 bg-indigo-900/50 text-indigo-300 text-xs font-bold rounded uppercase tracking-wider mb-2">
              {reading.type.replace('_', ' ')}
            </span>
            <h2 className="text-2xl font-bold text-white mb-1">{reading.title}</h2>
            <p className="text-gray-400 text-sm">{reading.reference}</p>
          </div>
        </div>

        <div className="bg-gray-950/50 p-4 rounded-lg border border-gray-800 h-64 overflow-y-auto mb-6 text-gray-300 leading-relaxed font-serif flex-grow">
          {reading.text}
        </div>

        <div className="mt-auto grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Step 1: Generate Assets */}
          <button
            onClick={() => onGenerateAssets(reading)}
            disabled={isGeneratingAssets || isGeneratingVideo}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-sm transition-all shadow-lg ${
              hasAssets 
                ? 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            } disabled:opacity-50`}
          >
            {isGeneratingAssets ? (
              <Loader2 className="animate-spin w-4 h-4" />
            ) : hasAssets ? (
              <RefreshCw className="w-4 h-4" />
            ) : (
              <Video className="w-4 h-4" />
            )}
            {isGeneratingAssets ? 'Creando (3 Escenas + Audio)...' : hasAssets ? 'Regenerar Assets' : '1. Generar Assets'}
          </button>
          
          {/* Step 2: Render Video */}
          <button
            onClick={() => onGenerateVideo(reading)}
            disabled={!hasAssets || isGeneratingVideo || isGeneratingAssets}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-sm transition-all shadow-lg ${
              hasVideo
                ? 'bg-green-600 hover:bg-green-500 text-white border border-green-500' 
                : 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white'
            } disabled:opacity-30 disabled:cursor-not-allowed`}
          >
             {isGeneratingVideo ? (
              <>
                <Loader2 className="animate-spin w-4 h-4" />
                <span>Renderizando ({Math.floor(Math.random() * 100)}%)...</span>
              </>
            ) : hasVideo ? (
              <>
                 <CheckCircle className="w-4 h-4" />
                 <span>Video Listo (Auto-Descargado)</span>
              </>
            ) : (
              <>
                <Film className="w-4 h-4" />
                <span>2. Renderizar Video</span>
              </>
            )}
          </button>
        </div>
        
        {hasVideo && (
            <div className="mt-4 p-3 bg-green-900/20 border border-green-800 rounded text-center animate-in fade-in zoom-in duration-300">
                <p className="text-green-300 text-xs mb-2">¡Video renderizado y descargado!</p>
                <a 
                  href={asset.videoUrl} 
                  download={`video-${reading.id}.mp4`}
                  className="inline-block px-6 py-2 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-500 transition-colors"
                >
                    Volver a descargar
                </a>
            </div>
        )}
      </div>

      {/* Right: Preview */}
      <div className="p-6 bg-gray-950 flex flex-col items-center justify-center min-w-[350px] border-l border-gray-800">
        <div className="flex items-center gap-2 mb-4 text-gray-500">
             <PlayCircle size={14} />
             <h3 className="text-xs font-bold uppercase tracking-widest">Vista Previa (3 Escenas)</h3>
        </div>
        <VideoPreview reading={reading} asset={asset} />
      </div>
    </div>
  );
};

export default ReadingCard;