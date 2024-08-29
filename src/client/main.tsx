import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { createTheme, MantineProvider, MantineThemeOverride } from '@mantine/core'

const theme: MantineThemeOverride = createTheme({
    autoContrast: true,
})

// Ensure that 'root' is not null
const rootElement = document.getElementById('root')
if (!rootElement) {
    throw new Error('Root element not found')
}

const root = createRoot(rootElement)

// Render the App component inside StrictMode
root.render(
    <StrictMode>
        <MantineProvider theme={theme} defaultColorScheme="dark" >
            <App />
        </MantineProvider>
    </StrictMode>
)
