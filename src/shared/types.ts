// Type definitions for cleaner interface

export interface TeamStats {
    members: Member[]
    rating: number
    league: { type: string }
    lastPlayed: string
}
export interface RankedPlayer {
    // Core identity
    btag: string | undefined
    name: string
    discriminator: number | undefined
    id: number | undefined   //Character ID
    clan?: Clan | null       //Clan info if available
    
    // Game statistics 
    rating: number[] | number
    wins: number[] | number
    losses: number[] | number
    ties: number[] | number
    leagueType: number[] | number
    globalRank: number[] | number
    regionRank: number[] | number
    leagueRank: number[] | number
    
    
    // Activity tracking
    lastPlayed: string[] | string
    online: boolean
    
    // Race and games
    mainRace?: string
    totalGames?: number
    gamesPerRace: RaceGames
    
    // UI enhancements
    lastDatePlayed: string  // Human-readable format
    positionChangeIndicator?: 'up' | 'down' | 'none'
    
    // Metadata
    members?: Member  // Keep for detailed character info
}

export interface Account {
    battleTag: string
    id: number
    tag: string
    discriminator: number
}

export interface Clan {
    tag: string
    name: string
    members: number
    activeMembers: number
    avgRating: number
    avgLeagueType: number
    games: number
}

export interface RaceGames {
    RANDOM?: number
    PROTOSS?: number
    TERRAN?: number
    ZERG?: number
}

export interface Member {
    randomGamesPlayed?: number
    protossGamesPlayed?: number
    terranGamesPlayed?: number
    zergGamesPlayed?: number
    character?: {
        id: number
        name: string
    }
    account?: Account
    clan: Clan | null
    raceGames?: RaceGames
}

export interface SeasonEntry {
    id: number        // battlenetId — SC2 season identifier
    year: number
    number: number    // season number within the year
    start: string     // ISO datetime
    end: string       // ISO datetime
}

export interface Team {
    rating: number
    wins: number
    losses: number
    ties: number
    id: number
    legacyId: string
    divisionId: number
    season: number
    region: string
    league: {
        type: number
        queueType: number
        teamType: number
    }
    globalRank: number
    regionRank: number
    leagueRank: number
    lastPlayed: string
    joined: string
    primaryDataUpdated: string
    members: Member[]
    globalTeamCount: number
    regionTeamCount: number
    leagueTeamCount: number
    queueType: number
    teamType: number
    leagueType: number
    legacyUid: string
}

export interface H2HMatch {
    matchId: number | string
    date: string
    map: string
    durationSeconds: number
    region: string
    type: string
    winnerCharacterId: number
    player1RatingChange: number | null
    player2RatingChange: number | null
    player1RatingAtTime: number | null
    player2RatingAtTime: number | null
    source: 'pulse' | 'manual' | 'blizzard'
    addedBy?: string
    isVoided: boolean
    matchLabel: 'showmatch' | 'tournament' | null
}

export type MatchFlagType = 'void' | 'showmatch' | 'tournament'
export type MatchFlagStatus = 'pending' | 'approved' | 'rejected'

export interface H2HMatchFlag {
    id: number
    matchDbId: number
    flagType: MatchFlagType
    reason: string | null
    submittedBy: string
    status: MatchFlagStatus
    adminNote: string | null
    reviewedBy: string | null
    createdAt: string
    reviewedAt: string | null
}

export interface H2HFlagWithMatch extends H2HMatchFlag {
    match: Pick<H2HMatch, 'matchId' | 'date' | 'map' | 'winnerCharacterId' | 'type'>
    player1CharacterId: number
    player2CharacterId: number
}

export interface H2HPairRecord {
    player1CharacterId: number
    player2CharacterId: number
    pulseSyncedAt: string
    nextCursor: string | null
    matches: H2HMatch[]
}

export interface H2HPlayerMeta {
    characterId: number
    btag: string
    name?: string
}

export interface H2HResponse {
    player1: H2HPlayerMeta
    player2: H2HPlayerMeta
    summary: {
        player1Wins: number
        player2Wins: number
        totalGames: number
        voidedCount: number
        lastPlayed: string | null
    }
    matches: H2HMatch[]
}