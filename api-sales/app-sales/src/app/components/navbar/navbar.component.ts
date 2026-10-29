import { Component } from '@angular/core';
import { CartService } from '../../services/cart.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent {
  itemCount$: Observable<number>;

  constructor(private cartService: CartService) {
    this.itemCount$ = this.cartService.itemCount$;
  }
}
