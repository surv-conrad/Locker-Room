import { LeagueRow, Fixture, Group } from '../types';
import { Trophy, Download, Image as ImageIcon, Pencil, FileText } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '../utils';
import { exportAsImage } from '../utils/exportImage';

interface LeagueTableProps {
  table: LeagueRow[];
  fixtures: Fixture[];
  groups: Group[];
}

export function LeagueTable({ table, fixtures, groups }: LeagueTableProps) {
  const [isEditing, setIsEditing] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  
  const getForm = (teamId: string) => {
    const teamFixtures = fixtures.filter(f => f.isPlayed && (f.homeTeamId === teamId || f.awayTeamId === teamId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
    
    return teamFixtures.map(f => {
      const isHome = f.homeTeamId === teamId;
      const score = isHome ? f.homeScore! : f.awayScore!;
      const opponentScore = isHome ? f.awayScore! : f.homeScore!;
      
      if (score > opponentScore) return 'W';
      if (score < opponentScore) return 'L';
      return 'D';
    });
  };

  const [filter, setFilter] = useState<'all' | 'home' | 'away'>('all');

  const handleExportCSV = () => {
    const headers = ['Pos', 'Team', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'];
    const rows = table.map((row, index) => [
      index + 1,
      row.teamName,
      row.played,
      row.won,
      row.drawn,
      row.lost,
      row.goalsFor,
      row.goalsAgainst,
      row.goalDifference,
      row.points
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "league-table.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text('League Table', 14, 15);
    
    const tableData = table.map((row, index) => [
      index + 1,
      row.teamName,
      row.played,
      row.won,
      row.drawn,
      row.lost,
      row.goalsFor,
      row.goalsAgainst,
      row.goalDifference,
      row.points
    ]);

    autoTable(doc, {
      head: [['Pos', 'Team', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts']],
      body: tableData,
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 10, fillColor: [42, 45, 53], textColor: [255, 255, 255] },
      headStyles: { fillColor: [30, 136, 229] },
      alternateRowStyles: { fillColor: [35, 38, 45] }
    });

    doc.save('league-table.pdf');
  };

  useKeyboardShortcut('p', handleExportPDF);
  useKeyboardShortcut('c', handleExportCSV);

  if (table.length === 0) {
    return (
      <div className="bg-[#151821]/80 backdrop-blur-md p-12 rounded-2xl border border-gray-800/50 text-center shadow-lg">
        <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-200 mb-2">No teams yet</h3>
        <p className="text-gray-500">Add teams to see the league table.</p>
      </div>
    );
  }

  // Group tables by groupId
  const tablesByGroup: Record<string, LeagueRow[]> = {};
  
  if (groups.length > 0) {
    groups.forEach(g => {
      tablesByGroup[g.id] = table.filter(row => row.groupId === g.id);
    });
  } else {
    tablesByGroup['league'] = table;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-end mb-4">
          <div className="flex bg-[#1A1D24]/80 backdrop-blur-md rounded-xl p-1 border border-gray-800/50 shadow-sm">
            {(['all', 'home', 'away'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn("px-3 py-1.5 rounded-lg transition-all duration-200 capitalize text-sm", filter === f ? "bg-indigo-600/20 text-indigo-400 font-medium" : "text-gray-400 hover:text-gray-200")}
              >
                {f}
              </button>
            ))}
          </div>
          {table.length > 0 && (
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={cn("flex items-center gap-2 px-4 py-2 bg-[#1A1D24]/80 backdrop-blur-md border border-gray-700/50 text-gray-300 rounded-xl hover:bg-gray-800 transition-all duration-200 text-sm shadow-sm", isEditing && "bg-indigo-600/20 text-indigo-400 border-indigo-500/50")}
              >
                <Pencil className="w-4 h-4" /> {isEditing ? 'Done Editing' : 'Edit Table'}
              </button>
            </div>
          )}
      </div>

      <div ref={tableRef} className="space-y-8 bg-[#0B0E14] p-4 -m-4 rounded-2xl">
        {Object.entries(tablesByGroup).map(([groupId, groupTable], index) => {
        const groupName = groups.find(g => g.id === groupId)?.name || 'League Table';
        
        if (groupTable.length === 0) return null;

        const groupColors = [
          'border-red-500 text-red-400',
          'border-blue-500 text-blue-400',
          'border-emerald-500 text-emerald-400',
          'border-amber-500 text-amber-400',
          'border-purple-500 text-purple-400',
          'border-pink-500 text-pink-400',
          'border-orange-500 text-orange-400',
          'border-teal-500 text-teal-400',
        ];
        
        const colorClass = groupId === 'all' 
          ? 'border-indigo-500 text-white' 
          : groupColors[index % groupColors.length];

        return (
          <div key={groupId} className="space-y-4">
            <h2 className={cn("text-xl font-bold pl-2 border-l-4", colorClass)}>{groupName}</h2>
            
            <div className="bg-[#151821]/80 backdrop-blur-md rounded-2xl border border-gray-800/50 overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-[#1A1D24]/50 border-b border-gray-800/50">
                      <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider w-16 text-center">Pos</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Team</th>
                      <th className="px-4 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center" title="Played">P</th>
                      <th className="px-4 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center" title="Won">W</th>
                      <th className="px-4 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center" title="Drawn">D</th>
                      <th className="px-4 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center" title="Lost">L</th>
                      <th className="px-4 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center" title="Goals For">GF</th>
                      <th className="px-4 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center" title="Goals Against">GA</th>
                      <th className="px-4 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center" title="Goal Difference">GD</th>
                      <th className="px-4 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Last 5</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/30">
                    {groupTable.map((row, index) => (
                      <tr 
                        key={row.teamId} 
                        className={cn(
                          "transition-colors",
                          index < 2 ? "bg-emerald-900/10 hover:bg-emerald-900/20" : "hover:bg-[#1A1D24]/50"
                        )}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={cn(
                            "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                            index === 0 ? "bg-yellow-500/20 text-yellow-500" :
                            index === 1 ? "bg-gray-400/20 text-gray-300" :
                            index === 2 ? "bg-amber-700/20 text-amber-600" :
                            "text-gray-500"
                          )} contentEditable={isEditing} suppressContentEditableWarning={true}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-200" contentEditable={isEditing} suppressContentEditableWarning={true}>
                          {row.teamName}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center text-gray-400" contentEditable={isEditing} suppressContentEditableWarning={true}>{row.played}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-center text-gray-400" contentEditable={isEditing} suppressContentEditableWarning={true}>{row.won}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-center text-gray-400" contentEditable={isEditing} suppressContentEditableWarning={true}>{row.drawn}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-center text-gray-400" contentEditable={isEditing} suppressContentEditableWarning={true}>{row.lost}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-center text-gray-400" contentEditable={isEditing} suppressContentEditableWarning={true}>{row.goalsFor}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-center text-gray-400" contentEditable={isEditing} suppressContentEditableWarning={true}>{row.goalsAgainst}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <span className={cn(
                            "font-medium",
                            row.goalDifference > 0 ? "text-green-500" :
                            row.goalDifference < 0 ? "text-red-500" :
                            "text-gray-500"
                          )} contentEditable={isEditing} suppressContentEditableWarning={true}>
                            {row.goalDifference > 0 ? '+' : ''}{row.goalDifference}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <div className="flex gap-1 justify-center">
                            {getForm(row.teamId).map((f, i) => (
                              <span key={i} className={cn(
                                "w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold",
                                f === 'W' ? "bg-emerald-500/20 text-emerald-500" :
                                f === 'L' ? "bg-red-500/20 text-red-500" :
                                "bg-gray-500/20 text-gray-400"
                              )} contentEditable={isEditing} suppressContentEditableWarning={true}>
                                {f}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center font-bold text-white text-lg" contentEditable={isEditing} suppressContentEditableWarning={true}>
                          {row.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
