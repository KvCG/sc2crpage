/**
 * Constants for Community Stats filters
 * Extracted from component for better maintainability
 */

export const TIMEFRAME_OPTIONS = [
    { value: 'current', label: 'Current' },
    { value: 'daily', label: 'Daily' }
] as const

export const RACE_OPTIONS = [
    { value: 'all', label: 'All Races' },
    { value: 'TERRAN', label: 'Terran' },
    { value: 'PROTOSS', label: 'Protoss' }, 
    { value: 'ZERG', label: 'Zerg' },
    { value: 'RANDOM', label: 'Random' }
] as const

export const DEFAULT_FILTERS = {
    timeframe: 'current' as const,
    includeInactive: false,
    minimumGames: 20,
    selectedRace: null
}

export const MINIMUM_GAMES_LIMITS = {
    min: 0,
    max: 1000,
    step: 1
} as const