import { getMimeType } from './media';

export async function optimizeImage(
    buffer: Uint8Array,
    sourceExtension: string,
    targetFormat: string,
    quality: number,
    maxWidth: number,
    maxHeight: number
): Promise<{ buffer: Uint8Array<ArrayBufferLike>; extension: string } | null> {
    try {
        const mimeType = getMimeType(sourceExtension);
        const blob = new Blob([buffer as BlobPart], { type: mimeType });
        const imageBitmap = await createImageBitmap(blob);

        let { width, height } = imageBitmap;

        if (maxWidth > 0 && width > maxWidth) {
            height = Math.round(height * maxWidth / width);
            width = maxWidth;
        }
        if (maxHeight > 0 && height > maxHeight) {
            width = Math.round(width * maxHeight / height);
            height = maxHeight;
        }

        const targetMimeType = targetFormat === 'webp' ? 'image/webp'
            : targetFormat === 'jpeg' ? 'image/jpeg'
                : targetFormat === 'png' ? 'image/png'
                    : mimeType;

        let outputBlob: Blob;

        if (typeof OffscreenCanvas !== 'undefined') {
            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get 2D context');
            ctx.drawImage(imageBitmap, 0, 0, width, height);
            outputBlob = await canvas.convertToBlob({ type: targetMimeType, quality: quality / 100 });
        } else {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get 2D context');
            ctx.drawImage(imageBitmap, 0, 0, width, height);
            outputBlob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(blob => {
                    if (blob) resolve(blob);
                    else reject(new Error('Canvas toBlob failed'));
                }, targetMimeType, quality / 100);
            });
        }

        const arrayBuffer = await outputBlob.arrayBuffer();
        const extension = targetFormat === 'jpeg' ? 'jpg' : targetFormat;

        imageBitmap.close();

        return { buffer: new Uint8Array(arrayBuffer), extension };
    } catch (error) {
        console.warn('Image optimization failed, using original:', error);
        return null;
    }
}
