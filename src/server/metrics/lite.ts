// Add comments to explain the metrics being tracked

export const metrics = {
    http_total: 0, // Total number of HTTP requests
    http_5xx_total: 0, // Total number of HTTP 5xx errors
    pulse_req_total: 0, // Total number of pulse requests
    cache_hit_total: 0, // Total number of cache hits
    cache_miss_total: 0, // Total number of cache misses
    pulse_err_total: {
        timeout: 0,
        http4xx: 0,
        http5xx: 0,
        network: 0,
        other: 0,
    } as Record<string, number>,
    // latency bins in ms: <100, <250, <500, <1000, <2000, >=2000
    pulse_latency_bins: [0, 0, 0, 0, 0, 0],
    // Analytics-specific metrics
    analytics_req_total: 0, // Total analytics requests
    analytics_cache_hit_total: 0, // Analytics cache hits
    analytics_cache_miss_total: 0, // Analytics cache misses
    analytics_rate_limit_total: 0, // Rate limited analytics requests
    analytics_feature_disabled_total: 0, // Requests blocked by feature flags
    analytics_err_total: {
        validation: 0,
        service: 0,
        network: 0,
        other: 0,
    } as Record<string, number>,
    // Analytics latency bins in ms: <250, <500, <1000, <2000, <5000, >=5000
    analytics_latency_bins: [0, 0, 0, 0, 0, 0],
}

// Upper bounds for bins (ms); last bin is open-ended
const BOUNDS: number[] = [100, 250, 500, 1000, 2000]

export function observePulseLatency(ms: number) {
    let idx = BOUNDS.findIndex(b => ms < b)
    if (idx < 0) idx = metrics.pulse_latency_bins.length - 1
    metrics.pulse_latency_bins[idx]++
}

export function estimateQuantile(q: number): number {
    const counts = metrics.pulse_latency_bins
    const total = counts.reduce((a, b) => a + b, 0)
    if (total === 0) return 0
    const target = Math.ceil(total * q)
    let cum = 0
    for (let i = 0; i < counts.length; i++) {
        cum += counts[i]
        if (cum >= target) {
            return i < BOUNDS.length ? BOUNDS[i] : 3000
        }
    }
    return 3000
}

// Analytics-specific bounds (ms): <250, <500, <1000, <2000, <5000, >=5000
const ANALYTICS_BOUNDS: number[] = [250, 500, 1000, 2000, 5000]

export function observeAnalyticsLatency(ms: number) {
    let idx = ANALYTICS_BOUNDS.findIndex(b => ms < b)
    if (idx < 0) idx = metrics.analytics_latency_bins.length - 1
    metrics.analytics_latency_bins[idx]++
}

/**
 * Estimates the latency quantile for analytics requests.
 * @param quantile - The quantile to estimate (e.g., 0.5 for p50).
 * @returns The upper bound of the latency bin corresponding to the quantile.
 */
export function estimateAnalyticsQuantile(quantile: number): number {
    const latencyBins = metrics.analytics_latency_bins
    const totalCount = latencyBins.reduce((sum, count) => sum + count, 0)
    if (totalCount === 0) return 0

    const targetCount = Math.ceil(totalCount * quantile)
    let cumulative = 0

    for (let i = 0; i < latencyBins.length; i++) {
        cumulative += latencyBins[i]
        if (cumulative >= targetCount) {
            // Return the upper bound for this bin, or 6000ms for the last bin
            return i < ANALYTICS_BOUNDS.length ? ANALYTICS_BOUNDS[i] : 6000
        }
    }
    // Fallback in case all bins are empty (should not happen)
    return 6000
}

// Analytics metrics helpers
export function incrementAnalyticsRequest() {
    metrics.analytics_req_total++
}

export function incrementAnalyticsCacheHit() {
    metrics.analytics_cache_hit_total++
}

export function incrementAnalyticsCacheMiss() {
    metrics.analytics_cache_miss_total++
}

export function incrementAnalyticsRateLimit() {
    metrics.analytics_rate_limit_total++
}

export function incrementAnalyticsFeatureDisabled() {
    metrics.analytics_feature_disabled_total++
}

export function incrementAnalyticsError(
    errorType: 'validation' | 'service' | 'network' | 'other'
) {
    metrics.analytics_err_total[errorType]++
}

// Analytics performance summary
export function getAnalyticsMetricsSummary() {
    const totalRequests = metrics.analytics_req_total

    const cacheHitRate =
        totalRequests > 0
            ? (metrics.analytics_cache_hit_total / totalRequests) * 100
            : 0

    const totalErrors = Object.values(metrics.analytics_err_total).reduce(
        (sum, count) => sum + count,
        0
    )

    const errorRate =
        totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0

    const p50Latency = estimateAnalyticsQuantile(0.5)
    const p95Latency = estimateAnalyticsQuantile(0.95)
    const p99Latency = estimateAnalyticsQuantile(0.99)

    return {
        totalRequests,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
        rateLimitBlocked: metrics.analytics_rate_limit_total,
        featureDisabledBlocked: metrics.analytics_feature_disabled_total,
        errorRate: Math.round(errorRate * 100) / 100,
        p50Latency,
        p95Latency,
        p99Latency,
    }
}
