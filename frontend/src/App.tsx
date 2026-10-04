import { useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppHeader from './components/AppHeader';
import { ConnectionProvider } from './components/ConnectionProvider';
import HomeScreen from './screens/Home/HomeScreen';
import ConnectScreen from './screens/Connect/ConnectScreen';
import ClusterOverviewScreen from './screens/ClusterOverview/ClusterOverviewScreen';
import MappingLabScreen from './screens/MappingLab/MappingLabScreen';
import WordListsScreen from './screens/WordLists/WordListsScreen';
import QueryLabPage, { INITIAL_QUERY_LAB_STATE, type QueryLabState } from './screens/QueryLab/QueryLabPage';

// The header and the pages. Tests render this inside a MemoryRouter.
export function AppRoutes() {
  // Held above the router (like ConnectionProvider) so query lab's typed request and last
  // result survive navigating to another page and back without a reload (R1.4).
  const [queryLabState, setQueryLabState] = useState<QueryLabState>(INITIAL_QUERY_LAB_STATE);

  return (
    <ConnectionProvider>
      <AppHeader />
      <main>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/connect" element={<ConnectScreen />} />
          <Route path="/overview" element={<ClusterOverviewScreen />} />
          <Route path="/mapping-lab" element={<MappingLabScreen />} />
          <Route path="/word-lists" element={<WordListsScreen />} />
          <Route
            path="/query-lab"
            element={<QueryLabPage state={queryLabState} onStateChange={setQueryLabState} />}
          />
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
