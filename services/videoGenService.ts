import { ReadingContent, GeneratedAsset } from "../types";

// Canvas constants for 9:16 Short/TikTok format (HD)
const WIDTH = 720;
const HEIGHT = 1280;
const PADDING = 80; 

// Fonts
const FONT_SIZE_TEXT = 44; 
const LINE_HEIGHT_TEXT = 70; 
const FONT_SIZE_TITLE = 38;
const FONT_SIZE_BADGE = 26;

// Layout Constants 
const TOP_SAFE_AREA = 340; 
// Increased bottom safe area to make room for CTA + Reference Pill
const BOTTOM_SAFE_AREA = 400; 

/**
 * Loads an image from a URL into an HTMLImageElement
 */
const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

/**
 * Loads audio to get duration and play it
 */
const loadAudio = (url: string): Promise<HTMLAudioElement> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.onloadedmetadata = () => resolve(audio);
    audio.onerror = reject;
    audio.src = url;
  });
};

/**
 * Helper to draw a rounded rectangle (Pill shape)
 */
const fillRoundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, fillStyle: string, strokeStyle?: string) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
};

/**
 * Calculate lines for CENTERED text wrapping
 */
const calculateLayout = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const spaceWidth = ctx.measureText(' ').width;
  
  const lines: { words: { text: string; width: number; x: number }[], y: number }[] = [];
  
  let currentLineWords: { text: string; width: number }[] = [];
  let currentLineWidth = 0;

  words.forEach(word => {
    const wordWidth = ctx.measureText(word).width;
    const newLineWidth = currentLineWidth === 0 
      ? wordWidth 
      : currentLineWidth + spaceWidth + wordWidth;

    if (newLineWidth < maxWidth) {
      currentLineWords.push({ text: word, width: wordWidth });
      currentLineWidth = newLineWidth;
    } else {
      lines.push({ words: [], y: 0 }); 
      const lastLineIndex = lines.length - 1;
      
      let currentX = (WIDTH - currentLineWidth) / 2;
      
      const wordsWithPos = currentLineWords.map(w => {
        const item = { ...w, x: currentX };
        currentX += w.width + spaceWidth;
        return item;
      });
      
      lines[lastLineIndex].words = wordsWithPos;
      
      currentLineWords = [{ text: word, width: wordWidth }];
      currentLineWidth = wordWidth;
    }
  });

  if (currentLineWords.length > 0) {
    lines.push({ words: [], y: 0 });
    const lastLineIndex = lines.length - 1;
    let currentX = (WIDTH - currentLineWidth) / 2;
    const wordsWithPos = currentLineWords.map(w => {
        const item = { ...w, x: currentX };
        currentX += w.width + spaceWidth;
        return item;
    });
    lines[lastLineIndex].words = wordsWithPos;
  }

  const wordMap: { text: string; x: number; y: number; lineIndex: number }[] = [];
  lines.forEach((line, lineIdx) => {
    const lineY = lineIdx * LINE_HEIGHT_TEXT;
    line.y = lineY; 
    line.words.forEach(w => {
      wordMap.push({
        text: w.text,
        x: w.x,
        y: lineY,
        lineIndex: lineIdx
      });
    });
  });

  return { wordMap, totalHeight: lines.length * LINE_HEIGHT_TEXT };
};

const lerp = (start: number, end: number, factor: number) => {
  return start + (end - start) * factor;
};

// --- PARTICLE SYSTEM FOR "DIVINE ATMOSPHERE" ---
class ParticleSystem {
  particles: {x: number, y: number, r: number, speed: number, alpha: number}[];

  constructor(count: number) {
    this.particles = [];
    for(let i=0; i<count; i++) {
      this.particles.push(this.createParticle());
    }
  }

  createParticle() {
    return {
      x: Math.random() * WIDTH,
      y: Math.random() * HEIGHT,
      r: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.5 + 0.2,
      alpha: Math.random() * 0.5 + 0.1
    };
  }

  updateAndDraw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "rgba(255, 215, 0, 0.6)"; // Gold
    
