import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { supabase } from '../lib/supabase';
import { MapPin, Users, Loader2 } from 'lucide-react';

// Use global Leaflet (L) loaded via index.html
function useLeaflet(mapRef: React.RefObject<HTMLDivElement | null>, branches: any[], technicians: any[]) {
    const mapInstanceRef = useRef<any>(null);
    const markersLayerRef = useRef<any>(null);

    // 1. Initial Map Setup (Run once)
    useEffect(() => {
        const L = (window as any).L;
        if (!mapRef.current || !L || mapInstanceRef.current) return;

        const map = L.map(mapRef.current).setView([26.8206, 30.8025], 6);
        mapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        markersLayerRef.current = L.featureGroup().addTo(map);

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []); // Run ONLY once

    // 2. Sync markers and FitBounds (Run when data or map instance ready)
    useEffect(() => {
        const L = (window as any).L;
        const map = mapInstanceRef.current;
        const layer = markersLayerRef.current;

        if (!map || !layer || !L) return;

        layer.clearLayers();

        const branchIcon = L.divIcon({
            html: `<div style="background:#0ea5e9;color:white;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 3px 10px rgba(0,0,0,.2);border:2px solid white">🏢</div>`,
            iconSize: [34, 34], iconAnchor: [17, 17], className: ''
        });

        const techIcon = L.divIcon({
            html: `<div style="background:#10b981;color:white;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 3px 10px rgba(0,0,0,.2);border:2px solid white">👤</div>`,
            iconSize: [34, 34], iconAnchor: [17, 17], className: ''
        });

        const points: any[] = [];
        branches.forEach(b => {
            if (b.latitude && b.longitude) {
                L.marker([b.latitude, b.longitude], { icon: branchIcon }).bindPopup(`<b>${b.name}</b>`).addTo(layer);
                points.push([b.latitude, b.longitude]);
            }
        });

        technicians.forEach(t => {
            if (t.start_lat && t.start_lng) {
                L.marker([t.start_lat, t.start_lng], { icon: techIcon }).bindPopup(`<b>${t.full_name}</b>`).addTo(layer);
                points.push([t.start_lat, t.start_lng]);
            }
        });

        if (points.length > 0) {
            // Delay marginally to ensure DOM has settled
            const timer = setTimeout(() => {
                if (mapInstanceRef.current) {
                    mapInstanceRef.current.invalidateSize();
                    mapInstanceRef.current.fitBounds(points, { padding: [50, 50], maxZoom: 12, animate: false });
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [branches, technicians]); // Sync when data changes
}

export default function MapPage() {
    const mapRef = useRef<HTMLDivElement>(null);
    const [branches, setBranches] = useState<any[]>([]);
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const { data: bData } = await supabase.from('branches').select('*');
                const { data: sData } = await supabase.from('shifts').select('*, profiles(full_name)').is('end_at', null);

                const resolveLat = (b: any) => Number(b.latitude ?? b.branch_lat ?? b.lat);
                const resolveLng = (b: any) => Number(b.longitude ?? b.branch_lng ?? b.lng);

                setBranches((bData || []).map(b => ({ ...b, latitude: resolveLat(b), longitude: resolveLng(b) })));
                setTechnicians((sData || []).map(s => ({
                    ...s,
                    full_name: s.profiles?.full_name,
                    start_lat: s.start_lat,
                    start_lng: s.start_lng
                })));
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
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

            {/* Map Container */}
            <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden relative" style={{ height: '60vh', minHeight: 400 }}>
                {loading && (
                    <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex items-center justify-center flex-col gap-3 text-surface-400">
                        <Loader2 className="w-10 h-10 animate-spin text-primary-400" />
                        <p className="text-sm font-medium text-surface-600">جاري تحميل بيانات الخريطة...</p>
                    </div>
                )}

                {!loading && branches.length === 0 && technicians.length === 0 && (
                    <div className="absolute inset-0 z-10 bg-white flex items-center justify-center flex-col gap-4 text-surface-400">
                        <MapPin className="w-16 h-16 text-surface-300" />
                        <div className="text-center">
                            <p className="font-semibold text-lg text-surface-900">لا توجد إحداثيات مسجّلة بعد</p>
                            <p className="text-sm mt-1">يجب تسجيل إحداثيات الفروع لتظهر هنا</p>
                        </div>
                    </div>
                )}

                {/* Always rendered but may be covered by overlays */}
                <div ref={mapRef} style={{ height: '100%', width: '100%' }} className="z-0" />
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
