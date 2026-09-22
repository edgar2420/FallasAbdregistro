# Control de Fallas Técnicas — Maquinaria Industrial

Sistema para registrar las fallas de la maquinaria de planta (Bottelpack, Shinva, taponadoras,
llenadoras, autoclaves, etc.), las soluciones que se aplicaron a cada una y las acciones preventivas
recomendadas. El acceso es con usuario y contraseña: el **administrador** da de alta, edita y borra
registros y cuentas; el **operador** consulta y registra soluciones.

## Stack

| Capa      | Tecnología                                                     |
|-----------|----------------------------------------------------------------|
| Backend   | Node.js + Express, SQLite con el módulo nativo `node:sqlite`    |
| Frontend  | Angular 20 (standalone) servido por el dev-server de Angular   |
| Base      | Archivo único en `backend/data/fallas.db` (sin servidor externo)|

No hay dependencias nativas que compilar: SQLite viene incluido en Node 22+.

## Puesta en marcha

```bash
npm run instalar     # instala backend y frontend
npm run seed         # carga tipos, máquinas y un catálogo inicial de fallas resueltas
npm run dev          # API en http://localhost:4010 y web en http://localhost:4200
```

Para uso en planta (un solo proceso que sirve todo en `http://localhost:4010`):

```bash
npm run build
npm start
```

Otros comandos:

- `npm run seed:reset` — vacía la base y vuelve a cargar los datos de ejemplo.
- `GET /api/export/fallas.csv` — historial completo para Excel (aún sin botón en la interfaz).

## Qué hace

- **Tablero**: fallas abiertas y críticas, tiempo de paro del período, MTTR, estado del parque de
  máquinas, distribución por categoría / severidad / tipo de maquinaria y ranking de las máquinas
  con más fallas.
- **Fallas**: alta, edición y búsqueda por síntoma, código, máquina, categoría, severidad y estado.
  Cada falla guarda síntomas, causa raíz, responsable, turno, minutos de paro y fechas de detección
  y resolución.
- **Soluciones**: cada falla lleva su historial de intervenciones (pasos ejecutados, repuestos,
  herramientas, tiempo, costo, técnico y acción preventiva). Una solución marcada como *efectiva*
  cierra la falla automáticamente; una no efectiva la deja *En proceso*.
- **Base de soluciones**: buscador transversal del historial — se escribe un síntoma ("fuga de aceite",
  "torque", "sellado") y se ve qué se hizo la última vez, con qué repuestos y cuánto tomó.
- **Maquinaria**: ficha técnica (marca, modelo, serie, área, año), estado e historial de fallas.
  El estado se sincroniza solo: si una máquina tiene fallas abiertas de severidad Alta o Crítica pasa
  a *En falla*, y vuelve a *Operativa* al resolverlas (salvo que esté en *Mantenimiento* o
  *Fuera de servicio*, que son estados manuales).
- **Tipos de máquina**: catálogo editable para agrupar equipos (Bottelpack, Shinva, Taponadora,
  Llenadora, Etiquetadora, Autoclave, Compresor, Envasadora… y los que se agreguen).

## Modelo de datos

```
tipos_maquina 1──* maquinas 1──* fallas 1──* soluciones
```

Esquema completo en [backend/src/schema.sql](backend/src/schema.sql). Los valores permitidos de
categoría, severidad y estados están validados con `CHECK` en la base y expuestos al frontend en
`GET /api/catalogos`.

## API

| Método | Ruta                          | Descripción                                        |
|--------|-------------------------------|----------------------------------------------------|
| GET    | `/api/stats?dias=30`          | KPIs y agregados del tablero                       |
| GET    | `/api/catalogos`              | Listas de categorías, severidades, estados, turnos |
| GET    | `/api/tipos`                  | Tipos de maquinaria (+ POST, PUT, DELETE)          |
| GET    | `/api/maquinas`               | Filtros: `q`, `tipo_id`, `estado` (+ CRUD)         |
| GET    | `/api/maquinas/:id`           | Ficha + historial de fallas                        |
| GET    | `/api/fallas`                 | Filtros: `q`, `maquina_id`, `tipo_id`, `categoria`, `severidad`, `estado`, `desde`, `hasta` |
| GET    | `/api/fallas/:id`             | Falla + sus soluciones                             |
| POST   | `/api/fallas/:id/soluciones`  | Registra una intervención                          |
| GET    | `/api/soluciones`             | Base de conocimiento: `q`, `tipo_id`, `categoria`, `solo_efectivas` |
| GET    | `/api/export/fallas.csv`      | Exportación completa a CSV                         |

## Respaldo

Toda la información vive en `backend/data/fallas.db`. Copiar ese archivo es el respaldo completo.

## Pendiente para más adelante

Usuarios y permisos (hoy fuera de alcance a pedido), adjuntar fotos a las fallas y planificación de
mantenimiento preventivo a partir de las acciones registradas.
