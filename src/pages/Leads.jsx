import { useState, useEffect } from 'react'
import { leadsApi, formatDate, formatMoney } from '../lib/api'
import { useNavigate } from 'react-router-dom'
import Modal from '../components/ui/Modal'

const STATUSES = [
  { key: '', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'proposal', label: 'Proposal' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
]

export default function Leads() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingLead, setEditingLead] = useState(null)
  const [snack, setSnack] = useState(null)
  const [form, setForm] = useState({
    name: '', phone: '', email: '', company: '',
    source: '', status: 'new', value: '',
    notes: '', address: '',
  })

  async function fetchLeads() {
    setLoading(true)
    try {
      const params = {}
      if (filter) params.status = filter
      if (search) params.search = search
      const r = await leadsApi.list(params)
      setLeads(r.data?.leads || r.data || [])
    } catch { }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchLeads() }, [filter])

  useEffect(() => {
    const t = setTimeout(() => fetchLeads(), 300)
    return () => clearTimeout(t)
  }, [search])

  function openAdd() {
    setEditingLead(null)
    setForm({
      name: '', phone: '', email: '', company: '',
      source: '', status: 'new', value: '', notes: '', address: '',
    })
    setShowForm(true)
  }

  function openEdit(lead) {
    setEditingLead(lead)
    setForm({
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      company: lead.company || '',
      source: lead.source || '',
      status: lead.status || 'new',
      value: lead.value || '',
      notes: lead.notes || '',
      address: lead.address || '',
    })
    setShowForm(true)
  }

  async function handleSave() {
    try {
      const body = {
        ...form,
        value: form.value ? Number(form.value) : null,
      }
      if (editingLead) {
        await leadsApi.update(editingLead.id, body)
        setSnack({ msg: 'Lead updated!', type: 'success' })
      } else {
        await leadsApi.create(body)
        setSnack({ msg: 'Lead created!', type: 'success' })
      }
      setShowForm(false)
      fetchLeads()
    } catch (err) {
      setSnack({ msg: err.response?.data?.error || 'Failed', type: 'error' })
    }
  }

  async function handleDelete(lead) {
    if (!confirm(`Delete lead "${lead.name}"?`)) return
    try {
      await leadsApi.delete(lead.id)
      setSnack({ msg: 'Lead deleted', type: 'success' })
      fetchLeads()
    } catch (err) {
      setSnack({ msg: err.response?.data?.error || 'Failed', type: 'error' })
    }
  }

  async function quickStatusChange(lead, newStatus) {
    try {
      await leadsApi.update(lead.id, { status: newStatus })
      fetchLeads()
    } catch { }
  }

  function convertToJob(lead) {
    navigate('/jobs/new', {
      state: {
        parsedData: {
          customer_name: lead.name,
          phone: lead.phone,
          email: lead.email,
          address: lead.address,
          job_title: `Lead: ${lead.company || lead.name}`,
          job_description: lead.notes,
        }
      }
    })
  }

  function statusColor(s) {
    return ({
      new: 'bg-blue-100 text-blue-700',
      contacted: 'bg-indigo-100 text-indigo-700',
      qualified: 'bg-amber-100 text-amber-700',
      proposal: 'bg-purple-100 text-purple-700',
      won: 'bg-green-100 text-green-700',
      lost: 'bg-red-100 text-red-700',
    }[s] || 'bg-gray-100 text-gray-700')
  }

  return (
    <div className="max-w-4xl mx-auto p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Lead Pipeline</h1>
        <button onClick={openAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold min-h-[44px]">
          + New Lead
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <input
          className="w-full border border-gray-300 rounded-xl px-4 py-3 pl-10 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search leads..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="absolute left-3 top-3.5 text-gray-400">🔍</span>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {STATUSES.map(s => (
          <button key={s.key}
            onClick={() => setFilter(s.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-colors min-h-[44px] ${
              filter === s.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Leads list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📋</div>
          <p>No leads found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map(lead => (
            <div key={lead.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{lead.name}</div>
                  {lead.company && (
                    <div className="text-sm text-gray-500">{lead.company}</div>
                  )}
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ml-2 ${statusColor(lead.status)}`}>
                  {lead.status}
                </span>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500 mb-3 flex-wrap">
                {lead.phone && <span>📱 {lead.phone}</span>}
                {lead.email && <span>✉️ {lead.email}</span>}
                {lead.value && (
                  <span className="text-green-600 font-medium">{formatMoney(lead.value)}</span>
                )}
              </div>

              {lead.notes && (
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{lead.notes}</p>
              )}

              <div className="flex gap-2 flex-wrap">
                {lead.status !== 'won' && lead.status !== 'lost' && (
                  <>
                    {lead.status === 'new' && (
                      <button onClick={() => quickStatusChange(lead, 'contacted')}
                        className="px-3 py-1 text-xs border border-indigo-300 text-indigo-600 rounded-full min-h-[36px]">
                        Mark Contacted
                      </button>
                    )}
                    {lead.status === 'contacted' && (
                      <button onClick={() => quickStatusChange(lead, 'qualified')}
                        className="px-3 py-1 text-xs border border-amber-300 text-amber-600 rounded-full min-h-[36px]">
                        Qualify
                      </button>
                    )}
                    <button onClick={() => convertToJob(lead)}
                      className="px-3 py-1 text-xs border border-green-300 text-green-600 rounded-full min-h-[36px]">
                      → Convert to Job
                    </button>
                    <button onClick={() => quickStatusChange(lead, 'lost')}
                      className="px-3 py-1 text-xs border border-red-300 text-red-600 rounded-full min-h-[36px]">
                      Lost
                    </button>
                  </>
                )}
                <button onClick={() => openEdit(lead)}
                  className="px-3 py-1 text-xs border border-gray-300 text-gray-600 rounded-full min-h-[36px]">
                  Edit
                </button>
                <button onClick={() => handleDelete(lead)}
                  className="px-3 py-1 text-xs border border-red-300 text-red-600 rounded-full min-h-[36px]">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Lead Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingLead ? 'Edit Lead' : 'New Lead'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label>
            <input
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
              <input type="tel"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
              <input type="email"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Company</label>
              <input
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.company}
                onChange={e => setForm(p => ({ ...p, company: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Estimated Value</label>
              <input type="number"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.value}
                onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Source</label>
            <input
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.source}
              onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
              placeholder="Google Ads, Referral, Walk-in..."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Address</label>
            <input
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.address}
              onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
            <select
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.status}
              onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
            >
              {STATUSES.filter(s => s.key).map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
            <textarea
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowForm(false)}
              className="flex-1 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 min-h-[44px]">
              Cancel
            </button>
            <button onClick={handleSave}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold min-h-[44px]">
              {editingLead ? 'Save' : 'Create Lead'}
            </button>
          </div>
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
