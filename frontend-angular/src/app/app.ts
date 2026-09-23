import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Api } from './api';
import { CambiarPassword } from './componentes/cambiar-password';
import { VerClave } from './componentes/ver-clave';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, CambiarPassword, VerClave],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly api = inject(Api);
  private readonly router = inject(Router);

  protected readonly logged = computed(() => !!this.api.usuario());
  protected readonly iniciales = computed(
    () => (this.api.usuario()?.nombre ?? '').slice(0, 2).toUpperCase() || '—',
  );
  protected readonly login = signal({ usuario: '', password: '' });
  protected readonly oscuro = signal(document.documentElement.dataset['theme'] === 'dark');
  /** Menú lateral contraído a sólo íconos (escritorio). Se recuerda en el navegador. */
  protected readonly menuCerrado = signal(document.documentElement.dataset['menu'] === 'cerrado');
  /** Menú abierto como cajón (pantallas chicas). */
  protected readonly menuMovil = signal(false);
  /** Sección visible (tablero, fallas, maquinaria, usuarios, cuenta): define el color de la página. */
  protected readonly seccion = signal('tablero');
  protected error = '';
  protected busy = false;

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe((e) => this.seccion.set(e.urlAfterRedirects.split(/[/?#]/)[1] || 'tablero'));
  }

  async iniciar() {
    const { usuario, password } = this.login();
    if (!usuario.trim() || !password) {
      this.error = 'Escribe tu usuario y tu contraseña';
      return;
    }
    this.error = '';
    this.busy = true;
    try {
      await this.api.login(usuario.trim(), password);
      this.login.set({ usuario: '', password: '' });
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo iniciar sesión');
    } finally {
      this.busy = false;
    }
  }

  async salir() {
    await this.api.logout();
    await this.router.navigateByUrl('/');
  }

  /** Alterna claro/oscuro y recuerda la elección en este navegador. */
  alternarTema() {
    const oscuro = !this.oscuro();
    this.oscuro.set(oscuro);
    if (oscuro) document.documentElement.dataset['theme'] = 'dark';
    else delete document.documentElement.dataset['theme'];
    try {
      localStorage.setItem('cf_tema', oscuro ? 'dark' : 'light');
    } catch {
      /* sin almacenamiento el tema dura lo que la pestaña */
    }
  }

  alternarMenu() {
    const cerrado = !this.menuCerrado();
    this.menuCerrado.set(cerrado);
    if (cerrado) document.documentElement.dataset['menu'] = 'cerrado';
    else delete document.documentElement.dataset['menu'];
    try {
      localStorage.setItem('cf_menu', cerrado ? 'cerrado' : 'abierto');
    } catch {
      /* sin almacenamiento el estado dura lo que la pestaña */
    }
  }

  /** Ctrl+B (o ⌘+B) contrae o expande el menú, como en otros editores. */
  @HostListener('document:keydown.control.b', ['$event'])
  @HostListener('document:keydown.meta.b', ['$event'])
  atajoMenu(evento: Event) {
    if (!this.logged()) return;
    evento.preventDefault();
    this.alternarMenu();
  }

  @HostListener('document:keydown.escape')
  cerrarMenuMovil() {
    this.menuMovil.set(false);
  }

  cambiar(campo: 'usuario' | 'password', valor: string) {
    this.login.update((v) => ({ ...v, [campo]: valor }));
  }
}
