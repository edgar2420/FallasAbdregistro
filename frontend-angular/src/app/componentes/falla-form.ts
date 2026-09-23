import { Component, OnInit, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../api';
import { Catalogos, Falla, Maquina } from '../modelos';
import { aInputFecha } from '../util';

/** Alta o edición de una falla (sólo administradores). */
@Component({
  selector: 'app-falla-form',
  imports: [FormsModule],
  template: `
    <form class="module-card inline-form" (submit)="$event.preventDefault(); guardar()">
      <h3>{{ falla() ? 'Editar falla ' + falla()!.codigo : 'Registrar falla' }}</h3>
      @if (error) {
        <p class="form-error" role="alert">{{ error }}</p>
      }
      <div class="crud-grid">
        <label>Máquina afectada *
          <select name="maquina" required [(ngModel)]="d.maquina_id">
            <option [ngValue]="null">Selecciona una máquina</option>
            @for (m of maquinas; track m.id) {
              <option [ngValue]="m.id">{{ m.codigo }} · {{ m.nombre }}</option>
            }
          </select>
        </label>
        <label>Título *<input name="titulo" required [(ngModel)]="d.titulo"></label>
        <label>Categoría
          <select name="categoria" [(ngModel)]="d.categoria">
            @for (c of cat?.categorias ?? []; track c) {
              <option>{{ c }}</option>
            }
          </select>
        </label>
        <label>Severidad
          <select name="severidad" [(ngModel)]="d.severidad">
            @for (s of cat?.severidades ?? []; track s) {
              <option>{{ s }}</option>
            }
          </select>
        </label>
        <label>Estado
          <select name="estado" [(ngModel)]="d.estado">
            @for (s of cat?.estados_falla ?? []; track s) {
              <option>{{ s }}</option>
            }
          </select>
        </label>
        <label>Turno
          <select name="turno" [(ngModel)]="d.turno">
            <option value="">—</option>
            @for (t of cat?.turnos ?? []; track t) {
              <option>{{ t }}</option>
            }
          </select>
        </label>
        <label>Detectada<input name="deteccion" type="datetime-local" [(ngModel)]="d.fecha_deteccion"></label>
        @if (d.estado === 'Resuelta') {
          <label>Resuelta<input name="resolucion" type="datetime-local" [(ngModel)]="d.fecha_resolucion"></label>
        }
        <label>Minutos de paro<input name="paro" type="number" min="0" [(ngModel)]="d.paro_minutos"></label>
        <label>Reportado por<input name="reportado" [(ngModel)]="d.reportado_por"></label>
        <label>Responsable<input name="responsable" [(ngModel)]="d.responsable"></label>
        <label class="wide">Síntomas<textarea name="sintomas" [(ngModel)]="d.sintomas"></textarea></label>
        <label class="wide">Descripción<textarea name="descripcion" [(ngModel)]="d.descripcion"></textarea></label>
        <label class="wide">Causa raíz<textarea name="causa" [(ngModel)]="d.causa_raiz"></textarea></label>
      </div>
      <div class="form-actions">
        <button class="ghost" type="button" (click)="cancelar.emit()">Cancelar</button>
        <button class="primary" type="submit" [disabled]="guardando">
          {{ guardando ? 'Guardando…' : 'Guardar falla' }}
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

  cat?: Catalogos;
  maquinas: Maquina[] = [];
  error = '';
  guardando = false;
  d = {
    maquina_id: null as number | null,
    titulo: '',
    categoria: 'Mecánica',
    severidad: 'Media',
    estado: 'Abierta',
    turno: '',
    fecha_deteccion: '',
    fecha_resolucion: '',
    paro_minutos: 0 as number | null,
    reportado_por: '',
    responsable: '',
    sintomas: '',
    descripcion: '',
    causa_raiz: '',
  };

  async ngOnInit() {
    const f = this.falla();
    if (f) {
      this.d = {
        maquina_id: f.maquina_id,
        titulo: f.titulo,
        categoria: f.categoria,
        severidad: f.severidad,
        estado: f.estado,
        turno: f.turno ?? '',
        fecha_deteccion: aInputFecha(f.fecha_deteccion),
        fecha_resolucion: aInputFecha(f.fecha_resolucion),
        paro_minutos: f.paro_minutos,
        reportado_por: f.reportado_por ?? '',
        responsable: f.responsable ?? '',
        sintomas: f.sintomas ?? '',
        descripcion: f.descripcion ?? '',
        causa_raiz: f.causa_raiz ?? '',
      };
    } else {
      this.d.maquina_id = this.maquinaId();
      this.d.reportado_por = this.api.usuario()?.nombre ?? '';
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
      this.error = 'Selecciona la máquina y escribe el título de la falla';
      return;
    }
    this.error = '';
    this.guardando = true;
    try {
      const f = this.falla();
      const r = f
        ? await this.api.put<Falla>(`/fallas/${f.id}`, this.d)
        : await this.api.post<Falla>('/fallas', this.d);
      this.guardado.emit(r);
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo guardar la falla');
    } finally {
      this.guardando = false;
    }
  }
}
