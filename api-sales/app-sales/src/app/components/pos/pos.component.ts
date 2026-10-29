import { Component, OnInit, OnDestroy } from '@angular/core';
import { ProductService } from '../../services/product.service';
import { SaleService } from '../../services/sale.service';
import { CartService } from '../../services/cart.service';
import { NotificationService } from '../../services/notification.service';
import { Product } from '../../models/product.model';
import { CartItem } from '../../models/cart.model';
import { Observable, Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-pos',
  templateUrl: './pos.component.html',
  styleUrls: ['./pos.component.scss']
})
export class PosComponent implements OnInit, OnDestroy {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  searchTerm: string = '';
  loadingProducts: boolean = false;
  submittingSale: boolean = false;

  cartItems: CartItem[] = [];
  private cartSub!: Subscription;

  cartItems$: Observable<CartItem[]>;
  total$: Observable<number>;
  totalDiscount$: Observable<number>;
  subtotalBeforeDiscount$: Observable<number>;
  itemCount$: Observable<number>;

  constructor(
    private productService: ProductService,
    private saleService: SaleService,
    public cartService: CartService,
    private notificationService: NotificationService
  ) {
    this.cartItems$ = this.cartService.items$;
    this.total$ = this.cartService.total$;
    this.totalDiscount$ = this.cartService.totalDiscount$;
    this.subtotalBeforeDiscount$ = this.cartService.subtotalBeforeDiscount$;
    this.itemCount$ = this.cartService.itemCount$;
  }

  ngOnInit(): void {
    this.cartSub = this.cartService.items$.subscribe(items => {
      this.cartItems = items;
    });
    this.loadProducts();
  }

  ngOnDestroy(): void {
    if (this.cartSub) {
      this.cartSub.unsubscribe();
    }
  }

  loadProducts(): void {
    this.loadingProducts = true;
    this.productService.getProducts().subscribe({
      next: (data) => {
        this.products = data;
        this.filterProducts();
        this.loadingProducts = false;
      },
      error: () => {
        this.loadingProducts = false;
        this.notificationService.error('Error al cargar la lista de productos.');
      }
    });
  }

  filterProducts(): void {
    if (!this.searchTerm.trim()) {
      this.filteredProducts = [...this.products];
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredProducts = this.products.filter(p =>
        p.name.toLowerCase().includes(term) || p.id.toString() === term
      );
    }
  }

  /**
   * Calcula el stock disponible en tiempo real restando lo que está en el carrito.
   */
  getAvailableStock(product: Product): number {
    const inCart = this.cartItems.find(i => i.product.id === product.id)?.quantity || 0;
    return Math.max(0, product.stock - inCart);
  }

  /**
   * Obtiene la cantidad de este producto que ya está en el carrito.
   */
  getQuantityInCart(productId: number): number {
    return this.cartItems.find(i => i.product.id === productId)?.quantity || 0;
  }

  addToCart(product: Product): void {
    const available = this.getAvailableStock(product);
    if (available <= 0) {
      this.notificationService.error(`No queda más stock disponible de "${product.name}".`);
      return;
    }
    this.cartService.addItem(product, 1);
  }

  updateQuantity(item: CartItem, change: number): void {
    if (change > 0 && this.getAvailableStock(item.product) <= 0) {
      this.notificationService.error(`Stock máximo alcanzado para "${item.product.name}".`);
      return;
    }
    const newQty = item.quantity + change;
    this.cartService.updateQuantity(item.product.id, newQty);
  }

  onDiscountChange(item: CartItem, event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = parseFloat(input.value) || 0;
    if (val < 0) val = 0;
    if (val > 10) val = 10;
    input.value = val.toString();
    this.cartService.updateDiscount(item.product.id, val);
  }

  removeItem(productId: number): void {
    this.cartService.removeItem(productId);
  }

  clearCart(): void {
    if (this.cartService.getItems().length === 0) return;

    Swal.fire({
      title: '¿Vaciar carrito?',
      text: 'Se liberará el stock asignado en la orden.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, vaciar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.cartService.clearCart();
      }
    });
  }

  checkout(): void {
    const cartItems = this.cartService.getItems();
    if (cartItems.length === 0) {
      this.notificationService.error('El carrito de compras está vacío.');
      return;
    }

    this.submittingSale = true;

    const payload = {
      user_id: 1, // Usuario estático requerido en README.md
      items: cartItems.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        discount_percent: item.discountPercent
      }))
    };

    this.saleService.createSale(payload).subscribe({
      next: (res) => {
        this.submittingSale = false;

        const discountMsg = (res.total_discount && res.total_discount > 0)
          ? `<div class="mt-2 text-success small fw-bold"><i class="ri-price-tag-3-line"></i> Ahorro total con descuento: -$${res.total_discount.toFixed(2)}</div>`
          : '';

        Swal.fire({
          title: '¡Venta Registrada con Éxito!',
          html: `
            <div class="py-2 text-center">
              <p class="text-muted mb-1">Comprobante de Venta <strong>#${res.sale_id}</strong></p>
              <div class="display-6 fw-bold text-primary my-2">$${res.total.toFixed(2)}</div>
              ${discountMsg}
              <div class="smaller text-muted mt-2">La base de datos y el inventario fueron actualizados correctamente.</div>
            </div>
          `,
          icon: 'success',
          confirmButtonColor: '#2563eb',
          confirmButtonText: 'Aceptar'
        });

        this.cartService.clearCart();
        this.loadProducts(); // Actualizar base de datos y catálogo
      },
      error: (err) => {
        this.submittingSale = false;
        const msg = err.error?.message || 'Error al procesar la venta. Verifique el stock disponible.';
        Swal.fire({
          title: 'No se pudo procesar la venta',
          text: msg,
          icon: 'error',
          confirmButtonColor: '#ef4444'
        });
      }
    });
  }
}
