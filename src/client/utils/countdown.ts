export interface TimeLeft {
    days: number
    hours: number
    minutes: number
    seconds: number
    /** Milisegundos restantes; 0 cuando el destino ya pasó. */
    totalMs: number
}

/** Tiempo que falta desde `now` hasta `target`, desglosado; nunca negativo. */
export const timeLeft = (target: Date | number, now: Date | number): TimeLeft => {
    const totalMs = Math.max(0, +target - +now)
    const totalSeconds = Math.floor(totalMs / 1000)
    return {
        days: Math.floor(totalSeconds / 86400),
        hours: Math.floor((totalSeconds % 86400) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
        totalMs,
    }
}

/** Dos dígitos para horas/minutos/segundos del contador. */
export const pad2 = (n: number) => String(n).padStart(2, '0')
