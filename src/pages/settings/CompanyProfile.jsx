import { useState, useEffect, useRef } from 'react'
import { companyApi } from '../../lib/api'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'

export default function CompanyProfile() {
  const navigate = useNavigate()
  const logoInputRef = useRef(null)
  const [form, setForm] = useState({
    name: '', phone: '', email: '', address: '',
    city: '', state: '', zip: '',
    website: '', tagline: '', default_terms: '',
  })
  const [logoUrl, setLogoUrl] = useState('')
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [ucmId, setUcmId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [snack, setSnack] = useState(null)

  function showSnack(msg, type = 'success') {
    setSnack({ msg, type })
    setTimeout(() => setSnack(null), 3000)
  }

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
          tagline: c.tagline || '',
          default_terms: c.default_terms || '',
        })
        setLogoUrl(c.logo_url || '')
        setUcmId(c.ultimatecrm_id || '')
      })
      .catch(() => showSnack('Failed to load', 'error'))
      .finally(() => setLoading(false))
  }, [])

  async function handleLogoChange(e) {
    const file = e.target.files[0]
    if (!file) return

    // Instant local preview
    const reader = new FileReader()
    reader.onload = (ev) => setLogoPreview(ev.target.result)
    reader.readAsDataURL(file)

    setLogoUploading(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)
      const res = await companyApi.uploadLogo(formData)
      setLogoUrl(res.data.logo_url)
      setLogoPreview(null) // use actual URL from Cloudinary
      showSnack('Logo uploaded!')
    } catch {
      showSnack('Failed to upload logo', 'error')
      setLogoPreview(null)
    } finally {
      setLogoUploading(false)
      e.target.value = ''
    }
  }

  async function handleRemoveLogo() {
    setLogoUrl('')
    setLogoPreview(null)
    try {
      await companyApi.update({ logo_url: '' })
      showSnack('Logo removed')
    } catch {
      showSnack('Failed to remove logo', 'error')
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await companyApi.update({ ...form, logo_url: logoUrl })
      showSnack('Company profile saved!')
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-blue border-t-transparent rounded-full" />
    </div>
  )

  const displayLogo = logoPreview || logoUrl

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/settings')}
          className="text-muted hover:text-ink text-2xl min-h-[44px] min-w-[44px] flex items-center justify-center">
          ←
        </button>
        <h1 className="text-xl font-bold text-ink">Company Profile</h1>
      </div>

      <div className="space-y-4">

        {/* UCM ID */}
        {ucmId && (
          <div className="bg-blue-50 border border-blue rounded-xl p-4">
            <label className="block text-xs font-semibold text-blue uppercase tracking-wider mb-1">ULTIMATEPRO ID</label>
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-blue">{ucmId}</span>
              <Button
                variant="ghost"
                onClick={() => { navigator.clipboard.writeText(ucmId); showSnack('Copied!') }}
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-blue mt-1">Share with contractors to connect on the network</p>
          </div>
        )}

        {/* Logo upload */}
        <div>
          <label className="block text-xs font-semibold text-blue uppercase tracking-wider mb-2">COMPANY LOGO</label>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 border border-hairline rounded-xl bg-card flex items-center justify-center overflow-hidden flex-shrink-0">
              {displayLogo
                ? <img src={displayLogo} alt="Company logo" className="w-full h-full object-contain p-2" />
                : <span className="text-3xl text-muted">🏢</span>
              }
            </div>
            <div className="flex flex-col gap-2">
              <input
                type="file"
                accept="image/*"
                ref={logoInputRef}
                className="hidden"
                onChange={handleLogoChange}
              />
              <Button
                variant="ghost"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
              >
                {logoUploading ? '⏳ Uploading...' : '📷 Upload Logo'}
              </Button>
              {(logoUrl || logoPreview) && (
                <Button
                  variant="ghost-danger"
                  onClick={handleRemoveLogo}
                >
                  Remove Logo
                </Button>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-blue uppercase tracking-wider mb-1">COMPANY NAME *</label>
          <input
            className="w-full border border-hairline rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Your Company Name"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-blue uppercase tracking-wider mb-1">TAGLINE</label>
          <input
            className="w-full border border-hairline rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue"
            value={form.tagline}
            onChange={e => setForm(p => ({ ...p, tagline: e.target.value }))}
            placeholder="Your company slogan"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-blue uppercase tracking-wider mb-1">PHONE</label>
          <input type="tel"
            className="w-full border border-hairline rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue"
            value={form.phone}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
            placeholder="(757) 555-0100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-blue uppercase tracking-wider mb-1">EMAIL</label>
          <input type="email"
            className="w-full border border-hairline rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue"
            value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            placeholder="info@yourcompany.com"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-blue uppercase tracking-wider mb-1">WEBSITE</label>
          <input type="url"
            className="w-full border border-hairline rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue"
            value={form.website}
            onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
            placeholder="https://yourcompany.com"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-blue uppercase tracking-wider mb-1">ADDRESS</label>
          <input
            className="w-full border border-hairline rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue mb-3"
            value={form.address}
            onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
            placeholder="Street address"
          />
          <div className="grid grid-cols-3 gap-3">
            <input
              className="border border-hairline rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue"
              value={form.city}
              onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
              placeholder="City"
            />
            <input
              className="border border-hairline rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue"
              value={form.state}
              onChange={e => setForm(p => ({ ...p, state: e.target.value }))}
              placeholder="State"
            />
            <input
              className="border border-hairline rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue"
              value={form.zip}
              onChange={e => setForm(p => ({ ...p, zip: e.target.value }))}
              placeholder="ZIP"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-blue uppercase tracking-wider mb-1">DEFAULT TERMS &amp; CONDITIONS</label>
          <textarea
            rows={5}
            className="w-full border border-hairline rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue"
            value={form.default_terms}
            onChange={e => setForm(p => ({ ...p, default_terms: e.target.value }))}
            placeholder="Payment due within 30 days. Auto-filled into new estimates and invoices; you can override it on any individual document."
          />
          <p className="text-xs text-muted mt-1">Auto-filled into new estimates &amp; invoices. Editing an individual document's terms only affects that document.</p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-6"
        >
          {saving ? 'Saving...' : 'Save Company Profile'}
        </Button>
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
