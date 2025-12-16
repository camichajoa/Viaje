import React, { useState, useEffect, useRef } from 'react';
import { CountryCode, ThemeConfig, Place } from './types';
import { THEMES } from './constants';
import { getRecommendations, translateWithPhonetics, translateAudio, generateAudio, getDynamicChallenge, analyzeImage } from './services/geminiService';
import ReactMarkdown from 'react-markdown';

// --- UTILS FOR AUDIO ---
const decodeAudioData = async (base64: string, ctx: AudioContext) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const dataInt16 = new Int16Array(bytes.buffer);
  const channelCount = 1;
  const sampleRate = 24000;
  const audioBuffer = ctx.createBuffer(channelCount, dataInt16.length, sampleRate);
  
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return audioBuffer;
};

const playAudio = async (base64String: string) => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContext();
    // CRITICAL: Resume context if suspended (browser policy)
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    const buffer = await decodeAudioData(base64String, audioCtx);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
  } catch (e) {
    console.error("Audio play error", e);
    alert("No se pudo reproducir el audio. Intenta de nuevo.");
  }
};

// --- ICONS ---
const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-icons-outlined ${className}`}>{name}</span>
);

// --- COMPONENTS ---

const CountrySelector = ({ onSelect }: { onSelect: (c: CountryCode) => void }) => {
  return (
    <div className="flex flex-col h-full w-full bg-black">
      {/* Italy Split */}
      <div 
        className="flex-1 relative cursor-pointer group overflow-hidden" 
        onClick={() => onSelect('IT')}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-emerald-900/80 z-10"></div>
        <img 
          src={THEMES['IT'].heroImage} 
          alt="Italy" 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
        />
        <div className="absolute bottom-10 left-6 z-20">
          <h1 className="text-6xl font-serif text-white drop-shadow-lg font-bold">Italia</h1>
          <p className="text-emerald-300 tracking-widest uppercase text-sm font-bold backdrop-blur-md bg-white/10 px-2 py-1 inline-block rounded">La Dolce Vita</p>
        </div>
      </div>
      
      {/* Egypt Split */}
      <div 
        className="flex-1 relative cursor-pointer group overflow-hidden" 
        onClick={() => onSelect('EG')}
      >
         <div className="absolute inset-0 bg-gradient-to-b from-transparent to-blue-900/80 z-10"></div>
        <img 
          src={THEMES['EG'].heroImage} 
          alt="Egypt" 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
        />
        <div className="absolute bottom-10 left-6 z-20">
          <h1 className="text-6xl font-serif text-white drop-shadow-lg font-bold">Egipto</h1>
          <p className="text-amber-300 tracking-widest uppercase text-sm font-bold backdrop-blur-md bg-black/30 px-2 py-1 inline-block rounded">Historia Viva</p>
        </div>
      </div>
      
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
        <div className="bg-white/20 backdrop-blur-xl border border-white/30 px-6 py-2 rounded-full shadow-2xl">
           <span className="text-white font-bold uppercase tracking-widest text-xs">Selecciona Destino</span>
        </div>
      </div>
    </div>
  );
};

const Navigation = ({ theme, currentView, setView }: { theme: ThemeConfig, currentView: string, setView: (v: string) => void }) => {
  const navItems = [
    { id: 'home', icon: 'map', label: 'Explorar' },
    { id: 'learn', icon: 'school', label: 'Aprender' },
    { id: 'tools', icon: 'g_translate', label: 'Traducir' },
  ];

  return (
    <div className={`fixed bottom-4 left-4 right-4 ${theme.colors.glass} rounded-2xl p-2 z-50`}>
      <div className="flex justify-around items-center">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-300 ${
                isActive ? theme.colors.button + ' shadow-lg transform -translate-y-2' : 'text-gray-500 hover:bg-black/5'
              }`}
            >
              <Icon name={item.icon} className={isActive ? "text-white" : ""} />
              {isActive && <span className="text-[10px] font-bold mt-1 uppercase">{item.label}</span>}
            </button>
          )
        })}
      </div>
    </div>
  );
};

