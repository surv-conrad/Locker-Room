/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef } from 'react';
import { useTournament } from './hooks/useTournament';
import { Teams } from './components/Teams';
import { Fixtures } from './components/Fixtures';
import { LeagueTable } from './components/LeagueTable';
import { PlayerStats } from './components/PlayerStats';
import { UserManual } from './components/UserManual';
import { SettingsModal } from './components/SettingsModal';
import { ShareModal } from './components/ShareModal';
import { useExport } from './contexts/ExportContext';
import { TournamentManagementModal } from './components/TournamentManagementModal';
import { DashboardModal } from './components/DashboardModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ComingSoonModal } from './components/ComingSoonModal';
import { AdminPanel } from './components/AdminPanel';
import { Settings as SettingsIcon, Users, CalendarDays, Trophy, Code2, ExternalLink, Sun, BarChart2, LogIn, LogOut, Loader2, Book, Shield, Download, Image as ImageIcon } from 'lucide-react';
import { cn } from './utils';
import { Settings } from './types';
import { signInWithGoogle, logout } from './firebase';

type Tab = 'table' | 'teams' | 'fixtures' | 'stats' | 'manual';

export default function App() {
  const queryParams = new URLSearchParams(window.location.search);
  const publicTournamentId = queryParams.get('tournamentId') || undefined;
  
  const {
    teams,
    groups,
    fixtures,
    settings,
    allUsers,
    updateUserRole,
    setSettings,
    addTeam,
    editTeam,
    deleteTeam,
    addGroup,
    deleteGroup,
    generateFixtures,
    updateFixture,
    updateFixtureDetails,
    updateMatchdayDate,
    toggleFixtureStarted,
    toggleFixturePlayed,
    getLeagueTable,
    generateKnockoutFixtures,
    generateTestData,
    addMatchEvent,
    removeMatchEvent,
    getPlayerStats,
    reassignFixturesFromMatchday,
    rescheduleFixtures,
    fillAllTeamSheetsWithTestData,
    reorderTeams,
    reorderFixtures,
    moveFixture,
    toggleRole,
    loading,
    userId,
    isAdmin,
    isSuperAdmin,
    userRole
  } = useTournament(publicTournamentId);

  const { exportOptions } = useExport();
  const [activeTab, setActiveTab] = useState<Tab>('fixtures');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isTournamentManagementOpen, setIsTournamentManagementOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [comingSoonFeature, setComingSoonFeature] = useState<string | null>(null);
  const [matchFilter, setMatchFilter] = useState<'all' | 'hide_past' | 'current'>('all');
  const [nameDisplay, setNameDisplay] = useState<'team' | 'player'>('team');

  const playerStatsExportRef = useRef<HTMLDivElement>(null);

  const handleExportLeagueTablePDF = () => {
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(({ default: autoTable }) => {
        const doc = new jsPDF();
        doc.text('League Table', 14, 15);
        const tableData = getLeagueTable().map((row, index) => [
          index + 1, row.teamName, row.played, row.won, row.drawn, row.lost, row.goalsFor, row.goalsAgainst, row.goalDifference, row.points
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
      });
    });
  };

  const handleExportLeagueTableCSV = () => {
    import('papaparse').then(({ default: Papa }) => {
      const headers = ['Pos', 'Team', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'];
      const rows = getLeagueTable().map((row, index) => [
        index + 1, row.teamName, row.played, row.won, row.drawn, row.lost, row.goalsFor, row.goalsAgainst, row.goalDifference, row.points
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
    });
  };

  const handleExportFixturesPDF = () => {
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(({ default: autoTable }) => {
        const doc = new jsPDF();
        doc.text('Tournament Fixtures', 14, 15);
        const getTeamName = (id: string) => teams.find(t => t.id === id)?.name || 'Unknown Team';
        const getPitchName = (id?: string) => settings.pitches?.find(p => p.id === id)?.name || 'TBD';
        const tableData = fixtures.map(f => [
          `Matchday ${f.matchday}`, f.date, getTeamName(f.homeTeamId), f.isPlayed ? `${f.homeScore} - ${f.awayScore}` : 'vs', getTeamName(f.awayTeamId), getPitchName(f.pitchId)
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
      });
    });
  };

  const handleExportFixturesCSV = () => {
    import('papaparse').then(({ default: Papa }) => {
      const getTeamName = (id: string) => teams.find(t => t.id === id)?.name || 'Unknown Team';
      const getPitchName = (id?: string) => settings.pitches?.find(p => p.id === id)?.name || 'TBD';
      const csvData = fixtures.map(f => ({
        Matchday: f.matchday, Date: f.date, Time: f.time, HomeTeam: getTeamName(f.homeTeamId), AwayTeam: getTeamName(f.awayTeamId), HomeScore: f.homeScore ?? '', AwayScore: f.awayScore ?? '', Pitch: getPitchName(f.pitchId), Status: f.isPlayed ? 'Finished' : f.isStarted ? 'Ongoing' : 'Not Started'
      }));
      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "fixtures.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  const handleExportPlayerStatsImage = () => {
    import('./utils/exportImage').then(({ exportAsImage }) => {
      if (playerStatsExportRef.current) {
        exportAsImage(playerStatsExportRef.current, 'player-stats');
      }
    });
  };

  const handleExportAllTeamsPDF = () => {
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(({ default: autoTable }) => {
        const doc = new jsPDF();
        teams.forEach((team, index) => {
          if (index > 0) doc.addPage();
          doc.setFontSize(20);
          doc.text(`${team.name} - Team Sheet`, 14, 20);
          
          const activePlayers = team.players.filter(p => p.isActive);
          const benchPlayers = team.players.filter(p => !p.isActive);
          
          autoTable(doc, {
            head: [['#', 'Name', 'Position', 'Status']],
            body: [
              ...activePlayers.map(p => [p.number, p.name, p.position, 'Active']),
              ...benchPlayers.map(p => [p.number, p.name, p.position, 'Bench'])
            ],
            startY: 30,
            theme: 'grid',
            styles: { fontSize: 10, fillColor: [42, 45, 53], textColor: [255, 255, 255] },
            headStyles: { fillColor: [30, 136, 229] },
            alternateRowStyles: { fillColor: [35, 38, 45] }
          });
        });
        doc.save('all-team-sheets.pdf');
      });
    });
  };

  const handleExportAllTeamsCSV = () => {
    import('papaparse').then(({ default: Papa }) => {
      const csvData = teams.flatMap(team => 
        team.players.map(p => ({
          Team: team.name,
          Number: p.number,
          Name: p.name,
          Position: p.position,
          Status: p.isActive ? 'Active' : 'Bench'
        }))
      );
      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "all-teams.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  const globalExportOptions = [
    { label: 'Export League Table (PDF)', icon: <Download className="w-4 h-4" />, onClick: handleExportLeagueTablePDF },
    { label: 'Export League Table (CSV)', icon: <Download className="w-4 h-4" />, onClick: handleExportLeagueTableCSV },
    { label: 'Export Fixtures (PDF)', icon: <Download className="w-4 h-4" />, onClick: handleExportFixturesPDF },
    { label: 'Export Fixtures (CSV)', icon: <Download className="w-4 h-4" />, onClick: handleExportFixturesCSV },
    { label: 'Export Player Stats (Image)', icon: <ImageIcon className="w-4 h-4" />, onClick: handleExportPlayerStatsImage },
    { label: 'Export All Team Sheets (PDF)', icon: <Download className="w-4 h-4" />, onClick: handleExportAllTeamsPDF },
    { label: 'Export All Teams (CSV)', icon: <Download className="w-4 h-4" />, onClick: handleExportAllTeamsCSV },
  ];

  const handleNotImplemented = (feature: string) => {
    setComingSoonFeature(feature);
  };

  const tabs = [
    { id: 'fixtures', label: 'Fixtures & Results', icon: CalendarDays },
    { id: 'table', label: 'League Table', icon: Trophy },
    { id: 'stats', label: 'Player Stats', icon: BarChart2 },
    { id: 'teams', label: 'Teams Database', icon: Users },
    ...(isAdmin ? [{ id: 'manual', label: 'User Manual', icon: Book }] : []),
  ];

  const handleUpdateSettings = async (newSettings: Settings) => {
    const oldSettings = settings;
    await setSettings(newSettings);
    
    // Check if we should automatically reschedule
    const matchesPerDayChanged = newSettings.matchdaySettings?.matchesPerDay !== oldSettings.matchdaySettings?.matchesPerDay;
    const restingDaysChanged = newSettings.matchdaySettings?.restingDays !== oldSettings.matchdaySettings?.restingDays;
    const customMatchdaysChanged = JSON.stringify(newSettings.matchdaySettings?.customMatchdays) !== JSON.stringify(oldSettings.matchdaySettings?.customMatchdays);
    const startDateChanged = newSettings.startDate !== oldSettings.startDate;
    const pitchesChanged = JSON.stringify(newSettings.pitches) !== JSON.stringify(oldSettings.pitches);

    if (fixtures.length > 0 && (matchesPerDayChanged || restingDaysChanged || customMatchdaysChanged || startDateChanged || pitchesChanged)) {
      // Small delay to ensure state is updated
      setTimeout(() => {
        rescheduleFixtures(newSettings);
      }, 100);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-gray-100 font-sans flex selection:bg-indigo-500/30">
      {/* Sidebar */}
      <aside className="w-16 bg-[#151821] border-r border-gray-800 flex flex-col items-center py-4 gap-8 z-40 flex-shrink-0">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-900/20">
          <Code2 className="w-6 h-6" />
        </div>
        <nav className="flex flex-col gap-4 w-full items-center">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "p-3 rounded-xl transition-all duration-200 group relative",
                  isActive
                    ? "bg-indigo-600/10 text-indigo-400"
                    : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
                )}
                title={tab.label}
              >
                <Icon className="w-5 h-5" />
                {/* Tooltip */}
                <div className="absolute left-full ml-4 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                  {tab.label}
                </div>
              </button>
            );
          })}
          <div className="w-8 h-px bg-gray-800 my-2" />
          {isAdmin && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-3 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 transition-all duration-200"
              title="Settings"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          )}
          {isSuperAdmin && (
            <button
              onClick={() => setIsAdminPanelOpen(true)}
              className="p-3 rounded-xl text-gray-500 hover:text-indigo-400 hover:bg-gray-800/50 transition-all duration-200"
              title="Admin Panel"
            >
              <Shield className="w-5 h-5" />
            </button>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-[#151821] border-b border-gray-800 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight">Locker Room</h1>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-gray-400">
            <button onClick={() => setIsShareOpen(true)} className="hover:text-white transition-colors">Share</button>
            {isAdmin ? (
              <button onClick={() => setIsTournamentManagementOpen(true)} className="text-indigo-400 hover:text-white transition-colors">{settings.tournamentName || "Proball"}</button>
            ) : (
              <span className="text-indigo-400">{settings.tournamentName || "Proball"}</span>
            )}
            
            {userId && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/50 border border-gray-700/50">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  isAdmin ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                )} />
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                  {isAdmin ? 'Admin' : 'Viewer'}
                </span>
                {isSuperAdmin && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleRole();
                    }}
                    className="ml-1 p-1 hover:bg-gray-700 rounded-md transition-colors text-indigo-400"
                    title="Toggle Role (Super Admin Only)"
                  >
                    <SettingsIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {userId ? (
              <button 
                onClick={() => logout()} 
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            ) : (
              <button 
                onClick={() => signInWithGoogle()} 
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
            )}

            {isAdmin && <button onClick={() => setActiveTab('manual')} className="hover:text-white transition-colors">More</button>}
            <div className="w-px h-4 bg-gray-700" />
            <button onClick={() => handleNotImplemented('Light Mode')} className="p-1.5 rounded-md bg-gray-800 text-gray-300 hover:text-white border border-gray-700 transition-colors">
              <Sun className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 md:p-8">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-gray-400">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
              <p className="text-lg font-medium">Loading tournament data...</p>
            </div>
          ) : (!userId && !publicTournamentId) ? (
            <div className="h-full flex flex-col items-center justify-center gap-6 text-center max-w-md mx-auto">
              <div className="w-20 h-20 bg-indigo-600/10 rounded-3xl flex items-center justify-center text-indigo-500 mb-2">
                <Trophy className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-bold text-white">Welcome to Locker Room</h2>
              <p className="text-gray-400 leading-relaxed">
                Sign in to create and manage your tournaments. Your data will be synced across all your devices in real-time.
              </p>
              <button 
                onClick={() => signInWithGoogle()} 
                className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg transition-all shadow-xl shadow-indigo-900/20"
              >
                <LogIn className="w-6 h-6" />
                Sign in with Google
              </button>
            </div>
          ) : (
            <div className="max-w-[1600px] mx-auto">
            {!isAdmin && isSuperAdmin && (
              <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500 rounded-lg text-white">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Viewing as Normal User</p>
                    <p className="text-sm text-amber-200/60">Management tools are hidden. You are seeing exactly what your viewers see.</p>
                  </div>
                </div>
                <button 
                  onClick={() => toggleRole()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-900/20"
                >
                  Return to Admin
                </button>
              </div>
            )}
            {/* Tournament Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-4">
                {settings.logoUrl && (
                  <img src={settings.logoUrl} alt="Logo" className="w-12 h-12 rounded-lg object-cover bg-gray-800" />
                )}
                <h2 className="text-3xl font-bold text-white">{settings.tournamentName || "Some Cool Tournament"}</h2>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div className="flex bg-[#1A1D24]/80 backdrop-blur-md rounded-xl p-1 border border-gray-800/50 shadow-sm">
                  <button 
                    onClick={() => setMatchFilter('all')}
                    className={cn("px-3 py-1.5 rounded-lg transition-all duration-200", matchFilter === 'all' ? "bg-indigo-600/20 text-indigo-400 font-medium" : "text-gray-400 hover:text-gray-200")}
                  >
                    All matches
                  </button>
                  <button 
                    onClick={() => setMatchFilter('hide_past')}
                    className={cn("px-3 py-1.5 rounded-lg transition-all duration-200", matchFilter === 'hide_past' ? "bg-indigo-600/20 text-indigo-400 font-medium" : "text-gray-400 hover:text-gray-200")}
                  >
                    Hide past matches
                  </button>
                  <button 
                    onClick={() => setMatchFilter('current')}
                    className={cn("px-3 py-1.5 rounded-lg transition-all duration-200", matchFilter === 'current' ? "bg-indigo-600/20 text-indigo-400 font-medium" : "text-gray-400 hover:text-gray-200")}
                  >
                    Current matches
                  </button>
                </div>
                <div className="flex bg-[#1A1D24]/80 backdrop-blur-md rounded-xl p-1 border border-gray-800/50 shadow-sm">
                  <button 
                    onClick={() => setNameDisplay('team')}
                    className={cn("px-3 py-1.5 rounded-lg transition-all duration-200", nameDisplay === 'team' ? "bg-indigo-600/20 text-indigo-400 font-medium" : "text-gray-400 hover:text-gray-200")}
                  >
                    Team names
                  </button>
                  <button 
                    onClick={() => setNameDisplay('player')}
                    className={cn("px-3 py-1.5 rounded-lg transition-all duration-200", nameDisplay === 'player' ? "bg-indigo-600/20 text-indigo-400 font-medium" : "text-gray-400 hover:text-gray-200")}
                  >
                    Player names
                  </button>
                </div>
                <button 
                  onClick={() => setIsDashboardOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 rounded-xl hover:bg-indigo-600/20 transition-all duration-200 font-medium ml-2 shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" /> View dashboard
                </button>
              </div>
            </div>

            <div className="">
              {activeTab === 'table' && <LeagueTable table={getLeagueTable()} fixtures={fixtures} groups={groups} isAdmin={isAdmin} />}
              {activeTab === 'stats' && <PlayerStats stats={getPlayerStats()} isAdmin={isAdmin} />}
              {activeTab === 'teams' && (
                <Teams 
                  teams={teams} 
                  groups={groups}
                  settings={settings}
                  isAdmin={isAdmin}
                  onAddTeam={addTeam} 
                  onEditTeam={editTeam}
                  onDeleteTeam={deleteTeam} 
                  onReorderTeams={reorderTeams}
                  onAddGroup={addGroup}
                  onDeleteGroup={deleteGroup}
                  onGenerateTestData={generateTestData}
                  onFillTeamSheets={fillAllTeamSheetsWithTestData}
                />
              )}
              {activeTab === 'fixtures' && (
                <Fixtures 
                  fixtures={fixtures} 
                  teams={teams} 
                  groups={groups}
                  settings={settings}
                  isAdmin={isAdmin}
                  onGenerateFixtures={generateFixtures} 
                  onGenerateKnockoutFixtures={generateKnockoutFixtures}
                  onUpdateFixture={updateFixture} 
                  onUpdateFixtureDetails={updateFixtureDetails}
                  onUpdateMatchdayDate={updateMatchdayDate}
                  onToggleFixtureStarted={toggleFixtureStarted}
                  onToggleFixturePlayed={toggleFixturePlayed}
                  onAddGroup={addGroup}
                  onEditTeam={editTeam}
                  onAddMatchEvent={addMatchEvent}
                  onRemoveMatchEvent={removeMatchEvent}
                  onReorderFixtures={reorderFixtures}
                  onMoveFixture={moveFixture}
                  onReassignFixturesFromMatchday={reassignFixturesFromMatchday}
                  onRescheduleFixtures={rescheduleFixtures}
                  matchFilter={matchFilter}
                  nameDisplay={nameDisplay}
                />
              )}
              {activeTab === 'manual' && <UserManual />}
            </div>
          </div>
        )}
      </main>
    </div>

      {/* Settings Modal */}
      {isShareOpen && (
        <ShareModal
          tournamentId={publicTournamentId || settings.tournamentName || 'default'}
          onClose={() => setIsShareOpen(false)}
          exportOptions={[...exportOptions, ...globalExportOptions]}
        />
      )}

      {/* Hidden containers for image exports */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
        <div ref={playerStatsExportRef} className="w-[1200px] bg-[#0B0E14] p-8 text-white">
          <PlayerStats stats={getPlayerStats()} isAdmin={isAdmin} />
        </div>
      </div>

      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onSave={handleUpdateSettings}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {isTournamentManagementOpen && (
        <TournamentManagementModal
          settings={settings}
          teams={teams}
          groups={groups}
          tournamentId={settings.tournamentName || 'default-tournament'}
          userId={userId || ''}
          onSave={handleUpdateSettings}
          onFillTeamSheets={fillAllTeamSheetsWithTestData}
          onClose={() => setIsTournamentManagementOpen(false)}
        />
      )}
      {isAdminPanelOpen && (
        <AdminPanel
          users={allUsers}
          onUpdateRole={updateUserRole}
          onClose={() => setIsAdminPanelOpen(false)}
        />
      )}

      {/* Dashboard Modal */}
      {isDashboardOpen && (
        <ErrorBoundary>
          <DashboardModal
            teams={teams}
            fixtures={fixtures}
            leagueTable={getLeagueTable()}
            onClose={() => setIsDashboardOpen(false)}
          />
        </ErrorBoundary>
      )}

      {/* Coming Soon Modal */}
      {comingSoonFeature && (
        <ComingSoonModal
          feature={comingSoonFeature}
          onClose={() => setComingSoonFeature(null)}
        />
      )}
    </div>
  );
}
