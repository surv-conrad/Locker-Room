import React from 'react';
import { Download, FileText, Image as ImageIcon, ChevronDown } from 'lucide-react';
import { cn } from '../utils';

interface ExportOption {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface ExportMenuProps {
  options: ExportOption[];
  className?: string;
}

export function ExportMenu({ options, className }: ExportMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-[#1A1D24]/80 backdrop-blur-md border border-gray-700/50 text-gray-300 rounded-xl hover:bg-gray-800 transition-all duration-200 text-sm shadow-sm"
      >
        <Download className="w-4 h-4" /> Export <ChevronDown className="w-3 h-3" />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-[#1A1D24] border border-gray-700/50 rounded-xl shadow-xl z-50 overflow-hidden">
          {options.map((option, index) => (
            <button
              key={index}
              onClick={() => {
                option.onClick();
                setIsOpen(false);
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
