import React, { createContext, useContext, useState } from 'react';

interface ExportOption {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface ExportContextType {
  exportOptions: ExportOption[];
  setExportOptions: (options: ExportOption[]) => void;
}

const ExportContext = createContext<ExportContextType | undefined>(undefined);

export const ExportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [exportOptions, setExportOptions] = useState<ExportOption[]>([]);
  return (
    <ExportContext.Provider value={{ exportOptions, setExportOptions }}>
      {children}
    </ExportContext.Provider>
  );
};

export const useExport = () => {
  const context = useContext(ExportContext);
  if (!context) {
    throw new Error('useExport must be used within an ExportProvider');
  }
  return context;
};
