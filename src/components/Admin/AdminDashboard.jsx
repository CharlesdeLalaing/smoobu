import React, { useState } from 'react';
import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { Menu, ChevronLeft, Tag, FileText, Receipt, List, Trash2, Calendar1 } from 'lucide-react';

const AdminDashboard = () => {
  const [isOpen, setIsOpen] = useState(true);
  const location = useLocation();

  const navigation = [
    { name: "Rapport réservation", href: "/booking-report", icon: Receipt },
    { name: "Calendrier SPA", href: "/spa-calendar", icon: Calendar1 },
    { name: "Rapport extras", href: "/extras-report", icon: FileText },
    { name: "Coupons", href: "/coupons", icon: Tag },
    { name: "Liste extras", href: "/extras-list", icon: List },
    { name: "Annuler Réservation", href: "/cancel-booking", icon: Trash2 },
  ];

  // Redirect to booking report if at root admin path
  if (location.pathname === '/admin') {
    return <Navigate to="/booking-report" replace />;
  }

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-100 w-[100vw]">
      <div className={`fixed top-0 left-0 h-full bg-white shadow-lg transition-all duration-300 ${
        isOpen ? 'w-64' : 'w-20'
      }`}>
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className={`font-bold text-xl ${!isOpen && 'hidden'}`}>Dashboard - FdB</h1>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            {isOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="p-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-4 p-3 rounded-lg mb-2 transition-colors ${
                  isActive(item.href)
                    ? 'bg-blue-50 text-blue-600'
                    : 'hover:bg-gray-50'
                }`}
              >
                <Icon size={20} />
                <span className={`${!isOpen && 'hidden'}`}>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className={`transition-all duration-300 ${
        isOpen ? 'ml-64' : 'ml-20'
      }`}>
        <div className="p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;