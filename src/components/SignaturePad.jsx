import { useRef, useState, useEffect } from 'react'

export default function SignaturePad({ onSave, onCancel }) {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)

    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, rect.width, rect.height)

    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Signature line
    ctx.beginPath()
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.moveTo(20, rect.height - 40)
    ctx.lineTo(rect.width - 20, rect.height - 40)
    ctx.stroke()

    ctx.fillStyle = '#9ca3af'
    ctx.font = '14px system-ui'
    ctx.fillText('Sign here ✕', 20, rect.height - 48)

    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2
  }, [])

  function getPos(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches?.[0]
    return {
      x: (touch?.clientX || e.clientX) - rect.left,
      y: (touch?.clientY || e.clientY) - rect.top,
    }
  }

  function startDraw(e) {
    e.preventDefault()
    setIsDrawing(true)
    setHasDrawn(true)
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  function draw(e) {
    e.preventDefault()
    if (!isDrawing) return
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  function endDraw(e) {
    e.preventDefault()
    setIsDrawing(false)
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(20, rect.height - 40)
    ctx.lineTo(rect.width - 20, rect.height - 40)
    ctx.stroke()
    ctx.fillStyle = '#9ca3af'
    ctx.font = '14px system-ui'
    ctx.fillText('Sign here ✕', 20, rect.height - 48)
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2
    setHasDrawn(false)
  }

  function save() {
    const canvas = canvasRef.current
    const dataUrl = canvas.toDataURL('image/png')
    const base64 = dataUrl.split(',')[1]
    onSave(base64)
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        className="w-full border border-gray-300 rounded-xl touch-none cursor-crosshair"
        style={{ height: '200px' }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <div className="flex gap-3">
        <button
          onClick={clear}
          className="flex-1 py-2 border border-gray-300 rounded-xl text-gray-600 font-medium hover:bg-gray-50 min-h-[44px]"
        >
          Clear
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 py-2 border border-gray-300 rounded-xl text-gray-600 font-medium hover:bg-gray-50 min-h-[44px]"
          >
            Cancel
          </button>
        )}
        <button
          onClick={save}
          disabled={!hasDrawn}
          className="flex-1 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 min-h-[44px]"
        >
          Save Signature
        </button>
      </div>
    </div>
  )
}
