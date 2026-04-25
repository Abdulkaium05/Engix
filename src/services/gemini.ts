import { GoogleGenAI } from "@google/genai";

// Support both AI Studio's process.env and Vite's import.meta.env for hosting on Vercel/Netlify
const apiKey = (typeof process !== 'undefined' && process.env.GEMINI_API_KEY) || 
               ((import.meta as any).env && (import.meta as any).env.VITE_GEMINI_API_KEY) || 
               '';

const ai = new GoogleGenAI({ apiKey });

export async function getChatResponse(prompt: string, history: any[] = [], responseLength: 'short' | 'long' = 'long') {
  try {
    const lengthInstruction = responseLength === 'short' 
      ? "Keep your response concise, brief, and to the point. Avoid unnecessary details." 
      : "Provide a highly detailed, comprehensive, and in-depth explanation with examples if possible.";

    const formattedHistory = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      history: formattedHistory,
      config: {
        systemInstruction: `You are Engix AI, a professional engineering assistant. You help engineers with calculations, design principles, and technical questions across Civil, Mechanical, Electrical, and Computer engineering. Provide clear, accurate, and professional advice. Use Markdown for formatting. ${lengthInstruction}`,
      },
    });

    const response = await chat.sendMessage({ message: prompt });
    return response.text;
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "I'm sorry, I encountered an error. Please try again.";
  }
}

export async function estimateMaterials(
  imageData: string | null, 
  mimeType: string | null, 
  details: { floors: number, foundation: string, type: string, area: string }
) {
  try {
    const parts: any[] = [];
    
    if (imageData && mimeType) {
      parts.push({
        inlineData: {
          data: imageData,
          mimeType: mimeType,
        },
      });
    }

    const promptText = `Analyze this construction project and provide a detailed material estimation in JSON format. 
Project Details:
- Number of Floors: ${details.floors}
- Foundation Type: ${details.foundation}
- Building Type: ${details.type}
- Area (sq ft): ${details.area || 'Not specified (estimate based on typical size)'}

Include fields: 
- cement (number of bags)
- sand (cft)
- bricks (pieces)
- rods (kg)
- totalCost (estimated BDT)
- summary (brief explanation)
- breakdown (object with estimated costs in BDT for: foundation, walls, roof, doorsWindows, finishing, plumbingElectrical)

Return ONLY the JSON object.`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
      }
    });
    
    let text = response.text || '{}';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Estimation Error:", error);
    return {
      cement: 0,
      sand: 0,
      bricks: 0,
      rods: 0,
      totalCost: 0,
      summary: "Error analyzing project. Please try again.",
      breakdown: {
        foundation: 0, walls: 0, roof: 0, doorsWindows: 0, finishing: 0, plumbingElectrical: 0
      }
    };
  }
}

export async function analyzeLand(description: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this land description and provide professional insights in JSON format. Include fields: maxBuiltArea (number), maxFloors (number), and reasoning (string). Description: ${description}`,
      config: {
        responseMimeType: "application/json",
      }
    });
    
    let text = response.text || '{}';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Land Analysis Error:", error);
    return {
      maxBuiltArea: 0,
      maxFloors: 0,
      reasoning: "Error analyzing land details."
    };
  }
}

export async function generateQuizQuestions(dept: string, lang: string, difficulty: 'easy' | 'hard' = 'easy', count: number = 10) {
  try {
    const promptText = `Generate ${count} ${difficulty} multiple-choice quiz questions for a ${dept} engineering student in ${lang === 'bn' ? 'Bengali' : 'English'}.
Return ONLY a JSON array of objects. Each object must have:
- question: { bn: string, en: string }
- options: { bn: string[], en: string[] } (exactly 4 options)
- answer: number (index of the correct option, 0 to 3)
- explanation: { bn: string, en: string } (brief explanation of why the answer is correct)

Ensure the questions are relevant to ${dept} engineering and match the ${difficulty} difficulty level.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
      }
    });
    
    let text = response.text || '[]';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Quiz Generation Error:", error);
    return [];
  }
}

export async function generateExampleImage(prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `A professional engineering diagram or 3D visualization of: ${prompt}. High quality, technical, clear.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini Image Generation Error:", error);
    return null;
  }
}
