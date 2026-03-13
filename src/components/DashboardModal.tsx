import { X, Activity, Users, Trophy, Calendar } from 'lucide-react';
import { Team, Fixture, LeagueRow } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardModalProps {
  teams: Team[];
  fixtures: Fixture[];
  leagueTable: LeagueRow[];
  onClose: () => void;
}

export function DashboardModal({ teams, fixtures, leagueTable, onClose }: DashboardModalProps) {
  const totalMatches = fixtures.length;
  const playedMatches = fixtures.filter(f => f.isPlayed).length;
  const totalGoals = fixtures.reduce((sum, f) => sum + (f.homeScore || 0) + (f.awayScore || 0), 0);
  const topScorer = leagueTable.length > 0 ? leagueTable[0] : null;

  const goalsPerTeam = teams.map(team => {
    const goals = fixtures.reduce((acc, fixture) => {
      if (fixture.homeTeamId === team.id) return acc + (fixture.homeScore || 0);
      if (fixture.awayTeamId === team.id) return acc + (fixture.awayScore || 0);
      return acc;
    }, 0);
    return { name: team.name, goals };
  });

  const matchStatus = [
    { name: 'Played', value: playedMatches },
    { name: 'Ongoing', value: fixtures.filter(f => f.isStarted && !f.isPlayed).length },
    { name: 'Not Started', value: fixtures.filter(f => !f.isStarted).length },
  ];

  const COLORS = ['#10b981', '#f59e0b', '#6b7280'];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-[#151821]/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-gray-800/50 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-gray-800/50">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Activity className="w-6 h-6 text-indigo-500" />
            Tournament Dashboard
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors p-2 hover:bg-gray-800/50 rounded-full">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-8 overflow-y-auto">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-[#1A1D24]/80 rounded-2xl p-6 border border-gray-800/50 shadow-lg">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-400 font-medium">Total Teams</p>
                  <p className="text-2xl font-bold text-white">{teams.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-[#1A1D24]/80 rounded-2xl p-6 border border-gray-800/50 shadow-lg">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-400 font-medium">Matches Played</p>
                  <p className="text-2xl font-bold text-white">{playedMatches} / {totalMatches}</p>
                </div>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2">
                <div 
                  className="bg-indigo-500 h-1.5 rounded-full" 
                  style={{ width: `${totalMatches > 0 ? (playedMatches / totalMatches) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-[#1A1D24]/80 rounded-2xl p-6 border border-gray-800/50 shadow-lg">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-400 font-medium">Total Goals</p>
                  <p className="text-2xl font-bold text-white">{totalGoals}</p>
                </div>
              </div>
            </div>

            <div className="bg-[#1A1D24]/80 rounded-2xl p-6 border border-gray-800/50 shadow-lg">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-400 font-medium">Current Leader</p>
                  <p className="text-lg font-bold text-white truncate max-w-[120px]">
                    {topScorer ? topScorer.teamName : '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-[#1A1D24]/50 rounded-2xl p-6 border border-gray-800/50">
              <h3 className="text-lg font-semibold text-white mb-4">Goals per Team</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={goalsPerTeam}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                  <Bar dataKey="goals" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-[#1A1D24]/50 rounded-2xl p-6 border border-gray-800/50">
              <h3 className="text-lg font-semibold text-white mb-4">Match Status</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={matchStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                    {matchStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Results and Top Teams */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-[#1A1D24]/50 rounded-2xl p-6 border border-gray-800/50">
              <h3 className="text-lg font-semibold text-white mb-4">Recent Results</h3>
              <div className="space-y-3">
                {fixtures.filter(f => f.isPlayed).slice(-5).reverse().map(fixture => (
                  <div key={fixture.id} className="flex items-center justify-between p-3 bg-[#151821] rounded-xl border border-gray-800/50">
                    <span className="text-gray-300 w-1/3 text-right truncate">{teams.find(t => t.id === fixture.homeTeamId)?.name}</span>
                    <span className="px-3 py-1 bg-gray-800 rounded-lg text-white font-bold text-sm mx-3">
                      {fixture.homeScore} - {fixture.awayScore}
                    </span>
                    <span className="text-gray-300 w-1/3 truncate">{teams.find(t => t.id === fixture.awayTeamId)?.name}</span>
                  </div>
                ))}
                {fixtures.filter(f => f.isPlayed).length === 0 && (
                  <p className="text-gray-500 text-center py-4">No matches played yet.</p>
                )}
              </div>
            </div>

            <div className="bg-[#1A1D24]/50 rounded-2xl p-6 border border-gray-800/50">
              <h3 className="text-lg font-semibold text-white mb-4">Top Teams</h3>
              <div className="space-y-3">
                {leagueTable.slice(0, 5).map((row, index) => (
                  <div key={row.teamId} className="flex items-center justify-between p-3 bg-[#151821] rounded-xl border border-gray-800/50">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="text-gray-200 font-medium">{row.teamName}</span>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-400">Pts: <span className="text-white font-bold">{row.points}</span></span>
                      <span className="text-gray-400">GD: <span className="text-white font-bold">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</span></span>
                    </div>
                  </div>
                ))}
                {leagueTable.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No teams added yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
