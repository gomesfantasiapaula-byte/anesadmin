'use client'

import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Camera, Upload, X, Check, Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Image from 'next/image'

type Paso = 'captura' | 'procesando' | 'revision' | 'guardando' | 'listo'
type TipoDoc = 'quirurgico' | 'anestesiologico' | 'otro'

export function CapturaOCR() {
  const [paso, setPaso] = useState<Paso>('captura')
  const [imagenUrl, setImagenUrl] = useState<string | null>(null)
  const [imagenBlob, setImagenBlob] = useState<string | null>(null) // URL de Vercel Blob
  const [textoOcr, setTextoOcr] = useState('')
  const [tipoDoc, setTipoDoc] = useState<TipoDoc>('quirurgico')
  const [patientDni, setPatientDni] = useState('')
  const [progreso, setProgreso] = useState(0)

  const inputFileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [camActiva, setCamActiva] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)

  // ── Activar cámara ────────────────────────────────────────────────────────
  const activarCamara = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCamActiva(true)
    } catch {
      toast.error('No se pudo acceder a la cámara')
    }
  }

  const detenerCamara = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCamActiva(false)
  }, [])

  // ── Capturar foto desde cámara ────────────────────────────────────────────
  const capturarFoto = () => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setImagenUrl(dataUrl)
    detenerCamara()
    procesarImagen(dataUrl)
  }

  // ── Seleccionar archivo ───────────────────────────────────────────────────
  const handleArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setImagenUrl(url)
    procesarImagen(url, file)
  }

  // ── Procesar imagen con Tesseract.js ──────────────────────────────────────
  const procesarImagen = async (url: string, file?: File) => {
    setPaso('procesando')
    setProgreso(0)

    try {
      // Importación dinámica para no bloquear el bundle inicial
      const { createWorker } = await import('tesseract.js')

      const worker = await createWorker('spa', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgreso(Math.round(m.progress * 100))
          }
        },
      })

      const { data } = await worker.recognize(url)
      await worker.terminate()

      setTextoOcr(data.text.trim())
      setPaso('revision')

      // Subir imagen a Vercel Blob en paralelo
      if (file) {
        subirImagen(file)
      } else {
        // Convertir dataURL a File para subir
        const blob = await fetch(url).then((r) => r.blob())
        const f = new File([blob], `captura-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        })
        subirImagen(f)
      }
    } catch (error) {
      console.error('Error OCR:', error)
      toast.error('Error al procesar la imagen. Intentá de nuevo.')
      setPaso('captura')
    }
  }

  // ── Subir imagen a Vercel Blob ────────────────────────────────────────────
  const subirImagen = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/documentos/upload', {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        const { url } = await res.json()
        setImagenBlob(url)
      }
    } catch {
      // No bloquear flujo si falla la subida
    }
  }

  // ── Guardar documento ─────────────────────────────────────────────────────
  const guardarDocumento = async () => {
    if (!textoOcr.trim()) {
      toast.error('El texto no puede estar vacío')
      return
    }

    setPaso('guardando')

    try {
      const res = await fetch('/api/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType: tipoDoc,
          ocrText: textoOcr,
          imageUrl: imagenBlob ?? undefined,
          patientDni: patientDni.trim() || undefined,
          docDate: new Date().toISOString().split('T')[0],
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }

      toast.success('Documento guardado correctamente')
      setPaso('listo')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Error al guardar',
      )
      setPaso('revision')
    }
  }

  // ── Reiniciar ─────────────────────────────────────────────────────────────
  const reiniciar = () => {
    setImagenUrl(null)
    setImagenBlob(null)
    setTextoOcr('')
    setPatientDni('')
    setPaso('captura')
    setProgreso(0)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (paso === 'listo') {
    return (
      <div className="card flex flex-col items-center py-16 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-success/10 border border-success/30 flex items-center justify-center mb-4 animate-pulse-glow">
          <Check size={28} className="text-success" />
        </div>
        <h3 className="text-lg font-bold text-text-primary mb-2">
          Documento guardado
        </h3>
        <p className="text-text-secondary text-sm mb-8 text-center">
          El documento fue procesado y guardado exitosamente.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={reiniciar}>
            Nuevo documento
          </Button>
          <Button onClick={() => (window.location.href = '/dashboard/documentos')}>
            Ver documentos
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Paso 1: Captura */}
      {paso === 'captura' && (
        <div className="card space-y-4">
          <h2 className="text-base font-semibold text-text-primary">
            Capturar documento
          </h2>

          {camActiva ? (
            // Vista de cámara
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Guía de encuadre */}
                <div className="absolute inset-6 border-2 border-accent-primary/50 rounded-lg pointer-events-none" />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  icon={<X size={16} />}
                  onClick={detenerCamara}
                >
                  Cancelar
                </Button>
                <Button
                  icon={<Camera size={16} />}
                  onClick={capturarFoto}
                  className="flex-1"
                >
                  Capturar foto
                </Button>
              </div>
            </div>
          ) : (
            // Botones de captura
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={activarCamara}
                className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-border hover:border-accent-primary/50 hover:bg-accent-primary/5 transition-all duration-200 group"
              >
                <Camera
                  size={32}
                  className="text-text-secondary group-hover:text-accent-primary transition-colors"
                />
                <div className="text-center">
                  <p className="text-sm font-medium text-text-primary">
                    Tomar foto
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Usá la cámara del dispositivo
                  </p>
                </div>
              </button>

              <button
                onClick={() => inputFileRef.current?.click()}
                className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-border hover:border-accent-primary/50 hover:bg-accent-primary/5 transition-all duration-200 group"
              >
                <Upload
                  size={32}
                  className="text-text-secondary group-hover:text-accent-primary transition-colors"
                />
                <div className="text-center">
                  <p className="text-sm font-medium text-text-primary">
                    Subir imagen
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    JPEG, PNG, WebP · Máx 10MB
                  </p>
                </div>
              </button>

              <input
                ref={inputFileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleArchivo}
              />
            </div>
          )}
        </div>
      )}

      {/* Paso 2: Procesando OCR */}
      {paso === 'procesando' && (
        <div className="card flex flex-col items-center py-12">
          <Loader2 size={36} className="text-accent-primary animate-spin mb-4" />
          <h3 className="text-base font-semibold text-text-primary mb-2">
            Procesando imagen...
          </h3>
          {/* Barra de progreso */}
          <div className="w-full max-w-xs bg-surface-elevated rounded-full h-1.5 mt-4">
            <div
              className="bg-accent-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progreso}%` }}
            />
          </div>
          <p className="text-xs text-text-secondary mt-2">{progreso}%</p>

          {imagenUrl && (
            <div className="mt-6 rounded-xl overflow-hidden w-48 h-32 relative opacity-50">
              <Image src={imagenUrl} alt="Vista previa" fill className="object-cover" />
            </div>
          )}
        </div>
      )}

      {/* Paso 3: Revisión del texto */}
      {paso === 'revision' && (
        <div className="space-y-4 animate-fade-in">
          {/* Vista previa de imagen */}
          {imagenUrl && (
            <div className="card p-3">
              <div className="relative rounded-lg overflow-hidden h-48">
                <Image src={imagenUrl} alt="Documento capturado" fill className="object-contain" />
              </div>
            </div>
          )}

          {/* Texto extraído */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <FileText size={16} className="text-accent-primary" />
                Texto extraído
              </h3>
              <span className="text-xs text-text-secondary">
                Editá si hay errores
              </span>
            </div>
            <textarea
              value={textoOcr}
              onChange={(e) => setTextoOcr(e.target.value)}
              rows={10}
              className="input-base resize-y font-mono text-xs leading-relaxed"
              placeholder="El texto extraído aparecerá aquí..."
            />
          </div>

          {/* Metadatos del documento */}
          <div className="card space-y-4">
            <h3 className="text-base font-semibold text-text-primary">
              Clasificar documento
            </h3>

            {/* Tipo de documento */}
            <div>
              <p className="metric-label mb-2">Tipo de documento</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: 'quirurgico', label: 'Parte quirúrgico' },
                    { value: 'anestesiologico', label: 'Parte anestesiológico' },
                    { value: 'otro', label: 'Otro' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTipoDoc(opt.value)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                      tipoDoc === opt.value
                        ? 'bg-accent-primary/10 border-accent-primary/40 text-accent-primary'
                        : 'bg-surface border-border text-text-secondary hover:border-accent-primary/30'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* DNI del paciente (opcional) */}
            <Input
              label="DNI del paciente (opcional)"
              placeholder="12345678"
              value={patientDni}
              onChange={(e) => setPatientDni(e.target.value)}
              type="number"
              inputMode="numeric"
            />
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3">
            <Button variant="secondary" icon={<X size={16} />} onClick={reiniciar}>
              Descartar
            </Button>
            <Button
              className="flex-1"
              icon={<Check size={16} />}
              onClick={guardarDocumento}
            >
              Guardar documento
            </Button>
          </div>
        </div>
      )}

      {/* Paso 4: Guardando */}
      {paso === 'guardando' && (
        <div className="card flex flex-col items-center py-12">
          <Loader2 size={32} className="text-accent-primary animate-spin mb-4" />
          <p className="text-text-secondary text-sm">Guardando documento...</p>
        </div>
      )}
    </div>
  )
}
