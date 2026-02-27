import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, RefreshCw } from 'lucide-react';

interface QRScannerProps {
    onScan: (decodedText: string) => void;
    onClose: () => void;
    title?: string;
}

export default function QRScanner({ onScan, onClose, title = 'مسح رمز QR' }: QRScannerProps) {
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Initialize scanner
        const scanner = new Html5QrcodeScanner(
            "reader",
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
            },
            /* verbose= */ false
        );

        scanner.render(
            (decodedText) => {
                // Success
                scanner.clear().then(() => {
                    onScan(decodedText);
                    onClose();
                }).catch(err => {
                    console.error("Failed to clear scanner", err);
                    onScan(decodedText);
                    onClose();
                });
            },
            (errorMessage) => {
                // Silently ignore framing errors
                if (errorMessage.includes("No MultiFormat Readers were able to detect the code")) {
                    return;
                }
                setError(errorMessage);
            }
        );

        scannerRef.current = scanner;

        // Cleanup on unmount
        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(err => console.error("Cleanup failed", err));
            }
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[100] bg-surface-900 flex flex-col items-center justify-center p-4">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center text-white z-10 bg-gradient-to-b from-black/50 to-transparent">
                <h3 className="text-xl font-bold">{title}</h3>
                <button
                    onClick={onClose}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur-md transition-all"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Scanner Container */}
            <div className="w-full max-w-sm aspect-square bg-surface-800 rounded-3xl overflow-hidden relative border-4 border-white/20 shadow-2xl">
                <div id="reader" className="w-full h-full"></div>

                {/* Overlay UI */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    {/* Scanner Frame corner markers */}
                    <div className="w-64 h-64 border-2 border-primary-400 rounded-2xl relative">
                        <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary-500 rounded-tl-lg"></div>
                        <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary-500 rounded-tr-lg"></div>
                        <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary-500 rounded-bl-lg"></div>
                        <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary-500 rounded-br-lg"></div>

                        {/* Scanning Line Animation */}
                        <div className="absolute inset-x-4 top-0 h-1 bg-primary-500/50 shadow-[0_0_15px_rgba(20,184,166,0.8)] animate-scan-line"></div>
                    </div>
                </div>
            </div>

            {/* Hint */}
            <div className="mt-8 text-center text-white/70 space-y-4">
                <div className="flex items-center justify-center gap-2">
                    <Camera className="w-5 h-5 text-primary-400" />
                    <p className="text-sm font-medium">ضع رمز الـ QR داخل الإطار للمسح</p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl text-xs hover:bg-white/20 transition-all mx-auto"
                >
                    <RefreshCw className="w-3.5 h-3.5" /> إعادة ضبط الكاميرا
                </button>
            </div>

            {error && (
                <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 text-red-200 text-sm rounded-xl backdrop-blur-sm">
                    {error}
                </div>
            )}

            <style>{`
                #reader { border: none !important; }
                #reader video { 
                    object-fit: cover !important; 
                    width: 100% !important; 
                    height: 100% !important; 
                    border-radius: 1.5rem !important;
                }
                #reader__scan_region { background: transparent !important; }
                #reader__dashboard { display: none !important; }
                
                @keyframes scan-line {
                    0% { top: 0; }
                    100% { top: 100%; }
                }
                .animate-scan-line {
                    animation: scan-line 2s linear infinite;
                }
            `}</style>
        </div>
    );
}
