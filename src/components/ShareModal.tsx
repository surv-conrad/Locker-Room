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
  lastPublished?: string | null;
  isPublishing?: boolean;
  onPublish?: () => Promise<void>;
  isAdmin?: boolean;
}

export function ShareModal({ 
  tournamentId, 
  onClose, 
  exportOptions,
  lastPublished,
  isPublishing,
  onPublish,
  isAdmin
}: ShareModalProps) {
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
        
        <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh] custom-scrollbar">
          {isAdmin && (
            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Share2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Public Status</span>
                </div>
                {lastPublished ? (
                  <span className="text-[10px] text-gray-400">
                    Last published: {new Date(lastPublished).toLocaleString()}
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-400">Not published yet</span>
                )}
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Match results, goals, and events are now updated <strong>live</strong> for viewers. 
                Publishing is only required to sync structural changes like team names, groups, or tournament settings.
              </p>
              <button
                onClick={onPublish}
                disabled={isPublishing}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                {isPublishing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    {lastPublished ? 'Update Public View' : 'Publish to Web'}
                  </>
                )}
              </button>
            </div>
          )}

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
