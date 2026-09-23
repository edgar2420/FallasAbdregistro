# Puesta en producción

Guía para dejar **Control de Fallas** funcionando de forma estable y segura. Hay dos caminos:

| Opción | Cuándo conviene | Acceso |
|--------|-----------------|--------|
| **A. VPS en Internet** (recomendada si se necesita entrar desde fuera de la planta o desde el celular con datos) | Varios turnos, supervisores fuera de planta | `https://fallas.tuempresa.com` con HTTPS automático |
| **B. Servidor dentro de la planta** | Sólo se usa desde la red interna | `http://IP-del-servidor` |

Las dos usan lo mismo: **Docker Compose** con la aplicación y **Caddy** delante (proxy con HTTPS automático).

---

## A. VPS en Internet

### 1. Contratar el servidor y el dominio

- **VPS**: Ubuntu 24.04 LTS, 1–2 vCPU, **2 GB de RAM**, 25 GB de disco. Sirven Hetzner, DigitalOcean, Vultr o Contabo
  (aprox. 5–12 USD/mes). Con eso alcanza de sobra para una planta.
- **Dominio** (o subdominio de la empresa): crea un registro DNS **tipo A** `fallas.tuempresa.com` → IP del VPS.

### 2. Asegurar el servidor (una sola vez)

Conéctate por SSH como root y ejecuta:

```bash
# Usuario propio y actualizaciones automáticas de seguridad
adduser planta && usermod -aG sudo planta
apt update && apt -y upgrade && apt -y install ufw fail2ban unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# Cortafuegos: sólo SSH, HTTP y HTTPS
ufw allow OpenSSH && ufw allow 80,443/tcp && ufw allow 443/udp && ufw enable
```

Copia tu llave SSH al usuario nuevo (`ssh-copy-id planta@IP`) y luego, en `/etc/ssh/sshd_config`, deja
`PasswordAuthentication no` y `PermitRootLogin no`; reinicia con `systemctl restart ssh`.
`fail2ban` bloquea automáticamente a quien intente adivinar contraseñas por SSH.

### 3. Instalar Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker planta   # cerrar sesión y volver a entrar
```

### 4. Subir la aplicación

```bash
git clone https://github.com/edgar2420/FallasAbdregistro.git
cd FallasAbdregistro
cp .env.example .env
nano .env          # DOMINIO=fallas.tuempresa.com  y  ADMIN_PASSWORD=una clave fuerte
docker compose up -d --build
```

En 1–2 minutos Caddy obtiene el certificado y la aplicación queda en `https://fallas.tuempresa.com`.
Entra con `admin` y la clave de `ADMIN_PASSWORD`: el sistema te pedirá cambiarla. Después crea las cuentas
de los operadores desde **Usuarios**.

### 5. Comprobar que está sano

```bash
docker compose ps              # ambos servicios "healthy" / "running"
docker compose logs -f app     # registros de la aplicación
curl https://fallas.tuempresa.com/api/salud
```

Recomendado: da de alta `https://fallas.tuempresa.com/api/salud` en un monitor gratuito
(UptimeRobot, Better Stack) para recibir un correo si el sistema deja de responder.

---

## B. Servidor dentro de la planta

Una PC o servidor con Ubuntu (o Windows con Docker Desktop) conectado a la red interna:

1. Instala Docker (paso 3).
2. Clona el repositorio, copia `.env.example` a `.env` y pon **`DOMINIO=:80`**.
3. `docker compose up -d --build` (en Windows: `iniciar-docker.bat`).
4. Desde cualquier equipo de la red: `http://IP-del-servidor`.

Asigna una IP fija a ese equipo en el router. Sin dominio no hay HTTPS: úsalo sólo dentro de la red de la planta.

---

## Qué protege al sistema

**Frente a caídas**
- `restart: unless-stopped`: si el proceso o el servidor se reinician, la app vuelve a levantarse sola.
- *Healthcheck* cada 30 s sobre `/api/salud` (también verifica la base de datos).
- Base SQLite en modo **WAL** con espera ante bloqueos; apagado ordenado que no corrompe datos.
- Límites de tiempo por conexión, de tamaño de petición y de memoria (512 MB), y registros rotados
  (máx. 30 MB), para que nada llene el disco ni la memoria.

**Frente a ataques**
- HTTPS obligatorio con HSTS; política de contenido (CSP) que sólo permite código de la propia app.
- Contraseñas con `scrypt`, cambio obligatorio de la clave inicial, bloqueo tras 5 intentos fallidos
  y límite general de peticiones por IP.
- Operadores sólo lectura; toda escritura exige rol administrador.
- Fotos y PDF validados por su contenido real y servidos sólo con sesión.
- Contenedor sin privilegios, con sistema de archivos de sólo lectura; la app no se expone directo a Internet.

---

## Respaldos

- **Automáticos**: cada 24 h se guarda una copia de la base y de las fotos en el volumen
  (`/data/respaldos/AAAA-MM-DD-HH-MM`), conservando las últimas 14.
- **Manual en cualquier momento**:
  ```bash
  docker compose exec app node src/respaldo.js
  ```
- **Copia fuera del servidor** (importante: si el VPS se pierde, se pierden sus respaldos). Programa en tu
  PC o en otro servidor una descarga diaria, por ejemplo:
  ```bash
  docker compose cp app:/data/respaldos ./respaldos-$(date +%F)
  ```
  o usa `rclone` hacia Google Drive/OneDrive. También puedes activar los *snapshots* del proveedor del VPS.

**Restaurar un respaldo**

```bash
docker compose stop app
# por si quedaron archivos temporales de la base anterior
docker compose run --rm --no-deps --entrypoint sh app -c "rm -f /data/fallas.db-wal /data/fallas.db-shm"
docker compose cp ./respaldos/2026-09-22-03-00/fallas.db app:/data/fallas.db
docker compose cp ./respaldos/2026-09-22-03-00/adjuntos app:/data/
docker compose start app
```

---

## Actualizar a una versión nueva

```bash
cd FallasAbdregistro
docker compose exec app node src/respaldo.js   # respaldo antes de actualizar
git pull
docker compose up -d --build
```

Las bases de versiones anteriores se migran solas al iniciar (se agregan las columnas nuevas sin perder datos).
