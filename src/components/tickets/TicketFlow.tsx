import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getGeoLocation } from '../../lib/geo';
import { useAuth } from '../../contexts/AuthContext';
import { MapPin, Play, CheckCircle, Star, Package, Loader2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface TicketFlowProps {
    ticket: any;
    onUpdate: () => void;
}

export default function TicketFlow({ ticket, onUpdate }: TicketFlowProps) {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // States for Technician Parts Used
    const [inventory, setInventory] = useState<any[]>([]);
    const [selectedPart, setSelectedPart] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [partsUsed, setPartsUsed] = useState<{ part_id: string, name: string, qty: number }[]>([]);

    // States for Manager Evaluation
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');

    useEffect(() => {
        if (ticket.status === 'in_progress' && profile?.role === 'technician') {
            fetchInventory();
        }
    }, [ticket.status, profile]);

    const fetchInventory = async () => {
        const { data } = await supabase.from('inventory').select('*').gt('quantity', 0);
        if (data) setInventory(data);
    };

    const addPart = () => {
        if (!selectedPart || quantity <= 0) return;
        const part = inventory.find(p => p.id === selectedPart);
        if (part) {
            if (quantity > part.quantity) {
                setError(`الكمية المتاحة في المخزن هي ${part.quantity} فقط.`);
                return;
            }
            setPartsUsed([...partsUsed, { part_id: part.id, name: part.name, qty: quantity }]);
            setSelectedPart('');
            setQuantity(1);
            setError(null);
        }
    };

    const removePart = (index: number) => {
        setPartsUsed(partsUsed.filter((_, i) => i !== index));
    };

    const handleAction = async (action: 'start_work' | 'resolve' | 'close') => {
        setLoading(true);
        setError(null);
        try {
            // 1. Capture GeoLocation for critical steps
            const coords = await getGeoLocation();
            let updatePayload: any = {};

            if (action === 'start_work') {
                updatePayload = {
                    status: 'in_progress',
                    started_lat: coords.lat,
                    started_lng: coords.lng
                };
            }
            else if (action === 'resolve') {
                // Record inventory transactions first
                for (const pt of partsUsed) {
                    await supabase.from('inventory_transactions').insert([{
                        inventory_id: pt.part_id,
                        ticket_id: ticket.id,
                        technician_id: profile?.id,
                        quantity_used: pt.qty
                    }]);

                    // Deduct from inventory
                    const pData = inventory.find(i => i.id === pt.part_id);
                    if (pData) {
                        await supabase.from('inventory').update({ quantity: pData.quantity - pt.qty }).eq('id', pt.part_id);
                    }
                }

                updatePayload = {
                    status: 'resolved',
                    resolved_lat: coords.lat,
                    resolved_lng: coords.lng,
                    updated_at: new Date().toISOString()
                };
            }
            else if (action === 'close') {
                updatePayload = {
                    status: 'closed',
                    rating_score: rating,
                    rating_comment: comment,
                    updated_at: new Date().toISOString()
                };
            }

            // Update Ticket
            const { error: updateError } = await supabase
                .from('tickets')
                .update(updatePayload)
                .eq('id', ticket.id);

            if (updateError) throw updateError;
            onUpdate();

        } catch (e: any) {
            setError(e.message || 'حدث خطأ غير متوقع.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-surface-200 p-6">
            <div className="mb-6 border-b border-surface-100 pb-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-xl font-bold text-surface-900">{ticket.asset_name || 'بند صيانة عام'}</h3>
                        <p className="text-surface-500 mt-1">{ticket.description}</p>
                    </div>
                    <span className="px-3 py-1 bg-surface-100 text-surface-700 rounded-lg text-sm font-semibold border border-surface-200">
                        الحالة: {ticket.status}
                    </span>
                </div>
                <div className="flex items-center gap-4 mt-4 text-xs text-surface-400">
                    <span>التاريخ: {format(new Date(ticket.created_at), 'PPP hh:mm a', { locale: ar })}</span>
                    {ticket.reported_lat && (
                        <span className="flex items-center gap-1 text-teal-600 bg-teal-50 px-2 py-1 rounded">
                            <MapPin className="w-3 h-3" /> تم التقاط موقع البلاغ
                        </span>
                    )}
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 border border-red-200">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span className="text-sm font-medium">{error}</span>
                </div>
            )}

            {/* Technician Action: Start Work */}
            {ticket.status === 'assigned' && profile?.role === 'technician' && (
                <div className="bg-primary-50 rounded-xl p-5 border border-primary-100">
                    <h4 className="font-semibold text-primary-900 mb-2">تسجيل الوصول الأمني للفرع</h4>
                    <p className="text-sm text-primary-700 mb-4">يجب أن تكون متواجداً داخل الفرع. سيقوم النظام بمطابقة إحداثياتك الحالية مع إحداثيات الفرع عبر الـ GPS.</p>
                    <button
                        onClick={() => handleAction('start_work')}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold shadow-md shadow-primary-500/20 transition-all disabled:opacity-70"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-white" />}
                        <span>بدء العمل وتأكيد الموقع</span>
                    </button>
                </div>
            )}

            {/* Technician Action: Resolve and Parts */}
            {ticket.status === 'in_progress' && profile?.role === 'technician' && (
                <div className="bg-surface-50 rounded-xl p-5 border border-surface-200 space-y-5">
                    <div className="flex items-center gap-2 text-surface-900 border-b border-surface-200 pb-3">
                        <Package className="w-5 h-5 text-surface-500" />
                        <h4 className="font-semibold text-lg">صرف قطع الغيار</h4>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <select
                            className="flex-1 bg-white border border-surface-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary-500/30"
                            value={selectedPart}
                            onChange={(e) => setSelectedPart(e.target.value)}
                        >
                            <option value="">اختر القطعة...</option>
                            {inventory.map(p => <option key={p.id} value={p.id}>{p.name} (متاح {p.quantity})</option>)}
                        </select>
                        <input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            className="w-24 bg-white border border-surface-200 rounded-xl px-4 py-2"
                        />
                        <button type="button" onClick={addPart} className="px-4 py-2 bg-surface-200 text-surface-700 rounded-xl font-medium hover:bg-surface-300">أضف</button>
                    </div>

                    {partsUsed.length > 0 && (
                        <ul className="space-y-2">
                            {partsUsed.map((pt, i) => (
                                <li key={i} className="flex justify-between items-center bg-white border border-surface-100 p-3 rounded-lg text-sm">
                                    <span>{pt.name} <span className="text-surface-400 mx-2">×</span> <span className="font-bold">{pt.qty}</span></span>
                                    <button type="button" onClick={() => removePart(i)} className="text-red-500 text-xs">حذف</button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="pt-4 border-t border-surface-200">
                        <p className="text-xs text-surface-500 mb-4 flex items-center gap-1"><MapPin className="w-3 h-3" /> سيتم التقاط آخر موقع لك لإثبات إتمام العمل موقعياً</p>
                        <button
                            onClick={() => handleAction('resolve')}
                            disabled={loading}
                            className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold shadow-md shadow-teal-500/20 transition-all disabled:opacity-70"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                            <span>إصلاح العطل وإغلاق البلاغ للفني</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Manager Action: Rate & Close */}
            {ticket.status === 'resolved' && profile?.role === 'manager' && (
                <div className="bg-blue-50 rounded-xl p-5 border border-blue-100 space-y-5">
                    <h4 className="font-bold text-blue-900 border-b border-blue-200 pb-2">تقييم الفني والإغلاق النهائي</h4>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-blue-800 mb-2">التقييم (من 1 إلى 5)</label>
                            <div className="flex gap-2 text-2xl" dir="ltr">
                                {[1, 2, 3, 4, 5].map(v => (
                                    <button key={v} onClick={() => setRating(v)} className={clsx("transition-transform hover:scale-110", rating >= v ? "text-amber-400" : "text-blue-200")}>
                                        <Star className="fill-current w-8 h-8" />
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-blue-800 mb-2">تعليق على أداء الفني (اختياري)</label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                className="w-full bg-white border border-blue-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500/30"
                                rows={3}
                            />
                        </div>
                        <button
                            onClick={() => handleAction('close')}
                            disabled={loading}
                            className="flex items-center justify-center w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all disabled:opacity-70"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'اعتماد التقييم وإغلاق تذكرة الصيانة'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
