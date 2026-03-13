import { Fixture, Team } from '../types';
import { Printer } from 'lucide-react';
import { useRef } from 'react';

interface MatchSheetProps {
  fixture: Fixture;
  teams: Team[];
}

export function MatchSheet({ fixture, teams }: MatchSheetProps) {
  const homeTeam = teams.find(t => t.id === fixture.homeTeamId);
  const awayTeam = teams.find(t => t.id === fixture.awayTeamId);
  const sheetRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handlePrint}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm"
      >
        <Printer className="w-4 h-4" /> Print Match Sheet
      </button>

      <div ref={sheetRef} className="bg-white text-black p-8 rounded-lg shadow-lg print:shadow-none print:p-0">
        <h1 className="text-2xl font-bold text-center mb-6">Match Sheet</h1>
        <div className="flex justify-between mb-8">
          <div className="text-center">
            <h2 className="text-xl font-bold">{homeTeam?.name}</h2>
            <p className="text-sm">Home</p>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold">vs</h2>
            <p className="text-sm">{fixture.date}</p>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold">{awayTeam?.name}</h2>
            <p className="text-sm">Away</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div>
            <h3 className="font-bold border-b mb-2">{homeTeam?.name} Lineup</h3>
            <ul className="list-decimal pl-5">
              {homeTeam?.players.slice(0, 11).map(p => <li key={p.id}>{p.name} ({p.number})</li>)}
            </ul>
          </div>
          <div>
            <h3 className="font-bold border-b mb-2">{awayTeam?.name} Lineup</h3>
            <ul className="list-decimal pl-5">
              {awayTeam?.players.slice(0, 11).map(p => <li key={p.id}>{p.name} ({p.number})</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
