import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api } from '../api';
import { Falla, Maquina } from '../modelos';
import { FallaDetalle } from '../componentes/falla-detalle';
import { FallaForm } from '../componentes/falla-form';
import { Galeria } from '../componentes/galeria';
import { MaquinaForm } from '../componentes/maquina-form';
import { Modal } from '../componentes/modal';
import { Paginador, paginar } from '../componentes/paginador';
import { POR_PAGINA } from '../limites';
import { contiene, fechaCorta, fechaLarga, haceCuanto, slugCategoria } from '../util';

@Component({
  selector: 'app-maquina-detalle-page',
  imports: [FormsModule, RouterLink, FallaDetalle, FallaForm, Galeria, MaquinaForm, Modal, Paginador],
  template: `
    <a class="volver" routerLink="/maquinaria">← Volver a maquinaria</a>

    @if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    }

    @if (m; as m) {
      <div class="module-title">
        <div>
          <span class="eyebrow">{{ m.departamento || 'Sin departamento' }} · {{ m.area || 'Área no indicada' }}</span>
          <h1><span class="codigo-grande">{{ m.codigo }}</span> {{ m.nombre }}</h1>
          <p>{{ m.total_fallas }} falla{{ m.total_fallas === 1 ? '' : 's' }} registrada{{ m.total_fallas === 1 ? '' : 's' }}</p>
        </div>
        @if (api.esAdmin()) {
          <div class="row-actions">
            <button type="button" (click)="editando = true">Editar ficha</button>
            <button type="button" class="danger" (click)="borrar(m)">Borrar máquina</button>
            <button class="primary" type="button" (click)="nuevaFalla = true">
              <svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg>Registrar falla
            </button>
          </div>
        }
      </div>

      @if (editando) {
        <app-modal [titulo]="'Editar ' + m.codigo" [subtitulo]="m.nombre" (cerrar)="editando = false">
          <app-maquina-form [maquina]="m" (guardado)="editando = false; cargar()" (cancelar)="editando = false" />
        </app-modal>
      }
      @if (nuevaFalla) {
        <app-modal titulo="Registrar falla" [subtitulo]="m.codigo + ' · ' + m.nombre" (cerrar)="nuevaFalla = false">
          <app-falla-form [maquinaId]="m.id" (guardado)="fallaCreada($event)" (cancelar)="nuevaFalla = false" />
        </app-modal>
      }

      <section class="module-card ficha-equipo">
        <div class="ficha-equipo-fotos">
          <app-galeria [adjuntos]="fotosEquipo" [maquinaId]="m.id" [maximo]="2" [conPestanas]="false"
                       categoriaInicial="Ficha técnica" (cambio)="cargar()" />
        </div>
        <h2>Ficha técnica</h2>
        <dl class="ficha">
          <div><dt>Departamento</dt><dd>{{ m.departamento || '—' }}</dd></div>
          <div><dt>Área</dt><dd>{{ m.area || '—' }}</dd></div>
          <div><dt>Código</dt><dd><b>{{ m.codigo }}</b></dd></div>
          <div class="dos"><dt>Equipo</dt><dd>{{ m.nombre }}</dd></div>
          <div><dt>Marca</dt><dd>{{ m.marca || '—' }}</dd></div>
          <div><dt>Modelo</dt><dd>{{ m.modelo || '—' }}</dd></div>
          <div><dt>Serie</dt><dd>{{ m.num_serie || '—' }}</dd></div>
          <div><dt>Capacidad</dt><dd>{{ m.capacidad || '—' }}</dd></div>
          <div><dt>Ref. (POE)</dt><dd>{{ m.poe || '—' }}</dd></div>
          <div><dt>Tipo</dt><dd>{{ m.tipo || '—' }}</dd></div>
          <div><dt>Año</dt><dd>{{ m.anio || '—' }}</dd></div>
        </dl>
        <h4>Datos eléctricos y de servicios</h4>
        <dl class="ficha servicios">
          <div><dt>Tensión</dt><dd>{{ m.tension || '—' }}</dd></div>
          <div><dt>Corriente</dt><dd>{{ m.corriente || '—' }}</dd></div>
          <div><dt>Potencia</dt><dd>{{ m.potencia || '—' }}</dd></div>
          <div><dt>Presión de aire</dt><dd>{{ m.presion_aire || '—' }}</dd></div>
          <div><dt>Presión de vapor</dt><dd>{{ m.presion_vapor || '—' }}</dd></div>
        </dl>
      </section>

      <section class="module-card tabla-card">
        <div class="tabla-titulo">
          <h2>Fallas y soluciones</h2>
          <div class="segmento" role="radiogroup" aria-label="Filtrar por solución">
            @for (s of segmentos; track s.valor) {
              <button type="button" role="radio" [attr.aria-checked]="estado === s.valor" [class.activo]="estado === s.valor"
                      [attr.data-tipo]="s.clave" (click)="estado = s.valor; pagina = 1">
                {{ s.texto }} <span class="segmento-n">{{ conteo[s.clave] }}</span>
              </button>
            }
          </div>
        </div>
        <div class="filtros-fila filtros-tabla">
          <label class="buscador-icono">
            <svg class="icon" aria-hidden="true"><use href="#i-search"></use></svg>
            <input type="search" placeholder="Buscar por código, falla o solución"
                   aria-label="Buscar en las fallas de esta máquina" [(ngModel)]="q" (ngModelChange)="pagina = 1">
          </label>
          <select aria-label="Filtrar por categoría" [(ngModel)]="categoria" (ngModelChange)="pagina = 1">
            <option value="">Todas las categorías</option>
            @for (c of categorias; track c) {
              <option>{{ c }}</option>
            }
          </select>
        </div>
        <div class="tabla-scroll">
          <table class="data-table tabla-fallas">
            <thead>
              <tr>
                <th>Código</th>
                <th class="opcional">Fecha</th>
                <th class="th-falla">Falla / error</th>
                <th class="opcional">Alarma</th>
                <th class="opcional">Categoría</th>
                <th class="th-solucion">Solución aplicada</th>
              </tr>
            </thead>
            <tbody>
              @for (f of fallasPagina; track f.id) {
                <tr class="clicable" tabindex="0" [attr.data-estado]="estadoFila(f)" [class.abierta]="abiertaId === f.id"
                    [attr.aria-expanded]="abiertaId === f.id" (click)="alternar(f)" (keydown.enter)="alternar(f)">
                  <td class="codigo">{{ f.codigo }}</td>
                  <td class="fecha opcional">
                    {{ larga(f.fecha_deteccion) }}
                    <small class="subline">{{ hace(f.fecha_deteccion) }}</small>
                  </td>
                  <td>
                    <div class="celda-falla">
                      <svg class="icon" aria-hidden="true"><use href="#i-alert"></use></svg>
                      <div>
                        <strong>{{ f.titulo }}</strong>
                        @if (f.descripcion) { <small class="subline recorte">{{ f.descripcion }}</small> }
                      </div>
                    </div>
                  </td>
                  <td class="opcional">
                    @if (f.codigo_alarma) {
                      <span class="codigo-alarma">{{ f.codigo_alarma }}</span>
                    } @else {
                      <span class="sin-alarma">Sin código</span>
                    }
                  </td>
                  <td class="opcional"><span class="cat" [attr.data-cat]="slug(f.categoria)">{{ f.categoria }}</span></td>
                  <td class="solucion-celda">
                    @switch (estadoFila(f)) {
                      @case ('resuelta') {
                        <div class="sol-caja sol-ok">
                          <svg class="icon" aria-hidden="true"><use href="#i-check"></use></svg>
                          <span class="recorte">{{ f.ultima_solucion }}</span>
                        </div>
                      }
                      @case ('intento') {
                        <div class="sol-caja sol-intento" title="Se intentó una solución, pero no resolvió la falla">
                          <svg class="icon" aria-hidden="true"><use href="#i-wrench"></use></svg>
                          <span class="recorte">{{ f.ultima_solucion }}</span>
                        </div>
                      }
                      @default {
                        <span class="sol-pendiente">
                          <svg class="icon" aria-hidden="true"><use href="#i-clock"></use></svg>Sin solución
                        </span>
                      }
                    }
                  </td>
                </tr>
                @if (abiertaId === f.id) {
                  <tr class="fila-detalle">
                    <td colspan="6"><app-falla-detalle [fallaId]="f.id" (cambio)="cargar()" /></td>
                  </tr>
                }
              } @empty {
                <tr><td colspan="6" class="muted">
                  {{ (m.fallas?.length ?? 0) ? 'Ninguna falla coincide con la búsqueda' : 'Esta máquina no tiene fallas registradas' }}
                </td></tr>
              }
            </tbody>
          </table>
        </div>
        <app-paginador [total]="fallas.length" [pagina]="pagina" [porPagina]="porPagina"
                       (cambio)="pagina = $event.pagina; porPagina = $event.porPagina" />
      </section>

      <section class="module-card">
        <button type="button" class="plegable" [attr.aria-expanded]="verFotos" aria-controls="fotos-maquina"
                (click)="verFotos = !verFotos">
          <svg class="icon" aria-hidden="true"><use href="#i-chevron"></use></svg>
          <h2>Fotos y documentos ({{ m.adjuntos?.length ?? 0 }})</h2>
        </button>
        @if (verFotos) {
          <div id="fotos-maquina">
            <app-galeria [adjuntos]="m.adjuntos ?? []" [maquinaId]="m.id" (cambio)="cargar()" />
          </div>
        }
      </section>
    } @else if (!error) {
      <p class="muted">Cargando máquina…</p>
    }
  `,
})
export class MaquinaDetallePage implements OnInit {
  protected readonly api = inject(Api);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  m: Maquina | null = null;
  error = '';
  editando = false;
  nuevaFalla = false;
  abiertaId: number | null = null;
  verFotos = false;
  q = '';
  categoria = '';
  estado = '';
  categorias: string[] = [];
  pagina = 1;
  porPagina = POR_PAGINA[0];

