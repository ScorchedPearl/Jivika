// Client-side utility for uploading images via API route
// This avoids credential issues by using server-side S3 upload

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

const MAX_UPLOAD_SIDE = 1600;

// Phone photos are far larger than the models need, so shrink them before uploading
const shrinkImage = async (file: File): Promise<File> => {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_UPLOAD_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1024 * 1024) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
};

export const uploadImageToS3 = async (original: File): Promise<UploadResult> => {
  try {
    if (!original) {
      return { success: false, error: 'No file provided' };
    }
    const file = await shrinkImage(original);

    // Create FormData for file upload
    const formData = new FormData();
    formData.append('file', file);

    // Upload via API route
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || 'Upload failed' };
    }

    return result;
  } catch (error) {
    console.error('Upload Error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
};

export const deleteImageFromS3 = async (imageUrl: string): Promise<boolean> => {
  try {
    // You can implement this via another API route if needed
    const response = await fetch('/api/delete-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUrl }),
    });

    return response.ok;
  } catch (error) {
    console.error('Delete Error:', error);
    return false;
  }
};
