/**
 * CSV Display Names Utility
 * 
 * Simple utility to get display names from the CSV data.
 * This acts as a bridge between the old getDisplayName pattern
 * and the new pulseService approach.
 */

import { pulseService } from '../services/pulseService'

/**
 * Get display name for a character ID from CSV data
 * @param characterId - The character ID to look up
 * @returns The display name or null if not found
 */
export function getDisplayName(characterId: string | number | undefined): string | null {
    return pulseService.getDisplayNameFromCsv(characterId)
}