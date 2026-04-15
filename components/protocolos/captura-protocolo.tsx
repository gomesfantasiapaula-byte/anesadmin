'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Camera, ImagePlus, CheckCircle, Loader2, Upload, AlertCircle } from 'lucide-react'
import type { Hospital } from '@/lib/db/schema'

type Paso = 'captura' | 'convirtiendo' | 'metadatos' | 'guardando' | 'listo'

interface CapturaProtocoloProps {
  onGuardado?: () => void
}

export function CapturaProtocolo({ onGuardado }: CapturaProtocoloProps) {
  const inputRef     = useRef<HTMLInputElement>(null)
  const [paso, setPaso]                 = useState<Paso>('captura')
  const [imagenPreview, setImagenPreview] = useState<string | null>(null)
  const [blobUrl, setBlobUrl]           = useState<string | null>(null)
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  const [errorUpload, setErrorUpload]   = useState<string | null>(null)

  // Metadatos del protocolo
  const hoy = new Date().toISOString().split('T')[0]
  const [hospitales, setHospitales]     = useState<Hospital[]>([])
  const [hospitalId, setHospitalId]     = useState('')
  const [nombre, setNombre]             = useState('')
  const [apellido, setApellido]         = useState('')
  const [fecha, setFecha]               = useState(hoy)
  const [notas, setNotas]               = useState('')
  const [errorForm, setErrorForm]       = useState<string | null>(null)

  // Cargar hospitales al montar
  useEffect(() => {
    fetch('/api/hospitales')
      .then((r) => r.json())
      .then((d) => {
        if (d.hospitales?.length) {
          setHospitales(d.hospitales)
          setHospitalId(d.hospitales[0].id)
        }
      })
      .catch(() => {})
  }, [])

  // ── Conversión JPEG con Canvas ──────────────────────────────────────────────
  const convertirAJpeg = useCallback((file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => {
        const MAX = 2048
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height * MAX) / width)
            width  = MAX
          } else {
            width  = Math.round((width * MAX) / height)
            height = MAX
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width  = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Error al convertir imagen a JPEG'))
          },
          'image/jpeg',
          0.85,
        )
      }
      img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
      img.src = URL.createObjectURL(file)
    })
  }, [])

  // ── Upload a Vercel Blob ────────────────────────────────────────────────────
  const subirImagen = useCallback(async (blob: Blob) => {
    setSubiendoImagen(true)
    setErrorUpload(null)
    try {
      const formData = new FormData()
      formData.append('file', blob, 'protocolo.jpg')
      const res = await fetch('/api/protocolos/upload', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? `Error ${res.status}`)
      }
      const { url } = await res.json()
      setBlobUrl(url)
    } catch (err) {
      setErrorUpload(err instanceof Error ? err.message : 'Error al subir imagen')
    } finally {
      setSubiendoImagen(false)
    }
  }, [])

  // ── Handler de selección de archivo ────────────────────────────────────────
  const handleArchivo = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      // Preview inmediato
      setImagenPreview(URL.createObjectURL(file))
      setBlobUrl(null)
      setErrorUpload(null)
      setPaso('convirtiendo')

      try {
        const jpgBlob = await convertirAJpeg(file)
        setPaso('metadatos')
        // Upload en background mientras el usuario llena el form
        subirImagen(jpgBlob)
      } catch {
        setPaso('captura')
        setImagenPreview(null)
        setErrorUpload('No se pudo procesar la imagen. Intentá de nuevo.')
      }
      // Reset input para permitir re-seleccionar el mismo archivo
      e.target.value = ''
    },
    [convertirAJpeg, subirImagen],
  )

  // ── Guardar protocolo ───────────────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!blobUrl) return
    setErrorForm(null)

    if (!nombre.trim() || !apellido.trim()) {
      setErrorForm('Nombre y apellido son obligatorios.')
      return
    }

    setPaso('guardando')
    try {
      const res = await fetch('/api/protocolos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId:       hospitalId || null,
          patientFirstName: nombre.trim(),
          patientLastName:  apellido.trim(),
          protocolDate:     fecha,
          imageUrl:         blobUrl,
          notes:            notas.trim() || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? `Error ${res.status}`)
      }
      setPaso('listo')
      onGuardado?.()
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : 'Error al guardar')
      setPaso('metadatos')
    }
  }

  const resetear = () => {
    setPaso('captura')
    setImagenPreview(null)
    setBlobUrl(null)
    setNombre('')
    setApellido('')
    setFecha(hoy)
    setNotas('')
    setErrorForm(null)
    setErrorUpload(null)
  }

  // ── Renders ─────────────────────────────────────────────────────────────────

  if (paso === 'listo') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-6 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-accent-primary/10 border border-accent-primary/30 flex items-center justify-center">
          <CheckCircle size={32} className="text-accent-primary" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-text-primary">Protocolo guardado</p>
          <p className="text-sm text-text-secondary mt-1">
            {apellido}, {nombre} — {formatearFecha(fecha)}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={resetear} className="btn-primary">
            Nuevo protocolo
          </button>
          <button
            onClick={() => onGuardado?.()}
            className="btn-secondary"
          >
            Ver galería
          </button>
        </div>
      </div>
    )
  }

  if (paso === 'captura') {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Input oculto — se activa por los botones */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleArchivo}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Tomar foto (cámara trasera en mobile) */}
          <button
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.setAttribute('capture', 'environment')
                inputRef.current.click()
              }
            }}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border hover:border-accent-primary/50 hover:bg-accent-primary/5 transition-all duration-200 p-10 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center group-hover:border-accent-primary/30 transition-colors">
              <Camera size={24} className="text-text-secondary group-hover:text-accent-primary transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-text-primary">Tomar foto</p>
              <p className="text-xs text-text-secondary mt-0.5">Cámara del dispositivo</p>
            </div>
          </button>

          {/* Subir desde galería / archivo */}
          <button
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.removeAttribute('capture')
                inputRef.current.click()
              }
            }}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border hover:border-accent-primary/50 hover:bg-accent-primary/5 transition-all duration-200 p-10 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center group-hover:border-accent-primary/30 transition-colors">
              <ImagePlus size={24} className="text-text-secondary group-hover:text-accent-primary transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-text-primary">Subir desde galería</p>
              <p className="text-xs text-text-secondary mt-0.5">JPEG, PNG, HEIC</p>
            </div>
          </button>
        </div>

        {errorUpload && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm">
            <AlertCircle size={16} className="flex-shrink-0" />
            {errorUpload}
          </div>
        )}

        <p className="text-xs text-text-secondary text-center">
          La imagen se convierte automáticamente a JPEG antes de guardarse.
        </p>
      </div>
    )
  }

  if (paso === 'convirtiendo') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
        <Loader2 size={32} className="text-accent-primary animate-spin" />
        <p className="text-sm text-text-secondary">Procesando imagen…</p>
      </div>
    )
  }

  // paso === 'metadatos' | 'guardando'
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid md:grid-cols-2 gap-6">

        {/* Preview de la imagen */}
        <div className="relative">
          {imagenPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagenPreview}
              alt="Preview del protocolo"
              className="w-full rounded-2xl border border-border object-contain bg-black/20 max-h-80"
            />
          )}
          {/* Badge de estado de upload */}
          <div className="absolute top-3 right-3">
            {subiendoImagen ? (
              <span className="flex items-center gap-1.5 text-xs font-medium bg-surface/90 backdrop-blur border border-border rounded-full px-2.5 py-1 text-text-secondary">
                <Upload size={12} className="animate-bounce" />
                Subiendo…
              </span>
            ) : blobUrl ? (
              <span className="flex items-center gap-1.5 text-xs font-medium bg-accent-primary/10 border border-accent-primary/30 rounded-full px-2.5 py-1 text-accent-primary">
                <CheckCircle size={12} />
                Lista
              </span>
            ) : errorUpload ? (
              <span className="flex items-center gap-1.5 text-xs font-medium bg-danger/10 border border-danger/20 rounded-full px-2.5 py-1 text-danger">
                <AlertCircle size={12} />
                Error al subir
              </span>
            ) : null}
          </div>

          {/* Botón cambiar foto */}
          <button
            onClick={resetear}
            className="mt-2 text-xs text-text-secondary hover:text-text-primary underline underline-offset-2 transition-colors"
          >
            Cambiar foto
          </button>
        </div>

        {/* Formulario de metadatos */}
        <div className="space-y-4">
          {/* Hospital */}
          {hospitales.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Institución
              </label>
              <select
                value={hospitalId}
                onChange={(e) => setHospitalId(e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary/50 transition-colors"
              >
                <option value="">Sin institución</option>
                {hospitales.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Apellido */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
              Apellido <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              placeholder="Apellido del paciente"
              className="w-full bg-surface-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-primary/50 transition-colors"
            />
          </div>

          {/* Nombre */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
              Nombre <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del paciente"
              className="w-full bg-surface-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-primary/50 transition-colors"
            />
          </div>

          {/* Fecha */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
              Fecha del procedimiento
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full bg-surface-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary/50 transition-colors"
            />
          </div>

          {/* Notas opcionales */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
              Notas <span className="text-text-secondary/40 font-normal normal-case">(opcional)</span>
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones, técnica, fármacos…"
              rows={3}
              className="w-full bg-surface-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-primary/50 transition-colors resize-none"
            />
          </div>

          {/* Error general */}
          {errorForm && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm">
              <AlertCircle size={16} className="flex-shrink-0" />
              {errorForm}
            </div>
          )}

          {/* Error de upload reintentable */}
          {errorUpload && !blobUrl && (
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20 text-sm">
              <span className="flex items-center gap-2 text-danger">
                <AlertCircle size={15} className="flex-shrink-0" />
                {errorUpload}
              </span>
            </div>
          )}

          {/* Botón guardar */}
          <button
            onClick={handleGuardar}
            disabled={!blobUrl || subiendoImagen || paso === 'guardando'}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {paso === 'guardando' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Guardando…
              </>
            ) : subiendoImagen || !blobUrl ? (
              <>
                <Upload size={16} className="animate-bounce" />
                Subiendo imagen…
              </>
            ) : (
              'Guardar protocolo'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatearFecha(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}
