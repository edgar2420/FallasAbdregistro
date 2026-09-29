import { Component, OnInit, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../api';
import { Falla, Maquina } from '../modelos';
import { aInputFecha } from '../util';
import { LIMITES } from '../limites';
import { Contador } from './contador';

function ahoraLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

@Component({
  selector: 'app-falla-form',
  imports: [FormsModule, Contador],
  template: `
    <form class="modal-form" (submit)="$event.preventDefault(); guardar()">
      @if (error) {
        <p class="form-error" role="alert">{{ error }}</p>
      }

      @if (!maquinaId()) {
        <div class="crud-grid tres">
          <label class="dos">Máquina *
            <select name="maquina" required [(ngModel)]="d.maquina_id">
              <option [ngValue]="null">Selecciona una máquina</option>
              @for (m of maquinas; track m.id) {
                <option [ngValue]="m.id">{{ m.codigo }} · {{ m.nombre }}</option>
              }
            </select>
          </label>
        </div>
      }

      <div class="tipo-alarma" role="radiogroup" aria-label="Tipo de falla">
        <label class="tipo-alarma-opcion" [class.activa]="conAlarma">
          <input type="radio" name="tipo_alarma" [value]="true" [(ngModel)]="conAlarma">
          <strong>Código de alarma</strong>
        </label>
        <label class="tipo-alarma-opcion" [class.activa]="!conAlarma">
          <input type="radio" name="tipo_alarma" [value]="false" [(ngModel)]="conAlarma">
          <strong>Sin código de alarma</strong>
        </label>
      </div>

      <div class="crud-grid tres">
        @if (conAlarma) {
          <label>Código de alarma *
            <input name="codigo_alarma" [maxlength]="L.falla.codigo_alarma" required
                   placeholder="Ej.: E-101" [(ngModel)]="d.codigo_alarma">
          </label>
          <label class="dos">Descripción de la falla *
            <input name="titulo" [maxlength]="L.falla.titulo" required placeholder="Describa la falla observada…" [(ngModel)]="d.titulo">
          </label>
        } @else {
          <label class="wide">Descripción de la falla *
            <input name="titulo" [maxlength]="L.falla.titulo" required placeholder="Describa la falla operativa observada…" [(ngModel)]="d.titulo">
          </label>
        }
      </div>

      <div class="crud-grid tres">
        <label>Causa probable
          <textarea name="causa_raiz" [maxlength]="L.falla.causa_raiz" placeholder="Sensor sucio, sobrecarga, desajuste…"
                    [(ngModel)]="d.causa_raiz"></textarea>
        </label>
        <label class="dos">Solución / Acción correctiva {{ falla() ? '' : '*' }}
          <textarea name="sol_descripcion" [maxlength]="L.solucion.descripcion" [required]="!falla()"
                    placeholder="Describa la solución realizada…" [(ngModel)]="s.descripcion"></textarea>
        </label>
      </div>

      <div class="crud-grid tres">
        <label class="wide">Categoría
          <input name="categoria" [maxlength]="L.falla.categoria" placeholder="Ej.: Mecánica" [(ngModel)]="d.categoria">
        </label>
      </div>

      @if (falla()) {
        <div class="crud-grid tres">
          <label>Código
            <input name="codigo" [maxlength]="L.falla.codigo" [(ngModel)]="d.codigo">
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
  maquinas: Maquina[] = [];
  error = '';
  guardando = false;
  conAlarma = false;
  d = {
    maquina_id: null as number | null,
    codigo: '',
    titulo: '',
    categoria: 'Mecánica',
    responsable: '',
    fecha_deteccion: ahoraLocal(),
    codigo_alarma: '',
    causa_raiz: '',
  };
  s = {
    descripcion: '',
    repuestos: '',
    tecnico: '',
  };

  async ngOnInit() {
    const f = this.falla();
    if (f) {
      this.d = {
        maquina_id: f.maquina_id,
        codigo: f.codigo,
        titulo: f.titulo,
        categoria: f.categoria,
        responsable: f.responsable ?? '',
        fecha_deteccion: aInputFecha(f.fecha_deteccion) || ahoraLocal(),
        codigo_alarma: f.codigo_alarma ?? '',
        causa_raiz: f.causa_raiz ?? '',
      };
      this.conAlarma = !!f.codigo_alarma;
    } else {
      this.d.maquina_id = this.maquinaId();
      this.d.responsable = this.api.usuario()?.nombre ?? '';
      this.s.tecnico = this.api.usuario()?.nombre ?? '';
    }
    if (!this.maquinaId()) {
      try {
        this.maquinas = await this.api.get<Maquina[]>('/maquinas');
      } catch (e: unknown) {
        this.error = Api.mensaje(e, 'No se pudieron cargar las máquinas');
      }
    }
  }

  async guardar() {
    const f = this.falla();
    if (!this.d.maquina_id || !this.d.titulo.trim()) {
      this.error = 'Selecciona la máquina y describe la falla';
      return;
    }
    if (this.conAlarma && !this.d.codigo_alarma.trim()) {
      this.error = 'Escribe el código de alarma o cambia a «Sin código de alarma»';
      return;
    }
    if (!f && !this.s.descripcion.trim()) {
      this.error = 'Describe la solución aplicada';
      return;
    }
    this.error = '';
    this.guardando = true;
    try {
      const datos = { ...this.d, codigo_alarma: this.conAlarma ? this.d.codigo_alarma.trim() : '' };
      const r = f
        ? await this.api.put<Falla>(`/fallas/${f.id}`, datos)
        : await this.api.post<Falla>('/fallas', {
            ...datos,
            solucion: this.s.descripcion.trim() ? { ...this.s } : null,
          });
      this.guardado.emit(r);
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo guardar la falla');
    } finally {
      this.guardando = false;
    }
  }
}
