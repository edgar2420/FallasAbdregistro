# Control de Fallas Técnicas — Maquinaria Industrial

Sistema para registrar las fallas de la maquinaria de planta (Bottelpack, Shinva, ósmosis inversa,
taponadoras, llenadoras, autoclaves…), las soluciones aplicadas y la ficha técnica de cada equipo.

- **Administrador**: registra y edita máquinas, fallas, soluciones, fotos y cuentas.
- **Operador**: sólo consulta. Escribe el código de la máquina o de la falla y ve sus fallas y soluciones.

## Stack

| Capa      | Tecnología                                                          |
|-----------|---------------------------------------------------------------------|
| Backend   | Node.js 22.13+ con Express y SQLite (módulo nativo `node:sqlite`)    |
| Frontend  | Angular 20 (standalone)                                             |
| Datos     | `backend/data/fallas.db` y fotos/PDF en `backend/data/adjuntos/`     |

No hay dependencias nativas que compilar ni servidor de base de datos externo.

## Puesta en marcha

```bash
npm run instalar     # instala backend y frontend
npm run seed         # (opcional) carga tipos, máquinas y fallas de ejemplo
npm run dev          # API en http://localhost:4010 y web en http://localhost:4200
```

Uso en planta (un solo proceso sirve todo en `http://localhost:4010`): `iniciar.bat`, o bien

```bash
npm run build
npm start
```

Con Docker: `docker compose up --build` (o `iniciar-docker.bat`). La base y las fotos quedan en el
volumen `fallas_data`.

### Primer ingreso

Si la base no tiene cuentas, el servidor crea el usuario **`admin`** con la contraseña inicial
`Admin1234!` (o la definida en la variable `ADMIN_PASSWORD`). El seed crea además **`operador`** /
`Operador1234!` (`OPERADOR_PASSWORD`). **El sistema obliga a cambiar la contraseña en el primer
ingreso**, y lo mismo ocurre con las cuentas nuevas y las claves restablecidas por un administrador.

## Qué hace

- **Tablero**: buscador por código (máquina `BP-460`, falla `FAL-0003` o un síntoma), fallas abiertas
  y críticas, máquinas en falla, horas de paro de los últimos 30 días, MTTR y tablero de incidencias.
- **Maquinaria**: tabla de todas las máquinas con búsqueda por código o nombre y filtros por tipo,
  área y estado. Al abrir una máquina se ve:
  - **Ficha técnica**: código asignado por Garantía de Calidad, POE de referencia, marca, modelo,
    serie, año y los datos eléctricos y de servicios (tensión, corriente, potencia, presión y consumo
    de aire, presión y consumo de vapor).
  - **Fotos y documentos** por categoría: *Eléctrico*, *Electrónico*, *Mecánico*, *Ficha técnica* y
    *Otros* (JPG, PNG, WEBP o PDF; las fotos del celular se reducen antes de subirlas).
  - **Tabla de fallas y soluciones**: cada fila muestra la falla y la solución aplicada; al abrirla se
    ven síntomas, causa raíz, todas las intervenciones y las fotos de esa falla.
- **Fallas**: tabla de todas las fallas con búsqueda y filtros por máquina, tipo, categoría,
  severidad, estado y rango de fechas. Exportación a Excel (CSV).
- **Soluciones**: base de conocimiento — se busca un síntoma y se ve qué se hizo, con qué repuestos y
  cuánto tomó.
- **Usuarios** (administrador): alta de cuentas, roles, activación, restablecimiento de clave y
  bitácora de actividad (cambios, consultas de fichas, accesos y exportaciones).

Reglas automáticas: una solución marcada *efectiva* cierra la falla; si deja de serlo, la falla se
reabre. Una máquina con fallas abiertas Alta/Crítica pasa a *En falla* y vuelve a *Operativa* al
resolverlas (salvo *Mantenimiento* o *Fuera de servicio*, que son estados manuales).

## Seguridad

- Todas las rutas de datos (incluida la exportación CSV y los archivos) exigen sesión; las escrituras
  exigen rol administrador.
- Contraseñas con `scrypt`; tokens de sesión aleatorios guardados como SHA-256; sesiones de 7 días que
  se cierran al cambiar o restablecer la clave o al desactivar la cuenta.
- Bloqueo temporal tras 5 intentos fallidos de acceso (15 minutos).
- Un administrador no puede quitarse el rol ni desactivarse, y siempre queda al menos uno activo.
- Los archivos subidos se validan por su firma (no por la extensión) y se sirven sólo con sesión.
- La exportación CSV neutraliza fórmulas de Excel.

## Modelo de datos

```
tipos_maquina 1──* maquinas 1──* fallas 1──* soluciones
                     │            │
                     └──* adjuntos *──┘   (fotos/PDF de la máquina, opcionalmente de una falla)
usuarios 1──* sesiones · usuarios 1──* actividad_usuarios
```

Esquema en [backend/src/schema.sql](backend/src/schema.sql). Las bases de versiones anteriores se
migran solas al iniciar (se agregan las columnas nuevas). Los valores permitidos de categoría,
severidad y estados están en [backend/src/catalogos.js](backend/src/catalogos.js) y se exponen en
`GET /api/catalogos`.

## API principal

| Método | Ruta                          | Descripción                                            |
|--------|-------------------------------|--------------------------------------------------------|
| POST   | `/api/auth/login`             | Inicio de sesión                                       |
| POST   | `/api/auth/cambiar-password`  | Cambio de la propia contraseña                         |
| GET    | `/api/stats?dias=30`          | KPIs del tablero                                       |
| GET    | `/api/maquinas`               | Filtros: `q`, `tipo_id`, `estado`, `area` (+ CRUD)     |
| GET    | `/api/maquinas/:id`           | Ficha + fallas (con última solución) + adjuntos        |
| GET    | `/api/fallas`                 | Filtros: `q`, `maquina_id`, `tipo_id`, `categoria`, `severidad`, `estado` (`abiertas`), `desde`, `hasta` |
| GET    | `/api/fallas/:id`             | Falla + soluciones + fotos                             |
| POST   | `/api/fallas/:id/soluciones`  | Registra una intervención                              |
| GET    | `/api/soluciones`             | Base de conocimiento: `q`, `tipo_id`, `categoria`, `solo_efectivas` |
| POST   | `/api/adjuntos`               | Sube foto/PDF (base64, máx. 8 MB)                      |
| GET    | `/api/adjuntos/:id/archivo`   | Descarga el archivo                                    |
| GET    | `/api/export/fallas.csv`      | Exportación completa a CSV                             |

## Pruebas

```bash
npm run test:api   # pruebas de la API (base temporal, no toca backend/data)
npm test           # API + frontend (requiere Chrome)
```

## Respaldo

Copiar la carpeta `backend/data/` completa (base + adjuntos). En Docker, respaldar el volumen
`fallas_data`.
