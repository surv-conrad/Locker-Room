import { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Fixture, Team, Group, Settings, MatchEvent } from '../types';
import { ModernSelect } from './ModernSelect';
import { Calendar, RefreshCw, Download, Pencil, Trophy, X, Save, Activity, List, GitMerge, Image as ImageIcon } from 'lucide-react';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '../utils';
import { exportAsImage } from '../utils/exportImage';
import { MatchEvents } from './MatchEvents';
import { KnockoutBracket } from './KnockoutBracket';
import { ConfirmModal } from './ConfirmModal';

interface FixturesProps {
  fixtures: Fixture[];
  teams: Team[];
  groups: Group[];
  settings: Settings;
  isAdmin: boolean;
  onGenerateFixtures: () => void;
  onGenerateKnockoutFixtures: () => void;
  onUpdateFixture: (id: string, homeScore: number | null, awayScore: number | null) => void;
  onUpdateFixtureDetails: (id: string, details: Partial<Pick<Fixture, 'date' | 'time' | 'pitchId' | 'matchday'>>) => void;
  onUpdateMatchdayDate: (matchday: number, date: string) => void;
  onToggleFixtureStarted: (id: string) => void;
  onToggleFixturePlayed: (id: string) => void;
  onAddGroup: (name: string) => void;
  onEditTeam: (id: string, team: Omit<Team, 'id' | 'players'>) => void;
  onAddMatchEvent: (fixtureId: string, event: Omit<MatchEvent, 'id'>) => void;
  onRemoveMatchEvent: (fixtureId: string, eventId: string) => void;
  onReorderFixtures: (matchday: number, fixtures: Fixture[]) => void;
  onMoveFixture: (fixture: Fixture, targetMatchday: number, targetOrder: number) => void;
  onReassignFixturesFromMatchday: (matchday: number, selectedFixtureIds: string[]) => void;
  onRescheduleFixtures: () => void;
  matchFilter: 'all' | 'hide_past' | 'current';
  nameDisplay: 'team' | 'player';
}

