import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, query, where, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Team, Fixture, Settings, LeagueRow, Group, MatchEvent, PlayerStat, Pitch } from '../types';
import { generateId, getStageName } from '../utils';
import { logAction } from '../services/auditService';

const DEFAULT_SETTINGS: Settings = {
  logoUrl: 'https://picsum.photos/seed/football/200/200',
  startDate: new Date().toISOString().split('T')[0],
  numberOfPitches: 1,
  pitches: [{ id: 'pitch-1', name: 'Pitch 1' }],
  groupStage: { numberOfWinners: 1, numberOfLegs: 1 },
  knockoutStage: { numberOfWinners: 1, numberOfLegs: 2 },
  playerSettings: {
    maxPlayersPerTeam: 15,
    activePlayersPerSide: 7,
    maxSubs: 5
  }
};

export function useTournament(publicTournamentId?: string) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [settings, _setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [tournamentId, setTournamentId] = useState<string | null>(publicTournamentId || null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'viewer' | null>(null);
  const [allUsers, setAllUsers] = useState<{uid: string, email: string, role: string}[]>([]);

  enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
  }

  interface FirestoreErrorInfo {
    error: string;
    operationType: OperationType;
    path: string | null;
    authInfo: {
      userId: string | undefined;
      email: string | null | undefined;
      emailVerified: boolean | undefined;
      isAnonymous: boolean | undefined;
      tenantId: string | null | undefined;
      providerInfo: {
        providerId: string;
        displayName: string | null;
        email: string | null;
        photoUrl: string | null;
      }[];
    }
  }

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  const [lastPublished, setLastPublished] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const publish = async () => {
    if (!tournamentId || !isAdmin) return;
    setIsPublishing(true);
    try {
      const { publishTournament } = await import('../services/tournamentService');
      await publishTournament(tournamentId, tournamentId, {
        ...settings,
        publishedAt: new Date().toISOString()
      });
      setLastPublished(new Date().toISOString());
    } catch (error) {
      console.error('Publish failed', error);
      throw error;
    } finally {
      setIsPublishing(false);
    }
  };

  useEffect(() => {
    if (!tournamentId) return;
    
    const unsubPublic = onSnapshot(doc(db, 'public_tournaments', tournamentId), (snapshot) => {
      if (snapshot.exists()) {
        setLastPublished(snapshot.data().publishedAt || null);
      }
    });
    
    return () => unsubPublic();
  }, [tournamentId]);

  const isSuperAdmin = currentUserEmail?.toLowerCase() === 'conradenock@gmail.com';
  const isGlobalAdmin = userRole === 'admin' || isSuperAdmin;
  const isAdmin = isGlobalAdmin || (authUserId !== null && authUserId === tournamentId);
  console.log("Admin status check:", { userRole, isSuperAdmin, isGlobalAdmin, isAdmin, currentUserEmail });

  const setSettings = async (newSettings: Settings | ((prev: Settings) => Settings)) => {
    if (!tournamentId || !isAdmin) return;
    const updated = typeof newSettings === 'function' ? newSettings(settings) : newSettings;
    
    // Check logoUrl size
    if (updated.logoUrl && updated.logoUrl.startsWith('data:image/') && updated.logoUrl.length > 1024 * 1024) {
      alert('Logo image is too large for the database. Please use a smaller image or a URL.');
      return;
    }

    const path = `users/${tournamentId}/settings/current`;
    try {
      await setDoc(doc(db, path), { ...updated, userId: tournamentId });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const updateUserRole = async (targetUserId: string, role: 'admin' | 'viewer') => {
    console.log(`Attempting to update user ${targetUserId} to role ${role}...`);
    if (!authUserId || !isSuperAdmin) {
      console.warn("Update rejected: Not a Super Admin or not logged in.", { authUserId, isSuperAdmin });
      return;
    }
    const path = `users/${targetUserId}`;
    try {
      await setDoc(doc(db, path), { role }, { merge: true });
      console.log(`Successfully updated user ${targetUserId} to ${role}`);
    } catch (error) {
      console.error(`Failed to update user ${targetUserId}:`, error);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  useEffect(() => {
    if (publicTournamentId) {
      setLoading(true);
      setTournamentId(publicTournamentId);

      let unsubLiveSettings = () => {};

      // Load base settings and structure from public snapshot
      const unsubSnapshot = onSnapshot(doc(db, 'public_tournaments', publicTournamentId), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          _setSettings(data as Settings);
          if (data.teams) setTeams(data.teams);
          if (data.fixtures) {
            setFixtures((data.fixtures as Fixture[]).sort((a, b) => {
              if (a.matchday !== b.matchday) return a.matchday - b.matchday;
              return (a.order || 0) - (b.order || 0);
            }));
          }
          if (data.groups) setGroups(data.groups);
          unsubLiveSettings(); // Stop listening to live settings if public snapshot exists
          setLoading(false);
        } else {
          // If not published yet, try to load settings from the live path
          // This allows the link to work even if "Publish" wasn't clicked
          unsubLiveSettings = onSnapshot(doc(db, `users/${publicTournamentId}/settings/current`), (settingsSnap) => {
            if (settingsSnap.exists()) {
              _setSettings(settingsSnap.data() as Settings);
            }
            setLoading(false);
          }, (error) => {
            handleFirestoreError(error, OperationType.GET, `users/${publicTournamentId}/settings/current`);
            setLoading(false);
          });
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `public_tournaments/${publicTournamentId}`);
        setLoading(false);
      });

      // Listen to live fixtures for real-time match updates (goals, status, events)
      const unsubFixtures = onSnapshot(collection(db, `users/${publicTournamentId}/fixtures`), (snapshot) => {
        const f = snapshot.docs.map(doc => doc.data() as Fixture);
        setFixtures(f.sort((a, b) => {
          if (a.matchday !== b.matchday) return a.matchday - b.matchday;
          return (a.order || 0) - (b.order || 0);
        }));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${publicTournamentId}/fixtures`);
      });

      // Listen to live teams for real-time player and team updates
      const unsubTeams = onSnapshot(collection(db, `users/${publicTournamentId}/teams`), (snapshot) => {
        setTeams(snapshot.docs.map(doc => doc.data() as Team));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${publicTournamentId}/teams`);
      });

      // Listen to live groups
      const unsubGroups = onSnapshot(collection(db, `users/${publicTournamentId}/groups`), (snapshot) => {
        setGroups(snapshot.docs.map(doc => doc.data() as Group));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${publicTournamentId}/groups`);
      });

      return () => {
        unsubSnapshot();
        unsubLiveSettings();
        unsubFixtures();
        unsubTeams();
        unsubGroups();
      };
    }

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      console.log("Auth state changed:", user?.email);
      setAuthUserId(user?.uid || null);
      setCurrentUserEmail(user?.email || null);
      
      if (!publicTournamentId) {
        setTournamentId(user?.uid || null);
      }

      if (user) {
        // Initialize user profile if it doesn't exist
        const userRef = doc(db, 'users', user.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: user.uid,
              email: user.email,
              name: (user.displayName || 'User').substring(0, 100),
              role: 'viewer'
            });
          }
        } catch (error) {
          console.error("Error initializing user profile:", error);
        }
      } else {
        if (!publicTournamentId) {
          setTeams([]);
          setGroups([]);
          setFixtures([]);
          _setSettings(DEFAULT_SETTINGS);
        }
        setUserRole(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [publicTournamentId]);

  useEffect(() => {
    if (!authUserId) {
      setUserRole(null);
      return;
    }

    const unsubUser = onSnapshot(doc(db, 'users', authUserId), (snapshot) => {
      console.log("User role snapshot:", snapshot.exists(), snapshot.data());
      if (snapshot.exists()) {
        setUserRole(snapshot.data().role || 'viewer');
      } else {
        console.log("User doc does not exist, defaulting to viewer");
        setUserRole('viewer');
      }
    }, (error) => {
      console.error("Error fetching user role:", error);
    });

    return () => unsubUser();
  }, [authUserId]);

  useEffect(() => {
    if (!tournamentId || (publicTournamentId && tournamentId !== publicTournamentId)) return;

    setLoading(true);

    // Fetch all users if super admin
    let unsubAllUsers = () => {};
    if (isSuperAdmin) {
      console.log("Super Admin detected, attaching users listener...");
      unsubAllUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        console.log(`Received ${snapshot.docs.length} users from Firestore`);
        setAllUsers(snapshot.docs.map(doc => ({
          uid: doc.id,
          email: doc.data().email,
          role: doc.data().role
        })));
      }, (error) => {
        console.error("Error fetching users list:", error);
        handleFirestoreError(error, OperationType.LIST, 'users');
      });
    }

    const unsubTeams = onSnapshot(collection(db, `users/${tournamentId}/teams`), (snapshot) => {
      console.log("Teams snapshot received:", snapshot.size, "docs");
      setTeams(snapshot.docs.map(doc => doc.data() as Team));
    }, (error) => {
      console.error("Teams snapshot error:", error);
      handleFirestoreError(error, OperationType.LIST, `users/${tournamentId}/teams`);
    });

    const unsubGroups = onSnapshot(collection(db, `users/${tournamentId}/groups`), (snapshot) => {
      console.log("Groups snapshot received:", snapshot.size, "docs");
      const g = snapshot.docs.map(doc => doc.data() as Group);
      setGroups(g.length > 0 ? g : [{ id: 'group-a', name: 'Group A' }]);
    }, (error) => {
      console.error("Groups snapshot error:", error);
      handleFirestoreError(error, OperationType.LIST, `users/${tournamentId}/groups`);
    });

    const unsubFixtures = onSnapshot(collection(db, `users/${tournamentId}/fixtures`), (snapshot) => {
      console.log("Fixtures snapshot received:", snapshot.size, "docs");
      const f = snapshot.docs.map(doc => doc.data() as Fixture);
      setFixtures(f.sort((a, b) => {
        if (a.matchday !== b.matchday) return a.matchday - b.matchday;
        return (a.order || 0) - (b.order || 0);
      }));
    }, (error) => {
      console.error("Fixtures snapshot error:", error);
      handleFirestoreError(error, OperationType.LIST, `users/${tournamentId}/fixtures`);
    });

    const unsubSettings = onSnapshot(doc(db, `users/${tournamentId}/settings/current`), (snapshot) => {
      if (snapshot.exists()) {
        _setSettings(snapshot.data() as Settings);
      } else {
        // Initialize settings if they don't exist
        setDoc(doc(db, `users/${tournamentId}/settings/current`), { ...DEFAULT_SETTINGS, userId: tournamentId });
      }
      setLoading(false);
    });

    return () => {
      unsubAllUsers();
      unsubTeams();
      unsubGroups();
      unsubFixtures();
      unsubSettings();
    };
  }, [tournamentId, isSuperAdmin]);

  const addTeam = async (team: Omit<Team, 'id' | 'players'>) => {
    if (!tournamentId || !isAdmin) return;
    const id = generateId();
    const path = `users/${tournamentId}/teams/${id}`;
    try {
      await setDoc(doc(db, path), { ...team, id, players: [], userId: tournamentId });
      await logAction(tournamentId, 'ADD_TEAM', `Added team: ${team.name}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const editTeam = async (id: string, updatedTeam: Partial<Team>) => {
    if (!tournamentId || !isAdmin) return;
    const path = `users/${tournamentId}/teams/${id}`;
    try {
      await setDoc(doc(db, path), { ...updatedTeam }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const deleteTeam = async (id: string) => {
    if (!tournamentId || !isAdmin) return;
    const path = `users/${tournamentId}/teams/${id}`;
    try {
      await deleteDoc(doc(db, path));
      // Clear fixtures if teams change - in a real app we might want to be more selective
      const batch = writeBatch(db);
      fixtures.forEach(f => {
        if (f.homeTeamId === id || f.awayTeamId === id) {
          batch.delete(doc(db, `users/${tournamentId}/fixtures`, f.id));
        }
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const reorderTeams = async (newTeams: Team[]) => {
    if (!tournamentId || !isAdmin) return;
    // Firestore doesn't have a built-in order, usually we'd add an 'order' field
    // For now, we'll just update them all if needed, but reordering in UI is enough
    setTeams(newTeams);
  };

  const reorderFixtures = async (matchday: number, newFixtures: Fixture[]) => {
    if (!tournamentId || !isAdmin) return;
    
    // Update local state first for responsiveness
    setFixtures(prev => {
      const otherFixtures = prev.filter(f => f.matchday !== matchday);
      return [...otherFixtures, ...newFixtures.map((f, i) => ({ ...f, order: i }))];
    });

    // Persist to Firestore
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      const updatedFixtures = fixtures.map(f => {
        if (f.matchday === matchday) {
          const newIdx = newFixtures.findIndex(nf => nf.id === f.id);
          if (newIdx !== -1) return { ...f, order: newIdx, isManual: true, updatedAt: now };
        }
        return f;
      });

      newFixtures.forEach((f, i) => {
        batch.update(doc(db, `users/${tournamentId}/fixtures`, f.id), { 
          order: i, 
          isManual: true,
          updatedAt: now 
        });
      });
      await batch.commit();
      
      // Reorganize the rest of the tournament
      await regenerateUnplayedFixtures(updatedFixtures);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${tournamentId}/fixtures`);
    }
  };

  const moveFixture = async (fixture: Fixture, targetMatchday: number, targetOrder: number) => {
    if (!tournamentId || !isAdmin) return;

    // Persist to Firestore
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      const affectedMatchdays = new Set([fixture.matchday, targetMatchday]);
      
      // Re-calculate the reordered fixtures based on the change
      const others = fixtures.filter(f => f.id !== fixture.id);
      
      // Target matchday fixtures
      const targetDayFixtures = others.filter(f => f.matchday === targetMatchday).sort((a, b) => (a.order || 0) - (b.order || 0));
      
      // Insert the fixture at the targetOrder index
      const updatedFixture = { ...fixture, matchday: targetMatchday, isManual: true, updatedAt: now };
      targetDayFixtures.splice(targetOrder, 0, updatedFixture);
      
      // Reassign orders for the target matchday
      const updatedTargetDayFixtures = targetDayFixtures.map((f, i) => ({ ...f, order: i, isManual: true, updatedAt: now }));
      
      // Reassign orders for the source matchday (if different)
      let updatedSourceDayFixtures: Fixture[] = [];
      if (fixture.matchday !== targetMatchday) {
        const sourceDayFixtures = others.filter(f => f.matchday === fixture.matchday).sort((a, b) => (a.order || 0) - (b.order || 0));
        updatedSourceDayFixtures = sourceDayFixtures.map((f, i) => ({ ...f, order: i, isManual: true, updatedAt: now }));
      }
      
      const unaffectedFixtures = others.filter(f => f.matchday !== targetMatchday && f.matchday !== fixture.matchday);
      
      const reordered = [...unaffectedFixtures, ...updatedTargetDayFixtures, ...updatedSourceDayFixtures];
      
      // Update local state
      setFixtures(reordered);
      
      // Update all fixtures in the affected matchdays in Firestore
      [...updatedTargetDayFixtures, ...updatedSourceDayFixtures].forEach(f => {
        batch.update(doc(db, `users/${tournamentId}/fixtures`, f.id), { 
          matchday: f.matchday, 
          order: f.order,
          isManual: true,
          updatedAt: now
        });
      });
      
      await batch.commit();
      
      // Reorganize the rest of the tournament
      await regenerateUnplayedFixtures(reordered);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${tournamentId}/fixtures`);
    }
  };

  const addGroup = async (name: string) => {
    if (!tournamentId || !isAdmin) return;
    const id = generateId();
    const path = `users/${tournamentId}/groups/${id}`;
    try {
      await setDoc(doc(db, path), { id, name, userId: tournamentId });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const deleteGroup = async (id: string) => {
    if (!tournamentId || !isAdmin) return;
    const path = `users/${tournamentId}/groups/${id}`;
    try {
      await deleteDoc(doc(db, path));
      
      const batch = writeBatch(db);
      teams.forEach(t => {
        if (t.groupId === id) {
          batch.update(doc(db, `users/${tournamentId}/teams`, t.id), { groupId: null });
        }
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  // Helper functions for scheduling
  const generateRoundRobin = (teams: Team[], numberOfLegs: number) => {
    const fixtures: Fixture[] = [];
    const teamIds = teams.map(t => t.id);
    if (teamIds.length % 2 !== 0) teamIds.push('BYE');
    
    const numTeams = teamIds.length;
    const numRounds = numTeams - 1;
    const halfSize = numTeams / 2;
    
    for (let leg = 0; leg < numberOfLegs; leg++) {
      let currentTeamIds = [...teamIds];
      
      for (let round = 0; round < numRounds; round++) {
        for (let i = 0; i < halfSize; i++) {
          const home = currentTeamIds[i];
          const away = currentTeamIds[numTeams - 1 - i];
          
          if (home !== 'BYE' && away !== 'BYE') {
            // Swap home/away for second leg
            const isHome = leg % 2 === 0;
            
            fixtures.push({
              id: generateId(),
              matchday: (leg * numRounds) + round + 1,
              homeTeamId: isHome ? home : away,
              awayTeamId: isHome ? away : home,
              homeScore: null,
              awayScore: null,
              isPlayed: false,
              isStarted: false,
              date: '', // Will be set later
              pitchId: '', // Will be set later
            });
          }
        }
        
        // Rotate teams (keep the first team fixed)
        const last = currentTeamIds.pop()!;
        currentTeamIds.splice(1, 0, last);
      }
    }
    return fixtures;
  };

  const formatDate = (date: Date) => {
    try {
      if (isNaN(date.getTime())) return new Date().toISOString().split('T')[0];
      return date.toISOString().split('T')[0];
    } catch (e) {
      return new Date().toISOString().split('T')[0];
    }
  };

  const scheduleFixturesGlobal = (matches: Fixture[], currentSettings: Settings, startMatchday: number = 1) => {
    const globalRestingDays = currentSettings.matchdaySettings?.restingDays || 0;
    const globalMatchesPerDay = currentSettings.matchdaySettings?.matchesPerDay || 0;
    
    const scheduled: Fixture[] = [];
    
    // Extract manual fixtures
    let remainingManual = matches.filter(f => f.isManual);
    const remainingDynamic = matches.filter(f => !f.isManual);
    
    let currentMatchday = startMatchday;
    const teamLastPlayedOn = new Map<string, number>();
    
    // Process manual fixtures that are BEFORE startMatchday
    const pastManual = remainingManual.filter(f => f.matchday < startMatchday);
    for (const match of pastManual) {
      scheduled.push(match);
      if (match.homeTeamId !== '') teamLastPlayedOn.set(match.homeTeamId, match.matchday);
      if (match.awayTeamId !== '') teamLastPlayedOn.set(match.awayTeamId, match.matchday);
    }
    remainingManual = remainingManual.filter(f => f.matchday >= startMatchday);
    
    // Track current active settings
    let activeRestingDays = globalRestingDays;
    let activeMatchesPerDay = globalMatchesPerDay;
    let isMatchesPerDayAuto = globalMatchesPerDay === 0;

    while (remainingDynamic.length > 0 || remainingManual.length > 0) {
      // Update active settings if custom ones exist for this day
      const customSettings = currentSettings.matchdaySettings?.customMatchdays?.find(m => m.matchday === currentMatchday);
      
      // Inherit from previous day (which starts as global default), then override with custom if exists
      if (customSettings) {
        if (customSettings.restingDays !== null && customSettings.restingDays !== undefined) {
          activeRestingDays = customSettings.restingDays;
        }
        if (customSettings.matchesPerDay !== null && customSettings.matchesPerDay !== undefined) {
          activeMatchesPerDay = customSettings.matchesPerDay;
          isMatchesPerDayAuto = false;
        }
      }

      let matchesToday = 0;
      const teamsPlayingToday = new Set<string>();
      const groupsPlayingToday = new Set<string>();
      
      // 1. Process manual fixtures for today
      const manualToday = remainingManual.filter(f => f.matchday === currentMatchday);
      for (const match of manualToday) {
        scheduled.push(match);
        matchesToday++;
        if (match.homeTeamId !== '') {
          teamsPlayingToday.add(match.homeTeamId);
          teamLastPlayedOn.set(match.homeTeamId, currentMatchday);
        }
        if (match.awayTeamId !== '') {
          teamsPlayingToday.add(match.awayTeamId);
          teamLastPlayedOn.set(match.awayTeamId, currentMatchday);
        }
        if (match.groupId) groupsPlayingToday.add(match.groupId);
      }
      remainingManual = remainingManual.filter(f => f.matchday !== currentMatchday);

      // Helper function to try scheduling a match
      const tryScheduleMatch = (match: Fixture, index: number, respectGroupConstraint: boolean): boolean => {
        if (respectGroupConstraint && match.groupId && groupsPlayingToday.has(match.groupId)) return false;

        const homeId = match.homeTeamId;
        const awayId = match.awayTeamId;
        
        // Check restingDays constraint
        const homeLastPlayed = teamLastPlayedOn.get(homeId) ?? -1000;
        const awayLastPlayed = teamLastPlayedOn.get(awayId) ?? -1000;
        
        const homeCanPlay = (currentMatchday - homeLastPlayed) > activeRestingDays;
        const awayCanPlay = (currentMatchday - awayLastPlayed) > activeRestingDays;
        
        // Check if teams already playing today (ignore TBD teams)
        const homeNotPlayingToday = homeId === '' || !teamsPlayingToday.has(homeId);
        const awayNotPlayingToday = awayId === '' || !teamsPlayingToday.has(awayId);
        
        if (homeCanPlay && awayCanPlay && homeNotPlayingToday && awayNotPlayingToday) {
          match.matchday = currentMatchday;
          match.order = matchesToday;
          scheduled.push(match);
          remainingDynamic.splice(index, 1);
          
          matchesToday++;
          if (homeId !== '') teamsPlayingToday.add(homeId);
          if (awayId !== '') teamsPlayingToday.add(awayId);
          if (match.groupId) groupsPlayingToday.add(match.groupId);
          if (homeId !== '') teamLastPlayedOn.set(homeId, currentMatchday);
          if (awayId !== '') teamLastPlayedOn.set(awayId, currentMatchday);
          return true;
        }
        return false;
      };

      // Pass 1: Try to schedule one match from each group
      const groups = Array.from(new Set(remainingDynamic.map(f => f.groupId).filter(Boolean) as string[]));
      for (const groupId of groups) {
        if (!isMatchesPerDayAuto && matchesToday >= activeMatchesPerDay) break;
        
        // Find the first match for this group
        const matchIndex = remainingDynamic.findIndex(f => f.groupId === groupId);
        if (matchIndex !== -1) {
          tryScheduleMatch(remainingDynamic[matchIndex], matchIndex, true);
        }
      }

      // Pass 2: If space remains, try to schedule matches ignoring group constraint
      if (isMatchesPerDayAuto || matchesToday < activeMatchesPerDay) {
        for (let i = 0; i < remainingDynamic.length; i++) {
          if (!isMatchesPerDayAuto && matchesToday >= activeMatchesPerDay) break;
          if (tryScheduleMatch(remainingDynamic[i], i, false)) {
            i--; // Adjust index after splice
          }
        }
      }
      
      // Move to next day
      currentMatchday++;
      
      // Safety break to prevent infinite loop if constraints are impossible
      if (currentMatchday > 2000) {
        for (const match of remainingManual) {
          scheduled.push(match);
        }
        for (let i = 0; i < remainingDynamic.length; i++) {
          remainingDynamic[i].matchday = currentMatchday;
          remainingDynamic[i].order = i;
          scheduled.push(remainingDynamic[i]);
        }
        break;
      }
    }
    
    return scheduled;
  };
  
  const getDateForMatchday = (matchdayIndex: number, overrideSettings?: Settings) => {
    const activeSettings = overrideSettings || settings;
    const matchday = matchdayIndex + 1;
    
    let currentDate = new Date(activeSettings.startDate || new Date().toISOString().split('T')[0]);
    let currentResting = activeSettings.matchdaySettings?.restingDays || 0;
    
    for (let i = 1; i <= matchday; i++) {
      const custom = activeSettings.matchdaySettings?.customMatchdays?.find(m => m.matchday === i);
      
      // If this is the target day and it has a custom date, return it
      if (i === matchday && custom?.date) {
        return custom.date;
      }
      
      // If we found a custom date for a previous day, update our tracker
      if (custom?.date) {
        currentDate = new Date(custom.date);
      }
      
      // Update resting days if custom exists
      if (custom?.restingDays !== undefined && custom?.restingDays !== null) {
        currentResting = custom.restingDays;
      }
      
      // If we are not at the target day yet, move to the next day
      if (i < matchday) {
        currentDate.setDate(currentDate.getDate() + (currentResting + 1));
      }
    }
    
    return formatDate(currentDate);
  };

  const getTimeForMatchday = (matchdayIndex: number, overrideSettings?: Settings) => {
    const activeSettings = overrideSettings || settings;
    const matchday = matchdayIndex + 1;
    
    let currentTime = activeSettings.startTime || '09:00';
    for (let i = 1; i <= matchday; i++) {
      const custom = activeSettings.matchdaySettings?.customMatchdays?.find(m => m.matchday === i);
      if (custom?.time) {
        currentTime = custom.time;
      }
    }
    return currentTime;
  };

  const addMinutes = (time: string, minutes: number) => {
    if (!time) return '00:00';
    const [h, m] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + minutes);
    return date.toTimeString().slice(0, 5);
  };

  const scheduleMatchdayMatches = (dayFixtures: Fixture[], dayPitches: Pitch[], startTime: string) => {
    const MATCH_DURATION = 60; // minutes
    let currentTime = startTime || '09:00';
    const scheduled: Fixture[] = [];
    const queue = [...dayFixtures];
    
    // Track which groups have used which pitch today
    const groupPitchesUsed = new Map<string, Set<string>>();

    while (queue.length > 0) {
      const slots = dayPitches.length;
      const currentBatch: Fixture[] = [];
      const groupsInBatch = new Set<string>();
      
      for (let i = 0; i < slots; i++) {
        const pitch = dayPitches[i];
        const candidateIndex = queue.findIndex(f => {
          // Same group cannot play at the same time
          if (f.groupId && groupsInBatch.has(f.groupId)) return false;
          
          // Same group cannot use the same pitch in the same day
          if (f.groupId) {
            const usedPitches = groupPitchesUsed.get(f.groupId);
            if (usedPitches && usedPitches.has(pitch.id)) return false;
          }
          
          return true;
        });
        
        if (candidateIndex !== -1) {
          const match = queue[candidateIndex];
          queue.splice(candidateIndex, 1);
          match.time = currentTime;
          match.pitchId = pitch.id;
          currentBatch.push(match);
          
          if (match.groupId) {
            groupsInBatch.add(match.groupId);
            if (!groupPitchesUsed.has(match.groupId)) {
              groupPitchesUsed.set(match.groupId, new Set());
            }
            groupPitchesUsed.get(match.groupId)!.add(pitch.id);
          }
        }
      }
      
      // If we couldn't fill any slots in this batch but still have matches, 
      // it means we are stuck because of constraints. Move to next time slot.
      if (currentBatch.length === 0 && queue.length > 0) {
        // Fallback: ignore same-group-same-pitch if stuck
        const match = queue[0];
        queue.splice(0, 1);
        match.time = currentTime;
        match.pitchId = dayPitches[0].id;
        currentBatch.push(match);
      }

      scheduled.push(...currentBatch);
      currentTime = addMinutes(currentTime, MATCH_DURATION);
    }
    return scheduled;
  };

  const regenerateUnplayedFixtures = async (fixturesOverride?: Fixture[]) => {
    if (!tournamentId || !isAdmin) return;

    const baseFixtures = fixturesOverride || fixtures;

    // 1. Identify locked fixtures (played or manual)
    const lockedFixtures = baseFixtures.filter(f => f.isPlayed || f.isManual);
    const dynamicFixtures = baseFixtures.filter(f => !f.isPlayed && !f.isManual);

    // 2. Separate group and knockout fixtures
    const lockedGroup = lockedFixtures.filter(f => f.matchday < 100);
    const lockedKnockout = lockedFixtures.filter(f => f.matchday >= 100);
    
    const dynamicGroup = dynamicFixtures.filter(f => f.matchday < 100);
    const dynamicKnockout = dynamicFixtures.filter(f => f.matchday >= 100);

    // 3. Calculate missing group pairings
    let missingGroupFixtures: Fixture[] = [];
    const numberOfLegs = settings.groupStage.numberOfLegs || 1;

    if (groups.length > 0) {
      groups.forEach(group => {
        const groupTeams = teams.filter(t => t.groupId === group.id);
        if (groupTeams.length < 2) return;

        const allPairings = generateRoundRobin(groupTeams, numberOfLegs);
        const lockedGroupPairings = lockedGroup.filter(f => f.groupId === group.id);
        
        const lockedPairingsCount = new Map<string, number>();
        lockedGroupPairings.forEach(l => {
          const key = [l.homeTeamId, l.awayTeamId].sort().join('-');
          lockedPairingsCount.set(key, (lockedPairingsCount.get(key) || 0) + 1);
        });

        const missing = allPairings.filter(p => {
          const key = [p.homeTeamId, p.awayTeamId].sort().join('-');
          const lockedCount = lockedPairingsCount.get(key) || 0;
          if (lockedCount > 0) {
            lockedPairingsCount.set(key, lockedCount - 1);
            return false;
          }
          return true;
        });
        
        missing.forEach(f => f.groupId = group.id);
        missingGroupFixtures = [...missingGroupFixtures, ...missing];
      });
    } else {
      const allPairings = generateRoundRobin(teams, numberOfLegs);
      
      const lockedPairingsCount = new Map<string, number>();
      lockedGroup.forEach(l => {
        const key = [l.homeTeamId, l.awayTeamId].sort().join('-');
        lockedPairingsCount.set(key, (lockedPairingsCount.get(key) || 0) + 1);
      });

      const missing = allPairings.filter(p => {
        const key = [p.homeTeamId, p.awayTeamId].sort().join('-');
        const lockedCount = lockedPairingsCount.get(key) || 0;
        if (lockedCount > 0) {
          lockedPairingsCount.set(key, lockedCount - 1);
          return false;
        }
        return true;
      });
      missingGroupFixtures = missing;
    }

    // 4. Combine unplayed locked group with missing group
    const unplayedLockedGroup = lockedGroup.filter(f => !f.isPlayed);
    const groupToSchedule = [...unplayedLockedGroup, ...missingGroupFixtures];
    
    // 5. Schedule group fixtures
    const scheduledGroup = scheduleFixturesGlobal(groupToSchedule, settings, 1);

    // 6. Handle knockout fixtures
    // We keep all unplayed knockout fixtures (both locked and dynamic)
    const unplayedLockedKnockout = lockedKnockout.filter(f => !f.isPlayed);
    const knockoutToSchedule = [...unplayedLockedKnockout, ...dynamicKnockout];
    
    let scheduledKnockout: Fixture[] = [];
    if (knockoutToSchedule.length > 0) {
      const lastGroupMatchday = scheduledGroup.length > 0 
        ? Math.max(...scheduledGroup.map(f => f.matchday)) 
        : (lockedGroup.length > 0 ? Math.max(...lockedGroup.map(f => f.matchday)) : 0);
      
      let currentKnockoutStart = Math.max(101, lastGroupMatchday + 1);
      
      // Group knockout fixtures by their original matchday to preserve round/leg separation
      // We must group them BEFORE scheduling to avoid modified matchdays affecting the filter
      const fixturesByOriginalMatchday = new Map<number, Fixture[]>();
      knockoutToSchedule.forEach(f => {
        if (!fixturesByOriginalMatchday.has(f.matchday)) {
          fixturesByOriginalMatchday.set(f.matchday, []);
        }
        fixturesByOriginalMatchday.get(f.matchday)!.push(f);
      });
      
      const knockoutMatchdays = Array.from(fixturesByOriginalMatchday.keys()).sort((a, b) => a - b);
      
      for (const originalMatchday of knockoutMatchdays) {
        const fixturesForThisRound = fixturesByOriginalMatchday.get(originalMatchday)!;
        const scheduledRound = scheduleFixturesGlobal(fixturesForThisRound, settings, currentKnockoutStart);
        scheduledKnockout.push(...scheduledRound);
        
        if (scheduledRound.length > 0) {
          currentKnockoutStart = Math.max(...scheduledRound.map(f => f.matchday)) + 1;
        }
      }
    }

    // 7. Update Firestore
    try {
      const batch = writeBatch(db);
      // Delete old dynamic fixtures
      const baseFixtures = fixturesOverride || fixtures;
      const dynamicFixtures = baseFixtures.filter(f => !f.isPlayed && !f.isManual);
      dynamicFixtures.forEach(f => {
        batch.delete(doc(db, `users/${tournamentId}/fixtures`, f.id));
      });
      // Add new/updated fixtures
      [...scheduledGroup, ...scheduledKnockout].forEach(f => {
        batch.set(doc(db, `users/${tournamentId}/fixtures`, f.id), { ...f, userId: tournamentId });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${tournamentId}/fixtures`);
    }
  };

  const generateFixtures = async () => {
    if (teams.length < 2 || !tournamentId || !isAdmin) return;

    let newFixtures: Fixture[] = [];
    const pitches = settings.pitches && settings.pitches.length > 0 ? settings.pitches : [{ id: 'pitch-1', name: 'Pitch 1' }];

    // Helper to generate round robin fixtures
    const generateRoundRobin = (teams: Team[], numberOfLegs: number) => {
      const fixtures: Fixture[] = [];
      const teamIds = teams.map(t => t.id);
      if (teamIds.length % 2 !== 0) teamIds.push('BYE');
      
      const numTeams = teamIds.length;
      const numRounds = numTeams - 1;
      const halfSize = numTeams / 2;
      
      for (let leg = 0; leg < numberOfLegs; leg++) {
        let currentTeamIds = [...teamIds];
        
        for (let round = 0; round < numRounds; round++) {
          for (let i = 0; i < halfSize; i++) {
            const home = currentTeamIds[i];
            const away = currentTeamIds[numTeams - 1 - i];
            
            if (home !== 'BYE' && away !== 'BYE') {
              // Swap home/away for second leg
              const isHome = leg % 2 === 0;
              
              fixtures.push({
                id: generateId(),
                matchday: (leg * numRounds) + round + 1,
                homeTeamId: isHome ? home : away,
                awayTeamId: isHome ? away : home,
                homeScore: null,
                awayScore: null,
                isPlayed: false,
                isStarted: false,
                date: '', // Will be set later
                pitchId: '', // Will be set later
              });
            }
          }
          
          // Rotate teams
          currentTeamIds = [
            currentTeamIds[0],
            currentTeamIds[numTeams - 1],
            ...currentTeamIds.slice(1, numTeams - 1)
          ];
        }
      }
      
      return fixtures;
    };

    // Helper to schedule fixtures across matchdays respecting constraints
    const scheduleFixtures = (matches: Fixture[]) => {
      const globalRestingDays = settings.matchdaySettings?.restingDays || 0;
      const globalMatchesPerDay = settings.matchdaySettings?.matchesPerDay || 0;
      
      const scheduled: Fixture[] = [];
      const queue = [...matches];
      
      let currentMatchday = 1;
      const teamLastPlayedOn = new Map<string, number>();
      
      // Track current active settings
      let activeRestingDays = globalRestingDays;
      let activeMatchesPerDay = globalMatchesPerDay;
      let isMatchesPerDayAuto = globalMatchesPerDay === 0;

      while (queue.length > 0) {
        // Update active settings if custom ones exist for this day
        const customSettings = settings.matchdaySettings?.customMatchdays?.find(m => m.matchday === currentMatchday);
        
        // Inherit from previous day (which starts as global default), then override with custom if exists
        if (customSettings) {
          if (customSettings.restingDays !== null && customSettings.restingDays !== undefined) {
            activeRestingDays = customSettings.restingDays;
          }
          if (customSettings.matchesPerDay !== null && customSettings.matchesPerDay !== undefined) {
            activeMatchesPerDay = customSettings.matchesPerDay;
            isMatchesPerDayAuto = false;
          }
        }

        let matchesToday = 0;
        const teamsPlayingToday = new Set<string>();
        const groupsPlayingToday = new Set<string>();
        let scheduledAnyToday = false;
        
        // Try to find matches for today
        
        // Helper function to try scheduling a match
        const tryScheduleMatch = (match: Fixture, index: number, respectGroupConstraint: boolean): boolean => {
          if (respectGroupConstraint && match.groupId && groupsPlayingToday.has(match.groupId)) return false;

          const homeId = match.homeTeamId;
          const awayId = match.awayTeamId;
          
          // Check restingDays constraint
          const homeLastPlayed = teamLastPlayedOn.get(homeId) ?? -1000;
          const awayLastPlayed = teamLastPlayedOn.get(awayId) ?? -1000;
          
          const homeCanPlay = (currentMatchday - homeLastPlayed) > activeRestingDays;
          const awayCanPlay = (currentMatchday - awayLastPlayed) > activeRestingDays;
          
          // Check if teams already playing today
          const homeNotPlayingToday = !teamsPlayingToday.has(homeId);
          const awayNotPlayingToday = !teamsPlayingToday.has(awayId);
          
          if (homeCanPlay && awayCanPlay && homeNotPlayingToday && awayNotPlayingToday) {
            match.matchday = currentMatchday;
            match.order = matchesToday;
            scheduled.push(match);
            queue.splice(index, 1);
            
            matchesToday++;
            teamsPlayingToday.add(homeId);
            teamsPlayingToday.add(awayId);
            if (match.groupId) groupsPlayingToday.add(match.groupId);
            teamLastPlayedOn.set(homeId, currentMatchday);
            teamLastPlayedOn.set(awayId, currentMatchday);
            scheduledAnyToday = true;
            return true;
          }
          return false;
        };

        // Pass 1: Try to schedule one match from each group
        const groups = Array.from(new Set(queue.map(f => f.groupId).filter(Boolean) as string[]));
        for (const groupId of groups) {
          if (!isMatchesPerDayAuto && matchesToday >= activeMatchesPerDay) break;
          
          // Find the first match for this group
          const matchIndex = queue.findIndex(f => f.groupId === groupId);
          if (matchIndex !== -1) {
            tryScheduleMatch(queue[matchIndex], matchIndex, true);
          }
        }

        // Pass 2: If space remains, try to schedule matches ignoring group constraint
        if (isMatchesPerDayAuto || matchesToday < activeMatchesPerDay) {
          for (let i = 0; i < queue.length; i++) {
            if (!isMatchesPerDayAuto && matchesToday >= activeMatchesPerDay) break;
            if (tryScheduleMatch(queue[i], i, false)) {
              i--; // Adjust index after splice
            }
          }
        }
        
        // Move to next day
        currentMatchday++;
        
        // Safety break to prevent infinite loop if constraints are impossible
        if (currentMatchday > 2000) break;
      }
      
      return scheduled;
    };

    if (groups.length > 0) {
      // Generate fixtures for each group
      groups.forEach(group => {
        const groupTeams = teams.filter(t => t.groupId === group.id);
        if (groupTeams.length < 2) return;

        const groupFixtures = generateRoundRobin(groupTeams, settings.groupStage.numberOfLegs);
        
        // Assign dates and pitches to group fixtures
        groupFixtures.forEach((fixture) => {
          fixture.groupId = group.id;
        });
        
        newFixtures = [...newFixtures, ...groupFixtures];
      });
    } else {
      // Generate league fixtures
      newFixtures = generateRoundRobin(teams, settings.groupStage.numberOfLegs);
    }

    // Apply advanced scheduling
    newFixtures = scheduleFixturesGlobal(newFixtures, settings);

    // Assign dates, times and pitches
    // Group by matchday first
    const fixturesByMatchday: Record<number, Fixture[]> = {};
    newFixtures.forEach(f => {
      if (!fixturesByMatchday[f.matchday]) fixturesByMatchday[f.matchday] = [];
      fixturesByMatchday[f.matchday].push(f);
    });

    Object.keys(fixturesByMatchday).forEach(dayStr => {
      const day = parseInt(dayStr);
      const dayFixtures = fixturesByMatchday[day];
      const matchdayIndex = day - 1;
      const date = getDateForMatchday(matchdayIndex);
      const startTime = getTimeForMatchday(matchdayIndex);
      
      // Set dates
      dayFixtures.forEach(f => f.date = date);
      
      // Schedule times and pitches
      scheduleMatchdayMatches(dayFixtures, pitches, startTime || '09:00');
    });

    try {
      // Update settings if matchdays changed due to constraints
      const maxMatchday = newFixtures.reduce((max, f) => Math.max(max, f.matchday), 0);
      if (maxMatchday > 0 && maxMatchday !== settings.matchdaySettings?.numberOfMatchdays) {
        await setSettings(prev => ({
          ...prev,
          matchdaySettings: {
            ...(prev.matchdaySettings || { numberOfMatchdays: 0, customMatchdays: [] }),
            numberOfMatchdays: maxMatchday
          }
        }));
      }

      const batches = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;

      const commitCurrentBatch = () => {
        batches.push(currentBatch.commit());
        currentBatch = writeBatch(db);
        operationCount = 0;
      };

      // Clear old fixtures first? Usually generateFixtures is a "reset" action
      fixtures.forEach(f => {
        currentBatch.delete(doc(db, `users/${tournamentId}/fixtures`, f.id));
        operationCount++;
        if (operationCount === 500) commitCurrentBatch();
      });
      newFixtures.forEach(f => {
        currentBatch.set(doc(db, `users/${tournamentId}/fixtures`, f.id), { ...f, userId: tournamentId });
        operationCount++;
        if (operationCount === 500) commitCurrentBatch();
      });
      
      if (operationCount > 0) {
        batches.push(currentBatch.commit());
      }
      
      await Promise.all(batches);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${tournamentId}/fixtures`);
    }
  };

  const fillAllTeamSheetsWithTestData = async () => {
    if (!tournamentId || !isAdmin) return;
    const firstNames = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
    const positions = ['GK', 'DF', 'MF', 'FW'];

    const maxPlayers = settings.playerSettings?.maxPlayersPerTeam || 15;
    const activePerSide = settings.playerSettings?.activePlayersPerSide || 7;

    try {
      const batch = writeBatch(db);
      teams.forEach(team => {
        const players = [];
        const minToGen = Math.min(activePerSide + 2, maxPlayers);
        const numPlayers = Math.floor(Math.random() * (maxPlayers - minToGen + 1)) + minToGen;
        
        for (let i = 0; i < numPlayers; i++) {
          const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
          const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
          const isActive = i < activePerSide;
          const position = positions[Math.floor(Math.random() * positions.length)];
          players.push({
            id: generateId(),
            name: `${firstName} ${lastName}`,
            number: (i + 1).toString(),
            position,
            isCaptain: i === 0,
            isViceCaptain: i === 1,
            isActive,
            photoUrl: `https://i.pravatar.cc/150?u=${generateId()}`,
            pitchPosition: isActive ? { 
              x: position === 'GK' ? 50 : position === 'DF' ? 20 + (i % 3) * 30 : position === 'MF' ? 20 + (i % 3) * 30 : 50, 
              y: position === 'GK' ? 90 : position === 'DF' ? 75 : position === 'MF' ? 50 : 25 
            } : undefined
          });
        }
        batch.update(doc(db, `users/${tournamentId}/teams`, team.id), { players });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${tournamentId}/teams`);
    }
  };

  const seedGroupStageResults = async () => {
    if (!tournamentId || !isAdmin) return;
    const unplayedGroupFixtures = fixtures.filter(f => f.matchday < 100 && !f.isPlayed);
    if (unplayedGroupFixtures.length === 0) {
      alert("No unplayed group stage matches found.");
      return;
    }

    if (!window.confirm(`This will assign random scores to all ${unplayedGroupFixtures.length} unplayed group stage matches. Continue?`)) {
      return;
    }

    try {
      const batch = writeBatch(db);
      unplayedGroupFixtures.forEach(f => {
        const homeScore = Math.floor(Math.random() * 4);
        const awayScore = Math.floor(Math.random() * 4);
        batch.update(doc(db, `users/${tournamentId}/fixtures`, f.id), {
          homeScore,
          awayScore,
          isPlayed: true,
          isStarted: true,
          updatedAt: new Date().toISOString()
        });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${tournamentId}/fixtures`);
    }
  };

  const seedKnockoutResults = async () => {
    if (!tournamentId || !isAdmin) return;
    const unplayedKnockoutFixtures = fixtures.filter(f => f.matchday >= 100 && !f.isPlayed);
    if (unplayedKnockoutFixtures.length === 0) {
      alert("No unplayed knockout matches found.");
      return;
    }

    if (!window.confirm(`This will assign random scores to all ${unplayedKnockoutFixtures.length} unplayed knockout matches. Continue?`)) {
      return;
    }

    try {
      const batch = writeBatch(db);
      unplayedKnockoutFixtures.forEach(f => {
        // For knockout, we want to avoid draws if possible or just pick a winner
        let homeScore = Math.floor(Math.random() * 4);
        let awayScore = Math.floor(Math.random() * 4);
        
        // If it's a single leg or the last leg of a pair, we might need a winner
        // But for "test data", random is usually fine.
        // Let's just make sure there's a winner if it's the only match in that round for those teams
        
        batch.update(doc(db, `users/${tournamentId}/fixtures`, f.id), {
          homeScore,
          awayScore,
          isPlayed: true,
          isStarted: true,
          updatedAt: new Date().toISOString()
        });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${tournamentId}/fixtures`);
    }
  };

  const generateKnockoutFixtures = async () => {
    if (!tournamentId) return;
    
    // Check if we already have knockout fixtures
    const existingKnockoutFixtures = fixtures.filter(f => f.matchday >= 100);
    
    if (existingKnockoutFixtures.length > 0) {
      const anyPlayed = existingKnockoutFixtures.some(f => f.isPlayed);
      
      if (anyPlayed) {
        // Find the latest round
        const maxMatchday = Math.max(...existingKnockoutFixtures.map(f => f.matchday));
        const latestRoundFixtures = existingKnockoutFixtures.filter(f => f.matchday === maxMatchday);
        
        // Check if all played in the latest round
        if (latestRoundFixtures.some(f => !f.isPlayed)) {
          alert("Please finish all matches in the current knockout round first.");
          return;
        }
        
        // Get winners
        const currentStageName = latestRoundFixtures[0]?.stageName;
        const currentRoundFixtures = existingKnockoutFixtures.filter(f => f.stageName === currentStageName);

        if (currentRoundFixtures.some(f => !f.isPlayed)) {
          alert("Please finish all matches in the current knockout round first.");
          return;
        }

        const pairings = new Map<string, { home: string, away: string, fixtures: Fixture[] }>();
        currentRoundFixtures.forEach(f => {
          const pairKey = [f.homeTeamId, f.awayTeamId].sort().join('-');
          if (!pairings.has(pairKey)) {
            pairings.set(pairKey, { home: f.homeTeamId, away: f.awayTeamId, fixtures: [] });
          }
          pairings.get(pairKey)!.fixtures.push(f);
        });

        const winners: string[] = [];
        pairings.forEach(p => {
          const homeScore = p.fixtures.reduce((acc, f) => {
            if (f.homeTeamId === p.home) return acc + (f.homeScore || 0);
            return acc + (f.awayScore || 0);
          }, 0);
          const awayScore = p.fixtures.reduce((acc, f) => {
            if (f.awayTeamId === p.away) return acc + (f.awayScore || 0);
            return acc + (f.homeScore || 0);
          }, 0);
          
          if (homeScore > awayScore) {
            winners.push(p.home);
          } else if (awayScore > homeScore) {
            winners.push(p.away);
          } else {
            // Tie-breaker: home team of first fixture
            winners.push(p.home);
          }
        });
        
        if (winners.length < 2) {
          alert("Tournament finished!");
          return;
        }
        
        // Generate next round
        const newFixtures: Fixture[] = [];
        const startMatchday = maxMatchday + 1;
        const pitchId = settings.pitches?.[0]?.id || 'pitch-1';
        
        const stageName = getStageName(winners.length);
        const legs = settings.knockoutStage.numberOfLegs || 1;
        
        for (let i = 0; i < winners.length; i += 2) {
          if (i + 1 < winners.length) {
            const tieId = generateId();
            newFixtures.push(createKnockoutFixture(winners[i], winners[i+1], 1, pitchId, '', stageName, legs, tieId));
            if (legs === 2) {
              newFixtures.push(createKnockoutFixture(winners[i+1], winners[i], 2, pitchId, '', stageName, legs, tieId));
            }
          }
        }
        
        // Apply advanced scheduling starting from the next available matchday
        const scheduledFixtures = scheduleFixturesGlobal(newFixtures, settings, startMatchday);

        // Assign dates, times and pitches
        const fixturesByMatchday: Record<number, Fixture[]> = {};
        scheduledFixtures.forEach(f => {
          if (!fixturesByMatchday[f.matchday]) fixturesByMatchday[f.matchday] = [];
          fixturesByMatchday[f.matchday].push(f);
        });

        const pitches = settings.pitches || [{ id: 'pitch-1', name: 'Pitch 1' }];

        Object.keys(fixturesByMatchday).forEach(dayStr => {
          const day = parseInt(dayStr);
          const dayFixtures = fixturesByMatchday[day];
          const matchdayIndex = day - 1;
          const date = getDateForMatchday(matchdayIndex);
          const startTime = getTimeForMatchday(matchdayIndex);
          
          dayFixtures.forEach(f => f.date = date);
          scheduleMatchdayMatches(dayFixtures, pitches, startTime || '09:00');
        });

        try {
          const batch = writeBatch(db);
          scheduledFixtures.forEach(f => {
            batch.set(doc(db, `users/${tournamentId}/fixtures`, f.id), { ...f, userId: tournamentId });
          });
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${tournamentId}/fixtures`);
        }
        return;
      } else {
        // No matches played, offer to regenerate first round
        if (!window.confirm("No knockout matches have been played yet. Would you like to regenerate the initial knockout round based on the latest standings?")) {
          return;
        }
        
        try {
          const batch = writeBatch(db);
          existingKnockoutFixtures.forEach(f => {
            batch.delete(doc(db, `users/${tournamentId}/fixtures`, f.id));
          });
          await batch.commit();
          // Continue to initial generation logic below
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${tournamentId}/fixtures`);
          return;
        }
      }
    }

    // 1. Calculate current standings (only if groups exist)
    let table: LeagueRow[] = [];
    if (groups.length > 0) {
      table = getLeagueTable();
    }
    
    // 2. Determine qualifiers based on groups or random if knockout-only
    let qualifiers: { teamId: string; groupId?: string; position: number }[] = [];
    
    if (groups.length > 0) {
      groups.forEach(group => {
        const groupTable = table.filter(row => row.groupId === group.id);
        // If numberOfWinners is 0 or not set, treat all teams in group as qualifiers
        const numWinners = settings.groupStage.numberOfWinners > 0 ? settings.groupStage.numberOfWinners : groupTable.length;
        const winners = groupTable.slice(0, numWinners);
        winners.forEach((row, index) => {
          qualifiers.push({ teamId: row.teamId, groupId: group.id, position: index + 1 });
        });
      });
      
      // Include teams not assigned to any group
      teams.filter(t => !t.groupId).forEach((team, index) => {
        qualifiers.push({ teamId: team.id, position: qualifiers.length + 1 });
      });
      
      // If no qualifiers found from groups or unassigned, fallback to all teams
      if (qualifiers.length === 0) {
        teams.forEach((team, index) => {
          qualifiers.push({ teamId: team.id, groupId: team.groupId, position: index + 1 });
        });
      }
    } else {
      // Knockout tournament logic: random initial pairing
      const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
      shuffledTeams.forEach((team, index) => {
        qualifiers.push({ teamId: team.id, groupId: team.groupId, position: index + 1 });
      });
    }

    if (qualifiers.length < 2) {
      alert("Not enough teams to generate knockout fixtures.");
      return;
    }

    const stageName = getStageName(qualifiers.length);
    const legs = settings.knockoutStage.numberOfLegs || 1;
    const matchesPerDay = settings.matchdaySettings?.matchesPerDay || 1;
    const restingDays = settings.matchdaySettings?.restingDays || 0;
    const numFixtures = qualifiers.length / 2;
    const numMatchdaysNeeded = Math.ceil(numFixtures / matchesPerDay);

    // Update settings with new numberOfMatchdays
    const updatedSettings = {
      ...settings,
      knockoutStage: {
        ...settings.knockoutStage,
        numberOfMatchdays: numMatchdaysNeeded
      }
    };
    await setSettings(updatedSettings);

    // 3. Generate fixtures
    const newFixtures: Fixture[] = [];
    const pitches = settings.pitches || [{ id: 'pitch-1', name: 'Pitch 1' }];

    const createFixture = (homeId: string, awayId: string) => {
      const tieId = generateId();
      newFixtures.push(createKnockoutFixture(homeId, awayId, 1, pitches[0].id, '', stageName, legs, tieId));
      if (legs === 2) {
        newFixtures.push(createKnockoutFixture(awayId, homeId, 2, pitches[0].id, '', stageName, legs, tieId));
      }
    };

    if (groups.length === 2) {
      const groupA = groups[0].id;
      const groupB = groups[1].id;
      
      const aWinners = qualifiers.filter(q => q.groupId === groupA).sort((a, b) => a.position - b.position);
      const bWinners = qualifiers.filter(q => q.groupId === groupB).sort((a, b) => a.position - b.position);
      
      for (let i = 0; i < aWinners.length; i++) {
        const opponent = bWinners[bWinners.length - 1 - i];
        if (opponent) {
          createFixture(aWinners[i].teamId, opponent.teamId);
        }
      }
    } else {
      // Sort qualifiers to ensure consistent pairing
      const sortedQualifiers = [...qualifiers].sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        return (a.groupId || '').localeCompare(b.groupId || '');
      });
      
      for (let i = 0; i < sortedQualifiers.length; i += 2) {
        if (i + 1 < sortedQualifiers.length) {
           createFixture(sortedQualifiers[i].teamId, sortedQualifiers[i+1].teamId);
        }
      }
    }
    
    // Apply advanced scheduling
    const scheduledFixtures = scheduleFixturesGlobal(newFixtures, settings, 101);

    // Assign dates, times and pitches
    // Group by matchday first
    const fixturesByMatchday: Record<number, Fixture[]> = {};
    scheduledFixtures.forEach(f => {
      if (!fixturesByMatchday[f.matchday]) fixturesByMatchday[f.matchday] = [];
      fixturesByMatchday[f.matchday].push(f);
    });

    Object.keys(fixturesByMatchday).forEach(dayStr => {
      const day = parseInt(dayStr);
      const dayFixtures = fixturesByMatchday[day];
      const matchdayIndex = day - 1;
      const date = getDateForMatchday(matchdayIndex);
      const startTime = getTimeForMatchday(matchdayIndex);
      
      // Set dates
      dayFixtures.forEach(f => f.date = date);
      
      // Schedule times and pitches
      scheduleMatchdayMatches(dayFixtures, pitches, startTime || '09:00');
    });

    try {
      const batch = writeBatch(db);
      scheduledFixtures.forEach(f => {
        batch.set(doc(db, `users/${tournamentId}/fixtures`, f.id), { ...f, userId: tournamentId });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${tournamentId}/fixtures`);
    }
  };

  const createKnockoutFixture = (homeId: string, awayId: string, matchday: number, pitchId: string, date: string, stageName: string, legs: number, tieId?: string): Fixture => {
    return {
      id: generateId(),
      matchday: 100 + matchday, // Use high matchday number for knockout to separate
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeScore: null,
      awayScore: null,
      isPlayed: false,
      isStarted: false,
      date: date,
      pitchId: pitchId,
      stageName: stageName,
      legs: legs,
      tieId: tieId,
    };
  };

  const updateFixtureTeams = async (id: string, homeTeamId: string, awayTeamId: string) => {
    console.log("updateFixtureTeams called", { id, homeTeamId, awayTeamId, tournamentId, isAdmin, userRole, isGlobalAdmin });
    if (!tournamentId || !isAdmin) {
      console.warn("updateFixtureTeams rejected", { tournamentId, isAdmin, userRole, isGlobalAdmin });
      return;
    }
    
    const currentFixture = fixtures.find(f => f.id === id);
    if (!currentFixture) {
      console.warn("Fixture not found", { id });
      return;
    }

    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      
      const isKnockout = currentFixture.matchday >= 100;
      const newIsManual = isKnockout ? false : true;

      let updatedFixtures = [...fixtures];
      const oldHomeId = currentFixture.homeTeamId;
      const oldAwayId = currentFixture.awayTeamId;
      const legs = currentFixture.legs || settings.knockoutStage?.numberOfLegs || 1;

      // Identify the other leg if it's a 2-leg knockout tie
      const otherLegId = (isKnockout && legs === 2) ? updatedFixtures.find(f => {
        if (f.id === id) return false;
        if (currentFixture.tieId && f.tieId === currentFixture.tieId) return true;
        return f.stageName === currentFixture.stageName && 
               f.homeTeamId === oldAwayId && 
               f.awayTeamId === oldHomeId;
      })?.id : null;

      const swapTeamInOtherFixtures = (newTeamId: string, oldTeamId: string) => {
        if (!newTeamId || newTeamId === oldTeamId) return;

        const otherFixtures = updatedFixtures.filter(f => 
          f.id !== id && 
          f.id !== otherLegId &&
          !f.isPlayed &&
          (isKnockout ? f.stageName === currentFixture.stageName : f.matchday === currentFixture.matchday) &&
          (f.homeTeamId === newTeamId || f.awayTeamId === newTeamId)
        );

        for (const otherF of otherFixtures) {
          const isHome = otherF.homeTeamId === newTeamId;
          const updatedOtherF = { ...otherF, updatedAt: now };
          
          if (isHome) {
            updatedOtherF.homeTeamId = oldTeamId;
          } else {
            updatedOtherF.awayTeamId = oldTeamId;
          }
          
          batch.update(doc(db, `users/${tournamentId}/fixtures/${otherF.id}`), {
            homeTeamId: updatedOtherF.homeTeamId,
            awayTeamId: updatedOtherF.awayTeamId,
            updatedAt: now
          });
          
          updatedFixtures = updatedFixtures.map(f => f.id === otherF.id ? updatedOtherF : f);
        }
      };

      if (homeTeamId !== oldHomeId) {
        swapTeamInOtherFixtures(homeTeamId, oldHomeId);
      }
      if (awayTeamId !== oldAwayId) {
        swapTeamInOtherFixtures(awayTeamId, oldAwayId);
      }

      // Update current fixture
      batch.update(doc(db, `users/${tournamentId}/fixtures/${id}`), { 
        homeTeamId, 
        awayTeamId, 
        isManual: newIsManual,
        updatedAt: now 
      });

      updatedFixtures = updatedFixtures.map(f => f.id === id ? { ...f, homeTeamId, awayTeamId, isManual: newIsManual, updatedAt: now } : f);

      // Link home/away for knockout 2-leg ties
      if (otherLegId) {
        batch.update(doc(db, `users/${tournamentId}/fixtures/${otherLegId}`), { 
          homeTeamId: awayTeamId, 
          awayTeamId: homeTeamId, 
          isManual: newIsManual,
          updatedAt: now 
        });
        updatedFixtures = updatedFixtures.map(f => f.id === otherLegId ? { ...f, homeTeamId: awayTeamId, awayTeamId: homeTeamId, isManual: newIsManual, updatedAt: now } : f);
      }

      await batch.commit();
      
      // Reorganize the rest of the tournament based on the manual change
      await regenerateUnplayedFixtures(updatedFixtures);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${tournamentId}/fixtures/${id}`);
    }
  };

  const addManualFixture = async (homeTeamId: string, awayTeamId: string, matchday: number) => {
    if (!tournamentId || !isAdmin) return;
    
    const newFixture: Fixture = {
      id: generateId(),
      matchday,
      homeTeamId,
      awayTeamId,
      homeScore: null,
      awayScore: null,
      isPlayed: false,
      isStarted: false,
      date: getDateForMatchday(matchday - 1),
      time: getTimeForMatchday(matchday - 1) || '09:00',
      pitchId: settings.pitches?.[0]?.id || 'pitch-1',
      order: fixtures.filter(f => f.matchday === matchday).length,
    };

    try {
      await setDoc(doc(db, `users/${tournamentId}/fixtures`, newFixture.id), { ...newFixture, userId: tournamentId });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${tournamentId}/fixtures`);
    }
  };

  const updateFixture = async (id: string, homeScore: number | null, awayScore: number | null) => {
    if (!tournamentId || !isAdmin) return;
    const path = `users/${tournamentId}/fixtures/${id}`;
    try {
      await setDoc(doc(db, path), { homeScore, awayScore }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const updateFixtureDetails = async (id: string, details: Partial<Pick<Fixture, 'date' | 'time' | 'pitchId' | 'matchday'>>) => {
    if (!tournamentId || !isAdmin) return;
    const path = `users/${tournamentId}/fixtures/${id}`;
    try {
      // We need the full fixture to perform the conflict check logic if we want to keep it
      // But for simplicity, let's just update the fields. 
      // If we want to keep the "auto-reassign" logic, it's better to do it locally then write.
      
      let updatedFixtures = fixtures.map(f => f.id === id ? { ...f, ...details } : f);
      const targetFixture = updatedFixtures.find(f => f.id === id);

      if (targetFixture && (details.time || details.date || details.pitchId)) {
        const pitches = settings.pitches || [{ id: 'pitch-1', name: 'Pitch 1' }];

        // 1. Check for Time/Pitch Conflict (Two matches at same time on same pitch)
        const timePitchConflict = updatedFixtures.find(f => 
          f.id !== id && 
          f.date === targetFixture.date && 
          f.time === targetFixture.time && 
          f.pitchId === targetFixture.pitchId
        );

        // 2. Check for Group/Pitch/Day Conflict (Two matches from same group on same pitch on same day)
        let groupPitchConflict = undefined;
        if (targetFixture.groupId) {
          groupPitchConflict = updatedFixtures.find(f => 
            f.id !== id &&
            f.groupId === targetFixture.groupId &&
            f.date === targetFixture.date &&
            f.pitchId === targetFixture.pitchId
          );
        }

        if (timePitchConflict || groupPitchConflict) {
          // Get all pitches used at this specific time
          const pitchesOccupiedAtTime = new Set(
            updatedFixtures
              .filter(f => f.id !== id && f.date === targetFixture.date && f.time === targetFixture.time)
              .map(f => f.pitchId)
          );

          // Get all pitches used by this group on this day
          const pitchesUsedByGroupToday = new Set<string>();
          if (targetFixture.groupId) {
            updatedFixtures
              .filter(f => f.id !== id && f.groupId === targetFixture.groupId && f.date === targetFixture.date)
              .forEach(f => {
                if (f.pitchId) pitchesUsedByGroupToday.add(f.pitchId);
              });
          }

          // Find a pitch that is NOT in either set
          const availablePitch = pitches.find(p => 
            !pitchesOccupiedAtTime.has(p.id) && 
            !pitchesUsedByGroupToday.has(p.id)
          );

          if (availablePitch) {
            // Reassign target to available pitch
            await setDoc(doc(db, path), { ...details, pitchId: availablePitch.id }, { merge: true });
            return;
          }
        }
      }
      
      const now = new Date().toISOString();
      const finalDetails = { ...details, isManual: true, updatedAt: now };
      const finalFixtures = fixtures.map(f => f.id === id ? { ...f, ...finalDetails } : f);

      await setDoc(doc(db, path), finalDetails, { merge: true });
      
      // Reorganize the rest of the tournament
      await regenerateUnplayedFixtures(finalFixtures);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const updateMatchdayDate = async (matchday: number, date: string) => {
    if (!tournamentId || !isAdmin) return;
    try {
      // Update settings to store custom matchday date
      const currentCustomMatchdays = settings.matchdaySettings?.customMatchdays || [];
      const existingIndex = currentCustomMatchdays.findIndex(m => m.matchday === matchday);
      
      let newCustomMatchdays;
      if (existingIndex >= 0) {
        newCustomMatchdays = [...currentCustomMatchdays];
        newCustomMatchdays[existingIndex] = { ...currentCustomMatchdays[existingIndex], date };
      } else {
        newCustomMatchdays = [...currentCustomMatchdays, { matchday, date }];
      }
      
      await setSettings({
        ...settings,
        matchdaySettings: {
          ...(settings.matchdaySettings || { numberOfMatchdays: 0, customMatchdays: [] }),
          customMatchdays: newCustomMatchdays
        }
      });

      // Update existing fixtures
      const batch = writeBatch(db);
      fixtures.forEach(f => {
        if (f.matchday === matchday) {
          batch.update(doc(db, `users/${tournamentId}/fixtures`, f.id), { date });
        }
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${tournamentId}/fixtures`);
    }
  };

  const updateMatchdayTitle = async (matchday: number, title: string) => {
    if (!tournamentId || !isAdmin) return;
    try {
      const currentCustomMatchdays = settings.matchdaySettings?.customMatchdays || [];
      const existingIndex = currentCustomMatchdays.findIndex(m => m.matchday === matchday);
      
      let newCustomMatchdays;
      if (existingIndex >= 0) {
        newCustomMatchdays = [...currentCustomMatchdays];
        newCustomMatchdays[existingIndex] = { ...currentCustomMatchdays[existingIndex], title };
      } else {
        const dayFixtures = fixtures.filter(f => f.matchday === matchday);
        const date = dayFixtures[0]?.date || settings.startDate || new Date().toISOString().split('T')[0];
        newCustomMatchdays = [...currentCustomMatchdays, { matchday, date, title }];
      }
      
      await setSettings({
        ...settings,
        matchdaySettings: {
          ...(settings.matchdaySettings || { numberOfMatchdays: 0, customMatchdays: [] }),
          customMatchdays: newCustomMatchdays
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${tournamentId}/settings`);
    }
  };

  const toggleFixtureStarted = async (id: string) => {
    if (!tournamentId || !isAdmin) return;
    const fixture = fixtures.find(f => f.id === id);
    if (fixture) {
      const path = `users/${tournamentId}/fixtures/${id}`;
      try {
        await setDoc(doc(db, path), { isStarted: !fixture.isStarted }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  };

  const toggleFixturePlayed = async (id: string) => {
    if (!tournamentId || !isAdmin) return;
    const f = fixtures.find(f => f.id === id);
    if (f) {
      const isNowPlayed = !f.isPlayed;
      const path = `users/${tournamentId}/fixtures/${id}`;
      try {
        await setDoc(doc(db, path), {
          isPlayed: isNowPlayed,
          isStarted: isNowPlayed ? true : f.isStarted,
          homeScore: isNowPlayed && f.homeScore === null ? 0 : f.homeScore,
          awayScore: isNowPlayed && f.awayScore === null ? 0 : f.awayScore
        }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  };

  const getLeagueTable = (): LeagueRow[] => {
    const table: Record<string, LeagueRow> = {};
    
    teams.forEach(t => {
      table[t.id] = {
        teamId: t.id,
        teamName: t.name,
        groupId: t.groupId,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0
      };
    });

    fixtures.forEach(f => {
      if (typeof f.homeScore === 'number' && typeof f.awayScore === 'number') {
        const home = table[f.homeTeamId];
        const away = table[f.awayTeamId];
        
        if (!home || !away) return;

        home.played++;
        away.played++;
        
        home.goalsFor += f.homeScore;
        home.goalsAgainst += f.awayScore;
        home.goalDifference = home.goalsFor - home.goalsAgainst;
        
        away.goalsFor += f.awayScore;
        away.goalsAgainst += f.homeScore;
        away.goalDifference = away.goalsFor - away.goalsAgainst;

        if (f.homeScore > f.awayScore) {
          home.won++;
          home.points += 3;
          away.lost++;
        } else if (f.homeScore < f.awayScore) {
          away.won++;
          away.points += 3;
          home.lost++;
        } else {
          home.drawn++;
          away.drawn++;
          home.points += 1;
          away.points += 1;
        }
      }
    });

    return Object.values(table).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });
  };

  const deleteTournament = async () => {
    if (!tournamentId || !isAdmin) return;
    const batch = writeBatch(db);
    
    // Clear existing
    teams.forEach(t => batch.delete(doc(db, `users/${tournamentId}/teams`, t.id)));
    groups.forEach(g => batch.delete(doc(db, `users/${tournamentId}/groups`, g.id)));
    fixtures.forEach(f => batch.delete(doc(db, `users/${tournamentId}/fixtures`, f.id)));
    
    // Reset settings
    batch.set(doc(db, `users/${tournamentId}/settings/current`), { ...DEFAULT_SETTINGS, userId: tournamentId });

    // Delete public tournament if exists
    batch.delete(doc(db, 'public_tournaments', tournamentId));

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${tournamentId}`);
    }
  };

  const generateTestData = async () => {
    if (!tournamentId || !isAdmin) return;
    const firstNames = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
    const positions = ['GK', 'DF', 'MF', 'FW'];

    const batch = writeBatch(db);
    
    // Clear existing
    teams.forEach(t => batch.delete(doc(db, `users/${tournamentId}/teams`, t.id)));
    groups.forEach(g => batch.delete(doc(db, `users/${tournamentId}/groups`, g.id)));
    fixtures.forEach(f => batch.delete(doc(db, `users/${tournamentId}/fixtures`, f.id)));

    const groupAId = generateId();
    const groupBId = generateId();
    batch.set(doc(db, `users/${tournamentId}/groups`, groupAId), { id: groupAId, name: 'Group A', userId: tournamentId });
    batch.set(doc(db, `users/${tournamentId}/groups`, groupBId), { id: groupBId, name: 'Group B', userId: tournamentId });

    const activePerSide = settings.playerSettings?.activePlayersPerSide || 7;

    for (let i = 1; i <= 5; i++) {
      const createTeamData = (name: string, initial: string, groupId: string) => {
        const players = [];
        const numPlayers = 12;
        for (let j = 0; j < numPlayers; j++) {
          const isActive = j < activePerSide;
          const position = positions[Math.floor(Math.random() * positions.length)];
          players.push({
            id: generateId(),
            name: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
            number: (j + 1).toString(),
            position,
            isCaptain: j === 0,
            isViceCaptain: j === 1,
            isActive,
            photoUrl: `https://i.pravatar.cc/150?u=${generateId()}`,
            ...(isActive ? { pitchPosition: { 
              x: position === 'GK' ? 50 : position === 'DF' ? 20 + (j % 3) * 30 : position === 'MF' ? 20 + (j % 3) * 30 : 50, 
              y: position === 'GK' ? 90 : position === 'DF' ? 75 : position === 'MF' ? 50 : 25 
            } } : {})
          });
        }
        const id = generateId();
        return { id, name, initial, manager: 'Manager', phone: '123-456', players, groupId, userId: tournamentId };
      };

      const teamA = createTeamData(`Team A${i}`, `TA${i}`, groupAId);
      const teamB = createTeamData(`Team B${i}`, `TB${i}`, groupBId);
      batch.set(doc(db, `users/${tournamentId}/teams`, teamA.id), teamA);
      batch.set(doc(db, `users/${tournamentId}/teams`, teamB.id), teamB);
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${tournamentId}/test-data`);
    }
  };

  const addMatchEvent = async (fixtureId: string, event: Omit<MatchEvent, 'id'>) => {
    if (!tournamentId || !isAdmin) return;
    const f = fixtures.find(fixture => fixture.id === fixtureId);
    if (!f) return;

    const newEvent = { ...event, id: generateId() };
    const events = [...(f.events || []), newEvent];
    
    // Auto-update score if goal
    let homeScore = f.homeScore;
    let awayScore = f.awayScore;
    
    if (event.type === 'goal') {
      if (event.teamId === f.homeTeamId) {
        homeScore = (homeScore || 0) + 1;
      } else {
        awayScore = (awayScore || 0) + 1;
      }
    }
    
    const path = `users/${tournamentId}/fixtures/${fixtureId}`;
    try {
      await setDoc(doc(db, path), { events, homeScore, awayScore }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const removeMatchEvent = async (fixtureId: string, eventId: string) => {
    if (!tournamentId || !isAdmin) return;
    const f = fixtures.find(fixture => fixture.id === fixtureId);
    if (!f) return;

    const eventToRemove = f.events?.find(e => e.id === eventId);
    const events = f.events?.filter(e => e.id !== eventId) || [];
    
    // Auto-update score if goal removed
    let homeScore = f.homeScore;
    let awayScore = f.awayScore;
    
    if (eventToRemove?.type === 'goal') {
      if (eventToRemove.teamId === f.homeTeamId) {
        homeScore = Math.max(0, (homeScore || 0) - 1);
      } else {
        awayScore = Math.max(0, (awayScore || 0) - 1);
      }
    }
    
    const path = `users/${tournamentId}/fixtures/${fixtureId}`;
    try {
      await setDoc(doc(db, path), { events, homeScore, awayScore }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const getPlayerStats = () => {
    const stats: Record<string, PlayerStat> = {};
    
    // Initialize stats for all players
    teams.forEach(team => {
      team.players.forEach(player => {
        stats[player.id] = {
          playerId: player.id,
          playerName: player.name,
          teamId: team.id,
          teamName: team.name,
          goals: 0,
          yellowCards: 0,
          redCards: 0,
          matchesPlayed: 0
        };
      });
    });

    // Calculate stats from fixtures
    fixtures.forEach(fixture => {
      if (fixture.isPlayed || fixture.isStarted) {
        // Increment matches played (simplified - assumes all players played)
        // In a real app, we'd track lineups
        
        fixture.events?.forEach(event => {
          if (stats[event.playerId]) {
            if (event.type === 'goal') stats[event.playerId].goals++;
            if (event.type === 'yellow_card') stats[event.playerId].yellowCards++;
            if (event.type === 'red_card') stats[event.playerId].redCards++;
          }
        });
      }
    });

    return Object.values(stats).sort((a, b) => b.goals - a.goals);
  };

  const reassignFixturesFromMatchday = async (matchday: number, selectedFixtureIds: string[], overrideSettings?: Settings) => {
    if (!tournamentId || !isAdmin) return;
    const activeSettings = overrideSettings || settings;
    const unplayedFixtures = fixtures.filter(f => !f.isPlayed);
    const playedFixtures = fixtures.filter(f => f.isPlayed);
    
    const futureFixtures = unplayedFixtures.filter(f => f.matchday >= matchday);
    const pastUnplayed = unplayedFixtures.filter(f => f.matchday < matchday);
    
    const selected = futureFixtures.filter(f => selectedFixtureIds.includes(f.id));
    const remaining = futureFixtures.filter(f => !selectedFixtureIds.includes(f.id));
    
    selected.forEach(f => f.matchday = matchday);
    
    const globalRestingDays = activeSettings.matchdaySettings?.restingDays || 0;
    const globalMatchesPerDay = activeSettings.matchdaySettings?.matchesPerDay || 0;
    
    const teamLastPlayedOn = new Map<string, number>();
    [...playedFixtures, ...pastUnplayed, ...selected].forEach(f => {
      const homeLast = teamLastPlayedOn.get(f.homeTeamId) || 0;
      const awayLast = teamLastPlayedOn.get(f.awayTeamId) || 0;
      teamLastPlayedOn.set(f.homeTeamId, Math.max(homeLast, f.matchday));
      teamLastPlayedOn.set(f.awayTeamId, Math.max(awayLast, f.matchday));
    });

    // Determine starting active settings based on previous matchdays
    let activeRestingDays = globalRestingDays;
    let activeMatchesPerDay = globalMatchesPerDay;
    let isMatchesPerDayAuto = globalMatchesPerDay === 0;
    
    const sortedCustom = [...(activeSettings.matchdaySettings?.customMatchdays || [])].sort((a, b) => a.matchday - b.matchday);
    
    let currentMatchday = matchday + 1;
    
    // Initialize active settings up to currentMatchday
    for (const custom of sortedCustom) {
      if (custom.matchday >= currentMatchday) break;
      if (custom.restingDays !== null && custom.restingDays !== undefined) activeRestingDays = custom.restingDays;
      if (custom.matchesPerDay !== null && custom.matchesPerDay !== undefined) {
        activeMatchesPerDay = custom.matchesPerDay;
        isMatchesPerDayAuto = false;
      }
    }

    // Sort queue by current matchday and order to preserve manual prioritization
    const queue = [...remaining].sort((a, b) => {
      if (a.matchday !== b.matchday) return a.matchday - b.matchday;
      return (a.order || 0) - (b.order || 0);
    });
    const newlyScheduled: Fixture[] = [];

    while (queue.length > 0) {
      // Update active settings for current day
      const customToday = activeSettings.matchdaySettings?.customMatchdays?.find(m => m.matchday === currentMatchday);
      
      // Inherit from previous day (which starts as global default), then override with custom if exists
      if (customToday) {
        if (customToday.restingDays !== null && customToday.restingDays !== undefined) activeRestingDays = customToday.restingDays;
        if (customToday.matchesPerDay !== null && customToday.matchesPerDay !== undefined) {
          activeMatchesPerDay = customToday.matchesPerDay;
          isMatchesPerDayAuto = false;
        }
      }

      let matchesToday = 0;
      const teamsPlayingToday = new Set<string>();
      let scheduledAnyToday = false;
      
      for (let i = 0; i < queue.length; i++) {
        const match = queue[i];
        const homeId = match.homeTeamId;
        const awayId = match.awayTeamId;
        
        const homeLastPlayed = teamLastPlayedOn.get(homeId) ?? -1000;
        const awayLastPlayed = teamLastPlayedOn.get(awayId) ?? -1000;
        
        const homeCanPlay = (currentMatchday - homeLastPlayed) > activeRestingDays;
        const awayCanPlay = (currentMatchday - awayLastPlayed) > activeRestingDays;
        const homeNotPlayingToday = !teamsPlayingToday.has(homeId);
        const awayNotPlayingToday = !teamsPlayingToday.has(awayId);
        
        // Respect matchesPerDay limit
        let matchesPerDayLimitNotReached = true;
        if (!isMatchesPerDayAuto) {
          matchesPerDayLimitNotReached = matchesToday < activeMatchesPerDay;
        }
        
        if (homeCanPlay && awayCanPlay && homeNotPlayingToday && awayNotPlayingToday && matchesPerDayLimitNotReached) {
          match.matchday = currentMatchday;
          match.order = matchesToday; // Assign order based on scheduling sequence
          newlyScheduled.push(match);
          queue.splice(i, 1);
          i--;
          
          matchesToday++;
          teamsPlayingToday.add(homeId);
          teamsPlayingToday.add(awayId);
          teamLastPlayedOn.set(homeId, currentMatchday);
          teamLastPlayedOn.set(awayId, currentMatchday);
          scheduledAnyToday = true;
        }
      }
      currentMatchday++;
      if (currentMatchday > 2000) break;
    }

    const allUpdatedFixtures = [...playedFixtures, ...pastUnplayed, ...selected, ...newlyScheduled];
    
    // Update settings if matchdays changed due to constraints
    const maxMatchday = allUpdatedFixtures.reduce((max, f) => Math.max(max, f.matchday), 0);
    if (maxMatchday > 0 && maxMatchday !== activeSettings.matchdaySettings?.numberOfMatchdays) {
      await setSettings(prev => ({
        ...prev,
        matchdaySettings: {
          ...(prev.matchdaySettings || { numberOfMatchdays: 0, customMatchdays: [] }),
          numberOfMatchdays: maxMatchday
        }
      }));
    }

    const pitches = activeSettings.pitches || [{ id: 'pitch-1', name: 'Pitch 1' }];
    const fixturesByMatchday: Record<number, Fixture[]> = {};
    allUpdatedFixtures.forEach(f => {
      if (!fixturesByMatchday[f.matchday]) fixturesByMatchday[f.matchday] = [];
      fixturesByMatchday[f.matchday].push(f);
    });

    Object.keys(fixturesByMatchday).forEach(dayStr => {
      const day = parseInt(dayStr);
      const dayFixtures = fixturesByMatchday[day];
      if (dayFixtures.some(f => !f.isPlayed)) {
        const matchdayIndex = day - 1;
        const date = getDateForMatchday(matchdayIndex, activeSettings);
        const startTime = getTimeForMatchday(matchdayIndex, activeSettings);
        dayFixtures.forEach(f => { if (!f.isPlayed) f.date = date; });
        scheduleMatchdayMatches(dayFixtures.filter(f => !f.isPlayed), pitches, startTime || '09:00');
      }
    });

    try {
      const batch = writeBatch(db);
      allUpdatedFixtures.forEach(f => {
        batch.set(doc(db, `users/${tournamentId}/fixtures`, f.id), { ...f, userId: tournamentId });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${tournamentId}/fixtures`);
    }
  };

  const rescheduleFixtures = async (overrideSettings?: Settings) => {
    if (!tournamentId || !isAdmin || fixtures.length === 0) return;
    const unplayed = fixtures.filter(f => !f.isPlayed);
    if (unplayed.length === 0) return;
    
    const firstUnplayedMatchday = Math.min(...unplayed.map(f => f.matchday));
    await reassignFixturesFromMatchday(firstUnplayedMatchday - 1, [], overrideSettings);
  };

  const toggleRole = async () => {
    if (!authUserId) return;
    const newRole = userRole === 'admin' ? 'viewer' : 'admin';
    const path = `users/${authUserId}`;
    try {
      await setDoc(doc(db, 'users', authUserId), { role: newRole }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      console.log("Auth state changed:", user?.email);
      setCurrentUser(user);
      setAuthUserId(user?.uid || null);
      setCurrentUserEmail(user?.email || null);
      
      if (!publicTournamentId) {
        setTournamentId(user?.uid || null);
      }

      if (user) {
        // Initialize user profile if it doesn't exist
        const userRef = doc(db, 'users', user.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: user.uid,
              email: user.email,
              name: (user.displayName || 'User').substring(0, 100),
              role: 'viewer'
            });
          }
        } catch (error) {
          console.error("Error initializing user profile:", error);
        }
      } else {
        if (!publicTournamentId) {
          setTeams([]);
          setGroups([]);
          setFixtures([]);
        }
      }
    });
    return () => unsubscribe();
  }, [publicTournamentId]);

  return {
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
    deleteTournament,
    addGroup,
    deleteGroup,
    generateFixtures,
    regenerateUnplayedFixtures,
    addManualFixture,
    updateFixture,
    updateFixtureTeams,
    updateFixtureDetails,
    updateMatchdayDate,
    updateMatchdayTitle,
    toggleFixtureStarted,
    toggleFixturePlayed,
    getLeagueTable,
    generateKnockoutFixtures,
    seedGroupStageResults,
    seedKnockoutResults,
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
    publish,
    lastPublished,
    isPublishing,
    loading,
    userId: tournamentId, // Maintain backward compatibility for UI
    authUserId,
    tournamentId,
    isAdmin,
    isGlobalAdmin,
    isSuperAdmin,
    userRole,
    currentUser
  };
}
