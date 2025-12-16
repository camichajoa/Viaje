export type CountryCode = 'IT' | 'EG';

export interface ThemeConfig {
  id: CountryCode;
  name: string;
  fontHeading: string;
  fontBody: string;
  colors: {
    gradient: string; // New: Main background gradient
    glass: string;    // New: Glassmorphism effect
    accent: string;
    textMain: string;
    textLight: string;
    button: string;
  };
  greeting: string;
  flag: string;
  heroImage: string; // New: 3D style image
}

export interface Place {
  name: string;
  address?: string;
  rating?: number;
  description: string;
  photoUrl?: string;
  mapsUri?: string;
  category?: string;
  coords?: { lat: number, lng: number };
}

export interface TranslationResult {
  original: string;
  translated: string;
  pronunciation: string; // Phonetic text
  context?: string;
}

export interface LanguageChallenge {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  difficultyLevel: number;
}
