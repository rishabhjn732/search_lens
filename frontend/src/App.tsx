import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppHeader from './components/AppHeader';
import { ConnectionProvider } from './components/ConnectionProvider';
import HomeScreen from './screens/Home/HomeScreen';
import ConnectScreen from './screens/Connect/ConnectScreen';
import MappingLabScreen from './screens/MappingLab/MappingLabScreen';
import WordListsScreen from './screens/WordLists/WordListsScreen';

// The header and the pages. Tests render this inside a MemoryRouter.
export function AppRoutes() {
  return (
    <ConnectionProvider>
      <AppHeader />
      <main>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/connect" element={<ConnectScreen />} />
          <Route path="/mapping-lab" element={<MappingLabScreen />} />
          <Route path="/word-lists" element={<WordListsScreen />} />
        </Routes>
      </main>
    </ConnectionProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
