import React from 'react';
import { Crown, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import { ProgressStep } from '../services/geminiService';

interface ProgressOverlayProps {
  isVisible: boolean;
  progress: ProgressStep | null;
  mode: 'generating' | 'grading';
}

export const ProgressOverlay: React.FC<ProgressOverlayProps> = ({
  isVisible,
  progress,
  mode,
}) => {
  if (!isVisible) return null;

  const getStageIcon = () => {
    switch (progress?.stage) {
      case 'init':
        return <Zap className="w-8 h-8 text-gold-300 animate-pulse" />;
      case 'generating':
        return <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />;
      case 'parsing':
        return <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />;
      case 'retrying':
        return <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />;
      case 'complete':
        return <CheckCircle2 className="w-8 h-8 text-green-400" />;
      case 'error':
        return <AlertTriangle className="w-8 h-8 text-red-400" />;
      default:
        return <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />;
    }
  };

  const getStageColor = () => {
    switch (progress?.stage) {
      case 'retrying': return 'from-amber-500 to-amber-600';
      case 'error': return 'from-red-500 to-red-600';
      case 'complete': return 'from-green-500 to-green-600';
      default: return 'from-gold-400 to-gold-600';
    }
  };

  const progressValue = progress?.progress || 0;

  // Steps tracker
  const steps = mode === 'generating' ? [
    { label: 'Khởi tạo', done: progressValue >= 5 },
    { label: 'AI đang soạn đề', done: progressValue >= 30 },
    { label: 'Phân tích kết quả', done: progressValue >= 80 },
    { label: 'Hoàn tất', done: progressValue >= 100 },
  ] : [
    { label: 'Khởi tạo', done: progressValue >= 5 },
    { label: 'AI đang chấm bài', done: progressValue >= 40 },
    { label: 'Phân tích đáp án', done: progressValue >= 85 },
    { label: 'Hoàn tất', done: progressValue >= 100 },
  ];

  return (
    <div className="fixed inset-0 bg-navy-950/90 backdrop-blur-xl z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="relative flex flex-col items-center p-10 md:p-14 bg-navy-900 rounded-[3rem] border gold-border premium-shadow max-w-md w-full mx-4">
        
        {/* Animated rings */}
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-full border-2 border-gold-400/20 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full border-2 border-gold-400/10 flex items-center justify-center animate-pulse">
              {getStageIcon()}
            </div>
          </div>
          <div className="absolute -top-2 -right-2">
            <Crown className="w-6 h-6 text-gold-300 animate-bounce" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-2xl font-serif font-black gold-text-gradient mb-2 text-center">
          {mode === 'generating' ? 'Đang Tạo Đề Thi' : 'Đang Chấm Điểm'}
        </h3>

        {/* Status message */}
        <p className="text-slate-400 text-sm text-center mb-6 leading-relaxed max-w-xs">
          {progress?.message || 'Đang xử lý...'}
        </p>

        {/* Model badge */}
        {progress?.modelUsed && (
          <div className="mb-6 px-4 py-1.5 bg-white/5 rounded-full border gold-border">
            <span className="text-[9px] font-black text-gold-400 uppercase tracking-widest">
              Model: {progress.modelUsed}
            </span>
          </div>
        )}

        {/* Progress bar */}
        <div className="w-full mb-6">
          <div className="h-2 bg-navy-950 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${getStageColor()} transition-all duration-700 ease-out`}
              style={{ width: `${progressValue}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-slate-500 font-mono">{progressValue}%</span>
            {progress?.stage === 'retrying' && (
              <span className="text-[10px] text-amber-400 font-bold animate-pulse">Đang thử lại...</span>
            )}
          </div>
        </div>

        {/* Steps tracker */}
        <div className="w-full space-y-2">
          {steps.map((step, i) => {
            const isActive = step.done && !steps[Math.min(i + 1, steps.length - 1)]?.done;
            const isDone = step.done && (i === steps.length - 1 || steps[i + 1]?.done);
            const isFailed = progress?.stage === 'error' && isActive;

            return (
              <div key={i} className={`flex items-center gap-3 py-1.5 px-3 rounded-xl transition-all ${isActive ? 'bg-gold-400/5' : ''}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black transition-all ${
                  isFailed ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                  isDone ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                  isActive ? 'bg-gold-400/20 text-gold-400 border border-gold-400/30' :
                  'bg-white/5 text-slate-600 border border-white/10'
                }`}>
                  {isFailed ? '!' : isDone ? '✓' : isActive ? '…' : (i + 1)}
                </div>
                <span className={`text-xs font-medium transition-colors ${
                  isFailed ? 'text-red-400' :
                  isDone ? 'text-green-400' :
                  isActive ? 'text-gold-300' :
                  'text-slate-600'
                }`}>
                  {isFailed ? 'Đã dừng do lỗi' : step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Retry detail */}
        {progress?.detail && (
          <div className="mt-4 w-full bg-amber-500/5 border border-amber-400/20 rounded-xl p-3">
            <p className="text-amber-300 text-[11px] font-medium">{progress.detail}</p>
          </div>
        )}
      </div>
    </div>
  );
};
