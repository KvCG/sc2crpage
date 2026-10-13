import { useEffect, useState } from 'react'

/** Hora actual (ms) que se refresca cada `intervalMs`; alimenta contadores en vivo. */
export const useNow = (intervalMs = 1000) => {
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), intervalMs)
        return () => clearInterval(id)
    }, [intervalMs])
    return now
}
