
import { GoogleGenAI, Type, Content, ThinkingLevel } from "@google/genai";
import { FoodAnalysis, UserMetrics, ActivityData, WorkoutPlan, UserProfile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- TYPES ---

export interface MapInsight {
  text: string;
  sources: { title: string; uri: string }[];
}

const foodResponseSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Name of the food item" },
    macros: {
      type: Type.OBJECT,
      properties: {
        calories: { type: Type.NUMBER },
        protein: { type: Type.NUMBER },
        fat: { type: Type.NUMBER },
        carbs: { type: Type.NUMBER },
      },
      required: ["calories", "protein", "fat", "carbs"]
    },
    healthScore: { type: Type.NUMBER, description: "Score from 0-100" },
    verdict: { type: Type.STRING, enum: ["Excellent", "Good", "Fair", "Avoid"] },
    advice: { type: Type.STRING, description: "Short nutritional tip" },
    alternatives: { type: Type.STRING, description: "A healthier alternative" },
    colorCode: { type: Type.STRING, enum: ["green", "yellow", "red"] },
  },
  required: ["name", "macros", "healthScore", "verdict", "advice", "alternatives", "colorCode"]
};

const workoutResponseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Catchy name for the workout" },
    difficulty: { type: Type.STRING },
    duration: { type: Type.STRING, description: "Estimated time" },
    intensity: { type: Type.STRING },
    equipment: { type: Type.STRING },
    exercises: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          sets: { type: Type.STRING },
          reps: { type: Type.STRING },
          notes: { type: Type.STRING }
        },
        required: ["name", "sets", "reps", "notes"]
      }
    }
  },
  required: ["title", "difficulty", "duration", "exercises"]
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const handleGenAIError = (error: any): never => {
  const errorStr = JSON.stringify(error);
  if (errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED")) {
    throw new Error("QUOTA_EXHAUSTED: Neural network at maximum capacity.");
  }
  console.error("Gemini API Error:", error);
  throw new Error(error.message || "AI Protocol Interrupted.");
};

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorStr = JSON.stringify(error);
      if (errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED")) {
        await sleep(Math.pow(2, i) * 1000);
        continue;
      }
      throw error;
    }
  }
  return handleGenAIError(lastError);
}

export const getFastHealthTip = async (userStats: string, context: string = "175cm, 70kg, Active") => {
  return withRetry(async () => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: `Persona: ELITE COACH. User Context: ${context}. Give a 1-sentence luxury fitness tip for: ${userStats}.`,
      });
      return response.text || "Stay elite.";
    } catch (error) {
      return "Optimizing performance...";
    }
  });
};

export const getCoachChatStream = async (
  message: string, 
  history: Content[], 
  profile: any, 
  activity: ActivityData,
  isThinkingMode: boolean = true
) => {
  // Use real profile data from onboarding
  const metrics = profile.metrics || {};
  const height = metrics.height || 175;
  const weight = metrics.weight || 70;
  const dob = metrics.dob || 'Unknown';
  const gender = metrics.gender || 'Elite Member';
  const goal = metrics.fitnessGoal || profile.goals?.fitnessGoal || 'Optimize performance';
  const activityLevel = metrics.activityLevel || 'Active';
  
  const systemInstruction = `Role: You are 'ELITE COACH', a hyper-intelligent fitness AI.
 
User Profile (CONTEXT):
- Name: ${profile.name || 'Elite User'}
- Gender: ${gender}
- Height: ${height} cm
- Weight: ${weight} kg
- Date of Birth: ${dob}
- Primary Goal: ${goal}
- Activity Level: ${activityLevel}
 
YOUR RULES:
1. Always answer based on the User Profile above.
2. If the user asks for a Diet or Workout Plan, output the comprehensive details in formatted text first.
3. CRITICAL: At the very end of your response, provide exactly one JSON block for the system to synchronize.
   Format must be: SYNC_PROTOCOL: {"update_targets": true, "target_steps": 10000, "target_calories": 2500, "target_protein": 160, "plan_name": "Protocol Name"}
 
Tone: Authoritative, elite, and highly scientific.
Today's Activity: ${activity.steps} steps, ${activity.calories} calories.`;

  const primaryModel = isThinkingMode ? 'gemini-3.1-pro-preview' : 'gemini-3-flash-preview';

  const config: any = { 
    systemInstruction, 
    temperature: 0.7 
  };
  
  if (isThinkingMode) {
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
  }

  try {
    return await ai.models.generateContentStream({ 
      model: primaryModel, 
      config, 
      contents: [{ role: 'user', parts: [{ text: message }] }]
    });
  } catch (error: any) {
    return handleGenAIError(error);
  }
};

