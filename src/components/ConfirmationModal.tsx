import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  size = 'md'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={cn(
        "bg-white w-full rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200",
        size === 'xs' ? "max-w-xs" : size === 'sm' ? "max-w-sm" : size === 'lg' ? "max-w-lg" : "max-w-md"
      )}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className={cn(
              "p-2 rounded-xl",
              variant === 'danger' ? "bg-rose-50 text-rose-600" : 
              variant === 'warning' ? "bg-amber-50 text-amber-600" : 
              "bg-blue-50 text-blue-600"
            )}>
              <AlertTriangle size={18} />
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
            >
              <X size={16} />
            </button>
          </div>
          
          <h3 className="text-base font-black text-slate-900 mb-1.5 leading-tight">{title}</h3>
          <p className="text-slate-500 text-xs leading-relaxed">{message}</p>
        </div>
        
        <div className="px-5 py-4 bg-slate-50 flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-100 transition-all active:scale-95"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={cn(
              "flex-1 px-3 py-2 text-white text-xs font-bold rounded-xl transition-all active:scale-95 shadow-sm",
              variant === 'danger' ? "bg-rose-600 hover:bg-rose-700 hover:shadow-none" : 
              variant === 'warning' ? "bg-amber-600 hover:bg-amber-700 hover:shadow-none" : 
              "bg-blue-600 hover:bg-blue-700 hover:shadow-none"
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
