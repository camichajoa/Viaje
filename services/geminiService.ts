import { GoogleGenAI, Modality } from "@google/genai";
import { Place, TranslationResult, LanguageChallenge } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION_BASE = `Eres "Viajero Cultural", un asistente experto para viajeros hispanohablantes en Italia y Egipto. 
Tu tono es útil, educativo y culturalmente consciente. Siempre respondes en español.`;

// --- EXPLORER & MAPS ---

export const getRecommendations = async (
  queryOrLat: number | string,
  lng?: number,
  country?: 'IT' | 'EG'
): Promise<Place[]> => {
  const modelId = "gemini-2.5-flash";
  
  let prompt = "";
  let retrievalConfig = {};

  const categories = "Cultura (museos, historia), Espectáculos (teatro, música), Comida (restaurantes típicos), Compras (mercados, tiendas)";
  
  if (typeof queryOrLat === 'number' && lng) {
    // GPS Mode
    prompt = `Estoy en las coordenadas ${queryOrLat}, ${lng} en ${country === 'IT' ? 'Italia' : 'Egipto'}.
    Busca 5 lugares cercanos variados incluyendo: ${categories}.
    Usa Google Maps para verificar que existan, obtener su calificación real y ubicación exacta.
    
    IMPORTANTE: Devuelve la respuesta en formato JSON estrictamente como una lista de objetos con estas propiedades:
    name, description (incluye qué lo hace especial), category (Cultura, Show, Comida, Compras), rating (número real o estimado).`;
    
    retrievalConfig = {
      latLng: { latitude: queryOrLat, longitude: lng }
    };
  } else {
    // Search Text Mode
    prompt = `El usuario quiere visitar: "${queryOrLat}" en ${country === 'IT' ? 'Italia' : 'Egipto'}.
    Busca en esa zona específica 5 lugares recomendados variados: ${categories}.
    Usa Google Maps para obtener información real, ratings y ubicación.
    
    IMPORTANTE: Devuelve la respuesta en formato JSON estrictamente como una lista de objetos con:
    name, description (incluye qué lo hace especial), category (Cultura, Show, Comida, Compras), rating (número real o estimado).`;
  }

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: { retrievalConfig: Object.keys(retrievalConfig).length > 0 ? retrievalConfig : undefined },
        systemInstruction: SYSTEM_INSTRUCTION_BASE,
      }
    });

    let places: Place[] = [];
    
    try {
        let cleanText = response.text || "";
        cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonPlaces = JSON.parse(cleanText);
        
        if (Array.isArray(jsonPlaces)) {
            places = jsonPlaces.map((p: any) => ({
                name: p.name,
                description: p.description,
                category: p.category || "General",
                rating: p.rating || 4.5,
                // Improved photo prompt for better visuals
                photoUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent("Travel photography of " + p.name + " in " + (country==='IT'?'Italy':'Egypt') + " " + p.category + " cinematic lighting 8k")}?width=600&height=400&nologo=true`,
                mapsUri: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.name)}`
            }));
        }
    } catch (e) {
        // Fallback
        const candidates = response.candidates;
        if (candidates && candidates[0]?.groundingMetadata?.groundingChunks) {
            const chunks = candidates[0].groundingMetadata.groundingChunks;
            chunks.forEach((chunk) => {
                if (chunk.web?.title && chunk.web?.uri) {
                places.push({
                    name: chunk.web.title,
                    description: "Recomendado por Google Maps.",
                    mapsUri: chunk.web.uri,
                    category: "Recomendado",
                    rating: 4.5,
                    photoUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(chunk.web.title + " travel landmark")}?width=600&height=400&nologo=true`
                })
                }
            });
        }
    }
    
    const uniquePlaces = Array.from(new Set(places.map(p => p.name)))
      .map(name => places.find(p => p.name === name)!);

    return uniquePlaces.slice(0, 5);

  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return [];
  }
};

// --- TRANSLATION & AUDIO ---

export const translateWithPhonetics = async (text: string, fromLang: string, toLang: string): Promise<TranslationResult> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Actúa como traductor experto.
      Origen: ${fromLang}
      Destino: ${toLang}
      Texto: "${text}"
      
      Devuelve SOLO un objeto JSON con:
      - translated: la traducción exacta.
      - pronunciation: cómo se pronuncia fonéticamente para un hispanohablante.
      - context: nota cultural breve.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            translated: { type: "STRING" },
            pronunciation: { type: "STRING" },
            context: { type: "STRING" }
          }
        }
      }
    });
    return JSON.parse(response.text) as TranslationResult;
  } catch (error) {
    console.error(error);
    return { original: text, translated: "Error", pronunciation: "-", context: "" };
  }
};

export const translateAudio = async (base64Audio: string, mimeType: string, fromLang: string, toLang: string): Promise<TranslationResult> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Audio } },
          { text: `Transcribe el audio (hablado en ${fromLang}) y tradúcelo a ${toLang}.
            Devuelve JSON: { "original": "texto transcrito", "translated": "texto traducido", "pronunciation": "fonética", "context": "nota cultural" }` }
        ]
      },
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            original: { type: "STRING" },
            translated: { type: "STRING" },
            pronunciation: { type: "STRING" },
            context: { type: "STRING" }
          }
        }
      }
    });
    return JSON.parse(response.text);
  } catch (e) {
    console.error(e);
    return { original: "(Audio ininteligible)", translated: "No pudimos entender el audio.", pronunciation: "-", context: "" };
  }
}

export const generateAudio = async (text: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text: text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return base64Audio;
    }
    return null;
  } catch (error) {
    console.error("TTS Error", error);
    return null;
  }
};

export const getDynamicChallenge = async (country: 'IT' | 'EG', level: number): Promise<LanguageChallenge> => {
   const language = country === 'IT' ? 'Italiano' : 'Árabe Egipcio';
   const difficulty = level < 5 ? 'Principiante (A1)' : level < 10 ? 'Intermedio (A2)' : 'Avanzado (B1)';
   
   const topics = ['Comida', 'Transporte', 'Saludos', 'Emergencia', 'Números', 'Regateo', 'Historia'];
   const randomTopic = topics[Math.floor(Math.random() * topics.length)];

   try {
     const response = await ai.models.generateContent({
       model: "gemini-2.5-flash",
       contents: `Genera una pregunta de trivia única para aprender ${language}.
       Nivel: ${difficulty}.
       Tema: ${randomTopic}.
       
       Devuelve JSON.`,
       config: {
         responseMimeType: "application/json",
         responseSchema: {
            type: "OBJECT",
            properties: {
                question: { type: "STRING" },
                options: { type: "ARRAY", items: { type: "STRING" } },
                answer: { type: "STRING" },
                explanation: { type: "STRING" }
            },
            required: ["question", "options", "answer", "explanation"]
         }
       }
     });
     
     const data = JSON.parse(response.text);
     return { ...data, difficultyLevel: level };
   } catch (e) {
     return {
         question: "Como se dice Hola?",
         options: ["Ciao", "Adios", "Hello"],
         answer: "Ciao",
         explanation: "Fallback question.",
         difficultyLevel: 1
     };
   }
}

export const analyzeImage = async (base64Image: string, country: 'IT' | 'EG'): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: `Analiza esta imagen tomada en ${country === 'IT' ? 'Italia' : 'Egipto'}. Traduce textos visibles o identifica objetos culturales.` }
        ]
      },
    });
    return response.text;
  } catch (error) {
    return "No pude analizar la imagen. Intenta de nuevo.";
  }
};
