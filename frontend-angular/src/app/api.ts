import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: 'admin' | 'operador';
  activo: number;
}

interface Sesion {
  token: string;
  usuario: Usuario;
}

const CLAVE = 'cf_session';

@Injectable({ providedIn: 'root' })
export class Api {
  readonly usuario = signal<Usuario | null>(null);

  /** Relativa: el dev-server la redirige por proxy y en producción Express sirve el mismo origen. */
  private readonly base = '/api';
  private token: string | null = null;

  constructor(private http: HttpClient) {
    const sesion = this.leerSesion();
    if (sesion) {
      this.token = sesion.token;
      this.usuario.set(sesion.usuario);
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

  async login(usuario: string, password: string) {
    const sesion = await firstValueFrom(
      this.http.post<Sesion>(`${this.base}/auth/login`, { email: usuario, password }),
    );
    localStorage.setItem(CLAVE, JSON.stringify(sesion));
    this.token = sesion.token;
    this.usuario.set(sesion.usuario);
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

  /** Una sesión vencida devuelve al login en lugar de dejar la pantalla en blanco. */
  private async peticion<T>(origen: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(origen);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.limpiarSesion();
      }
      throw error;
    }
  }

  private leerSesion(): Sesion | null {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    try {
      const sesion = JSON.parse(crudo) as Sesion;
      return sesion?.token && sesion?.usuario ? sesion : null;
    } catch {
      localStorage.removeItem(CLAVE);
      return null;
    }
  }

  private limpiarSesion() {
    localStorage.removeItem(CLAVE);
    this.token = null;
    this.usuario.set(null);
  }
}
