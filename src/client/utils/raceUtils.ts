import type { DecoratedRow } from './rankingHelper'

/**
 * Race utility functions for consistent race handling across components
 */

export interface RaceCount {
    [race: string]: number
}

/**
 * Normalizes race string to uppercase for consistent usage
 */
export function normalizeRace(race: string): string {
    return race.toUpperCase()
}

/**
 * Counts occurrences of each race in player data
 */
export function countRaces(data: DecoratedRow[]): RaceCount {
    return data.reduce((acc, player) => {
        if (player.mainRace) {
            const normalizedRace = normalizeRace(player.mainRace)
            acc[normalizedRace] = (acc[normalizedRace] || 0) + 1
        }
        return acc
    }, {} as RaceCount)
}

/**
 * Filters player data by race
 */
export function filterByRace(data: DecoratedRow[], race: string): DecoratedRow[] {
    const normalizedRace = normalizeRace(race)
    return data.filter((player) => normalizeRace(player.mainRace) === normalizedRace)
}

/**
 * Gets display name for race (lowercase for alt text, etc.)
 */
export function getRaceDisplayName(race: string): string {
    return race.toLowerCase()
}