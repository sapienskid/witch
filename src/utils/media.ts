const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif', 'ico'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'm4v', 'mkv', 'avi'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus'];

export function isImageExtension(extension: string): boolean {
    return IMAGE_EXTENSIONS.includes(extension.toLowerCase());
}

export function isVideoExtension(extension: string): boolean {
    return VIDEO_EXTENSIONS.includes(extension.toLowerCase());
}

export function isAudioExtension(extension: string): boolean {
    return AUDIO_EXTENSIONS.includes(extension.toLowerCase());
}

export function isPdfExtension(extension: string): boolean {
    return extension.toLowerCase() === 'pdf';
}

export function isMediaExtension(extension: string): boolean {
    return isVideoExtension(extension) || isAudioExtension(extension) || isPdfExtension(extension);
}

export function getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        bmp: 'image/bmp',
        tiff: 'image/tiff',
        tif: 'image/tiff',
        ico: 'image/x-icon',
        mp4: 'video/mp4',
        webm: 'video/webm',
        mov: 'video/quicktime',
        m4v: 'video/mp4',
        mkv: 'video/x-matroska',
        avi: 'video/x-msvideo',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        oga: 'audio/ogg',
        m4a: 'audio/mp4',
        aac: 'audio/aac',
        flac: 'audio/flac',
        opus: 'audio/opus',
        pdf: 'application/pdf'
    };

    return mimeTypes[extension.toLowerCase()] ?? 'application/octet-stream';
}

export function youtubeId(url: string): string | undefined {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
    return match?.[1];
}
