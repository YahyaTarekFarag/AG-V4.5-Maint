import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@shared/components/layout/DashboardLayout';
import { supabase } from '@shared/lib/supabase';
import { useAuth } from '@shared/hooks/useAuth';
import { MapPin, Users, Shield, Map } from 'lucide-react';
import clsx from 'clsx';
import { applyRBACFilter } from '@shared/lib/rbac';

// Use global Leaflet (L) loaded via index.html
function useLeaflet(mapRef: React.RefObject<HTMLDivElement | null>, branches: any[], technicians: any[]) {
    const mapInstanceRef = useRef<any>(null);
    const markersLayerRef = useRef<any>(null);

    // 1. Initial Map Setup (Run once)
    useEffect(() => {
        const L = (window as any).L;
        if (!mapRef.current || !L || mapInstanceRef.current) return;

        // Optimized for Middle East Focus
        const map = L.map(mapRef.current, {
            zoomControl: false,
            attributionControl: false
        }).setView([26.8206, 30.8025], 6);

        mapInstanceRef.current = map;
        (window as any).leafletMapInstance = map;

        // Premium Dark Matter Tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 20
        }).addTo(map);

        markersLayerRef.current = L.featureGroup().addTo(map);

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const markersMapRef = useRef<Record<string, any>>({});

    // 2. Sync markers
    useEffect(() => {
        const L = (window as any).L;
        const map = mapInstanceRef.current;
        const layer = markersLayerRef.current;

        if (!map || !layer || !L) return;

        const currentIds = new Set();

        // Handle Branches
        branches.forEach(b => {
            const id = `branch-${b.id}`;
            currentIds.add(id);
            const lat = b.latitude;
            const lng = b.longitude;

            const hasTickets = b.tickets && b.tickets.length > 0;
            const hasUrgent = b.tickets && b.tickets.some((t: any) => t.priority === 'urgent');

            const colorClass = hasUrgent ? 'bg-red-500' : (hasTickets ? 'bg-amber-500' : 'bg-sky-500');
            const ringClass = hasUrgent ? 'bg-red-500/40' : (hasTickets ? 'bg-amber-500/40' : 'bg-sky-500/40');
            const textClass = hasUrgent ? 'text-red-400' : (hasTickets ? 'text-amber-400' : 'text-sky-400');

            const dynamicBranchIcon = L.divIcon({
                html: `
                    <div class="relative flex items-center justify-center">
                        <div class="absolute w-8 h-8 ${ringClass} rounded-full animate-ring"></div>
                        <div class="relative w-8 h-8 ${colorClass} text-white rounded-full flex items-center justify-center text-sm shadow-lg border-2 border-surface-900 group">🏢</div>
                        ${hasTickets ? `<div class="absolute -top-2 -right-2 bg-surface-950 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border border-${hasUrgent ? 'red' : 'amber'}-500 shadow-md">${b.tickets.length}</div>` : ''}
                    </div>
                `,
                iconSize: [40, 40], iconAnchor: [20, 20], className: 'custom-div-icon'
            });

            if (lat && lng) {
                let marker = markersMapRef.current[id];
                if (marker) {
                    marker.setLatLng([lat, lng]);
                    marker.setIcon(dynamicBranchIcon);
                } else {
                    marker = L.marker([lat, lng], { icon: dynamicBranchIcon }).addTo(layer);
                    markersMapRef.current[id] = marker;
                }

                marker.bindPopup(`
                    <div class="p-3 bg-surface-950 text-white rounded-xl min-w-[200px]">
                        <h4 class="font-black ${textClass} mb-1">${b.name}</h4>
                        <p class="text-[10px] text-surface-400 font-bold uppercase tracking-widest mb-3">مركز عمليات الفرع</p>
                        <div class="grid grid-cols-2 gap-2 mt-2">
                            <div class="bg-surface-900/50 p-2 rounded-lg border border-surface-800">
                                <p class="text-[9px] text-surface-500 font-bold">الحالة</p>
                                <p class="text-[11px] ${hasUrgent ? 'text-red-400' : (hasTickets ? 'text-amber-400' : 'text-emerald-400')} font-black">
                                    ${hasUrgent ? 'طوارئ' : (hasTickets ? 'أعطال نشطة' : 'مستقر')}
                                </p>
                            </div>
                            <div class="bg-surface-900/50 p-2 rounded-lg border border-surface-800">
                                <p class="text-[9px] text-surface-500 font-bold">البلاغات</p>
                                <p class="text-[11px] text-white font-black">${b.tickets?.length || 0} نشط</p>
                            </div>
                        </div>
                    </div>
                `, { className: 'premium-popup' });
            }
        });

        // Handle Technicians
        technicians.forEach(t => {
            const id = `tech-${t.id}`;
            currentIds.add(id);

            const hasTask = t.active_tickets && t.active_tickets.length > 0;
            const techColor = hasTask ? 'purple' : 'emerald';
            const currentTask = hasTask ? t.active_tickets[0] : null;

            const dynamicTechIcon = L.divIcon({
                html: `
                    <div class="relative flex items-center justify-center">
                        <div class="absolute w-8 h-8 bg-${techColor}-500/40 rounded-full animate-ring"></div>
                        <div class="relative w-8 h-8 bg-${techColor}-500 text-white rounded-full flex items-center justify-center text-sm shadow-lg border-2 border-surface-900">👤</div>
                        ${hasTask ? `<div class="absolute -bottom-1 -right-1 w-3 h-3 bg-purple-500 rounded-full border-2 border-surface-900 animate-pulse"></div>` : ''}
                    </div>
                `,
                iconSize: [32, 32], iconAnchor: [16, 16], className: 'custom-div-icon'
            });

            if (t.clock_in_lat && t.clock_in_lng) {
                let marker = markersMapRef.current[id];
                if (marker) {
                    marker.setLatLng([t.clock_in_lat, t.clock_in_lng]);
                    marker.setIcon(dynamicTechIcon);
                } else {
                    marker = L.marker([t.clock_in_lat, t.clock_in_lng], { icon: dynamicTechIcon }).addTo(layer);
                    markersMapRef.current[id] = marker;
                }

                marker.bindPopup(`
                    <div class="p-3 bg-surface-950 text-white rounded-xl min-w-[200px]">
                        <h4 class="font-black text-${techColor}-400 mb-1">${t.full_name}</h4>
                        <p class="text-[10px] text-surface-400 font-bold uppercase tracking-widest mb-3">فني ميداني مرخص</p>
                        <div class="flex flex-col gap-2 bg-${techColor}-900/20 p-2.5 rounded-lg border border-${techColor}-900/30">
                            <div class="flex items-center gap-2">
                                <div class="w-1.5 h-1.5 rounded-full bg-${techColor}-500 animate-pulse"></div>
                                <p class="text-[10px] text-${techColor}-400 font-black">
                                    ${hasTask ? 'باشر العمل على عطل' : 'متصل / استشعار المهام'}
                                </p>
                            </div>
                            ${hasTask ? `
                                <div class="mt-1 pt-2 border-t border-${techColor}-900/50">
                                    <p class="text-[9px] text-surface-400 font-bold mb-0.5">المهمة الحالية:</p>
                                    <p class="text-[10px] font-black text-white truncate">${currentTask.asset_name || 'صيانة عامة'}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `, { className: 'premium-popup' });
            }
        });

        // Cleanup
        Object.keys(markersMapRef.current).forEach(id => {
            if (!currentIds.has(id)) {
                layer.removeLayer(markersMapRef.current[id]);
                delete markersMapRef.current[id];
            }
        });
    }, [branches, technicians]);
}

export default function MapPage() {
    const { profile } = useAuth();
    const mapRef = useRef<HTMLDivElement>(null);
    const [branches, setBranches] = useState<any[]>([]);
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [stream, setStream] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const handleLocate = () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition((pos) => {
            const L = (window as any).L;
            const map = (window as any).leafletMapInstance;
            if (map && L) {
                const latlng = [pos.coords.latitude, pos.coords.longitude];
                map.flyTo(latlng, 15, { animate: true, duration: 2 });
                L.circle(latlng, { radius: 100, color: '#0ea5e9', fillOpacity: 0.1, weight: 1 }).addTo(map);
            }
        });
    };

    const load = async () => {
        if (!profile) return;
        setLoading(true);
        try {
            // Branches
            let bQuery = supabase.from('branches').select('id, name, latitude, longitude');
            bQuery = applyRBACFilter(bQuery, 'branches', profile);

            // Attendance
            let aQuery = supabase.from('technician_attendance')
                .select('*, profiles:profile_id!inner(full_name), clock_in_lat, clock_in_lng')
                .is('clock_out', null);
            aQuery = applyRBACFilter(aQuery, 'technician_attendance', profile);

            // Tickets Activity
            let tQuery = supabase.from('tickets')
                .select('id, branch_id, assigned_to, status, asset_name, priority')
                .in('status', ['open', 'assigned', 'in_progress'])
                .eq('is_deleted', false);
            tQuery = applyRBACFilter(tQuery, 'tickets', profile);

            // Operational Stream (Last 10 Events)
            const { data: streamData } = await supabase
                .from('technician_attendance')
                .select('id, created_at, profile_id, profiles:profile_id(full_name, branches:branch_id(name))')
                .order('created_at', { ascending: false })
                .limit(10);

            const [{ data: bData }, { data: aData }, { data: tData }] = await Promise.all([bQuery, aQuery, tQuery]);

            const ticketsByBranch = (tData || []).reduce((acc: any, t: any) => {
                if (!acc[t.branch_id]) acc[t.branch_id] = [];
                acc[t.branch_id].push(t);
                return acc;
            }, {});

            const ticketsByTech = (tData || []).filter(t => t.assigned_to).reduce((acc: any, t: any) => {
                if (!acc[t.assigned_to]) acc[t.assigned_to] = [];
                acc[t.assigned_to].push(t);
                return acc;
            }, {});

            setBranches((bData || []).map(b => ({
                ...b,
                tickets: ticketsByBranch[b.id] || []
            })));

            setTechnicians((aData || []).map((s: any) => ({
                ...s,
                full_name: s.profiles?.full_name,
                active_tickets: ticketsByTech[s.profile_id] || []
            })));

            setStream(streamData || []);
        } catch (e) {
            console.error('Map loading error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (profile) {
            load();
            const channel = supabase.channel('map-sync')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'technician_attendance' }, () => load())
                .subscribe();
            return () => { channel.unsubscribe(); };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile]);

    useLeaflet(mapRef, branches, technicians);

    return (
        <DashboardLayout>
            <div className="flex flex-col h-full overflow-hidden">
                {/* Header Section */}
                <div className="flex items-center justify-between mb-6 px-1">
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                            <Map className="w-8 h-8 text-brand-blaban" /> مركز القيادة السيادي
                        </h2>
                        <p className="text-surface-500 text-sm mt-1 font-bold">الرصد الجغرافي اللحظي للفروع والكوادر الميدانية</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
                    {/* Main Content (Map) */}
                    <div className="lg:col-span-3 flex flex-col gap-6 h-full">
                        {/* KPI Bar */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <div className="glass-premium p-4 rounded-2xl border border-sky-900/20 flex items-center gap-4">
                                <div className="w-10 h-10 bg-sky-500/10 rounded-xl flex items-center justify-center text-sky-500 shrink-0">🏢</div>
                                <div>
                                    <p className="text-[10px] text-surface-500 font-black uppercase tracking-widest">إجمالي الفروع</p>
                                    <p className="text-xl font-black text-white">{branches.length}</p>
                                </div>
                            </div>
                            <div className="glass-premium p-4 rounded-2xl border border-emerald-900/20 flex items-center gap-4">
                                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 shrink-0">👤</div>
                                <div>
                                    <p className="text-[10px] text-surface-500 font-black uppercase tracking-widest">فنيين نشطين</p>
                                    <p className="text-xl font-black text-white">{technicians.length}</p>
                                </div>
                            </div>
                            <div className="hidden sm:flex glass-premium p-4 rounded-2xl border border-purple-900/20 items-center gap-4">
                                <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500 shrink-0">📡</div>
                                <div>
                                    <p className="text-[10px] text-surface-500 font-black uppercase tracking-widest">حالة الربط</p>
                                    <p className="text-sm font-black text-white">لحظي / متصل</p>
                                </div>
                            </div>
                        </div>

                        {/* Map Container */}
                        <div className={clsx(
                            "bg-surface-950 rounded-[2.5rem] border border-surface-800 shadow-2xl shadow-black/50 overflow-hidden relative flex-1 min-h-[400px]",
                            isFullscreen && "fixed inset-0 z-[100] rounded-none !h-screen"
                        )}>
                            <div ref={mapRef} className="w-full h-full grayscale-[0.2] brightness-[0.9] contrast-[1.1]" />

                            {/* Map Overlays */}
                            <div className="absolute top-6 right-6 z-[1000] flex flex-col gap-3">
                                <button
                                    onClick={() => setIsFullscreen(!isFullscreen)}
                                    className="p-3 bg-surface-900/80 backdrop-blur-md border border-surface-700/50 rounded-2xl text-white hover:bg-brand-blaban transition-all shadow-xl group"
                                >
                                    {isFullscreen ? <Users className="w-5 h-5" /> : <Map className="w-5 h-5 group-hover:scale-110" />}
                                </button>
                                <button
                                    onClick={handleLocate}
                                    className="p-3 bg-surface-900/80 backdrop-blur-md border border-surface-700/50 rounded-2xl text-brand-blaban hover:bg-brand-blaban hover:text-white transition-all shadow-xl group"
                                >
                                    <MapPin className="w-5 h-5 group-hover:scale-110" />
                                </button>
                            </div>

                            {loading && (
                                <div className="absolute inset-0 z-[2000] bg-surface-950/60 backdrop-blur-sm flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-16 h-1 bg-surface-800 rounded-full overflow-hidden">
                                            <div className="w-1/2 h-full bg-brand-blaban animate-progress origin-left"></div>
                                        </div>
                                        <p className="text-xs font-black text-surface-400 uppercase tracking-widest animate-pulse">Initializing Command Grid...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Operational Stream Sidebar */}
                    <div className="lg:col-span-1 flex flex-col bg-surface-900/30 rounded-[2.5rem] border border-surface-800 p-6 h-full min-h-0">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-black text-white text-lg tracking-tight">التدفق العملياتي</h3>
                            <span className="px-2 py-1 bg-brand-blaban/10 text-brand-blaban text-[10px] font-black rounded-lg">Live</span>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                            {stream.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20">
                                    <Shield className="w-16 h-16 mb-4" />
                                    <p className="text-sm font-bold">في انتظار استلام إشارات ميدانية...</p>
                                </div>
                            ) : (
                                stream.map((item, idx) => (
                                    <div key={item.id} className="p-4 bg-surface-950/50 border border-surface-800 rounded-2xl animate-stream-in" style={{ animationDelay: `${idx * 0.1}s` }}>
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 bg-emerald-500/10 rounded-full flex items-center justify-center shrink-0">
                                                <Users className="w-4 h-4 text-emerald-500" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs text-white font-black truncate">{item.profiles?.full_name}</p>
                                                <p className="text-[10px] text-surface-500 font-bold mt-0.5">سجل حضور في <span className="text-sky-400">{item.branches?.name}</span></p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="text-[9px] text-surface-600 font-black">{new Date(item.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    <div className="w-1 h-1 rounded-full bg-surface-700" />
                                                    <span className="text-[9px] text-emerald-500 font-black uppercase">ناجح</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-6 pt-6 border-t border-surface-800 text-center">
                            <p className="text-[10px] text-surface-600 font-black uppercase tracking-[0.2em]">Operational Pulse Active</p>
                        </div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .premium-popup .leaflet-popup-content-wrapper { background: transparent; padding: 0; border: none; box-shadow: none; }
                .premium-popup .leaflet-popup-tip { background: #0a0a0a; border: 1px solid #1f2937; }
                .leaflet-container { font-family: 'Cairo', sans-serif; }
                @keyframes progress { 
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
                .animate-progress { animation: progress 2s infinite ease-in-out; }
            `}} />
        </DashboardLayout>
    );
}
