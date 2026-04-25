import React, { useState, useEffect } from 'react';
import { Key, ExternalLink, ShieldCheck, AlertTriangle, Eye, EyeOff, X } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
  currentKey: string;
  isRequired: boolean; // true = cannot close without key
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentKey,
  isRequired,
}) => {
  const [inputKey, setInputKey] = useState(currentKey);
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInputKey(currentKey);
      setValidationError(null);
    }
  }, [isOpen, currentKey]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const trimmedKey = inputKey.trim();
    
    if (!trimmedKey) {
      setValidationError('Vui lòng nhập API Key.');
      return;
    }

    if (trimmedKey.length < 20) {
      setValidationError('API Key không hợp lệ (quá ngắn).');
      return;
    }

    setIsValidating(true);
    setValidationError(null);

    // Quick validation: try a minimal API call
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: trimmedKey });
      await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Say "OK" in one word.',
        config: { maxOutputTokens: 5 },
      });
      
      onSave(trimmedKey);
    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('401') || msg.includes('UNAUTHENTICATED') || msg.includes('API_KEY_INVALID')) {
        setValidationError('❌ API Key không hợp lệ. Vui lòng kiểm tra và thử lại.');
      } else if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
        setValidationError('❌ API Key không có quyền truy cập. Vui lòng bật Gemini API trong Google Cloud Console.');
      } else {
        // Other errors (rate limit, etc.) mean the key is probably valid
        onSave(trimmedKey);
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isValidating) {
      handleSave();
    }
  };

  return (
    <div className="fixed inset-0 bg-navy-950/95 backdrop-blur-2xl z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-navy-900 border gold-border rounded-[2rem] w-full max-w-lg premium-shadow relative overflow-hidden">
        
        {/* Decorative glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-gold-400/10 blur-[80px] rounded-full -mt-32"></div>
        
        {/* Header */}
        <div className="relative p-8 pb-6 border-b gold-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gold-400/10 border gold-border rounded-2xl flex items-center justify-center">
                <Key className="w-6 h-6 text-gold-400" />
              </div>
              <div>
                <h2 className="text-xl font-serif font-bold gold-text-gradient">Thiết lập API Key</h2>
                <p className="text-slate-400 text-xs mt-1">Google Gemini AI</p>
              </div>
            </div>
            {!isRequired && (
              <button 
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6 relative">
          {/* Instructions */}
          <div className="bg-blue-500/5 border border-blue-400/20 rounded-2xl p-4">
            <div className="flex gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm space-y-2">
                <p className="text-blue-300 font-medium">API Key được lưu trên trình duyệt của bạn (localStorage)</p>
                <p className="text-slate-400">Key không được gửi đến bất kỳ server nào ngoài Google Gemini API.</p>
              </div>
            </div>
          </div>

          {/* Input */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gold-400 uppercase tracking-[0.2em]">
              Gemini API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={inputKey}
                onChange={(e) => { setInputKey(e.target.value); setValidationError(null); }}
                onKeyDown={handleKeyDown}
                placeholder="AIzaSy..."
                className="w-full p-4 pr-12 bg-navy-950/50 border gold-border rounded-2xl text-sm font-mono focus:ring-1 focus:ring-gold-400 focus:border-gold-400 outline-none text-slate-200 placeholder:text-slate-600 transition-all"
                autoFocus
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-gold-400 transition-colors"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Validation Error */}
          {validationError && (
            <div className="bg-red-950/40 border border-red-800 rounded-xl p-3 flex items-start gap-3 animate-in zoom-in-95">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm font-medium">{validationError}</p>
            </div>
          )}

          {/* Get Key Link */}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-gold-400/5 border gold-border rounded-2xl hover:bg-gold-400/10 transition-all group"
          >
            <ExternalLink className="w-5 h-5 text-gold-400 group-hover:scale-110 transition-transform" />
            <div>
              <p className="text-gold-300 font-bold text-sm">Lấy API Key miễn phí</p>
              <p className="text-slate-500 text-xs">aistudio.google.com/apikey</p>
            </div>
          </a>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isValidating || !inputKey.trim()}
            className="w-full py-4 gold-gradient text-navy-950 rounded-2xl font-black shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:shadow-[0_0_30px_rgba(251,191,36,0.5)] transition-all flex items-center justify-center gap-3 disabled:opacity-50 text-sm uppercase tracking-widest active:scale-95"
          >
            {isValidating ? (
              <>
                <div className="w-5 h-5 border-2 border-navy-950/30 border-t-navy-950 rounded-full animate-spin"></div>
                Đang xác thực...
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                {currentKey ? 'Cập nhật API Key' : 'Lưu & Bắt đầu'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
