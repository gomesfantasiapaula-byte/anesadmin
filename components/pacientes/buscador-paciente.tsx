'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Search,
  User,
  ShieldCheck,
  AlertCircle,
  Loader2,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { SisaCobertura } from '@/lib/sisa-api'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ResultadoPaciente {
  data: SisaCobertura
  fuente: 'cache' | 'cache-db' | 'api-sisa' | 'sss-web'
  urlSSS?: string
  encontrado?: boolean
  mensaje?: string
  captchaIncorrecto?: boolean
  datos?: SisaCobertura
}

interface CaptchaState {
  image: string       // data:image/png;base64,...
  sid: string
  sessId: string
}

type Modo = 'idle' | 'captcha' | 'cargando-captcha' | 'enviando' | 'resultado'

// ── Componente principal ──────────────────────────────────────────────────────

export function BuscadorPaciente() {
  const [dni, setDni] = useState('')
  const [sexo, setSexo] = useState<'M' | 'F'>('F')

  // Modo de la UI
  const [modo, setModo] = useState<Modo>('idle')

  // SSS CAPTCHA
  const [captcha, setCaptcha] = useState<CaptchaState | null>(null)
  const [codigoCaptcha, setCodigoCaptcha] = useState('')

  // Resultado final
  const [resultado, setResultado] = useState<ResultadoPaciente | null>(null)

  // ── Validación básica ─────────────────────────────────────────────────────
  const dniLimpio = dni.replace(/[.\s-]/g, '').trim()
  const dniValido = /^\d{7,8}$/.test(dniLimpio)

  // ── Paso 1: chequear cache, luego solicitar CAPTCHA ──────────────────────
  const pedirCaptcha = useCallback(async () => {
    if (!dniValido) {
      toast.error('Ingresá un DNI válido (7 u 8 dígitos)')
      return
    }

    setModo('cargando-captcha')
    setCaptcha(null)
    setCodigoCaptcha('')
    setResultado(null)

    try {
      // Primero: revisar cache (KV + Postgres) antes de pedir CAPTCHA
      const cacheRes = await fetch(
        `/api/pacientes/dni?dni=${encodeURIComponent(dniLimpio)}&sexo=${sexo}`,
      )
      const cacheJson = await cacheRes.json()

      if (cacheRes.ok && cacheJson.data && !cacheJson.data.sinCredenciales) {
        // ¡Dato en cache! Mostrarlo directo sin CAPTCHA
        setResultado({
          data: cacheJson.data,
          fuente: cacheJson.fuente,
          encontrado: true,
          datos: cacheJson.data,
        })
        setModo('resultado')
        return
      }
    } catch {
      // Si falla el cache, continuar con CAPTCHA igual
    }

    // No hay cache → pedir CAPTCHA a SSS
    try {
      const res = await fetch('/api/sss/captcha')
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error ?? 'Error al obtener CAPTCHA de SSS')
        setModo('idle')
        return
      }

      setCaptcha({
        image: json.captchaImage,
        sid: json.captchaSid,
        sessId: json.phpSessId,
      })
      setModo('captcha')
    } catch {
      toast.error('Error de red al contactar SSS')
      setModo('idle')
    }
  }, [dniValido, dniLimpio, sexo])

  // ── Paso 2: enviar formulario ─────────────────────────────────────────────
  const consultar = useCallback(async () => {
    if (!captcha || !codigoCaptcha.trim()) {
      toast.error('Ingresá el código de la imagen')
      return
    }

    setModo('enviando')

    try {
      const res = await fetch('/api/sss/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dni: dniLimpio,
          sexo,
          captchaCode: codigoCaptcha.trim(),
          phpSessId: captcha.sessId,
          captchaSid: captcha.sid,
        }),
      })

      const json: ResultadoPaciente = await res.json()

      if (!res.ok) {
        toast.error((json as any).error ?? 'Error al consultar SSS')
        setModo('captcha')
        return
      }

      // CAPTCHA incorrecto → renovar automáticamente
      if (json.captchaIncorrecto) {
        toast.error('Código incorrecto. Cargando nuevo CAPTCHA…')
        await pedirCaptcha()
        return
      }

      setResultado(json)
      setModo('resultado')
    } catch {
      toast.error('Error de red')
      setModo('captcha')
    }
  }, [captcha, codigoCaptcha, dniLimpio, sexo, pedirCaptcha])

  const reiniciar = () => {
    setModo('idle')
    setResultado(null)
    setCaptcha(null)
    setCodigoCaptcha('')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Formulario DNI ── */}
      <div className="card">
        <h2 className="text-base font-semibold text-text-primary mb-4">
          Consultar cobertura por DNI
        </h2>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Sexo */}
          <div className="flex rounded-xl overflow-hidden border border-border flex-shrink-0">
            {(['F', 'M'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSexo(s)}
                disabled={modo !== 'idle' && modo !== 'resultado'}
                className={`px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${
                  sexo === s
                    ? 'bg-accent-primary text-background'
                    : 'bg-surface text-text-secondary hover:text-text-primary'
                }`}
              >
                {s === 'F' ? 'Femenino' : 'Masculino'}
              </button>
            ))}
          </div>

          {/* DNI */}
          <div className="flex-1">
            <Input
              placeholder="Ej: 12345678"
              value={dni}
              onChange={(e) => { setDni(e.target.value); setModo('idle') }}
              onKeyDown={(e) => e.key === 'Enter' && pedirCaptcha()}
              icon={<Search size={16} />}
              type="number"
              inputMode="numeric"
              disabled={modo === 'enviando' || modo === 'cargando-captcha'}
            />
          </div>

          {modo === 'resultado' ? (
            <Button
              onClick={reiniciar}
              variant="secondary"
              icon={<Search size={16} />}
              size="lg"
              className="flex-shrink-0"
            >
              Nueva consulta
            </Button>
          ) : (
            <Button
              onClick={pedirCaptcha}
              loading={modo === 'cargando-captcha'}
              icon={<Search size={16} />}
              size="lg"
              className="flex-shrink-0"
              disabled={!dniValido || modo === 'enviando'}
            >
              Buscar
            </Button>
          )}
        </div>

        {/* Fuente */}
        <p className="mt-3 text-xs text-text-secondary/60">
          Consulta vía{' '}
          <a
            href="https://www.sssalud.gob.ar"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-text-secondary"
          >
            Superintendencia de Servicios de Salud
          </a>
          {' '}· El código de verificación lo resolvés vos.
        </p>
      </div>

      {/* ── CAPTCHA ── */}
      {(modo === 'captcha' || modo === 'enviando') && captcha && (
        <div className="card space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              Verificación de seguridad — SSS
            </h3>
            <button
              onClick={pedirCaptcha}
              disabled={modo === 'enviando'}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
            >
              <RefreshCw size={13} />
              Renovar imagen
            </button>
          </div>

          {/* Imagen CAPTCHA */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={captcha.image}
              alt="Código de verificación SSS"
              className="rounded-lg border border-border h-16 bg-white"
              draggable={false}
            />

            <div className="flex-1 space-y-2 w-full sm:w-auto">
              <label className="text-xs text-text-secondary">
                Escribí el texto que ves en la imagen
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ej: k7m4p"
                  value={codigoCaptcha}
                  onChange={(e) => setCodigoCaptcha(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && consultar()}
                  autoFocus
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={modo === 'enviando'}
                  className="font-mono tracking-widest text-sm"
                />
                <Button
                  onClick={consultar}
                  loading={modo === 'enviando'}
                  icon={<CheckCircle2 size={16} />}
                  disabled={!codigoCaptcha.trim()}
                >
                  Confirmar
                </Button>
              </div>
            </div>
          </div>

          <p className="text-xs text-text-secondary/50">
            DNI a consultar: <span className="font-mono">{dniLimpio}</span>
            {' · '}Sexo: {sexo === 'F' ? 'Femenino' : 'Masculino'}
          </p>
        </div>
      )}

      {/* ── Loader enviando ── */}
      {modo === 'enviando' && (
        <div className="card flex items-center justify-center py-10">
          <Loader2 size={28} className="text-accent-primary animate-spin" />
          <span className="ml-3 text-text-secondary text-sm">
            Consultando Superintendencia de Servicios de Salud…
          </span>
        </div>
      )}

      {/* ── Resultado ── */}
      {modo === 'resultado' && resultado && (
        <ResultadoCard resultado={resultado} dniActual={dniLimpio} />
      )}
    </div>
  )
}

