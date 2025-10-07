/**
 * Simplified Chart Configuration
 *
 * Single configuration source for all Chart.js instances in the Community module.
 * Replaces the complex chartConfig.ts with a minimal, maintainable approach.
 */

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js'

import { CHART_THEME } from '../../../shared/colorTokens'

// Register Chart.js components once
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
)

// Base configuration for all charts
export const baseChartConfig = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: false, // We use custom legends
        },
        tooltip: {
            backgroundColor: CHART_THEME.TOOLTIP_BG,
            titleColor: CHART_THEME.TEXT_COLOR,
            bodyColor: CHART_THEME.TEXT_COLOR,
            borderColor: CHART_THEME.TOOLTIP_BORDER,
            borderWidth: 1,
            cornerRadius: 6,
            titleFont: { size: 13, weight: 'bold' as const },
            bodyFont: { size: 12 },
        },
    },
    scales: {
        x: {
            ticks: {
                color: CHART_THEME.AXIS_TEXT,
                font: { size: 11 },
            },
            grid: {
                color: CHART_THEME.GRID_COLOR,
            },
            border: {
                color: CHART_THEME.BORDER_COLOR,
            },
        },
        y: {
            ticks: {
                color: CHART_THEME.AXIS_TEXT,
                font: { size: 11 },
            },
            grid: {
                color: CHART_THEME.GRID_COLOR,
            },
            border: {
                color: CHART_THEME.BORDER_COLOR,
            },
        },
    },
} as const

// Specific configurations for different chart types
export const pieChartConfig = {
    ...baseChartConfig,
    scales: undefined, // Pie charts don't use scales
    plugins: {
        ...baseChartConfig.plugins,
        tooltip: {
            ...baseChartConfig.plugins.tooltip,
            displayColors: true,
        },
    },
} as const

export const barChartConfig = {
    ...baseChartConfig,
    scales: {
        ...baseChartConfig.scales,
        x: {
            ...baseChartConfig.scales.x,
            ticks: {
                ...baseChartConfig.scales.x.ticks,
                maxRotation: 45,
                minRotation: 0,
            },
        },
    },
} as const
