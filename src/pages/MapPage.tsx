import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { supabase } from '../lib/supabase';
import { MapPin, Users, Loader2 } from 'lucide-react';

// Load Leaflet dynamically via CDN to avoid npm install
function useLeaflet(mapRef: React.RefObject<HTMLDivElement | null>, branches: any[], technicians: any[]) {
    const mapInstanceRef = useRef<any>(null);

    useEffect(() => {
        if (!mapRef.current || branches.length === 0) return;
        if (mapInstanceRef.current) return; // already initialized

        // Load CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        // Load JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => {
            const L = (window as any).L;
            if (!mapRef.current || mapInstanceRef.current) return;

            // Center on Egypt by default
            const map = L.map(mapRef.current).setView([26.8206, 30.8025], 6);
            mapInstanceRef.current = map;

            // OpenStreetMap tiles (free)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);

            // Branch markers (blue)
            const branchIcon = L.divIcon({
                html: `<div style="background:#0ea5e9;color:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,.3);border:2px solid white">🏢</div>`,
                iconSize: [36, 36], iconAnchor: [18, 18], className: ''
            });

            branches.forEach(b => {
                L.marker([b.latitude, b.longitude], { icon: branchIcon })
                    .addTo(map)
                    .bindPopup(`<b>🏢 ${b.name || b.branch_name || b.title || 'فرع'}</b><br/>${b.address || b.sector || ''}`);
            });

            // Technician markers (green = available)
            const techIcon = L.divIcon({
                html: `<div style="background:#10b981;color:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,.3);border:2px solid white">👤</div>`,
                iconSize: [36, 36], iconAnchor: [18, 18], className: ''
            });

            technicians.forEach(t => {
                if (!t.start_lat || !t.start_lng) return;
                L.marker([t.start_lat, t.start_lng], { icon: techIcon })
                    .addTo(map)
                    .bindPopup(`<b>🔧 ${t.full_name || 'فني'}</b><br/>مناوبة بدأت: ${t.start_at ? new Date(t.start_at).toLocaleTimeString('ar-EG') : '—'}`);
            });

            // Fit bounds if we have markers
            const allPoints = [
                ...branches.filter(b => b.latitude && b.longitude).map(b => [b.latitude, b.longitude]),
                ...technicians.filter(t => t.start_lat && t.start_lng).map(t => [t.start_lat, t.start_lng]),
            ];
            if (allPoints.length > 0) {
                map.fitBounds(allPoints as any, { padding: [40, 40] });
            }
        };
        document.body.appendChild(script);

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, [branches, technicians]);
}

export default function MapPage() {
    const mapRef = useRef<HTMLDivElement>(null);
    const [branches, setBranches] = useState<any[]>([]);
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);

            // Fetch ALL branches — filter client-side for map pins
            const { data: branchData, error } = await supabase
                .from('branches')
                .select('*');

            if (error) console.error('MapPage branches error:', error);

            // Fetch technicians in active shift
            const { data: shiftData } = await supabase
                .from('shifts')
                .select('*, profiles(full_name, employee_code)')
                .is('end_at', null);

            // Helper: resolve lat/lng from ANY column naming convention
            const resolveLat = (b: any) => {
                const v = b.latitude ?? b.lat ?? b.branch_lat ?? b.branch_latitude;
                return v != null && v !== '' && !isNaN(Number(v)) ? Number(v) : null;
            };
            const resolveLng = (b: any) => {
                const v = b.longitude ?? b.lng ?? b.branch_lng ?? b.branch_longitude;
                return v != null && v !== '' && !isNaN(Number(v)) ? Number(v) : null;
            };

            // Only branches WITH valid coordinates go on the map
            const withCoords = (branchData || [])
                .map((b: any) => ({ ...b, latitude: resolveLat(b), longitude: resolveLng(b) }))
                .filter((b: any) => b.latitude !== null && b.longitude !== null);

            setBranches(withCoords);
            setTechnicians((shiftData || []).map((s: any) => ({
                ...s,
                full_name: s.profiles?.full_name,
                employee_code: s.profiles?.employee_code,
            })));
            setLoading(false);
        };
        load();
    }, []);

    useLeaflet(mapRef, branches, technicians);

    return (
        <DashboardLayout>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-surface-900">الخريطة التشغيلية</h2>
                    <p className="text-surface-500 text-sm mt-1">مواقع الفروع والفنيين المتاحين الآن</p>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex items-center gap-2 bg-white border border-surface-200 rounded-xl px-4 py-2.5 shadow-sm">
                    <div className="w-8 h-8 bg-sky-500 rounded-full flex items-center justify-center text-white text-sm">🏢</div>
                    <div>
                        <p className="text-xs text-surface-400 font-medium">الفروع</p>
                        <p className="text-lg font-bold text-surface-900">{branches.length}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-white border border-surface-200 rounded-xl px-4 py-2.5 shadow-sm">
                    <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white text-sm">👤</div>
                    <div>
                        <p className="text-xs text-surface-400 font-medium">فنيون متاحون الآن</p>
                        <p className="text-lg font-bold text-surface-900">{technicians.length}</p>
                    </div>
                </div>
            </div>

            {/* Map */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden" style={{ height: '60vh', minHeight: 400 }}>
                {loading ? (
                    <div className="flex items-center justify-center h-full flex-col gap-3 text-surface-400">
                        <Loader2 className="w-10 h-10 animate-spin text-primary-400" />
                        <p className="text-sm font-medium">جاري تحميل بيانات الخريطة...</p>
                    </div>
                ) : branches.length === 0 && technicians.length === 0 ? (
                    <div className="flex items-center justify-center h-full flex-col gap-4 text-surface-400">
                        <MapPin className="w-16 h-16 text-surface-300" />
                        <div className="text-center">
                            <p className="font-semibold text-lg">لا توجد إحداثيات مسجّلة بعد</p>
                            <p className="text-sm mt-1">أضف latitude/longitude للفروع في قاعدة البيانات لتظهر على الخريطة</p>
                        </div>
                    </div>
                ) : (
                    <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
                )}
            </div>

            {/* Active Technicians List */}
            {technicians.length > 0 && (
                <div className="mt-5">
                    <h3 className="font-bold text-surface-700 mb-3 flex items-center gap-2">
                        <Users className="w-5 h-5 text-emerald-500" /> الفنيون في المناوبة الآن
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {technicians.map(t => (
                            <div key={t.id} className="bg-white border border-emerald-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
                                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                                    <Users className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-surface-900 text-sm truncate">{t.full_name || 'فني'}</p>
                                    <p className="text-xs text-emerald-600">🟢 متاح</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Branches without coords warning */}
            {branches.length === 0 && !loading && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                    <strong>تنبيه:</strong> لإظهار الفروع على الخريطة، أضف أعمدة <code>latitude</code> و <code>longitude</code> لجدول <code>branches</code> في Supabase وأدخل الإحداثيات.
                </div>
            )}
        </DashboardLayout>
    );
}
