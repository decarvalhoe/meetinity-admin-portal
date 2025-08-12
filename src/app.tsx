import React, { useState } from 'react'

interface User {
  id: number
  name: string
  email: string
  status: 'active' | 'inactive'
}

interface Event {
  id: number
  title: string
  date: string
  attendees: number
}

function App() {
  const [activeTab, setActiveTab] = useState<'users' | 'events' | 'analytics'>('users')
  const [users, setUsers] = useState<User[]>([
    { id: 1, name: 'Sophie Martin', email: 'sophie@example.com', status: 'active' },
    { id: 2, name: 'Thomas Dubois', email: 'thomas@example.com', status: 'active' },
    { id: 3, name: 'Marie Leroy', email: 'marie@example.com', status: 'inactive' }
  ])
  const [search, setSearch] = useState('')

  const mockEvents: Event[] = [
    { id: 1, title: 'Networking Night Paris', date: '2025-08-15', attendees: 45 },
    { id: 2, title: 'Tech Meetup Lyon', date: '2025-08-20', attendees: 32 }
  ]

  const filteredUsers = users.filter(
    u =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  )
  const totalUsers = users.length
  const activeUsers = users.filter(u => u.status === 'active').length

  const toggleStatus = (id: number) => {
    setUsers(prev =>
      prev.map(u =>
        u.id === id ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' } : u
      )
    )
  }

  const exportCsv = () => {
    const header = 'id,name,email,status'
    const rows = filteredUsers.map(u => `${u.id},${u.name},${u.email},${u.status}`)
    const blob = new Blob([`${[header, ...rows].join('\n')}`], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'users.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="admin-portal">
      <header className="header">
        <h1>Meetinity Admin Portal</h1>
        <p>Manage users, events, and analytics</p>
      </header>

      <nav className="nav-tabs">
        <button
          className={activeTab === 'users' ? 'active' : ''}
          onClick={() => setActiveTab('users')}
        >
          Users ({totalUsers})
        </button>
        <button
          className={activeTab === 'events' ? 'active' : ''}
          onClick={() => setActiveTab('events')}
        >
          Events ({mockEvents.length})
        </button>
        <button
          className={activeTab === 'analytics' ? 'active' : ''}
          onClick={() => setActiveTab('analytics')}
        >
          Analytics
        </button>
      </nav>

      <main className="content">
        {activeTab === 'users' && (
          <div className="users-section">
            <h2>User Management</h2>
            <div className="user-controls">
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button onClick={exportCsv}>Export CSV</button>
            </div>
            <div className="user-stats">
              <span>Total: {totalUsers}</span>
              <span>Active: {activeUsers}</span>
            </div>
            <div className="user-list">
              {filteredUsers.map(user => (
                <div key={user.id} className="user-card">
                  <h3>{user.name}</h3>
                  <p>{user.email}</p>
                  <span className={`status ${user.status}`}>{user.status}</span>
                  <button onClick={() => toggleStatus(user.id)}>
                    {user.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="events-section">
            <h2>Event Management</h2>
            <div className="event-list">
              {mockEvents.map(event => (
                <div key={event.id} className="event-card">
                  <h3>{event.title}</h3>
                  <p>Date: {event.date}</p>
                  <p>Attendees: {event.attendees}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="analytics-section">
            <h2>Analytics Dashboard</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Users</h3>
                <p className="stat-number">{totalUsers}</p>
              </div>
              <div className="stat-card">
                <h3>Active Events</h3>
                <p className="stat-number">{mockEvents.length}</p>
              </div>
              <div className="stat-card">
                <h3>Total Matches</h3>
                <p className="stat-number">127</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
