import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Team, Group, Settings } from '../types';
import { Trash2, Plus, Pencil, X, ClipboardList, Users, FolderPlus, Upload, ImageIcon } from 'lucide-react';
import { TeamSheetModal } from './TeamSheetModal';
import { ConfirmModal } from './ConfirmModal';
import { exportAsImage } from '../utils/exportImage';

interface TeamsProps {
  teams: Team[];
  groups: Group[];
  settings: Settings;
  isAdmin: boolean;
  onAddTeam: (team: Omit<Team, 'id' | 'players'>) => void;
  onEditTeam: (id: string, team: Partial<Team>) => void;
  onDeleteTeam: (id: string) => void;
  onReorderTeams: (teams: Team[]) => void;
  onAddGroup: (name: string) => void;
  onDeleteGroup: (id: string) => void;
  onGenerateTestData: () => void;
  onFillTeamSheets: () => void;
}

interface SortableTeamRowProps {
  team: Team;
  groups: Group[];
  isEditing: boolean;
  isAdmin: boolean;
  onEditClick: (team: Team) => void;
  onSheetClick: (teamId: string) => void;
  onDeleteClick: (teamId: string) => void;
}

const SortableTeamRow: React.FC<SortableTeamRowProps> = ({ team, groups, isEditing, isAdmin, onEditClick, onSheetClick, onDeleteClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: team.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const rowRef = useRef<HTMLTableRowElement>(null);
  
  return (
    <tr ref={(node) => { setNodeRef(node); rowRef.current = node; }} style={style} className="hover:bg-[#1A1D24]/50 transition-colors">
      {isAdmin && (
        <td className="px-2 py-4 cursor-grab" {...attributes} {...listeners}>
          <div className="w-6 h-6 flex items-center justify-center text-gray-500">⋮⋮</div>
        </td>
      )}
      <td className="px-6 py-4 font-medium text-gray-200 cursor-pointer hover:text-indigo-400" onClick={() => onSheetClick(team.id)}>{team.name}</td>
      <td className="px-6 py-4" contentEditable={isAdmin && isEditing} suppressContentEditableWarning={true}>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-[#1A1D24] text-gray-300 border border-gray-700/50">
          {team.initial}
        </span>
      </td>
      <td className="px-6 py-4 text-gray-400" contentEditable={isAdmin && isEditing} suppressContentEditableWarning={true}>{team.manager || '-'}</td>
      <td className="px-6 py-4 text-gray-400" contentEditable={isAdmin && isEditing} suppressContentEditableWarning={true}>{team.phone || '-'}</td>
      <td className="px-6 py-4" contentEditable={isAdmin && isEditing} suppressContentEditableWarning={true}>
        {team.groupId ? (
          <span className="text-indigo-400 text-sm font-medium">
            {groups.find(g => g.id === team.groupId)?.name || '-'}
          </span>
        ) : (
          <span className="text-gray-600 text-sm">-</span>
        )}
      </td>
      {isAdmin && (
        <td className="px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => exportAsImage(rowRef.current, team.name)}
              className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-700 transition-colors"
              title="Export Team as Image"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEditClick(team)}
              className="text-blue-400 hover:text-blue-300 p-2 rounded-xl hover:bg-blue-400/10 transition-colors"
              title="Edit Team"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDeleteClick(team.id)}
              className="text-red-400 hover:text-red-300 p-2 rounded-xl hover:bg-red-400/10 transition-colors"
              title="Delete Team"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
};

export function Teams({ teams, groups, settings, isAdmin, onAddTeam, onEditTeam, onDeleteTeam, onReorderTeams, onAddGroup, onDeleteGroup, onGenerateTestData, onFillTeamSheets }: TeamsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sheetTeamId, setSheetTeamId] = useState<string | null>(null);
  const [showFillConfirm, setShowFillConfirm] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [initial, setInitial] = useState('');
  const [manager, setManager] = useState('');
  const [phone, setPhone] = useState('');
  const [groupId, setGroupId] = useState('');
  const [groupName, setGroupName] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        (results.data as any[]).forEach((row: any) => {
          onAddTeam({
            name: row.name,
            initial: row.initial,
            manager: row.manager,
            phone: row.phone,
            groupId: groups.find(g => g.name === row.group)?.id
          });
        });
      }
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = teams.findIndex(t => t.id === active.id);
      const newIndex = teams.findIndex(t => t.id === over.id);
      onReorderTeams(arrayMove(teams, oldIndex, newIndex));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !initial) return;
    
    if (editingId) {
      onEditTeam(editingId, { name, initial, manager, phone, groupId: groupId || undefined });
      setEditingId(null);
    } else {
      onAddTeam({ name, initial, manager, phone, groupId: groupId || undefined });
    }
    
    setName('');
    setInitial('');
    setManager('');
    setPhone('');
    setGroupId('');
  };

  const handleAddGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName) return;
    onAddGroup(groupName);
    setGroupName('');
  };

  const handleEditClick = (team: Team) => {
    setEditingId(team.id);
    setName(team.name);
    setInitial(team.initial);
    setManager(team.manager || '');
    setPhone(team.phone || '');
    setGroupId(team.groupId || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setInitial('');
    setManager('');
    setPhone('');
    setGroupId('');
  };

  return (
    <div className="space-y-8">
      {isAdmin && (
        <div className="bg-[#151821]/80 backdrop-blur-md p-6 rounded-2xl border border-gray-800/50 shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" /> {editingId ? 'Edit Team' : 'Add New Team'}
            </h2>
            <div className="flex gap-2">
              <input type="file" id="csv-import" name="csvImport" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-sm text-gray-300 hover:text-white flex items-center gap-1 bg-[#1A1D24]/80 px-3 py-1.5 rounded-xl border border-gray-700/50 transition-all duration-200 shadow-sm"
                title="Import teams from CSV"
              >
                <Upload className="w-4 h-4" /> Import CSV
              </button>
              <button
                onClick={onGenerateTestData}
                className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-600/10 px-3 py-1.5 rounded-xl border border-indigo-500/30 transition-all duration-200 shadow-sm"
                title="Generate teams and groups with players"
              >
                Generate Test Data
              </button>
              {teams.length > 0 && (
                <div className="relative">
                  {!showFillConfirm ? (
                    <button
                      onClick={() => setShowFillConfirm(true)}
                      className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-600/10 px-3 py-1.5 rounded-xl border border-emerald-500/30 transition-all duration-200 shadow-sm"
                      title="Fill existing teams with players"
                    >
                      Fill Team Sheets
                    </button>
                  ) : (
                    <div className="absolute right-0 top-0 z-10 bg-[#1A1D24] border border-emerald-500/30 rounded-xl p-2 shadow-xl flex items-center gap-2 min-w-[200px]">
                      <span className="text-[10px] text-emerald-400 font-medium">Overwrite all?</span>
                      <button
                        onClick={() => {
                          onFillTeamSheets();
                          setShowFillConfirm(false);
                        }}
                        className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold hover:bg-emerald-700"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setShowFillConfirm(false)}
                        className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-[10px] font-bold hover:bg-gray-700"
                      >
                        No
                      </button>
                    </div>
                  )}
                </div>
              )}
              {editingId && (
                <button
                  onClick={handleCancelEdit}
                  className="text-sm text-gray-400 hover:text-gray-200 flex items-center gap-1 bg-[#1A1D24]/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-gray-700/50 transition-all duration-200 shadow-sm"
                >
                  <X className="w-4 h-4" /> Cancel Edit
                </button>
              )}
            </div>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 items-end">
            <div className="lg:col-span-2">
              <label htmlFor="team-name" className="block text-sm font-medium text-gray-400 mb-1">Team Name *</label>
              <input
                type="text"
                id="team-name"
                name="teamName"
                required
                className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Manchester United"
              />
            </div>
            <div>
              <label htmlFor="team-initials" className="block text-sm font-medium text-gray-400 mb-1">Initials *</label>
              <input
                type="text"
                id="team-initials"
                name="teamInitials"
                required
                maxLength={4}
                className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all uppercase shadow-inner"
                value={initial}
                onChange={(e) => setInitial(e.target.value.toUpperCase())}
                placeholder="e.g. MUN"
              />
            </div>
            <div>
              <label htmlFor="team-manager" className="block text-sm font-medium text-gray-400 mb-1">Manager</label>
              <input
                type="text"
                id="team-manager"
                name="teamManager"
                className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                value={manager}
                onChange={(e) => setManager(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label htmlFor="team-phone" className="block text-sm font-medium text-gray-400 mb-1">Phone Number</label>
              <input
                type="tel"
                id="team-phone"
                name="teamPhone"
                className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label htmlFor="team-group" className="block text-sm font-medium text-gray-400 mb-1">Group</label>
              <select
                id="team-group"
                name="teamGroup"
                className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              >
                <option value="">No Group</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-all duration-200 flex items-center justify-center gap-2 font-medium shadow-md shadow-indigo-900/20"
            >
              {editingId ? (
                <>
                  <Pencil className="w-4 h-4" /> Update
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Add
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {isAdmin && (
        <div className="bg-[#151821]/80 backdrop-blur-md p-6 rounded-2xl border border-gray-800/50 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-indigo-400" /> Manage Groups
          </h3>
          <form onSubmit={handleAddGroup} className="flex gap-4">
            <input
              type="text"
              className="flex-1 bg-[#1A1D24]/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="New group name (e.g. Group B)"
            />
            <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-xl hover:bg-emerald-700 transition-all">Add Group</button>
          </form>
          <div className="flex flex-wrap gap-2 mt-4">
            {groups.map(g => (
              <div key={g.id} className="flex items-center gap-2 bg-[#1A1D24] px-3 py-1.5 rounded-lg border border-gray-700/50">
                <span className="text-gray-300 text-sm">{g.name}</span>
                <button onClick={() => onDeleteGroup(g.id)} className="text-gray-500 hover:text-red-400"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#151821]/80 backdrop-blur-md rounded-2xl border border-gray-800/50 overflow-hidden shadow-lg">
        <div className="p-6 border-b border-gray-800/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" /> Registered Teams
            </h2>
            <span className="bg-[#1A1D24]/80 text-gray-300 py-1 px-3 rounded-full text-sm font-medium border border-gray-700/50 shadow-sm">
              {teams.length} Teams
            </span>
          </div>
          {isAdmin && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-2 px-4 py-2 bg-[#1A1D24]/80 backdrop-blur-md border border-gray-700/50 text-gray-300 rounded-xl hover:bg-gray-800 transition-all duration-200 text-sm shadow-sm ${isEditing ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/50" : ""}`}
            >
              <Pencil className="w-4 h-4" /> {isEditing ? 'Done Editing' : 'Edit Table'}
            </button>
          )}
        </div>
        
        {teams.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-700" />
            <p>No teams registered yet. Add some teams to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1A1D24]/50 border-b border-gray-800/50">
                    {isAdmin && <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider"></th>}
                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Team Name</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Initials</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Manager</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Group</th>
                    {isAdmin && <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Actions</th>}
                  </tr>
                </thead>
                <SortableContext items={teams.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <tbody className="divide-y divide-gray-800/30">
                    {teams.map((team) => (
                      <SortableTeamRow 
                        key={team.id} 
                        team={team} 
                        groups={groups} 
                        isEditing={isEditing} 
                        isAdmin={isAdmin} 
                        onEditClick={handleEditClick} 
                        onSheetClick={setSheetTeamId} 
                        onDeleteClick={(id) => setTeamToDelete(id)} 
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </table>
            </DndContext>
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={!!teamToDelete}
        title="Delete Team"
        message="Are you sure you want to delete this team? This will reset all fixtures."
        onConfirm={() => teamToDelete && onDeleteTeam(teamToDelete)}
        onCancel={() => setTeamToDelete(null)}
      />

      {sheetTeamId && (
        <TeamSheetModal
          team={teams.find(t => t.id === sheetTeamId)!}
          settings={settings}
          isAdmin={isAdmin}
          onSave={onEditTeam}
          onClose={() => setSheetTeamId(null)}
        />
      )}
    </div>
  );
}
