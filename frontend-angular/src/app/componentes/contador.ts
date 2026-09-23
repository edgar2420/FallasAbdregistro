import { AfterViewInit, Directive, DoCheck, ElementRef, Renderer2, inject } from '@angular/core';

/** Muestra "usados / máximo" debajo de cada área de texto con límite de caracteres. */
@Directive({ selector: 'textarea[maxlength]' })
export class Contador implements AfterViewInit, DoCheck {
  private readonly el = inject<ElementRef<HTMLTextAreaElement>>(ElementRef);
  private readonly r = inject(Renderer2);
  private marca?: HTMLElement;
  private ultimo = '';

  ngAfterViewInit() {
    const area = this.el.nativeElement;
    this.marca = this.r.createElement('small');
    this.r.addClass(this.marca, 'contador-car');
    this.r.setAttribute(this.marca, 'aria-live', 'polite');
    this.r.insertBefore(area.parentElement, this.marca, area.nextSibling);
    this.ngDoCheck();
  }

  /** ngModel escribe el valor sin disparar eventos: se revisa en cada detección de cambios. */
  ngDoCheck() {
    const area = this.el.nativeElement;
    if (!this.marca || area.maxLength <= 0) return;
    const texto = `${area.value.length} / ${area.maxLength}`;
    if (texto === this.ultimo) return;
    this.ultimo = texto;
    this.r.setProperty(this.marca, 'textContent', texto);
    this.r.setAttribute(this.marca, 'data-casi', String(area.value.length >= area.maxLength * 0.9));
  }
}
