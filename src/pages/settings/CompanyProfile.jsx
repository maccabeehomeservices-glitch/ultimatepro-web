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

// P3.5 — format a monthly price (dollars) as "$X.XX", or null when unknown.
const fmtPhonePrice = (p) => (p == null ? null : `$${Number(p).toFixed(2)}`)

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

  // P3.10 Tier 2 — verify your OWN existing email as the sending identity (BYO)
  const [senderEmail, setSenderEmail] = useState(null)     // the address on file, or null
  const [senderStatus, setSenderStatus] = useState('none') // none|pending|verified
  const [senderInput, setSenderInput] = useState('')
  const [verifyingSender, setVerifyingSender] = useState(false)
  const [refreshingSender, setRefreshingSender] = useState(false)
  const [removingSender, setRemovingSender] = useState(false)
  const [showRemoveSender, setShowRemoveSender] = useState(false)

  // P3.5 — self-serve dedicated phone number (Twilio)
  const [phoneConfigured, setPhoneConfigured] = useState(true) // false → provisioning unavailable
  const [phoneStatus, setPhoneStatus] = useState('none')       // none|subaccount|number_selected|active
  const [phoneNumber, setPhoneNumber] = useState(null)         // the active (live) number
  const [phoneSelected, setPhoneSelected] = useState(null)     // the selected (pending) number
  const [phonePrice, setPhonePrice] = useState(null)           // monthly_price_usd, once known
  const [phoneUsage, setPhoneUsage] = useState(null)           // { sms, calls, cost_usd }
  const [areaCode, setAreaCode] = useState('')
  const [phoneResults, setPhoneResults] = useState(null)       // null = not searched; [] = searched, none
  const [searchingPhone, setSearchingPhone] = useState(false)
  const [selectingPhone, setSelectingPhone] = useState(null)   // phoneNumber of the row being requested
  const [resettingPhone, setResettingPhone] = useState(false)

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

  // Debounced live availability check whenever the claim/change INPUT is showing (a fresh
  // claim has no alias yet + editingAlias=false, so guard on "read view showing", not editing).
  useEffect(() => {
    if (alias && !editingAlias) return // read view is showing — nothing to check
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
  }, [trimmedSlug, alias, editingAlias, isCurrentSlug])

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

  // P3.10 Tier 2 — sender-email (BYO) ────────────────────────────────────────
  const SENDER_REASON_TEXT = {
    format: 'Enter a valid email',
    address_required: 'Add your company street + city above first',
    sendgrid: "Couldn't start verification, try again",
  }

  async function loadSenderEmail() {
    try {
      const r = await companyApi.getSenderEmail()
      setSenderEmail(r.data.email || null)
      setSenderStatus(r.data.status || 'none')
    } catch {
      // non-fatal — section just falls back to the "none" (add) state
    }
  }

  async function handleVerifySender() {
    const email = senderInput.trim()
    if (!email) return
    setVerifyingSender(true)
    try {
      const r = await companyApi.setSenderEmail(email)
      setSenderEmail(r.data.email || email)
      setSenderStatus(r.data.status || 'pending')
      setSenderInput('')
      showSnack(r.data.message || 'Verification email sent!')
    } catch (err) {
      const data = err.response?.data
      if (data?.reason === 'no_key') {
        showSnack("Email verification isn't set up — contact support", 'error')
      } else {
        showSnack(SENDER_REASON_TEXT[data?.reason] || data?.error || 'Could not start verification', 'error')
      }
    } finally {
      setVerifyingSender(false)
    }
  }

  async function handleRefreshSender() {
    setRefreshingSender(true)
    try {
      const r = await companyApi.getSenderEmailStatus()
      setSenderEmail(r.data.email || senderEmail)
      setSenderStatus(r.data.status || 'pending')
      if (r.data.status === 'verified') showSnack('Verified! Your emails now send from your own address.')
      else showSnack('Still waiting — click the link in the email, then Refresh again.', 'error')
    } catch (err) {
      showSnack(err.response?.data?.error || 'Could not check status', 'error')
    } finally {
      setRefreshingSender(false)
    }
  }

  async function handleRemoveSender() {
    setRemovingSender(true)
    try {
      await companyApi.deleteSenderEmail()
      setSenderEmail(null)
      setSenderStatus('none')
      setSenderInput('')
      setShowRemoveSender(false)
      showSnack('Sending address removed')
    } catch (err) {
      showSnack(err.response?.data?.error || 'Could not remove', 'error')
    } finally {
      setRemovingSender(false)
    }
  }

  // P3.5 — dedicated phone number (Twilio) ────────────────────────────────────
  async function loadPhone() {
    try {
      const r = await companyApi.getPhoneProvisioning()
      const d = r.data || {}
      setPhoneConfigured(d.configured !== false)
      setPhoneStatus(d.status || 'none')
      setPhoneNumber(d.number || null)
      setPhoneSelected(d.selected_number || null)
      if (d.configured !== false && d.status === 'active') {
        try {
          const u = await companyApi.getPhoneUsage()
          setPhoneUsage(u.data || null)
        } catch { /* usage line is non-fatal */ }
      }
    } catch {
      // non-fatal — leave the section in its default (search) state
    }
  }

  async function handleSearchPhone() {
    const ac = areaCode.trim()
    if (!/^\d{3}$/.test(ac)) { showSnack('Enter a 3-digit area code', 'error'); return }
    setSearchingPhone(true)
    try {
      const r = await companyApi.searchPhoneNumbers(ac)
      setPhoneResults(r.data.numbers || [])
      if (r.data.monthly_price_usd != null) setPhonePrice(r.data.monthly_price_usd)
    } catch (err) {
      const reason = err.response?.data?.reason
      if (reason === 'area_code') showSnack('Enter a 3-digit area code', 'error')
      else showSnack(err.response?.data?.error || 'Could not search numbers', 'error')
    } finally {
      setSearchingPhone(false)
    }
  }

  async function handleSelectPhone(phone_number) {
    setSelectingPhone(phone_number)
    try {
      // Ensure the subaccount exists first (idempotent — ignore "already"); a 503
      // means provisioning isn't configured, so stop there.
      try {
        await companyApi.createPhoneSubaccount()
      } catch (e) {
        if (e.response?.data?.reason === 'not_configured') {
          showSnack("Phone provisioning isn't available yet.", 'error')
          return
        }
        // otherwise assume the subaccount already exists — proceed to select
      }
      const r = await companyApi.selectPhoneNumber(phone_number)
      if (r.data?.monthly_price_usd != null) setPhonePrice(r.data.monthly_price_usd)
      setPhoneResults(null)
      setAreaCode('')
      await loadPhone()
      showSnack(r.data?.message || 'Number requested — pending activation')
    } catch (err) {
      showSnack(err.response?.data?.error || 'Could not request that number', 'error')
    } finally {
      setSelectingPhone(null)
    }
  }

  async function handleResetPhone() {
    setResettingPhone(true)
    try {
      await companyApi.resetPhoneSelection()
      setPhoneSelected(null)
      setPhoneResults(null)
      setAreaCode('')
      await loadPhone()
      showSnack('Selection cleared — search for a different number')
    } catch (err) {
      showSnack(err.response?.data?.error || 'Could not reset', 'error')
    } finally {
      setResettingPhone(false)
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
    loadSenderEmail()
    loadPhone()
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

          {/* P3.10 Tier 2 — verify your OWN email as the sending identity (BYO) */}
          <div className="border-t border-hairline mt-4 pt-4">
            <div className="text-sm font-semibold text-ink mb-1">Or use your own email address</div>
            <p className="text-xs text-muted mb-3">
              Verify an email you already own so estimates and invoices send From that exact address.
              We'll email you a confirmation link to click.
            </p>

            {senderStatus === 'verified' ? (
              /* Verified */
              <div>
                <div className="text-sm font-medium text-[#16A34A] break-all">
                  ✓ Verified — your emails now send from {senderEmail}.
                </div>
                {canEditAlias && (
                  <div className="flex gap-2 mt-3">
                    <Button variant="ghost-danger" onClick={() => setShowRemoveSender(true)}>Remove</Button>
                  </div>
                )}
              </div>
            ) : senderStatus === 'pending' ? (
              /* Pending verification */
              <div>
                <div className="text-sm text-ink break-all">
                  Verification sent to <strong>{senderEmail}</strong>. Open it, click the SendGrid
                  <strong> Verify Single Sender</strong> button, then tap Refresh status below. If a login
                  page appears after clicking, close it — no SendGrid account is needed.
                </div>
                <p className="text-xs text-muted mt-2">
                  Even before you confirm, your estimates and invoices already send with replies going to
                  <span className="break-all"> {senderEmail}</span> — so nothing is blocked. Confirming just
                  lets them send <em>from</em> that address too.
                </p>
                {canEditAlias && (
                  <div className="flex gap-2 mt-3">
                    <Button variant="ghost" onClick={handleRefreshSender} loading={refreshingSender}>
                      Refresh status
                    </Button>
                    <Button variant="ghost-danger" onClick={() => setShowRemoveSender(true)}>Remove</Button>
                  </div>
                )}
              </div>
            ) : (
              /* None — add + verify */
              <div>
                <input
                  type="email"
                  className="w-full rounded-xl border border-hairline px-4 py-3 text-base text-ink bg-card placeholder-muted focus:outline-none focus:ring-2 focus:ring-blue disabled:opacity-60"
                  value={senderInput}
                  onChange={e => setSenderInput(e.target.value)}
                  placeholder="you@yourcompany.com"
                  disabled={!canEditAlias || verifyingSender}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <p className="text-xs text-muted mt-2">
                  You'll get a confirmation email from SendGrid. Open it and click the
                  <strong className="text-ink"> Verify Single Sender</strong> button. If a login page
                  appears afterward, just close it — you don't need a SendGrid account. Then tap
                  <strong className="text-ink"> Refresh status</strong> here.
                </p>
                {canEditAlias && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      onClick={handleVerifySender}
                      disabled={!senderInput.trim() || verifyingSender}
                      loading={verifyingSender}
                    >
                      Verify this address
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* P3.5 — Dedicated phone number (Twilio) */}
        <div className="border border-hairline rounded-xl p-4 bg-card">
          <label className="block text-xs font-semibold text-blue uppercase tracking-wider mb-1">PHONE NUMBER</label>

          {!phoneConfigured ? (
            <p className="text-xs text-muted">Phone provisioning isn't available yet.</p>
          ) : phoneStatus === 'active' ? (
            /* Active — a live dedicated number */
            <div>
              <p className="text-xs text-muted mb-2">Your dedicated number for calls and texts.</p>
              <div className="text-lg font-bold text-ink break-all">{phoneNumber}</div>
              {phoneUsage && (
                <p className="text-xs text-muted mt-1">
                  {phoneUsage.sms ?? 0} texts · {phoneUsage.calls ?? 0} calls · ${Number(phoneUsage.cost_usd ?? 0).toFixed(2)} this month
                </p>
              )}
            </div>
          ) : phoneStatus === 'number_selected' ? (
            /* Requested — pending platform activation (no money spent here) */
            <div>
              <div className="text-sm text-ink">
                Requested <strong className="break-all">{phoneSelected}</strong>
                {fmtPhonePrice(phonePrice) ? <> — {fmtPhonePrice(phonePrice)}/mo.</> : '.'} Pending activation by the UltimatePro team.
              </div>
              <p className="text-xs text-muted mt-1">We'll activate it shortly — nothing is charged until it's live.</p>
              {canEditAlias && (
                <div className="flex gap-2 mt-3">
                  <Button variant="ghost" onClick={handleResetPhone} loading={resettingPhone}>
                    Choose a different number
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* none / subaccount — search by area code, then pick a number */
            <div>
              <p className="text-xs text-muted mb-3">Get a dedicated number for calls and texts.</p>
              <div className="flex items-stretch gap-2">
                <input
                  className="w-32 rounded-xl border border-hairline px-4 py-3 text-base text-ink bg-card placeholder-muted focus:outline-none focus:ring-2 focus:ring-blue disabled:opacity-60"
                  value={areaCode}
                  onChange={e => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  placeholder="Area code"
                  inputMode="numeric"
                  disabled={!canEditAlias || searchingPhone}
                />
                {canEditAlias && (
                  <Button onClick={handleSearchPhone} loading={searchingPhone} disabled={areaCode.length !== 3}>
                    Search
                  </Button>
                )}
              </div>

              {phoneResults && (
                <div className="mt-3">
                  {phoneResults.length === 0 ? (
                    <p className="text-xs text-muted">No numbers found for that area code. Try another.</p>
                  ) : (
                    <>
                      <p className="text-xs text-muted mb-2">
                        <span className="font-bold text-ink">{fmtPhonePrice(phonePrice) || '$—'}/mo</span> + usage
                      </p>
                      <div className="space-y-2">
                        {phoneResults.map(n => (
                          <div key={n.phoneNumber} className="flex items-center justify-between gap-3 rounded-xl border border-hairline p-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-ink break-all">{n.friendlyName}</div>
                              <div className="text-xs text-muted">
                                {[n.locality, n.region].filter(Boolean).join(', ') || '—'}
                              </div>
                            </div>
                            {canEditAlias && (
                              <Button
                                variant="ghost"
                                onClick={() => handleSelectPhone(n.phoneNumber)}
                                loading={selectingPhone === n.phoneNumber}
                                disabled={!!selectingPhone}
                              >
                                Select
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
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

      {/* P3.10 Tier 2 — remove sender-email confirm */}
      {showRemoveSender && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowRemoveSender(false)}
        >
          <div
            className="bg-card rounded-2xl p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-ink mb-2">Remove sending address?</h3>
            <p className="text-ink mb-6 text-sm">
              <strong className="break-all">{senderEmail}</strong> will no longer be used as your From
              address. Your emails go back to sending from your branded alias (or the default).
            </p>
            <div className="flex gap-3">
              <Button
                variant="ghost-muted"
                onClick={() => setShowRemoveSender(false)}
                className="flex-1"
                disabled={removingSender}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleRemoveSender}
                loading={removingSender}
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
