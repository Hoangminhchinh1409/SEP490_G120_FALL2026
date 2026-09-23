import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/home/HomePage';
import LoginPage from './pages/auth/LoginPage';
import DispatcherDashboard from './pages/dispatcher/DispatcherDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dispatcher" element={<DispatcherDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
