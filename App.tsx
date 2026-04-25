
import React, { useState, useCallback } from 'react';
import { generateExamStructure, generateGradingKey, AVAILABLE_MODELS, ModelId, ProgressStep } from './services/geminiService';
import { Difficulty, GeneratedExam, GradingResult } from './types';
import { TestDisplay } from './components/TestDisplay';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ProgressOverlay } from './components/ProgressOverlay';
import { 
  Sparkles, 
  Upload, 
  FileText, 
  CheckCircle2, 
  Loader2,
  BookOpen,
  Settings2,
  ChevronDown,
  Info,
  Crown,
  Trophy,
  Languages,
  Key,
  Cpu,
  X
} from 'lucide-react';

// --- localStorage helpers ---
const STORAGE_KEYS = {
  API_KEY: 'english_exam_api_key',
  MODEL: 'english_exam_preferred_model',
};

function getStoredApiKey(): string {
  try { return localStorage.getItem(STORAGE_KEYS.API_KEY) || ''; } catch { return ''; }
}
function setStoredApiKey(key: string) {
  try { localStorage.setItem(STORAGE_KEYS.API_KEY, key); } catch { /* ignore */ }
}
function getStoredModel(): ModelId {
  try { return (localStorage.getItem(STORAGE_KEYS.MODEL) as ModelId) || 'gemini-3-flash-preview'; } catch { return 'gemini-3-flash-preview'; }
}
function setStoredModel(model: ModelId) {
  try { localStorage.setItem(STORAGE_KEYS.MODEL, model); } catch { /* ignore */ }
}

