/**
 * Contenido de la página /liga — Liga Tica.
 *
 * Bloque único y tipado: quien gestiona la liga cambia temporada, fechas, textos o
 * el CTA editando solo este objeto y haciendo redeploy, sin tocar el JSX de la
 * página (src/client/pages/Liga.tsx).
 */
export interface LigaContent {
    /** Temporada vigente, p. ej. "Temporada 2". */
    temporada: string
    /** Fecha de inicio de la temporada, tal como se muestra. */
    fechaInicio: string
    /** Cierre de inscripciones, tal como se muestra. */
    cierreInscripciones: string
    /** Ritmo de la liga, p. ej. "2 partidas semanales". */
    partidasSemanales: string
    /** URL del challenge de inscripciones. */
    ctaUrl: string
    /** Instante exacto de inicio (ISO 8601 con zona de Costa Rica): destino del contador. */
    inicioISO: string
    /** Instante en que cierran las inscripciones (ISO 8601 con zona de Costa Rica). */
    cierreInscripcionesISO: string
    /** Textos fijos de la página. */
    textos: {
        titulo: string
        descripcion: string
        etiquetaInicio: string
        etiquetaCierre: string
        contadorTitulo: string
        inscripcionesAbiertas: string
        inscripcionesCerradas: string
        enCurso: string
        ctaInscripcion: string
        ctaEnCurso: string
    }
}

export const liga: LigaContent = {
    temporada: 'Temporada 2',
    fechaInicio: '28 de octubre',
    cierreInscripciones: '22 de octubre',
    partidasSemanales: '2 partidas semanales',
    ctaUrl: 'https://tico-devcr.github.io/sc2-ligatica-divisiones/',
    // Las semanas de la liga van de miércoles a martes; el 28/10/2026 es miércoles.
    inicioISO: '2026-10-28T00:00:00-06:00',
    cierreInscripcionesISO: '2026-10-22T23:59:59-06:00',
    textos: {
        titulo: 'Liga Tica',
        descripcion: 'La liga anual de StarCraft II de Costa Rica.',
        etiquetaInicio: 'Inicio de temporada',
        etiquetaCierre: 'Cierre de inscripciones',
        contadorTitulo: 'Arranca en',
        inscripcionesAbiertas: 'Inscripciones abiertas',
        inscripcionesCerradas: 'Inscripciones cerradas',
        enCurso: 'Temporada en curso',
        ctaInscripcion: 'Inscribirme al challenge',
        ctaEnCurso: 'Ver tabla y partidas',
    },
}
