import { Fixture } from '../types';
import { Calendar } from 'lucide-react';

interface TournamentTimelineProps {
  fixtures: Fixture[];
}

export function TournamentTimeline({ fixtures }: TournamentTimelineProps) {
  const sortedFixtures = [...fixtures].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const groupedByDate = sortedFixtures.reduce((acc, fixture) => {
    const date = fixture.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(fixture);
    return acc;
  }, {} as Record<string, Fixture[]>);

  const dates = Object.keys(groupedByDate).sort();

  return (
    <div className="bg-[#151821]/80 backdrop-blur-md rounded-2xl border border-gray-800/50 p-6 shadow-lg">
      <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-6">
        <Calendar className="w-5 h-5 text-indigo-400" /> Tournament Timeline
      </h2>
      <div className="space-y-6">
        {dates.map(date => (
          <div key={date} className="relative pl-6 border-l border-gray-700">
            <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-indigo-500"></div>
            <h3 className="text-sm font-medium text-gray-300 mb-2">{new Date(date).toLocaleDateString()}</h3>
            <div className="space-y-2">
              {groupedByDate[date].map(fixture => (
                <div key={fixture.id} className="bg-[#1A1D24]/50 p-3 rounded-lg border border-gray-800/50 text-sm text-gray-400">
                  {fixture.homeTeamId} vs {fixture.awayTeamId} {fixture.time ? `at ${fixture.time}` : ''}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
