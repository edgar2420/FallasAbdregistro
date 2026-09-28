import { Component, OnInit, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../api';
import { Catalogos, Falla, Maquina } from '../modelos';
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
          <div>
            <strong>Con código de alarma</strong>
            <small>La máquina muestra un código en el HMI</small>
          </div>
        </label>
        <label class="tipo-alarma-opcion" [class.activa]="!conAlarma">
          <input type="radio" name="tipo_alarma" [value]="false" [(ngModel)]="conAlarma">
          <div>
            <strong>Sin código de alarma</strong>
            <small>Falla sin alarma en el HMI (falla operativa)</small>
          </div>
        </label>
      </div>

      <div class="crud-grid tres">
        <label>Código de alarma (HMI)
          <input name="codigo_alarma" [maxlength]="L.falla.codigo_alarma" [disabled]="!conAlarma"
                 placeholder="Ej.: E-101 (opcional si no tiene código)" [(ngModel)]="d.codigo_alarma">
        </label>
        <label class="dos">Descripción de la falla *
          <input name="titulo" [maxlength]="L.falla.titulo" required placeholder="Describa la falla observada…" [(ngModel)]="d.titulo">
        </label>
      </div>

      <div class="crud-grid tres">
        <label>Causa probable
          <textarea name="causa_raiz" [maxlength]="L.falla.causa_raiz" placeholder="Sensor sucio, sobrecarga, desajuste…"
                    [(ngModel)]="d.causa_raiz"></textarea>
        </label>
        <label>Solución / Acción correctiva {{ falla() ? '' : '*' }}
          <textarea name="sol_descripcion" [maxlength]="L.solucion.descripcion" [required]="!falla()"
                    placeholder="Describa la solución realizada…" [(ngModel)]="s.descripcion"></textarea>
        </label>
        <label>Fecha y hora *
          <input name="fecha" type="datetime-local" required [(ngModel)]="d.fecha_deteccion">
        </label>
      </div>

      <div class="crud-grid tres">
        <label>Responsable {{ falla() ? '' : '*' }}
          <input name="responsable" [maxlength]="L.falla.responsable" [required]="!falla()"
                 placeholder="Nombre del técnico" [(ngModel)]="d.responsable">
        </label>
        <label>Estado
          <select name="estado" [(ngModel)]="d.estado">
            @for (e of cat?.estados_falla ?? []; track e) {
              <option>{{ e }}</option>
            }
          </select>
        </label>
        <label>Categoría
          <select name="categoria" [(ngModel)]="d.categoria">
            @for (c of cat?.categorias ?? []; track c) {
              <option>{{ c }}</option>
            }
          </select>
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
  cat?: Catalogos;
  maquinas: Maquina[] = [];
  error = '';
  guardando = false;
  conAlarma = false;
  d = {
    maquina_id: null as number | null,
    codigo: '',
    titulo: '',
    categoria: 'Mecánica',
    estado: 'Abierta',
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
        estado: f.estado,
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
    const f = this.falla();
    if (!this.d.maquina_id || !this.d.titulo.trim()) {
      this.error = 'Selecciona la máquina y describe la falla';
      return;
    }
    if (!f && (!this.d.responsable.trim() || !this.s.descripcion.trim())) {
      this.error = 'Indica el responsable y la solución aplicada';
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
