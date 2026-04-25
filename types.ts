export enum Difficulty {
  B1 = 'B1 (Trung bình)',
  B2 = 'B2 (Khá)',
  C1 = 'C1 (Giỏi)',
  C2 = 'C2 (Xuất sắc)'
}

export interface ExamQuestion {
  id: number; // 1 to 40
  text: string;
  options: string[]; // [A, B, C, D]
}

export interface ExamPart {
  partName: string; // e.g., "Phần 1: Phát âm"
  instructions: string;
  passage?: string; // Shared passage for the section (Reading/Cloze)
  questions: ExamQuestion[];
}

export interface GeneratedExam {
  title: string;
  subtitle: string;
  parts: ExamPart[];
}

export interface GradingResult {
  questionId: number;
  correctAnswer: string; // A, B, C, or D
  explanation: string;
}

export interface GradingResponse {
  results: GradingResult[];
}