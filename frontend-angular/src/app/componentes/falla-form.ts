import { Component, OnInit, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../api';
import { Catalogos, Falla, Maquina } from '../modelos';
import { aInputFecha } from '../util';
import { LIMITES } from '../limites';
import { Contador } from './contador';

/**
 * Alta o edición de una falla (sólo administradores). Se muestra dentro de <app-modal>.
 * Al registrar una falla nueva se puede cargar en el mismo formulario la solución aplicada.
 */
@Component({
  selector: 'app-falla-form',
  imports: [FormsModule, Contador],
  template: `
    <form class="modal-form" (submit)="$event.preventDefault(); guardar()">
      @if (error) {
        <p class="form-error" role="alert">{{ error }}</p>
      }

      <h4>Falla</h4>
      <div class="crud-grid tres">
        <label class="dos">Máquina *
          <select name="maquina" required [(ngModel)]="d.maquina_id">
            <option [ngValue]="null">Selecciona una máquina</option>
            @for (m of maquinas; track m.id) {
              <option [ngValue]="m.id">{{ m.codigo }} · {{ m.nombre }}</option>
            }
          </select>
        </label>
        <label>Fecha<input name="fecha" type="datetime-local" [(ngModel)]="d.fecha_deteccion"></label>
        <label class="dos">Falla / error *
          <input name="titulo" [maxlength]="L.falla.titulo" required placeholder="Ej.: Baja presión en bomba de alta" [(ngModel)]="d.titulo">
        </label>
        <label>Categoría
          <select name="categoria" [(ngModel)]="d.categoria">
            @for (c of cat?.categorias ?? []; track c) {
              <option>{{ c }}</option>
            }
          </select>
        </label>
        <label class="wide">Descripción<textarea name="descripcion" [maxlength]="L.falla.descripcion" [(ngModel)]="d.descripcion"></textarea></label>
        <label class="wide">Causa<textarea name="causa" [maxlength]="L.falla.causa_raiz" [(ngModel)]="d.causa_raiz"></textarea></label>
      </div>

      @if (!falla()) {
        <h4>Solución aplicada</h4>
        <p class="ayuda">Si ya se solucionó, regístralo aquí. Si todavía no, déjalo vacío y agrégalo después desde la falla.</p>
        <div class="crud-grid tres">
          <label class="wide">Qué se hizo (pasos)
            <textarea name="sol_descripcion" [maxlength]="L.solucion.descripcion" placeholder="1) Parada y bloqueo. 2) Cambio de … 3) Prueba …"
                      [(ngModel)]="s.descripcion"></textarea>
          </label>
          <label>Repuestos<input name="sol_repuestos" [maxlength]="L.solucion.repuestos" [(ngModel)]="s.repuestos"></label>
          <label>Técnico<input name="sol_tecnico" [maxlength]="L.solucion.tecnico" [(ngModel)]="s.tecnico"></label>
          <label>Tiempo (min)<input name="sol_tiempo" type="number" min="0" [(ngModel)]="s.tiempo_minutos"></label>
          <label class="wide">Acción preventiva recomendada
            <textarea name="sol_preventivo" [maxlength]="L.solucion.preventivo" [(ngModel)]="s.preventivo"></textarea>
          </label>
        </div>
      }

      <div class="form-actions">
        <button class="ghost" type="button" (click)="cancelar.emit()">Cancelar</button>
        <button class="primary" type="submit" [disabled]="guardando">
          {{ guardando ? 'Guardando…' : (falla() ? 'Guardar cambios' : 'Registrar falla') }}
        </button>
      </div>
    </form>
  `,
})
export class FallaForm implements OnInit {
  private api = inject(Api);
  readonly falla = input<Falla | null>(null);
  readonly maquinaId = input<number | null>(null);
  readonly guardado = output<Falla>();
  readonly cancelar = output<void>();

  readonly L = LIMITES;
  cat?: Catalogos;
  maquinas: Maquina[] = [];
  error = '';
  guardando = false;
  d = {
    maquina_id: null as number | null,
    titulo: '',
    categoria: 'Mecánica',
    fecha_deteccion: '',
    descripcion: '',
    causa_raiz: '',
  };
  s = {
    descripcion: '',
    repuestos: '',
    tecnico: '',
    tiempo_minutos: null as number | null,
    preventivo: '',
  };

  async ngOnInit() {
    const f = this.falla();
    if (f) {
      this.d = {
        maquina_id: f.maquina_id,
        titulo: f.titulo,
        categoria: f.categoria,
        fecha_deteccion: aInputFecha(f.fecha_deteccion),
        descripcion: f.descripcion ?? '',
        causa_raiz: f.causa_raiz ?? '',
      };
    } else {
      this.d.maquina_id = this.maquinaId();
      this.s.tecnico = this.api.usuario()?.nombre ?? '';
    }
    try {
      [this.cat, this.maquinas] = await Promise.all([
        this.api.catalogos(),
        this.api.get<Maquina[]>('/maquinas'),
      ]);
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudieron cargar las listas');
    }
  }

  async guardar() {
    if (!this.d.maquina_id || !this.d.titulo.trim()) {
      this.error = 'Selecciona la máquina y escribe la falla';
      return;
    }
    this.error = '';
    this.guardando = true;
    try {
      const f = this.falla();
      const r = f
        ? await this.api.put<Falla>(`/fallas/${f.id}`, this.d)
        : await this.api.post<Falla>('/fallas', {
            ...this.d,
            solucion: this.s.descripcion.trim() ? { ...this.s, fecha: this.d.fecha_deteccion } : null,
          });
      this.guardado.emit(r);
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo guardar la falla');
    } finally {
      this.guardando = false;
    }
  }
}
