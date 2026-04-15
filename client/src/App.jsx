import { Navigate, Route, Routes } from 'react-router-dom';
import AdminPage from './AdminPage';
import DisplayPage from './DisplayPage';

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/display" element={<DisplayPage />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
