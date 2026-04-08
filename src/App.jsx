import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import ClubDashboard from "./pages/club/Dashboard";
import ArbitroDashboard from "./pages/arbitro/Dashboard";
import Verificar from "./pages/Verificar";

function RutaProtegida({ children, rol }) {
  const { user, userData, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (rol && userData?.rol !== rol) return <Navigate to="/login" />;
  return children;
}

function RutaLogin() {
  const { user, userData, loading } = useAuth();
  if (loading) return null;
  if (user && userData) {
    if (userData.rol === "admin") return <Navigate to="/admin" />;
    if (userData.rol === "club") return <Navigate to="/club" />;
    if (userData.rol === "arbitro") return <Navigate to="/arbitro" />;
  }
  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<RutaLogin />} />
          <Route path="/admin/*" element={
            <RutaProtegida rol="admin">
              <AdminDashboard />
            </RutaProtegida>
          } />
          <Route path="/club/*" element={
            <RutaProtegida rol="club">
              <ClubDashboard />
            </RutaProtegida>
          } />
          <Route path="/arbitro/*" element={
            <RutaProtegida rol="arbitro">
              <ArbitroDashboard />
            </RutaProtegida>
          } />
          <Route path="/verificar/:id" element={<Verificar />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
