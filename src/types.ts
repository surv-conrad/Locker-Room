export interface Player {
  id: string;
  name: string;
  number: string;
  position: string;
  photoUrl?: string;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  isActive?: boolean;
  pitchPosition?: { x: number; y: number };
}

export interface Group {
  id: string;
  name: string;
}

export interface Team {
  id: string;
  name: string;
  initial: string;
  manager: string;
  phone: string;
  players: Player[];
  groupId?: string;
  pitchSize?: { width: number; height: number };
  pitchScrollPosition?: { x: number; y: number };
}

export interface MatchEvent {
  id: string;
  fixtureId: string;
  teamId: string;
  playerId: string;
  type: 'goal' | 'yellow_card' | 'red_card';
  minute: number;
}

export interface Fixture {
  id: string;
  matchday: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  isPlayed: boolean;
  isStarted: boolean;
  date: string;
  time?: string;
  pitchId?: string;
  groupId?: string;
  events?: MatchEvent[];
}

export interface PlayerStat {
  playerId: string;
  teamId: string;
  playerName: string;
  teamName: string;
  goals: number;
  yellowCards: number;
  redCards: number;
  matchesPlayed: number;
}

export interface Pitch {
  id: string;
  name: string;
}

export interface StageSettings {
  numberOfWinners: number;
  numberOfLegs: 1 | 2;
}

export interface Settings {
  logoUrl: string;
  startDate: string;
  tournamentName?: string;
  description?: string;
  numberOfTeams?: number;
  numberOfPitches: number;
  pitches: Pitch[];
  tieBreaker?: 'goalDifference' | 'headToHead' | 'fairPlay';
  primaryColor?: string;
  matchdaySettings?: {
    numberOfMatchdays: number;
    matchesPerDay?: number;
    restingDays?: number;
    customMatchdays: { 
      matchday: number; 
      date: string; 
      time?: string;
      matchesPerDay?: number;
      restingDays?: number;
    }[];
  };
  groupStage: StageSettings;
  knockoutStage: StageSettings;
  playerSettings?: {
    maxPlayersPerTeam: number;
    activePlayersPerSide: number;
    maxSubs: number;
  };
}

export interface LeagueRow {
  teamId: string;
  teamName: string;
  groupId?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}
