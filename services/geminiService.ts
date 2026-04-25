
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Difficulty, GeneratedExam, GradingResponse } from "../types";

// --- MODEL CONFIGURATION ---
export const AVAILABLE_MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Nhanh, phù hợp tạo đề', badge: 'Default' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', description: 'Chính xác cao, phù hợp chấm bài', badge: 'Pro' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Ổn định, dự phòng khi hết quota', badge: 'Stable' },
] as const;

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];

const FALLBACK_ORDER: ModelId[] = ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-2.5-flash'];

// --- PROGRESS CALLBACK TYPE ---
export type ProgressCallback = (step: ProgressStep) => void;

export interface ProgressStep {
  stage: 'init' | 'generating' | 'parsing' | 'complete' | 'error' | 'retrying';
  message: string;
  modelUsed?: string;
  progress: number; // 0-100
  detail?: string;
}

// --- ERROR PARSING ---
export interface GeminiError {
  code: number | string;
  message: string;
  rawMessage: string;
  isQuotaError: boolean;
  isRetryable: boolean;
}

function parseGeminiError(error: any): GeminiError {
  const rawMessage = error?.message || error?.toString() || 'Lỗi không xác định';
  
  // Parse status code from error message
  let code: number | string = 'UNKNOWN';
  let isQuotaError = false;
  let isRetryable = false;

  if (rawMessage.includes('429') || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    code = 429;
    isQuotaError = true;
    isRetryable = true;
  } else if (rawMessage.includes('503') || rawMessage.includes('UNAVAILABLE')) {
    code = 503;
    isRetryable = true;
  } else if (rawMessage.includes('500') || rawMessage.includes('INTERNAL')) {
    code = 500;
    isRetryable = true;
  } else if (rawMessage.includes('400') || rawMessage.includes('INVALID_ARGUMENT')) {
    code = 400;
    isRetryable = false;
  } else if (rawMessage.includes('403') || rawMessage.includes('PERMISSION_DENIED')) {
    code = 403;
    isRetryable = false;
  } else if (rawMessage.includes('401') || rawMessage.includes('UNAUTHENTICATED')) {
    code = 401;
    isRetryable = false;
  }

  const friendlyMessages: Record<string, string> = {
    '429': `⚠️ Hết quota API (429 RESOURCE_EXHAUSTED). Đang thử model dự phòng...`,
    '503': `⚠️ Server tạm thời không khả dụng (503). Đang thử lại...`,
    '500': `⚠️ Lỗi server (500 INTERNAL). Đang thử model khác...`,
    '400': `❌ Dữ liệu đầu vào không hợp lệ (400). Vui lòng kiểm tra lại nội dung.`,
    '403': `❌ API Key không có quyền truy cập (403). Vui lòng kiểm tra lại API Key.`,
    '401': `❌ API Key không hợp lệ (401). Vui lòng nhập lại API Key.`,
    'UNKNOWN': `❌ Lỗi: ${rawMessage}`,
  };

  return {
    code,
    message: friendlyMessages[String(code)] || friendlyMessages['UNKNOWN'],
    rawMessage,
    isQuotaError,
    isRetryable,
  };
}

// --- API KEY MANAGEMENT ---
function createAIClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

// --- RETRY WITH FALLBACK ---
async function callWithFallback<T>(
  apiKey: string,
  preferredModel: ModelId,
  caller: (ai: GoogleGenAI, modelId: string) => Promise<T>,
  onProgress?: ProgressCallback
): Promise<T> {
  const ai = createAIClient(apiKey);
  
  // Build retry order: preferred model first, then fallbacks
  const modelOrder = [preferredModel, ...FALLBACK_ORDER.filter(m => m !== preferredModel)];
  
  let lastError: GeminiError | null = null;

  for (let i = 0; i < modelOrder.length; i++) {
    const modelId = modelOrder[i];
    
    try {
      if (i > 0) {
        onProgress?.({
          stage: 'retrying',
          message: `Đang thử model dự phòng: ${modelId}...`,
          modelUsed: modelId,
          progress: 15,
          detail: lastError ? `Lý do: ${lastError.message}` : undefined,
        });
      }
      
      const result = await caller(ai, modelId);
      return result;
    } catch (error: any) {
      lastError = parseGeminiError(error);
      console.error(`Model ${modelId} failed:`, lastError.rawMessage);
      
      // If error is not retryable, throw immediately
      if (!lastError.isRetryable) {
        throw new Error(`${lastError.message}\n\n📋 Chi tiết kỹ thuật: ${lastError.rawMessage}`);
      }
      
      // If this is the last model, throw
      if (i === modelOrder.length - 1) {
        throw new Error(
          `❌ TẤT CẢ CÁC MODEL ĐỀU THẤT BẠI.\n\n` +
          `Đã thử: ${modelOrder.join(' → ')}\n\n` +
          `Lỗi cuối cùng (${lastError.code}): ${lastError.rawMessage}\n\n` +
          `💡 Gợi ý: Kiểm tra lại API Key hoặc thử lại sau vài phút.`
        );
      }
    }
  }

  // Should never reach here
  throw new Error('Unexpected error in fallback logic');
}

