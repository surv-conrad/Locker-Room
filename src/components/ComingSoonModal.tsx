import { X, AlertCircle } from 'lucide-react';

interface ComingSoonModalProps {
  feature: string;
  onClose: () => void;
}

export function ComingSoonModal({ feature, onClose }: ComingSoonModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-[#151821]/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-800/50 flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-800/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-indigo-500" />
            Feature In Development
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors p-2 hover:bg-gray-800/50 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-8 text-center flex flex-col items-center justify-center">
          <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 border border-indigo-500/20 shadow-inner">
            <AlertCircle className="w-10 h-10 text-indigo-400" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">Coming Soon</h3>
          <p className="text-gray-400 max-w-sm mx-auto mb-8 leading-relaxed">
            The <span className="text-indigo-400 font-semibold">{feature}</span> feature is currently under development. Check back later for updates!
          </p>
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-medium transition-all duration-200 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20 w-full"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
