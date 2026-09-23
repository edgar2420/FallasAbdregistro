import { Component, OnInit, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../api';
import { Catalogos, Maquina, Tipo } from '../modelos';
import { LIMITES } from '../limites';
import { Contador } from './contador';

const VACIA = {
  codigo: '',
  nombre: '',
  departamento: '',
  area: '',
  tipo_id: null as number | null,
  marca: '',
  modelo: '',
  num_serie: '',
  capacidad: '',
  poe: '',
  anio: null as number | null,
  tension: '',
  corriente: '',
  potencia: '',
  presion_aire: '',
  consumo_aire: '',
  presion_vapor: '',
  consumo_vapor: '',
  notas: '',
};

/** Ficha técnica de una máquina con los datos de su placa (alta y edición, sólo administradores). */
@Component({
  selector: 'app-maquina-form',
  imports: [FormsModule, Contador],
  template: `
    <form class="modal-form" (submit)="$event.preventDefault(); guardar()">
      @if (error) {
        <p class="form-error" role="alert">{{ error }}</p>
      }

      <h4>Datos de la placa</h4>
      <div class="crud-grid tres">
        <label>Código *
          <input name="codigo" [maxlength]="L.codigo" required autocapitalize="characters" placeholder="AM-015-01" [(ngModel)]="d.codigo">
        </label>
        <label class="dos">Equipo *
          <input name="nombre" [maxlength]="L.nombre" required placeholder="Osmosis inversa IPA" [(ngModel)]="d.nombre">
        </label>
        <label>Departamento
          <input name="departamento" [maxlength]="L.departamento" placeholder="Servicios de apoyo" [(ngModel)]="d.departamento">
        </label>
        <label>Área<input name="area" [maxlength]="L.area" placeholder="Osmosis" [(ngModel)]="d.area"></label>
        <label>Tipo
          <select name="tipo" [(ngModel)]="d.tipo_id">
            <option [ngValue]="null">Sin tipo</option>
            @for (t of tipos; track t.id) {
              <option [ngValue]="t.id">{{ t.nombre }}</option>
            }
          </select>
        </label>
        <label>Marca<input name="marca" [maxlength]="L.marca" placeholder="N.A" [(ngModel)]="d.marca"></label>
        <label>Modelo<input name="modelo" [maxlength]="L.modelo" placeholder="DP-050-SV" [(ngModel)]="d.modelo"></label>
        <label>Serie<input name="serie" [maxlength]="L.num_serie" placeholder="N.A" [(ngModel)]="d.num_serie"></label>
        <label>Capacidad<input name="capacidad" [maxlength]="L.capacidad" placeholder="1400 L/H" [(ngModel)]="d.capacidad"></label>
        <label class="dos">Ref. (POE)
          <input name="poe" [maxlength]="L.poe" placeholder="ASA-POE-003" [(ngModel)]="d.poe">
        </label>
        <label class="dos">Año<input name="anio" type="number" min="1900" [(ngModel)]="d.anio"></label>
      </div>

      <h4>Datos eléctricos y de servicios</h4>
      <div class="crud-grid tres">
        <label>Tensión<input name="tension" [maxlength]="L.tension" placeholder="380 V trifásico 60 Hz" [(ngModel)]="d.tension"></label>
        <label>Corriente<input name="corriente" [maxlength]="L.corriente" placeholder="32 A" [(ngModel)]="d.corriente"></label>
        <label>Potencia<input name="potencia" [maxlength]="L.potencia" placeholder="15 kW" [(ngModel)]="d.potencia"></label>
        <label>Presión de aire<input name="presion_aire" [maxlength]="L.presion_aire" placeholder="6 bar" [(ngModel)]="d.presion_aire"></label>
        <label>Consumo de aire<input name="consumo_aire" [maxlength]="L.consumo_aire" placeholder="300 L/min" [(ngModel)]="d.consumo_aire"></label>
        <label>Presión de vapor<input name="presion_vapor" [maxlength]="L.presion_vapor" placeholder="3 bar" [(ngModel)]="d.presion_vapor"></label>
        <label>Consumo de vapor<input name="consumo_vapor" [maxlength]="L.consumo_vapor" placeholder="60 kg/h" [(ngModel)]="d.consumo_vapor"></label>
        <label class="wide">Notas técnicas<textarea name="notas" [maxlength]="L.notas" [(ngModel)]="d.notas"></textarea></label>
      </div>

      <div class="form-actions">
        <button class="ghost" type="button" (click)="cancelar.emit()">Cancelar</button>
        <button class="primary" type="submit" [disabled]="guardando">
          {{ guardando ? 'Guardando…' : 'Guardar máquina' }}
        </button>
      </div>
    </form>
  `,
})
export class MaquinaForm implements OnInit {
  private api = inject(Api);
  readonly maquina = input<Maquina | null>(null);
  readonly guardado = output<Maquina>();
  readonly cancelar = output<void>();

  readonly L = LIMITES.maquina;
  d = { ...VACIA };
  tipos: Tipo[] = [];
  cat?: Catalogos;
  error = '';
  guardando = false;

  async ngOnInit() {
    const m = this.maquina();
    if (m) {
      this.d = Object.fromEntries(
        Object.keys(VACIA).map((k) => [k, (m as unknown as Record<string, unknown>)[k] ?? (VACIA as Record<string, unknown>)[k]]),
      ) as typeof VACIA;
    }
    try {
      [this.tipos, this.cat] = await Promise.all([this.api.get<Tipo[]>('/tipos'), this.api.catalogos()]);
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudieron cargar los tipos de máquina');
    }
  }

  async guardar() {
    if (!this.d.codigo.trim() || !this.d.nombre.trim()) {
      this.error = 'El código y el nombre del equipo son obligatorios';
      return;
    }
    this.error = '';
    this.guardando = true;
    try {
      const m = this.maquina();
      const r = m
        ? await this.api.put<Maquina>(`/maquinas/${m.id}`, this.d)
        : await this.api.post<Maquina>('/maquinas', this.d);
      this.guardado.emit(r);
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo guardar la máquina');
    } finally {
      this.guardando = false;
    }
  }
}
