import crypto from 'crypto'

// Single source of truth for request identity resolution
export function extractRequestId(req: any, res?: any): string | undefined {
    return (
        (req?.headers?.['x-request-id'] as string) ||
        (res?.getHeader?.('x-request-id') as string) ||
        (req?.headers?.['x-correlation-id'] as string) ||
        (req?.id as string) ||
        undefined
    )
}

// Resolve incoming correlation id or create a new one (always returns a value)
export function resolveOrCreateCorrelationId(req: any): string {
    const incoming = (req?.headers?.['x-correlation-id'] as string) || ''
    if (incoming) return incoming
    return (
        (crypto as any).randomUUID?.() ||
        crypto.randomBytes(16).toString('hex')
    )
}

export default extractRequestId
