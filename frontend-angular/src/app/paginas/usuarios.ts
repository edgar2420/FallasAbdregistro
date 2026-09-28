import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../api';
import { Usuario } from '../modelos';
import { LIMITES } from '../limites';
import { fechaCorta } from '../util';
import { VerClave } from '../componentes/ver-clave';
import { Modal } from '../componentes/modal';

@Component({
  selector: 'app-usuarios-page',
  imports: [FormsModule, VerClave, Modal],
  template: `
    <div class="module-title">
      <div>
        <span class="eyebrow">Administración / Accesos</span>
        <h1>Usuarios</h1>
        <p>Los administradores registran y editan. Los operadores sólo consultan máquinas, fallas y soluciones.</p>
      </div>
      <button class="primary" type="button" (click)="creando = true">
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
      <app-modal titulo="Nuevo usuario" subtitulo="Cuenta de acceso" tamano="mediano" (cerrar)="creando = false">
      <form class="modal-form" (submit)="$event.preventDefault(); crear()">
        @if (errorModal) {
          <p class="form-error" role="alert">{{ errorModal }}</p>
        }
        <div class="crud-grid">
          <label>Nombre completo<input name="nombre" [maxlength]="L.nombre" [(ngModel)]="draft.nombre"></label>
          <label>Usuario (para ingresar)<input name="usuario" [maxlength]="L.usuario" autocomplete="off" autocapitalize="none" [(ngModel)]="draft.email"></label>
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
      </app-modal>
    }

    @if (claveDe; as u) {
      <app-modal titulo="Restablecer contraseña" [subtitulo]="u.nombre + ' · ' + u.email" tamano="mediano"
                 (cerrar)="claveDe = null">
        <form class="modal-form" (submit)="$event.preventDefault(); restablecer(u)">
          @if (errorModal) {
            <p class="form-error" role="alert">{{ errorModal }}</p>
          }
          <div class="crud-grid">
            <label class="wide">
              Nueva contraseña temporal
              <input type="password" name="nueva" autocomplete="new-password" [(ngModel)]="nuevaClave">
            </label>
          </div>
          <small class="subline">Mínimo 8 caracteres con letras y números. Se cerrarán sus sesiones abiertas y deberá cambiarla al ingresar.</small>
          <div class="form-actions">
            <button class="ghost" type="button" (click)="claveDe = null">Cancelar</button>
            <button class="primary" type="submit">Restablecer</button>
          </div>
        </form>
      </app-modal>
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
          <select [attr.aria-label]="'Rol de ' + u.nombre" [ngModel]="u.rol" [disabled]="esYo(u)"
                    (ngModelChange)="rol(u, $event)">
              <option value="operador">Operador</option>
              <option value="admin">Administrador</option>
            </select>
            <button type="button" [disabled]="esYo(u)" (click)="alternar(u)">{{ u.activo ? 'Desactivar' : 'Activar' }}</button>
          <button type="button" (click)="claveDe = u; nuevaClave = ''; errorModal = ''">Restablecer contraseña</button>
        </div>
      } @empty {
        <p class="muted">{{ cargando ? 'Cargando usuarios…' : 'No hay usuarios registrados' }}</p>
      }
    </section>

  `,
})
export class UsuariosPage implements OnInit {
  private api = inject(Api);
  users: Usuario[] = [];
  error = '';
  aviso = '';
  cargando = true;
  guardando = false;
  creando = false;
  claveDe: Usuario | null = null;
  errorModal = '';
  nuevaClave = '';
  readonly L = LIMITES.usuario;
  draft = this.nuevoUsuario();

  readonly fecha = fechaCorta;

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
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudieron cargar los usuarios');
    } finally {
      this.cargando = false;
    }
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

  private async ejecutarEnModal(accion: () => Promise<unknown>, exito: string, fallo: string) {
    this.errorModal = '';
    this.aviso = '';
    try {
      await accion();
      this.aviso = exito;
      await this.cargar();
      return true;
    } catch (e: unknown) {
      this.errorModal = Api.mensaje(e, fallo);
      return false;
    }
  }

  async crear() {
    if (!this.draft.nombre.trim() || !this.draft.email.trim() || !this.draft.password) {
      this.errorModal = 'Completa nombre, usuario y contraseña inicial';
      return;
    }
    this.guardando = true;
    const ok = await this.ejecutarEnModal(
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
    const ok = await this.ejecutarEnModal(() => this.api.patch(`/auth/usuarios/${u.id}`, { password: this.nuevaClave }),
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
