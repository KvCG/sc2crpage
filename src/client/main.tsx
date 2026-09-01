import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import {
    createTheme,
    MantineProvider,
    MantineThemeOverride,
} from '@mantine/core'
import { BrowserRouter } from 'react-router-dom'
import { connectWebSocket } from './utils/ws'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

// Mantine main config overrides
const theme: MantineThemeOverride = createTheme({
    // autoContrast: true,
    breakpoints: {
        xs: '20em',
        sm: '30em',
        md: '48em',
        lg: '74em',
        xl: '90em',
    },
    primaryColor: 'blue',
    primaryShade: { dark: 6 },
    colors: {
        blue: [
            '#EAF3FB', '#C5DFF2', '#A3CFEC', '#7FC4F0', '#4E9FD8',
            '#3A82B8', '#2E6FA3', '#245782', '#1B4261', '#122C41',
        ],
        dark: [
            '#F2F6FA', '#C8D4DF', '#8497A8', '#55697D', '#2A3947',
            '#1A242F', '#161F29', '#0E141B', '#0B1016', '#070A0E',
        ],
        sc2cyan: [
            '#E6FBF7', '#C0F4EA', '#96EBDC', '#71E2CE', '#54D8C4',
            '#3BBFAB', '#2E9A8B', '#22756A', '#175049', '#0C2B28',
        ],
    },
    radius: { sm: '2px', md: '4px', lg: '6px', xl: '8px' },
    fontFamily: '"IBM Plex Sans", -apple-system, "Segoe UI", sans-serif',
    headings: {
        fontFamily: '"Chakra Petch", "IBM Plex Sans", "Segoe UI", sans-serif',
        fontWeight: '700',
    },
})

// Development only, when running npm run dev, this listen to a websocket to refresh the browser on server code changes
if (import.meta.env.MODE === 'development') {
    connectWebSocket()
}

// Ensure that 'root' is not null
const rootElement = document.getElementById('root')
if (!rootElement) {
    throw new Error('Root element not found')
}

const root = createRoot(rootElement)

// Render the App component inside StrictMode
root.render(
    <StrictMode>
        <MantineProvider theme={theme} defaultColorScheme="dark">
            <BrowserRouter>
                <App />
                <Analytics />
                <SpeedInsights />
            </BrowserRouter>
        </MantineProvider>
    </StrictMode>
)
