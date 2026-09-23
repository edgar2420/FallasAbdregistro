import { Component, OnInit, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../api';
import { Solucion } from '../modelos';
import { aInputFecha } from '../util';
import { LIMITES } from '../limites';
import { Contador } from './contador';

/** Alta o edición de una intervención (sólo administradores). Se muestra dentro de <app-modal>. */
@Component({
  selector: 'app-solucion-form',
  imports: [FormsModule, Contador],
  template: `
    <form class="modal-form" (submit)="$event.preventDefault(); guardar()">
      @if (error) {
        <p class="form-error" role="alert">{{ error }}</p>
      }
      <div class="crud-grid">
        <label class="wide">Intervención realizada (pasos) *
          <textarea name="descripcion" [maxlength]="L.descripcion" required [(ngModel)]="d.descripcion"></textarea>
        </label>
        <label>Repuestos<input name="repuestos" [maxlength]="L.repuestos" [(ngModel)]="d.repuestos"></label>
        <label>Herramientas<input name="herramientas" [maxlength]="L.herramientas" [(ngModel)]="d.herramientas"></label>
        <label>Técnico<input name="tecnico" [maxlength]="L.tecnico" [(ngModel)]="d.tecnico"></label>
        <label>Fecha<input name="fecha" type="datetime-local" [(ngModel)]="d.fecha"></label>
        <label>Costo<input name="costo" type="number" min="0" step="0.01" [(ngModel)]="d.costo"></label>
        <label class="check-label">
          <input name="efectiva" type="checkbox" [(ngModel)]="d.efectiva">
          Solución efectiva (cierra la falla)
        </label>
      </div>
      <div class="form-actions">
        <button class="ghost" type="button" (click)="cancelar.emit()">Cancelar</button>
        <button class="primary" type="submit" [disabled]="guardando">
          {{ guardando ? 'Guardando…' : 'Guardar solución' }}
        </button>
      </div>
    </form>
  `,
})
export class SolucionForm implements OnInit {
  private api = inject(Api);
  readonly fallaId = input.required<number>();
  readonly solucion = input<Solucion | null>(null);
  readonly guardado = output<void>();
  readonly cancelar = output<void>();

  readonly L = LIMITES.solucion;
  d = {
    descripcion: '',
    repuestos: '',
    herramientas: '',
    tecnico: '',
    fecha: '',
    costo: 0 as number | null,
    efectiva: true,
  };
  error = '';
  guardando = false;

  ngOnInit() {
    const s = this.solucion();
    this.d = s
      ? {
          descripcion: s.descripcion,
          repuestos: s.repuestos ?? '',
          herramientas: s.herramientas ?? '',
          tecnico: s.tecnico ?? '',
          fecha: aInputFecha(s.fecha),
          costo: s.costo,
          efectiva: !!s.efectiva,
        }
      : { ...this.d, tecnico: this.api.usuario()?.nombre ?? '' };
  }

  async guardar() {
    if (!this.d.descripcion.trim()) {
      this.error = 'Describe la intervención antes de guardarla';
      return;
    }
    this.error = '';
    this.guardando = true;
    try {
      const s = this.solucion();
      if (s) await this.api.put(`/soluciones/${s.id}`, this.d);
      else await this.api.post(`/fallas/${this.fallaId()}/soluciones`, this.d);
      this.guardado.emit();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo guardar la solución');
    } finally {
      this.guardando = false;
    }
  }
}