const ExplorerView = ({ theme }: { theme: ThemeConfig }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Place[] | null>(null);
  const [searchMode, setSearchMode] = useState<'gps' | 'text'>('text'); 
  const [query, setQuery] = useState('');
  const [currentMapUrl, setCurrentMapUrl] = useState<string>('');
  const [activePlaceIndex, setActivePlaceIndex] = useState<number | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setData(null);
    setActivePlaceIndex(null);
    
    const mapQ = searchMode === 'text' && query ? query : (searchMode === 'gps' ? 'current location' : theme.name);
    setCurrentMapUrl(`https://maps.google.com/maps?q=${encodeURIComponent(mapQ)}&output=embed`);

    try {
      if (searchMode === 'gps') {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
             setCurrentMapUrl(`https://maps.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}&output=embed`);
             const result = await getRecommendations(pos.coords.latitude, pos.coords.longitude, theme.id);
             setData(result);
             setLoading(false);
          },
          () => { alert("Activa el GPS"); setLoading(false); }
        );
      } else {
        if(!query) return;
        const result = await getRecommendations(query, undefined, theme.id);
        setData(result);
        setLoading(false);
      }
    } catch(e) { setLoading(false); }
  };

  const focusPlace = (place: Place, index: number) => {
    setActivePlaceIndex(index);
    if(place.mapsUri && place.mapsUri.includes('search')) {
        // Just focus map if it's a search link
        setCurrentMapUrl(`https://maps.google.com/maps?q=${encodeURIComponent(place.name)}&output=embed`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      
      {/* 1. Map Container */}
      <div className="h-[40%] w-full relative bg-gray-200">
        <iframe 
          width="100%" 
          height="100%" 
          frameBorder="0" 
          scrolling="no" 
          marginHeight={0} 
          marginWidth={0} 
          src={currentMapUrl || "about:blank"}
          title="Map View"
          className="w-full h-full opacity-90"
        />
        <div className="absolute top-4 left-4 right-4">
           <div className={`${theme.colors.glass} p-2 rounded-2xl flex items-center shadow-lg`}>
              <button 
                onClick={() => setSearchMode(searchMode === 'gps' ? 'text' : 'gps')}
                className={`p-2 rounded-xl mr-2 transition-colors ${searchMode === 'gps' ? theme.colors.button : 'bg-gray-100 text-gray-400'}`}
              >
                <Icon name={searchMode === 'gps' ? "my_location" : "location_city"} className="text-lg" />
              </button>
              
              {searchMode === 'text' ? (
                <input 
                  type="text" 
                  placeholder="Ej: Coliseo, Comida local..." 
                  className="flex-1 bg-transparent outline-none text-gray-800 placeholder-gray-500 font-medium"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              ) : (
                <span className="flex-1 text-sm font-medium text-gray-600">Usando tu ubicación GPS</span>
              )}
              
              <button onClick={handleSearch} className={`${theme.colors.accent} p-2 font-bold`}>
                 <Icon name="search" />
              </button>
           </div>
        </div>
      </div>

      {/* 2. Results Container */}
      <div className={`flex-1 overflow-y-auto rounded-t-3xl -mt-6 relative z-10 ${theme.colors.glass} border-t border-white/40 pb-24`}>
         <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-4"></div>
         
         <div className="px-6 pb-2">
            <h2 className={`text-xl font-bold ${theme.colors.textMain} mb-1`}>
               {loading ? 'Explorando...' : (data ? 'Lugares Recomendados' : '¿A dónde vamos hoy?')}
            </h2>
            <p className="text-xs text-gray-500">
               {loading ? 'Consultando expertos locales...' : 'Toca una tarjeta para ver en el mapa.'}
            </p>
         </div>

         {loading && (
           <div className="flex flex-col items-center mt-8 space-y-3">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
             <p className="text-xs text-gray-400">Buscando las mejores opciones...</p>
           </div>
         )}

         <div className="space-y-4 px-4 mt-2">
           {data?.map((place, i) => (
             <div 
               key={i} 
               onClick={() => focusPlace(place, i)}
               className={`group bg-white/80 backdrop-blur-md rounded-2xl p-0 border overflow-hidden transition-all duration-300 cursor-pointer shadow-md
                  ${activePlaceIndex === i ? `border-${theme.colors.accent.split('-')[1]}-500 ring-2 ring-${theme.colors.accent.split('-')[1]}-500` : 'border-white hover:border-gray-300'}
               `}
             >
               {/* Rich Card Layout */}
               <div className="relative h-32 w-full bg-gray-200">
                  <img src={place.photoUrl} alt={place.name} className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold text-yellow-600 flex items-center shadow-sm">
                     <Icon name="star" className="text-[14px] mr-1" /> {place.rating}
                  </div>
                  <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-xs font-bold text-white uppercase">
                     {place.category}
                  </div>
               </div>
               
               <div className="p-4">
                  <div className="flex justify-between items-start">
                     <h3 className={`font-bold text-lg ${theme.colors.textMain} leading-tight mb-2`}>{place.name}</h3>
                  </div>
                  <p className={`text-sm ${theme.colors.textLight} line-clamp-2 leading-relaxed mb-4`}>{place.description}</p>
                  
                  <a 
                    href={place.mapsUri} 
                    target="_blank" 
                    rel="noreferrer" 
                    className={`block w-full text-center py-2 rounded-xl font-bold text-sm bg-blue-600 text-white shadow-md active:scale-95 transition-transform flex items-center justify-center`}
                    onClick={(e) => e.stopPropagation()} // Prevent card click
                  >
                     <Icon name="directions" className="mr-2 text-lg" />
                     Cómo llegar
                  </a>
               </div>
             </div>
           ))}
           
           {data && data.length === 0 && !loading && (
             <div className="text-center mt-10 opacity-50">
               <p>No encontramos lugares exactos. Intenta otra búsqueda.</p>
             </div>
           )}
         </div>
      </div>
    </div>
  );
};

const LearningView = ({ theme }: { theme: ThemeConfig }) => {
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [challenge, setChallenge] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<'correct' | 'incorrect' | null>(null);

  const loadLevel = async () => {
    setLoading(true);
    setResult(null);
    const data = await getDynamicChallenge(theme.id, level);
    setChallenge(data);
    setLoading(false);
  };

  useEffect(() => { loadLevel(); }, [level, theme.id]);

  const handleAnswer = (option: string) => {
    if (result) return;
    if (option === challenge.answer) {
      setResult('correct');
      const newScore = score + 1;
      setScore(newScore);
      if (newScore % 5 === 0) {
         setTimeout(() => {
           alert("¡Nivel Completado! Aumentando dificultad...");
           setLevel(l => l + 1);
         }, 1000);
      }
    } else {
      setResult('incorrect');
    }
  };

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto pb-32 no-scrollbar">
      <div className="flex justify-between items-center mb-6">
        <div className={`${theme.colors.glass} px-4 py-2 rounded-full`}>
           <span className={`${theme.colors.textMain} font-bold`}>Nivel {level}</span>
        </div>
        <div className={`${theme.colors.glass} px-4 py-2 rounded-full`}>
           <span className="text-yellow-500 font-bold">★ {score}</span>
        </div>
      </div>

      {loading && <div className="text-white text-center mt-20">Generando desafío único...</div>}

      {!loading && challenge && (
        <div className="max-w-md mx-auto w-full perspective-1000">
           <div className={`${theme.colors.glass} p-8 rounded-3xl text-center mb-8 border-b-4 border-white/20 transform transition-transform hover:rotate-x-2`}>
              <h3 className={`text-2xl font-bold ${theme.colors.textMain}`}>{challenge.question}</h3>
           </div>

           <div className="grid gap-3">
             {challenge.options.map((opt: string, i: number) => (
               <button
                 key={i}
                 onClick={() => handleAnswer(opt)}
                 className={`${theme.colors.glass} p-4 rounded-xl text-left font-medium transition-all active:scale-95
                   ${result === 'correct' && opt === challenge.answer ? 'bg-green-500/80 text-white' : ''}
                   ${result === 'incorrect' && opt === challenge.answer ? 'bg-green-500/80 text-white' : ''} 
                   ${result === 'incorrect' && opt !== challenge.answer ? 'opacity-50' : ''}
                 `}
               >
                 {opt}
               </button>
             ))}
           </div>

           {result && (
             <div className="mt-6 animate-fade-in">
               <div className={`${result === 'correct' ? 'bg-green-500' : 'bg-red-500'} text-white p-4 rounded-xl shadow-lg mb-4`}>
                 <p className="font-bold">{result === 'correct' ? '¡Correcto!' : 'Incorrecto'}</p>
                 <p className="text-sm opacity-90 mt-1">{challenge.explanation}</p>
               </div>
               <button onClick={loadLevel} className={`${theme.colors.button} w-full py-3 rounded-xl font-bold`}>
                 Siguiente Pregunta
               </button>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

const TranslatorView = ({ theme }: { theme: ThemeConfig }) => {
  const [text, setText] = useState('');
  const [direction, setDirection] = useState<'es-target' | 'target-es'>('es-target');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const targetLangName = theme.id === 'IT' ? 'Italiano' : 'Árabe';

  const handleTranslate = async () => {
    if(!text) return;
    setLoading(true);
    setResult(null);
    const from = direction === 'es-target' ? 'Español' : targetLangName;
    const to = direction === 'es-target' ? targetLangName : 'Español';
    
    const res = await translateWithPhonetics(text, from, to);
    setResult(res);
    setLoading(false);
  };

  const playTTS = async () => {
    if(!result) return;
    setAudioLoading(true);
    const audioBase64 = await generateAudio(result.translated);
    if(audioBase64) {
      await playAudio(audioBase64);
    }
    setAudioLoading(false);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        const chunks: BlobPart[] = [];

        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = async () => {
          const blob = new Blob(chunks, { type: 'audio/webm' }); // Usually webm/mp4 in browsers
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
             const base64 = (reader.result as string).split(',')[1];
             setLoading(true);
             const from = direction === 'es-target' ? 'Español' : targetLangName;
             const to = direction === 'es-target' ? targetLangName : 'Español';
             const res = await translateAudio(base64, 'audio/webm', from, to);
             setText(res.original || ""); // Populate input with transcript
             setResult(res);
             setLoading(false);
          };
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Mic error", err);
        alert("Permiso de micrófono denegado.");
      }
    }
  };

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto pb-32 no-scrollbar">
      <div className={`${theme.colors.glass} p-6 rounded-3xl mb-4`}>
         <div className="flex justify-between items-center mb-4 text-sm font-bold text-gray-500 bg-white/50 rounded-lg p-1">
            <span className={`flex-1 text-center py-2 ${direction === 'es-target' ? 'bg-white shadow-sm rounded-md text-gray-800' : ''}`}>Español</span>
            <button onClick={() => setDirection(d => d === 'es-target' ? 'target-es' : 'es-target')} className="px-3">
              <Icon name="swap_horiz" />
            </button>
            <span className={`flex-1 text-center py-2 ${direction === 'target-es' ? 'bg-white shadow-sm rounded-md text-gray-800' : ''}`}>{targetLangName}</span>
         </div>

         <div className="relative">
           <textarea 
             value={text}
             onChange={e => setText(e.target.value)}
             placeholder={isRecording ? "Escuchando..." : "Escribe o graba..."}
             className="w-full h-32 bg-transparent text-2xl font-medium outline-none placeholder-gray-400/70 resize-none text-gray-800"
           />
           {isRecording && (
             <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl">
               <div className="animate-pulse flex flex-col items-center">
                 <Icon name="mic" className="text-4xl text-red-500 mb-2" />
                 <span className="text-red-600 font-bold">Grabando...</span>
               </div>
             </div>
           )}
         </div>
         
         <div className="flex justify-between items-center mt-2 border-t border-gray-200/50 pt-4">
            <button 
              onClick={toggleRecording}
              className={`p-4 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white scale-110 shadow-red-500/50 shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <Icon name={isRecording ? "stop" : "mic"} className="text-xl" />
            </button>

            <button 
              onClick={handleTranslate} 
              disabled={loading || (!text && !isRecording)}
              className={`${theme.colors.button} px-8 py-3 rounded-full font-bold shadow-lg active:scale-95 transition-transform flex items-center`}
            >
              {loading ? 'Procesando...' : 'Traducir'}
            </button>
         </div>
      </div>

      {result && (
        <div className={`${theme.colors.glass} p-6 rounded-3xl animate-fade-in border-t-4 border-white/40`}>
           <p className="text-sm text-gray-500 uppercase tracking-wider mb-2">Traducción</p>
           <h3 className="text-3xl font-bold text-gray-900 mb-2">{result.translated}</h3>
           <p className="text-lg text-emerald-600 font-serif italic mb-4">{result.pronunciation}</p>
           
           <div className="flex gap-2">
             <button 
               onClick={playTTS} 
               disabled={audioLoading}
               className="bg-gray-900 text-white rounded-full p-4 shadow-lg active:scale-90 transition-transform flex items-center justify-center"
             >
                {audioLoading ? <div className="animate-spin h-6 w-6 border-2 border-white rounded-full border-t-transparent"></div> : <Icon name="volume_up" className="text-2xl" />}
             </button>
             {result.context && (
                <div className="flex-1 bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                  <p className="text-xs text-yellow-800">💡 {result.context}</p>
                </div>
             )}
           </div>
        </div>
      )}
    </div>
  );
};

const App = () => {
  const [country, setCountry] = useState<CountryCode | null>(null);
  const [view, setView] = useState('home');

  if (!country) return <CountrySelector onSelect={setCountry} />;

  const theme = THEMES[country];

  return (
    <div className={`h-full w-full ${theme.colors.gradient} ${theme.fontBody} flex flex-col relative`}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
         <div className="absolute top-40 -left-20 w-60 h-60 bg-black/10 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <div className={`pt-safe px-4 py-4 flex items-center justify-between z-40`}>
        <div className="flex items-center">
           <button onClick={() => setCountry(null)} className="mr-3 bg-white/20 p-2 rounded-full backdrop-blur-md text-white hover:bg-white/30 transition-colors">
             <Icon name="arrow_back" className="text-sm" />
           </button>
           <h1 className={`text-xl font-bold text-white drop-shadow-md`}>Viajero Cultural</h1>
        </div>
        <div className="bg-white/20 backdrop-blur-xl px-3 py-1 rounded-full border border-white/20 text-white font-bold text-xs">
           {theme.flag} {country}
        </div>
      </div>

      <main className="flex-1 relative z-30">
        {view === 'home' && <ExplorerView theme={theme} />}
        {view === 'learn' && <LearningView theme={theme} />}
        {view === 'tools' && <TranslatorView theme={theme} />}
      </main>

      <Navigation theme={theme} currentView={view} setView={setView} />
    </div>
  );
};

export default App;
