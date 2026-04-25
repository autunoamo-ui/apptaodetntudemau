
import { GeneratedExam, GradingResult } from '../types';
import { CheckCircle, XCircle, BookOpen, GraduationCap, Star } from 'lucide-react';
import React from 'react';

interface TestDisplayProps {
  exam: GeneratedExam;
  grading: Record<number, GradingResult> | null;
  userAnswers: Record<number, string>;
  onAnswerSelect: (questionId: number, answer: string) => void;
}

export const TestDisplay: React.FC<TestDisplayProps> = ({
  exam,
  grading,
  userAnswers,
  onAnswerSelect
}) => {
  const optionLabels = ["A", "B", "C", "D"];

  return (
    <div className="space-y-12 font-serif">
      <div className="text-center border-b-2 border-navy-900/10 pb-8 mb-12">
        <h1 className="text-3xl md:text-4xl font-black uppercase text-navy-900 tracking-tight leading-tight">{exam.title}</h1>
        <h2 className="text-lg md:text-xl font-bold text-slate-500 mt-4 italic">{exam.subtitle}</h2>
        <div className="mt-6 flex justify-center items-center gap-4">
           <span className="h-px w-8 bg-slate-300"></span>
           <span className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400">Mã đề: 2026 - AI EXAM</span>
           <span className="h-px w-8 bg-slate-300"></span>
        </div>
      </div>

      {exam.parts.map((part, partIndex) => (
        <div key={partIndex} className="mb-14 break-inside-avoid">
          {/* Part Header */}
          <div className="mb-6 flex items-start gap-4">
             <div className="bg-navy-900 text-white p-2 rounded-lg mt-1 shrink-0">
                <GraduationCap size={18} />
             </div>
             <div>
                <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">{part.partName}</h3>
                <p className="text-slate-500 italic mt-1 font-sans text-sm">{part.instructions}</p>
             </div>
          </div>
          
          {/* Shared Passage */}
          {part.passage && (
            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 mb-10 text-justify leading-relaxed text-navy-900 shadow-sm relative group">
               <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <BookOpen size={64} />
               </div>
               <div className="flex items-center gap-2 font-bold text-slate-400 mb-4 text-[10px] uppercase tracking-[0.2em]">
                  <BookOpen size={14} className="text-navy-900" /> Content Material
               </div>
               <div 
                 className="whitespace-pre-line text-lg font-sans"
                 dangerouslySetInnerHTML={{ __html: part.passage.replace(/\n/g, '<br/>') }} 
               />
            </div>
          )}

          <div className="space-y-6">
            {part.questions.map((q) => {
              const grade = grading ? grading[q.id] : null;
              const userAnswer = userAnswers[q.id];
              const isCorrect = grade && userAnswer === grade.correctAnswer;
              
              return (
                <div key={q.id} id={`q-${q.id}`} className={`p-6 rounded-3xl border transition-all ${grade ? (isCorrect ? 'bg-green-50/30 border-green-200' : 'bg-red-50/30 border-red-200') : 'hover:bg-slate-50 border-transparent'}`}>
                  
                  <div className="flex gap-4">
                    <span className="font-black text-navy-900 min-w-[3rem] text-xl pt-1">Q.{q.id}</span>
                    <div className="flex-grow">
                      {/* Question Text */}
                      <div className="text-navy-900 font-bold text-lg mb-6 leading-snug font-sans" dangerouslySetInnerHTML={{ __html: q.text.replace(/\n/g, '<br/>') }} />
                      
                      {/* Options */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {q.options.map((opt, optIndex) => {
                          const label = optionLabels[optIndex];
                          const isSelected = userAnswer === label;
                          const isKey = grade && grade.correctAnswer === label;

                          let btnClass = "flex items-start gap-3 p-4 rounded-2xl cursor-pointer border-2 transition-all font-sans text-base ";
                          if (grading) {
                             if (isKey) btnClass += "bg-green-100 border-green-500 text-green-900 font-black shadow-lg shadow-green-200/50";
                             else if (isSelected && !isKey) btnClass += "bg-red-50 border-red-300 text-red-900 opacity-60 line-through";
                             else btnClass += "border-slate-100 opacity-40";
                          } else {
                             if (isSelected) btnClass += "bg-navy-900 border-navy-900 text-white font-bold ring-4 ring-navy-900/10 shadow-xl scale-[1.02]";
                             else btnClass += "bg-white border-slate-100 hover:border-navy-200 hover:bg-slate-50 hover:shadow-md";
                          }

                          return (
                            <div 
                              key={optIndex} 
                              onClick={() => !grading && onAnswerSelect(q.id, label)}
                              className={btnClass}
                            >
                              <span className={`font-black ${isSelected || (grading && isKey) ? '' : 'text-slate-400'}`}>{label}.</span>
                              <span className="break-words">{opt}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      {grade && (
                        <div className="mt-8 p-6 bg-slate-50 rounded-3xl border border-slate-200 animate-in fade-in slide-in-from-top-2 border-l-4 border-l-navy-900">
                          <div className="flex items-start gap-4">
                            <div className={`p-2 rounded-xl shrink-0 ${isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                               {isCorrect ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                            </div>
                            <div className="flex-1">
                              <div className="font-black text-navy-900 mb-4 flex items-center justify-between">
                                <span className="uppercase tracking-widest text-[10px] flex items-center gap-2">
                                   <Star size={12} className="text-gold-500 fill-gold-500" /> Expert Insight
                                </span>
                                <span className="px-3 py-1 bg-navy-900 text-white text-[9px] rounded-full uppercase font-black tracking-widest">Bilingual Analysis</span>
                              </div>
                              <div 
                                className="text-navy-900/80 leading-relaxed font-sans text-sm space-y-4"
                                dangerouslySetInnerHTML={{ 
                                  __html: grade.explanation.normalize('NFC')
                                    .replace(/\[Vietnamese\]:/g, '<b class="text-navy-950 block border-b border-slate-200 pb-1 mb-2 text-xs uppercase tracking-wider">Phân tích tiếng Việt:</b>')
                                    .replace(/\[English\]:/g, '<b class="text-navy-950 block border-b border-slate-200 pb-1 mt-6 mb-2 text-xs uppercase tracking-wider">English Analysis:</b>')
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
