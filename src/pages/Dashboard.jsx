import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGet } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { useSnackbar } from '../components/ui/Snackbar';
import { Card, Badge, LoadingSpinner, EmptyState, Modal, Button } from '../components/ui';
import api, { timesheetsApi, jobsApi, statusColor, statusLabel } from '../lib/api';
import { Briefcase, DollarSign, Receipt, Calendar, ClipboardList, Phone, Star, Users, ChevronRight, RefreshCw } from 'lucide-react';

const MAPS_KEY = 'AIzaSyDtSGWBuiTFR5BbomG8ZFNYeiwUszkJiNQ';

function formatCurrency(amount) {
  if (amount == null) return '$0.00';
  return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function useGoogleMaps() {
  const [ready, setReady] = useState(!!window.google?.maps);
  useEffect(() => {
    if (window.google?.maps) { setReady(true); return; }
    const id = 'gmap-script';
    if (!document.getElementById(id)) {
      const cb = '__gmaps_cb_' + Date.now();
      window[cb] = () => { setReady(true); delete window[cb]; };
      const s = document.createElement('script');
      s.id = id;
      s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&callback=${cb}`;
      s.async = true;
      document.head.appendChild(s);
    }
  }, []);
  return ready;
}

function JobMap({ jobs, techs }) {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    if (!mapInstance.current) {
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        zoom: 10,
        center: { lat: 33.749, lng: -84.388 },
        disableDefaultUI: true,
        zoomControl: true,
        styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
      });
    }

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const geocoder = new window.google.maps.Geocoder();
    const bounds = new window.google.maps.LatLngBounds();
    let placed = 0;

    function placeJobMarker(job, pos) {
      const color = statusColor(job.status);
      const mismatch = job.address_verified === false;
      const customerName = `${job.cust_first || ''} ${job.cust_last || ''}`.trim() || 'No customer';
      const marker = new window.google.maps.Marker({
        position: pos,
        map: mapInstance.current,
        title: job.title || job.job_title || 'Job',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: mismatch ? '#F59E0B' : '#fff',
          strokeWeight: mismatch ? 3 : 2,
        },
      });
      marker.addListener('click', () => {
        const iw = new window.google.maps.InfoWindow({
          content: `
            <div style="min-width:180px;font-family:system-ui;padding:4px">
              <div style="font-weight:700;font-size:13px">${job.job_number || ''}</div>
              <div style="font-size:12px;margin:2px 0">${job.title || job.job_title || 'Untitled'}</div>
              <div style="font-size:11px;color:#666">${customerName}</div>
              <div style="display:inline-block;padding:2px 6px;border-radius:10px;font-size:10px;font-weight:600;color:white;background:${color};margin-top:4px">
                ${statusLabel(job.status)}
              </div>
              ${mismatch ? '<div style="font-size:10px;color:#D97706;margin-top:4px">⚠️ Address may be inaccurate</div>' : ''}
              <div style="margin-top:6px">
                <a href="/jobs/${job.id || job._id}" style="color:#1A73E8;font-size:11px;font-weight:600;text-decoration:none">Open Job →</a>
              </div>
            </div>`
        });
        iw.open(mapInstance.current, marker);
      });
      markersRef.current.push(marker);
      bounds.extend(pos);
      placed++;
      if (placed === 1) mapInstance.current.setCenter(pos);
    }

    // Job markers (up to 20) — prefer stored coords, fall back to full-address geocoding
    const jobsToShow = jobs.slice(0, 20);
    jobsToShow.forEach(job => {
      if (job.lat && job.lng) {
        // Use stored coordinates — no geocoding needed
        placeJobMarker(job, { lat: parseFloat(job.lat), lng: parseFloat(job.lng) });
      } else {
        // Fallback: geocode with full address
        const addr = [
          job.address || job.service_address,
          job.city,
          job.state,
          job.zip,
        ].filter(Boolean).join(', ');
        if (!addr || addr.trim().length < 3) return;
        geocoder.geocode({ address: addr }, (results, status) => {
          if (status === 'OK' && results[0]) {
            placeJobMarker(job, results[0].geometry.location);
          }
        });
      }
    });

    // Tech markers (from GPS live) — always use stored coords
    techs.forEach(tech => {
      if (!tech.lat || !tech.lng) return;
      const pos = { lat: Number(tech.lat), lng: Number(tech.lng) };
      const name = `${tech.first_name || ''} ${tech.last_name || ''}`.trim() || tech.name || 'Tech';
      const marker = new window.google.maps.Marker({
        position: pos,
        map: mapInstance.current,
        title: name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#34A853',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      });
      markersRef.current.push(marker);
    });
  }, [jobs, techs]);

  // Handle SPA navigation from InfoWindow links
  useEffect(() => {
    function handleClick(e) {
      const link = e.target.closest('a[href^="/jobs/"]');
      if (link) {
        e.preventDefault();
        navigate(link.getAttribute('href'));
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [navigate]);

  return (
    <div
      ref={mapRef}
      className="w-full rounded-2xl overflow-hidden border border-gray-100"
      style={{ height: 'clamp(300px, 40vw, 400px)' }}
    />
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showSnack } = useSnackbar();
  const [pasteModal, setPasteModal] = useState(false);
  const [ticketText, setTicketText] = useState('');
  const [parsing, setParsing] = useState(false);
  const mapsReady = useGoogleMaps();

  const [refreshing, setRefreshing] = useState(false);
  const [clockedIn, setClockedIn] = useState(false);
  const [clockLoading, setClockLoading] = useState(false);

  const { data: dashData, loading: dashLoading, refetch: refetchDash } = useGet('/reports/dashboard');
  const { data: jobsData, loading: jobsLoading, refetch: refetchJobs } = useGet(
    '/jobs?status=scheduled,en_route,in_progress,unscheduled&page=1&limit=50'
  );
  const { data: gpsData, refetch: refetchGps } = useGet('/gps/live');
  const { data: dueSoonData, refetch: refetchDueSoon } = useGet('/memberships/due-soon');

  useEffect(() => {
    timesheetsApi.getStatus()
      .then(r => setClockedIn(r.data?.clocked_in || false))
      .catch(() => {});
  }, []);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetchDash(); refetchJobs(); refetchGps(); refetchDueSoon();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  function handleRefresh() {
    setRefreshing(true);
    refetchDash(); refetchJobs(); refetchGps(); refetchDueSoon();
    setTimeout(() => setRefreshing(false), 1500);
  }

  async function toggleClock() {
    setClockLoading(true);
    try {
      if (clockedIn) {
        await timesheetsApi.clockOut();
        setClockedIn(false);
        showSnack('Clocked out!', 'success');
      } else {
        await timesheetsApi.clockIn();
        setClockedIn(true);
        showSnack('Clocked in!', 'success');
      }
    } catch (err) {
      showSnack(err.response?.data?.error || 'Failed', 'error');
    } finally {
      setClockLoading(false);
    }
  }

  const raw = dashData || {};
  const monthRevenue   = raw?.revenue?.total || 0;
  const todayJobs      = raw?.jobs?.total || 0;
  const openInvoices   = raw?.invoices?.open || 0;
  const scheduledToday = raw?.jobs?.scheduled || 0;
  const missedCalls    = raw?.calls?.missed_calls || 0;
  const secondChance   = raw?.second_chance?.total || 0;

  const activeJobs  = jobsData?.jobs  || (Array.isArray(jobsData) ? jobsData : []);
  const activeTechs = gpsData?.techs  || gpsData?.technicians || (Array.isArray(gpsData) ? gpsData : []);
  const dueSoon     = dueSoonData?.memberships || (Array.isArray(dueSoonData) ? dueSoonData : []);

  async function handleParseTicket() {
    if (!ticketText.trim()) return;
    setParsing(true);
    try {
      const res = await jobsApi.parseTicket(ticketText);
      setPasteModal(false);
      setTicketText('');
      navigate('/jobs/new', { state: { parsedData: res.data?.job || res.data } });
    } catch {
      showSnack('Failed to parse ticket', 'error');
    } finally {
      setParsing(false);
    }
  }

  async function handlePasteTicket() {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim().length > 10) {
        setParsing(true);
        try {
          const res = await jobsApi.parseTicket(text.trim());
          navigate('/jobs/new', { state: { parsedData: res.data?.job || res.data } });
        } catch (err) {
          showSnack(err.response?.data?.error || 'Failed to parse ticket', 'error');
        } finally {
          setParsing(false);
        }
        return;
      }
      setPasteModal(true);
    } catch {
      setPasteModal(true);
    }
  }

  return (
    <div className="p-4 space-y-6 max-w-5xl mx-auto pb-24">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Hello, {user?.first_name || 'there'} 👋
          </h2>
          <p className="text-gray-500 text-sm">Here's what's happening today.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleClock}
            disabled={clockLoading}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors text-base disabled:opacity-50 ${
              clockedIn ? 'bg-[#1A73E8] text-white' : 'bg-gray-200 text-gray-500'
            }`}
            title={clockedIn ? 'Clock Out' : 'Clock In'}
          >
            🕐
          </button>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2nd Chance banner */}
      {secondChance > 0 && (
        <button
          onClick={() => navigate('/phone')}
          className="w-full bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 flex items-center justify-between text-left"
        >
          <div>
            <p className="font-semibold text-orange-800 text-sm">{secondChance} 2nd Chance Lead{secondChance !== 1 ? 's' : ''}</p>
            <p className="text-xs text-orange-600">Follow up with missed callers who called more than once</p>
          </div>
          <ChevronRight size={18} className="text-orange-500 flex-shrink-0" />
        </button>
      )}

      {/* Stats cards */}
      {dashLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card>
            <div className="flex flex-col gap-1">
              <div className="p-2 bg-blue-50 rounded-lg w-fit">
                <Briefcase size={18} className="text-[#1A73E8]" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{todayJobs}</p>
              <p className="text-xs text-gray-500">Today's Jobs</p>
            </div>
          </Card>
          <Card>
            <div className="flex flex-col gap-1">
              <div className="p-2 bg-green-50 rounded-lg w-fit">
                <DollarSign size={18} className="text-green-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(monthRevenue)}</p>
              <p className="text-xs text-gray-500">This Month</p>
            </div>
          </Card>
          <Card>
            <div className="flex flex-col gap-1">
              <div className="p-2 bg-purple-50 rounded-lg w-fit">
                <Receipt size={18} className="text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{openInvoices}</p>
              <p className="text-xs text-gray-500">Open Invoices</p>
            </div>
          </Card>
          <Card>
            <div className="flex flex-col gap-1">
              <div className="p-2 bg-amber-50 rounded-lg w-fit">
                <Calendar size={18} className="text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{scheduledToday}</p>
              <p className="text-xs text-gray-500">Scheduled Today</p>
            </div>
          </Card>
          <Card onClick={() => navigate('/phone')}>
            <div className="flex flex-col gap-1">
              <div className="p-2 bg-red-50 rounded-lg w-fit">
                <Phone size={18} className="text-red-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{missedCalls}</p>
              <p className="text-xs text-gray-500">Missed Calls</p>
            </div>
          </Card>
          <Card onClick={() => navigate('/phone')}>
            <div className="flex flex-col gap-1">
              <div className="p-2 bg-orange-50 rounded-lg w-fit">
                <Star size={18} className="text-orange-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{secondChance}</p>
              <p className="text-xs text-gray-500">2nd Chance</p>
            </div>
          </Card>
        </div>
      )}

      {/* Memberships due soon */}
      {dueSoon.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Memberships Due Soon</h3>
            <button onClick={() => navigate('/memberships')} className="text-sm text-[#1A73E8] font-medium">
              View all
            </button>
          </div>
          <Card>
            <div className="divide-y divide-gray-100">
              {dueSoon.slice(0, 3).map((m, i) => (
                <button
                  key={m.id || m._id || i}
                  onClick={() => navigate(`/customers/${m.customer_id}`)}
                  className="w-full flex items-center justify-between py-3 first:pt-0 last:pb-0 text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{`${m.first_name || ''} ${m.last_name || ''}`.trim() || 'No customer'}</p>
                    <p className="text-xs text-gray-400">{m.plan_name || 'Membership'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-amber-600">
                      {m.next_job_date ? new Date(m.next_job_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                    </p>
                    <ChevronRight size={14} className="text-gray-400 ml-auto mt-0.5" />
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Active Techs */}
      {activeTechs.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Active Techs</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {activeTechs.map((tech, i) => {
              const name = `${tech.first_name || ''} ${tech.last_name || ''}`.trim() || tech.name || 'Tech';
              return (
                <div key={tech.id || tech._id || i} className="flex-shrink-0 bg-white rounded-2xl shadow px-4 py-3 min-w-[140px]">
                  <div className="w-8 h-8 rounded-full bg-[#1A73E8] text-white flex items-center justify-center text-sm font-semibold mb-2">
                    {name[0]?.toUpperCase() || '?'}
                  </div>
                  <p className="font-medium text-sm text-gray-900 truncate">{name}</p>
                  {tech.current_job_title && <p className="text-xs text-gray-400 truncate">{tech.current_job_title}</p>}
                  {tech.last_updated && <p className="text-xs text-gray-300 mt-0.5">Updated {tech.last_updated}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Map */}
      {mapsReady && activeJobs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Job Map</h3>
            <button onClick={() => navigate('/live-map')} className="text-sm text-[#1A73E8] font-medium">
              Full Map
            </button>
          </div>
          <JobMap jobs={activeJobs} techs={activeTechs} />
        </div>
      )}

      {/* Active Jobs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Active Jobs</h3>
          <button onClick={() => navigate('/jobs')} className="text-sm text-[#1A73E8] font-medium">
            View all
          </button>
        </div>
        {jobsLoading ? (
          <LoadingSpinner />
        ) : activeJobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No active jobs"
            description="Jobs that are scheduled or in progress will appear here."
          />
        ) : (
          <div className="space-y-2">
            {activeJobs.map((job) => (
              <Card key={job.id || job._id} onClick={() => navigate(`/jobs/${job.id || job._id}`)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {job.title || job.job_title || 'Untitled Job'}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {`${job.cust_first || ''} ${job.cust_last || ''}`.trim() || 'No customer'}
                    </p>
                    {(job.address || job.service_address) && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {job.address || job.service_address}
                      </p>
                    )}
                  </div>
                  <Badge status={job.status} label={job.status?.replace(/_/g, ' ')} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Paste Ticket FAB */}
      <button
        onClick={handlePasteTicket}
        disabled={parsing}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 bg-[#1A73E8] text-white rounded-2xl shadow-lg flex items-center gap-2 px-5 h-14 hover:bg-blue-700 disabled:opacity-70 transition-colors z-10 font-semibold"
      >
        {parsing ? (
          <><span className="animate-spin inline-block">⟳</span><span className="hidden sm:inline">Parsing...</span></>
        ) : (
          <><ClipboardList size={20} /><span className="hidden sm:inline">Paste Ticket</span></>
        )}
      </button>

      {/* Paste Ticket Modal */}
      <Modal
        isOpen={pasteModal}
        onClose={() => { setPasteModal(false); setTicketText(''); }}
        title="Paste Job Ticket"
        footer={
          <>
            <Button variant="outlined" onClick={() => { setPasteModal(false); setTicketText(''); }}>Cancel</Button>
            <Button loading={parsing} disabled={!ticketText.trim()} onClick={handleParseTicket}>Parse with AI</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Paste any job ticket, email, or work order. AI will extract job details automatically.</p>
          <textarea
            value={ticketText}
            onChange={e => setTicketText(e.target.value)}
            rows={8}
            placeholder="Paste any job ticket here..."
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] resize-none"
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}
