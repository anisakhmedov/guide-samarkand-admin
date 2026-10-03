// Phone camera shots are often 4–12 MB (over the 8 MB upload limit) and iPhones may hand
// over HEIC, which the API rejects by extension. Re-encoding to a ~1600px JPEG fixes both
// and makes uploads fast on hotel Wi-Fi.
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  if (file.type === 'image/gif') return file;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    // Browser can't decode it (e.g. HEIC outside Safari) — let the server decide.
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
