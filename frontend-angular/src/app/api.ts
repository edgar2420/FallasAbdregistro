import { Injectable, computed, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { Catalogos, Usuario } from './modelos';

interface Sesion {
  token: string;
  usuario: Usuario;
}

const CLAVE = 'cf_session';

@Injectable({ providedIn: 'root' })
export class Api {
  readonly usuario = signal<Usuario | null>(null);
  readonly esAdmin = computed(() => this.usuario()?.rol === 'admin');
  readonly debeCambiar = computed(() => !!this.usuario()?.debe_cambiar);

  /** Relativa: el dev-server la redirige por proxy y en producción Express sirve el mismo origen. */
  private readonly base = '/api';
  private token: string | null = null;
  private catalogosCache?: Promise<Catalogos>;

  constructor(private http: HttpClient) {
    const sesion = this.leerSesion();
    if (sesion) {
      this.token = sesion.token;
      this.usuario.set(sesion.usuario);
      // Revalida la sesión guardada: rol, estado y cambio de clave pueden haber cambiado.
      this.get<{ usuario: Usuario }>('/auth/me')
        .then(({ usuario }) => this.guardarUsuario(usuario))
        .catch(() => undefined);
    }
  }

  /** Extrae el mensaje que devuelve la API, con un respaldo legible. */
  static mensaje(error: unknown, respaldo = 'Ocurrió un error inesperado'): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'No hay conexión con el servidor';
      return error.error?.error || error.error?.message || respaldo;
    }
    return error instanceof Error ? error.message : respaldo;
  }

  get<T>(path: string) {
    return this.peticion(this.http.get<T>(this.base + path, this.opciones()));
  }

  post<T>(path: string, body: unknown) {
    return this.peticion(this.http.post<T>(this.base + path, body, this.opciones()));
  }

  put<T>(path: string, body: unknown) {
    return this.peticion(this.http.put<T>(this.base + path, body, this.opciones()));
  }

  patch<T>(path: string, body: unknown) {
    return this.peticion(this.http.patch<T>(this.base + path, body, this.opciones()));
  }

  delete<T>(path: string) {
    return this.peticion(this.http.delete<T>(this.base + path, this.opciones()));
  }

  /** Archivos protegidos (fotos, PDF, CSV): se piden con el token y se muestran como blob. */
  blob(path: string) {
    return this.peticion(this.http.get(this.base + path, { ...this.opciones(), responseType: 'blob' }));
  }

  async descargar(path: string, nombre: string) {
    const url = URL.createObjectURL(await this.blob(path));
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  catalogos() {
    this.catalogosCache ??= firstValueFrom(this.http.get<Catalogos>(`${this.base}/catalogos`));
    return this.catalogosCache;
  }

  async login(usuario: string, password: string) {
    const sesion = await firstValueFrom(
      this.http.post<Sesion>(`${this.base}/auth/login`, { email: usuario, password }),
    );
    this.token = sesion.token;
    this.guardarUsuario(sesion.usuario);
  }

  async cambiarPassword(actual: string, nueva: string) {
    const { usuario } = await this.post<{ usuario: Usuario }>('/auth/cambiar-password', { actual, nueva });
    this.guardarUsuario(usuario);
  }

  async logout() {
    try {
      if (this.token) await this.post('/auth/logout', {});
    } catch {
      /* la sesión se cierra localmente aunque la API no responda */
    } finally {
      this.limpiarSesion();
    }
  }

  private opciones() {
    return {
      headers: this.token
        ? new HttpHeaders({ Authorization: `Bearer ${this.token}` })
        : new HttpHeaders(),
    };
  }

  /** Una sesión vencida devuelve al login; una clave pendiente de cambio lleva a cambiarla. */
  private async peticion<T>(origen: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(origen);
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) this.limpiarSesion();
        if (error.status === 403 && error.error?.codigo === 'DEBE_CAMBIAR_PASSWORD') {
          const u = this.usuario();
          if (u) this.usuario.set({ ...u, debe_cambiar: 1 });
        }
      }
      throw error;
    }
  }

  private guardarUsuario(usuario: Usuario) {
    this.usuario.set(usuario);
    if (this.token) {
      try {
        localStorage.setItem(CLAVE, JSON.stringify({ token: this.token, usuario }));
      } catch {
        /* sin almacenamiento la sesión dura lo que la pestaña */
      }
    }
  }

  private leerSesion(): Sesion | null {
    try {
      const crudo = localStorage.getItem(CLAVE);
      if (!crudo) return null;
      const sesion = JSON.parse(crudo) as Sesion;
      return sesion?.token && sesion?.usuario ? sesion : null;
    } catch {
      return null;
    }
  }

  private limpiarSesion() {
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      /* nada que limpiar */
    }
    this.token = null;
    this.usuario.set(null);
  }
}
