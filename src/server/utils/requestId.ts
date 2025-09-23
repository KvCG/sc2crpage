// Purpose: single source of truth to extract a request id
// Why: keep logging/observability consistent and avoid duplication/cycles
export function extractRequestId(req: any, res?: any): string | undefined {
    return (
        (req?.headers?.['x-request-id'] as string) ||
        (res?.getHeader?.('x-request-id') as string) ||
        (req?.headers?.['x-correlation-id'] as string) ||
        (req?.id as string) ||
        undefined
    )
}

export default extractRequestId
