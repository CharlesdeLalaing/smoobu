// App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Navigate } from "react-router-dom";
import BookingConfirmation from "./components/BookingConfirmation";
import "react-datepicker/dist/react-datepicker.css";
import Booking2 from "./components/booking/BookingForm";
import AdminDashboard from "./components/Admin/AdminDashboard";
import ExtrasList from "./components/Admin/ExtrasNames";
import CouponManagement from "./components/Admin/CouponManagement";
import ExtrasReport from "./components/Admin/ExtrasReport"; // New import
import BookingReport from "./components/Admin/BookingReport";
import Login from "./components/Admin/Login";
import AdminBookingCancellation from "./components/Admin/AdminBookingCancellation";
import SpaCalendar from "./components/Admin/SpaCalendar";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import "./index.css";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/Admin/ProtectedRoute";
import Maintenance from "./components/Maintenance";

// Maintenance mode: set VITE_MAINTENANCE_MODE=true in Vercel and redeploy.
// Guest-facing routes show the maintenance page; /admin/* stays reachable.
// Append ?preview=1 once to bypass it for the rest of the browser session.
function isMaintenanceActive() {
  const enabled = import.meta.env.VITE_MAINTENANCE_MODE === "true";
  if (!enabled) return false;

  if (new URLSearchParams(window.location.search).get("preview") === "1") {
    sessionStorage.setItem("maintenanceBypass", "1");
  }
  return sessionStorage.getItem("maintenanceBypass") !== "1";
}

function App() {
  const maintenance = isMaintenanceActive();

  return (
    <AuthProvider>
      <I18nextProvider i18n={i18n}>
        <Router>
          <Routes>
            <Route
              path="/booking-confirmation"
              element={maintenance ? <Maintenance /> : <BookingConfirmation />}
            />
            <Route
              path="/"
              element={maintenance ? <Maintenance /> : <Booking2 />}
            />
            <Route path="/admin/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            >
              <Route path="/extras-list" element={<ExtrasList />} />
              <Route
                index
                path="/admin"
                element={<Navigate to="/booking-report" replace />}
              />
              <Route path="/coupons" element={<CouponManagement />} />
              <Route path="/extras-report" element={<ExtrasReport />} />
              <Route path="/booking-report" element={<BookingReport />} />
              <Route
                path="/cancel-booking"
                element={<AdminBookingCancellation />}
              />
              <Route path="/spa-calendar" element={<SpaCalendar />} />
            </Route>
          </Routes>
        </Router>
      </I18nextProvider>
    </AuthProvider>
  );
}

export default App;