PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'operador' CHECK (rol IN ('admin','operador')),
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
  debe_cambiar INTEGER NOT NULL DEFAULT 0 CHECK (debe_cambiar IN (0,1)),
  ultimo_acceso TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- token = SHA-256 del token entregado al cliente (nunca se guarda en claro)
CREATE TABLE IF NOT EXISTS sesiones (
  token TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS actividad_usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  accion TEXT NOT NULL,
  ruta TEXT,
  detalle TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_actividad_usuario ON actividad_usuarios(usuario_id, creado_en);

-- Catálogo de tipos de maquinaria (Bottelpack, Shinva, Taponadora, ...)
CREATE TABLE IF NOT EXISTS tipos_maquina (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Máquinas del parque industrial. El código lo asigna Garantía de Calidad (equipo validado)
-- y referencia los POE; los datos eléctricos y de servicios forman la ficha técnica.
CREATE TABLE IF NOT EXISTS maquinas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo       TEXT NOT NULL UNIQUE,
  nombre       TEXT NOT NULL,
  tipo_id      INTEGER REFERENCES tipos_maquina(id) ON DELETE SET NULL,
  marca        TEXT,
  modelo       TEXT,
  num_serie    TEXT,
  departamento TEXT,
  area         TEXT,
  anio         INTEGER,
  capacidad    TEXT,
  poe          TEXT,
  tension      TEXT,
  corriente    TEXT,
  potencia     TEXT,
  presion_aire TEXT,
  consumo_aire TEXT,
  presion_vapor TEXT,
  consumo_vapor TEXT,
  estado       TEXT NOT NULL DEFAULT 'Operativa'
               CHECK (estado IN ('Operativa','En falla','Mantenimiento','Fuera de servicio')),
  notas        TEXT,
  creado_en    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  actualizado_en TEXT
);

-- Fallas técnicas registradas
CREATE TABLE IF NOT EXISTS fallas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo          TEXT UNIQUE,
  maquina_id      INTEGER NOT NULL REFERENCES maquinas(id) ON DELETE CASCADE,
  titulo          TEXT NOT NULL,
  descripcion     TEXT,
  sintomas        TEXT,
  categoria       TEXT NOT NULL DEFAULT 'Mecánica'
                  CHECK (categoria IN ('Mecánica','Eléctrica','Neumática','Hidráulica',
                                       'Electrónica / Control','Software / HMI','Operativa',
                                       'Calidad de producto','Servicios (agua/vapor/aire)','Otra')),
  severidad       TEXT NOT NULL DEFAULT 'Media'
                  CHECK (severidad IN ('Baja','Media','Alta','Crítica')),
  estado          TEXT NOT NULL DEFAULT 'Abierta'
                  CHECK (estado IN ('Abierta','En proceso','Resuelta','Recurrente','Anulada')),
  causa_raiz      TEXT,
  reportado_por   TEXT,
  responsable     TEXT,
  turno           TEXT,
  fecha_deteccion TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  fecha_resolucion TEXT,
  paro_minutos    INTEGER NOT NULL DEFAULT 0,
  creado_en       TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  actualizado_en  TEXT
);

CREATE INDEX IF NOT EXISTS idx_fallas_maquina  ON fallas(maquina_id);
CREATE INDEX IF NOT EXISTS idx_fallas_estado   ON fallas(estado);
CREATE INDEX IF NOT EXISTS idx_fallas_fecha    ON fallas(fecha_deteccion);

-- Soluciones aplicadas a cada falla (histórico: una falla puede tener varios intentos)
CREATE TABLE IF NOT EXISTS soluciones (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  falla_id       INTEGER NOT NULL REFERENCES fallas(id) ON DELETE CASCADE,
  descripcion    TEXT NOT NULL,
  repuestos      TEXT,
  herramientas   TEXT,
  tiempo_minutos INTEGER NOT NULL DEFAULT 0,
  costo          REAL NOT NULL DEFAULT 0,
  tecnico        TEXT,
  efectiva       INTEGER NOT NULL DEFAULT 1 CHECK (efectiva IN (0,1)),
  preventivo     TEXT,
  fecha          TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  creado_en      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_soluciones_falla ON soluciones(falla_id);

-- Fotos y documentos de cada máquina (opcionalmente ligados a una falla).
CREATE TABLE IF NOT EXISTS adjuntos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  maquina_id      INTEGER NOT NULL REFERENCES maquinas(id) ON DELETE CASCADE,
  falla_id        INTEGER REFERENCES fallas(id) ON DELETE CASCADE,
  categoria       TEXT NOT NULL DEFAULT 'Otra'
                  CHECK (categoria IN ('Eléctrica','Electrónica','Mecánica','Ficha técnica','Otra')),
  descripcion     TEXT,
  archivo         TEXT NOT NULL UNIQUE,
  mime            TEXT NOT NULL,
  nombre_original TEXT,
  bytes           INTEGER NOT NULL,
  subido_por      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_adjuntos_maquina ON adjuntos(maquina_id);
CREATE INDEX IF NOT EXISTS idx_adjuntos_falla   ON adjuntos(falla_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);
