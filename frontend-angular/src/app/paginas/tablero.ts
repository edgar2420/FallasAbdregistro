import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../api';
import { Estadisticas, Falla, Maquina } from '../modelos';
import { claseEstadoFalla, claseEstadoMaquina, claseSeveridad, conPausa, consulta } from '../util';

@Component({
  selector: 'app-tablero-page',
  imports: [FormsModule, RouterLink],
  template: `
    <span class="eyebrow">Operaciones / Tablero</span>
    <h1>Centro de mando</h1>

    <form class="module-card busqueda-rapida" role="search" (submit)="$event.preventDefault(); ir()">
      <label for="codigo">Escribe el código de la máquina o de la falla</label>
      <div class="busqueda-fila">
        <svg class="icon" aria-hidden="true"><use href="#i-search"></use></svg>
        <input id="codigo" type="search" autocomplete="off" autocapitalize="characters"
               placeholder="Ej.: BP-460, OSM-01, FAL-0003 o «fuga de aceite»"
               [(ngModel)]="q" name="q" (ngModelChange)="buscarConPausa()">
        <button class="primary" type="submit">Ver fallas</button>
      </div>
      @if (q.trim()) {
        <div class="resultados">
          @for (m of maquinasEncontradas; track m.id) {
            <a class="resultado" [routerLink]="['/maquinaria', m.id]">
              <span class="codigo">{{ m.codigo }}</span>
              <span>{{ m.nombre }}<small class="subline">{{ m.area || '' }} · POE {{ m.poe || '—' }}</small></span>
              <span class="tag" [class]="'tag ' + claseMaquina(m.estado)">{{ m.estado }}</span>
              <span class="resultado-extra">{{ m.fallas_abiertas }} abiertas / {{ m.total_fallas }}</span>
            </a>
          }
          @for (f of fallasEncontradas; track f.id) {
            <a class="resultado" [routerLink]="['/maquinaria', f.maquina_id]" [queryParams]="{ falla: f.id }">
              <span class="codigo">{{ f.codigo }}</span>
              <span>{{ f.titulo }}<small class="subline">{{ f.maquina_codigo }} · {{ f.maquina_nombre }}</small></span>
              <span class="tag" [class]="'tag ' + est(f.estado)">{{ f.estado }}</span>
              <span class="resultado-extra recorte">{{ f.ultima_solucion || 'Sin solución' }}</span>
            </a>
          }
          @if (!buscando && !maquinasEncontradas.length && !fallasEncontradas.length) {
            <p class="muted">Sin coincidencias para «{{ q }}»</p>
          }
        </div>
      }
    </form>

    @if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    }

    <section class="metrics">
      <article>
        <span>FALLAS ABIERTAS</span>
        <strong>{{ stats?.resumen?.fallas_abiertas ?? '—' }}</strong>
        <em class="negative">{{ stats?.resumen?.fallas_criticas ?? 0 }} críticas</em>
      </article>
      <article>
        <span>MÁQUINAS EN FALLA</span>
        <strong>{{ stats?.resumen?.maquinas_en_falla ?? '—' }}</strong>
        <em class="warning">de {{ stats?.resumen?.maquinas ?? 0 }} equipos</em>
      </article>
      <article>
        <span>PARO ÚLTIMOS 30 DÍAS</span>
        <strong>{{ horasParo }}</strong>
        <em class="warning">{{ stats?.resumen?.fallas_periodo ?? 0 }} fallas en el período</em>
      </article>
      <article>
        <span>MTTR</span>
        <strong>{{ stats?.resumen?.mttr_horas ?? '—' }} h</strong>
        <em class="positive">{{ stats?.resumen?.fallas_resueltas ?? 0 }} resueltas</em>
      </article>
    </section>

    <section class="section-head">
      <div>
        <span class="eyebrow">Flujo de trabajo</span>
        <h2>Tablero de incidencias</h2>
      </div>
      <a class="live" routerLink="/fallas" [queryParams]="{ estado: 'abiertas' }">Ver todas las abiertas →</a>
    </section>

    <section class="kanban">
      @for (col of columnas; track col.estado) {
        <div class="kanban-column">
          <div class="column-head">
            <strong><i class="status-dot" [class]="'status-dot ' + col.color"></i>{{ col.titulo }}</strong>
            <span class="count">{{ col.items.length }}</span>
          </div>
          @for (f of col.items; track f.id) {
            <a class="issue-card" [routerLink]="['/maquinaria', f.maquina_id]" [queryParams]="{ falla: f.id }">
              <div class="issue-top">
                <span class="issue-id">{{ f.codigo }}</span>
                <span class="priority" [class]="'priority ' + sev(f.severidad)">{{ f.severidad }}</span>
              </div>
              <h3>{{ f.titulo }}</h3>
              <p>{{ f.maquina_codigo }} · {{ f.maquina_nombre }}</p>
              <div class="issue-foot">
                <span>{{ f.categoria }}</span>
                <span>{{ f.responsable || 'Sin asignar' }}</span>
              </div>
            </a>
          } @empty {
            <p class="muted">{{ cargando ? 'Cargando…' : 'Sin fallas' }}</p>
          }
        </div>
      }
    </section>
  `,
})
export class TableroPage implements OnInit {
  private api = inject(Api);
  private router = inject(Router);

