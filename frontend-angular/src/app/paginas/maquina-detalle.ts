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
import { claseEstadoFalla, contiene, fechaCorta, fechaLarga, haceCuanto, slugCategoria } from '../util';

type Pestana = 'registro' | 'tecnico' | 'documentacion' | 'mantenimiento';

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
          </div>
        }
      </div>

      @if (editando) {
        <app-modal [titulo]="'Editar ' + m.codigo" [subtitulo]="m.nombre" (cerrar)="editando = false">
          <app-maquina-form [maquina]="m" (guardado)="editando = false; cargar()" (cancelar)="editando = false" />
        </app-modal>
      }
      @if (editandoFalla; as ef) {
        <app-modal [titulo]="'Editar falla ' + ef.codigo" [subtitulo]="m.codigo + ' · ' + m.nombre"
                   (cerrar)="editandoFalla = null">
          <app-falla-form [falla]="ef" [maquinaId]="m.id" (guardado)="editandoFalla = null; cargar()"
                           (cancelar)="editandoFalla = null" />
        </app-modal>
      }

      <section class="module-card ficha-equipo">
        <h2>Información de la máquina</h2>
        <div class="ficha-equipo-layout">
          <div class="ficha-equipo-fotos">
            <app-galeria [adjuntos]="fotosEquipo" [maquinaId]="m.id" [maximo]="2" [conPestanas]="false"
                         categoriaInicial="Ficha técnica" (cambio)="cargar()" />
          </div>
          <div class="ficha-equipo-datos">
            <div class="ficha-col">
              <h4>Datos de la placa y ficha técnica</h4>
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
            </div>
            <div class="ficha-col">
              <h4>Datos eléctricos y de servicios</h4>
              <dl class="ficha servicios">
                <div><dt>Tensión</dt><dd>{{ m.tension || '—' }}</dd></div>
                <div><dt>Corriente</dt><dd>{{ m.corriente || '—' }}</dd></div>
                <div><dt>Potencia</dt><dd>{{ m.potencia || '—' }}</dd></div>
                <div><dt>Presión de aire</dt><dd>{{ m.presion_aire || '—' }}</dd></div>
                <div><dt>Presión de vapor</dt><dd>{{ m.presion_vapor || '—' }}</dd></div>
              </dl>
            </div>
          </div>
        </div>

        <div class="tabs" role="tablist" aria-label="Secciones de la máquina">
          <button type="button" role="tab" [attr.aria-selected]="tab === 'registro'" [class.activo]="tab === 'registro'"
                  (click)="tab = 'registro'">
            <svg class="icon" aria-hidden="true"><use href="#i-alert"></use></svg>Registro de fallas
          </button>
          <button type="button" role="tab" [attr.aria-selected]="tab === 'tecnico'" [class.activo]="tab === 'tecnico'"
                  (click)="tab = 'tecnico'">
            <svg class="icon" aria-hidden="true"><use href="#i-machine"></use></svg>Datos técnicos
          </button>
          <button type="button" role="tab" [attr.aria-selected]="tab === 'documentacion'" [class.activo]="tab === 'documentacion'"
                  (click)="tab = 'documentacion'">
            <svg class="icon" aria-hidden="true"><use href="#i-board"></use></svg>Documentación
          </button>
          <button type="button" role="tab" [attr.aria-selected]="tab === 'mantenimiento'" [class.activo]="tab === 'mantenimiento'"
                  (click)="tab = 'mantenimiento'">
            <svg class="icon" aria-hidden="true"><use href="#i-wrench"></use></svg>Historial de mantenimiento
          </button>
        </div>

        @if (tab === 'registro') {
          @if (api.esAdmin()) {
            <div class="registro-falla">
              <h2>Registrar nueva falla</h2>
              <app-falla-form [maquinaId]="m.id" (guardado)="fallaCreada($event)" (cancelar)="null" />
            </div>
          }

          <div class="tabla-titulo">
            <h2>Historial de fallas</h2>
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
              <input type="search" placeholder="Buscar por código, descripción o responsable…"
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
                  <th>N.°</th>
                  <th>Fecha y hora</th>
                  <th>Tipo</th>
                  <th class="opcional">Código HMI</th>
                  <th class="th-falla">Descripción</th>
                  <th class="opcional th-solucion">Causa probable</th>
                  <th class="th-solucion">Solución</th>
                  <th class="opcional">Responsable</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (f of fallasPagina; track f.id; let i = $index) {
                  <tr [attr.data-estado]="estadoFila(f)" [class.abierta]="abiertaId === f.id">
                    <td>{{ (pagina - 1) * porPagina + i + 1 }}</td>
                    <td class="fecha">
                      {{ larga(f.fecha_deteccion) }}
                      <small class="subline">{{ hace(f.fecha_deteccion) }}</small>
                    </td>
                    <td>
                      @if (f.codigo_alarma) {
                        <span class="tag red">Con código</span>
                      } @else {
                        <span class="tag blue">Sin código</span>
                      }
                    </td>
                    <td class="opcional">
                      @if (f.codigo_alarma) {
                        <span class="codigo-alarma">{{ f.codigo_alarma }}</span>
                      } @else {
                        <span class="sin-alarma">—</span>
                      }
                    </td>
                    <td>
                      <div class="celda-falla">
                        <svg class="icon" aria-hidden="true"><use href="#i-alert"></use></svg>
                        <div>
                          <strong>{{ f.titulo }}</strong>
                          <small class="subline">{{ f.codigo }}</small>
                        </div>
                      </div>
                    </td>
                    <td class="opcional solucion-celda">
                      @if (f.causa_raiz) { <span class="recorte">{{ f.causa_raiz }}</span> } @else { <span class="muted">—</span> }
                    </td>
                    <td class="solucion-celda">
                      @if (f.ultima_solucion) { <span class="recorte">{{ f.ultima_solucion }}</span> } @else { <span class="sol-pendiente"><svg class="icon" aria-hidden="true"><use href="#i-clock"></use></svg>Sin solución</span> }
                    </td>
                    <td class="opcional">{{ f.responsable || '—' }}</td>
                    <td><span class="tag" [class]="claseEstado(f.estado)">{{ f.estado }}</span></td>
                    <td>
                      <div class="row-actions iconos">
                        <button type="button" class="icon-button" title="Ver detalle" aria-label="Ver detalle" (click)="alternar(f)">
                          <svg class="icon" aria-hidden="true"><use href="#i-eye"></use></svg>
                        </button>
                        @if (api.esAdmin()) {
                          <button type="button" class="icon-button" title="Editar" aria-label="Editar falla" (click)="editandoFalla = f">
                            <svg class="icon" aria-hidden="true"><use href="#i-pencil"></use></svg>
                          </button>
                          <button type="button" class="icon-button danger" title="Borrar" aria-label="Borrar falla" (click)="borrarFalla(f)">
                            <svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg>
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                  @if (abiertaId === f.id) {
                    <tr class="fila-detalle">
                      <td colspan="10"><app-falla-detalle [fallaId]="f.id" (cambio)="cargar()" /></td>
                    </tr>
                  }
                } @empty {
                  <tr><td colspan="10" class="muted">
                    {{ (m.fallas?.length ?? 0) ? 'Ninguna falla coincide con la búsqueda' : 'Esta máquina no tiene fallas registradas' }}
                  </td></tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginador [total]="fallas.length" [pagina]="pagina" [porPagina]="porPagina"
                         (cambio)="pagina = $event.pagina; porPagina = $event.porPagina" />
        }

        @if (tab === 'tecnico') {
          <p class="muted tab-panel">Los datos técnicos y de placa de esta máquina se muestran arriba, en «Información de la máquina».</p>
        }

        @if (tab === 'documentacion') {
          <div class="tab-panel">
            <h2>Fotos y documentos ({{ m.adjuntos?.length ?? 0 }})</h2>
            <app-galeria [adjuntos]="m.adjuntos ?? []" [maquinaId]="m.id" (cambio)="cargar()" />
          </div>
        }

        @if (tab === 'mantenimiento') {
          <p class="muted tab-panel">El historial de mantenimiento preventivo estará disponible próximamente.</p>
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
  editandoFalla: Falla | null = null;
  abiertaId: number | null = null;
  tab: Pestana = 'registro';
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
  readonly claseEstado = claseEstadoFalla;
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
        contiene(`${f.codigo} ${f.titulo} ${f.descripcion ?? ''} ${f.causa_raiz ?? ''} ${f.ultima_solucion ?? ''} ${f.responsable ?? ''}`, this.q),
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

  async borrarFalla(f: Falla) {
    if (!confirm(`¿Eliminar la falla ${f.codigo}, sus soluciones y fotos?`)) return;
    try {
      await this.api.delete(`/fallas/${f.id}`);
      await this.cargar();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo eliminar la falla');
    }
  }
}
