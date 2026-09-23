import { Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../api';
import { VerClave } from './ver-clave';

interface Regla {
  ok: boolean;
  texto: string;
}

/** Cambio de la propia contraseña; obligatorio en el primer ingreso. */
@Component({
  selector: 'app-cambiar-password',
  imports: [FormsModule, VerClave],
  template: `
    <form (submit)="$event.preventDefault(); guardar()">
      @if (obligatorio()) {
        <p class="aviso">
          Por seguridad debes cambiar la contraseña inicial. En «Contraseña actual» escribe la que usaste
          para entrar recién.
        </p>
      }
      <label>
        Contraseña actual
        <input type="password" name="actual" autocomplete="current-password" required [(ngModel)]="actual">
      </label>
      <label>
        Nueva contraseña
        <input type="password" name="nueva" autocomplete="new-password" required [(ngModel)]="nueva">
      </label>
      <label>
        Repite la nueva contraseña
        <input type="password" name="repetida" autocomplete="new-password" required [(ngModel)]="repetida">
      </label>

      <ul class="reglas" aria-label="Requisitos de la nueva contraseña">
        @for (r of reglas; track r.texto) {
          <li [class.cumple]="r.ok">
            <span class="marca" aria-hidden="true">{{ r.ok ? '✓' : '•' }}</span>
            {{ r.texto }}<span class="sr-only">{{ r.ok ? ' (cumplido)' : ' (pendiente)' }}</span>
          </li>
        }
      </ul>

      @if (error) {
        <p class="form-error" role="alert">{{ error }}</p>
      }
      @if (ok) {
        <p class="aviso ok" role="status">Contraseña actualizada.</p>
      }
      <button class="primary" type="submit" [disabled]="guardando">
        {{ guardando ? 'Guardando…' : 'Cambiar contraseña' }}
      </button>
    </form>
  `,
})
export class CambiarPassword {
  private api = inject(Api);
  readonly obligatorio = input(false);
  readonly cambiada = output<void>();

  actual = '';
  nueva = '';
  repetida = '';
  error = '';
  ok = false;
  guardando = false;

  /** Se recalcula en cada tecla: cada requisito se pone en verde cuando se cumple. */
  get reglas(): Regla[] {
    const n = this.nueva;
    return [
      { ok: n.length >= 8, texto: `Al menos 8 caracteres (llevas ${n.length})` },
      { ok: /\p{L}/u.test(n), texto: 'Al menos una letra' },
      { ok: /\d/.test(n), texto: 'Al menos un número' },
      { ok: !!n && n === this.repetida, texto: 'Las dos contraseñas nuevas son iguales' },
      { ok: !!n && n !== this.actual, texto: 'Es distinta de la contraseña actual' },
    ];
  }

  async guardar() {
    this.ok = false;
    if (!this.actual) {
      this.error = 'Escribe tu contraseña actual (la que usaste para entrar)';
      return;
    }
    const pendiente = this.reglas.find((r) => !r.ok);
    if (pendiente) {
      this.error = `Falta cumplir: ${pendiente.texto.replace(/ \(llevas \d+\)$/, '').toLowerCase()}`;
      return;
    }
    this.error = '';
    this.guardando = true;
    try {
      await this.api.cambiarPassword(this.actual, this.nueva);
      this.actual = this.nueva = this.repetida = '';
      this.ok = true;
      this.cambiada.emit();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo cambiar la contraseña');
    } finally {
      this.guardando = false;
    }
  }
}
