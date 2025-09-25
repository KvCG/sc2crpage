export type LadderRow = {
    id: string
    btag: string
    name?: string
    challongeId?: string
}

export const ladderRowNeo: LadderRow = {
    id: '111',
    btag: 'Neo#111',
    name: 'Neo',
    challongeId: '111',
}

export const ladderRowKer: LadderRow = {
    id: '222',
    btag: 'Ker#222',
}

export function buildLadderRow(overrides?: Partial<LadderRow>): LadderRow {
    return { id: '999', btag: 'User#999', ...overrides }
}
