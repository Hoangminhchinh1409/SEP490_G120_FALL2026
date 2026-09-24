import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/home/HomePage';
import LoginPage from './pages/auth/LoginPage';
import DispatcherLayout from './layouts/DispatcherLayout';
import DispatcherDashboard from './pages/dispatcher/DispatcherDashboard';
import OrderManagement from './pages/dispatcher/OrderManagement';
import FleetManagement from './pages/dispatcher/FleetManagement';
import TrackingMap from './pages/dispatcher/TrackingMap';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        
        {/* Dispatcher Routes */}
        <Route path="/dispatcher" element={<DispatcherLayout />}>
          <Route index element={<DispatcherDashboard />} />
          <Route path="orders" element={<OrderManagement />} />
          <Route path="fleet" element={<FleetManagement />} />
          <Route path="tracking" element={<TrackingMap />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