// ── Tarjeta de resultado ──────────────────────────────────────────────────────

function ResultadoCard({
  resultado,
  dniActual,
}: {
  resultado: ResultadoPaciente
  dniActual: string
}) {
  // El API de SSS devuelve { encontrado, datos } mientras que PUCO devuelve { data }
  const encontrado = resultado.encontrado ?? (resultado.data && !resultado.data.sinCredenciales)
  const datos: SisaCobertura | undefined =
    resultado.datos ?? resultado.data

  // ── Sin datos / no encontrado ─────────────────────────────────────────────
  if (!encontrado || !datos) {
    return (
      <div className="card border-text-secondary/20 bg-surface/50 animate-fade-in">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-text-secondary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Sin cobertura encontrada
            </p>
            <p className="text-xs text-text-secondary mt-1">
              {resultado.mensaje ?? 'No se encontraron beneficiarios para ese DNI en SSS.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const nombreCompleto = [datos.apellido, datos.nombre].filter(Boolean).join(', ')
  const vigente = datos.vigencia === 'VIGENTE' || datos.estado?.toLowerCase().includes('vigente')

  return (
    <div className="card border-accent-primary/20 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center flex-shrink-0">
          <User size={24} className="text-accent-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-text-primary">
                {nombreCompleto || 'Paciente encontrado'}
              </h3>
              <p className="text-text-secondary text-sm">
                DNI {datos.dni || dniActual}
                {datos.fechaNacimiento && ` · ${datos.fechaNacimiento}`}
              </p>
            </div>
            {(datos.vigencia || datos.estado) && (
              <Badge variant={vigente ? 'success' : 'warning'}>
                <ShieldCheck size={12} />
                {datos.vigencia ?? datos.estado}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Datos de cobertura */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
        <DataField label="Obra social / Agente del seguro" value={datos.obraSocial} />
        <DataField label="Código RNOS" value={datos.rnos} />
        <DataField label="N° de afiliado / beneficiario" value={datos.nroAfiliado} />
        <DataField label="Estado de cobertura" value={datos.estado ?? datos.vigencia} />
      </div>

      {/* Footer */}
      <p className="mt-4 text-right text-xs text-text-secondary/50">
        {resultado.fuente === 'sss-web'
          ? 'Dato en tiempo real · Superintendencia de Servicios de Salud'
          : resultado.fuente === 'api-sisa'
          ? 'Dato en tiempo real · PUCO/SISA MSAL'
          : 'Dato en caché (24hs)'}
      </p>
    </div>
  )
}

function DataField({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  return (
    <div>
      <p className="metric-label mb-1">{label}</p>
      <p className="text-sm font-medium text-text-primary">{value ?? '—'}</p>
    </div>
  )
}