// --- SCHEMA DEFINITIONS ---

// Schema 1: The Exam Structure (No Answers)
const examSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title of the exam (e.g., ĐỀ THI THỬ...)" },
    subtitle: { type: Type.STRING, description: "Subtitle (e.g., Thời gian làm bài: 50 phút)" },
    parts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          partName: { type: Type.STRING, description: "Name of the part (e.g., Part 1: ...)" },
          instructions: { type: Type.STRING, description: "Instructions for this section" },
          passage: { type: Type.STRING, nullable: true, description: "The shared reading passage, announcement, or leaflet text for this part. Required for Cloze and Reading sections." },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.INTEGER, description: "Question number (must range from 1 to 40 continuously)" },
                text: { type: Type.STRING, description: "The question stem. For Part 3 (Arrangement), this MUST contain the jumbled sentences labeled a, b, c, d, e on separate lines." },
                options: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING },
                  description: "Exactly 4 options" 
                }
              },
              required: ["id", "text", "options"]
            }
          }
        },
        required: ["partName", "instructions", "questions"]
      }
    }
  },
  required: ["title", "subtitle", "parts"]
};

// Schema 2: The Grading Key (Answers & Explanations)
const gradingSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          questionId: { type: Type.INTEGER },
          correctAnswer: { type: Type.STRING, description: "The correct option (A, B, C, or D)" },
          explanation: { type: Type.STRING, description: "Detailed BILINGUAL explanation (Vietnamese and English). Must include grammar rules, vocabulary analysis, and justification." }
        },
        required: ["questionId", "correctAnswer", "explanation"]
      }
    }
  },
  required: ["results"]
};

// --- API FUNCTIONS ---

export const generateExamStructure = async (
  apiKey: string,
  context: string,
  level: Difficulty,
  preferredModel: ModelId = 'gemini-3-flash-preview',
  onProgress?: ProgressCallback
): Promise<{ exam: GeneratedExam; modelUsed: string }> => {

  onProgress?.({
    stage: 'init',
    message: 'Đang khởi tạo yêu cầu...',
    progress: 5,
  });

  const prompt = `
    You are an expert English Test Creator for the Vietnam High School Graduation Exam (Format 2025).
    
    Create a 40-question Multiple Choice test (Time: 50 minutes).
    Level: ${level}.
    Context/Topic Material: ${context ? `Use this material as inspiration: "${context.substring(0, 1000)}..."` : "Current global topics (Environment, Technology, Culture, Daily Life)."}

    STRICT FORMAT REQUIREMENTS (Based on Exam Code 1105 - 2025 Format & PDF Guidelines):
    The exam MUST have exactly 6 PARTS with 40 questions total. Numbering 1-40.

    PART 1 (Questions 1-6): Cloze Test - Announcement/Event (Leaflet style).
    - Content: Announcement/Leaflet (150-180 words).
    - Focus: Quantifiers, Word forms (Verb/Noun/Adj/Adv), Reduced relative clauses (V-ing/V-ed), Phrasal verbs, Relative pronouns.
    - Format: Shared passage with 6 blanks. 

    PART 2 (Questions 7-14): Reading Comprehension (8 Questions).
    - Content: Passage (200-250 words) strictly divided into 4-5 paragraphs. Topics: Science, Agriculture, Tech, or Health.
    - Questions distribution (Strictly follow this mix): 
      1. Detail question (NOT mentioned...).
      2. Synonym (The word "X" can be replaced by...).
      3. Antonym (The word "Y" is OPPOSITE in meaning to...).
      4. Reference ("it", "they", "which").
      5. Paraphrasing (Which sentence best paraphrases...).
      6. True/False/Not True.
      7-8. Matching info / Inference.

    PART 3 (Questions 15-19): Sentence/Dialogue Arrangement (5 Questions).
    - Q15: Paragraph arrangement (4-5 sentences, e.g., personal experience, "no pain no gain").
    - Q16: Dialogue arrangement (5 turns, e.g., health/hobbies).
    - Q17: Paragraph arrangement (Description of change/process, e.g., city development).
    - Q18: Short Dialogue arrangement (3 turns, e.g., asking for help/directions).
    - Q19: Letter arrangement (4-5 sentences, e.g., formal letter structure).
    - Output Format: The "text" field of the question MUST contain the jumbled sentences labeled a, b, c, d, (e) separated by newlines. The "options" must be the arrangement sequences (e.g., "e-d-c-a-b"). DO NOT put the jumbled sentences in the 'passage' field.

    PART 4 (Questions 20-29): Reading Comprehension (10 Questions).
    - Content: Passage (200-250 words) strictly divided into 3-4 paragraphs. Topics: Social issues, Environment, Economy.
    - Questions distribution:
      1. Sentence completion/Fit the sentence.
      2. Synonym.
      3. Reference.
      4. Detail.
      5-6. Main idea/Gist.
      7. Antonym.
      8. True/False/Not Given.
      9. Paraphrasing.
      10. Inference.

    PART 5 (Questions 30-34): Cloze Test - Short Passage.
    - Content: Passage (150-180 words) strictly divided into 3-4 paragraphs. Topics: Tourism, Hobbies, or Life skills.
    - Strict Constraints per Question:
      Q30: Parallelism (e.g., list of V-ing or Nouns).
      Q31: Logical Result (after a comma, e.g., ", so..." or ", therefore...").
      Q32: Exemplification/Comparison (e.g., "For example", "By contrast").
      Q33: Bridge/Topic sentence (linking previous sentence to next).
      Q34: Collocation or Nominalization (e.g., "suspicion that...", "biased in favour of").

    PART 6 (Questions 35-40): Cloze Test - Leaflet/Instruction (Leaflet style).
    - Content: "How to..." guide or Leaflet (150-180 words).
    - Focus: Prepositions, Word order (e.g., heavy grocery bags), Reduced relative clause, Collocations, Infinitives.

    OUTPUT FORMAT:
    - Return strictly valid JSON matching the schema.
    - Ensure "passage" field is used for Parts 1, 2, 4, 5, 6.
    - Ensure "text" field for Part 3 contains the jumbled sentences formatted clearly.
  `;

  let modelUsed = preferredModel;

  const result = await callWithFallback(
    apiKey,
    preferredModel,
    async (ai, modelId) => {
      onProgress?.({
        stage: 'generating',
        message: `AI đang soạn đề thi (${modelId})...`,
        modelUsed: modelId,
        progress: 30,
      });

      modelUsed = modelId as ModelId;

      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: examSchema,
          temperature: 0.5,
        },
      });

      onProgress?.({
        stage: 'parsing',
        message: 'Đang phân tích kết quả...',
        modelUsed: modelId,
        progress: 80,
      });

      const jsonText = response.text;
      if (!jsonText) throw new Error("AI không trả về dữ liệu. Vui lòng thử lại.");
      return JSON.parse(jsonText) as GeneratedExam;
    },
    onProgress
  );

  onProgress?.({
    stage: 'complete',
    message: 'Đề thi đã được tạo thành công!',
    modelUsed,
    progress: 100,
  });

  return { exam: result, modelUsed };
};

