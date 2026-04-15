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
  Save,
  ChevronRight,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { SisaCobertura } from '@/lib/sisa-api'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Fuente = 'pami' | 'osplad' | 'sss-web' | 'cache' | 'cache-db' | 'api-sisa'

interface ResultadoFuente {
  fuente: Fuente
  encontrado: boolean
  datos?: SisaCobertura
  mensaje?: string
  // SSS específico
  captchaIncorrecto?: boolean
  urlSSS?: string
}

interface CaptchaState {
  image: string
  sid: string
  sessId: string
}

const FUENTE_LABEL: Record<Fuente, string> = {
  pami: 'PAMI / INSSJP',
  osplad: 'OSPLAD',
  'sss-web': 'SSS',
  cache: 'Caché local',
  'cache-db': 'Caché local',
  'api-sisa': 'PUCO/SISA MSAL',
}

// ── Componente principal ──────────────────────────────────────────────────────

export function BuscadorPaciente() {
  const [dni, setDni] = useState('')
  const [sexo, setSexo] = useState<'M' | 'F'>('F')

  // Estados de UI
  const [buscandoAuto, setBuscandoAuto] = useState(false)
  const [resultadosAuto, setResultadosAuto] = useState<ResultadoFuente[]>([])
  const [buscado, setBuscado] = useState(false)

  // SSS CAPTCHA
  const [mostrarSSS, setMostrarSSS] = useState(false)
  const [cargandoCaptcha, setCargandoCaptcha] = useState(false)
  const [captcha, setCaptcha] = useState<CaptchaState | null>(null)
  const [codigoCaptcha, setCodigoCaptcha] = useState('')
  const [enviandoSSS, setEnviandoSSS] = useState(false)
  const [resultadoSSS, setResultadoSSS] = useState<ResultadoFuente | null>(null)

  const dniLimpio = dni.replace(/[.\s-]/g, '').trim()
  const dniValido = /^\d{7,8}$/.test(dniLimpio)

  // ── Búsqueda automática (PAMI + OSPLAD + cache) ───────────────────────────
  const buscarAuto = useCallback(async () => {
    if (!dniValido) { toast.error('Ingresá un DNI válido (7 u 8 dígitos)'); return }

    setBuscandoAuto(true)
    setBuscado(false)
    setResultadosAuto([])
    setResultadoSSS(null)
    setMostrarSSS(false)
    setCaptcha(null)
    setCodigoCaptcha('')

    // Consultas paralelas: cache + PAMI + OSPLAD
    const [cacheRes, pamiRes, ospladRes] = await Promise.allSettled([
      fetch(`/api/pacientes/dni?dni=${dniLimpio}&sexo=${sexo}`).then((r) => r.json()),
      fetch(`/api/pami/consultar?dni=${dniLimpio}&sexo=${sexo}`).then((r) => r.json()),
      fetch(`/api/osplad/consultar?dni=${dniLimpio}&sexo=${sexo}`).then((r) => r.json()),
    ])

    const resultados: ResultadoFuente[] = []

    // Cache local
    if (cacheRes.status === 'fulfilled') {
      const j = cacheRes.value
      if (j.data && !j.data.sinCredenciales && !j.data.sinDatos) {
        resultados.push({ fuente: j.fuente ?? 'cache', encontrado: true, datos: j.data })
      }
    }

    // PAMI
    if (pamiRes.status === 'fulfilled') {
      const j = pamiRes.value
      if (!j.error) resultados.push({ fuente: 'pami', encontrado: j.encontrado, datos: j.datos, mensaje: j.mensaje })
    }

    // OSPLAD
    if (ospladRes.status === 'fulfilled') {
      const j = ospladRes.value
      if (!j.error) resultados.push({ fuente: 'osplad', encontrado: j.encontrado, datos: j.datos, mensaje: j.mensaje })
    }

    setResultadosAuto(resultados)
    setBuscandoAuto(false)
    setBuscado(true)
  }, [dniValido, dniLimpio, sexo])

  // ── SSS: pedir CAPTCHA ────────────────────────────────────────────────────
  const pedirCaptchaSSS = useCallback(async () => {
    setMostrarSSS(true)
    setCargandoCaptcha(true)
    setCaptcha(null)
    setCodigoCaptcha('')
    setResultadoSSS(null)

    try {
      const res = await fetch('/api/sss/captcha')
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al obtener CAPTCHA de SSS'); setCargandoCaptcha(false); return }
      setCaptcha({ image: json.captchaImage, sid: json.captchaSid, sessId: json.phpSessId })
    } catch {
      toast.error('Error de red al contactar SSS')
    } finally {
      setCargandoCaptcha(false)
    }
  }, [])

  // ── SSS: enviar formulario ────────────────────────────────────────────────
  const consultarSSS = useCallback(async () => {
    if (!captcha || !codigoCaptcha.trim()) { toast.error('Ingresá el código de la imagen'); return }

    setEnviandoSSS(true)
    try {
      const res = await fetch('/api/sss/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni: dniLimpio, sexo, captchaCode: codigoCaptcha.trim(), phpSessId: captcha.sessId, captchaSid: captcha.sid }),
      })
      const json = await res.json()

      if (!res.ok) { toast.error(json.error ?? 'Error al consultar SSS'); return }

      if (json.captchaIncorrecto) {
        toast.error('Código incorrecto. Cargando nuevo CAPTCHA…')
        await pedirCaptchaSSS()
        return
      }

      setResultadoSSS({ fuente: 'sss-web', encontrado: json.encontrado, datos: json.datos, mensaje: json.mensaje })
    } catch {
      toast.error('Error de red')
    } finally {
      setEnviandoSSS(false)
    }
  }, [captcha, codigoCaptcha, dniLimpio, sexo, pedirCaptchaSSS])

  const reiniciar = () => {
    setDni('')
    setBuscado(false)
    setResultadosAuto([])
    setResultadoSSS(null)
    setMostrarSSS(false)
    setCaptcha(null)
    setCodigoCaptcha('')
  }

  const hayResultadosPositivos = resultadosAuto.some((r) => r.encontrado)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Formulario ── */}
      <div className="card">
        <h2 className="text-base font-semibold text-text-primary mb-4">
          Consultar cobertura por DNI
        </h2>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex rounded-xl overflow-hidden border border-border flex-shrink-0">
            {(['F', 'M'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSexo(s)}
                disabled={buscandoAuto}
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

          <div className="flex-1">
            <Input
              placeholder="Ej: 12345678"
              value={dni}
              onChange={(e) => { setDni(e.target.value); setBuscado(false) }}
              onKeyDown={(e) => e.key === 'Enter' && buscarAuto()}
              icon={<Search size={16} />}
              type="number"
              inputMode="numeric"
              disabled={buscandoAuto}
            />
          </div>

          {buscado ? (
            <Button onClick={reiniciar} variant="secondary" icon={<Search size={16} />} size="lg" className="flex-shrink-0">
              Nueva consulta
            </Button>
          ) : (
            <Button onClick={buscarAuto} loading={buscandoAuto} icon={<Search size={16} />} size="lg" className="flex-shrink-0" disabled={!dniValido}>
              Buscar
            </Button>
          )}
        </div>

        <p className="mt-3 text-xs text-text-secondary/60">
          Consulta automática en PAMI e IBSA · También podés buscar en SSS con verificación manual
        </p>
      </div>

      {/* ── Cargando ── */}
      {buscandoAuto && (
        <div className="card flex items-center gap-3 py-8 justify-center">
          <Loader2 size={24} className="text-accent-primary animate-spin" />
          <span className="text-text-secondary text-sm">Consultando PAMI y OSPLAD…</span>
        </div>
      )}

      {/* ── Resultados automáticos ── */}
      {buscado && !buscandoAuto && (
        <div className="space-y-4">
          {resultadosAuto.map((r) => (
            <TarjetaResultado key={r.fuente} resultado={r} dniActual={dniLimpio} sexo={sexo} />
          ))}

          {/* ── Sección SSS ── */}
          {!mostrarSSS ? (
            <div className="card border-dashed border-border/60 bg-transparent">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-text-primary">Superintendencia de Servicios de Salud</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Cubre obras sociales nacionales · Requiere resolver un CAPTCHA
                  </p>
                </div>
                <Button
                  onClick={pedirCaptchaSSS}
                  variant="secondary"
                  icon={<ChevronRight size={15} />}
                  size="sm"
                  className="flex-shrink-0"
                >
                  Consultar en SSS
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* CAPTCHA SSS */}
              {(cargandoCaptcha || captcha) && !resultadoSSS && (
                <div className="card space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-text-primary">
                      Verificación SSS
                    </p>
                    {captcha && (
                      <button
                        onClick={pedirCaptchaSSS}
                        disabled={cargandoCaptcha || enviandoSSS}
                        className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
                      >
                        <RefreshCw size={13} />
                        Renovar
                      </button>
                    )}
                  </div>

                  {cargandoCaptcha ? (
                    <div className="flex items-center gap-2 py-4">
                      <Loader2 size={18} className="animate-spin text-accent-primary" />
                      <span className="text-sm text-text-secondary">Cargando CAPTCHA…</span>
                    </div>
                  ) : captcha ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={captcha.image}
                        alt="Código de verificación SSS"
                        className="rounded-lg border border-border h-14 bg-white"
                        draggable={false}
                      />
                      <div className="flex gap-2 flex-1 w-full">
                        <Input
                          placeholder="Escribí el código"
                          value={codigoCaptcha}
                          onChange={(e) => setCodigoCaptcha(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && consultarSSS()}
                          autoFocus
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          disabled={enviandoSSS}
                          className="font-mono tracking-widest text-sm"
                        />
                        <Button
                          onClick={consultarSSS}
                          loading={enviandoSSS}
                          icon={<CheckCircle2 size={15} />}
                          disabled={!codigoCaptcha.trim()}
                        >
                          Confirmar
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Resultado SSS */}
              {resultadoSSS && (
                <TarjetaResultado resultado={resultadoSSS} dniActual={dniLimpio} sexo={sexo} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tarjeta de resultado por fuente ──────────────────────────────────────────

function TarjetaResultado({
  resultado,
  dniActual,
  sexo,
}: {
  resultado: ResultadoFuente
  dniActual: string
  sexo: 'M' | 'F'
}) {
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)

  const { fuente, encontrado, datos, mensaje } = resultado
  const esTiempoReal = fuente === 'sss-web' || fuente === 'pami' || fuente === 'osplad'
  const esCache = fuente === 'cache' || fuente === 'cache-db'

  const guardarEnDB = async () => {
    if (!datos || guardado) return
    setGuardando(true)
    try {
      const res = await fetch('/api/pacientes/guardar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni: dniActual, sexo, datos }),
      })
      if (res.ok) { setGuardado(true); toast.success('Paciente guardado en la base de datos') }
      else { const j = await res.json(); toast.error(j.error ?? 'Error al guardar') }
    } catch { toast.error('Error de red al guardar') }
    finally { setGuardando(false) }
  }

  // ── No encontrado ──
  if (!encontrado) {
    return (
      <div className="card border-border/50 bg-surface/40">
        <div className="flex items-center gap-3">
          <AlertCircle size={18} className="text-text-secondary/60 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text-secondary">
              <span className="font-medium text-text-primary">{FUENTE_LABEL[fuente]}</span>
              {' — '}{mensaje ?? 'No encontrado'}
            </p>
          </div>
          <span className="text-xs text-text-secondary/40 flex-shrink-0">{FUENTE_LABEL[fuente]}</span>
        </div>
      </div>
    )
  }

  // ── Encontrado ──
  const nombreCompleto = [datos?.apellido, datos?.nombre].filter(Boolean).join(', ')
  const vigente = datos?.vigencia === 'VIGENTE' || datos?.estado?.toLowerCase().includes('vigente')

  return (
    <div className="card border-accent-primary/20 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4 mb-5">
        <div className="w-12 h-12 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center flex-shrink-0">
          <User size={20} className="text-accent-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-base font-bold text-text-primary">
                {nombreCompleto || 'Paciente encontrado'}
              </h3>
              <p className="text-text-secondary text-sm">
                DNI {datos?.dni || dniActual}
                {datos?.fechaNacimiento && ` · ${datos.fechaNacimiento}`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(datos?.vigencia || datos?.estado) && (
                <Badge variant={vigente ? 'success' : 'warning'}>
                  <ShieldCheck size={11} />
                  {datos?.vigencia ?? datos?.estado}
                </Badge>
              )}
              <Badge variant="default">
                {FUENTE_LABEL[fuente]}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Datos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
        <DataField label="Obra social / Agente del seguro" value={datos?.obraSocial} />
        <DataField label="Código RNOS" value={datos?.rnos} />
        <DataField label="N° de afiliado / beneficiario" value={datos?.nroAfiliado} />
        <DataField label="Estado de cobertura" value={datos?.estado ?? datos?.vigencia} />
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-text-secondary/50">
          {esCache ? 'Dato en caché (24hs)' : `Dato en tiempo real · ${FUENTE_LABEL[fuente]}`}
        </p>
        {esTiempoReal && (
          <button
            onClick={guardarEnDB}
            disabled={guardando || guardado}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              guardado
                ? 'text-success bg-success/10 cursor-default'
                : 'text-accent-primary border border-accent-primary/30 hover:bg-accent-primary/10 disabled:opacity-50'
            }`}
          >
            {guardando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {guardado ? 'Guardado en DB' : 'Guardar en DB'}
          </button>
        )}
      </div>
    </div>
  )
}

function DataField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="metric-label mb-1">{label}</p>
      <p className="text-sm font-medium text-text-primary">{value ?? '—'}</p>
    </div>
  )
}
