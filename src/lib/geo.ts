/**
 * وحدة مصفوفة التتبع الجغرافي (Geolocation Matrix)
 * نظام التقاط الموقع الإجباري في اللحظات المفصلية
 */

export interface GeoLocation {
    lat: number;
    lng: number;
}

export const getGeoLocation = (): Promise<GeoLocation> => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('متصفحك لا يدعم خواص تحديد الموقع الجغرافي (GPS).'));
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 5000, // Reduced from 10k to 5s to prevent UI hanging
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
            },
            (error) => {
                let errorMsg = 'تعذر الحصول على الموقع الجغرافي.';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMsg = '🚨 تم رفض صلاحية الموقع. يرجى تفعيل الـ GPS من إعدادات المتصفح/الهاتف للمتابعة.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMsg = 'إشارة الـ GPS ضعيفة أو غير متوفرة حالياً.';
                        break;
                    case error.TIMEOUT:
                        errorMsg = '⏳ انتهى وقت محاولة تحديد موقعك. يرجى التأكد من قوة الإشارة أو إعادة المحاولة.';
                        break;
                }
                reject(new Error(errorMsg));
            },
            options
        );

    });
};

/**
 * دالة لحساب المسافة بين نقطتين جغرافيتين (للتأكد من وجود الفني داخل الفرع مستقبلاً)
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return 9999999; // Force out-of-bounds to prevent bypass
    const d = R * c; // in metres
    return d;
};