  stats: Estadisticas | null = null;
  error = '';
  cargando = true;
  q = '';
  buscando = false;
  maquinasEncontradas: Maquina[] = [];
  fallasEncontradas: Falla[] = [];
  columnas = [
    { estado: 'Abierta', titulo: 'Por atender', color: 'red', items: [] as Falla[] },
    { estado: 'En proceso', titulo: 'En proceso', color: 'orange', items: [] as Falla[] },
    { estado: 'Resuelta', titulo: 'Resueltas recientes', color: 'green', items: [] as Falla[] },
  ];
  private pedido = 0;

  readonly sev = claseSeveridad;
  readonly est = claseEstadoFalla;
  readonly claseMaquina = claseEstadoMaquina;
  readonly buscarConPausa = conPausa(() => this.buscar(), 250);

  get horasParo() {
    const min = this.stats?.resumen?.paro_minutos_periodo;
    return min === undefined ? '—' : `${(min / 60).toFixed(1)} h`;
  }

  async ngOnInit() {
    try {
      const [stats, fallas] = await Promise.all([
        this.api.get<Estadisticas>('/stats?dias=30'),
        this.api.get<Falla[]>('/fallas'),
      ]);
      this.stats = stats;
      for (const col of this.columnas) {
        col.items = fallas
          .filter((f) => f.estado === col.estado || (col.estado === 'Abierta' && f.estado === 'Recurrente'))
          .slice(0, col.estado === 'Resuelta' ? 6 : 20);
      }
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudieron cargar los datos');
    } finally {
      this.cargando = false;
    }
  }

  async buscar() {
    const q = this.q.trim();
    const pedido = ++this.pedido;
    if (!q) {
      this.maquinasEncontradas = [];
      this.fallasEncontradas = [];
      return;
    }
    this.buscando = true;
    try {
      const [maquinas, fallas] = await Promise.all([
        this.api.get<Maquina[]>(`/maquinas${consulta({ q })}`),
        this.api.get<Falla[]>(`/fallas${consulta({ q })}`),
      ]);
      if (pedido !== this.pedido) return;
      this.maquinasEncontradas = maquinas.slice(0, 6);
      this.fallasEncontradas = fallas.slice(0, 8);
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo buscar');
    } finally {
      if (pedido === this.pedido) this.buscando = false;
    }
  }

  /** Enter: si el código coincide exactamente con una máquina o falla, abre su ficha. */
  async ir() {
    const q = this.q.trim().toUpperCase();
    if (!q) return;
    await this.buscar();
    const maquina = this.maquinasEncontradas.find((m) => m.codigo.toUpperCase() === q)
      ?? (this.maquinasEncontradas.length === 1 && !this.fallasEncontradas.length ? this.maquinasEncontradas[0] : null);
    if (maquina) {
      await this.router.navigate(['/maquinaria', maquina.id]);
      return;
    }
    const falla = this.fallasEncontradas.find((f) => f.codigo.toUpperCase() === q);
    if (falla) {
      await this.router.navigate(['/maquinaria', falla.maquina_id], { queryParams: { falla: falla.id } });
      return;
    }
    await this.router.navigate(['/fallas'], { queryParams: { q: this.q.trim() } });
  }
}
