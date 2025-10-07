/**
 * Centralized Color Token System for SC2CR
 * 
 * Single source of truth for all colors used across the Community module and shared components.
 * Colors are extracted from SVG assets and user requirements to maintain visual consistency.
 * 
 * Usage:
 *   - Chart.js: backgroundColor: RACE_COLORS.TERRAN
 *   - CSS-in-JS: color: LEAGUE_COLORS.GRANDMASTER
 *   - CSS Variables: var(--color-race-terran)
 */

// Race colors extracted from SVG assets (authentic SC2 colors)
export const RACE_COLORS = {
  TERRAN: '#295a91',   // Blue - from terran.svg
  PROTOSS: '#dec93e',  // Gold - from protoss.svg  
  ZERG: '#882991',     // Purple - from zerg.svg
  RANDOM: '#fff4b6',   // Cream - from random.svg
} as const

// League colors as requested by user
export const LEAGUE_COLORS = {
  BRONZE: '#8C4B24',
  SILVER: '#A7A7A7', 
  GOLD: '#D6B14A',
  PLATINUM: '#4BC1B1',
  DIAMOND: '#2A94F4',
  MASTER: '#6B47E5',
  GRANDMASTER: '#C21E1E',
} as const

// League colors mapped by league ID (0-6)
export const LEAGUE_COLORS_BY_ID = {
  '0': LEAGUE_COLORS.BRONZE,
  '1': LEAGUE_COLORS.SILVER,
  '2': LEAGUE_COLORS.GOLD,
  '3': LEAGUE_COLORS.PLATINUM,
  '4': LEAGUE_COLORS.DIAMOND,
  '5': LEAGUE_COLORS.MASTER,
  '6': LEAGUE_COLORS.GRANDMASTER,
} as const

// League names for display
export const LEAGUE_NAMES = {
  '0': 'Bronze',
  '1': 'Silver', 
  '2': 'Gold',
  '3': 'Platinum',
  '4': 'Diamond',
  '5': 'Master',
  '6': 'GM',
} as const

// Chart.js compatible arrays (ordered for consistent display)
export const RACE_COLOR_ARRAY = [
  RACE_COLORS.TERRAN,
  RACE_COLORS.PROTOSS,
  RACE_COLORS.ZERG,
  RACE_COLORS.RANDOM,
] as const

export const LEAGUE_COLOR_ARRAY = [
  LEAGUE_COLORS.GRANDMASTER,
  LEAGUE_COLORS.MASTER,
  LEAGUE_COLORS.DIAMOND,
  LEAGUE_COLORS.PLATINUM,
  LEAGUE_COLORS.GOLD,
  LEAGUE_COLORS.SILVER,
  LEAGUE_COLORS.BRONZE,
] as const

// Chart theme colors for consistency across all charts
export const CHART_THEME = {
  BACKGROUND: '#25262b',           // Mantine dark-4
  GRID_COLOR: 'rgba(255, 255, 255, 0.1)',
  TEXT_COLOR: '#c1c2c5',          // Mantine gray-4
  BORDER_COLOR: '#373a40',        // Mantine dark-3
  TOOLTIP_BG: '#25262b',
  TOOLTIP_BORDER: '#373a40',
  HOVER_BORDER: '#ffffff',
  AXIS_TEXT: '#909296',           // Mantine gray-6
} as const

// Activity level colors for activity distribution charts
export const ACTIVITY_COLORS = {
  NO_GAMES: '#868e96',            // Gray
  LOW_ACTIVITY: '#fab005',        // Yellow
  MODERATE_ACTIVITY: '#51cf66',   // Green
  HIGH_ACTIVITY: '#228be6',       // Blue
} as const

// League assets for icons
import bronze from '../client/assets/Bronze.png'
import silver from '../client/assets/Silver.png'
import gold from '../client/assets/Gold.png'
import platinum from '../client/assets/Platinum.png'
import diamond from '../client/assets/Diamond.png'
import master from '../client/assets/Master.png'
import grandmaster from '../client/assets/Grandmaster.png'

export const LEAGUE_ASSETS = {
  '0': bronze,
  '1': silver,
  '2': gold,
  '3': platinum,
  '4': diamond,
  '5': master,
  '6': grandmaster,
} as const

// Utility functions for safe color access
export const getRaceColor = (race: keyof typeof RACE_COLORS): string => {
  return RACE_COLORS[race] || RACE_COLORS.RANDOM
}

export const getLeagueColor = (leagueId: string | number): string => {
  const id = String(leagueId) as keyof typeof LEAGUE_COLORS_BY_ID
  return LEAGUE_COLORS_BY_ID[id] || LEAGUE_COLORS.BRONZE
}

export const getLeagueName = (leagueId: string | number): string => {
  const id = String(leagueId) as keyof typeof LEAGUE_NAMES
  return LEAGUE_NAMES[id] || `League ${id}`
}

export const getLeagueIcon = (leagueId: string | number): string => {
  const id = String(leagueId) as keyof typeof LEAGUE_ASSETS
  return LEAGUE_ASSETS[id] || LEAGUE_ASSETS['0']
}

// Type definitions for TypeScript support
export type RaceType = keyof typeof RACE_COLORS
export type LeagueType = keyof typeof LEAGUE_COLORS
export type ActivityLevel = keyof typeof ACTIVITY_COLORS