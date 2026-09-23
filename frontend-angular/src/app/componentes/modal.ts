import { AfterViewInit, Component, ElementRef, OnDestroy, input, output, viewChild } from '@angular/core';

/**
 * Ventana modal ancha sobre un <dialog> nativo: mantiene el foco dentro, se cierra con Esc o con la X
 * y no se cierra al hacer clic fuera (para no perder lo escrito en un formulario).
 * Uso: @if (abierto) { <app-modal titulo="..." (cerrar)="abierto = false"> ... </app-modal> }
 */
@Component({
  selector: 'app-modal',
  template: `
    <dialog #dialogo class="modal" [class]="'modal modal-' + tamano()" [attr.aria-labelledby]="idTitulo"
            (cancel)="$event.preventDefault(); cerrar.emit()">
      <header class="modal-head">
        <div>
          @if (subtitulo()) {
            <span class="eyebrow">{{ subtitulo() }}</span>
          }
          <h2 [id]="idTitulo">{{ titulo() }}</h2>
        </div>
        <button class="icon-button" type="button" aria-label="Cerrar" title="Cerrar (Esc)" (click)="cerrar.emit()">
          <svg class="icon" aria-hidden="true"><use href="#i-close"></use></svg>
        </button>
      </header>
      <div class="modal-cuerpo">
        <ng-content />
      </div>
    </dialog>
  `,
})
export class Modal implements AfterViewInit, OnDestroy {
  private static siguiente = 0;
  readonly titulo = input.required<string>();
  readonly subtitulo = input('');
  /** 'mediano' ≈ 720 px, 'ancho' ≈ 1040 px. */
  readonly tamano = input<'mediano' | 'ancho'>('ancho');
  readonly cerrar = output<void>();

  protected readonly idTitulo = `modal-titulo-${++Modal.siguiente}`;
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  ngAfterViewInit() {
    const d = this.dialogo().nativeElement;
    if (!d.open) d.showModal();
    document.body.classList.add('con-modal');
  }

  ngOnDestroy() {
    const d = this.dialogo().nativeElement;
    if (d.open) d.close();
    if (!document.querySelector('dialog.modal[open]')) document.body.classList.remove('con-modal');
  }
}
