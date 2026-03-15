import React, { useState } from 'react';
import { Fixture, Team, MatchEvent } from '../types';
import { X, Plus, Trash2, User, Clock } from 'lucide-react';
import { cn } from '../utils';

interface MatchEventsProps {
  fixture: Fixture;
  homeTeam: Team;
  awayTeam: Team;
  onAddEvent: (fixtureId: string, event: Omit<MatchEvent, 'id'>) => void;
  onRemoveEvent: (fixtureId: string, eventId: string) => void;
  onClose: () => void;
}

export function MatchEvents({ fixture, homeTeam, awayTeam, onAddEvent, onRemoveEvent, onClose }: MatchEventsProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(homeTeam.id);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [eventType, setEventType] = useState<MatchEvent['type']>('goal');
  const [minute, setMinute] = useState<number>(0);

  const selectedTeam = selectedTeamId === homeTeam.id ? homeTeam : awayTeam;
  const players = selectedTeam.players || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerId) return;

    onAddEvent(fixture.id, {
      fixtureId: fixture.id,
      teamId: selectedTeamId,
      playerId: selectedPlayerId,
      type: eventType,
      minute
    });

    // Reset form slightly for easier entry
    setMinute(prev => Math.min(90, prev + 1));
  };

  const sortedEvents = [...(fixture.events || [])].sort((a, b) => a.minute - b.minute);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#151821]/90 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-800/50 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-gray-800/50 flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-white">Match Events</h2>
            <p className="text-sm text-gray-400">{homeTeam.name} vs {awayTeam.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors p-2 hover:bg-gray-800/50 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Add Event Form */}
          <div className="bg-[#1A1D24]/50 rounded-xl p-5 border border-gray-800/50">
            <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Event
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="md:col-span-1">
                <label htmlFor="team-select" className="block text-xs text-gray-500 mb-1">Team</label>
                <select
                  id="team-select"
                  name="teamId"
                  className="w-full bg-[#151821] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                  value={selectedTeamId}
                  onChange={(e) => {
                    setSelectedTeamId(e.target.value);
                    setSelectedPlayerId('');
                  }}
                >
                  <option value={homeTeam.id}>{homeTeam.name}</option>
                  <option value={awayTeam.id}>{awayTeam.name}</option>
                </select>
              </div>

              <div className="md:col-span-1">
                <label htmlFor="player-select" className="block text-xs text-gray-500 mb-1">Player</label>
                <select
                  id="player-select"
                  name="playerId"
                  className="w-full bg-[#151821] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  required
                >
                  <option value="">Select Player</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (#{p.number})</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-1">
                <label htmlFor="event-type-select" className="block text-xs text-gray-500 mb-1">Event</label>
                <select
                  id="event-type-select"
                  name="eventType"
                  className="w-full bg-[#151821] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as any)}
                >
                  <option value="goal">Goal ⚽</option>
                  <option value="yellow_card">Yellow Card 🟨</option>
                  <option value="red_card">Red Card 🟥</option>
                </select>
              </div>

              <div className="md:col-span-1">
                <label htmlFor="event-minute" className="block text-xs text-gray-500 mb-1">Minute</label>
                <input
                  type="number"
                  id="event-minute"
                  name="minute"
                  min="0"
                  max="130"
                  className="w-full bg-[#151821] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                  value={minute}
                  onChange={(e) => setMinute(parseInt(e.target.value))}
                  required
                />
              </div>

              <div className="md:col-span-1">
                <button
                  type="submit"
                  disabled={!selectedPlayerId}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            </form>
          </div>

          {/* Events List */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Match Timeline
            </h3>
            
            {sortedEvents.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-[#1A1D24]/30 rounded-xl border border-gray-800/30 border-dashed">
                No events recorded yet
              </div>
            ) : (
              <div className="space-y-3 relative before:absolute before:left-1/2 before:top-0 before:bottom-0 before:w-px before:bg-gray-800/50">
                {sortedEvents.map(event => {
                  const isHome = event.teamId === homeTeam.id;
                  const team = isHome ? homeTeam : awayTeam;
                  const player = team.players.find(p => p.id === event.playerId);
                  
                  return (
                    <div key={event.id} className={cn("flex items-center gap-4 relative", isHome ? "flex-row-reverse" : "")}>
                      <div className={cn("flex-1 flex items-center gap-3", isHome ? "justify-start" : "justify-end")}>
                        <div className={cn("text-sm font-medium text-gray-200", isHome ? "text-left" : "text-right")}>
                          {player?.name || 'Unknown Player'}
                          <span className="text-xs text-gray-500 block">{team.name}</span>
                        </div>
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-lg border border-gray-700/50",
                          event.type === 'goal' ? "bg-emerald-500/20" : 
                          event.type === 'yellow_card' ? "bg-yellow-500/20" : 
                          "bg-red-500/20"
                        )}>
                          {event.type === 'goal' ? '⚽' : event.type === 'yellow_card' ? '🟨' : '🟥'}
                        </div>
                      </div>
                      
                      <div className="w-10 h-10 rounded-full bg-[#151821] border border-gray-700 flex items-center justify-center z-10 text-xs font-bold text-gray-400 shadow-sm">
                        {event.minute}'
                      </div>
                      
                      <div className={cn("flex-1 flex items-center", isHome ? "justify-end" : "justify-start")}>
                        <button 
                          onClick={() => onRemoveEvent(fixture.id, event.id)}
                          className="text-gray-600 hover:text-red-400 transition-colors p-1"
                          title="Remove event"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
