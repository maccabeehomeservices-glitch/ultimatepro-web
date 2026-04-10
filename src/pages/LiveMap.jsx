import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobsApi, gpsApi, statusColor, statusLabel, formatDate, formatTime } from '../lib/api';

const MAP_KEY = 'AIzaSyDtSGWBuiTFR5BbomG8ZFNYeiwUszkJiNQ';

export default function LiveMap() {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const [jobs, setJobs] = useState([]);
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load Google Maps script
  useEffect(() => {
    if (window.google?.maps) {
      initMap();
      return;
    }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      existing.addEventListener('load', initMap);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAP_KEY}`;
    script.async = true;
    script.onload = initMap;
    document.head.appendChild(script);
  }, []);

  function initMap() {
    if (!mapRef.current || mapInstance.current) return;
    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: 36.8529, lng: -75.978 },
      zoom: 11,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    infoWindowRef.current = new window.google.maps.InfoWindow();
    fetchData();
  }

  async function fetchData() {
    try {
      const [jobsRes, gpsRes] = await Promise.all([
        jobsApi.list({ status: 'scheduled,en_route,in_progress,unscheduled', limit: 200 }),
        gpsApi.getLive().catch(() => ({ data: [] })),
      ]);
      const jobsList = jobsRes.data?.jobs || jobsRes.data || [];
      const techsList = gpsRes.data?.techs || gpsRes.data || [];
      setJobs(jobsList);
      setTechs(techsList);
      plotMarkers(jobsList, techsList);
    } catch {}
    finally { setLoading(false); }
  }

  function plotMarkers(jobsList, techsList) {
    const map = mapInstance.current;
    if (!map) return;
    const geocoder = new window.google.maps.Geocoder();
    const bounds = new window.google.maps.LatLngBounds();

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    // Plot job markers
    jobsList.forEach(job => {
      if (!job.address && !job.city) return;
      const addr = [job.address, job.city, job.state, job.zip].filter(Boolean).join(', ');
      if (!addr) return;

      geocoder.geocode({ address: addr }, (results, geocodeStatus) => {
        if (geocodeStatus !== 'OK' || !results[0]) return;
        const pos = results[0].geometry.location;
        bounds.extend(pos);

        const color = statusColor(job.status);
        const marker = new window.google.maps.Marker({
          position: pos,
          map,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 10,
          },
          title: job.title || job.job_number,
        });

        marker.addListener('click', () => {
          const content = `
            <div style="min-width:200px;font-family:system-ui;padding:4px">
              <div style="font-weight:700;font-size:14px;margin-bottom:4px">${job.job_number || ''}</div>
              <div style="font-size:13px;margin-bottom:2px">${job.title || 'Untitled'}</div>
              <div style="font-size:12px;color:#666;margin-bottom:4px">${job.customer_name || 'No customer'}</div>
              <div style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;color:white;background:${color}">
                ${statusLabel(job.status)}
              </div>
              <div style="font-size:11px;color:#999;margin-top:4px">
                ${job.scheduled_start ? formatDate(job.scheduled_start) + ' ' + formatTime(job.scheduled_start) : 'Not scheduled'}
              </div>
              <div style="margin-top:8px">
                <a href="/jobs/${job.id || job._id}" style="color:#1A73E8;font-size:12px;font-weight:600;text-decoration:none">View Job →</a>
              </div>
            </div>`;
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open(map, marker);
        });

        markersRef.current.push(marker);

        if (markersRef.current.length > 1) {
          map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
        }
      });
    });

    // Plot tech markers (blue)
    techsList.forEach(tech => {
      if (!tech.lat || !tech.lng) return;
      const pos = { lat: Number(tech.lat), lng: Number(tech.lng) };
      bounds.extend(pos);

      const marker = new window.google.maps.Marker({
        position: pos,
        map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: '#1A73E8',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
          scale: 12,
        },
        title: tech.first_name || tech.name || 'Tech',
        label: {
          text: (tech.first_name?.[0] || tech.name?.[0] || 'T').toUpperCase(),
          color: 'white',
          fontSize: '11px',
          fontWeight: 'bold',
        },
      });

      marker.addListener('click', () => {
        infoWindowRef.current.setContent(`
          <div style="font-family:system-ui;padding:4px">
            <div style="font-weight:700;font-size:14px">
              🔵 ${tech.first_name || tech.name || 'Technician'}
            </div>
            <div style="font-size:12px;color:#666;margin-top:2px">
              ${tech.current_job_title || 'Available'}
            </div>
          </div>`);
        infoWindowRef.current.open(map, marker);
      });

      markersRef.current.push(marker);
    });
  }

  // Handle InfoWindow link clicks for SPA navigation
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

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData().catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-white/90 backdrop-blur-sm p-3 flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-gray-500 text-xl">←</button>
          <h1 className="font-bold text-gray-900">Live Map</h1>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
            Techs ({techs.length})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
            Jobs ({jobs.length})
          </span>
        </div>
        <button onClick={() => fetchData()} className="text-blue-600 text-sm font-medium">
          ⟳ Refresh
        </button>
      </div>

      {/* Map container */}
      <div ref={mapRef} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
}
