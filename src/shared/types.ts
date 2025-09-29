// Type definitions for cleaner interface

export interface TeamStats {
    members: Member[]
    rating: number
    league: { type: string }
    lastPlayed: string
}
export interface RankingPlayer {
    lastPlayed: string | null
    playerCharacterId: number
    btag?: string
    name?: string
    race: string | null
    ratingLast: number | null
    leagueTypeLast: string | null
    gamesThisSeason: number
    gamesPerRace: Record<string, number>
    lastDatePlayed: string | null
    online: boolean
    positionChangeIndicator?: 'up' | 'down' | 'none'
}

export interface RankedPlayer {
    rating: number[]
    wins: number[]
    ties: number[]
    losses: number[]
    leagueType: number[]
    globalRank: number[]
    regionRank: number[]
    leagueRank: number[]
    lastPlayed: string[]
    members: Member
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
    character: {
        id: number
    }
    account: Account
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