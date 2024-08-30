import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import {
    createTheme,
    MantineProvider,
    MantineThemeOverride,
} from '@mantine/core'
import { BrowserRouter } from 'react-router-dom'

const theme: MantineThemeOverride = createTheme({
    autoContrast: true,
	breakpoints: {
		xs: '20em',
		sm: '30em',
		md: '48em',
		lg: '74em',
		xl: '90em',
	  },
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
        <MantineProvider theme={theme} defaultColorScheme="dark">
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </MantineProvider>
    </StrictMode>
)