export function SortableFixtureRow({ fixture, teams, settings, isAdmin, editingFixtureId, setEditingFixtureId, onUpdateFixture, onUpdateFixtureDetails, onToggleFixtureStarted, onToggleFixturePlayed, onAddMatchEvent, setSelectedFixtureForEvents, getTeamName, getPitchName, getGroupColor, handleScoreChange }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: fixture.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  
  const homeWon = fixture.isPlayed && fixture.homeScore !== null && fixture.awayScore !== null && fixture.homeScore > fixture.awayScore;
  const awayWon = fixture.isPlayed && fixture.homeScore !== null && fixture.awayScore !== null && fixture.awayScore > fixture.homeScore;
  const pillColor = getGroupColor(fixture.groupId);

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border border-gray-800/50 bg-[#2A2D35]/50 backdrop-blur-sm transition-all duration-200 hover:border-gray-700">
      {isAdmin && <div className="cursor-grab p-1 flex items-center justify-center text-gray-500" {...attributes} {...listeners}>⋮⋮</div>}
      <div className={cn("text-center text-xs py-1.5 font-medium flex justify-between px-2 rounded-t-xl", pillColor)}>
        {editingFixtureId === fixture.id ? (
          <div className="flex items-center gap-1 w-full">
            <label htmlFor={`pitch-${fixture.id}`} className="sr-only">Pitch</label>
            <select 
              id={`pitch-${fixture.id}`}
              name={`pitch-${fixture.id}`}
              className="bg-[#1A1D24] border border-gray-700 rounded px-1 py-0.5 text-[10px] text-white max-w-[80px]"
              defaultValue={fixture.pitchId}
              onChange={(e) => onUpdateFixtureDetails(fixture.id, { pitchId: e.target.value })}
            >
              {settings.pitches?.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <label htmlFor={`matchday-${fixture.id}`} className="sr-only">Matchday</label>
            <input 
              id={`matchday-${fixture.id}`}
              name={`matchday-${fixture.id}`}
              type="number" 
              min="1"
              className="bg-[#1A1D24] border border-gray-700 rounded px-1 py-0.5 text-[10px] text-white w-[40px]"
              defaultValue={fixture.matchday}
              onChange={(e) => onUpdateFixtureDetails(fixture.id, { matchday: parseInt(e.target.value) })}
              title="Matchday"
            />
            <label htmlFor={`date-${fixture.id}`} className="sr-only">Date</label>
            <input 
              id={`date-${fixture.id}`}
              name={`date-${fixture.id}`}
              type="date" 
              className="bg-[#1A1D24] border border-gray-700 rounded px-1 py-0.5 text-[10px] text-white w-[80px]"
              defaultValue={fixture.date}
              onChange={(e) => onUpdateFixtureDetails(fixture.id, { date: e.target.value })}
            />
            <label htmlFor={`time-${fixture.id}`} className="sr-only">Time</label>
            <input 
              id={`time-${fixture.id}`}
              name={`time-${fixture.id}`}
              type="time" 
              className="bg-[#1A1D24] border border-gray-700 rounded px-1 py-0.5 text-[10px] text-white w-[60px]"
              defaultValue={fixture.time}
              onChange={(e) => onUpdateFixtureDetails(fixture.id, { time: e.target.value })}
            />
            <button onClick={() => setEditingFixtureId(null)} className="text-emerald-400 hover:text-emerald-300 ml-auto">
              <Save className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <span>{getPitchName(fixture.pitchId)} | {fixture.date}{fixture.time ? ` ${fixture.time}` : ''}</span>
              {isAdmin && (
                <button onClick={() => setEditingFixtureId(fixture.id)} className="text-gray-500 hover:text-white ml-1">
                  <Pencil className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("px-1.5 rounded-md", fixture.isPlayed ? "bg-emerald-500/20 text-emerald-300" : fixture.isStarted ? "bg-amber-500/20 text-amber-300" : "bg-gray-500/20 text-gray-300")}>
                {fixture.isPlayed ? 'Finished' : fixture.isStarted ? 'Ongoing' : 'Not Started'}
              </span>
              {isAdmin && (
                <button 
                  onClick={() => {
                    if (fixture.isPlayed) {
                      onToggleFixturePlayed(fixture.id);
                    } else if (fixture.isStarted) {
                      onToggleFixturePlayed(fixture.id);
                    } else {
                      onToggleFixtureStarted(fixture.id);
                    }
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                >
                  {fixture.isPlayed ? 'Reopen' : fixture.isStarted ? 'Finish' : 'Start'}
                </button>
              )}
              {(fixture.isStarted || fixture.isPlayed) && isAdmin && (
                <button
                  onClick={() => setSelectedFixtureForEvents(fixture)}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1 bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700/50"
                  title="Match Events"
                >
                  <Activity className="w-3 h-3" /> Events
                </button>
              )}
            </div>
          </>
        )}
      </div>
      
      <div className={cn(
        "flex justify-between items-center px-4 py-2 border-b border-gray-800/50 transition-colors",
        homeWon ? "bg-emerald-500/10 text-emerald-400" : (fixture.isPlayed ? "bg-transparent text-gray-400" : "bg-transparent text-gray-200")
      )}>
        <span className="font-medium text-sm truncate pr-2">{getTeamName(fixture.homeTeamId)}</span>
        <label htmlFor={`homeScore-${fixture.id}`} className="sr-only">Home Score</label>
        <input
          id={`homeScore-${fixture.id}`}
          name={`homeScore-${fixture.id}`}
          type="number"
          min="0"
          disabled={!fixture.isStarted || fixture.isPlayed || !isAdmin}
          className="w-12 bg-black/20 text-right font-bold outline-none focus:bg-black/40 focus:ring-1 focus:ring-indigo-500/50 rounded-md px-2 py-1 transition-all disabled:opacity-50"
          value={isNaN(fixture.homeScore as number) ? '' : (fixture.homeScore ?? '')}
          onChange={(e) => {
            const val = e.target.value === '' ? null : parseInt(e.target.value);
            handleScoreChange(fixture, true, val);
          }}
          placeholder="-"
        />
      </div>
      
      <div className={cn(
        "flex justify-between items-center px-4 py-2 transition-colors",
        awayWon ? "bg-emerald-500/10 text-emerald-400" : (fixture.isPlayed ? "bg-transparent text-gray-400" : "bg-transparent text-gray-200")
      )}>
        <span className="font-medium text-sm truncate pr-2">{getTeamName(fixture.awayTeamId)}</span>
        <label htmlFor={`awayScore-${fixture.id}`} className="sr-only">Away Score</label>
        <input
          id={`awayScore-${fixture.id}`}
          name={`awayScore-${fixture.id}`}
          type="number"
          min="0"
          disabled={!fixture.isStarted || fixture.isPlayed || !isAdmin}
          className="w-12 bg-black/20 text-right font-bold outline-none focus:bg-black/40 focus:ring-1 focus:ring-indigo-500/50 rounded-md px-2 py-1 transition-all disabled:opacity-50"
          value={fixture.awayScore ?? ''}
          onChange={(e) => {
            const val = e.target.value === '' ? null : parseInt(e.target.value);
            handleScoreChange(fixture, false, val);
          }}
          placeholder="-"
        />
      </div>
    </div>
  );
}

export function Fixtures({ fixtures, teams, groups, settings, isAdmin, onGenerateFixtures, onGenerateKnockoutFixtures, onUpdateFixture, onUpdateFixtureDetails, onUpdateMatchdayDate, onToggleFixtureStarted, onToggleFixturePlayed, onAddGroup, onEditTeam, onAddMatchEvent, onRemoveMatchEvent, onReorderFixtures, onMoveFixture, onReassignFixturesFromMatchday, onRescheduleFixtures, matchFilter, nameDisplay }: FixturesProps) {
  const [stage, setStage] = useState<'group' | 'knockout'>('group');
  const [viewMode, setViewMode] = useState<'list' | 'bracket'>('list');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [editingMatchday, setEditingMatchday] = useState<number | null>(null);
  const [editingFixtureId, setEditingFixtureId] = useState<string | null>(null);
  const [selectedFixtureForEvents, setSelectedFixtureForEvents] = useState<Fixture | null>(null);
  const [managingMatchday, setManagingMatchday] = useState<number | null>(null);
  const fixturesRef = useRef<HTMLDivElement>(null);
  const [selectedForDay, setSelectedForDay] = useState<string[]>([]);
  const [pendingGoal, setPendingGoal] = useState<{
    fixture: Fixture;
    teamId: string;
    newHomeScore: number | null;
    newAwayScore: number | null;
    goalsToAdd: number;
  } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    confirmStyle: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    confirmStyle: 'danger',
    onConfirm: () => {}
  });
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any, matchday: number, dayFixtures: Fixture[]) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = dayFixtures.findIndex(f => f.id === active.id);
      const newIndex = dayFixtures.findIndex(f => f.id === over.id);
      onReorderFixtures(matchday, arrayMove(dayFixtures, oldIndex, newIndex));
    }
  };

  // ... (rest of the component)

  const handleScoreChange = (fixture: Fixture, isHome: boolean, val: number | null) => {
    const oldScore = isHome ? (fixture.homeScore || 0) : (fixture.awayScore || 0);
    const newScore = val || 0;
    
    if (val !== null && newScore > oldScore) {
      setPendingGoal({
        fixture,
        teamId: isHome ? fixture.homeTeamId : fixture.awayTeamId,
        newHomeScore: isHome ? val : fixture.homeScore,
        newAwayScore: isHome ? fixture.awayScore : val,
        goalsToAdd: newScore - oldScore
      });
    } else {
      onUpdateFixture(fixture.id, isHome ? val : fixture.homeScore, isHome ? fixture.awayScore : val);
    }
  };

  const getTeamName = (id: string) => {
    const team = teams.find(t => t.id === id);
    if (!team) return 'Unknown';
    return nameDisplay === 'team' ? team.name : (team.players?.[0]?.name || team.name);
  };
  
  const getPitchName = (id?: string) => {
    if (!id) return 'Unknown Pitch';
    const pitch = settings.pitches?.find(p => p.id === id);
    return pitch ? pitch.name : 'Unknown Pitch';
  };

  const getGroupColor = (groupId?: string) => {
    if (!groupId) return "bg-gray-500/20 text-gray-300";
    const index = groups.findIndex(g => g.id === groupId);
    if (index === -1) return "bg-gray-500/20 text-gray-300";
    
    const colors = [
      'bg-red-500/20 text-red-300',
      'bg-blue-500/20 text-blue-300',
      'bg-emerald-500/20 text-emerald-300',
      'bg-amber-500/20 text-amber-300',
      'bg-purple-500/20 text-purple-300',
      'bg-pink-500/20 text-pink-300',
      'bg-orange-500/20 text-orange-300',
      'bg-teal-500/20 text-teal-300',
    ];
    return colors[index % colors.length];
  };

  const matchdays = Array.from(new Set(fixtures.map(f => f.matchday))).sort((a, b) => a - b);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text('Tournament Fixtures', 14, 15);
    
    const tableData = fixtures.map(f => [
      `Matchday ${f.matchday}`,
      f.date,
      getTeamName(f.homeTeamId),
      f.isPlayed ? `${f.homeScore} - ${f.awayScore}` : 'vs',
      getTeamName(f.awayTeamId),
      getPitchName(f.pitchId)
    ]);

    autoTable(doc, {
      head: [['Matchday', 'Date', 'Home Team', 'Score', 'Away Team', 'Pitch']],
      body: tableData,
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 10, fillColor: [42, 45, 53], textColor: [255, 255, 255] },
      headStyles: { fillColor: [30, 136, 229] },
      alternateRowStyles: { fillColor: [35, 38, 45] }
    });

    doc.save('fixtures.pdf');
  };

  const handleExportCSV = () => {
    const csvData = fixtures.map(f => ({
      Matchday: f.matchday,
      Date: f.date,
      Time: f.time,
      HomeTeam: getTeamName(f.homeTeamId),
      AwayTeam: getTeamName(f.awayTeamId),
      HomeScore: f.homeScore ?? '',
      AwayScore: f.awayScore ?? '',
      Pitch: getPitchName(f.pitchId),
      Status: f.isPlayed ? 'Finished' : f.isStarted ? 'Ongoing' : 'Not Started'
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'fixtures.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useKeyboardShortcut('p', handleExportPDF);
  useKeyboardShortcut('c', handleExportCSV);
  useKeyboardShortcut('p', handleExportPDF);
  useKeyboardShortcut('c', handleExportCSV);

  if (teams.length < 2) {
    return (
      <div className="bg-[#151821] p-12 rounded-2xl border border-gray-800 text-center shadow-lg">
        <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-200 mb-2">Not enough teams</h3>
        <p className="text-gray-500">Add at least 2 teams to generate fixtures.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-center mb-8">
        <div className="flex bg-[#1A1D24]/80 backdrop-blur-md rounded-xl p-1 border border-gray-800/50 shadow-sm">
          <button 
            onClick={() => setStage('group')}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all duration-200",
              stage === 'group' ? "bg-indigo-600/20 text-indigo-400" : "text-gray-400 hover:text-gray-200"
            )}
          >
            <div className={cn("w-2 h-2 rounded-full", stage === 'group' ? "bg-indigo-400" : "border-2 border-gray-500")}></div> Group Stage
          </button>
          <button 
            onClick={() => setStage('all')}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all duration-200",
              stage === 'all' ? "bg-indigo-600/20 text-indigo-400" : "text-gray-400 hover:text-gray-200"
            )}
          >
            <div className={cn("w-2 h-2 rounded-full", stage === 'all' ? "bg-indigo-400" : "border-2 border-gray-500")}></div> All Matches
          </button>
          <button 
            onClick={() => setStage('knockout')}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all duration-200",
              stage === 'knockout' ? "bg-indigo-600/20 text-indigo-400" : "text-gray-400 hover:text-gray-200"
            )}
          >
            <div className={cn("w-2 h-2 rounded-full", stage === 'knockout' ? "bg-indigo-400" : "border-2 border-gray-500")}></div> Knockout Stage
          </button>
        </div>
      </div>

      {stage === 'group' || stage === 'all' ? (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">
              {stage === 'all' ? 'All Matches' : 'Group Matches'}
            </h2>
            <div className="flex gap-3">
              {stage === 'group' && (
                <>
                  <ModernSelect
                    className="w-40"
                    value={selectedGroup}
                    onChange={(value) => {
                      if (value === 'add-new') {
                        const name = window.prompt('Enter group name:');
                        if (name) {
                          onAddGroup(name);
                        }
                      } else {
                        setSelectedGroup(value);
                      }
                    }}
                    options={[
                      { value: 'all', label: 'All Groups' },
                      ...groups.map(g => ({ value: g.id, label: g.name })),
                      ...(isAdmin ? [{ value: 'add-new', label: '+ Add New Group' }] : [])
                    ]}
                  />
                  {selectedGroup !== 'all' && isAdmin && (
                    <ModernSelect
                      className="w-40"
                      value=""
                      onChange={(teamId) => {
                        if (teamId) {
                          const team = teams.find(t => t.id === teamId);
                          if (team) {
                            onEditTeam(teamId, { name: team.name, initial: team.initial, manager: team.manager, phone: team.phone, groupId: selectedGroup });
                          }
                        }
                      }}
                      options={[
                        { value: '', label: '+ Add Team' },
                        ...teams.filter(t => !t.groupId).map(t => ({ value: t.id, label: t.name }))
                      ]}
                    />
                  )}
                </>
              )}
              {isAdmin && (
                <>
                  <button onClick={() => {
                      if (fixtures.length > 0) {
                        setConfirmModal({
                          isOpen: true,
                          title: 'Regenerate Fixtures',
                          message: 'Are you sure you want to regenerate fixtures? All current results will be lost.',
                          confirmText: 'Regenerate',
                          confirmStyle: 'danger',
                          onConfirm: onGenerateFixtures
                        });
                      } else {
                        onGenerateFixtures();
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 text-sm shadow-md shadow-indigo-900/20"
                  >
                    <RefreshCw className="w-4 h-4" /> {fixtures.length > 0 ? 'Regenerate' : 'Generate'}
                  </button>
                  {fixtures.length > 0 && (
                    <button 
                      onClick={() => {
                        setConfirmModal({
                          isOpen: true,
                          title: 'Recalculate Schedule',
                          message: 'This will recalculate the schedule for all unplayed matches based on current settings. Manual overrides on unplayed days may be shifted. Continue?',
                          confirmText: 'Recalculate',
                          confirmStyle: 'warning',
                          onConfirm: onRescheduleFixtures
                        });
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600/10 border border-amber-500/30 text-amber-400 rounded-xl hover:bg-amber-600/20 transition-all duration-200 text-sm shadow-sm"
                      title="Recalculate schedule for unplayed matches"
                    >
                      <RefreshCw className="w-4 h-4" /> Recalculate
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {fixtures.length === 0 ? (
            <div className="bg-[#151821] p-12 rounded-2xl border border-gray-800 text-center shadow-lg">
              <p className="text-gray-500">No fixtures generated yet. Click the button above to create the schedule.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => {
              const { active, over } = e;
              if (!over) return;
              
              const activeFixture = fixtures.find(f => f.id === active.id);
              const overFixture = fixtures.find(f => f.id === over.id);
              
              if (activeFixture && overFixture && activeFixture.id !== overFixture.id) {
                onMoveFixture(activeFixture, overFixture.matchday, overFixture.order || 0);
              }
            }}>
              <div ref={fixturesRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 p-4 bg-[#0B0E14]">
                {matchdays.map((day, index) => {
                  let dayFixtures = fixtures.filter(f => f.matchday === day);
                  
                  if (stage === 'group' && selectedGroup !== 'all') {
                    dayFixtures = dayFixtures.filter(f => f.groupId === selectedGroup);
                  }

                  if (matchFilter === 'hide_past') {
                    dayFixtures = dayFixtures.filter(f => !f.isPlayed);
                  } else if (matchFilter === 'current') {
                    const firstUnplayedDay = matchdays.find(d => fixtures.filter(f => f.matchday === d).some(f => !f.isPlayed));
                    if (day !== firstUnplayedDay) return null;
                  }

                  if (dayFixtures.length === 0) return null;

                  const isFirst = index === 0;
                  const matchdayDate = dayFixtures[0]?.date;
                  
                  return (
                    <div key={day} className={cn(
                      "bg-[#151821]/80 backdrop-blur-md rounded-2xl p-5 shadow-lg",
                      isFirst ? "border-2 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.15)]" : "border border-gray-800/50"
                    )}>
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                          {isAdmin && (
                            <button 
                              onClick={() => {
                                setManagingMatchday(day);
                                setSelectedForDay(dayFixtures.map(f => f.id));
                              }}
                              className="text-gray-500 hover:text-indigo-400 transition-colors"
                              title="Manage Matches for this Day"
                            >
                              <List className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <h3 className="text-center font-semibold text-gray-200 flex items-center gap-2 text-lg">
                            Round {day.toString().padStart(2, '0')}
                          </h3>
                        </div>
                        {editingMatchday === day && isAdmin ? (
                          <div className="flex items-center gap-2">
                            <input 
                              id={`matchday-date-${day}`}
                              name={`matchday-date-${day}`}
                              type="date" 
                              className="bg-[#1A1D24] border border-gray-700 rounded px-2 py-1 text-xs text-white"
                              defaultValue={matchdayDate}
                              onBlur={(e) => {
                                onUpdateMatchdayDate(day, e.target.value);
                                setEditingMatchday(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  onUpdateMatchdayDate(day, e.currentTarget.value);
                                  setEditingMatchday(null);
                                }
                              }}
                              autoFocus
                            />
                          </div>
                        ) : (
                          isAdmin && (
                            <button 
                              onClick={() => setEditingMatchday(day)}
                              className="text-gray-500 hover:text-indigo-400 transition-colors"
                              title="Edit Matchday Date"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        <SortableContext items={dayFixtures.map(f => f.id)} strategy={verticalListSortingStrategy}>
                          {dayFixtures.map((fixture, fIndex) => (
                            <SortableFixtureRow 
                              key={fixture.id} 
                              fixture={fixture} 
                              teams={teams} 
                              settings={settings} 
                              isAdmin={isAdmin}
                              editingFixtureId={editingFixtureId} 
                              setEditingFixtureId={setEditingFixtureId} 
                              onUpdateFixture={onUpdateFixture} 
                              onUpdateFixtureDetails={onUpdateFixtureDetails} 
                              onToggleFixtureStarted={onToggleFixtureStarted} 
                              onToggleFixturePlayed={onToggleFixturePlayed} 
                              onAddMatchEvent={onAddMatchEvent} 
                              setSelectedFixtureForEvents={setSelectedFixtureForEvents} 
                              getTeamName={getTeamName} 
                              getPitchName={getPitchName} 
                              getGroupColor={getGroupColor} 
                              handleScoreChange={handleScoreChange} 
                            />
                          ))}
                        </SortableContext>
                      </div>
                    </div>
                  );
                })}
              </div>
            </DndContext>
          )}
        </>
      ) : (
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Knockout Stage</h2>
            
            <div className="flex items-center gap-4">
              {fixtures.filter(f => f.matchday >= 100).length > 0 && (
                <div className="flex items-center gap-3">
                  {isAdmin && (
                    <button
                      onClick={onGenerateKnockoutFixtures}
                      className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/20 text-indigo-400 rounded-lg hover:bg-indigo-600/30 transition-all text-sm font-medium border border-indigo-500/30"
                      title="Generate Next Knockout Round"
                    >
                      <Trophy className="w-4 h-4" /> Next Round
                    </button>
                  )}
                  <div className="flex bg-[#1A1D24]/80 backdrop-blur-md rounded-xl p-1 border border-gray-800/50 shadow-sm">
                    <button 
                      onClick={() => setViewMode('list')}
                      className={cn("p-2 rounded-lg transition-all duration-200", viewMode === 'list' ? "bg-indigo-600/20 text-indigo-400" : "text-gray-400 hover:text-gray-200")}
                      title="List View"
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setViewMode('bracket')}
                      className={cn("p-2 rounded-lg transition-all duration-200", viewMode === 'bracket' ? "bg-indigo-600/20 text-indigo-400" : "text-gray-400 hover:text-gray-200")}
                      title="Bracket View"
                    >
                      <GitMerge className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleExportPDF} className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1D24]/80 backdrop-blur-md border border-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-800 transition-all text-sm shadow-sm">
                      <Download className="w-4 h-4" /> PDF
                    </button>
                    <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1D24]/80 backdrop-blur-md border border-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-800 transition-all text-sm shadow-sm">
                      <Download className="w-4 h-4" /> CSV
                    </button>
                    <button onClick={() => exportAsImage(fixturesRef.current, 'knockout-fixtures')} className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1D24]/80 backdrop-blur-md border border-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-800 transition-all text-sm shadow-sm">
                      <ImageIcon className="w-4 h-4" /> Image
                    </button>
                  </div>
                </div>
              )}

              {fixtures.filter(f => f.matchday >= 100).length === 0 && isAdmin && (
              <button 
                onClick={() => {
                  if (fixtures.filter(f => f.matchday < 100 && !f.isPlayed).length > 0) {
                    setConfirmModal({
                      isOpen: true,
                      title: 'Generate Knockout Fixtures',
                      message: 'Some group stage matches are not played yet. Are you sure you want to generate knockout fixtures?',
                      confirmText: 'Generate',
                      confirmStyle: 'warning',
                      onConfirm: onGenerateKnockoutFixtures
                    });
                  } else {
                    onGenerateKnockoutFixtures();
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 text-sm shadow-md shadow-indigo-900/20"
              >
                <Trophy className="w-4 h-4" /> Generate Knockout Fixtures
              </button>
              )}
            </div>
          </div>

          {fixtures.filter(f => f.matchday >= 100).length === 0 ? (
            <div className="bg-[#151821]/80 backdrop-blur-md p-12 rounded-3xl border border-gray-800/50 text-center shadow-2xl flex flex-col items-center justify-center min-h-[400px]">
              <Trophy className="w-16 h-16 text-indigo-500 mb-6 opacity-80" />
              <h3 className="text-2xl font-bold text-white mb-3">Knockout Stage</h3>
              <p className="text-gray-400 max-w-md mx-auto mb-8 leading-relaxed">
                The knockout stage bracket will be generated automatically once the group stage is complete. Top teams will advance to the finals.
              </p>
            </div>
          ) : viewMode === 'bracket' ? (
            <div ref={fixturesRef} className="p-4 bg-[#0B0E14] rounded-3xl">
              <KnockoutBracket fixtures={fixtures} teams={teams} />
            </div>
          ) : (
            <div ref={fixturesRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 p-4 bg-[#0B0E14]">
              {matchdays.filter(d => d >= 100).map((day, index) => {
                const dayFixtures = fixtures.filter(f => f.matchday === day);
                const isFirst = index === 0;
                const matchdayDate = dayFixtures[0]?.date;
                
                return (
                  <div key={day} className={cn(
                    "bg-[#151821]/80 backdrop-blur-md rounded-2xl p-5 shadow-lg",
                    isFirst ? "border-2 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.15)]" : "border border-gray-800/50"
                  )}>
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-center font-semibold text-gray-200 flex items-center gap-2 text-lg">
                        {day === 101 ? 'Semi-Finals' : day === 102 ? 'Final' : `Round ${day - 100}`}
                      </h3>
                      {editingMatchday === day ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="date" 
                            className="bg-[#1A1D24] border border-gray-700 rounded px-2 py-1 text-xs text-white"
                            defaultValue={matchdayDate}
                            onBlur={(e) => {
                              onUpdateMatchdayDate(day, e.target.value);
                              setEditingMatchday(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                onUpdateMatchdayDate(day, e.currentTarget.value);
                                setEditingMatchday(null);
                              }
                            }}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <button 
                          onClick={() => setEditingMatchday(day)}
                          className="text-gray-500 hover:text-indigo-400 transition-colors"
                          title="Edit Matchday Date"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      {dayFixtures.map((fixture, fIndex) => {
                        const homeWon = fixture.isPlayed && fixture.homeScore !== null && fixture.awayScore !== null && fixture.homeScore > fixture.awayScore;
                        const awayWon = fixture.isPlayed && fixture.homeScore !== null && fixture.awayScore !== null && fixture.awayScore > fixture.homeScore;
                        
                        const pillColor = getGroupColor(fixture.groupId);

                        return (
                          <div key={fixture.id} className="rounded-xl border border-gray-800/50 bg-[#2A2D35]/50 backdrop-blur-sm transition-all duration-200 hover:border-gray-700">
                            <div className={cn("text-center text-xs py-1.5 font-medium flex justify-between px-2 rounded-t-xl", pillColor)}>
                              {editingFixtureId === fixture.id ? (
                                <div className="flex items-center gap-1 w-full">
                                  <select 
                                    className="bg-[#1A1D24] border border-gray-700 rounded px-1 py-0.5 text-[10px] text-white max-w-[80px]"
                                    defaultValue={fixture.pitchId}
                                    onChange={(e) => onUpdateFixtureDetails(fixture.id, { pitchId: e.target.value })}
                                  >
                                    {settings.pitches?.map(p => (
                                      <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                  </select>
                                  <input 
                                    id={`knockout-date-${fixture.id}`}
                                    name={`knockout-date-${fixture.id}`}
                                    type="date" 
                                    className="bg-[#1A1D24] border border-gray-700 rounded px-1 py-0.5 text-[10px] text-white w-[80px]"
                                    defaultValue={fixture.date}
                                    onChange={(e) => onUpdateFixtureDetails(fixture.id, { date: e.target.value })}
                                  />
                                  <button onClick={() => setEditingFixtureId(null)} className="text-emerald-400 hover:text-emerald-300 ml-auto">
                                    <Save className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-1">
                                    <span>{getPitchName(fixture.pitchId)} | {fixture.date}</span>
                                    <button onClick={() => setEditingFixtureId(fixture.id)} className="text-gray-500 hover:text-white ml-1">
                                      <Pencil className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={cn("px-1.5 rounded-md", fixture.isPlayed ? "bg-emerald-500/20 text-emerald-300" : fixture.isStarted ? "bg-amber-500/20 text-amber-300" : "bg-gray-500/20 text-gray-300")}>
                                      {fixture.isPlayed ? 'Finished' : fixture.isStarted ? 'Ongoing' : 'Not Started'}
                                    </span>
                                    <button 
                                      onClick={() => {
                                        if (fixture.isPlayed) {
                                          onToggleFixturePlayed(fixture.id);
                                        } else if (fixture.isStarted) {
                                          onToggleFixturePlayed(fixture.id);
                                        } else {
                                          onToggleFixtureStarted(fixture.id);
                                        }
                                      }}
                                      className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                                    >
                                      {fixture.isPlayed ? 'Reopen' : fixture.isStarted ? 'Finish' : 'Start'}
                                    </button>
                                    {(fixture.isStarted || fixture.isPlayed) && (
                                      <button
                                        onClick={() => setSelectedFixtureForEvents(fixture)}
                                        className="text-xs text-gray-400 hover:text-white flex items-center gap-1 bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700/50"
                                        title="Match Events"
                                      >
                                        <Activity className="w-3 h-3" /> Events
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                            
                            <div className={cn(
                              "flex justify-between items-center px-4 py-2 border-b border-gray-800/50 transition-colors",
                              homeWon ? "bg-emerald-500/10 text-emerald-400" : (fixture.isPlayed ? "bg-transparent text-gray-400" : "bg-transparent text-gray-200")
                            )}>
                              <span className="font-medium text-sm truncate pr-2">{getTeamName(fixture.homeTeamId)}</span>
                              <input
                                id={`knockout-homeScore-${fixture.id}`}
                                name={`knockout-homeScore-${fixture.id}`}
                                type="number"
                                min="0"
                                disabled={!fixture.isStarted || fixture.isPlayed || !isAdmin}
                                className="w-12 bg-black/20 text-right font-bold outline-none focus:bg-black/40 focus:ring-1 focus:ring-indigo-500/50 rounded-md px-2 py-1 transition-all disabled:opacity-50"
                                value={isNaN(fixture.homeScore as number) ? '' : (fixture.homeScore ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? null : parseInt(e.target.value);
                                  handleScoreChange(fixture, true, val);
                                }}
                                placeholder="-"
                              />
                            </div>
                            
                            <div className={cn(
                              "flex justify-between items-center px-4 py-2 transition-colors",
                              awayWon ? "bg-emerald-500/10 text-emerald-400" : (fixture.isPlayed ? "bg-transparent text-gray-400" : "bg-transparent text-gray-200")
                            )}>
                              <span className="font-medium text-sm truncate pr-2">{getTeamName(fixture.awayTeamId)}</span>
                              <input
                                id={`knockout-awayScore-${fixture.id}`}
                                name={`knockout-awayScore-${fixture.id}`}
                                type="number"
                                min="0"
                                disabled={!fixture.isStarted || fixture.isPlayed || !isAdmin}
                                className="w-12 bg-black/20 text-right font-bold outline-none focus:bg-black/40 focus:ring-1 focus:ring-indigo-500/50 rounded-md px-2 py-1 transition-all disabled:opacity-50"
                                value={fixture.awayScore ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? null : parseInt(e.target.value);
                                  handleScoreChange(fixture, false, val);
                                }}
                                placeholder="-"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      
      {selectedFixtureForEvents && (
        <MatchEvents
          fixture={selectedFixtureForEvents}
          homeTeam={teams.find(t => t.id === selectedFixtureForEvents.homeTeamId)!}
          awayTeam={teams.find(t => t.id === selectedFixtureForEvents.awayTeamId)!}
          onAddEvent={onAddMatchEvent}
          onRemoveEvent={onRemoveMatchEvent}
          onClose={() => setSelectedFixtureForEvents(null)}
        />
      )}

      {managingMatchday !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#151821] w-full max-w-2xl rounded-2xl border border-gray-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-[#1A1D24]">
              <div>
                <h3 className="text-xl font-bold text-white">Manage Round {managingMatchday}</h3>
                <p className="text-sm text-gray-400 mt-1">Select matches to be played on this day. Others will be rescheduled.</p>
              </div>
              <button onClick={() => setManagingMatchday(null)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Available Matches</h4>
                <div className="grid grid-cols-1 gap-2">
                  {fixtures
                    .filter(f => !f.isPlayed && (f.matchday >= managingMatchday))
                    .sort((a, b) => a.matchday - b.matchday)
                    .map(fixture => (
                      <label 
                        key={fixture.id} 
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-200",
                          selectedForDay.includes(fixture.id) 
                            ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-200" 
                            : "bg-[#1A1D24] border-gray-800 text-gray-400 hover:border-gray-700"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
                            checked={selectedForDay.includes(fixture.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedForDay([...selectedForDay, fixture.id]);
                              } else {
                                setSelectedForDay(selectedForDay.filter(id => id !== fixture.id));
                              }
                            }}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">
                              {getTeamName(fixture.homeTeamId)} vs {getTeamName(fixture.awayTeamId)}
                            </span>
                            <span className="text-[10px] opacity-60">
                              Currently scheduled for Round {fixture.matchday}
                            </span>
                          </div>
                        </div>
                        {fixture.groupId && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700">
                            {groups.find(g => g.id === fixture.groupId)?.name}
                          </span>
                        )}
                      </label>
                    ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-800 bg-[#1A1D24] flex justify-end gap-3">
              <button 
                onClick={() => setManagingMatchday(null)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  onReassignFixturesFromMatchday(managingMatchday, selectedForDay);
                  setManagingMatchday(null);
                }}
                disabled={selectedForDay.length === 0}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 text-sm font-semibold shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply & Reschedule
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#151821] w-full max-w-md rounded-2xl border border-gray-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-[#1A1D24]">
              <h3 className="text-xl font-bold text-white">Who scored?</h3>
              <button 
                onClick={() => {
                  onUpdateFixture(
                    pendingGoal.fixture.id, 
                    pendingGoal.newHomeScore,
                    pendingGoal.newAwayScore
                  );
                  setPendingGoal(null);
                }} 
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-1 gap-2">
                {(teams.find(t => t.id === pendingGoal.teamId)?.players || [])
                  .map(player => (
                    <button
                      key={player.id}
                      onClick={() => {
                        onUpdateFixture(
                          pendingGoal.fixture.id, 
                          pendingGoal.newHomeScore,
                          pendingGoal.newAwayScore
                        );
                        onAddMatchEvent(pendingGoal.fixture.id, {
                          fixtureId: pendingGoal.fixture.id,
                          type: 'goal',
                          playerId: player.id,
                          teamId: pendingGoal.teamId,
                          minute: 1
                        });
                        setPendingGoal(null);
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl border border-gray-800 bg-[#1A1D24] hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 font-bold text-sm">
                        {player.number}
                      </div>
                      <span className="font-medium text-gray-200">{player.name}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      onUpdateFixture(
                        pendingGoal.fixture.id, 
                        pendingGoal.newHomeScore,
                        pendingGoal.newAwayScore
                      );
                      setPendingGoal(null);
                    }}
                    className="flex items-center justify-center gap-3 p-3 mt-4 rounded-xl border border-dashed border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all"
                  >
                    Skip / Own Goal
                  </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmStyle={confirmModal.confirmStyle}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
