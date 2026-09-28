import { Component, HostListener, OnChanges, OnDestroy, SimpleChanges, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../api';
import { LIMITES } from '../limites';
import { Adjunto } from '../modelos';
import { fechaCorta, tamano } from '../util';

const MAX_BYTES = LIMITES.adjunto.mb * 1024 * 1024;
const LADO_MAX = 2000;
const CATEGORIAS = ['Eléctrica', 'Electrónica', 'Mecánica', 'Ficha técnica', 'Otra'];
const ETIQUETAS: Record<string, string> = {
  Eléctrica: 'Eléctrico',
  Electrónica: 'Electrónico',
  Mecánica: 'Mecánico',
  'Ficha técnica': 'Ficha técnica',
  Otra: 'Otros',
};

function leer(archivo: Blob): Promise<string> {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => mal(new Error('No se pudo leer el archivo'));
    r.readAsDataURL(archivo);
  });
}

async function prepararArchivo(archivo: File): Promise<string> {
  if (archivo.type === 'application/pdf') {
    if (archivo.size > MAX_BYTES) throw new Error(`${archivo.name} supera el máximo de ${LIMITES.adjunto.mb} MB`);
    return leer(archivo);
  }
  if (!archivo.type.startsWith('image/')) throw new Error(`${archivo.name}: sólo se aceptan fotos o PDF`);
  let imagen: ImageBitmap;
  try {
    imagen = await createImageBitmap(archivo);
  } catch {
    throw new Error(`${archivo.name}: formato de imagen no soportado (usa JPG, PNG o WEBP)`);
  }
  const escala = Math.min(1, LADO_MAX / Math.max(imagen.width, imagen.height));
  if (escala === 1 && archivo.size <= 1.5 * 1024 * 1024 && /jpeg|png|webp/.test(archivo.type)) {
    imagen.close();
    return leer(archivo);
  }
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext('2d')!.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close();
  return lienzo.toDataURL('image/jpeg', 0.85);
}

