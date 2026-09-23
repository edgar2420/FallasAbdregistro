import { Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../api';

/** Cambio de la propia contraseña; obligatorio en el primer ingreso. */
@Component({
  selector: 'app-cambiar-password',
  imports: [FormsModule],
  template: `
    <form (submit)="$event.preventDefault(); guardar()">
      @if (obligatorio()) {
        <p class="aviso">Por seguridad debes cambiar la contraseña inicial antes de continuar.</p>
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
      <small>Mínimo 8 caracteres, con letras y números.</small>
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

  async guardar() {
    this.ok = false;
    if (this.nueva.length < 8 || !/\d/.test(this.nueva) || !/\p{L}/u.test(this.nueva)) {
      this.error = 'La nueva contraseña debe tener al menos 8 caracteres, con letras y números';
      return;
    }
    if (this.nueva !== this.repetida) {
      this.error = 'Las contraseñas nuevas no coinciden';
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
