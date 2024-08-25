import React, { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import './App.css'

// Define functional component using TypeScript
const App: React.FC = () => {
    // TypeScript infers the type of `count` as number
    const [count, setCount] = useState<number>(0)

    return (
        <>
            <div>
                <a
                    href="https://vitejs.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <img src={viteLogo} className="logo" alt="Vite logo" />
                </a>
                <a
                    href="https://react.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <img
                        src={reactLogo}
                        className="logo react"
                        alt="React logo"
                    />
                </a>
            </div>
            <h1>SC2 CR Official page</h1>
            <div className="card">
                <button onClick={() => setCount(count => count + 1)}>
                    Kerverus is awesome x{count}
                </button>
            </div>
        </>
    )
}

export default App
