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