const App: React.FC = () => {
  // --- State ---
  const [apiKey, setApiKey] = useState<string>(getStoredApiKey);
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(!getStoredApiKey());
  const [preferredModel, setPreferredModel] = useState<ModelId>(getStoredModel);
  const [showModelSelector, setShowModelSelector] = useState(false);

  const [context, setContext] = useState<string>('');
  const [level, setLevel] = useState<Difficulty>(Difficulty.B1);
  const [exam, setExam] = useState<GeneratedExam | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [grading, setGrading] = useState<Record<number, GradingResult> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Progress tracking (Bug #3)
  const [progress, setProgress] = useState<ProgressStep | null>(null);
  const [progressMode, setProgressMode] = useState<'generating' | 'grading'>('generating');
  
  // Model used (for display)
  const [lastModelUsed, setLastModelUsed] = useState<string | null>(null);

  // --- Handlers ---
  const handleSaveApiKey = useCallback((key: string) => {
    setApiKey(key);
    setStoredApiKey(key);
    setShowApiKeyModal(false);
  }, []);

  const handleModelChange = useCallback((model: ModelId) => {
    setPreferredModel(model);
    setStoredModel(model);
    setShowModelSelector(false);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type === "text/plain") {
      const reader = new FileReader();
      reader.onload = (event) => setContext(event.target?.result as string || "");
      reader.readAsText(file);
    } else {
      alert("Vui lòng sử dụng file .txt");
    }
  };

  const handleProgressUpdate = useCallback((step: ProgressStep) => {
    setProgress(step);
  }, []);

  const handleGenerateExam = async () => {
    if (!apiKey) {
      setShowApiKeyModal(true);
      return;
    }
    setIsGenerating(true);
    setError(null);
    setExam(null);
    setGrading(null);
    setUserAnswers({});
    setProgress(null);
    setProgressMode('generating');
    try {
      const result = await generateExamStructure(apiKey, context, level, preferredModel, handleProgressUpdate);
      setExam(result.exam);
      setLastModelUsed(result.modelUsed);
    } catch (e: any) {
      setError(e.message || "Lỗi khi tạo đề.");
      setProgress(prev => prev ? { ...prev, stage: 'error', message: 'Đã dừng do lỗi' } : null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGetGrading = async () => {
    if (!exam || !apiKey) return;
    setIsGrading(true);
    setProgress(null);
    setProgressMode('grading');
    try {
      const response = await generateGradingKey(apiKey, exam, preferredModel, handleProgressUpdate);
      const gradingMap: Record<number, GradingResult> = {};
      response.grading.results.forEach(r => gradingMap[r.questionId] = r);
      setGrading(gradingMap);
      setLastModelUsed(response.modelUsed);
    } catch (e: any) {
      setError(e.message || "Lỗi khi chấm điểm.");
      setProgress(prev => prev ? { ...prev, stage: 'error', message: 'Đã dừng do lỗi' } : null);
    } finally {
      setIsGrading(false);
    }
  };

  const handleDownloadWord = () => {
    if (!exam) return;
    
    let html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>${exam.title}</title>
        <style>
          body { font-family: 'Times New Roman', serif; line-height: 1.5; color: #000; }
          .header { text-align: center; margin-bottom: 20px; }
          .title { font-size: 16pt; font-weight: bold; text-transform: uppercase; margin: 5px 0; }
          .subtitle { font-size: 12pt; font-weight: bold; margin: 5px 0; }
          .info-line { font-size: 11pt; margin: 5px 0; }
          .part-header { font-size: 12pt; font-weight: bold; text-transform: uppercase; margin-top: 15px; margin-bottom: 5px; }
          .instructions { font-size: 11pt; font-style: italic; margin-bottom: 10px; color: #444; }
          .passage { font-size: 11pt; padding: 10px; border: 1px solid #000; margin-bottom: 15px; text-align: justify; white-space: pre-line; }
          .question { margin-bottom: 10px; font-size: 11pt; page-break-inside: avoid; }
          .question-text { font-weight: bold; margin-bottom: 5px; }
          .options-table { width: 100%; margin-bottom: 10px; }
          .option-cell { width: 25%; vertical-align: top; }
          .footer { margin-top: 30px; text-align: center; font-weight: bold; }
          @page { size: A4; margin: 2cm; }
        </style>
      </head>
      <body>
        <div class="header">
          <p style="margin:0; font-size: 10pt;">BỘ GIÁO DỤC VÀ ĐÀO TẠO</p>
          <p class="title">ĐỀ THI TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG NĂM 2026</p>
          <p class="subtitle">Bài thi: NGOẠI NGỮ; Môn thi: TIẾNG ANH</p>
          <p class="info-line"><i>Thời gian làm bài: 60 phút, không kể thời gian phát đề</i></p>
          <p class="info-line"><b>Mã đề thi: 2026 - AI EXAM</b></p>
          <hr style="width: 30%; border: 0.5px solid #000;"/>
        </div>

        <div style="margin-bottom: 20px;">
          <p><b>Họ, tên thí sinh:</b> ...........................................................................</p>
          <p><b>Số báo danh:</b> ................................................................................</p>
        </div>
    `;

    exam.parts.forEach((part) => {
      html += `
        <div class="part-header">${part.partName}</div>
        <p class="instructions">${part.instructions}</p>
      `;
      
      if (part.passage) {
        html += `<div class="passage">${part.passage}</div>`;
      }

      part.questions.forEach((q) => {
        html += `
          <div class="question">
            <div class="question-text">Question ${q.id}: ${q.text}</div>
            <table class="options-table">
              <tr>
                <td class="option-cell"><b>A.</b> ${q.options[0]}</td>
                <td class="option-cell"><b>B.</b> ${q.options[1]}</td>
                <td class="option-cell"><b>C.</b> ${q.options[2]}</td>
                <td class="option-cell"><b>D.</b> ${q.options[3]}</td>
              </tr>
            </table>
          </div>
        `;
      });
    });

    html += `<div class="footer">--- HẾT ---</div>`;

    // Add Answer Key if available
    if (grading) {
      html += `
        <br clear="all" style="page-break-before:always" />
        <div class="header">
          <p class="title">ĐÁP ÁN VÀ GIẢI THÍCH CHI TIẾT</p>
        </div>
        <table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse:collapse; font-size: 10pt;">
          <tr style="background-color:#f2f2f2;">
            <th width="8%">Câu</th>
            <th width="8%">Đáp án</th>
            <th>Giải thích chi tiết</th>
          </tr>
      `;
      
      const sortedGrading = (Object.values(grading) as GradingResult[]).sort((a, b) => a.questionId - b.questionId);
      sortedGrading.forEach(g => {
        html += `
          <tr>
            <td align="center"><b>${g.questionId}</b></td>
            <td align="center" style="color: #d97706;"><b>${g.correctAnswer}</b></td>
            <td>${g.explanation.replace(/\n/g, '<br/>')}</td>
          </tr>
        `;
      });
      
      html += `</table>`;
    }

    html += `
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `De_thi_Tieng_Anh_2026_${Date.now()}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAnswerSelect = (qid: number, ans: string) => {
    setUserAnswers(prev => ({ ...prev, [qid]: ans }));
  };

  // Bug #5: Calculate score based on actual question count, not hardcoded 40
  const calculateScore = () => {
    if (!exam || !grading) return 0;
    let correct = 0;
    const totalQuestions = Object.keys(grading).length;
    Object.keys(grading).forEach(key => {
      const qid = parseInt(key);
      if (userAnswers[qid] === grading[qid].correctAnswer) correct++;
    });
    if (totalQuestions === 0) return 0;
    return ((correct / totalQuestions) * 10).toFixed(2);
  };

  // Get the current model name for display
  const currentModelInfo = AVAILABLE_MODELS.find(m => m.id === preferredModel);

  return (
    <div className="min-h-screen flex flex-col bg-navy-950 font-sans selection:bg-gold-400 selection:text-navy-900">
      
      {/* API KEY MODAL */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSave={handleSaveApiKey}
        currentKey={apiKey}
        isRequired={!apiKey}
      />

      {/* PROGRESS OVERLAY (Bug #3) */}
      <ProgressOverlay
        isVisible={isGenerating || isGrading}
        progress={progress}
        mode={progressMode}
      />

      {/* 1. HEADER */}
      <header className="sticky top-0 bg-navy-900/80 backdrop-blur-xl border-b gold-border h-16 flex items-center justify-between px-4 md:px-8 z-50 premium-shadow">
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <div className="relative shrink-0">
             <Trophy className="text-gold-400 w-7 h-7 md:w-8 md:h-8 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
             <div className="absolute -top-1 -right-1">
                <Crown className="w-3 h-3 text-gold-300 animate-bounce" />
             </div>
          </div>
          <h1 className="font-serif font-bold text-sm md:text-lg gold-text-gradient tracking-tight truncate">APP TẠO ĐỀ TN TIẾNG ANH CT 2018+ LUYỆN TỪ- HÀ THU AI</h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
           {/* API Key Settings Button */}
           <button
             onClick={() => setShowApiKeyModal(true)}
             className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all group"
             style={{
               borderColor: apiKey ? 'rgba(251, 191, 36, 0.3)' : 'rgba(239, 68, 68, 0.5)',
               backgroundColor: apiKey ? 'rgba(251, 191, 36, 0.05)' : 'rgba(239, 68, 68, 0.1)',
             }}
           >
             <Key size={13} className={apiKey ? 'text-gold-400' : 'text-red-400'} />
             <span className={`text-[9px] uppercase font-black tracking-wider hidden sm:inline ${apiKey ? 'text-gold-400' : 'text-red-400'}`}>
               {apiKey ? 'API Key ✓' : 'Nhập API Key'}
             </span>
           </button>

           {/* Model Selector */}
           <div className="relative">
             <button
               onClick={() => setShowModelSelector(!showModelSelector)}
               className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 rounded-full border gold-border text-gold-300 hover:bg-white/10 transition-all"
             >
               <Cpu size={13} />
               <span className="text-[9px] uppercase font-black tracking-wider hidden md:inline">
                 {currentModelInfo?.name || 'Model'}
               </span>
               <ChevronDown size={12} className={`transition-transform ${showModelSelector ? 'rotate-180' : ''}`} />
             </button>

             {/* Model dropdown */}
             {showModelSelector && (
               <>
                 <div className="fixed inset-0 z-40" onClick={() => setShowModelSelector(false)} />
                 <div className="absolute right-0 top-full mt-2 w-72 bg-navy-900 border gold-border rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                   <div className="p-3 border-b gold-border">
                     <p className="text-[9px] font-black text-gold-400 uppercase tracking-widest">Chọn Model AI</p>
                   </div>
                   {AVAILABLE_MODELS.map(model => (
                     <button
                       key={model.id}
                       onClick={() => handleModelChange(model.id)}
                       className={`w-full text-left p-3 hover:bg-white/5 transition-colors flex items-start gap-3 ${
                         preferredModel === model.id ? 'bg-gold-400/10' : ''
                       }`}
                     >
                       <div className={`w-3 h-3 rounded-full mt-1 shrink-0 border-2 ${
                         preferredModel === model.id ? 'bg-gold-400 border-gold-400' : 'border-slate-600'
                       }`} />
                       <div className="min-w-0">
                         <div className="flex items-center gap-2">
                           <span className="text-sm font-bold text-gold-100">{model.name}</span>
                           <span className="text-[8px] px-1.5 py-0.5 bg-gold-400/10 text-gold-400 rounded-full font-black uppercase tracking-wider">
                             {model.badge}
                           </span>
                         </div>
                         <p className="text-[11px] text-slate-400 mt-0.5">{model.description}</p>
                       </div>
                     </button>
                   ))}
                 </div>
               </>
             )}
           </div>

           {/* IMPROVE VOCAB BUTTON */}
           <a 
             href="https://ai.studio/apps/drive/1GJXe4VB2af0bsZAaXWfqbDOzCCcESNyJ?fullscreenApplet=true" 
             target="_blank" 
             rel="noopener noreferrer"
             className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500/10 rounded-full border border-blue-400/30 text-blue-400 hover:bg-blue-500/20 transition-all group"
           >
             <Languages size={13} className="group-hover:rotate-12 transition-transform" />
             <span className="text-[9px] uppercase font-black tracking-widest hidden sm:inline">Vocab</span>
           </a>

           {grading && (
             <div className="flex items-center gap-2 px-3 py-1.5 bg-gold-400/10 rounded-full border border-gold-400/30">
               <span className="text-[9px] uppercase font-black text-gold-400 tracking-widest hidden sm:inline">Score:</span>
               <span className="text-base font-serif font-bold text-gold-200">{calculateScore()}/10</span>
             </div>
           )}
        </div>
      </header>

      {/* 2. PREMIUM CONTROL PANEL */}
      <section className="bg-navy-900 border-b gold-border p-4 md:p-8 relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold-600/5 blur-[120px] rounded-full -mr-48 -mt-48"></div>
        
        {/* No API Key warning */}
        {!apiKey && (
          <div className="max-w-7xl mx-auto mb-4 relative z-10">
            <div className="bg-red-950/40 border border-red-800 rounded-2xl p-4 flex items-center justify-between animate-in zoom-in-95">
              <div className="flex items-center gap-3">
                <Key size={18} className="text-red-400" />
                <div>
                  <span className="font-bold text-sm text-red-300">Chưa có API Key</span>
                  <span className="text-red-400/70 text-sm ml-2">— Nhấn nút "Nhập API Key" trên Header để bắt đầu sử dụng app</span>
                </div>
              </div>
              <button
                onClick={() => setShowApiKeyModal(true)}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
              >
                Nhập Key
              </button>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
            
            {/* Input Area */}
            <div className="lg:col-span-6 space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-black text-gold-400 uppercase tracking-[0.2em]">
                <BookOpen size={14} />
                Ngữ liệu / Chủ đề ôn tập
              </label>
              <div className="relative">
                <textarea
                  className="w-full h-32 p-4 text-sm bg-navy-950/50 border gold-border rounded-2xl focus:ring-1 focus:ring-gold-400 focus:border-gold-400 outline-none resize-none transition-all text-slate-200 placeholder:text-slate-600"
                  placeholder="Paste English content or topic here..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                />
                <label className="absolute bottom-3 right-3 cursor-pointer bg-gold-400 hover:bg-gold-300 text-navy-900 text-[10px] font-black py-1.5 px-3 rounded-lg flex items-center gap-1.5 shadow-lg transition-all active:scale-95">
                  <Upload size={12} />
                  <span>UPLOAD .TXT</span>
                  <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* Controls */}
            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
               <div className="space-y-3">
                  <label className="flex items-center gap-2 text-[10px] font-black text-gold-400 uppercase tracking-[0.2em]">
                    <Settings2 size={14} />
                    Trình độ học thuật
                  </label>
                  <div className="relative">
                    <select
                      value={level}
                      onChange={(e) => setLevel(e.target.value as Difficulty)}
                      className="w-full appearance-none p-4 bg-navy-950/50 border gold-border rounded-2xl text-sm font-bold focus:ring-1 focus:ring-gold-400 outline-none pr-12 text-gold-100 cursor-pointer hover:bg-navy-800 transition-colors"
                    >
                      {Object.values(Difficulty).map(d => (
                        <option key={d} value={d} className="bg-navy-900">{d}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gold-400 pointer-events-none" size={18} />
                  </div>
               </div>

               <div className="flex flex-col justify-end">
                  <button
                    onClick={handleGenerateExam}
                    disabled={isGenerating || !apiKey}
                    className="w-full py-4 gold-gradient text-navy-950 rounded-2xl font-black shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:shadow-[0_0_30px_rgba(251,191,36,0.5)] transition-all flex items-center justify-center gap-3 disabled:opacity-50 text-sm uppercase tracking-widest active:scale-95"
                  >
                    {isGenerating ? <Loader2 className="animate-spin w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                    {isGenerating ? 'Đang tạo...' : 'Tạo đề thi ngay'}
                  </button>
               </div>

               {exam && (
                  <div className="sm:col-span-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4 animate-in fade-in slide-in-from-top-4">
                    <button
                      onClick={handleDownloadWord}
                      className="flex-1 py-3.5 bg-transparent border-2 border-gold-400/50 hover:border-gold-400 text-gold-400 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2.5 uppercase tracking-widest hover:bg-gold-400/5"
                    >
                      <FileText className="w-4 h-4" />
                      Xuất File Word
                    </button>
                    
                    <div className="flex-[1.5] relative group">
                      <div className="absolute -inset-0.5 bg-gold-400 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
                      <button
                        onClick={handleGetGrading}
                        disabled={isGrading}
                        className={`relative w-full py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2.5 transition-all uppercase tracking-widest shadow-xl border border-gold-400/20 ${grading ? 'bg-gold-100 text-navy-900' : 'bg-navy-950 text-gold-400 hover:bg-gold-400 hover:text-navy-950'}`}
                      >
                        {isGrading ? <Loader2 className="animate-spin w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        {isGrading ? 'AI đang chấm...' : (grading ? 'Xem lời giải' : 'Nộp bài & Chấm điểm')}
                      </button>
                    </div>
                  </div>
               )}
            </div>
          </div>

          {/* Model used info */}
          {lastModelUsed && exam && (
            <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500">
              <Cpu size={12} />
              <span>Đề thi được tạo bởi model: <strong className="text-gold-400">{lastModelUsed}</strong></span>
            </div>
          )}
        </div>
      </section>

      {/* 3. EXAM CONTENT */}
      <main className="flex-1 overflow-y-auto p-4 md:p-12 relative">
        <div className="max-w-6xl mx-auto">
          {/* Error display (Bug #4) */}
          {error && (
            <div className="mb-8 bg-red-950/40 text-red-400 p-5 rounded-2xl border border-red-800 shadow-2xl animate-in zoom-in-95">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Info size={18} className="shrink-0 mt-0.5" />
                  <div className="space-y-1 min-w-0">
                    <p className="font-bold text-sm">Đã xảy ra lỗi</p>
                    <pre className="text-xs text-red-300/80 whitespace-pre-wrap break-words font-sans leading-relaxed">{error}</pre>
                  </div>
                </div>
                <button onClick={() => setError(null)} className="shrink-0 p-1.5 hover:bg-red-800/30 rounded-lg transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {!exam ? (
            <div className="h-[50vh] flex flex-col items-center justify-center bg-navy-900/40 rounded-[2rem] md:rounded-[3rem] border border-dashed border-gold-400/20 premium-shadow">
              <div className="w-24 h-24 bg-navy-800 rounded-full flex items-center justify-center mb-8 border gold-border shadow-inner">
                <BookOpen className="w-10 h-10 text-gold-400/30" />
              </div>
              <h3 className="text-xl md:text-2xl font-serif font-bold gold-text-gradient mb-3 text-center px-4">Sẵn sàng khởi tạo học thuật</h3>
              <p className="max-w-md text-center text-slate-500 text-sm leading-relaxed px-6">
                Nhập chủ đề hoặc nội dung cần ôn luyện. Trí tuệ nhân tạo sẽ thiết kế bộ đề 40 câu theo đúng chuẩn cấu trúc thi Tốt nghiệp 2026.
              </p>
            </div>
          ) : (
            <div className="bg-white text-navy-950 shadow-[0_30px_100px_rgba(0,0,0,0.6)] p-6 md:p-20 rounded-[2rem] md:rounded-[2.5rem] relative animate-in fade-in slide-in-from-bottom-8 duration-700">
               {/* Paper Decoration */}
               <div className="flex flex-col items-center mb-12 md:mb-16 text-center">
                  <div className="mb-6 opacity-20">
                     <Trophy size={48} className="text-navy-900" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <p className="text-xs md:text-sm font-bold text-navy-900 border-b-2 border-navy-900 inline-block pb-1">Độc lập - Tự do - Hạnh phúc</p>
                  </div>
                  <div className="mt-8 space-y-1">
                    <p className="text-base md:text-lg font-serif font-black text-navy-900 uppercase tracking-tight">Kỳ thi tốt nghiệp THPT năm 2026</p>
                    <p className="text-[11px] md:text-xs font-bold text-slate-500">Bài thi: NGOẠI NGỮ — Môn thi: TIẾNG ANH</p>
                  </div>
               </div>
               
               <TestDisplay 
                 exam={exam} 
                 grading={grading} 
                 userAnswers={userAnswers} 
                 onAnswerSelect={handleAnswerSelect} 
               />

               <div className="mt-20 pt-10 border-t-2 border-dashed border-slate-200 text-center text-slate-300 font-serif italic">
                 --- HẾT ---
               </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;