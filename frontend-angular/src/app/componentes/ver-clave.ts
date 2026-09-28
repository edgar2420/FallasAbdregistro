import { AfterViewInit, Directive, ElementRef, OnDestroy, Renderer2, inject } from '@angular/core';

const OJO = '<svg class="icon" aria-hidden="true"><use href="#i-eye"></use></svg>';
const OJO_TACHADO = '<svg class="icon" aria-hidden="true"><use href="#i-eye-off"></use></svg>';

@Directive({ selector: 'input[type=password]' })
export class VerClave implements AfterViewInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly r = inject(Renderer2);
  private observador?: ResizeObserver;
  private quitarClick?: () => void;

  ngAfterViewInit() {
    const input = this.el.nativeElement;
    const padre = input.parentElement;
    if (!padre) return;

    const boton: HTMLButtonElement = this.r.createElement('button');
    this.r.setAttribute(boton, 'type', 'button');
    this.r.addClass(boton, 'ver-clave');
    this.r.addClass(padre, 'con-clave');
    this.r.addClass(input, 'clave-input');
    this.r.insertBefore(padre, boton, input.nextSibling);

    const pintar = () => {
      const visible = input.type === 'text';
      this.r.setProperty(boton, 'innerHTML', visible ? OJO_TACHADO : OJO);
      this.r.setAttribute(boton, 'aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
      this.r.setAttribute(boton, 'title', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
      this.r.setAttribute(boton, 'aria-pressed', String(visible));
    };
    pintar();

    this.quitarClick = this.r.listen(boton, 'click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
      pintar();
      input.focus();
    });

    const ubicar = () => {
      if (!input.offsetHeight) return;
      boton.style.top = `${input.offsetTop}px`;
      boton.style.height = `${input.offsetHeight}px`;
    };
    ubicar();
    this.observador = new ResizeObserver(ubicar);
    this.observador.observe(padre);
  }

  ngOnDestroy() {
    this.observador?.disconnect();
    this.quitarClick?.();
  }
}
