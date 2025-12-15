import { GoogleGenAI, Modality } from "@google/genai";
import { ReadingContent } from "../types";

// Initialize Gemini Client
const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to format date naturally
const formatDateNatural = (dateStr?: string): string => {
  if (!dateStr) return "hoy";
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("es-ES", {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
};

const base64ToUint8Array = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const createWavHeader = (dataLength: number, sampleRate: number = 24000, numChannels: number = 1) => {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  return buffer;
};

// --- SERVICES ---

/**
 * Step 1: SCRAPING EXTRACTION STRATEGY
 * Use relative path "/api/readings".
 * - Dev: Handled by Vite Proxy -> localhost:5000
 * - Prod: Handled by Flask -> localhost:5000 (Internal)
 */
export const fetchDailyReadings = async (dateStr?: string): Promise<ReadingContent[]> => {
  const targetDate = dateStr || new Date().toISOString().split('T')[0];
  const naturalDate = formatDateNatural(targetDate);

  // RUTA RELATIVA (Clave para despliegue)
  const API_URL = "/api/readings";

  console.log(`Fetching readings from Backend Scraper for: ${targetDate}`);

  try {
    const response = await fetch(`${API_URL}?date=${targetDate}`);

    if (!response.ok) {
      throw new Error(`Error del servidor Python: ${response.statusText}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("El servidor devolvió un formato incorrecto o lista vacía.");
    }

    return data.map((item: any, index: number) => ({
      id: `${item.type}-${index}-${Date.now()}`,
      type: item.type,
      title: item.title,
      reference: item.reference,
      text: item.text,
      date: naturalDate
    }));

  } catch (error: any) {
    console.error("Scraping Service Error:", error);
    throw new Error(`No se pudo conectar al Backend (${API_URL}). Asegúrate de que el servidor Python esté corriendo.`);
  }
};

// --- IMAGES & AUDIO GENERATION ---

// Helper for delay
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper for retry logic
const retryOperation = async <T>(operation: () => Promise<T>, retries = 5, delay = 2000): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      const errString = JSON.stringify(error) + (error.message || '') + (error.status || '');
      const isRateLimit = errString.includes('429');
      const isOverloaded = errString.includes('503');

      if (isRateLimit || isOverloaded) {
        const waitTime = delay * Math.pow(2, i);
        console.warn(`API Issue detected (429/503). Retrying in ${waitTime}ms... (Attempt ${i + 1}/${retries})`);
        await wait(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded for operation");
};

export const generateReadingImage = async (reading: ReadingContent): Promise<string[]> => {
  const ai = getClient();

  // 1. "ART DIRECTOR" (Gemini): Generate specific prompts
  const promptGenerationPrompt = `
    Act as an expert Catholic Art Director.
    Analyze this liturgical text:
    Title: "${reading.title}"
    Text: "${reading.text.substring(0, 500)}..."

    Create 3 distinct, highly detailed English image prompts for an AI generator (Stable Diffusion).
    1. Setting/Atmosphere (Wide shot, environment)
    2. Emotion/Character (Close up, central figure)
    3. Symbolism (Abstract, divine meaning)

    Style: Renaissance, Cinematic, Vertical 9:16, Highly Detailed, 4k.
    
    Return ONLY the 3 prompts separated by "|||". Do not add labels like "Prompt 1:".
  `;

  try {
    const response = await retryOperation(async () => {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: promptGenerationPrompt }] }
      });
    });

    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const prompts = rawText.split("|||").map(p => p.trim()).filter(p => p.length > 0);

    if (prompts.length === 0) {
      prompts.push(`Catholic holy atmosphere, ${reading.title}, renaissance art, divine light, 8k, cinematic lighting`);
      prompts.push(`Biblical scene, ${reading.title}, ancient style, dramatic, 4k`);
      prompts.push(`Religious symbol, holy spirit, cross, light rays, abstract, cinematic`);
    }

    // 2. "THE ARTIST" (Pollinations AI): Generate Image URLs
    // FIXED: Use image.pollinations.ai/prompt/ for direct access
    const imageUrls = prompts.map(prompt => {
      const encodedPrompt = encodeURIComponent(prompt);
      const seed = Math.floor(Math.random() * 100000);
      return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=720&height=1280&model=turbo&seed=${seed}&nologo=true`;
    });

    return imageUrls;

  } catch (error) {
    console.error("Error generating image prompts:", error);
    return [
      `https://image.pollinations.ai/prompt/${encodeURIComponent(reading.title + " catholic art")}?width=720&height=1280&model=turbo`
    ];
  }
};

export const generateReadingAudio = async (text: string): Promise<string> => {
  const ai = getClient();
  try {
    const cleanText = text.length > 4000 ? text.substring(0, 4000) + "..." : text;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text: cleanText }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } }
      }
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio generated.");

    const pcmData = base64ToUint8Array(base64Audio);
    const wavHeader = createWavHeader(pcmData.length);
    const wavBytes = new Uint8Array(wavHeader.byteLength + pcmData.length);
    wavBytes.set(new Uint8Array(wavHeader), 0);
    wavBytes.set(pcmData, wavHeader.byteLength);
    const blob = new Blob([wavBytes], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("Error generating audio:", error);
    throw error;
  }
};