export const analyzeFoodImage = async (base64Image: string, hint?: string): Promise<FoodAnalysis> => {
  return withRetry(async () => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { 
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] } }, 
            { text: `Persona: ELITE COACH. Analyze this meal for a 175cm/70kg user. ${hint ? `Context: ${hint}. ` : ""}Provide JSON.` }
          ] 
        },
        config: { 
          responseMimeType: "application/json", 
          responseSchema: foodResponseSchema 
        }
      });
      if (response.text) return JSON.parse(response.text) as FoodAnalysis;
      throw new Error("Analysis failed.");
    } catch (error) { return handleGenAIError(error); }
  });
};

export const analyzeFoodText = async (text: string): Promise<FoodAnalysis> => {
  return withRetry(async () => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Persona: ELITE COACH. Analyze for 175cm/70kg profile: ${text}. Provide JSON.`,
        config: { 
          responseMimeType: "application/json", 
          responseSchema: foodResponseSchema 
        }
      });
      if (response.text) return JSON.parse(response.text) as FoodAnalysis;
      throw new Error("Analysis failed.");
    } catch (error) { return handleGenAIError(error); }
  });
};

export const generateWorkoutRoutine = async (
  level: string, 
  goal: string, 
  equipment: string, 
  duration: string,
  intensity: string,
  metrics: UserMetrics
): Promise<WorkoutPlan> => {
  return withRetry(async () => {
    try {
      const prompt = `Persona: ELITE COACH. Generate a hyper-personalized workout protocol.
User Metrics:
- Height: ${metrics.height}cm
- Weight: ${metrics.weight}kg
- Age: ${metrics.age}
- Gender: ${metrics.gender}
- Activity Level: ${metrics.activityLevel}
- Current Goal: ${goal}

Constraints:
- Equipment: ${equipment}
- Duration: ${duration}
- Intensity: ${intensity}

Analyze the biometric data and provide a scientific, high-performance routine in JSON format.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: { 
          responseMimeType: "application/json", 
          responseSchema: workoutResponseSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } 
        }
      });
      if (response.text) {
        const data = JSON.parse(response.text);
        return { id: Date.now().toString(), timestamp: Date.now(), ...data, intensity, equipment } as WorkoutPlan;
      }
      throw new Error("Generation failed.");
    } catch (error) { return handleGenAIError(error); }
  });
};

export const getCalibrationInsight = async (lat: number, lng: number): Promise<MapInsight> => {
  return withRetry(async () => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Identify elite walking paths or significant landmarks near these coordinates. Provide a brief authoritative description.",
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: lat,
                longitude: lng
              }
            }
          }
        },
      });

      const text = response.text || "Scanning localized biometric terrain...";
      const sources: { title: string; uri: string }[] = [];

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        chunks.forEach((chunk: any) => {
          if (chunk.maps) {
            sources.push({
              title: chunk.maps.title || "Location Intel",
              uri: chunk.maps.uri
            });
          }
        });
      }

      return { text, sources };
    } catch (error) {
      console.error("Calibration Insight Error:", error);
      return { 
        text: "Neural mapping protocol recalibrating. Maintain steady stride.", 
        sources: [] 
      };
    }
  });
};
