import { Component, HostListener, OnChanges, OnDestroy, SimpleChanges, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../api';
import { Adjunto } from '../modelos';
import { fechaCorta, tamano } from '../util';

const MAX_BYTES = 8 * 1024 * 1024;
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

/** Las fotos del celular se reducen a 2000 px en JPEG antes de subirlas. */
async function prepararArchivo(archivo: File): Promise<string> {
  if (archivo.type === 'application/pdf') {
    if (archivo.size > MAX_BYTES) throw new Error(`${archivo.name} supera el máximo de 8 MB`);
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
    @if (conPestanas()) {
      <div class="tabs" role="tablist" aria-label="Categorías de fotos">
        @for (c of pestanas; track c) {
          <button type="button" role="tab" [class.active]="pestana === c"
                  [attr.aria-selected]="pestana === c" (click)="pestana = c">
            {{ etiqueta(c) }} <span class="count">{{ cuenta(c) }}</span>
          </button>
        }
      </div>
    }

    @if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    }

    <div class="galeria-grid">
      @for (a of visibles; track a.id) {
        <figure class="foto">
          <button type="button" class="foto-btn" (click)="abrir(a)"
                  [attr.aria-label]="'Ver ' + (a.descripcion || a.nombre_original || 'archivo')">
            @if (a.mime === 'application/pdf') {
              <span class="foto-pdf">PDF</span>
            } @else if (urls.get(a.id); as url) {
              <img [src]="url" [alt]="a.descripcion || a.categoria" loading="lazy">
            } @else {
              <span class="foto-pdf">…</span>
            }
          </button>
          <figcaption>
            <span class="tag">{{ etiqueta(a.categoria) }}</span>
            @if (a.falla_codigo && !fallaId()) {
              <span class="tag">{{ a.falla_codigo }}</span>
            }
            <small>{{ a.descripcion || a.nombre_original || fecha(a.creado_en) }}</small>
          </figcaption>
        </figure>
      } @empty {
        <p class="muted">Sin fotos ni documentos{{ pestana === 'Todas' ? '' : ' en ' + etiqueta(pestana) }}</p>
      }
    </div>

    @if (api.esAdmin()) {
      <div class="subida">
        <select aria-label="Categoría del archivo" [(ngModel)]="nueva.categoria">
          @for (c of categorias; track c) {
            <option [value]="c">{{ etiqueta(c) }}</option>
          }
        </select>
        <input aria-label="Descripción del archivo" placeholder="Descripción (opcional)"
               [(ngModel)]="nueva.descripcion">
        <label class="primary file-btn" [class.disabled]="subiendo">
          {{ subiendo ? 'Subiendo…' : 'Subir fotos o PDF' }}
          <input type="file" hidden multiple [disabled]="subiendo"
                 accept="image/jpeg,image/png,image/webp,application/pdf" (change)="subir($event)">
        </label>
      </div>
    }

    @if (abierta; as a) {
      <div class="lightbox" role="dialog" aria-modal="true" [attr.aria-label]="a.descripcion || 'Foto'"
           (click)="abierta = null">
        <div class="lightbox-body" (click)="$event.stopPropagation()">
          <img [src]="urls.get(a.id)" [alt]="a.descripcion || a.categoria">
          <div class="lightbox-info">
            <div>
              <strong>{{ a.descripcion || a.nombre_original || 'Sin descripción' }}</strong>
              <small class="subline">
                {{ etiqueta(a.categoria) }}{{ a.falla_codigo ? ' · ' + a.falla_codigo : '' }} ·
                {{ fecha(a.creado_en) }} · {{ peso(a.bytes) }}{{ a.subido_por_nombre ? ' · ' + a.subido_por_nombre : '' }}
              </small>
            </div>
            <div class="row-actions">
              @if (api.esAdmin()) {
                <select aria-label="Cambiar categoría" [ngModel]="a.categoria" (ngModelChange)="recategorizar(a, $event)">
                  @for (c of categorias; track c) {
                    <option [value]="c">{{ etiqueta(c) }}</option>
                  }
                </select>
                <button type="button" class="danger" (click)="borrar(a)">Borrar</button>
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
  readonly cambio = output<void>();

  readonly categorias = CATEGORIAS;
  readonly pestanas = ['Todas', ...CATEGORIAS];
  readonly urls = new Map<number, string>();
  pestana = 'Todas';
  abierta: Adjunto | null = null;
  subiendo = false;
  error = '';
  nueva = { categoria: 'Otra', descripcion: '' };

  readonly fecha = fechaCorta;
  readonly peso = tamano;

  get visibles() {
    const todos = this.adjuntos();
    return this.pestana === 'Todas' ? todos : todos.filter((a) => a.categoria === this.pestana);
  }

  etiqueta(c: string) {
    return ETIQUETAS[c] ?? c;
  }

  cuenta(c: string) {
    return c === 'Todas' ? this.adjuntos().length : this.adjuntos().filter((a) => a.categoria === c).length;
  }

  ngOnChanges(cambios: SimpleChanges) {
    if (cambios['categoriaInicial']) this.nueva.categoria = this.categoriaInicial();
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
        /* la miniatura queda como marcador */
      }
    }
  }

  async abrir(a: Adjunto) {
    if (a.mime.startsWith('image/')) {
      this.abierta = a;
      return;
    }
    // La ventana se abre antes de la descarga para que el navegador no la bloquee.
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
    this.subiendo = true;
    this.error = '';
    try {
      for (const archivo of archivos) {
        await this.api.post('/adjuntos', {
          maquina_id: this.maquinaId(),
          falla_id: this.fallaId(),
          categoria: this.nueva.categoria,
          descripcion: this.nueva.descripcion,
          nombre: archivo.name,
          datos: await prepararArchivo(archivo),
        });
      }
      this.nueva.descripcion = '';
      if (this.conPestanas()) this.pestana = this.nueva.categoria;
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo subir el archivo');
    } finally {
      this.subiendo = false;
      this.cambio.emit();
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
    if (!confirm('¿Borrar este archivo? No se puede deshacer.')) return;
    try {
      await this.api.delete(`/adjuntos/${a.id}`);
      this.abierta = null;
      this.cambio.emit();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo borrar el archivo');
    }
  }
}