  readonly fecha = fechaCorta;
  readonly larga = fechaLarga;
  readonly hace = haceCuanto;
  readonly slug = slugCategoria;
  readonly segmentos = [
    { valor: '', texto: 'Todas', clave: 'todas' },
    { valor: 'con', texto: 'Con solución', clave: 'con' },
    { valor: 'sin', texto: 'Sin solución', clave: 'sin' },
  ];

  estadoFila(f: Falla) {
    if (f.estado === 'Resuelta') return 'resuelta';
    return f.ultima_solucion ? 'intento' : 'pendiente';
  }

  get conteo(): Record<string, number> {
    const base = this.filtrar('');
    const con = base.filter((f) => f.estado === 'Resuelta').length;
    return { todas: base.length, con, sin: base.length - con };
  }

  get fallasPagina() {
    return paginar(this.fallas, this.pagina, this.porPagina);
  }

  get fotosEquipo() {
    return (this.m?.adjuntos ?? []).filter((a) => !a.falla_id);
  }

  get fallas(): Falla[] {
    return this.filtrar(this.estado);
  }

  private filtrar(estado: string): Falla[] {
    return (this.m?.fallas ?? []).filter(
      (f) =>
        (!this.categoria || f.categoria === this.categoria) &&
        (!estado || (estado === 'con') === (f.estado === 'Resuelta')) &&
        contiene(`${f.codigo} ${f.titulo} ${f.descripcion ?? ''} ${f.causa_raiz ?? ''} ${f.ultima_solucion ?? ''}`, this.q),
    );
  }

