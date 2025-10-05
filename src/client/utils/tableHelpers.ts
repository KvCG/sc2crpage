import type { ColumnOptions } from '../components/Table/TableColumnFilters'

/**
 * Table utility functions for consistent table rendering behavior
 */

/**
 * Default column visibility configuration for desktop
 */
export const DEFAULT_VISIBLE_COLUMNS: ColumnOptions = {
    top: true,
    name: true,
    mmr: true,
    rank: true,
    race: true,
    lastPlayed: true,
    terran: false,
    protoss: false,
    zerg: false,
    random: false,
    total: true,
}

/**
 * Compact column visibility configuration for mobile/small screens
 */
export const COMPACT_VISIBLE_COLUMNS: ColumnOptions = {
    top: true,
    name: true,
    mmr: true,
    rank: false,
    race: true,
    lastPlayed: false,
    terran: false,
    protoss: false,
    zerg: false,
    random: false,
    total: false,
}

/**
 * Gets appropriate column configuration based on screen size
 */
export function getInitialColumnConfig(isSmallScreen: boolean): ColumnOptions {
    return isSmallScreen ? COMPACT_VISIBLE_COLUMNS : DEFAULT_VISIBLE_COLUMNS
}

/**
 * Formats position change indicator text
 */
export function formatPositionChange(
    positionChangeIndicator: string,
    positionDelta?: number
): { arrow: string; deltaText: string } {
    const arrow = positionChangeIndicator === 'up' ? '▲' : positionChangeIndicator === 'down' ? '▼' : ''
    const deltaText =
        positionChangeIndicator !== 'none' && 
        typeof positionDelta === 'number' && 
        Math.abs(positionDelta) > 0
            ? ` ${Math.abs(positionDelta)}`
            : ''

    return { arrow, deltaText }
}