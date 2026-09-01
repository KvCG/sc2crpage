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
    primaryShade: { dark: 5 },
    colors: {
        blue: [
            '#EAF3FB', '#C5DFF2', '#92C3E8', '#5FA6D9', '#3D8CC7',
            '#2E6FA3', '#255A85', '#1D4668', '#16334B', '#0F2233',
        ],
        dark: [
            '#E8EDF2', '#C7D0DA', '#93A1B1', '#5C6B7E', '#394453',
            '#232C38', '#1B232E', '#151C25', '#10151D', '#0B0F15',
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
