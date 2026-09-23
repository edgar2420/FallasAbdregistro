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
import { contiene, fechaCorta } from '../util';

@Component({
  selector: 'app-maquina-detalle-page',
  imports: [FormsModule, RouterLink, FallaDetalle, FallaForm, Galeria, MaquinaForm, Modal],
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

      <section class="module-card">
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
          <div><dt>Consumo de aire</dt><dd>{{ m.consumo_aire || '—' }}</dd></div>
          <div><dt>Presión de vapor</dt><dd>{{ m.presion_vapor || '—' }}</dd></div>
          <div><dt>Consumo de vapor</dt><dd>{{ m.consumo_vapor || '—' }}</dd></div>
          @if (m.notas) {
            <div class="wide"><dt>Notas</dt><dd class="texto">{{ m.notas }}</dd></div>
          }
        </dl>
      </section>

      <section class="module-card">
        <h2>Fotos y documentos</h2>
        <app-galeria [adjuntos]="m.adjuntos ?? []" [maquinaId]="m.id" (cambio)="cargar()" />
      </section>

      <section class="module-card tabla-card">
        <div class="tabla-titulo">
          <h2>Fallas y soluciones</h2>
          <div class="filtros compactos">
            <input type="search" class="buscador" placeholder="Buscar por código, falla o solución"
                   aria-label="Buscar en las fallas de esta máquina" [(ngModel)]="q">
            <select aria-label="Filtrar por categoría" [(ngModel)]="categoria">
              <option value="">Todas las categorías</option>
              @for (c of categorias; track c) {
                <option>{{ c }}</option>
              }
            </select>
            <select aria-label="Filtrar por solución" [(ngModel)]="estado">
              <option value="">Con y sin solución</option>
              <option value="sin">Sin solución</option>
              <option value="con">Con solución</option>
            </select>
          </div>
        </div>
        <div class="tabla-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th class="opcional">Fecha</th>
                <th>Falla / error</th>
                <th class="opcional">Categoría</th>
                <th>Solución aplicada</th>
              </tr>
            </thead>
            <tbody>
              @for (f of fallas; track f.id) {
                <tr class="clicable" tabindex="0" [class.abierta]="abiertaId === f.id"
                    [attr.aria-expanded]="abiertaId === f.id" (click)="alternar(f)" (keydown.enter)="alternar(f)">
                  <td class="codigo">{{ f.codigo }}</td>
                  <td class="fecha opcional">{{ fecha(f.fecha_deteccion, false) }}</td>
                  <td>
                    <strong>{{ f.titulo }}</strong>
                    @if (f.descripcion) { <small class="subline recorte">{{ f.descripcion }}</small> }
                  </td>
                  <td class="opcional">{{ f.categoria }}</td>
                  <td class="solucion-celda">
                    @if (f.ultima_solucion) {
                      <span class="recorte">{{ f.ultima_solucion }}</span>
                    } @else {
                      <span class="pendiente">Sin solución registrada</span>
                    }
                  </td>
                </tr>
                @if (abiertaId === f.id) {
                  <tr class="fila-detalle">
                    <td colspan="5"><app-falla-detalle [fallaId]="f.id" (cambio)="cargar()" /></td>
                  </tr>
                }
              } @empty {
                <tr><td colspan="5" class="muted">
                  {{ (m.fallas?.length ?? 0) ? 'Ninguna falla coincide con la búsqueda' : 'Esta máquina no tiene fallas registradas' }}
                </td></tr>
              }
            </tbody>
          </table>
        </div>
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
  q = '';
  categoria = '';
  estado = '';
  categorias: string[] = [];

  readonly fecha = fechaCorta;

  get fallas(): Falla[] {
    return (this.m?.fallas ?? []).filter(
      (f) =>
        (!this.categoria || f.categoria === this.categoria) &&
        (!this.estado || (this.estado === 'con') === !!f.ultima_solucion) &&
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
      this.error = '';
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo cargar la máquina');
    }
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