@Component({
  selector: 'app-galeria',
  imports: [FormsModule],
  template: `
    <div class="galeria-barra">
      @if (conPestanas()) {
        <div class="filtro-texto" role="tablist" aria-label="Categorías">
          @for (c of pestanasVisibles; track c) {
            <button type="button" role="tab" [class.activa]="pestana === c" [attr.aria-selected]="pestana === c"
                    (click)="pestana = c">
              {{ etiqueta(c) }}@if (cuenta(c)) {<span>{{ cuenta(c) }}</span>}
            </button>
          }
        </div>
      }
      <span class="galeria-cupo" [class.lleno]="lleno" [title]="'Máximo ' + maximo() + ' archivos'">
        {{ adjuntos().length }} / {{ maximo() }}
      </span>
    </div>

    @if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    }

    <div class="miniaturas">
      @for (a of visibles; track a.id) {
        <div class="mini">
          <button type="button" class="mini-btn" [title]="titulo(a)" [attr.aria-label]="'Ver ' + titulo(a)" (click)="abrir(a)">
            @if (a.mime === 'application/pdf') {
              <span class="mini-pdf">PDF</span>
            } @else if (urls.get(a.id); as url) {
              <img [src]="url" [alt]="titulo(a)" loading="lazy">
            } @else {
              <span class="mini-pdf">…</span>
            }
          </button>
          @if (api.esAdmin()) {
            <button type="button" class="mini-quitar" title="Quitar" [attr.aria-label]="'Quitar ' + titulo(a)"
                    (click)="borrar(a)">
              <svg class="icon" aria-hidden="true"><use href="#i-close"></use></svg>
            </button>
          }
        </div>
      }
      @if (api.esAdmin()) {
        <label class="mini mini-agregar" [class.deshabilitado]="subiendo || lleno"
               [title]="lleno ? 'Se alcanzó el máximo de ' + maximo() + ' archivos' : 'Agregar a ' + etiqueta(destino)">
          @if (subiendo) {
            <span>Subiendo…</span>
          } @else {
            <svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg>
            <span>{{ lleno ? 'Lleno' : etiqueta(destino) }}</span>
          }
          <input type="file" hidden multiple [disabled]="subiendo || lleno"
                 accept="image/jpeg,image/png,image/webp,application/pdf" (change)="subir($event)">
        </label>
      } @else if (!visibles.length) {
        <p class="sin-fotos">Sin fotos ni documentos{{ pestana === 'Todas' ? '' : ' en ' + etiqueta(pestana) }}.</p>
      }
    </div>

    @if (abierta; as a) {
      <div class="lightbox" role="dialog" aria-modal="true" [attr.aria-label]="titulo(a)" (click)="abierta = null">
        <div class="lightbox-body" (click)="$event.stopPropagation()">
          <img [src]="urls.get(a.id)" [alt]="titulo(a)">
          <div class="lightbox-info">
            @if (api.esAdmin()) {
              <input class="lightbox-desc" aria-label="Descripción" placeholder="Agregar descripción…"
                     [maxlength]="L.descripcion" [ngModel]="a.descripcion" (change)="describir(a, $any($event.target).value)">
            } @else {
              <strong>{{ a.descripcion || a.nombre_original || 'Sin descripción' }}</strong>
            }
            <small class="subline">
              {{ etiqueta(a.categoria) }}{{ a.falla_codigo ? ' · ' + a.falla_codigo : '' }} ·
              {{ fecha(a.creado_en) }} · {{ peso(a.bytes) }}
            </small>
            <div class="row-actions">
              @if (api.esAdmin()) {
                <select aria-label="Categoría" [ngModel]="a.categoria" (ngModelChange)="recategorizar(a, $event)">
                  @for (c of categorias; track c) {
                    <option [value]="c">{{ etiqueta(c) }}</option>
                  }
                </select>
                <button type="button" class="danger" (click)="borrar(a)">Quitar</button>
              }
              <button type="button" (click)="abierta = null">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class Galeria implements OnChanges, OnDestroy {
  protected readonly api = inject(Api);

  readonly adjuntos = input<Adjunto[]>([]);
  readonly maquinaId = input<number | null>(null);
  readonly fallaId = input<number | null>(null);
  readonly categoriaInicial = input('Otra');
  readonly conPestanas = input(true);
  readonly maximo = input<number>(LIMITES.adjunto.por_maquina);
  readonly cambio = output<void>();

  readonly L = LIMITES.adjunto;
  readonly categorias = CATEGORIAS;
  readonly urls = new Map<number, string>();
  pestana = 'Todas';
  abierta: Adjunto | null = null;
  subiendo = false;
  error = '';

  readonly fecha = fechaCorta;
  readonly peso = tamano;

  get pestanasVisibles() {
    return ['Todas', ...CATEGORIAS.filter((c) => this.api.esAdmin() || this.cuenta(c))];
  }

  get visibles() {
    const todos = this.adjuntos();
    return this.pestana === 'Todas' ? todos : todos.filter((a) => a.categoria === this.pestana);
  }

  get destino() {
    return this.pestana === 'Todas' ? this.categoriaInicial() : this.pestana;
  }

  get lleno() {
    return this.adjuntos().length >= this.maximo();
  }

  etiqueta(c: string) {
    return ETIQUETAS[c] ?? c;
  }

  titulo(a: Adjunto) {
    return a.descripcion || a.nombre_original || `${this.etiqueta(a.categoria)} · ${fechaCorta(a.creado_en)}`;
  }

  cuenta(c: string) {
    return c === 'Todas' ? this.adjuntos().length : this.adjuntos().filter((a) => a.categoria === c).length;
  }

  ngOnChanges(cambios: SimpleChanges) {
    if (cambios['adjuntos']) void this.cargarMiniaturas();
  }

  ngOnDestroy() {
    this.urls.forEach((url) => URL.revokeObjectURL(url));
  }

  @HostListener('document:keydown.escape')
  cerrar() {
    this.abierta = null;
  }

  private async cargarMiniaturas() {
    const vigentes = new Set(this.adjuntos().map((a) => a.id));
    for (const [id, url] of this.urls) {
      if (!vigentes.has(id)) {
        URL.revokeObjectURL(url);
        this.urls.delete(id);
      }
    }
    for (const a of this.adjuntos()) {
      if (!a.mime.startsWith('image/') || this.urls.has(a.id)) continue;
      try {
        this.urls.set(a.id, URL.createObjectURL(await this.api.blob(`/adjuntos/${a.id}/archivo`)));
      } catch {
      }
    }
  }

  async abrir(a: Adjunto) {
    if (a.mime.startsWith('image/')) {
      this.abierta = a;
      return;
    }
    const ventana = window.open('', '_blank');
    try {
      const url = URL.createObjectURL(await this.api.blob(`/adjuntos/${a.id}/archivo`));
      if (ventana) ventana.location.href = url;
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: unknown) {
      ventana?.close();
      this.error = Api.mensaje(e, 'No se pudo abrir el documento');
    }
  }

  async subir(evento: Event) {
    const campo = evento.target as HTMLInputElement;
    const archivos = Array.from(campo.files ?? []);
    campo.value = '';
    if (!archivos.length) return;
    const libres = this.maximo() - this.adjuntos().length;
    if (archivos.length > libres) {
      this.error = `Sólo puedes agregar ${libres} archivo${libres === 1 ? '' : 's'} más (máximo ${this.maximo()}).`;
      return;
    }
    this.subiendo = true;
    this.error = '';
    const categoria = this.destino;
    try {
      for (const archivo of archivos) {
        await this.api.post('/adjuntos', {
          maquina_id: this.maquinaId(),
          falla_id: this.fallaId(),
          categoria,
          nombre: archivo.name,
          datos: await prepararArchivo(archivo),
        });
      }
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo subir el archivo');
    } finally {
      this.subiendo = false;
      this.cambio.emit();
    }
  }

  async describir(a: Adjunto, descripcion: string) {
    try {
      await this.api.patch(`/adjuntos/${a.id}`, { descripcion });
      a.descripcion = descripcion.trim() || null;
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo guardar la descripción');
    }
  }

  async recategorizar(a: Adjunto, categoria: string) {
    try {
      await this.api.patch(`/adjuntos/${a.id}`, { categoria });
      a.categoria = categoria;
      this.cambio.emit();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo cambiar la categoría');
    }
  }

  async borrar(a: Adjunto) {
    const que = a.mime === 'application/pdf' ? 'este documento' : 'esta foto';
    if (!confirm(`¿Quitar ${que}${a.descripcion ? ` («${a.descripcion}»)` : ''}? No se puede deshacer.`)) return;
    try {
      await this.api.delete(`/adjuntos/${a.id}`);
      this.abierta = null;
      this.cambio.emit();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo borrar el archivo');
    }
  }
}
