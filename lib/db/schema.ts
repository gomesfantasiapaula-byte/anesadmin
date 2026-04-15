import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  jsonb,
  date,
  time,
  varchar,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ── Usuarios (manejado por NextAuth) ──────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
})

// ── Cuentas OAuth (requerido por NextAuth DrizzleAdapter) ─────────────────────
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: text('token_type'),
  scope: text('scope'),
  idToken: text('id_token'),
  sessionState: text('session_state'),
})

// ── Sesiones NextAuth ─────────────────────────────────────────────────────────
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionToken: text('session_token').notNull().unique(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
})

// ── Tokens de verificación ────────────────────────────────────────────────────
export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull().unique(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
})

// ── Hospitales y Clínicas ─────────────────────────────────────────────────────
export const hospitals = pgTable(
  'hospitals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    address: text('address'),
    phone: varchar('phone', { length: 50 }),
    contact: varchar('contact', { length: 255 }),
    notes: text('notes'),
    // Color para identificar en el calendario
    color: varchar('color', { length: 7 }).default('#00d4aa'),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('hospitals_user_idx').on(table.userId),
  }),
)

// ── Jornadas de trabajo ───────────────────────────────────────────────────────
export const workSessions = pgTable(
  'work_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    hospitalId: uuid('hospital_id')
      .notNull()
      .references(() => hospitals.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    timeIn: time('time_in'),
    timeOut: time('time_out'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    userDateIdx: index('work_sessions_user_date_idx').on(
      table.userId,
      table.date,
    ),
  }),
)

// ── Pacientes (perfil persistente) ───────────────────────────────────────────
export const patients = pgTable(
  'patients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dni: varchar('dni', { length: 20 }).notNull().unique(),
    sexo: varchar('sexo', { length: 1 }).notNull(),
    nombre: text('nombre'),
    apellido: text('apellido'),
    fechaNacimiento: varchar('fecha_nacimiento', { length: 10 }), // DD/MM/YYYY
    // Cobertura detectada automáticamente (última búsqueda exitosa)
    coberturaAutoNombre: text('cobertura_auto_nombre'),
    coberturaAutoFuente: varchar('cobertura_auto_fuente', { length: 50 }),
    coberturaAutoFecha: timestamp('cobertura_auto_fecha', { mode: 'date' }),
    // Cobertura cargada manualmente
    coberturaTipo: varchar('cobertura_tipo', { length: 30 }),  // 'obra-social'|'prepaga'|'particular'|'sin-cobertura'
    coberturaNombre: text('cobertura_nombre'),
    coberturaCredencial: varchar('cobertura_credencial', { length: 100 }),
    coberturaPlan: varchar('cobertura_plan', { length: 100 }),
    coberturaNotas: text('cobertura_notas'),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    dniIdx: uniqueIndex('patients_dni_idx').on(table.dni),
  }),
)

export type Patient = typeof patients.$inferSelect
export type NewPatient = typeof patients.$inferInsert

// ── Cache de pacientes (API SISA MSAL) ────────────────────────────────────────
export const patientsCache = pgTable(
  'patients_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // DNI + sexo como clave compuesta para el cache
    dni: varchar('dni', { length: 20 }).notNull(),
    sexo: varchar('sexo', { length: 1 }).notNull(), // M o F
    // Respuesta completa de la API guardada como JSON
    dataJson: jsonb('data_json').notNull(),
    fetchedAt: timestamp('fetched_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    dniSexoIdx: uniqueIndex('patients_cache_dni_sexo_idx').on(table.dni, table.sexo),
  }),
)

// ── Documentos OCR ────────────────────────────────────────────────────────────
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    patientDni: varchar('patient_dni', { length: 20 }),
    hospitalId: uuid('hospital_id').references(() => hospitals.id, {
      onDelete: 'set null',
    }),
    // 'quirurgico' | 'anestesiologico' | 'otro'
    docType: varchar('doc_type', { length: 50 }).notNull(),
    // Texto extraído por OCR (editable por el usuario)
    ocrText: text('ocr_text').notNull(),
    // URL en Vercel Blob
    imageUrl: text('image_url'),
    docDate: date('doc_date'),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('documents_user_idx').on(table.userId),
    dniIdx: index('documents_dni_idx').on(table.patientDni),
  }),
)

// ── Relaciones ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  hospitals: many(hospitals),
  workSessions: many(workSessions),
  documents: many(documents),
}))

export const hospitalsRelations = relations(hospitals, ({ one, many }) => ({
  user: one(users, { fields: [hospitals.userId], references: [users.id] }),
  workSessions: many(workSessions),
  documents: many(documents),
}))

export const workSessionsRelations = relations(workSessions, ({ one }) => ({
  user: one(users, { fields: [workSessions.userId], references: [users.id] }),
  hospital: one(hospitals, {
    fields: [workSessions.hospitalId],
    references: [hospitals.id],
  }),
}))

export const documentsRelations = relations(documents, ({ one }) => ({
  user: one(users, { fields: [documents.userId], references: [users.id] }),
  hospital: one(hospitals, {
    fields: [documents.hospitalId],
    references: [hospitals.id],
  }),
}))

// ── Tipos exportados ──────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect
export type Hospital = typeof hospitals.$inferSelect
export type NewHospital = typeof hospitals.$inferInsert
export type WorkSession = typeof workSessions.$inferSelect
export type NewWorkSession = typeof workSessions.$inferInsert
export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
export type PatientCache = typeof patientsCache.$inferSelect
