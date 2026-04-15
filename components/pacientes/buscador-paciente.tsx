'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Search, User, ShieldCheck, AlertCircle, Loader2,
  RefreshCw, CheckCircle2, Save, ChevronRight,
  ClipboardEdit, X, Building2,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { SisaCobertura } from '@/lib/sisa-api'
import type { Patient } from '@/lib/db/schema'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Fuente = 'pami' | 'osplad' | 'sss-web' | 'cache' | 'cache-db' | 'api-sisa'

interface ResultadoFuente {
  fuente: Fuente
  encontrado: boolean
  datos?: SisaCobertura
  mensaje?: string
  captchaIncorrecto?: boolean
}

interface CaptchaState { image: string; sid: string; sessId: string }

const FUENTE_LABEL: Record<Fuente, string> = {
  pami: 'PAMI / INSSJP', osplad: 'OSPLAD', 'sss-web': 'SSS',
  cache: 'Guardado', 'cache-db': 'Guardado', 'api-sisa': 'PUCO/SISA',
}

const PREPAGAS = [
  'OSDE', 'Swiss Medical', 'Galeno', 'Medicus', 'Omint', 'Accord Salud',
  'Sancor Salud', 'Luis Pasteur', 'Federada Salud', 'Prevención Salud',
  'CEMIC', 'Hospital Alemán', 'Hospital Italiano', 'Avalian', 'Otra',
]
const OBRAS_SOCIALES = [
  'IOMA', 'OSPE', 'IPROSS', 'DOSEP', 'IPAUSS', 'OSPLAD', 'OSDE (OS)',
  'OSECAC', 'Bancarios (OSBA)', 'Camioneros', 'SMATA', 'Luz y Fuerza',
  'UPCN', 'ATE', 'Docentes (SADOP)', 'Otra',
]

// ── Componente principal ──────────────────────────────────────────────────────