  ngOnInit() {
    this.route.paramMap.subscribe(() => {
      this.m = null;
      this.abiertaId = Number(this.route.snapshot.queryParamMap.get('falla')) || null;
      void this.cargar();
    });
    this.api.catalogos().then((c) => (this.categorias = c.categorias)).catch(() => undefined);
  }

  async cargar() {
    try {
      this.m = await this.api.get<Maquina>(`/maquinas/${this.route.snapshot.paramMap.get('id')}`);
      if (this.abiertaId) this.irAPaginaDe(this.abiertaId);
      this.error = '';
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo cargar la máquina');
    }
  }

  private irAPaginaDe(id: number) {
    const i = this.fallas.findIndex((f) => f.id === id);
    if (i >= 0) this.pagina = Math.floor(i / this.porPagina) + 1;
  }

  alternar(f: Falla) {
    this.abiertaId = this.abiertaId === f.id ? null : f.id;
  }

  async fallaCreada(f: Falla) {
    this.nuevaFalla = false;
    await this.cargar();
    this.abiertaId = f.id;
  }

  async borrar(m: Maquina) {
    const confirmacion = prompt(
      `Se borrará ${m.codigo} con sus ${m.total_fallas} fallas, soluciones y fotos.\n` +
        'Esta acción no se puede deshacer. Escribe el código de la máquina para confirmar:',
    );
    if (!confirmacion) return;
    try {
      await this.api.delete(`/maquinas/${m.id}?confirmar=${encodeURIComponent(confirmacion)}`);
      await this.router.navigateByUrl('/maquinaria');
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo borrar la máquina');
    }
  }
}
