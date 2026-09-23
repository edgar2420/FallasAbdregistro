import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../api';
import { Falla, Maquina } from '../modelos';
import { consulta, contiene } from '../util';

/** Tablero: las máquinas como fichas de placa; un clic abre su ficha, fotos y fallas. */
@Component({
  selector: 'app-tablero-page',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="module-title">
      <div>
        <span class="eyebrow">Planta / Equipos</span>
        <h1>Maquinaria de planta</h1>
        <p>Escribe el código o el nombre del equipo, o haz clic en una ficha para ver sus fallas y soluciones.</p>
      </div>
    </div>

    <form class="module-card filtros tablero-filtros" role="search" (submit)="$event.preventDefault(); ir()">
      <input type="search" class="buscador" autocomplete="off" autocapitalize="characters"
             placeholder="Código (AM-015-01), equipo, área o Ref. POE" aria-label="Buscar equipo"
             [(ngModel)]="q" name="q">
      <select aria-label="Filtrar por departamento" [(ngModel)]="departamento" name="departamento">
        <option value="">Todos los departamentos</option>
        @for (d of departamentos; track d) {
          <option>{{ d }}</option>
        }
      </select>
      <select aria-label="Filtrar por área" [(ngModel)]="area" name="area">
        <option value="">Todas las áreas</option>
        @for (a of areas; track a) {
          <option>{{ a }}</option>
        }
      </select>
      <span class="contador">{{ visibles.length }} de {{ maquinas.length }} equipos</span>
    </form>

    @if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    }

    <section class="placas">
      @for (m of visibles; track m.id) {
        <a class="placa" [routerLink]="['/maquinaria', m.id]">
          <header class="placa-head">
            <span class="placa-codigo">{{ m.codigo }}</span>
            @if (m.fallas_abiertas) {
              <span class="placa-alerta">{{ m.fallas_abiertas }} sin solución</span>
            }
          </header>
          <h2>{{ m.nombre }}</h2>
          <dl>
            <div><dt>Departamento</dt><dd>{{ m.departamento || '—' }}</dd></div>
            <div><dt>Área</dt><dd>{{ m.area || '—' }}</dd></div>
            <div><dt>Marca</dt><dd>{{ m.marca || '—' }}</dd></div>
            <div><dt>Modelo</dt><dd>{{ m.modelo || '—' }}</dd></div>
            <div><dt>Serie</dt><dd>{{ m.num_serie || '—' }}</dd></div>
            <div><dt>Capacidad</dt><dd>{{ m.capacidad || '—' }}</dd></div>
            <div class="completa"><dt>Ref.</dt><dd>{{ m.poe || '—' }}</dd></div>
          </dl>
          <footer class="placa-pie">
            <span>{{ m.total_fallas }} falla{{ m.total_fallas === 1 ? '' : 's' }} registrada{{ m.total_fallas === 1 ? '' : 's' }}</span>
            <span class="placa-ver">Ver ficha →</span>
          </footer>
        </a>
      } @empty {
        <div class="module-card vacio">
          @if (cargando) {
            <p class="muted">Cargando equipos…</p>
          } @else if (maquinas.length) {
            <p class="muted">Ningún equipo coincide con «{{ q }}».</p>
            @if (q.trim()) {
              <a class="primary" routerLink="/fallas" [queryParams]="{ q: q.trim() }">Buscar «{{ q.trim() }}» en las fallas</a>
            }
          } @else {
            <p class="muted">Todavía no hay equipos registrados.</p>
            @if (api.esAdmin()) {
              <a class="primary" routerLink="/maquinaria">Registrar el primer equipo</a>
            }
          }
        </div>
      }
    </section>
  `,
})
export class TableroPage implements OnInit {
  protected readonly api = inject(Api);
  private router = inject(Router);

  maquinas: Maquina[] = [];
  q = '';
  area = '';
  departamento = '';
  error = '';
  cargando = true;

  get areas() {
    return [...new Set(this.maquinas.map((m) => m.area).filter((a): a is string => !!a))].sort();
  }

  get departamentos() {
    return [...new Set(this.maquinas.map((m) => m.departamento).filter((d): d is string => !!d))].sort();
  }

  get visibles() {
    return this.maquinas.filter(
      (m) =>
        (!this.area || m.area === this.area) &&
        (!this.departamento || m.departamento === this.departamento) &&
        contiene(`${m.codigo} ${m.nombre} ${m.area ?? ''} ${m.departamento ?? ''} ${m.poe ?? ''} ${m.modelo ?? ''}`, this.q),
    );
  }

  async ngOnInit() {
    try {
      this.maquinas = await this.api.get<Maquina[]>('/maquinas');
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudieron cargar los equipos');
    } finally {
      this.cargando = false;
    }
  }

  /** Enter: abre la ficha si el código coincide con un equipo (o con una falla, FAL-0001). */
  async ir() {
    const q = this.q.trim().toUpperCase();
    if (!q) return;
    const exacta = this.maquinas.find((m) => m.codigo.toUpperCase() === q);
    const unica = this.visibles.length === 1 ? this.visibles[0] : null;
    if (exacta || unica) {
      await this.router.navigate(['/maquinaria', (exacta ?? unica)!.id]);
      return;
    }
    try {
      const falla = (await this.api.get<Falla[]>(`/fallas${consulta({ q })}`)).find((f) => f.codigo.toUpperCase() === q);
      if (falla) {
        await this.router.navigate(['/maquinaria', falla.maquina_id], { queryParams: { falla: falla.id } });
        return;
      }
    } catch {
      /* si falla la búsqueda se deja la lista filtrada */
    }
    if (!this.visibles.length) await this.router.navigate(['/fallas'], { queryParams: { q: this.q.trim() } });
  }
}
