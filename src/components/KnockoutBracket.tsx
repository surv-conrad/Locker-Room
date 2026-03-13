import { Fixture, Team } from '../types';
import { cn } from '../utils';

interface KnockoutBracketProps {
  fixtures: Fixture[];
  teams: Team[];
}

export function KnockoutBracket({ fixtures, teams }: KnockoutBracketProps) {
  // Filter knockout fixtures
  const knockoutFixtures = fixtures.filter(f => f.matchday >= 100).sort((a, b) => a.matchday - b.matchday);
  
  // Group by matchday
  const rounds: Record<number, Fixture[]> = {};
  knockoutFixtures.forEach(f => {
    if (!rounds[f.matchday]) rounds[f.matchday] = [];
    rounds[f.matchday].push(f);
  });
  
  const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);

  if (knockoutFixtures.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No knockout fixtures generated yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto py-8 custom-scrollbar">
      <div className="flex gap-16 min-w-max px-8 justify-center">
        {roundNumbers.map((round, rIndex) => (
          <div key={round} className="flex flex-col justify-around gap-8">
            <div className="text-center mb-4">
              <h3 className="text-indigo-400 font-semibold uppercase tracking-wider text-sm">
                {round === 102 ? 'Final' : round === 101 ? 'Semi-Finals' : `Round ${round - 100}`}
              </h3>
            </div>
            <div className="flex flex-col justify-center gap-8 flex-1">
              {rounds[round].map((fixture, fIndex) => {
                 const homeTeam = teams.find(t => t.id === fixture.homeTeamId);
                 const awayTeam = teams.find(t => t.id === fixture.awayTeamId);
                 const isPlayed = fixture.isPlayed;
                 const homeWon = isPlayed && (fixture.homeScore || 0) > (fixture.awayScore || 0);
                 const awayWon = isPlayed && (fixture.awayScore || 0) > (fixture.homeScore || 0);

                 return (
                   <div key={fixture.id} className="w-64 bg-[#151821]/90 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 shadow-xl relative group hover:border-indigo-500/50 transition-all duration-300">
                     {/* Connector lines logic would go here but it's complex for dynamic brackets */}
                     
                     <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-800/50">
                       <span className="text-[10px] text-gray-500 font-mono">{fixture.date}</span>
                       <span className={cn("text-[10px] px-1.5 py-0.5 rounded", isPlayed ? "bg-emerald-500/10 text-emerald-400" : "bg-gray-800 text-gray-500")}>
                         {isPlayed ? 'FT' : 'vs'}
                       </span>
                     </div>

                     <div className="space-y-2">
                       <div className="flex justify-between items-center">
                         <div className="flex items-center gap-2 overflow-hidden">
                           {/* Placeholder for flag/logo if we had it */}
                           <div className={cn("w-1 h-6 rounded-full", homeWon ? "bg-emerald-500" : "bg-gray-700")}></div>
                           <span className={cn("font-medium truncate text-sm", homeWon ? "text-white" : "text-gray-400")}>
                             {homeTeam?.name || 'TBD'}
                           </span>
                         </div>
                         <span className={cn("font-bold font-mono", homeWon ? "text-emerald-400" : "text-gray-500")}>
                           {fixture.homeScore ?? '-'}
                         </span>
                       </div>

                       <div className="flex justify-between items-center">
                         <div className="flex items-center gap-2 overflow-hidden">
                           <div className={cn("w-1 h-6 rounded-full", awayWon ? "bg-emerald-500" : "bg-gray-700")}></div>
                           <span className={cn("font-medium truncate text-sm", awayWon ? "text-white" : "text-gray-400")}>
                             {awayTeam?.name || 'TBD'}
                           </span>
                         </div>
                         <span className={cn("font-bold font-mono", awayWon ? "text-emerald-400" : "text-gray-500")}>
                           {fixture.awayScore ?? '-'}
                         </span>
                       </div>
                     </div>
                   </div>
                 );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
