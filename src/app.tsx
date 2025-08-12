import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { UserManagement } from './components/UserManagement'

function AdminRoute({ children }: { children: JSX.Element }) {
  const isAdmin = localStorage.getItem('role') === 'admin'
  return isAdmin ? children : <div>Unauthorized</div>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <UserManagement />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/admin/users" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