    this.particles.forEach(p => {
      p.y -= p.speed;
      p.alpha -= 0.002;

      if (p.y < 0 || p.alpha <= 0) {
        Object.assign(p, this.createParticle());
        p.y = HEIGHT + 10;
      }

      ctx.beginPath();
      ctx.globalAlpha = p.alpha;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1; // Reset
  }
}

/**
 * Main function to generate the video
 */
export const generateVideoFile = async (reading: ReadingContent, asset: GeneratedAsset): Promise<string> => {
  if (!asset.imageUrls || asset.imageUrls.length === 0 || !asset.audioUrl) throw new Error("Missing assets");
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not available");

  // Load ALL images
  const bgImages = await Promise.all(asset.imageUrls.map(url => loadImage(url)));
  const audio = await loadAudio(asset.audioUrl);

  // Audio Setup with Analyser for Visualizer
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  const dest = audioCtx.createMediaStreamDestination();
  const source = audioCtx.createMediaElementSource(audio);
  
  // Analyser node for visualizer
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64; // Low resolution for chunky bars
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  source.connect(analyser);
  analyser.connect(dest);
  analyser.connect(audioCtx.destination); 

  // Init Particles
  const particles = new ParticleSystem(40);

  // --- PRE-CALCULATE LAYOUT ---
  
  ctx.font = `900 ${FONT_SIZE_TITLE}px Inter, sans-serif`;
  const titleWords = reading.title.toUpperCase().split(' ');
  const titleLines: string[] = [];
  let currentTitleLine = titleWords[0];
  for(let i=1; i<titleWords.length; i++) {
     const w = titleWords[i];
     const width = ctx.measureText(currentTitleLine + " " + w).width;
     if(width < WIDTH - 140) {
         currentTitleLine += " " + w;
     } else {
         titleLines.push(currentTitleLine);
         currentTitleLine = w;
     }
  }
  titleLines.push(currentTitleLine);

  ctx.font = `900 ${FONT_SIZE_TEXT}px Inter, sans-serif`; 
  const { wordMap } = calculateLayout(ctx, reading.text, WIDTH - (PADDING * 2));
  const allWordsFlat = reading.text.split(/\s+/).filter(w => w.length > 0); 

  const centerY = HEIGHT / 2;
  let smoothedScrollY = centerY - (wordMap[0]?.y || 0);

  // --- RECORDING SETUP ---
  const stream = canvas.captureStream(30);
  const audioTrack = dest.stream.getAudioTracks()[0];
  if (audioTrack) stream.addTrack(audioTrack);

  const chunks: Blob[] = [];
  let mimeType = 'video/webm'; 
  if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4';
  else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) mimeType = 'video/webm;codecs=h264';
  
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 15000000 });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise((resolve, reject) => {
    recorder.onerror = (e) => reject(e);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve(URL.createObjectURL(blob));
      audioCtx.close();
    };

    recorder.start();
    audio.play().catch(e => console.error(e));

    const drawFrame = () => {
      if (audio.paused || audio.ended) {
        if (recorder.state === 'recording') recorder.stop();
        return;
      }

      // Get Audio Data for Visuals
      analyser.getByteFrequencyData(dataArray);
      let avgVolume = 0;
      for(let i=0; i<bufferLength; i++) avgVolume += dataArray[i];
      avgVolume = avgVolume / bufferLength;
      
      const duration = audio.duration || 1;
      const currentTime = audio.currentTime;
      const progress = currentTime / duration;

      // === LAYER 1: BACKGROUND (Multi-Image Switching) ===
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      // Determine which image to show based on progress segments
      const imgDuration = 1 / bgImages.length;
      const imgIndex = Math.min(Math.floor(progress / imgDuration), bgImages.length - 1);
      const bgImage = bgImages[imgIndex];

      // Calculate a local progress for this specific image (0 to 1) for the zoom effect
      const segmentStart = imgIndex * imgDuration;
      const localProgress = (progress - segmentStart) / imgDuration; // 0.0 -> 1.0 within the image's slot

      const canvasRatio = WIDTH / HEIGHT;
      const sw = bgImage.naturalWidth;
      const sh = bgImage.naturalHeight;
      const imageRatio = sw / sh;

      let cropW, cropH, cropX, cropY;

      if (imageRatio > canvasRatio) {
        cropH = sh;
        cropW = sh * canvasRatio;
        cropX = (sw - cropW) / 2;
        cropY = 0;
      } else {
        cropW = sw;
        cropH = sw / canvasRatio;
        cropX = 0;
        cropY = (sh - cropH) / 2;
      }

      // Dynamic Zoom + Beat Pulse (Resets for each image via localProgress)
      const pulseScale = (avgVolume / 255) * 0.05;
      const scale = 1 + (localProgress * 0.15) + pulseScale; 

      const viewW = cropW / scale;
      const viewH = cropH / scale;
      const viewX = cropX + (cropW - viewW) / 2;
      const viewY = cropY + (cropH - viewH) / 2;

      ctx.globalAlpha = 1;
      ctx.drawImage(bgImage, Math.floor(viewX), Math.floor(viewY), Math.floor(viewW), Math.floor(viewH), 0, 0, WIDTH, HEIGHT);

      // Dark Overlay
      const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      gradient.addColorStop(0, "rgba(0, 0, 0, 0.4)");
      gradient.addColorStop(0.3, "rgba(0, 0, 0, 0.3)");
      gradient.addColorStop(0.7, "rgba(0, 0, 0, 0.8)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.98)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // === LAYER 1.5: PARTICLES (Holy Dust) ===
      particles.updateAndDraw(ctx);


      // === LAYER 2: SCROLLING TEXT ===
      ctx.save();
      ctx.beginPath();
      // Adjust clip to respect new larger bottom safe area
      const clipHeight = HEIGHT - TOP_SAFE_AREA - BOTTOM_SAFE_AREA;
      ctx.rect(0, TOP_SAFE_AREA, WIDTH, clipHeight);
      ctx.clip(); 

      const currentWordIndex = Math.min(
        Math.floor(progress * allWordsFlat.length), 
        allWordsFlat.length - 1
      );
      const currentWordData = wordMap[currentWordIndex];
      const targetY = currentWordData ? currentWordData.y : 0;
      
      const targetScrollY = centerY - targetY;
      smoothedScrollY = lerp(smoothedScrollY, targetScrollY, 0.1); 

      ctx.translate(0, smoothedScrollY); 

      ctx.font = `900 ${FONT_SIZE_TEXT}px Inter, sans-serif`;
      ctx.textAlign = "left"; 
      ctx.textBaseline = "top";
      ctx.lineJoin = "round";

      const visibleMin = -smoothedScrollY + TOP_SAFE_AREA - 100;
      const visibleMax = -smoothedScrollY + HEIGHT - BOTTOM_SAFE_AREA + 100;

      wordMap.forEach((w, wIdx) => {
        if (w.y < visibleMin || w.y > visibleMax) return;

        const isActive = wIdx === currentWordIndex;
        const isPast = wIdx < currentWordIndex;

        if (isActive) {
            ctx.shadowColor = "rgba(0,0,0,0.9)";
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 4;
            
            ctx.fillStyle = "#fbbf24"; 
            ctx.fillText(w.text, w.x, w.y);
            
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        } else if (isPast) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.3)"; 
            ctx.fillText(w.text, w.x, w.y);
        } else {
            ctx.strokeStyle = "black";
            ctx.lineWidth = 6;
            ctx.strokeText(w.text, w.x, w.y);
            ctx.fillStyle = "white";
            ctx.fillText(w.text, w.x, w.y);
        }
      });
      ctx.restore(); 


      // === LAYER 3: HEADER ===
      const dateText = (reading.date || "Evangelio del Día").toUpperCase();
      ctx.font = `bold ${FONT_SIZE_BADGE}px Inter, sans-serif`;
      const dateWidth = ctx.measureText(dateText).width + 50;
      const dateX = (WIDTH - dateWidth) / 2;
      const dateY = 80; 
      
      fillRoundRect(ctx, dateX, dateY, dateWidth, 44, 22, "rgba(0, 0, 0, 0.6)", "rgba(255, 255, 255, 0.15)");
      
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(dateText, WIDTH/2, dateY + 22);

      ctx.font = `900 ${FONT_SIZE_TITLE}px Inter, sans-serif`;
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = "white";
      
      let titleY = dateY + 80;
      titleLines.forEach(line => {
          ctx.fillText(line, WIDTH/2, titleY);
          titleY += 45;
      });


      // === LAYER 4: VISUALIZER (Moved behind CTA) ===
      const barWidth = (WIDTH / bufferLength) * 2.5;
      const visCenter = WIDTH / 2;
      const visY = HEIGHT - 40; // Bottom pinned

      ctx.fillStyle = "rgba(167, 139, 250, 0.6)"; 
      for(let i = 0; i < bufferLength / 2; i++) {
        const barHeight = (dataArray[i] / 255) * 60; 
        ctx.fillRect(visCenter + (i * barWidth), visY - barHeight, barWidth - 2, barHeight);
        ctx.fillRect(visCenter - ((i + 1) * barWidth), visY - barHeight, barWidth - 2, barHeight);
      }


      // === LAYER 5: FOOTER & CALL TO ACTION ===
      
      // 1. Reference Pill (Moved UP significantly to make room for CTA)
      const refText = reading.reference;
      ctx.font = `bold ${32}px Inter, sans-serif`;
      const refWidth = ctx.measureText(refText).width + 60;
      const refX = (WIDTH - refWidth) / 2;
      const refY = HEIGHT - 340; // Higher up

      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 10;
      fillRoundRect(ctx, refX, refY, refWidth, 60, 16, "rgba(79, 70, 229, 0.95)"); 

      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "transparent";
      ctx.fillText(refText, WIDTH/2, refY + 30);

      // 2. CALL TO ACTION (CTA) - Viral Style
      const ctaY = HEIGHT - 180;
      
      // Line 1: Main Hook (Gold + Black Outline)
      ctx.font = `900 42px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      ctx.shadowColor = "rgba(0,0,0,1)";
      ctx.shadowBlur = 15;
      
      ctx.fillStyle = "#fbbf24"; // Amber-400
      ctx.fillText("ESCRIBE 'AMÉN'", WIDTH/2, ctaY);
      
      // Strong Stroke for visibility over visualizer
      ctx.strokeStyle = "black";
      ctx.lineWidth = 6;
      ctx.strokeText("ESCRIBE 'AMÉN'", WIDTH/2, ctaY);
      ctx.fillText("ESCRIBE 'AMÉN'", WIDTH/2, ctaY); 

      // Line 2: Subtitle (White)
      ctx.font = `bold 24px Inter, sans-serif`;
      ctx.fillStyle = "white";
      ctx.shadowBlur = 4;
      ctx.shadowColor = "black";
      ctx.fillText("Y COMPARTE LA PALABRA DEL SEÑOR", WIDTH/2, ctaY + 45);


      // === LAYER 6: PROGRESS BAR ===
      const barHeight = 14;
      const gradBar = ctx.createLinearGradient(0, 0, WIDTH, 0);
      gradBar.addColorStop(0, "#6366f1"); 
      gradBar.addColorStop(1, "#a855f7"); 
      
      ctx.fillStyle = "#111827"; 
      ctx.fillRect(0, HEIGHT - barHeight, WIDTH, barHeight);
      
      ctx.fillStyle = gradBar;
      ctx.shadowColor = "rgba(168, 85, 247, 0.6)";
      ctx.shadowBlur = 15;
      ctx.fillRect(0, HEIGHT - barHeight, WIDTH * progress, barHeight);

      requestAnimationFrame(drawFrame);
    };

    drawFrame();
  });
};