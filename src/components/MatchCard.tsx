import React from 'react';
import { Fixture, Team, MatchEvent, Settings } from '../types';
import { Trophy, Calendar, MapPin, Clock } from 'lucide-react';
import { cn } from '../utils';

interface MatchCardProps {
  fixture: Fixture;
  teams: Team[];
  settings: Settings;
  id?: string;
}

export function MatchCard({ fixture, teams, settings, id }: MatchCardProps) {
  const homeTeam = teams.find(t => t.id === fixture.homeTeamId);
  const awayTeam = teams.find(t => t.id === fixture.awayTeamId);
  
  const homeGoals = fixture.events?.filter(e => e.type === 'goal' && e.teamId === fixture.homeTeamId) || [];
  const awayGoals = fixture.events?.filter(e => e.type === 'goal' && e.teamId === fixture.awayTeamId) || [];

  return (
    <div 
      id={id}
      className="w-[1080px] h-[1080px] bg-[#0B0E14] text-white flex flex-col items-center justify-between p-16 relative overflow-hidden font-sans"
      style={{
        backgroundImage: 'radial-gradient(circle at 50% 50%, #1A1D24 0%, #0B0E14 100%)'
      }}
    >
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <div className="w-full flex flex-col items-center gap-6 z-10">
        {settings.logoUrl && (
          <img 
            src={settings.logoUrl} 
            alt="Tournament Logo" 
            className="w-32 h-32 object-contain rounded-2xl shadow-2xl border-4 border-white/10"
            referrerPolicy="no-referrer"
          />
        )}
        <div className="text-center">
          <h1 className="text-5xl font-black uppercase tracking-[0.2em] text-white italic font-display">
            {settings.tournamentName || 'Tournament'}
          </h1>
          <div className="flex items-center justify-center gap-8 mt-4 text-indigo-400 font-bold uppercase tracking-widest text-xl">
            <span className="flex items-center gap-2"><Calendar className="w-6 h-6" /> {fixture.date}</span>
            <span className="flex items-center gap-2"><Clock className="w-6 h-6" /> {fixture.time || '--:--'}</span>
          </div>
        </div>
      </div>

      {/* Score Section */}
      <div className="w-full flex items-center justify-between gap-12 z-10">
        {/* Home Team */}
        <div className="flex-1 flex flex-col items-center gap-8">
          <div className="w-56 h-56 bg-white/5 rounded-[40px] border-4 border-white/10 flex items-center justify-center shadow-2xl overflow-hidden relative group">
            <span className="text-9xl font-black italic text-white/20 font-display">
              {homeTeam?.initial || homeTeam?.name?.charAt(0)}
            </span>
            <div className="absolute inset-0 bg-gradient-to-t from-indigo-600/20 to-transparent" />
          </div>
          <h2 className="text-4xl font-black uppercase text-center tracking-tight leading-tight italic font-display">
            {homeTeam?.name}
          </h2>
        </div>

        {/* Score */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-8">
            <span className="text-[180px] font-black italic font-display leading-none text-white drop-shadow-[0_10px_30px_rgba(255,255,255,0.2)]">
              {fixture.homeScore ?? 0}
            </span>
            <span className="text-6xl font-black text-indigo-500 italic font-display opacity-50">-</span>
            <span className="text-[180px] font-black italic font-display leading-none text-white drop-shadow-[0_10px_30px_rgba(255,255,255,0.2)]">
              {fixture.awayScore ?? 0}
            </span>
          </div>
          <div className="px-8 py-3 bg-indigo-600 rounded-full text-2xl font-black uppercase tracking-[0.3em] italic font-display shadow-lg shadow-indigo-900/40">
            {fixture.isPlayed ? 'Full Time' : 'Live'}
          </div>
        </div>

        {/* Away Team */}
        <div className="flex-1 flex flex-col items-center gap-8">
          <div className="w-56 h-56 bg-white/5 rounded-[40px] border-4 border-white/10 flex items-center justify-center shadow-2xl overflow-hidden relative">
            <span className="text-9xl font-black italic text-white/20 font-display">
              {awayTeam?.initial || awayTeam?.name?.charAt(0)}
            </span>
            <div className="absolute inset-0 bg-gradient-to-t from-indigo-600/20 to-transparent" />
          </div>
          <h2 className="text-4xl font-black uppercase text-center tracking-tight leading-tight italic font-display">
            {awayTeam?.name}
          </h2>
        </div>
      </div>

      {/* Scorers Section */}
      <div className="w-full grid grid-cols-2 gap-24 px-12 z-10">
        <div className="flex flex-col items-end gap-3">
          {homeGoals.map((event, idx) => {
            const player = homeTeam?.players.find(p => p.id === event.playerId);
            return (
              <div key={idx} className="flex items-center gap-3 text-2xl font-bold text-gray-300">
                <span className="italic">{player?.name || 'Unknown'}</span>
                <span className="text-indigo-500 text-xl">{event.minute}'</span>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col items-start gap-3">
          {awayGoals.map((event, idx) => {
            const player = awayTeam?.players.find(p => p.id === event.playerId);
            return (
              <div key={idx} className="flex items-center gap-3 text-2xl font-bold text-gray-300">
                <span className="text-indigo-500 text-xl">{event.minute}'</span>
                <span className="italic">{player?.name || 'Unknown'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="w-full flex flex-col items-center gap-4 z-10">
        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="flex items-center gap-12 text-xl font-black uppercase tracking-[0.5em] text-gray-500 italic font-display">
          <span>Matchday {fixture.matchday}</span>
          <span className="text-indigo-500">•</span>
          <span>Pitch {fixture.pitchId}</span>
        </div>
      </div>
    </div>
  );
}
