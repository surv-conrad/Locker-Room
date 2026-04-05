import React, { useState, useRef } from 'react';
import { Settings } from '../types';
import { X, Save, Image as ImageIcon, Upload, Trash2 } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface SettingsModalProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
  onDeleteTournament?: () => void;
}

export function SettingsModal({ settings, onSave, onClose, onDeleteTournament }: SettingsModalProps) {
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [startDate, setStartDate] = useState(settings.startDate);
  const [startTime, setStartTime] = useState(settings.startTime || '09:00');
  const [tournamentName, setTournamentName] = useState(settings.tournamentName || '');
  const [description, setDescription] = useState(settings.description || '');
  const [tieBreaker, setTieBreaker] = useState(settings.tieBreaker || 'goalDifference');
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor || '#4f46e5');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ 
      ...settings, 
      logoUrl, 
      startDate, 
      startTime,
      tournamentName,
      description,
      tieBreaker,
      primaryColor,
      groupStage: settings.groupStage || { numberOfWinners: 1, numberOfLegs: 1 },
      knockoutStage: settings.knockoutStage || { numberOfWinners: 1, numberOfLegs: 2 }
    });
    onClose();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        alert('Image is too large. Please upload an image smaller than 500KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#151821]/90 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] border border-gray-800/50">
        <div className="flex justify-between items-center p-6 border-b border-gray-800/50 flex-shrink-0">
          <h2 className="text-xl font-semibold text-white">Tournament Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors p-2 hover:bg-gray-800/50 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          <div>
            <label htmlFor="tournamentName" className="block text-sm font-medium text-gray-300 mb-2">Tournament Name</label>
            <input
              id="tournamentName"
              name="tournamentName"
              type="text"
              className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
              value={tournamentName}
              onChange={(e) => setTournamentName(e.target.value)}
              placeholder="e.g. Champions League"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <textarea
              id="description"
              name="description"
              className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. A friendly tournament for local teams."
              rows={3}
            />
          </div>

          <div>
            <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Tournament Logo
            </label>
            
            <div className="flex flex-col gap-3">
              {logoUrl && (
                <div className="w-32 h-32 rounded-2xl overflow-hidden border border-gray-700/50 mx-auto bg-[#1A1D24]/50 shadow-inner">
                  <img src={logoUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#1A1D24]/80 text-gray-300 rounded-xl hover:bg-gray-800 border border-gray-700/50 transition-all duration-200 text-sm font-medium shadow-sm"
                >
                  <Upload className="w-4 h-4" /> Upload Image
                </button>
                <input
                  id="logoFile"
                  name="logoFile"
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/jpeg, image/png"
                  className="hidden"
                />
              </div>
              
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-gray-800/50"></div>
                <span className="flex-shrink-0 mx-4 text-gray-500 text-xs uppercase font-medium">or use URL</span>
                <div className="flex-grow border-t border-gray-800/50"></div>
              </div>

              <input
                id="logoUrl"
                name="logoUrl"
                type="url"
                className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm shadow-inner"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.jpg"
              />
            </div>
          </div>

          <div>
            <label htmlFor="tieBreaker" className="block text-sm font-medium text-gray-300 mb-2">Tie-Breaker Rule</label>
            <select
              id="tieBreaker"
              name="tieBreaker"
              className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm shadow-inner"
              value={tieBreaker}
              onChange={(e) => setTieBreaker(e.target.value as any)}
            >
              <option value="goalDifference">Goal Difference</option>
              <option value="headToHead">Head-to-Head</option>
              <option value="fairPlay">Fair Play</option>
            </select>
          </div>

          <div>
            <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-300 mb-2">Primary Color</label>
            <input
              id="primaryColor"
              name="primaryColor"
              type="color"
              className="w-full h-10 bg-[#1A1D24]/50 border border-gray-700/50 rounded-xl px-2 py-1 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-300 mb-2">Tournament Start Date</label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="startTime" className="block text-sm font-medium text-gray-300 mb-2">Default Start Time</label>
              <input
                id="startTime"
                name="startTime"
                type="time"
                className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-300 bg-[#1A1D24]/80 hover:bg-gray-800 border border-gray-700/50 rounded-xl transition-all duration-200 font-medium shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 font-medium shadow-md shadow-indigo-900/20"
            >
              <Save className="w-4 h-4" /> Save Changes
            </button>
          </div>
          
          {onDeleteTournament && (
            <div className="pt-6 mt-2 border-t border-gray-800/50">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 border border-red-500/20 rounded-xl transition-all duration-200 font-medium"
              >
                <Trash2 className="w-4 h-4" /> Delete Tournament
              </button>
            </div>
          )}
        </form>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Tournament"
        message="Are you sure you want to delete this tournament? This action cannot be undone and will permanently delete all teams, groups, fixtures, and settings."
        confirmText="Delete Tournament"
        confirmStyle="danger"
        onConfirm={() => {
          if (onDeleteTournament) {
            onDeleteTournament();
            onClose();
          }
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
