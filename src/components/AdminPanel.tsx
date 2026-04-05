import React from 'react';
import { X, Shield, User } from 'lucide-react';

interface AdminPanelProps {
  users: { uid: string, email: string, role: string }[];
  onUpdateRole: (uid: string, role: 'admin' | 'viewer') => void;
  onDownloadBackup: () => void;
  onClose: () => void;
}

export function AdminPanel({ users, onUpdateRole, onDownloadBackup, onClose }: AdminPanelProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#151821]/90 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] border border-gray-800/50">
        <div className="flex justify-between items-center p-6 border-b border-gray-800/50 flex-shrink-0">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" /> Admin Panel
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors p-2 hover:bg-gray-800/50 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <button 
            onClick={onDownloadBackup}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded-xl py-3 hover:bg-indigo-600/30 transition-all font-medium"
          >
            Download Database Backup
          </button>
          {users.map(user => (
            <div key={user.uid} className="flex items-center justify-between bg-[#1A1D24]/50 p-4 rounded-xl border border-gray-700/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white font-medium">{user.email}</p>
                  <p className="text-xs text-gray-400">{user.role}</p>
                </div>
              </div>
              <select
                value={user.role}
                onChange={(e) => onUpdateRole(user.uid, e.target.value as 'admin' | 'viewer')}
                className="bg-[#151821] border border-gray-700 rounded-lg px-3 py-1 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
