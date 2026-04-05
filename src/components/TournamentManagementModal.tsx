import React, { useState, useEffect, useMemo } from 'react';
import { Settings, StageSettings, Team, Group } from '../types';
import { X, Save, Trophy, Calendar, Clock, Edit2, RotateCcw, Users, Share2, AlertCircle } from 'lucide-react';
import { cn } from '../utils';
import { publishTournament } from '../services/tournamentService';
import { ConfirmModal } from './ConfirmModal';

interface TournamentManagementModalProps {
  settings: Settings;
  teams?: Team[];
  groups?: Group[];
  tournamentId: string;
  userId: string;
  onSave: (settings: Settings) => void;
  onPublish?: () => Promise<void>;
  isPublishing?: boolean;
  onFillTeamSheets?: () => void;
  onClose: () => void;
}

export function TournamentManagementModal({ 
  settings, 
  teams = [], 
  groups = [], 
  tournamentId, 
  userId, 
  onSave, 
  onPublish,
  isPublishing,
  onFillTeamSheets, 
  onClose 
}: TournamentManagementModalProps) {
  const [tournamentName, setTournamentName] = useState(settings.tournamentName || 'Proball');
  // ... (rest of the state)

  const handlePublish = async () => {
    if (onPublish) {
      try {
        await onPublish();
        alert('Tournament published successfully!');
      } catch (err) {
        console.error('Publish failed', err);
        alert('Failed to publish tournament.');
      }
    }
  };
  const [numberOfTeams, setNumberOfTeams] = useState(settings.numberOfTeams || teams.length || 8);
  const [numberOfPitches, setNumberOfPitches] = useState(settings.numberOfPitches || 1);
  const [pitches, setPitches] = useState(settings.pitches || [{ id: 'pitch-1', name: 'Pitch 1' }]);
  const [matchdaySettings, setMatchdaySettings] = useState(settings.matchdaySettings || { 
    numberOfMatchdays: 0, 
    customMatchdays: [],
    matchesPerDay: 0,
    restingDays: 0
  });
  const [playerSettings, setPlayerSettings] = useState(settings.playerSettings || {
    maxPlayersPerTeam: 15,
    activePlayersPerSide: 7,
    maxSubs: 5
  });
  const [activeStage, setActiveStage] = useState<'group' | 'knockout'>(
    (localStorage.getItem('mgmt_active_stage') as 'group' | 'knockout') || 'group'
  );
  const [stageSettings, setStageSettings] = useState<{ group: StageSettings; knockout: StageSettings }>({
    group: settings.groupStage || { numberOfWinners: 1, numberOfLegs: 1 },
    knockout: settings.knockoutStage || { numberOfWinners: 1, numberOfLegs: 2 },
  });
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [isManualMatchdays, setIsManualMatchdays] = useState(matchdaySettings.isManual ?? matchdaySettings.numberOfMatchdays > 0);
  const [showFillConfirm, setShowFillConfirm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  useEffect(() => {
    localStorage.setItem('mgmt_active_stage', activeStage);
  }, [activeStage]);

  const hasChanges = useMemo(() => {
    return (
      tournamentName !== (settings.tournamentName || 'Proball') ||
      numberOfTeams !== (settings.numberOfTeams || teams.length || 8) ||
      numberOfPitches !== (settings.numberOfPitches || 1) ||
      JSON.stringify(pitches) !== JSON.stringify(settings.pitches || [{ id: 'pitch-1', name: 'Pitch 1' }]) ||
      JSON.stringify(matchdaySettings) !== JSON.stringify(settings.matchdaySettings || { numberOfMatchdays: 0, customMatchdays: [], matchesPerDay: 0, restingDays: 0 }) ||
      JSON.stringify(playerSettings) !== JSON.stringify(settings.playerSettings || { maxPlayersPerTeam: 15, activePlayersPerSide: 7, maxSubs: 5 }) ||
      JSON.stringify(stageSettings.group) !== JSON.stringify(settings.groupStage || { numberOfWinners: 1, numberOfLegs: 1 }) ||
      JSON.stringify(stageSettings.knockout) !== JSON.stringify(settings.knockoutStage || { numberOfWinners: 1, numberOfLegs: 2 })
    );
  }, [tournamentName, numberOfTeams, numberOfPitches, pitches, matchdaySettings, playerSettings, stageSettings, settings]);

  const handleClose = () => {
    if (hasChanges) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };

  // Calculate recommended matchdays based on teams, legs, matchesPerDay and restingDays
  const calculatedMatchdays = React.useMemo(() => {
    if (!numberOfTeams || numberOfTeams < 2) return 0;

    let totalGroupMatches = 0;
    const groupCount = groups.length || 1;
    if (groups.length > 0) {
      groups.forEach(group => {
        const actualCount = teams.filter(t => t.groupId === group.id).length;
        const count = Math.max(actualCount, Math.ceil(numberOfTeams / groups.length));
        totalGroupMatches += (count * (count - 1) / 2) * stageSettings.group.numberOfLegs;
      });
    } else {
      totalGroupMatches = (numberOfTeams * (numberOfTeams - 1) / 2) * stageSettings.group.numberOfLegs;
    }

    // Simulate scheduling to find required group stage days
    let remainingMatches = totalGroupMatches;
    let day = 0;
    let activeRestingDays = matchdaySettings.restingDays || 0;
    let activeMatchesPerDay = matchdaySettings.matchesPerDay || 0;
    let isMatchesPerDayAuto = (matchdaySettings.matchesPerDay || 0) === 0;
    const maxPossibleMatchesPerDay = Math.floor(numberOfTeams / 2);
    
    // Track when each team last played in simulation
    const teamLastPlayed = new Array(numberOfTeams).fill(-100);
    
    // Safety limit
    while (remainingMatches > 0 && day < 1000) {
      day++;
      const custom = (matchdaySettings.customMatchdays || []).find(m => m.matchday === day);
      
      if (custom) {
        if (custom.restingDays !== undefined && custom.restingDays !== null) {
          activeRestingDays = custom.restingDays;
        }
        if (custom.matchesPerDay !== undefined && custom.matchesPerDay !== null) {
          activeMatchesPerDay = custom.matchesPerDay;
          isMatchesPerDayAuto = false;
        }
      }
      
      const matchLimit = isMatchesPerDayAuto ? maxPossibleMatchesPerDay : activeMatchesPerDay;
      let matchesToday = 0;
      let teamsPlayedToday = 0;
      
      // Count how many teams can play today based on restingDays
      const availableTeams = teamLastPlayed.filter(lastDay => (day - lastDay) > activeRestingDays).length;
      const maxTeamsToday = Math.floor(availableTeams / 2) * 2;
      
      matchesToday = Math.min(matchLimit, maxTeamsToday / 2);
      matchesToday = Math.min(matchesToday, remainingMatches);
      
      if (matchesToday > 0) {
        remainingMatches -= matchesToday;
        // Update last played for the teams that played
        let updated = 0;
        for (let i = 0; i < teamLastPlayed.length && updated < matchesToday * 2; i++) {
          if ((day - teamLastPlayed[i]) > activeRestingDays) {
            teamLastPlayed[i] = day;
            updated++;
          }
        }
      }
    }

    const groupStageDays = day;

    // Calculate Knockout Stage Days
    const totalQualifiers = groupCount * stageSettings.group.numberOfWinners;
    if (totalQualifiers >= 2) {
      const knockoutRounds = Math.ceil(Math.log2(totalQualifiers));
      const knockoutDays = knockoutRounds * (stageSettings.knockout.numberOfLegs || 1);
      const total = groupStageDays + knockoutDays;
      return isNaN(total) || !isFinite(total) ? groupStageDays : total;
    }
    
    return isNaN(groupStageDays) || !isFinite(groupStageDays) ? 0 : groupStageDays;
  }, [numberOfTeams, groups, teams, stageSettings.group.numberOfLegs, stageSettings.group.numberOfWinners, stageSettings.knockout.numberOfLegs, matchdaySettings.matchesPerDay, matchdaySettings.restingDays, matchdaySettings.customMatchdays]);

  const knockoutMatchdays = useMemo(() => {
    const groupCount = groups.length || 1;
    const totalQualifiers = groupCount * stageSettings.group.numberOfWinners;
    if (totalQualifiers < 2) return 0;
    const knockoutRounds = Math.ceil(Math.log2(totalQualifiers));
    const total = knockoutRounds * (stageSettings.knockout.numberOfLegs || 1);
    return isNaN(total) || !isFinite(total) ? 0 : total;
  }, [groups.length, stageSettings.group.numberOfWinners, stageSettings.knockout.numberOfLegs]);

  useEffect(() => {
    setMatchdaySettings(prev => {
      if (prev.numberOfMatchdays === calculatedMatchdays) return prev;
      return { ...prev, numberOfMatchdays: calculatedMatchdays };
    });
  }, [calculatedMatchdays]);

  const getInheritedDate = (dayIndex: number) => {
    try {
      let currentDate = new Date(settings.startDate || new Date().toISOString().split('T')[0]);
      let currentResting = matchdaySettings.restingDays || 0;
      
      for (let i = 1; i <= dayIndex; i++) {
        const custom = (matchdaySettings.customMatchdays || []).find(m => m.matchday === i);
        if (custom?.date) {
          currentDate = new Date(custom.date);
        }
        if (custom?.restingDays !== undefined && custom?.restingDays !== null) {
          currentResting = custom.restingDays;
        }
        
        // Move to next day based on current resting days
        currentDate.setDate(currentDate.getDate() + (currentResting + 1));
      }
      
      return currentDate.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  const getInheritedTime = (dayIndex: number) => {
    let currentTime = settings.startTime || '09:00';
    for (let i = 1; i <= dayIndex; i++) {
      const custom = (matchdaySettings.customMatchdays || []).find(m => m.matchday === i);
      if (custom?.time) {
        currentTime = custom.time;
      }
    }
    return currentTime;
  };

  const getInheritedMatchesPerDay = (dayIndex: number) => {
    let current = matchdaySettings.matchesPerDay || 0;
    for (let i = 1; i <= dayIndex; i++) {
      const custom = (matchdaySettings.customMatchdays || []).find(m => m.matchday === i);
      if (custom?.matchesPerDay !== undefined && custom?.matchesPerDay !== null) {
        current = custom.matchesPerDay;
      }
    }
    return current;
  };

  const getInheritedRestingDays = (dayIndex: number) => {
    let current = matchdaySettings.restingDays || 0;
    for (let i = 1; i <= dayIndex; i++) {
      const custom = (matchdaySettings.customMatchdays || []).find(m => m.matchday === i);
      if (custom?.restingDays !== undefined && custom?.restingDays !== null) {
        current = custom.restingDays;
      }
    }
    return current;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ 
      ...settings, 
      tournamentName, 
      numberOfTeams, 
      numberOfPitches,
      pitches,
      matchdaySettings: {
        ...matchdaySettings,
        isManual: isManualMatchdays,
        numberOfMatchdays: isManualMatchdays ? matchdaySettings.numberOfMatchdays : calculatedMatchdays
      },
      playerSettings,
      groupStage: stageSettings.group, 
      knockoutStage: stageSettings.knockout 
    });
    onClose();
  };

  const updatePitch = (index: number, name: string) => {
    const newPitches = [...pitches];
    newPitches[index] = { ...newPitches[index], name };
    setPitches(newPitches);
  };

  const updateNumberOfPitches = (count: number) => {
    setNumberOfPitches(count);
    const newPitches = Array.from({ length: count }, (_, i) => ({
      id: pitches[i]?.id || `pitch-${i + 1}`,
      name: pitches[i]?.name || `Pitch ${i + 1}`
    }));
    setPitches(newPitches);
  };

  const updateStageSetting = <K extends keyof StageSettings>(key: K, value: StageSettings[K]) => {
    setStageSettings(prev => ({
      ...prev,
      [activeStage]: { ...prev[activeStage], [key]: value }
    }));
  };

  const updateCustomMatchday = (matchday: number, field: 'date' | 'time' | 'matchesPerDay' | 'restingDays', value: string | number | undefined) => {
    const currentCustom = [...(matchdaySettings.customMatchdays || [])];
    const index = currentCustom.findIndex(m => m.matchday === matchday);
    
    // Ensure we don't pass undefined to Firestore
    const safeValue = value === undefined ? null : value;
    
    if (index >= 0) {
      currentCustom[index] = { ...currentCustom[index], [field]: safeValue as any };
    } else {
      currentCustom.push({ 
        matchday, 
        date: field === 'date' ? value as string : '', 
        time: field === 'time' ? value as string : null as any,
        matchesPerDay: field === 'matchesPerDay' ? value as number : null as any,
        restingDays: field === 'restingDays' ? value as number : null as any
      });
    }
    
    setMatchdaySettings({ ...matchdaySettings, customMatchdays: currentCustom });
  };

  const getCustomMatchdayValue = (matchday: number, field: 'date' | 'time' | 'matchesPerDay' | 'restingDays') => {
    const custom = (matchdaySettings.customMatchdays || []).find(m => m.matchday === matchday);
    if (!custom) return field === 'date' ? '' : null;
    const val = custom[field];
    return val === undefined ? null : val;
  };

  // Determine how many matchdays to show in the editor
  const displayMatchdays = isManualMatchdays && matchdaySettings.numberOfMatchdays > 0 
    ? matchdaySettings.numberOfMatchdays 
    : calculatedMatchdays;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#151821]/90 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] border border-gray-800/50">
        <div className="flex justify-between items-center p-4 border-b border-gray-800/50 flex-shrink-0">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Trophy className="w-4 h-4 text-indigo-500" /> Tournament Management
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-200 transition-colors p-1.5 hover:bg-gray-800/50 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 rounded-lg transition-all text-xs font-medium text-indigo-400 hover:text-indigo-300"
          >
            <Share2 className="w-3.5 h-3.5" /> {isPublishing ? 'Publishing...' : 'Publish Tournament'}
          </button>
          
          {isEditingSchedule ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-400" /> Edit Matchday Schedule
                </h3>
                <button 
                  type="button" 
                  onClick={() => setIsEditingSchedule(false)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                >
                  Back to Settings
                </button>
              </div>
              
              <div className="space-y-3">
                {Array.from({ length: displayMatchdays }, (_, i) => i + 1).map(day => (
                  <div key={day} className="bg-[#1A1D24]/50 p-3 rounded-lg border border-gray-700/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-300">Matchday {day}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">
                          Date {getCustomMatchdayValue(day, 'date') === '' ? '(Inherited)' : ''}
                        </label>
                        <input
                          type="date"
                          className={cn(
                            "w-full bg-[#0B0E14] border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition-colors",
                            getCustomMatchdayValue(day, 'date') === '' 
                              ? "border-gray-700/30 text-gray-500 italic" 
                              : "border-gray-700/50 text-white"
                          )}
                          value={(getCustomMatchdayValue(day, 'date') as string) || getInheritedDate(day - 1)}
                          onChange={(e) => updateCustomMatchday(day, 'date', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">
                          Time {getCustomMatchdayValue(day, 'time') === null ? '(Inherited)' : ''}
                        </label>
                        <input
                          type="time"
                          className={cn(
                            "w-full bg-[#0B0E14] border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition-colors",
                            getCustomMatchdayValue(day, 'time') === null 
                              ? "border-gray-700/30 text-gray-500 italic" 
                              : "border-gray-700/50 text-white"
                          )}
                          value={(getCustomMatchdayValue(day, 'time') as string) || getInheritedTime(day - 1)}
                          onChange={(e) => updateCustomMatchday(day, 'time', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">
                          Matches per Day {getCustomMatchdayValue(day, 'matchesPerDay') === null ? '(Inherited)' : ''}
                        </label>
                        <input
                          type="number"
                          min="0"
                          className={cn(
                            "w-full bg-[#0B0E14] border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition-colors",
                            getCustomMatchdayValue(day, 'matchesPerDay') === null 
                              ? "border-gray-700/30 text-gray-500 italic" 
                              : "border-gray-700/50 text-white"
                          )}
                          value={getCustomMatchdayValue(day, 'matchesPerDay') ?? getInheritedMatchesPerDay(day - 1) ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : parseInt(e.target.value);
                            updateCustomMatchday(day, 'matchesPerDay', isNaN(val as number) ? undefined : (val as number));
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">
                          Resting Days {getCustomMatchdayValue(day, 'restingDays') === null ? '(Inherited)' : ''}
                        </label>
                        <input
                          type="number"
                          min="0"
                          className={cn(
                            "w-full bg-[#0B0E14] border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition-colors",
                            getCustomMatchdayValue(day, 'restingDays') === null 
                              ? "border-gray-700/30 text-gray-500 italic" 
                              : "border-gray-700/50 text-white"
                          )}
                          value={getCustomMatchdayValue(day, 'restingDays') ?? getInheritedRestingDays(day - 1) ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : parseInt(e.target.value);
                            updateCustomMatchday(day, 'restingDays', isNaN(val as number) ? undefined : (val as number));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="tournament-name" className="block text-xs font-medium text-gray-400 mb-1">Tournament Name</label>
                <input
                  type="text"
                  id="tournament-name"
                  name="tournamentName"
                  className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  placeholder="Proball"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="num-teams" className="block text-xs font-medium text-gray-400 mb-1">Teams</label>
                  <input
                    type="number"
                    id="num-teams"
                    name="numTeams"
                    min="2"
                    className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                    value={numberOfTeams}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setNumberOfTeams(isNaN(val) ? 0 : val);
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="num-pitches" className="block text-xs font-medium text-gray-400 mb-1">Pitches</label>
                  <input
                    type="number"
                    id="num-pitches"
                    name="numPitches"
                    min="1"
                    className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                    value={numberOfPitches}
                    onChange={(e) => updateNumberOfPitches(parseInt(e.target.value))}
                  />
                </div>
              </div>

              {pitches.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-400">Pitch Names</label>
                  {pitches.map((pitch, i) => (
                    <input
                      key={pitch.id}
                      type="text"
                      id={`pitch-name-${i}`}
                      name={`pitchName${i}`}
                      className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                      value={pitch.name}
                      onChange={(e) => updatePitch(i, e.target.value)}
                      placeholder={`Pitch ${i + 1}`}
                    />
                  ))}
                </div>
              )}

              <div className="border-t border-gray-800/50 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-300">Matchday Settings</h3>
                  <button 
                    type="button"
                    onClick={() => setIsManualMatchdays(!isManualMatchdays)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1"
                  >
                    {isManualMatchdays ? <RotateCcw className="w-3 h-3" /> : <Edit2 className="w-3 h-3" />}
                    {isManualMatchdays ? 'Switch to Auto' : 'Edit Manually'}
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div className="bg-[#1A1D24]/30 p-3 rounded-lg border border-gray-700/30">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-medium text-gray-400">Number of Matchdays</label>
                      {!isManualMatchdays && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">Auto-calculated</span>
                      )}
                    </div>
                    
                    {isManualMatchdays ? (
                      <input
                        type="number"
                        id="manual-matchdays"
                        name="manualMatchdays"
                        min="1"
                        className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                        value={matchdaySettings.numberOfMatchdays || 0}
                        onChange={(e) => setMatchdaySettings({ ...matchdaySettings, numberOfMatchdays: parseInt(e.target.value) || 0 })}
                      />
                    ) : (
                      <div className="w-full bg-[#1A1D24]/20 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-400">
                        {calculatedMatchdays || 0} matchdays
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label htmlFor="matches-per-day" className="block text-[10px] text-gray-500 mb-1">Matches per Day</label>
                        <input
                          type="number"
                          id="matches-per-day"
                          name="matchesPerDay"
                          min="0"
                          placeholder="Auto"
                          className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-lg px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                          value={matchdaySettings.matchesPerDay || ''}
                          onChange={(e) => setMatchdaySettings({ ...matchdaySettings, matchesPerDay: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <label htmlFor="resting-days" className="block text-[10px] text-gray-500 mb-1">Resting Days</label>
                        <input
                          type="number"
                          id="resting-days"
                          name="restingDays"
                          min="0"
                          className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-lg px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                          value={matchdaySettings.restingDays || 0}
                          onChange={(e) => setMatchdaySettings({ ...matchdaySettings, restingDays: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    
                    <p className="text-[10px] text-gray-500 mt-2">
                      {isManualMatchdays 
                        ? "Manually set the total number of matchdays." 
                        : `Automatically calculated based on ${numberOfTeams} teams and ${stageSettings.group.numberOfLegs} leg(s).`}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsEditingSchedule(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#1A1D24]/50 hover:bg-[#1A1D24] border border-gray-700/50 rounded-lg transition-all text-xs font-medium text-gray-300 hover:text-white"
                  >
                    <Calendar className="w-3.5 h-3.5" /> Edit Matchday Schedule
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-800/50 pt-4">
                <div className="flex bg-[#1A1D24]/80 backdrop-blur-md rounded-lg p-0.5 border border-gray-800/50 shadow-sm mb-4">
                  <button
                    type="button"
                    onClick={() => setActiveStage('group')}
                    className={cn(
                      "flex-1 px-3 py-1.5 rounded-md font-medium transition-all duration-200 text-xs",
                      activeStage === 'group' ? "bg-indigo-600/20 text-indigo-400" : "text-gray-400 hover:text-gray-200"
                    )}
                  >
                    Group Stage
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStage('knockout')}
                    className={cn(
                      "flex-1 px-3 py-1.5 rounded-md font-medium transition-all duration-200 text-xs",
                      activeStage === 'knockout' ? "bg-indigo-600/20 text-indigo-400" : "text-gray-400 hover:text-gray-200"
                    )}
                  >
                    Knockout Stage
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="winners-count" className="block text-xs font-medium text-gray-400 mb-1">Number of Winners</label>
                      <input
                        type="number"
                        id="winners-count"
                        name="winnersCount"
                        min="1"
                        className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                        value={stageSettings[activeStage].numberOfWinners || 0}
                        onChange={(e) => updateStageSetting('numberOfWinners', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Knockout Matchdays</label>
                      <div className="w-full bg-[#1A1D24]/20 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-400">
                        {knockoutMatchdays || 0} days
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Number of Legs</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateStageSetting('numberOfLegs', 1)}
                        className={cn(
                          "flex-1 px-3 py-1.5 rounded-lg border transition-all duration-200 font-medium text-xs",
                          stageSettings[activeStage].numberOfLegs === 1 ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/50" : "bg-[#1A1D24]/80 text-gray-300 border-gray-700/50 hover:bg-gray-800"
                        )}
                      >
                        1 Leg
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStageSetting('numberOfLegs', 2)}
                        className={cn(
                          "flex-1 px-3 py-1.5 rounded-lg border transition-all duration-200 font-medium text-xs",
                          stageSettings[activeStage].numberOfLegs === 2 ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/50" : "bg-[#1A1D24]/80 text-gray-300 border-gray-700/50 hover:bg-gray-800"
                        )}
                      >
                        2 Legs
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-800/50 pt-4">
                <h3 className="text-xs font-semibold text-gray-300 mb-3">Player Settings</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="max-players" className="block text-[10px] text-gray-500 mb-1">Max Players per Team</label>
                      <input
                        type="number"
                        id="max-players"
                        name="maxPlayers"
                        min="1"
                        className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                        value={playerSettings.maxPlayersPerTeam}
                        onChange={(e) => setPlayerSettings({ ...playerSettings, maxPlayersPerTeam: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label htmlFor="active-players" className="block text-[10px] text-gray-500 mb-1">Active Players per Side</label>
                      <input
                        type="number"
                        id="active-players"
                        name="activePlayers"
                        min="1"
                        className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                        value={playerSettings.activePlayersPerSide}
                        onChange={(e) => setPlayerSettings({ ...playerSettings, activePlayersPerSide: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="max-subs" className="block text-[10px] text-gray-500 mb-1">Max Substitutes</label>
                    <input
                      type="number"
                      id="max-subs"
                      name="maxSubs"
                      min="0"
                      className="w-full bg-[#1A1D24]/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner"
                      value={playerSettings.maxSubs}
                      onChange={(e) => setPlayerSettings({ ...playerSettings, maxSubs: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  
                  {onFillTeamSheets && teams.length > 0 && (
                    <div className="space-y-2">
                      {!showFillConfirm ? (
                        <button
                          type="button"
                          onClick={() => setShowFillConfirm(true)}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 rounded-lg transition-all text-xs font-medium text-emerald-400 hover:text-emerald-300"
                        >
                          <Users className="w-3.5 h-3.5" /> Fill All Team Sheets with Test Data
                        </button>
                      ) : (
                        <div className="p-3 bg-emerald-600/10 border border-emerald-500/30 rounded-lg space-y-2">
                          <p className="text-[10px] text-emerald-300 font-medium">Overwrite all team sheets with test data?</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                onFillTeamSheets();
                                setShowFillConfirm(false);
                              }}
                              className="flex-1 px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold hover:bg-emerald-700"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowFillConfirm(false)}
                              className="flex-1 px-2 py-1 bg-gray-800 text-gray-300 rounded text-[10px] font-bold hover:bg-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="pt-2 flex gap-2 border-t border-gray-800/50 mt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-3 py-2 text-xs text-gray-300 bg-[#1A1D24]/80 hover:bg-gray-800 border border-gray-700/50 rounded-lg transition-all duration-200 font-medium shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all duration-200 font-medium text-xs shadow-md shadow-indigo-900/20"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
        </form>

        <ConfirmModal
          isOpen={showExitConfirm}
          title="Unsaved Changes"
          message="You have unsaved changes in your tournament settings. Are you sure you want to exit without saving?"
          confirmText="Exit Without Saving"
          confirmStyle="danger"
          onConfirm={onClose}
          onCancel={() => setShowExitConfirm(false)}
        />
      </div>
    </div>
  );
}
