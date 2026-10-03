import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppHeader from './components/AppHeader';
import HomeScreen from './screens/Home/HomeScreen';
import ConnectPlaceholder from './screens/Connect/ConnectPlaceholder';
import MappingLabScreen from './screens/MappingLab/MappingLabScreen';
import WordListsScreen from './screens/WordLists/WordListsScreen';

// The header and the pages. Tests render this inside a MemoryRouter.
export function AppRoutes() {
  return (
    <>
      <AppHeader />
      <main>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/connect" element={<ConnectPlaceholder />} />
          <Route path="/mapping-lab" element={<MappingLabScreen />} />
          <Route path="/word-lists" element={<WordListsScreen />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
