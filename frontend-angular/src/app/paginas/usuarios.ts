import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../api';
import { Actividad, Usuario } from '../modelos';
import { fechaCorta } from '../util';

const ACCIONES: Record<string, string> = {
  inicio_sesion: 'Inicio de sesión',
  cierre_sesion: 'Cierre de sesión',
  acceso_fallido: 'Acceso fallido',
  cambio_password: 'Cambió su contraseña',
  consulta: 'Consulta',
  exportar_csv: 'Exportó CSV',
  crear_usuario: 'Creó usuario',
  actualizar_usuario: 'Actualizó usuario',
  restablecer_password: 'Restableció contraseña',
};

@Component({
  selector: 'app-usuarios-page',
  imports: [FormsModule],
  template: `
    <div class="module-title">
      <div>
        <span class="eyebrow">Administración / Accesos</span>
        <h1>Usuarios y actividad</h1>
        <p>Los administradores registran y editan. Los operadores sólo consultan máquinas, fallas y soluciones.</p>
      </div>
      <button class="primary" type="button" (click)="creando = !creando">
        <svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg>Crear usuario
      </button>
    </div>

    @if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    }
    @if (aviso) {
      <p class="aviso ok" role="status">{{ aviso }}</p>
    }

    @if (creando) {
      <form class="module-card" (submit)="$event.preventDefault(); crear()">
        <h2>Nuevo usuario</h2>
        <div class="crud-grid">
          <label>Nombre completo<input name="nombre" [(ngModel)]="draft.nombre"></label>
          <label>Usuario (para ingresar)<input name="usuario" autocomplete="off" autocapitalize="none" [(ngModel)]="draft.email"></label>
          <label>
            Contraseña inicial
            <input type="password" name="password" autocomplete="new-password" [(ngModel)]="draft.password">
          </label>
          <label>
            Rol
            <select name="rol" [(ngModel)]="draft.rol">
              <option value="operador">Operador (sólo consulta)</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
        </div>
        <small class="subline">Mínimo 8 caracteres con letras y números. El usuario deberá cambiarla en su primer ingreso.</small>
        <div class="form-actions">
          <button class="ghost" type="button" (click)="creando = false">Cancelar</button>
          <button class="primary" type="submit" [disabled]="guardando">
            {{ guardando ? 'Creando…' : 'Crear cuenta' }}
          </button>
        </div>
      </form>
    }

    <section class="module-card">
      <h2>Usuarios</h2>
      @for (u of users; track u.id) {
        <div class="user-row" [class.inactivo]="!u.activo">
          <span class="avatar" aria-hidden="true">{{ u.nombre.slice(0, 2).toUpperCase() }}</span>
          <div>
            <strong>
              {{ u.nombre }}
              @if (!u.activo) { <span class="tag">Inactivo</span> }
              @if (u.debe_cambiar) { <span class="tag orange">Debe cambiar clave</span> }
            </strong>
            <small>{{ u.email }} · Último acceso: {{ fecha(u.ultimo_acceso) }}</small>
          </div>
          @if (claveDe === u.id) {
            <input type="password" autocomplete="new-password" placeholder="Nueva contraseña"
                   [attr.aria-label]="'Nueva contraseña para ' + u.nombre" [(ngModel)]="nuevaClave">
            <button type="button" (click)="restablecer(u)">Guardar</button>
            <button type="button" (click)="claveDe = null">Cancelar</button>
          } @else {
            <select [attr.aria-label]="'Rol de ' + u.nombre" [ngModel]="u.rol" [disabled]="esYo(u)"
                    (ngModelChange)="rol(u, $event)">
              <option value="operador">Operador</option>
              <option value="admin">Administrador</option>
            </select>
            <button type="button" [disabled]="esYo(u)" (click)="alternar(u)">{{ u.activo ? 'Desactivar' : 'Activar' }}</button>
            <button type="button" (click)="claveDe = u.id; nuevaClave = ''">Restablecer contraseña</button>
          }
        </div>
      } @empty {
        <p class="muted">{{ cargando ? 'Cargando usuarios…' : 'No hay usuarios registrados' }}</p>
      }
    </section>

    <section class="module-card tabla-card">
      <div class="tabla-titulo">
        <h2>Actividad reciente</h2>
        <select aria-label="Filtrar actividad por usuario" [(ngModel)]="filtroUsuario" (ngModelChange)="cargarActividad()">
          <option [ngValue]="null">Todos los usuarios</option>
          @for (u of users; track u.id) {
            <option [ngValue]="u.id">{{ u.nombre }}</option>
          }
        </select>
      </div>
      <div class="tabla-scroll">
        <table class="data-table">
          <thead>
            <tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Ruta</th><th>Detalle</th></tr>
          </thead>
          <tbody>
            @for (a of activity; track a.id) {
              <tr>
                <td class="fecha">{{ fecha(a.creado_en) }}</td>
                <td>{{ a.nombre || 'Cuenta eliminada' }}</td>
                <td>{{ accion(a.accion) }}</td>
                <td class="ruta">{{ a.ruta }}</td>
                <td>{{ a.detalle || '' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="muted">Sin actividad registrada</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class UsuariosPage implements OnInit {
  private api = inject(Api);
  users: Usuario[] = [];
  activity: Actividad[] = [];
  error = '';
  aviso = '';
  cargando = true;
  guardando = false;
  creando = false;
  claveDe: number | null = null;
  nuevaClave = '';
  filtroUsuario: number | null = null;
  draft = this.nuevoUsuario();

  readonly fecha = fechaCorta;

  accion(a: string) {
    return ACCIONES[a] ?? a.replace(/_/g, ' ');
  }

  esYo(u: Usuario) {
    return u.id === this.api.usuario()?.id;
  }

  async ngOnInit() {
    await this.cargar();
  }

  async cargar() {
    this.cargando = true;
    try {
      this.users = await this.api.get<Usuario[]>('/auth/usuarios');
      await this.cargarActividad();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudieron cargar los usuarios');
    } finally {
      this.cargando = false;
    }
  }

  async cargarActividad() {
    const filtro = this.filtroUsuario ? `?usuario_id=${this.filtroUsuario}` : '';
    this.activity = await this.api.get<Actividad[]>(`/auth/actividad${filtro}`);
  }

  private async ejecutar(accion: () => Promise<unknown>, exito: string, fallo: string) {
    this.error = '';
    this.aviso = '';
    try {
      await accion();
      this.aviso = exito;
      await this.cargar();
      return true;
    } catch (e: unknown) {
      this.error = Api.mensaje(e, fallo);
      await this.cargar();
      return false;
    }
  }

  async crear() {
    if (!this.draft.nombre.trim() || !this.draft.email.trim() || !this.draft.password) {
      this.error = 'Completa nombre, usuario y contraseña inicial';
      return;
    }
    this.guardando = true;
    const ok = await this.ejecutar(
      () => this.api.post('/auth/usuarios', this.draft),
      `Cuenta ${this.draft.email} creada`,
      'No se pudo crear la cuenta',
    );
    this.guardando = false;
    if (ok) {
      this.creando = false;
      this.draft = this.nuevoUsuario();
    }
  }

  rol(u: Usuario, rol: string) {
    return this.ejecutar(() => this.api.patch(`/auth/usuarios/${u.id}`, { rol }),
      `Rol de ${u.nombre} actualizado`, 'No se pudo cambiar el rol');
  }

  alternar(u: Usuario) {
    return this.ejecutar(() => this.api.patch(`/auth/usuarios/${u.id}`, { activo: !u.activo }),
      `${u.nombre} ${u.activo ? 'desactivado' : 'activado'}`, 'No se pudo cambiar el estado de la cuenta');
  }

  async restablecer(u: Usuario) {
    const ok = await this.ejecutar(() => this.api.patch(`/auth/usuarios/${u.id}`, { password: this.nuevaClave }),
      `Contraseña de ${u.nombre} restablecida: deberá cambiarla al ingresar`, 'No se pudo restablecer la contraseña');
    if (ok) {
      this.claveDe = null;
      this.nuevaClave = '';
    }
  }

  private nuevoUsuario() {
    return { nombre: '', email: '', password: '', rol: 'operador' };
  }
}