export const generateGradingKey = async (
  apiKey: string,
  exam: GeneratedExam,
  preferredModel: ModelId = 'gemini-3-pro-preview',
  onProgress?: ProgressCallback
): Promise<{ grading: GradingResponse; modelUsed: string }> => {

  onProgress?.({
    stage: 'init',
    message: 'Đang khởi tạo chấm điểm...',
    progress: 5,
  });

  const minimalExamContext = exam.parts.map(p => ({
    part: p.partName,
    passage: p.passage ? p.passage.substring(0, 500) + "..." : null,
    questions: p.questions.map(q => ({ id: q.id, text: q.text, options: q.options }))
  }));

  const prompt = `
    You are an expert English Teacher and Linguist.
    Here is an English exam (JSON format) following the Vietnam 2025/2026 Format.
    
    Task:
    1. Solve every question (1-40).
    2. Provide the correct answer (A, B, C, or D) that matches the option index.
    3. Provide a DETAILED BILINGUAL (VIETNAMESE and ENGLISH) explanation for each question.
       The explanation must cover:
       - The grammar point or vocabulary logic involved.
       - Why the correct answer fits best in the context.
       - Why the other 3 distractors are incorrect.
       
    Format for the explanation field:
    [Vietnamese]: (Giải thích chi tiết bằng tiếng Việt)
    [English]: (Detailed explanation in English)
    
    Exam Data: ${JSON.stringify(minimalExamContext)}
  `;

  let modelUsed = preferredModel;

  const result = await callWithFallback(
    apiKey,
    preferredModel,
    async (ai, modelId) => {
      onProgress?.({
        stage: 'generating',
        message: `AI đang chấm bài (${modelId})...`,
        modelUsed: modelId,
        progress: 40,
      });

      modelUsed = modelId as ModelId;

      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: gradingSchema,
          temperature: 0.2,
        },
      });

      onProgress?.({
        stage: 'parsing',
        message: 'Đang phân tích đáp án...',
        modelUsed: modelId,
        progress: 85,
      });

      const jsonText = response.text;
      if (!jsonText) throw new Error("AI không trả về dữ liệu chấm điểm.");
      return JSON.parse(jsonText) as GradingResponse;
    },
    onProgress
  );

  onProgress?.({
    stage: 'complete',
    message: 'Chấm điểm hoàn tất!',
    modelUsed,
    progress: 100,
  });

  return { grading: result, modelUsed };
};
