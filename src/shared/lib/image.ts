import imageCompression from 'browser-image-compression';

export async function compressImage(file: File) {
    const options = {
        maxSizeMB: 0.8, // Aim for < 1MB
        maxWidthOrHeight: 1280, // Good balance for HD but light
        useWebWorker: true,
        fileType: 'image/webp', // WebP for maximum efficiency
    };

    try {
        const compressedFile = await imageCompression(file, options);
        return compressedFile;
    } catch (error) {
        console.error('Image compression failed:', error);
        return file; // Fallback to original
    }
}
