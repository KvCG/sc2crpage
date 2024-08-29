import { Header } from './components/Header/Header.tsx'
import { Route, Routes } from 'react-router-dom'
import { Community } from './pages/Community.tsx'
import './App.css'
import '@mantine/core/styles.css'
import { Ranking } from './pages/Ranking.tsx'
import { Search } from './pages/Search.tsx'
// Define functional component using TypeScript
const App: React.FC = () => {
    return (
        <>
            <Header />
            <Routes>
                <Route path="/" element={<Ranking />} />
                <Route path="/community" element={<Community />} />
				<Route path="/search" element={<Search />} />
                {/* <Route path='/contact' element={<Contact/>} /> */}
            </Routes>
        </>
    )
}

export default App