export function BuscadorPaciente() {
  const [dni, setDni] = useState('')
  const [sexo, setSexo] = useState<'M' | 'F'>('F')

  const [buscandoAuto, setBuscandoAuto] = useState(false)
  const [resultadosAuto, setResultadosAuto] = useState<ResultadoFuente[]>([])
  const [buscado, setBuscado] = useState(false)
  const [perfilGuardado, setPerfilGuardado] = useState<Patient | null>(null)

  // SSS CAPTCHA
  const [mostrarSSS, setMostrarSSS] = useState(false)
  const [cargandoCaptcha, setCargandoCaptcha] = useState(false)
  const [captcha, setCaptcha] = useState<CaptchaState | null>(null)
  const [codigoCaptcha, setCodigoCaptcha] = useState('')
  const [enviandoSSS, setEnviandoSSS] = useState(false)
  const [resultadoSSS, setResultadoSSS] = useState<ResultadoFuente | null>(null)

  // Formulario manual
  const [mostrarFormManual, setMostrarFormManual] = useState(false)
  const [formManual, setFormManual] = useState<FormManual>(FORM_VACIO)
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)

  const dniLimpio = dni.replace(/[.\s-]/g, '').trim()
  const dniValido = /^\d{7,8}$/.test(dniLimpio)

  // Pre-llenar formulario con datos detectados automáticamente
  const prellenarForm = useCallback((resultados: ResultadoFuente[], perfil: Patient | null) => {
    if (perfil) {
      setFormManual({
        nombre: perfil.nombre ?? '',
        apellido: perfil.apellido ?? '',
        fechaNacimiento: perfil.fechaNacimiento ?? '',
        coberturaTipo: perfil.coberturaTipo ?? '',
        coberturaNombre: perfil.coberturaNombre ?? '',
        coberturaCredencial: perfil.coberturaCredencial ?? '',
        coberturaPlan: perfil.coberturaPlan ?? '',
        coberturaNotas: perfil.coberturaNotas ?? '',
      })
      return
    }
    const positivo = resultados.find((r) => r.encontrado && r.datos)
    if (positivo?.datos) {
      const d = positivo.datos
      setFormManual((f) => ({
        ...f,
        nombre: d.nombre ?? f.nombre,
        apellido: d.apellido ?? f.apellido,
        fechaNacimiento: d.fechaNacimiento ?? f.fechaNacimiento,
        coberturaNombre: d.obraSocial ?? f.coberturaNombre,
        coberturaTipo: d.obraSocial?.toLowerCase().includes('pami') ? 'obra-social'
          : d.obraSocial ? 'obra-social' : f.coberturaTipo,
      }))
    }
  }, [])

  // ── Búsqueda automática ───────────────────────────────────────────────────
  const buscarAuto = useCallback(async () => {
    if (!dniValido) { toast.error('Ingresá un DNI válido (7 u 8 dígitos)'); return }

    setBuscandoAuto(true)
    setBuscado(false)
    setResultadosAuto([])
    setResultadoSSS(null)
    setMostrarSSS(false)
    setMostrarFormManual(false)
    setCaptcha(null)
    setCodigoCaptcha('')
    setPerfilGuardado(null)

    const [perfilRes, cacheRes, pamiRes, ospladRes] = await Promise.allSettled([
      fetch(`/api/pacientes/perfil?dni=${dniLimpio}`).then((r) => r.json()),
      fetch(`/api/pacientes/dni?dni=${dniLimpio}&sexo=${sexo}`).then((r) => r.json()),
      fetch(`/api/pami/consultar?dni=${dniLimpio}&sexo=${sexo}`).then((r) => r.json()),
      fetch(`/api/osplad/consultar?dni=${dniLimpio}&sexo=${sexo}`).then((r) => r.json()),
    ])

    // Perfil guardado
    let perfil: Patient | null = null
    if (perfilRes.status === 'fulfilled' && perfilRes.value?.patient) {
      perfil = perfilRes.value.patient
      setPerfilGuardado(perfil)
    }

    const resultados: ResultadoFuente[] = []

    // Cache API (solo si no hay perfil guardado que lo tape)
    if (!perfil && cacheRes.status === 'fulfilled') {
      const j = cacheRes.value
      if (j.data && !j.data.sinCredenciales && !j.data.sinDatos) {
        resultados.push({ fuente: j.fuente ?? 'cache', encontrado: true, datos: j.data })
      }
    }

    if (pamiRes.status === 'fulfilled' && !pamiRes.value.error) {
      const j = pamiRes.value
      resultados.push({ fuente: 'pami', encontrado: j.encontrado, datos: j.datos, mensaje: j.mensaje })
    }
    if (ospladRes.status === 'fulfilled' && !ospladRes.value.error) {
      const j = ospladRes.value
      resultados.push({ fuente: 'osplad', encontrado: j.encontrado, datos: j.datos, mensaje: j.mensaje })
    }

    setResultadosAuto(resultados)
    setBuscandoAuto(false)
    setBuscado(true)
    prellenarForm(resultados, perfil)
  }, [dniValido, dniLimpio, sexo, prellenarForm])

  // ── SSS CAPTCHA ───────────────────────────────────────────────────────────
  const pedirCaptchaSSS = useCallback(async () => {
    setMostrarSSS(true); setCargandoCaptcha(true)
    setCaptcha(null); setCodigoCaptcha(''); setResultadoSSS(null)
    try {
      const res = await fetch('/api/sss/captcha')
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error CAPTCHA SSS'); setCargandoCaptcha(false); return }
      setCaptcha({ image: json.captchaImage, sid: json.captchaSid, sessId: json.phpSessId })
    } catch { toast.error('Error de red') }
    finally { setCargandoCaptcha(false) }
  }, [])

  const consultarSSS = useCallback(async () => {
    if (!captcha || !codigoCaptcha.trim()) { toast.error('Ingresá el código'); return }
    setEnviandoSSS(true)
    try {
      const res = await fetch('/api/sss/consultar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni: dniLimpio, sexo, captchaCode: codigoCaptcha.trim(), phpSessId: captcha.sessId, captchaSid: captcha.sid }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error SSS'); return }
      if (json.captchaIncorrecto) { toast.error('Código incorrecto. Nuevo CAPTCHA…'); await pedirCaptchaSSS(); return }
      const r: ResultadoFuente = { fuente: 'sss-web', encontrado: json.encontrado, datos: json.datos, mensaje: json.mensaje }
      setResultadoSSS(r)
      // Pre-llenar form con datos SSS si no hay nada mejor
      if (json.encontrado && json.datos) {
        prellenarForm([r], perfilGuardado)
      }
    } catch { toast.error('Error de red') }
    finally { setEnviandoSSS(false) }
  }, [captcha, codigoCaptcha, dniLimpio, sexo, pedirCaptchaSSS, prellenarForm, perfilGuardado])

  // ── Guardar perfil ────────────────────────────────────────────────────────
  const guardarPerfil = async () => {
    setGuardandoPerfil(true)
    // Detectar cobertura automática encontrada
    const autoPositivo = resultadoSSS?.encontrado ? resultadoSSS
      : resultadosAuto.find((r) => r.encontrado && r.datos)
    try {
      const res = await fetch('/api/pacientes/perfil', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dni: dniLimpio, sexo,
          ...formManual,
          coberturaAutoNombre: autoPositivo?.datos?.obraSocial ?? null,
          coberturaAutoFuente: autoPositivo?.fuente ?? null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al guardar'); return }
      setPerfilGuardado(json.patient)
      setMostrarFormManual(false)
      toast.success('Perfil del paciente guardado')
    } catch { toast.error('Error de red') }
    finally { setGuardandoPerfil(false) }
  }

  const reiniciar = () => {
    setDni(''); setBuscado(false); setResultadosAuto([]); setResultadoSSS(null)
    setMostrarSSS(false); setCaptcha(null); setCodigoCaptcha('')
    setPerfilGuardado(null); setMostrarFormManual(false); setFormManual(FORM_VACIO)
  }

  const hayPositivo = resultadosAuto.some((r) => r.encontrado) || resultadoSSS?.encontrado

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Buscador ── */}
      <div className="card">
        <h2 className="text-base font-semibold text-text-primary mb-4">Consultar cobertura por DNI</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex rounded-xl overflow-hidden border border-border flex-shrink-0">
            {(['F', 'M'] as const).map((s) => (
              <button key={s} onClick={() => setSexo(s)} disabled={buscandoAuto}
                className={`px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${sexo === s ? 'bg-accent-primary text-background' : 'bg-surface text-text-secondary hover:text-text-primary'}`}>
                {s === 'F' ? 'Femenino' : 'Masculino'}
              </button>
            ))}
          </div>
          <div className="flex-1">
            <Input placeholder="Ej: 12345678" value={dni}
              onChange={(e) => { setDni(e.target.value); setBuscado(false) }}
              onKeyDown={(e) => e.key === 'Enter' && buscarAuto()}
              icon={<Search size={16} />} type="number" inputMode="numeric" disabled={buscandoAuto} />
          </div>
          {buscado
            ? <Button onClick={reiniciar} variant="secondary" icon={<Search size={16} />} size="lg" className="flex-shrink-0">Nueva consulta</Button>
            : <Button onClick={buscarAuto} loading={buscandoAuto} icon={<Search size={16} />} size="lg" className="flex-shrink-0" disabled={!dniValido}>Buscar</Button>
          }
        </div>
        <p className="mt-3 text-xs text-text-secondary/60">
          Consulta automática en PAMI e OSPLAD · SSS con verificación manual
        </p>
      </div>

      {/* ── Loading ── */}
      {buscandoAuto && (
        <div className="card flex items-center gap-3 py-8 justify-center">
          <Loader2 size={24} className="text-accent-primary animate-spin" />
          <span className="text-text-secondary text-sm">Consultando PAMI, OSPLAD y perfil guardado…</span>
        </div>
      )}

      {buscado && !buscandoAuto && (
        <div className="space-y-4">

          {/* ── Perfil guardado ── */}
          {perfilGuardado && (
            <PerfilCard
              perfil={perfilGuardado}
              onEditar={() => { setMostrarFormManual(true) }}
            />
          )}

          {/* ── Resultados automáticos ── */}
          {resultadosAuto.map((r) => (
            <TarjetaResultado key={r.fuente} resultado={r} dniActual={dniLimpio} sexo={sexo}
              onGuardarCobertura={(os) => {
                setFormManual((f) => ({ ...f, coberturaNombre: os, coberturaTipo: 'obra-social' }))
                setMostrarFormManual(true)
              }}
            />
          ))}

          {/* ── SSS ── */}
          {!mostrarSSS ? (
            <div className="card border-dashed border-border/60 bg-transparent">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-text-primary">Superintendencia de Servicios de Salud</p>
                  <p className="text-xs text-text-secondary mt-0.5">Obras sociales nacionales + prepagas con aportes · Requiere CAPTCHA</p>
                </div>
                <Button onClick={pedirCaptchaSSS} variant="secondary" icon={<ChevronRight size={15} />} size="sm" className="flex-shrink-0">
                  Consultar en SSS
                </Button>
              </div>
            </div>
          ) : (
            <>
              {(cargandoCaptcha || captcha) && !resultadoSSS && (
                <div className="card space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-text-primary">Verificación SSS</p>
                    {captcha && (
                      <button onClick={pedirCaptchaSSS} disabled={cargandoCaptcha || enviandoSSS}
                        className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40">
                        <RefreshCw size={13} /> Renovar
                      </button>
                    )}
                  </div>
                  {cargandoCaptcha
                    ? <div className="flex items-center gap-2 py-4"><Loader2 size={18} className="animate-spin text-accent-primary" /><span className="text-sm text-text-secondary">Cargando CAPTCHA…</span></div>
                    : captcha && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={captcha.image} alt="CAPTCHA SSS" className="rounded-lg border border-border h-14 bg-white" draggable={false} />
                        <div className="flex gap-2 flex-1 w-full">
                          <Input placeholder="Escribí el código" value={codigoCaptcha}
                            onChange={(e) => setCodigoCaptcha(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && consultarSSS()}
                            autoFocus autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                            disabled={enviandoSSS} className="font-mono tracking-widest text-sm" />
                          <Button onClick={consultarSSS} loading={enviandoSSS} icon={<CheckCircle2 size={15} />} disabled={!codigoCaptcha.trim()}>
                            Confirmar
                          </Button>
                        </div>
                      </div>
                    )
                  }
                </div>
              )}
              {resultadoSSS && (
                <TarjetaResultado resultado={resultadoSSS} dniActual={dniLimpio} sexo={sexo}
                  onGuardarCobertura={(os) => {
                    setFormManual((f) => ({ ...f, coberturaNombre: os, coberturaTipo: 'obra-social' }))
                    setMostrarFormManual(true)
                  }}
                />
              )}
            </>
          )}

          {/* ── Botón cargar manualmente ── */}
          {!mostrarFormManual && (
            <button onClick={() => setMostrarFormManual(true)}
              className="w-full text-sm text-text-secondary/70 hover:text-text-primary border border-dashed border-border/50 rounded-2xl py-3 transition-colors flex items-center justify-center gap-2">
              <ClipboardEdit size={15} />
              {hayPositivo ? 'Guardar perfil del paciente' : 'Cargar cobertura manualmente'}
            </button>
          )}

          {/* ── Formulario manual ── */}
          {mostrarFormManual && (
            <FormularioManual
              form={formManual}
              onChange={setFormManual}
              onGuardar={guardarPerfil}
              onCancelar={() => setMostrarFormManual(false)}
              guardando={guardandoPerfil}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Tarjeta de perfil guardado ────────────────────────────────────────────────

function PerfilCard({ perfil, onEditar }: { perfil: Patient; onEditar: () => void }) {
  const nombreCompleto = [perfil.apellido, perfil.nombre].filter(Boolean).join(', ')
  const tieneCobertura = perfil.coberturaNombre || perfil.coberturaAutoNombre

  return (
    <div className="card border-accent-primary/30 bg-accent-primary/5 animate-fade-in">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-accent-primary/15 border border-accent-primary/25 flex items-center justify-center flex-shrink-0">
          <User size={18} className="text-accent-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-text-primary">{nombreCompleto || 'Paciente'}</h3>
              <p className="text-xs text-text-secondary">
                DNI {perfil.dni}
                {perfil.fechaNacimiento && ` · ${perfil.fechaNacimiento}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default">Perfil guardado</Badge>
              <button onClick={onEditar} className="text-xs text-text-secondary hover:text-text-primary transition-colors p-1">
                <ClipboardEdit size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border/50">
        {/* Cobertura manual (prioridad) */}
        {perfil.coberturaNombre ? (
          <>
            <DataField label="Cobertura" value={
              perfil.coberturaTipo === 'prepaga' ? `Prepaga: ${perfil.coberturaNombre}`
              : perfil.coberturaTipo === 'particular' ? 'Particular (sin cobertura)'
              : perfil.coberturaNombre
            } />
            {perfil.coberturaCredencial && <DataField label="N° credencial" value={perfil.coberturaCredencial} />}
            {perfil.coberturaPlan && <DataField label="Plan" value={perfil.coberturaPlan} />}
          </>
        ) : perfil.coberturaAutoNombre ? (
          <DataField label={`Cobertura (${perfil.coberturaAutoFuente?.toUpperCase() ?? 'auto'})`} value={perfil.coberturaAutoNombre} />
        ) : (
          <p className="text-xs text-text-secondary/60 col-span-2">Sin cobertura registrada</p>
        )}
        {perfil.coberturaNotas && (
          <DataField label="Notas" value={perfil.coberturaNotas} className="col-span-2" />
        )}
      </div>

      {tieneCobertura && (
        <div className="mt-3 flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-success" />
          <span className="text-xs text-success font-medium">Con cobertura registrada</span>
        </div>
      )}
    </div>
  )
}

// ── Tarjeta de resultado automático ──────────────────────────────────────────

function TarjetaResultado({
  resultado, dniActual, sexo, onGuardarCobertura,
}: {
  resultado: ResultadoFuente
  dniActual: string
  sexo: 'M' | 'F'
  onGuardarCobertura?: (obraSocial: string) => void
}) {
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const { fuente, encontrado, datos, mensaje } = resultado

  const guardarEnDB = async () => {
    if (!datos || guardado) return
    setGuardando(true)
    try {
      const res = await fetch('/api/pacientes/guardar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni: dniActual, sexo, datos }),
      })
      if (res.ok) { setGuardado(true); toast.success('Cobertura guardada en caché') }
      else { const j = await res.json(); toast.error(j.error ?? 'Error al guardar') }
    } catch { toast.error('Error de red') }
    finally { setGuardando(false) }
  }

  if (!encontrado) {
    return (
      <div className="card border-border/50 bg-surface/40">
        <div className="flex items-center gap-3">
          <AlertCircle size={16} className="text-text-secondary/50 flex-shrink-0" />
          <p className="text-sm text-text-secondary flex-1">
            <span className="font-medium text-text-primary">{FUENTE_LABEL[fuente]}</span>
            {' — '}{mensaje ?? 'No encontrado'}
          </p>
          <span className="text-xs text-text-secondary/40 flex-shrink-0">{FUENTE_LABEL[fuente]}</span>
        </div>
      </div>
    )
  }

  const nombreCompleto = [datos?.apellido, datos?.nombre].filter(Boolean).join(', ')
  const vigente = datos?.vigencia === 'VIGENTE' || datos?.estado?.toLowerCase().includes('vigente')
  const esTiempoReal = fuente === 'sss-web' || fuente === 'pami' || fuente === 'osplad'

  return (
    <div className="card border-accent-primary/20 animate-fade-in">
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
                {datos?._edad != null && ` · ${(datos as any)._edad} años`}
                {datos?.fechaNacimiento && !(datos as any)._edad && ` · FN: ${datos.fechaNacimiento}`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(datos?.vigencia || datos?.estado) && (
                <Badge variant={vigente ? 'success' : 'warning'}>
                  <ShieldCheck size={11} />{datos?.vigencia ?? datos?.estado}
                </Badge>
              )}
              <Badge variant="default">{FUENTE_LABEL[fuente]}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
        <DataField label="Apellido" value={datos?.apellido} />
        <DataField label="Nombre" value={datos?.nombre} />
        <DataField label="Edad" value={
          (datos as any)?._edad != null ? `${(datos as any)._edad} años`
          : datos?.fechaNacimiento ? `FN: ${datos.fechaNacimiento}` : undefined
        } />
        <DataField label="Obra social / Agente" value={datos?.obraSocial} />
        <DataField label="Código RNOS" value={datos?.rnos} />
        <DataField label="N° de afiliado" value={datos?.nroAfiliado} />
        <DataField label="Estado" value={datos?.estado ?? datos?.vigencia} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-text-secondary/50">
          {esTiempoReal ? `Tiempo real · ${FUENTE_LABEL[fuente]}` : 'Caché local'}
        </p>
        <div className="flex items-center gap-2">
          {datos?.obraSocial && onGuardarCobertura && (
            <button onClick={() => onGuardarCobertura(datos.obraSocial!)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:border-accent-primary/40 text-text-secondary hover:text-text-primary transition-colors">
              <ClipboardEdit size={12} /> Guardar en perfil
            </button>
          )}
          {esTiempoReal && (
            <button onClick={guardarEnDB} disabled={guardando || guardado}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                guardado ? 'text-success bg-success/10 cursor-default'
                : 'text-accent-primary border border-accent-primary/30 hover:bg-accent-primary/10 disabled:opacity-50'}`}>
              {guardando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {guardado ? 'En caché' : 'Caché'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Formulario de cobertura manual ────────────────────────────────────────────

interface FormManual {
  nombre: string
  apellido: string
  fechaNacimiento: string
  coberturaTipo: string
  coberturaNombre: string
  coberturaCredencial: string
  coberturaPlan: string
  coberturaNotas: string
}
const FORM_VACIO: FormManual = {
  nombre: '', apellido: '', fechaNacimiento: '',
  coberturaTipo: '', coberturaNombre: '', coberturaCredencial: '', coberturaPlan: '', coberturaNotas: '',
}

function FormularioManual({
  form, onChange, onGuardar, onCancelar, guardando,
}: {
  form: FormManual
  onChange: (f: FormManual) => void
  onGuardar: () => void
  onCancelar: () => void
  guardando: boolean
}) {
  const set = (k: keyof FormManual) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...form, [k]: e.target.value })

  const opciones = form.coberturaTipo === 'prepaga' ? PREPAGAS
    : form.coberturaTipo === 'obra-social' ? OBRAS_SOCIALES
    : []

  return (
    <div className="card border-border space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-accent-primary" />
          <h3 className="text-sm font-semibold text-text-primary">Perfil del paciente</h3>
        </div>
        <button onClick={onCancelar} className="text-text-secondary hover:text-text-primary transition-colors p-1">
          <X size={16} />
        </button>
      </div>

      {/* Datos personales */}
      <div>
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3">Datos personales</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Apellido</label>
            <Input placeholder="García" value={form.apellido} onChange={set('apellido')} />
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Nombre/s</label>
            <Input placeholder="Juan Carlos" value={form.nombre} onChange={set('nombre')} />
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Fecha de nacimiento</label>
            <Input placeholder="DD/MM/AAAA" value={form.fechaNacimiento} onChange={set('fechaNacimiento')} />
          </div>
        </div>
      </div>

      {/* Cobertura */}
      <div>
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3">Cobertura de salud</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Tipo */}
          <div className="sm:col-span-2">
            <label className="text-xs text-text-secondary mb-1 block">Tipo de cobertura</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { val: 'prepaga', label: 'Prepaga privada' },
                { val: 'obra-social', label: 'Obra social' },
                { val: 'particular', label: 'Particular' },
                { val: 'sin-cobertura', label: 'Sin cobertura' },
              ].map(({ val, label }) => (
                <button key={val}
                  onClick={() => onChange({ ...form, coberturaTipo: val, coberturaNombre: '' })}
                  className={`px-3 py-2 text-xs rounded-xl border transition-colors ${
                    form.coberturaTipo === val
                      ? 'bg-accent-primary text-background border-accent-primary'
                      : 'border-border text-text-secondary hover:text-text-primary hover:border-accent-primary/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Nombre (dropdown o texto libre) */}
          {(form.coberturaTipo === 'prepaga' || form.coberturaTipo === 'obra-social') && (
            <>
              <div className="sm:col-span-2">
                <label className="text-xs text-text-secondary mb-1 block">
                  {form.coberturaTipo === 'prepaga' ? 'Prepaga' : 'Obra social'}
                </label>
                <select
                  value={opciones.includes(form.coberturaNombre) ? form.coberturaNombre : (form.coberturaNombre ? 'Otra' : '')}
                  onChange={(e) => {
                    if (e.target.value === 'Otra') onChange({ ...form, coberturaNombre: '' })
                    else onChange({ ...form, coberturaNombre: e.target.value })
                  }}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-primary transition-colors"
                >
                  <option value="">— Seleccioná —</option>
                  {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                {/* Texto libre si eligió "Otra" */}
                {(form.coberturaNombre && !opciones.slice(0,-1).includes(form.coberturaNombre)) && (
                  <Input className="mt-2" placeholder="Nombre de la cobertura"
                    value={form.coberturaNombre}
                    onChange={set('coberturaNombre')}
                  />
                )}
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1 block">N° de credencial / afiliado</label>
                <Input placeholder="Ej: 1234567-89" value={form.coberturaCredencial} onChange={set('coberturaCredencial')} />
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Plan</label>
                <Input placeholder="Ej: 210, Gold, etc." value={form.coberturaPlan} onChange={set('coberturaPlan')} />
              </div>
            </>
          )}

          {/* Notas */}
          <div className="sm:col-span-2">
            <label className="text-xs text-text-secondary mb-1 block">Notas adicionales</label>
            <textarea
              placeholder="Ej: Autorización previa requerida, copago especial…"
              value={form.coberturaNotas}
              onChange={set('coberturaNotas')}
              rows={2}
              className="w-full bg-surface border border-border rounded-xl px-3 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-primary transition-colors resize-none placeholder:text-text-secondary/50"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onCancelar} disabled={guardando}>Cancelar</Button>
        <Button onClick={onGuardar} loading={guardando} icon={<Save size={15} />}>
          Guardar perfil
        </Button>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function DataField({ label, value, className }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={className}>
      <p className="metric-label mb-1">{label}</p>
      <p className="text-sm font-medium text-text-primary">{value ?? '—'}</p>
    </div>
  )
}
