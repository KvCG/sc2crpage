/**
 * Centralized H2H Custom Match Configuration
 * 
 * Single source of truth for all Head-to-Head custom match ingestion settings.
 * Consolidates scattered environment variables with consistent naming and validation.
 */

import { MatchConfidence } from '../../shared/customMatchTypes'

/**
 * Complete H2H system configuration
 */
export interface H2HConfig {
    /** Date cutoff for match discovery (ISO date string) */
    cutoffDate: string
    /** Minimum confidence level for storing matches */
    minConfidence: MatchConfidence
    /** Polling interval for scheduled ingestion (seconds) */
    pollIntervalSeconds: number
    /** Batch size for processing matches */
    batchSize: number
    /** Days to look back for match discovery */
    lookbackDays: number
    /** Maximum concurrent API requests */
    maxConcurrentRequests: number
    /** Maximum matches per storage file */
    maxMatchesPerFile: number
    /** Deduplication retention (days) */
    dedupeRetentionDays: number
    /** Memory cache size limit for deduplication */
    cacheLimit: number
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: H2HConfig = {
    cutoffDate: '2025-10-08',
    minConfidence: 'low' as MatchConfidence,
    pollIntervalSeconds: 900, // 15 minutes
    batchSize: 50,
    lookbackDays: 7,
    maxConcurrentRequests: 5,
    maxMatchesPerFile: 1000,
    dedupeRetentionDays: 7,
    cacheLimit: 10000,
}

/**
 * Validate confidence level from environment
 */
function validateConfidence(value: string): MatchConfidence {
    const validLevels: MatchConfidence[] = ['low', 'medium', 'high']
    if (validLevels.includes(value as MatchConfidence)) {
        return value as MatchConfidence
    }
    return DEFAULT_CONFIG.minConfidence
}

/**
 * Parse numeric environment variable with fallback
 */
function parseNumber(value: string | undefined, fallback: number): number {
    if (!value) return fallback
    const parsed = Number(value)
    return isNaN(parsed) ? fallback : parsed
}

/**
 * Load and validate H2H configuration from environment
 */
export function getH2HConfig(): H2HConfig {
    return {
        cutoffDate: process.env.H2H_CUSTOM_CUTOFF || DEFAULT_CONFIG.cutoffDate,
        minConfidence: validateConfidence(process.env.H2H_CUSTOM_MIN_CONFIDENCE || ''),
        pollIntervalSeconds: parseNumber(process.env.H2H_POLL_INTERVAL_SEC, DEFAULT_CONFIG.pollIntervalSeconds),
        batchSize: parseNumber(process.env.H2H_BATCH_SIZE, DEFAULT_CONFIG.batchSize),
        lookbackDays: parseNumber(process.env.H2H_LOOKBACK_DAYS, DEFAULT_CONFIG.lookbackDays),
        maxConcurrentRequests: parseNumber(process.env.H2H_MAX_CONCURRENT, DEFAULT_CONFIG.maxConcurrentRequests),
        maxMatchesPerFile: parseNumber(process.env.H2H_MAX_MATCHES_PER_FILE, DEFAULT_CONFIG.maxMatchesPerFile),
        dedupeRetentionDays: parseNumber(process.env.H2H_DEDUPE_RETENTION_DAYS, DEFAULT_CONFIG.dedupeRetentionDays),
        cacheLimit: parseNumber(process.env.H2H_CACHE_LIMIT, DEFAULT_CONFIG.cacheLimit),
    }
}

/**
 * Validate required environment variables for H2H system
 */
export function validateH2HEnvironment(): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check for Google Drive service account
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        errors.push('GOOGLE_SERVICE_ACCOUNT_KEY is required for Drive storage')
    }

    // Validate date format
    const config = getH2HConfig()
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(config.cutoffDate)) {
        errors.push(`Invalid cutoff date format: ${config.cutoffDate}. Expected YYYY-MM-DD`)
    }

    // Validate ranges
    if (config.pollIntervalSeconds < 60) {
        errors.push('Poll interval must be at least 60 seconds')
    }

    if (config.batchSize < 1 || config.batchSize > 1000) {
        errors.push('Batch size must be between 1 and 1000')
    }

    return {
        isValid: errors.length === 0,
        errors,
    }
}

/**
 * Get environment variable summary for status endpoints
 */
export function getH2HEnvironmentInfo() {
    const config = getH2HConfig()
    return {
        cutoffDate: config.cutoffDate,
        minConfidence: config.minConfidence,
        pollInterval: config.pollIntervalSeconds,
        batchSize: config.batchSize,
        hasServiceAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    }
}