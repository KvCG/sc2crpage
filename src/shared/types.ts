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
    }
    account?: Account
    clan: Clan | null
    raceGames?: RaceGames
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