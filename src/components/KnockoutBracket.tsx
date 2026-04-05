import { Fixture, Team, Settings } from '../types';
import { cn, getStageName } from '../utils';
import { useState, useRef, useEffect, useMemo } from 'react';
import { Trophy, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './Tooltip';

interface KnockoutBracketProps {
  fixtures: Fixture[];
  teams: Team[];
  settings: Settings;
}

export function KnockoutBracket({ fixtures, teams, settings }: KnockoutBracketProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [isAutoScaled, setIsAutoScaled] = useState(true);

  const branchColors = [
    'border-indigo-500/50 shadow-indigo-500/20 bg-indigo-500/5',
    'border-emerald-500/50 shadow-emerald-500/20 bg-emerald-500/5',
    'border-rose-500/50 shadow-rose-500/20 bg-rose-500/5',
    'border-amber-500/50 shadow-amber-500/20 bg-amber-500/5',
    'border-purple-500/50 shadow-purple-500/20 bg-purple-500/5',
    'border-cyan-500/50 shadow-cyan-500/20 bg-cyan-500/5',
    'border-orange-500/50 shadow-orange-500/20 bg-orange-500/5',
    'border-pink-500/50 shadow-pink-500/20 bg-pink-500/5',
  ];

  const branchLineColors = [
    'bg-indigo-500/80 shadow-[0_0_8px_rgba(99,102,241,0.6)]',
    'bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    'bg-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.6)]',
    'bg-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.6)]',
    'bg-purple-500/80 shadow-[0_0_8px_rgba(168,85,247,0.6)]',
    'bg-cyan-500/80 shadow-[0_0_8px_rgba(6,182,212,0.6)]',
    'bg-orange-500/80 shadow-[0_0_8px_rgba(249,115,22,0.6)]',
    'bg-pink-500/80 shadow-[0_0_8px_rgba(236,72,153,0.6)]',
  ];

  // Filter and aggregate knockout fixtures
  const knockoutFixtures = fixtures.filter(f => f.matchday >= 100).sort((a, b) => a.matchday - b.matchday);
  
  const aggregatedFixtures: Record<string, Fixture> = {};
  knockoutFixtures.forEach(f => {
    const teamPair = [f.homeTeamId, f.awayTeamId].sort().join('-');
    const key = `${f.stageName}-${teamPair}`;
    
    if (!aggregatedFixtures[key]) {
      aggregatedFixtures[key] = { ...f, homeScore: f.homeScore || 0, awayScore: f.awayScore || 0 };
    } else {
      const existing = aggregatedFixtures[key];
      if (f.homeTeamId === existing.homeTeamId) {
        existing.homeScore = (existing.homeScore || 0) + (f.homeScore || 0);
        existing.awayScore = (existing.awayScore || 0) + (f.awayScore || 0);
      } else {
        existing.homeScore = (existing.homeScore || 0) + (f.awayScore || 0);
        existing.awayScore = (existing.awayScore || 0) + (f.homeScore || 0);
      }
    }
  });

  // Group by stageName instead of matchday to handle matches spread across days
  const rounds: Record<string, Fixture[]> = {};
  const stageNames: string[] = [];
  
  Object.values(aggregatedFixtures).forEach(f => {
    const stage = f.stageName || 'Unknown';
    if (!rounds[stage]) {
      rounds[stage] = [];
      stageNames.push(stage);
    }
    rounds[stage].push(f);
  });

  // Sort stages by their earliest matchday
  stageNames.sort((a, b) => {
    const minA = Math.min(...rounds[a].map(f => f.matchday));
    const minB = Math.min(...rounds[b].map(f => f.matchday));
    return minA - minB;
  });
  
  // Calculate numRounds based on the first round of knockout fixtures if available
  // Otherwise fallback to teams.length
  let numRounds = 0;
  if (stageNames.length > 0) {
    const firstStage = stageNames[0];
    const firstRoundMatches = rounds[firstStage].length;
    // If we have 4 matches in the first round, it's a Quarter-final (8 teams)
    // The total rounds from that point would be log2(matches * 2)
    const teamsInFirstRound = firstRoundMatches * 2;
    // But wait, what if it's a two-legged tie? Aggregation already handled that.
    // So firstRoundMatches is the number of unique pairings.
    numRounds = Math.ceil(Math.log2(teamsInFirstRound));
  } else {
    numRounds = Math.ceil(Math.log2(teams.length || 2));
  }
  
  // Generate the expected stages based on the starting round
  const expectedStages: string[] = [];
  if (numRounds > 0) {
    for (let i = 0; i < numRounds; i++) {
      const teamsInRound = Math.pow(2, numRounds - i);
      expectedStages.push(getStageName(teamsInRound));
    }
  }

  useEffect(() => {
    if (!isAutoScaled) return;
    const updateScale = () => {
      if (containerRef.current && containerRef.current.parentElement) {
        const parentWidth = containerRef.current.parentElement.clientWidth;
        const contentWidth = containerRef.current.scrollWidth;
        if (contentWidth > parentWidth && parentWidth > 0) {
          setScale(parentWidth / contentWidth);
        } else {
          setScale(1);
        }
      }
    };
    window.addEventListener('resize', updateScale);
    updateScale();
    return () => window.removeEventListener('resize', updateScale);
  }, [fixtures, isAutoScaled]);

  const handleZoomIn = () => {
    setIsAutoScaled(false);
    setScale(prev => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setIsAutoScaled(false);
    setScale(prev => Math.max(prev - 0.1, 0.2));
  };

  const handleResetZoom = () => {
    setIsAutoScaled(true);
  };

  const displayStages = expectedStages.length > 0 ? expectedStages : stageNames;
  const COLUMN_HEIGHT = 700;
  const CONTENT_HEIGHT = 620; // Estimated height of the matches area within the 700px column

  return (
    <div className="w-full relative group">
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-50 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={handleZoomOut}
              className="p-2 bg-gray-800/80 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={handleResetZoom}
              className={cn(
                "p-2 border rounded-lg transition-colors",
                isAutoScaled 
                  ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" 
                  : "bg-gray-800/80 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700"
              )}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Auto Scale</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={handleZoomIn}
              className="p-2 bg-gray-800/80 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>
      </div>

      <div className="w-full overflow-auto py-8 no-scrollbar" ref={containerRef}>
        <div 
          style={{ 
            transform: `scale(${scale})`, 
            transformOrigin: 'top left', 
            transition: 'transform 0.2s',
            width: 'max-content',
            minWidth: '100%'
          }} 
          className="flex gap-16 px-8 justify-center items-center"
        >
          {displayStages.map((stage, rIndex) => {
            const roundFixtures = rounds[stage] || [];
            const numMatches = Math.pow(2, numRounds - 1 - rIndex);
            const slots = Array.from({ length: numMatches }, (_, i) => roundFixtures[i] || { id: `placeholder-${stage}-${i}`, isPlaceholder: true });
            const isFinal = rIndex === numRounds - 1;

            return (
              <div key={stage} className="flex flex-col h-[700px] justify-around">
                <div className="text-center mb-4 flex items-center justify-center gap-2 h-10">
                  {isFinal && <Trophy className="w-4 h-4 text-yellow-400" />}
                  <h3 className="text-indigo-400 font-semibold uppercase tracking-wider text-sm">
                    {stage}
                  </h3>
                </div>
                <div className="flex flex-col justify-around flex-1 relative">
                  {slots.map((fixture, fIndex) => {
                     const isPlaceholder = (fixture as any).isPlaceholder;
                     const fixtureData = fixture as any;
                     const homeTeam = !isPlaceholder ? teams.find(t => t.id === fixtureData.homeTeamId) : null;
                     const awayTeam = !isPlaceholder ? teams.find(t => t.id === fixtureData.awayTeamId) : null;
                     
                     // Calculate branch index
                     // For the first round, it's just fIndex
                     // For subsequent rounds, it's fIndex * (2^rIndex)
                     const branchIndex = fIndex * Math.pow(2, rIndex);
                     const themeClass = branchColors[branchIndex % branchColors.length];
                     const lineThemeClass = branchLineColors[branchIndex % branchLineColors.length];

                     return (
                       <div 
                         key={fixture.id} 
                         className={cn(
                           "w-48 bg-[#151821]/90 border rounded-lg p-3 shadow-lg relative z-10 transition-all duration-300",
                           isPlaceholder ? "border-gray-700/50" : themeClass
                         )}
                       >
                         {isPlaceholder ? (
                           <div className="flex items-center justify-center h-12 text-gray-600 text-xs italic">TBD</div>
                         ) : (
                           <>
                             <div className="flex justify-between items-center text-[10px] text-gray-500 mb-1">
                               <span>{fixtureData.date}</span>
                               <span>{fixtureData.isPlayed ? 'FT' : 'vs'}</span>
                             </div>
                             <div className="space-y-1 text-xs">
                               <div className="flex justify-between">
                                 <span className="truncate max-w-[120px]">{homeTeam?.name || 'TBD'}</span>
                                 <span className="font-bold">{fixtureData.homeScore ?? '-'}</span>
                               </div>
                               <div className="flex justify-between">
                                 <span className="truncate max-w-[120px]">{awayTeam?.name || 'TBD'}</span>
                                 <span className="font-bold">{fixtureData.awayScore ?? '-'}</span>
                               </div>
                             </div>
                           </>
                         )}
                         {/* Tree connector lines */}
                         {!isFinal && (
                           <div className="absolute top-1/2 -right-16 w-16 h-px pointer-events-none">
                             {/* Horizontal line out from match */}
                             <div className={cn("absolute right-8 w-8 h-[2px] -translate-y-1/2", lineThemeClass)}></div>
                             
                             {/* Vertical connector */}
                             <div className={cn(
                               "absolute right-8 w-[2px]",
                               lineThemeClass,
                               fIndex % 2 === 0 ? "top-0" : "bottom-0"
                             )} style={{ height: `${CONTENT_HEIGHT / (numMatches * 2)}px` }}></div>
                             
                             {/* Horizontal line to next round */}
                             {fIndex % 2 === 0 && (
                               <div className={cn("absolute right-0 w-8 h-[2px] -translate-y-1/2", lineThemeClass)} 
                                    style={{ top: `${CONTENT_HEIGHT / (numMatches * 2)}px` }}></div>
                             )}
                           </div>
                         )}
                       </div>
                     );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
