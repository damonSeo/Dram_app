/**
 * 이미지 파일을 리사이즈/압축하여 data URL로 변환합니다.
 * 라벨 사진은 썸네일로 충분하므로 기본 600px로 제한합니다.
 */
export async function compressImageToDataUrl(
  file: File,
  maxDim = 600,
  quality = 0.72
): Promise<string> {
  if (typeof window === 'undefined') throw new Error('client only')
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap
  const scale = Math.min(1, maxDim / Math.max(width, height))
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas context failed')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  return canvas.toDataURL('image/jpeg', quality)
}

/**
 * 이미 생성된 data URL을 다시 한 번 리사이즈 (scan preview → 저장용)
 */
export async function shrinkDataUrl(
  dataUrl: string,
  maxDim = 600,
  quality = 0.72
): Promise<string> {
  if (typeof window === 'undefined') return dataUrl
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = dataUrl
  })
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}
