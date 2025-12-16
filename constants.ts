import { ThemeConfig } from './types';

export const THEMES: Record<string, ThemeConfig> = {
  IT: {
    id: 'IT',
    name: 'Italia',
    fontHeading: 'font-serif', 
    fontBody: 'font-sans', 
    colors: {
      gradient: 'bg-gradient-to-br from-emerald-900 via-emerald-700 to-red-900',
      glass: 'bg-white/80 backdrop-blur-xl border border-white/20 shadow-2xl',
      accent: 'text-emerald-800',
      textMain: 'text-gray-900',
      textLight: 'text-gray-600',
      button: 'bg-gradient-to-r from-emerald-600 to-emerald-800 text-white shadow-lg shadow-emerald-500/30',
    },
    greeting: 'Ciao',
    flag: '🇮🇹',
    heroImage: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=1000&auto=format&fit=crop', // Rome
  },
  EG: {
    id: 'EG',
    name: 'Egipto',
    fontHeading: 'font-serif', 
    fontBody: 'font-sans', 
    colors: {
      gradient: 'bg-gradient-to-br from-blue-900 via-amber-700 to-amber-900',
      glass: 'bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl',
      accent: 'text-amber-400',
      textMain: 'text-white',
      textLight: 'text-amber-100',
      button: 'bg-gradient-to-r from-amber-500 to-amber-700 text-white shadow-lg shadow-amber-500/30',
    },
    greeting: 'Ahlan',
    flag: '🇪🇬',
    heroImage: 'https://images.unsplash.com/photo-1539650116455-251d9a6952dd?q=80&w=1000&auto=format&fit=crop', // Pyramids
  },
};
