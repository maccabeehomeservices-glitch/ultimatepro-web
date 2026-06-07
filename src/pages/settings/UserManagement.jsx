import { useState, useEffect } from 'react'
import api, { usersApi } from '../../lib/api'
import { useNavigate } from 'react-router-dom'
import Modal from '../../components/ui/Modal'
import { useAuth } from '../../hooks/useAuth'

// Display labels for the permission grid (model lives in backend/utils/permissions.js,
// fetched via GET /users/permission-schema — these are just the human strings).
const SECTION_LABELS = {
  jobs: 'Jobs',
  customers: 'Customers',
  estimates_invoices: 'Estimates & Invoices',
  payments_refunds: 'Payments & Refunds',
  pricebook: 'Pricebook',
  accounting_earnings: 'Accounting & Earnings',
  reports: 'Reports',
  job_sources_commissions: 'Job Sources & Commissions',
  team_settings: 'Team & Settings',
}
const LEVEL_LABELS = { none: 'None', view: 'View', edit_self: 'Edit (self)', full: 'Full' }

export default function UserManagement() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [showDelete, setShowDelete] = useState(null)
  const [saving, setSaving] = useState(false)
  const [snack, setSnack] = useState(null)
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', role: 'technician', password: ''
  })
  // Permission grid (Phase 1: stored + editable, enforced by nothing yet).
  const [permSchema, setPermSchema] = useState(null)   // { sections, levels, role_templates }
  const [gridPerms, setGridPerms]   = useState({})     // full per-section levels shown in the grid
  const [roleNote, setRoleNote]     = useState('')

  async function fetchUsers() {
    try {
      const r = await usersApi.list()
      setUsers(r.data || [])
    } catch { }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [])
  useEffect(() => {
    usersApi.getPermissionSchema().then(r => setPermSchema(r.data)).catch(() => {})
  }, [])

  function templateFor(role) {
    return permSchema?.role_templates?.[role] || {}
  }
  // Seed the grid = override[section] ?? roleTemplate[section]. Overrides default {}.
  function seedGrid(role, overrides = {}) {
    const tpl = templateFor(role)
    const sections = permSchema?.sections || Object.keys(tpl)
    const merged = {}
    sections.forEach(s => { merged[s] = overrides[s] ?? tpl[s] ?? 'none' })
    setGridPerms(merged)
  }
  // Selecting a role re-seeds the grid to that template AND clears overrides.
  function handleRoleChange(newRole) {
    setForm(p => ({ ...p, role: newRole }))
    seedGrid(newRole)
    setRoleNote(`Reset to ${newRole} defaults`)
  }
  // If the schema arrives after the form opened, seed the grid once it's available.
  useEffect(() => {
    if (permSchema && showForm && Object.keys(gridPerms).length === 0) {
      seedGrid(form.role, editingUser?.permissions || {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permSchema, showForm])

  function openAdd() {
    setEditingUser(null)
    setForm({ first_name: '', last_name: '', email: '', phone: '', role: 'technician', password: '' })
    seedGrid('technician')
    setRoleNote('')
    setShowForm(true)
  }

  function openEdit(user) {
    setEditingUser(user)
    setForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'technician',
      password: '',
    })
    seedGrid(user.role || 'technician', user.permissions || {})
    setRoleNote('')
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      // Delta vs the role template — send ONLY overridden sections (null if none).
      const tpl = templateFor(form.role)
      const overrides = {}
      for (const s of (permSchema?.sections || [])) {
        if (gridPerms[s] && gridPerms[s] !== tpl[s]) overrides[s] = gridPerms[s]
      }
      const permissions = Object.keys(overrides).length ? overrides : null

      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, {
          first_name: form.first_name, last_name: form.last_name,
          email: form.email, phone: form.phone, role: form.role,
          permissions,
          ...(form.password ? { password: form.password } : {}),
        })
        setSnack({ msg: 'Team member updated!', type: 'success' })
      } else {
        if (!form.password) {
          setSnack({ msg: 'Password is required for new users', type: 'error' })
          setSaving(false)
          return
        }
        await api.post('/users', {
          first_name: form.first_name, last_name: form.last_name,
          email: form.email, phone: form.phone, role: form.role,
          password: form.password,
          permissions,
        })
        setSnack({ msg: 'Team member created!', type: 'success' })
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
      setSnack({ msg: 'User deactivated', type: 'success' })
      fetchUsers()
    } catch (err) {
      setSnack({
        msg: err.response?.data?.error || 'Failed to deactivate',
        type: 'error'
      })
    }
  }

  async function handleReactivate(user) {
    try {
      await usersApi.reactivate(user.id)
      setSnack({ msg: 'User reactivated', type: 'success' })
      fetchUsers()
    } catch (err) {
      setSnack({
        msg: err.response?.data?.error || 'Failed to reactivate',
        type: 'error'
      })
    }
  }

  // Matches Android's role palette (TeamMembersScreen.kt roleColor).
  const roleColors = {
    owner: 'bg-purple-100 text-purple-700',
    admin: 'bg-blue-100 text-blue-700',
    manager: 'bg-green-100 text-green-700',
    technician: 'bg-amber-100 text-amber-700',
    dispatcher: 'bg-indigo-100 text-indigo-700',
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
        {can('team_settings','full') && (
        <button onClick={openAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold min-h-[44px]">
          + Add Team Member
        </button>
        )}
      </div>

      <div className="space-y-3">
        {users.map(u => (
          <div key={u.id} className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4 ${u.is_active === false ? 'opacity-60' : ''}`}>
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {(u.first_name?.[0] || '?').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 truncate flex items-center gap-2">
                <span className="truncate">{`${u.first_name || ''} ${u.last_name || ''}`.trim() || '—'}</span>
                {u.is_active === false && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 flex-shrink-0">Inactive</span>
                )}
              </div>
              <div className="text-sm text-gray-500 truncate">
                {u.email}{u.phone ? ` · ${u.phone}` : ''}
              </div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[u.role] || roleColors.technician}`}>
              {u.role}
            </span>
            {u.role !== 'owner' && (
              u.is_active === false ? (
                <button onClick={() => handleReactivate(u)} title="Reactivate"
                  className="text-gray-400 hover:text-blue-600 px-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
                  ♻️
                </button>
              ) : (
                <>
                  <button onClick={() => openEdit(u)}
                    className="text-gray-400 hover:text-blue-600 px-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
                    ✏️
                  </button>
                  <button onClick={() => setShowDelete(u)}
                    className="text-gray-400 hover:text-red-600 px-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
                    🗑
                  </button>
                </>
              )
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
        title={editingUser ? 'Edit Team Member' : 'Add Team Member'}
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">First Name *</label>
              <input
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.first_name}
                onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))}
                placeholder="First"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name *</label>
              <input
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.last_name}
                onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))}
                placeholder="Last"
              />
            </div>
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
              onChange={e => handleRoleChange(e.target.value)}
            >
              <option value="technician">Technician</option>
              <option value="dispatcher">Dispatcher</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Permission grid (Phase 1: stored + editable; nothing enforces it yet) */}
          {form.role === 'owner' ? (
            <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-3 text-sm text-purple-700">
              Owner has <strong>Full access</strong> to everything.
            </div>
          ) : permSchema ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-600">Permissions</label>
                {roleNote && <span className="text-[11px] text-gray-400">{roleNote}</span>}
              </div>
              <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                {permSchema.sections.map(section => (
                  <div key={section} className="px-3 py-2">
                    <div className="text-sm font-medium text-gray-800 mb-1.5">{SECTION_LABELS[section] || section}</div>
                    <div className="grid grid-cols-4 gap-1">
                      {permSchema.levels.map(level => {
                        const active = gridPerms[section] === level
                        return (
                          <button key={level} type="button"
                            onClick={() => setGridPerms(p => ({ ...p, [section]: level }))}
                            className={`text-xs px-1 py-2 rounded-lg border min-h-[44px] ${active ? 'bg-blue-600 text-white border-blue-600 font-semibold' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                            {LEVEL_LABELS[level] || level}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              {editingUser ? 'Password' : 'Password *'}
            </label>
            <input type="password"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder={editingUser ? 'Leave blank to keep current' : 'Set password'}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowForm(false)}
              className="flex-1 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 min-h-[44px]">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50 min-h-[44px]">
              {saving ? 'Saving...' : editingUser ? 'Save Changes' : 'Create Team Member'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!showDelete}
        onClose={() => setShowDelete(null)}
        title="Deactivate Team Member"
      >
        <p className="text-gray-600 mb-6">
          Deactivate <strong>{`${showDelete?.first_name || ''} ${showDelete?.last_name || ''}`.trim()}</strong>? They lose app access. You can reactivate them later.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setShowDelete(null)}
            className="flex-1 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 min-h-[44px]">
            Cancel
          </button>
          <button onClick={handleDelete}
            className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold min-h-[44px]">
            Deactivate
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
