/**
 * Contenido de la página /liga — Liga Tica.
 *
 * Bloque único y tipado: quien gestiona la liga cambia temporada, fechas o el
 * CTA editando solo este objeto y haciendo redeploy, sin tocar el JSX de la
 * página (src/client/pages/Liga.tsx).
 */
export interface LigaContent {
    /** Temporada vigente, p. ej. "Temporada 2". */
    temporada: string
    /** Fecha de inicio de la temporada. */
    fechaInicio: string
    /** Cierre de inscripciones. */
    cierreInscripciones: string
    /** Ritmo de la liga, p. ej. "2 partidas semanales". */
    partidasSemanales: string
    /** URL del challenge de inscripciones. */
    ctaUrl: string
}

export const liga: LigaContent = {
    temporada: 'Temporada 2',
    fechaInicio: '28 de octubre',
    cierreInscripciones: '22 de octubre',
    partidasSemanales: '2 partidas semanales',
    ctaUrl: 'https://tico-devcr.github.io/sc2-ligatica-divisiones/',
}
