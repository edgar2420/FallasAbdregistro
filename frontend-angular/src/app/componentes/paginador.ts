import { Component, computed, input, output } from '@angular/core';
import { POR_PAGINA } from '../limites';

export interface CambioPagina {
  pagina: number;
  porPagina: number;
}

/** Pie de tabla: "1–10 de 45 · Mostrar [10] · ‹ 1 2 3 … 5 ›". Se oculta si todo cabe en la página más chica. */
@Component({
  selector: 'app-paginador',
  template: `
    @if (total() > opciones()[0]) {
      <nav class="paginador" aria-label="Paginación">
        <span class="pag-info">{{ desde() }}–{{ hasta() }} de {{ total() }}</span>
        <label class="pag-tam">
          Mostrar
          <select [value]="porPagina()" (change)="tamano($any($event.target).value)">
            @for (o of opciones(); track o) {
              <option [value]="o" [selected]="o === porPagina()">{{ o }}</option>
            }
          </select>
        </label>
        <div class="pag-botones">
          <button type="button" aria-label="Página anterior" [disabled]="actual() <= 1" (click)="ir(actual() - 1)">‹</button>
          @for (p of numeros(); track $index) {
            @if (p === 0) {
              <span class="pag-salto" aria-hidden="true">…</span>
            } @else {
              <button type="button" [class.activa]="p === actual()" [attr.aria-current]="p === actual() ? 'page' : null"
                      [attr.aria-label]="'Página ' + p" (click)="ir(p)">{{ p }}</button>
            }
          }
          <button type="button" aria-label="Página siguiente" [disabled]="actual() >= paginas()" (click)="ir(actual() + 1)">›</button>
        </div>
      </nav>
    }
  `,
})
export class Paginador {
  readonly total = input.required<number>();
  readonly pagina = input(1);
  readonly porPagina = input(POR_PAGINA[0]);
  readonly opciones = input(POR_PAGINA);
  readonly cambio = output<CambioPagina>();

  readonly paginas = computed(() => Math.max(1, Math.ceil(this.total() / this.porPagina())));
  readonly actual = computed(() => Math.min(Math.max(1, this.pagina()), this.paginas()));
  readonly desde = computed(() => (this.total() ? (this.actual() - 1) * this.porPagina() + 1 : 0));
  readonly hasta = computed(() => Math.min(this.total(), this.actual() * this.porPagina()));

  /** Primera, última y las vecinas de la actual; 0 marca un salto "…". */
  readonly numeros = computed(() => {
    const n = this.paginas();
    const a = this.actual();
    const lista: number[] = [];
    for (let p = 1; p <= n; p += 1) {
      if (p === 1 || p === n || Math.abs(p - a) <= 1) lista.push(p);
      else if (lista[lista.length - 1] !== 0) lista.push(0);
    }
    return lista;
  });

  ir(p: number) {
    this.cambio.emit({ pagina: Math.min(Math.max(1, p), this.paginas()), porPagina: this.porPagina() });
  }

  tamano(valor: string) {
    this.cambio.emit({ pagina: 1, porPagina: Number(valor) });
  }
}

/** Recorta una lista a la página pedida (ajusta la página si quedó fuera de rango). */
export function paginar<T>(items: T[], pagina: number, porPagina: number): T[] {
  const paginas = Math.max(1, Math.ceil(items.length / porPagina));
  const p = Math.min(Math.max(1, pagina), paginas);
  return items.slice((p - 1) * porPagina, p * porPagina);
}
