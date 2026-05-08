import { useState, useRef, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface Props {
  onCapture: (filePath: string) => void
  onCancel: () => void
}

type Step = 'camera' | 'crop'

export default function CameraCapture({ onCapture, onCancel }: Props) {
  const [step, setStep] = useState<Step>('camera')
  const [photoUrl, setPhotoUrl] = useState('')
  const [imgSize, setImgSize] = useState({ w: 640, h: 480 })
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, w: 200, h: 300 })
  const [dragging, setDragging] = useState<'move' | 'resize' | null>(null)
  const dragStart = useRef({ mx: 0, my: 0, bx: 0, by: 0, bw: 0, bh: 0 })

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
      .then((s) => {
        streamRef.current = s
        if (videoRef.current) videoRef.current.srcObject = s
      })
      .catch(() => {})
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  const takePhoto = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    const url = canvas.toDataURL('image/jpeg', 0.92)
    setPhotoUrl(url)
    setImgSize({ w: canvas.width, h: canvas.height })
    // デフォルトクロップ: 中央2:3
    const ch = canvas.height * 0.8
    const cw = ch * (2 / 3)
    setCropBox({ x: (canvas.width - cw) / 2, y: (canvas.height - ch) / 2, w: cw, h: ch })
    streamRef.current?.getTracks().forEach(t => t.stop())
    setStep('crop')
  }

  const DISPLAY_W = 500
  const displayH = (imgSize.h / imgSize.w) * DISPLAY_W
  const scale = imgSize.w / DISPLAY_W

  const handleMouseDown = (e: React.MouseEvent, type: 'move' | 'resize') => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(type)
    dragStart.current = { mx: e.clientX, my: e.clientY, bx: cropBox.x, by: cropBox.y, bw: cropBox.w, bh: cropBox.h }
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return
    const { mx, my, bx, by, bw } = dragStart.current
    const dx = (e.clientX - mx) * scale
    const dy = (e.clientY - my) * scale

    if (dragging === 'move') {
      setCropBox(prev => ({ ...prev, x: Math.max(0, Math.min(imgSize.w - prev.w, bx + dx)), y: Math.max(0, Math.min(imgSize.h - prev.h, by + dy)) }))
    } else {
      const newW = Math.max(60, bw + dx)
      const newH = newW * 1.5
      setCropBox(prev => ({ ...prev, w: newW, h: newH }))
    }
  }, [dragging, scale, imgSize])

  const handleMouseUp = useCallback(() => setDragging(null), [])

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragging, handleMouseMove, handleMouseUp])

  const handleCrop = async () => {
    const img = new Image()
    img.src = photoUrl
    await new Promise((r) => { img.onload = r })

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(cropBox.w)
    canvas.height = Math.round(cropBox.h)
    canvas.getContext('2d')!.drawImage(
      img,
      Math.round(cropBox.x), Math.round(cropBox.y), Math.round(cropBox.w), Math.round(cropBox.h),
      0, 0, canvas.width, canvas.height
    )

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    const base64 = dataUrl.split(',')[1]
    const filePath = await invoke<string>('save_temp_image_base64', { base64Data: base64 })
    onCapture(filePath)
  }

  if (step === 'camera') {
    return (
      <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center">
        <video ref={videoRef} autoPlay playsInline className="max-w-[640px] max-h-[480px] rounded-lg" />
        <div className="flex gap-4 mt-6">
          <button onClick={takePhoto} className="px-8 py-3 bg-white text-gray-800 font-bold rounded-lg hover:bg-gray-100">
            撮影
          </button>
          <button onClick={onCancel} className="px-8 py-3 text-white border border-white/50 rounded-lg hover:bg-white/10">
            キャンセル
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center">
      <p className="text-white text-sm mb-3">表紙に合わせて枠を調整してください</p>
      <div className="relative select-none" style={{ width: DISPLAY_W, height: displayH }}>
        <img src={photoUrl} className="w-full h-full object-contain" draggable={false} />
        {/* 暗いオーバーレイ */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `linear-gradient(to right, rgba(0,0,0,0.6) ${(cropBox.x / imgSize.w) * 100}%, transparent ${(cropBox.x / imgSize.w) * 100}%, transparent ${((cropBox.x + cropBox.w) / imgSize.w) * 100}%, rgba(0,0,0,0.6) ${((cropBox.x + cropBox.w) / imgSize.w) * 100}%)`
        }} />
        {/* クロップ枠 */}
        <div
          className="absolute border-2 border-white cursor-move"
          style={{
            left: (cropBox.x / imgSize.w) * DISPLAY_W,
            top: (cropBox.y / imgSize.h) * displayH,
            width: (cropBox.w / imgSize.w) * DISPLAY_W,
            height: (cropBox.h / imgSize.h) * displayH,
          }}
          onMouseDown={(e) => handleMouseDown(e, 'move')}
        >
          <div
            className="absolute -bottom-2 -right-2 w-4 h-4 bg-white rounded-full cursor-se-resize"
            onMouseDown={(e) => handleMouseDown(e, 'resize')}
          />
        </div>
      </div>
      <div className="flex gap-4 mt-6">
        <button onClick={handleCrop} className="px-8 py-3 bg-white text-gray-800 font-bold rounded-lg hover:bg-gray-100">
          確定
        </button>
        <button onClick={onCancel} className="px-8 py-3 text-white border border-white/50 rounded-lg hover:bg-white/10">
          キャンセル
        </button>
      </div>
    </div>
  )
}
