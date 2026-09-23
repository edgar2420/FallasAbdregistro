import { Component, inject } from '@angular/core';
import { Api } from '../api';
import { CambiarPassword } from '../componentes/cambiar-password';

@Component({
  selector: 'app-cuenta-page',
  imports: [CambiarPassword],
  template: `
    <span class="eyebrow">Mi cuenta</span>
    <h1>{{ api.usuario()?.nombre }}</h1>
    <p class="muted-left">
      Usuario <b>{{ api.usuario()?.email }}</b> · {{ api.esAdmin() ? 'Administrador' : 'Operador (sólo consulta)' }}
    </p>
    <section class="module-card cuenta-card">
      <h2>Cambiar contraseña</h2>
      <app-cambiar-password />
    </section>
  `,
})
export class CuentaPage {
  protected readonly api = inject(Api);
}
