import { useState, useEffect } from 'react'
import type { ColumnOptions } from '../components/Table/TableColumnFilters'

/**
 * Custom hook for persisting column visibility preferences in localStorage
 * Follows established hooks pattern from hooks/useFetch.tsx
 */

const STORAGE_KEY = 'visibleColumns'

export function usePersistedColumns(initialColumns: ColumnOptions) {
    const [visibleColumns, setVisibleColumns] = useState<ColumnOptions>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            return stored ? JSON.parse(stored) as ColumnOptions : initialColumns
        } catch (error) {
            console.warn('Failed to parse stored column preferences:', error)
            return initialColumns
        }
    })

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns))
        } catch (error) {
            console.warn('Failed to save column preferences:', error)
        }
    }, [visibleColumns])

    return [visibleColumns, setVisibleColumns] as const
}