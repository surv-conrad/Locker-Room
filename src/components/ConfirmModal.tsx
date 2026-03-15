import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  confirmStyle?: 'danger' | 'warning' | 'primary';
}

export function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = 'Confirm',
  confirmStyle = 'danger'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const getConfirmButtonClass = () => {
    switch (confirmStyle) {
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white';
      case 'primary':
        return 'bg-indigo-600 hover:bg-indigo-700 text-white';
      case 'danger':
      default:
        return 'bg-red-600 hover:bg-red-700 text-white';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#151821]/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-sm border border-gray-800/50 p-6">
        <div className="flex items-center gap-3 mb-4 text-amber-500">
          <AlertTriangle className="w-6 h-6" />
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        </div>
        <p className="text-gray-300 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-gray-300 bg-[#1A1D24]/80 hover:bg-gray-800 border border-gray-700/50 rounded-xl transition-all duration-200 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onCancel(); }}
            className={`flex-1 px-4 py-2 rounded-xl transition-all duration-200 font-medium ${getConfirmButtonClass()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
