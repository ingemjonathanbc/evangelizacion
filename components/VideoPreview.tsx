import React, { useEffect, useRef, useState, useMemo } from 'react';
import { GeneratedAsset, ReadingContent } from '../types';
import { Play, Pause, Download, Maximize2 } from 'lucide-react';

interface VideoPreviewProps {
  reading: ReadingContent;
  asset: GeneratedAsset;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ reading, asset }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);

  // Split text into words for the karaoke effect
  const words = useMemo(() => {
    return reading.text.split(/\s+/).filter(w => w.length > 0);
  }, [reading.text]);

  // Reset state when asset changes
  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentWordIndex(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    // Reset scroll
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [asset.audioUrl]);

  // Auto-scroll logic: Keep the active word centered
  useEffect(() => {
    if (containerRef.current) {
      // The words are inside the first child (the wrapper div)
      const wrapper = containerRef.current.firstElementChild;
      if (wrapper && wrapper.children[currentWordIndex]) {
        const activeElement = wrapper.children[currentWordIndex] as HTMLElement;
        
        // Calculate position to center the element manually for better control
        // or use scrollIntoView if container is scrollable.
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
    }
  }, [currentWordIndex]); // Remove isPlaying dep to update on time seek/progress

  const togglePlay = () => {
    if (!audioRef.current || !asset.audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const duration = audioRef.current.duration;

      if (duration > 0) {
        const progressPercent = (current / duration) * 100;
        setProgress(progressPercent);

        // Estimate current word based on linear time distribution
        const estimatedIndex = Math.floor((current / duration) * words.length);
        setCurrentWordIndex(Math.min(estimatedIndex, words.length - 1));
      }
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentWordIndex(0);
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // --- MULTI-IMAGE LOGIC ---
  const images = asset.imageUrls && asset.imageUrls.length > 0 ? asset.imageUrls : (asset.imageUrl ? [asset.imageUrl] : []);
  
  // Calculate which image to show based on progress (0-100)
  const currentImageIndex = images.length > 0 
    ? Math.min(Math.floor((progress / 100) * images.length), images.length - 1) 
    : 0;
  
  const currentImage = images[currentImageIndex];

  if (!currentImage) {
    return (
      <div className="w-[320px] h-[568px] bg-gray-900/50 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-gray-800 p-6 text-center">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <Maximize2 className="text-gray-600 w-8 h-8" />
        </div>
        <p className="text-gray-400 font-medium">Vista Previa no disponible</p>
        <p className="text-gray-600 text-xs mt-2">Genera la imagen y el audio para ver el resultado viral.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Phone Container (9:16 Aspect Ratio) */}
      <div className="relative w-[320px] h-[568px] bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-gray-900 group select-none transform transition-transform">
        
        {/* 1. Dynamic Background (Multi-Image Ken Burns Effect) */}
        {/* We use a key to force re-render/animation reset on image change if we wanted, 
            but for smooth transition we just swap src and rely on the scale. 
            However, to reset the 'scale' animation per image, we can use the key. */}
        <div key={currentImageIndex} className={`absolute inset-0 transition-transform duration-[20s] ease-linear animate-in fade-in duration-700 ${isPlaying ? 'scale-125' : 'scale-100'}`}>
          <img 
            src={currentImage} 
            alt={`Background Scene ${currentImageIndex + 1}`} 
            className="w-full h-full object-cover opacity-60"
          />
        </div>
        
        {/* 2. Dark Gradient Overlay for Readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/90" />

        {/* 3. Top Meta Info (Sticky) */}
        <div className="absolute top-6 left-0 right-0 px-4 z-20 text-center">
          <span className="inline-block px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-[10px] font-bold text-white uppercase tracking-widest border border-white/10 mb-2">
            {reading.date || "Evangelio del Día"}
          </span>
          <h3 className="text-white font-black text-xl leading-tight uppercase drop-shadow-lg px-2 line-clamp-2">
            {reading.title}
          </h3>
        </div>

        {/* 4. Karaoke / Teleprompter Text Area */}
        <div 
          ref={containerRef}
          className="absolute inset-0 top-24 bottom-56 px-5 overflow-y-auto flex flex-col items-center py-[50%] no-scrollbar scroll-smooth"
        >
           <div className="text-center space-x-1">
             {words.map((word, index) => {
               const isActive = index === currentWordIndex;
               const isPast = index < currentWordIndex;
               
               return (
                 <span 
                   key={index}
                   className={`inline-block transition-all duration-200 text-2xl font-black mb-2 leading-snug break-words
                     ${isActive 
                        ? 'text-yellow-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]' 
                        : isPast 
                          ? 'text-white/40' 
                          : 'text-white shadow-black drop-shadow-md'
                     }
                   `}
                   style={{
                     textShadow: isActive ? 'none' : '2px 2px 0 #000'
                   }}
                 >
                   {word}{' '}
                 </span>
               );
             })}
           </div>
        </div>
        
        {/* 5. Footer Info (Moved Up) */}
        <div className="absolute bottom-40 left-0 right-0 px-6 text-center z-20 pointer-events-none">
           <p className="text-white font-bold text-[10px] bg-indigo-600/80 inline-block px-3 py-1 rounded-md shadow-lg backdrop-blur-sm">
             {reading.reference}
           </p>
        </div>

        {/* 6. CALL TO ACTION (Viral Style) */}
        <div className="absolute bottom-12 left-0 right-0 px-4 text-center z-20 pointer-events-none flex flex-col items-center">
            {/* Main Hook */}
            <h2 className="text-[#fbbf24] font-black text-xl leading-none tracking-tight drop-shadow-xl" 
                style={{ 
                  WebkitTextStroke: '0.5px black',
                  textShadow: '2px 2px 0px rgba(0,0,0,0.8)' 
                }}>
              ESCRIBE 'AMÉN'
            </h2>
            {/* Subtitle */}
            <p className="text-white font-bold text-[9px] mt-1 drop-shadow-md tracking-wide opacity-90">
              Y COMPARTE LA PALABRA DEL SEÑOR
            </p>
        </div>

        {/* 7. Progress Bar */}
        <div className="absolute bottom-0 left-0 h-1.5 bg-gray-800 w-full z-30">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(167,139,250,0.5)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Play/Pause Interaction Layer */}
        <button 
          onClick={togglePlay}
          className="absolute inset-0 z-40 flex items-center justify-center bg-transparent outline-none cursor-pointer"
        >
          {!isPlaying && (
            <div className="bg-black/40 backdrop-blur-sm p-5 rounded-full border border-white/20 shadow-xl transform transition-transform hover:scale-110 group-hover:opacity-100">
               <Play className="text-white w-10 h-10 fill-current ml-1" />
            </div>
          )}
        </button>

        {/* Hidden Audio Element */}
        {asset.audioUrl && (
          <audio 
            ref={audioRef}
            src={asset.audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 w-full max-w-[320px]">
        {currentImage && (
             <a 
             href={currentImage} 
             download={`image-${reading.id}.png`}
             className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-bold text-white transition-colors border border-gray-700"
           >
             <Download size={16} /> Img Actual
           </a>
        )}
       
        {asset.audioUrl && (
           <a 
           href={asset.audioUrl} 
           download={`audio-${reading.id}.wav`}
           className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-bold text-white transition-colors border border-gray-700"
         >
           <Download size={16} /> Audio
         </a>
        )}
      </div>
    </div>
  );
};

export default VideoPreview;