export type PulseMember = {
    account: { battleTag: string }
    character: { id: string }
    clan?: { tag: string }
    terranGamesPlayed?: number
    zergGamesPlayed?: number
    protossGamesPlayed?: number
}

export type PulseCurrentStats = {
    leagueTypeLast: string
    ratingLast: number
    ratingAvg: number
    wins?: number
    losses?: number
}

export type PulseGroupTeamEntry = {
    leagueMax: string
    ratingMax: number
    totalGamesPlayed: number
    currentStats: PulseCurrentStats
    members: PulseMember
}

export const exampleGroupTeamEntry: PulseGroupTeamEntry = {
    leagueMax: 'Master',
    ratingMax: 4500,
    totalGamesPlayed: 500,
    currentStats: {
        leagueTypeLast: 'Master',
        ratingLast: 4300,
        ratingAvg: 4200,
        wins: 250,
        losses: 200,
    },
    members: {
        account: { battleTag: 'Neo#111' },
        character: { id: '12345' },
        clan: { tag: 'CR' },
        terranGamesPlayed: 100,
        zergGamesPlayed: 200,
        protossGamesPlayed: 200,
    },
}

export const exampleCharacterSearchEntry: PulseGroupTeamEntry = {
    leagueMax: 'Diamond',
    ratingMax: 4100,
    totalGamesPlayed: 300,
    currentStats: {
        leagueTypeLast: 'Diamond',
        ratingLast: 3950,
        ratingAvg: 3900,
    },
    members: {
        account: { battleTag: 'Ker#222' },
        character: { id: '67890' },
        clan: { tag: 'CR' },
        terranGamesPlayed: 120,
        zergGamesPlayed: 90,
        protossGamesPlayed: 90,
    },
}

export function buildGroupTeamEntry(
    overrides?: Partial<PulseGroupTeamEntry>
): PulseGroupTeamEntry {
    return {
        ...exampleGroupTeamEntry,
        ...overrides,
        currentStats: {
            ...exampleGroupTeamEntry.currentStats,
            ...overrides?.currentStats,
        },
        members: { ...exampleGroupTeamEntry.members, ...overrides?.members },
    }
}

export function buildCharacterSearchEntry(
    overrides?: Partial<PulseGroupTeamEntry>
): PulseGroupTeamEntry {
    return {
        ...exampleCharacterSearchEntry,
        ...overrides,
        currentStats: {
            ...exampleCharacterSearchEntry.currentStats,
            ...overrides?.currentStats,
        },
        members: {
            ...exampleCharacterSearchEntry.members,
            ...overrides?.members,
        },
    }
}
