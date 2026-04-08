import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGet } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { useSnackbar } from '../components/ui/Snackbar';
import { Card, Badge, LoadingSpinner, EmptyState, Modal, Button } from '../components/ui';
import api from '../lib/api';
import { Briefcase, DollarSign, Receipt, Calendar, ClipboardList, Phone, Star, Users, ChevronRight } from 'lucide-react';

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
    let geocoded = 0;

    // Job markers (up to 20)
    const jobsToShow = jobs.slice(0, 20);
    jobsToShow.forEach(job => {
      const addr = job.address || job.service_address;
      if (!addr) return;
      geocoder.geocode({ address: addr }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const pos = results[0].geometry.location;
          const marker = new window.google.maps.Marker({
            position: pos,
            map: mapInstance.current,
            title: job.title || job.job_title || 'Job',
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#1A73E8',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2,
            },
          });
          markersRef.current.push(marker);
          bounds.extend(pos);
          geocoded++;
          if (geocoded === 1) mapInstance.current.setCenter(pos);
        }
      });
    });

    // Tech markers (from GPS live)
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

  const { data: dashData, loading: dashLoading } = useGet('/reports/dashboard');
  const { data: jobsData, loading: jobsLoading } = useGet(
    '/jobs?status=scheduled,en_route,in_progress,unscheduled&page=1&limit=10'
  );
  const { data: gpsData } = useGet('/gps/live');
  const { data: dueSoonData } = useGet('/memberships/due-soon');
  const { data: phoneData } = useGet('/phone/stats');

  const raw = dashData?.report || dashData?.stats || dashData || {};
  const todayJobs      = raw?.jobs?.total      ?? raw.today_jobs      ?? raw.todayJobs      ?? 0;
  const monthRevenue   = raw?.revenue?.this_month ?? raw.month_revenue  ?? raw.monthRevenue   ?? 0;
  const openInvoices   = raw?.invoices?.open    ?? raw.open_invoices   ?? raw.openInvoices   ?? 0;
  const scheduledToday = raw?.jobs?.scheduled   ?? raw.scheduled_today ?? raw.scheduledToday ?? 0;
  const missedCalls    = phoneData?.missed_calls ?? phoneData?.missedCalls ?? raw.missed_calls ?? 0;
  const secondChance   = phoneData?.second_chance ?? phoneData?.secondChance ?? raw.second_chance_leads ?? 0;

  const activeJobs  = jobsData?.jobs  || (Array.isArray(jobsData) ? jobsData : []);
  const activeTechs = gpsData?.techs  || gpsData?.technicians || (Array.isArray(gpsData) ? gpsData : []);
  const dueSoon     = dueSoonData?.memberships || (Array.isArray(dueSoonData) ? dueSoonData : []);

  async function handleParseTicket() {
    if (!ticketText.trim()) return;
    setParsing(true);
    try {
      const res = await api.post('/jobs/parse-ticket', { text: ticketText });
      setPasteModal(false);
      setTicketText('');
      navigate('/jobs/new', { state: { parsedData: res.data?.job || res.data } });
    } catch {
      showSnack('Failed to parse ticket', 'error');
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className="p-4 space-y-6 max-w-5xl mx-auto pb-24">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Hello, {user?.first_name || 'there'} 👋
        </h2>
        <p className="text-gray-500 text-sm">Here's what's happening today.</p>
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
                    <p className="text-sm font-medium text-gray-900">{m.customer_name || 'Customer'}</p>
                    <p className="text-xs text-gray-400">{m.plan_name || 'Membership'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-amber-600">
                      {m.days_until_renewal != null ? `${m.days_until_renewal}d left` : m.renewal_date || ''}
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
            <button onClick={() => navigate('/map')} className="text-sm text-[#1A73E8] font-medium">
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
                      {job.customer_name || job.customer?.name || 'No customer'}
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
        onClick={() => setPasteModal(true)}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 bg-[#1A73E8] text-white rounded-full shadow-lg flex items-center gap-2 px-4 h-14 hover:bg-blue-700 transition-colors z-10 font-semibold"
      >
        <ClipboardList size={20} />
        <span className="hidden sm:inline">Paste Ticket</span>
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
