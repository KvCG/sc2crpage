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
