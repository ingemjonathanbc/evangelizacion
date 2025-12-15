export interface ReadingContent {
  id: string;
  type: '1st_reading' | 'psalm' | '2nd_reading' | 'gospel';
  title: string;
  reference: string;
  text: string;
  date: string;
}

export interface GeneratedAsset {
  readingId: string;
  imageUrls?: string[]; // Changed from single URL to Array
  audioUrl?: string;
  videoUrl?: string;
  isGeneratingImage: boolean;
  isGeneratingAudio: boolean;
  isGeneratingVideo?: boolean;
  imagePrompt?: string;
}

export interface AppState {
  date: string;
  readings: ReadingContent[];
  assets: Record<string, GeneratedAsset>; // Keyed by readingId
  isLoading: boolean;
  isAutoMode: boolean; // New flag for full automation
  error: string | null;
}