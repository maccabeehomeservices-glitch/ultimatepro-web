import { useState, useEffect } from 'react'
import { companyApi } from '../../lib/api'
import { useNavigate } from 'react-router-dom'

export default function CompanyProfile() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '', phone: '', email: '', address: '',
    city: '', state: '', zip: '',
    website: '', logo_url: '', tagline: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [snack, setSnack] = useState(null)

  useEffect(() => {
    companyApi.get()
      .then(r => {
        const c = r.data
        setForm({
          name: c.name || '',
          phone: c.phone || '',
          email: c.email || '',
          address: c.address || '',
          city: c.city || '',
          state: c.state || '',
          zip: c.zip || '',
          website: c.website || '',
          logo_url: c.logo_url || '',
          tagline: c.tagline || '',
        })
      })
      .catch(() => setSnack({ msg: 'Failed to load', type: 'error' }))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await companyApi.update(form)
      const fresh = await companyApi.get()
      setForm({
        name: fresh.data.name || '',
        phone: fresh.data.phone || '',
        email: fresh.data.email || '',
        address: fresh.data.address || '',
        city: fresh.data.city || '',
        state: fresh.data.state || '',
        zip: fresh.data.zip || '',
        website: fresh.data.website || '',
        logo_url: fresh.data.logo_url || '',
        tagline: fresh.data.tagline || '',
      })
      setSnack({ msg: 'Company profile saved!', type: 'success' })
    } catch (err) {
      setSnack({
        msg: err.response?.data?.error || 'Failed to save',
        type: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/settings')}
          className="text-gray-400 hover:text-gray-600 text-2xl min-h-[44px] min-w-[44px] flex items-center justify-center">
          ←
        </button>
        <h1 className="text-xl font-bold text-gray-900">Company Profile</h1>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">COMPANY NAME *</label>
          <input
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Your Company Name"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">PHONE</label>
          <input type="tel"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.phone}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
            placeholder="(757) 555-0100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">EMAIL</label>
          <input type="email"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            placeholder="info@yourcompany.com"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">WEBSITE</label>
          <input type="url"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.website}
            onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
            placeholder="https://yourcompany.com"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">TAGLINE</label>
          <input
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.tagline}
            onChange={e => setForm(p => ({ ...p, tagline: e.target.value }))}
            placeholder="Your company slogan"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">ADDRESS</label>
          <input
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            value={form.address}
            onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
            placeholder="Street address"
          />
          <div className="grid grid-cols-3 gap-3">
            <input
              className="border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.city}
              onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
              placeholder="City"
            />
            <input
              className="border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.state}
              onChange={e => setForm(p => ({ ...p, state: e.target.value }))}
              placeholder="State"
            />
            <input
              className="border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.zip}
              onChange={e => setForm(p => ({ ...p, zip: e.target.value }))}
              placeholder="ZIP"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">LOGO URL</label>
          <input type="url"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.logo_url}
            onChange={e => setForm(p => ({ ...p, logo_url: e.target.value }))}
            placeholder="https://..."
          />
          {form.logo_url && (
            <img src={form.logo_url} alt="Logo preview"
              className="mt-2 h-16 object-contain rounded-lg" />
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 mt-6 min-h-[44px]"
        >
          {saving ? 'Saving...' : 'Save Company Profile'}
        </button>
      </div>

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
