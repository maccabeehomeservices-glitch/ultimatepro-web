import { useState, useEffect } from 'react'
import api, { usersApi } from '../../lib/api'
import { useNavigate } from 'react-router-dom'
import Modal from '../../components/ui/Modal'

export default function UserManagement() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [showDelete, setShowDelete] = useState(null)
  const [saving, setSaving] = useState(false)
  const [snack, setSnack] = useState(null)
  const [form, setForm] = useState({
    name: '', email: '', phone: '', role: 'tech', password: ''
  })

  async function fetchUsers() {
    try {
      const r = await usersApi.list()
      setUsers(r.data || [])
    } catch { }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [])

  function openAdd() {
    setEditingUser(null)
    setForm({ name: '', email: '', phone: '', role: 'tech', password: '' })
    setShowForm(true)
  }

  function openEdit(user) {
    setEditingUser(user)
    setForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'tech',
      password: '',
    })
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, {
          name: form.name, email: form.email,
          phone: form.phone, role: form.role,
        })
        setSnack({ msg: 'User updated!', type: 'success' })
      } else {
        if (!form.password) {
          setSnack({ msg: 'Password is required for new users', type: 'error' })
          setSaving(false)
          return
        }
        await api.post('/users', {
          name: form.name, email: form.email,
          phone: form.phone, role: form.role,
          password: form.password,
        })
        setSnack({ msg: 'User created!', type: 'success' })
      }
      setShowForm(false)
      fetchUsers()
    } catch (err) {
      setSnack({
        msg: err.response?.data?.error || 'Failed to save user',
        type: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/users/${showDelete.id}`)
      setShowDelete(null)
      setSnack({ msg: 'User removed', type: 'success' })
      fetchUsers()
    } catch (err) {
      setSnack({
        msg: err.response?.data?.error || 'Failed to delete',
        type: 'error'
      })
    }
  }

  const roleColors = {
    owner: 'bg-purple-100 text-purple-700',
    admin: 'bg-blue-100 text-blue-700',
    tech: 'bg-green-100 text-green-700',
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/settings')}
            className="text-gray-400 hover:text-gray-600 text-2xl min-h-[44px] min-w-[44px] flex items-center justify-center">
            ←
          </button>
          <h1 className="text-xl font-bold text-gray-900">Team Members</h1>
        </div>
        <button onClick={openAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold min-h-[44px]">
          + Add User
        </button>
      </div>

      <div className="space-y-3">
        {users.map(u => (
          <div key={u.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {(u.name?.[0] || '?').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 truncate">{u.name}</div>
              <div className="text-sm text-gray-500 truncate">
                {u.email}{u.phone ? ` · ${u.phone}` : ''}
              </div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[u.role] || roleColors.tech}`}>
              {u.role}
            </span>
            <button onClick={() => openEdit(u)}
              className="text-gray-400 hover:text-blue-600 px-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
              ✏️
            </button>
            {u.role !== 'owner' && (
              <button onClick={() => setShowDelete(u)}
                className="text-gray-400 hover:text-red-600 px-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
                🗑
              </button>
            )}
          </div>
        ))}
        {users.length === 0 && (
          <div className="text-center py-12 text-gray-400">No team members yet</div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingUser ? 'Edit User' : 'Add Team Member'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label>
            <input
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Full name"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
            <input type="email"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="email@company.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
            <input type="tel"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="(757) 555-0100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Role</label>
            <select
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.role}
              onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
            >
              <option value="tech">Technician</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
          </div>
          {!editingUser && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Password *</label>
              <input type="password"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Set password"
              />
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowForm(false)}
              className="flex-1 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 min-h-[44px]">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50 min-h-[44px]">
              {saving ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!showDelete}
        onClose={() => setShowDelete(null)}
        title="Remove Team Member"
      >
        <p className="text-gray-600 mb-6">
          Remove <strong>{showDelete?.name}</strong> from your team? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setShowDelete(null)}
            className="flex-1 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 min-h-[44px]">
            Cancel
          </button>
          <button onClick={handleDelete}
            className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold min-h-[44px]">
            Remove
          </button>
        </div>
      </Modal>

      {snack && (
        <div
          className={`fixed bottom-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-lg text-white text-sm z-50 ${snack.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
          onClick={() => setSnack(null)}
        >
          {snack.msg}
        </div>
      )}
    </div>
  )
}
