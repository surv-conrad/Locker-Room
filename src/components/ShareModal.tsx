import React, { useState } from 'react';
import { X, Copy, Check, Share2, Download } from 'lucide-react';

interface ExportOption {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface ShareModalProps {
  tournamentId: string;
  onClose: () => void;
  exportOptions?: ExportOption[];
}

export function ShareModal({ tournamentId, onClose, exportOptions }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const shareLink = `${window.location.origin}/?tournamentId=${tournamentId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const allExportOptions: ExportOption[] = [
    {
      label: copied ? 'Link Copied!' : 'Copy Link',
      icon: copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />,
      onClick: handleCopy
    },
    ...(exportOptions || [])
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#151821]/90 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md flex flex-col border border-gray-800/50">
        <div className="flex justify-between items-center p-6 border-b border-gray-800/50">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Share2 className="w-5 h-5 text-indigo-400" /> Share & Export
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors p-2 hover:bg-gray-800/50 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="space-y-3">
            {allExportOptions.map((option, index) => (
              <button
                key={index}
                onClick={() => {
                  option.onClick();
                  if (option.label !== 'Copy Link' && option.label !== 'Link Copied!') {
                    onClose();
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-[#1A1D24]/80 border border-gray-700/50 text-gray-300 rounded-xl hover:bg-gray-800 transition-all text-sm"
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
