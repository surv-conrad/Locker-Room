import { PlayerStat } from '../types';
import { Trophy, Award, AlertTriangle, AlertOctagon, Image as ImageIcon, Pencil, Download } from 'lucide-react';
import { cn } from '../utils';
import { useRef, useState } from 'react';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { exportAsImage } from '../utils/exportImage';

interface PlayerStatsProps {
  stats: PlayerStat[];
}

export function PlayerStats({ stats }: PlayerStatsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  useKeyboardShortcut('i', () => exportAsImage(statsRef.current, 'player-stats'));
  
  const topScorers = [...stats].sort((a, b) => b.goals - a.goals).slice(0, 10);
  const topYellows = [...stats].sort((a, b) => b.yellowCards - a.yellowCards).slice(0, 10);
  const topReds = [...stats].sort((a, b) => b.redCards - a.redCards).slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={cn("flex items-center gap-2 px-4 py-2 bg-[#1A1D24]/80 backdrop-blur-md border border-gray-700/50 text-gray-300 rounded-xl hover:bg-gray-800 transition-all duration-200 text-sm shadow-sm", isEditing && "bg-indigo-600/20 text-indigo-400 border-indigo-500/50")}
        >
          <Pencil className="w-4 h-4" /> {isEditing ? 'Done Editing' : 'Edit Stats'}
        </button>
      </div>

      <div ref={statsRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-[#0B0E14] p-4 -m-4 rounded-2xl">
        {/* Top Scorers */}
        <div className="bg-[#151821]/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-gray-800/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" /> Top Scorers
          </h3>
          <div className="space-y-3">
            {topScorers.filter(p => p.goals > 0).length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No goals recorded yet</p>
            ) : (
              topScorers.filter(p => p.goals > 0).map((player, index) => (
                <div key={player.playerId} className="flex items-center justify-between p-3 bg-[#1A1D24]/50 rounded-xl border border-gray-800/30">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      index === 0 ? "bg-yellow-500/20 text-yellow-500" :
                      index === 1 ? "bg-gray-400/20 text-gray-400" :
                      index === 2 ? "bg-amber-700/20 text-amber-700" :
                      "bg-gray-800 text-gray-500"
                    )}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-200" contentEditable={isEditing} suppressContentEditableWarning={true}>{player.playerName}</div>
                      <div className="text-xs text-gray-500" contentEditable={isEditing} suppressContentEditableWarning={true}>{player.teamName}</div>
                    </div>
                  </div>
                  <div className="font-bold text-emerald-400" contentEditable={isEditing} suppressContentEditableWarning={true}>{player.goals}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Yellow Cards */}
        <div className="bg-[#151821]/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-gray-800/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" /> Yellow Cards
          </h3>
          <div className="space-y-3">
            {topYellows.filter(p => p.yellowCards > 0).length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No yellow cards recorded yet</p>
            ) : (
              topYellows.filter(p => p.yellowCards > 0).map((player, index) => (
                <div key={player.playerId} className="flex items-center justify-between p-3 bg-[#1A1D24]/50 rounded-xl border border-gray-800/30">
                  <div className="flex items-center gap-3">
                    <div className="text-xs font-bold text-gray-500 w-6 text-center">{index + 1}</div>
                    <div>
                      <div className="text-sm font-medium text-gray-200" contentEditable={isEditing} suppressContentEditableWarning={true}>{player.playerName}</div>
                      <div className="text-xs text-gray-500" contentEditable={isEditing} suppressContentEditableWarning={true}>{player.teamName}</div>
                    </div>
                  </div>
                  <div className="font-bold text-yellow-500" contentEditable={isEditing} suppressContentEditableWarning={true}>{player.yellowCards}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Red Cards */}
        <div className="bg-[#151821]/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-gray-800/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-red-500" /> Red Cards
          </h3>
          <div className="space-y-3">
            {topReds.filter(p => p.redCards > 0).length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No red cards recorded yet</p>
            ) : (
              topReds.filter(p => p.redCards > 0).map((player, index) => (
                <div key={player.playerId} className="flex items-center justify-between p-3 bg-[#1A1D24]/50 rounded-xl border border-gray-800/30">
                  <div className="flex items-center gap-3">
                    <div className="text-xs font-bold text-gray-500 w-6 text-center">{index + 1}</div>
                    <div>
                      <div className="text-sm font-medium text-gray-200" contentEditable={isEditing} suppressContentEditableWarning={true}>{player.playerName}</div>
                      <div className="text-xs text-gray-500" contentEditable={isEditing} suppressContentEditableWarning={true}>{player.teamName}</div>
                    </div>
                  </div>
                  <div className="font-bold text-red-500" contentEditable={isEditing} suppressContentEditableWarning={true}>{player.redCards}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
