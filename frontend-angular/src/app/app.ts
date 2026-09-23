import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Api } from './api';
import { CambiarPassword } from './componentes/cambiar-password';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, CambiarPassword],
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
  protected error = '';
  protected busy = false;

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

  cambiar(campo: 'usuario' | 'password', valor: string) {
    this.login.update((v) => ({ ...v, [campo]: valor }));
  }
}
