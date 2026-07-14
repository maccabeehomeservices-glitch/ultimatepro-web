import { useState, useEffect, useRef } from 'react'
import { companyApi } from '../../lib/api'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'

// P3.10 — friendly text for each availability-check `reason` the API can return.
const ALIAS_REASON_TEXT = {
  required: 'Enter a name',
  length: '3–32 characters',
  format: 'lowercase letters, numbers, dots or dashes only',
  reserved: 'That name is reserved',
  taken: 'Already taken',
  cooldown: 'Recently released. Available again after a cooldown',
}

export default function CompanyProfile() {
  const navigate = useNavigate()
  const { can } = useAuth()
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

  // P3.10 — branded email alias (<slug>@ultimatepro.pro)
  const [alias, setAlias] = useState(null)          // current claimed slug, or null
  const [aliasAddress, setAliasAddress] = useState(null)
  const [aliasDomain, setAliasDomain] = useState('ultimatepro.pro')
  const [editingAlias, setEditingAlias] = useState(false)
  const [slugInput, setSlugInput] = useState('')
  const [aliasCheck, setAliasCheck] = useState({ status: 'idle' }) // idle|checking|available|unavailable|error
  const [claimingAlias, setClaimingAlias] = useState(false)
  const [removingAlias, setRemovingAlias] = useState(false)
  const [showRemoveAlias, setShowRemoveAlias] = useState(false)

  const canEditAlias = can('team_settings', 'full')
  const trimmedSlug = slugInput.trim().toLowerCase()
  const isCurrentSlug = !!alias && trimmedSlug === alias
  const canClaimAlias = canEditAlias && aliasCheck.status === 'available' && !isCurrentSlug && !claimingAlias

  function showSnack(msg, type = 'success') {
    setSnack({ msg, type })
    setTimeout(() => setSnack(null), 3000)
  }

  async function loadAlias() {
    try {
      const r = await companyApi.getEmailAlias()
      setAlias(r.data.alias || null)
      setAliasAddress(r.data.address || null)
      if (r.data.domain) setAliasDomain(r.data.domain)
    } catch {
      // non-fatal — the section just falls back to the claim state
    }
  }

  // Debounced live availability check while typing a new/changed alias.
  useEffect(() => {
    if (!editingAlias) return
    if (!trimmedSlug) { setAliasCheck({ status: 'idle' }); return }
    if (isCurrentSlug) { setAliasCheck({ status: 'idle' }); return } // no need to check your own name
    setAliasCheck({ status: 'checking' })
    const t = setTimeout(async () => {
      try {
        const r = await companyApi.checkEmailAlias(trimmedSlug)
        if (r.data.available) setAliasCheck({ status: 'available', address: r.data.address })
        else setAliasCheck({ status: 'unavailable', reason: r.data.reason })
      } catch {
        setAliasCheck({ status: 'error' })
      }
    }, 400)
    return () => clearTimeout(t)
  }, [trimmedSlug, editingAlias, isCurrentSlug])

  function startEditAlias() {
    setSlugInput(alias || '')
    setAliasCheck({ status: 'idle' })
    setEditingAlias(true)
  }

  function cancelEditAlias() {
    setEditingAlias(false)
    setSlugInput('')
    setAliasCheck({ status: 'idle' })
  }

  async function handleClaimAlias() {
    setClaimingAlias(true)
    try {
      const r = await companyApi.setEmailAlias(trimmedSlug)
      setAlias(r.data.alias || null)
      setAliasAddress(r.data.address || null)
      if (r.data.domain) setAliasDomain(r.data.domain)
      setEditingAlias(false)
      setSlugInput('')
      setAliasCheck({ status: 'idle' })
      showSnack('Branded email saved!')
    } catch (err) {
      const reason = err.response?.data?.reason
      showSnack(ALIAS_REASON_TEXT[reason] || err.response?.data?.error || 'Could not claim that name', 'error')
      await loadAlias()
    } finally {
      setClaimingAlias(false)
    }
  }

  async function handleRemoveAlias() {
    setRemovingAlias(true)
    try {
      await companyApi.deleteEmailAlias()
      setAlias(null)
      setAliasAddress(null)
      setShowRemoveAlias(false)
      setEditingAlias(false)
      setSlugInput('')
      setAliasCheck({ status: 'idle' })
      showSnack('Branded email removed')
    } catch (err) {
      showSnack(err.response?.data?.error || 'Could not remove', 'error')
    } finally {
      setRemovingAlias(false)
    }
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
    loadAlias()
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

        {/* P3.10 — Branded Email alias */}
        <div className="border border-hairline rounded-xl p-4 bg-card">
          <label className="block text-xs font-semibold text-blue uppercase tracking-wider mb-1">BRANDED EMAIL</label>
          <p className="text-xs text-muted mb-3">
            Claim a name in the shared <span className="font-mono text-ink">@{aliasDomain}</span> space so your
            estimates and invoices send from your own brand. Customer replies come back to your company inbox.
          </p>

          {alias && !editingAlias ? (
            /* Current alias — read view */
            <div>
              <div className="text-lg font-bold text-ink break-all">{aliasAddress}</div>
              <p className="text-xs text-muted mt-1">Customer replies land in your company inbox.</p>
              {canEditAlias && (
                <div className="flex gap-2 mt-3">
                  <Button variant="ghost" onClick={startEditAlias}>Change</Button>
                  <Button variant="ghost-danger" onClick={() => setShowRemoveAlias(true)}>Remove</Button>
                </div>
              )}
            </div>
          ) : (
            /* Claim / edit input */
            <div>
              <div className="flex items-stretch rounded-xl border border-hairline bg-card overflow-hidden focus-within:ring-2 focus-within:ring-blue">
                <input
                  className="flex-1 min-w-0 px-4 py-3 text-base text-ink bg-card placeholder-muted focus:outline-none disabled:opacity-60"
                  value={slugInput}
                  onChange={e => setSlugInput(e.target.value.toLowerCase())}
                  placeholder="yourbrand"
                  disabled={!canEditAlias || claimingAlias}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <span className="flex items-center px-3 text-sm text-muted whitespace-nowrap border-l border-hairline bg-card">
                  @{aliasDomain}
                </span>
              </div>

              {/* live status */}
              <div className="min-h-[20px] mt-2 text-xs">
                {isCurrentSlug
                  ? <span className="text-muted">This is your current address</span>
                  : aliasCheck.status === 'checking'
                    ? <span className="text-muted">Checking availability…</span>
                    : aliasCheck.status === 'available'
                      ? <span className="text-[#16A34A] font-medium">Available ✓</span>
                      : aliasCheck.status === 'unavailable'
                        ? <span className="text-[#DC2626]">{ALIAS_REASON_TEXT[aliasCheck.reason] || 'Not available'}</span>
                        : aliasCheck.status === 'error'
                          ? <span className="text-muted">Couldn't check right now, try again</span>
                          : null}
              </div>

              <p className="text-xs text-muted mt-1">
                Lowercase letters, numbers, and single dots or dashes. 3–32 characters.
              </p>

              {canEditAlias && (
                <div className="flex gap-2 mt-3">
                  <Button onClick={handleClaimAlias} disabled={!canClaimAlias} loading={claimingAlias}>
                    {alias ? 'Save' : 'Claim'}
                  </Button>
                  {alias && (
                    <Button variant="ghost-muted" onClick={cancelEditAlias} disabled={claimingAlias}>
                      Cancel
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
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

      {/* P3.10 — remove branded email confirm */}
      {showRemoveAlias && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowRemoveAlias(false)}
        >
          <div
            className="bg-card rounded-2xl p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-ink mb-2">Remove branded email?</h3>
            <p className="text-ink mb-6 text-sm">
              <strong className="break-all">{aliasAddress}</strong> will be released. There is a cooldown
              period before that name can be claimed again by anyone, including you.
            </p>
            <div className="flex gap-3">
              <Button
                variant="ghost-muted"
                onClick={() => setShowRemoveAlias(false)}
                className="flex-1"
                disabled={removingAlias}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleRemoveAlias}
                loading={removingAlias}
                className="flex-1"
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}

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
