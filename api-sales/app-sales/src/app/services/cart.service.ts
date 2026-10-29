import { Injectable } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';
import { CartItem } from '../models/cart.model';
import { Product } from '../models/product.model';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private itemsSubject = new BehaviorSubject<CartItem[]>([]);
  public items$ = this.itemsSubject.asObservable();

  public total$ = this.items$.pipe(
    map(items => items.reduce((acc, item) => acc + item.subtotalWithDiscount, 0))
  );

  public subtotalBeforeDiscount$ = this.items$.pipe(
    map(items => items.reduce((acc, item) => acc + item.subtotal, 0))
  );

  public totalDiscount$ = this.items$.pipe(
    map(items => items.reduce((acc, item) => acc + item.discountAmount, 0))
  );

  public itemCount$ = this.items$.pipe(
    map(items => items.reduce((acc, item) => acc + item.quantity, 0))
  );

  constructor(private notificationService: NotificationService) {}

  getItems(): CartItem[] {
    return this.itemsSubject.getValue();
  }

  private calculateItemValues(price: number, quantity: number, discountPercent: number): {
    subtotal: number;
    discountAmount: number;
    subtotalWithDiscount: number;
  } {
    const rawSubtotal = Math.round(price * quantity * 100) / 100;
    const discountAmount = Math.round(rawSubtotal * (discountPercent / 100) * 100) / 100;
    const subtotalWithDiscount = Math.round((rawSubtotal - discountAmount) * 100) / 100;

    return {
      subtotal: rawSubtotal,
      discountAmount,
      subtotalWithDiscount
    };
  }

  addItem(product: Product, quantity: number = 1, discountPercent: number = 0): void {
    if (product.stock <= 0) {
      this.notificationService.error(`El producto "${product.name}" no tiene stock disponible.`);
      return;
    }

    const currentItems = [...this.itemsSubject.getValue()];
    const existingIndex = currentItems.findIndex(i => i.product.id === product.id);

    if (existingIndex > -1) {
      const item = currentItems[existingIndex];
      const newQuantity = item.quantity + quantity;
      if (newQuantity > product.stock) {
        this.notificationService.error(`Solo hay ${product.stock} unidades disponibles de "${product.name}".`);
        return;
      }
      item.quantity = newQuantity;
      const values = this.calculateItemValues(product.price, newQuantity, item.discountPercent);
      item.subtotal = values.subtotal;
      item.discountAmount = values.discountAmount;
      item.subtotalWithDiscount = values.subtotalWithDiscount;
    } else {
      if (quantity > product.stock) {
        this.notificationService.error(`Solo hay ${product.stock} unidades disponibles de "${product.name}".`);
        return;
      }
      const values = this.calculateItemValues(product.price, quantity, discountPercent);
      currentItems.push({
        product,
        quantity,
        discountPercent,
        subtotal: values.subtotal,
        discountAmount: values.discountAmount,
        subtotalWithDiscount: values.subtotalWithDiscount
      });
    }

    this.itemsSubject.next(currentItems);
    this.notificationService.success(`"${product.name}" agregado al carrito.`);
  }

  updateQuantity(productId: number, quantity: number): void {
    const currentItems = [...this.itemsSubject.getValue()];
    const index = currentItems.findIndex(i => i.product.id === productId);

    if (index === -1) return;

    const item = currentItems[index];

    if (quantity <= 0) {
      this.removeItem(productId);
      return;
    }

    if (quantity > item.product.stock) {
      this.notificationService.error(`Stock máximo alcanzado (${item.product.stock}) para "${item.product.name}".`);
      return;
    }

    item.quantity = quantity;
    const values = this.calculateItemValues(item.product.price, quantity, item.discountPercent);
    item.subtotal = values.subtotal;
    item.discountAmount = values.discountAmount;
    item.subtotalWithDiscount = values.subtotalWithDiscount;

    this.itemsSubject.next(currentItems);
  }

  updateDiscount(productId: number, discountPercent: number): void {
    const currentItems = [...this.itemsSubject.getValue()];
    const index = currentItems.findIndex(i => i.product.id === productId);

    if (index === -1) return;

    let validPercent = Math.max(0, Math.min(10, Number(discountPercent) || 0));
    validPercent = Math.round(validPercent * 100) / 100;

    const item = currentItems[index];
    item.discountPercent = validPercent;
    const values = this.calculateItemValues(item.product.price, item.quantity, validPercent);
    item.subtotal = values.subtotal;
    item.discountAmount = values.discountAmount;
    item.subtotalWithDiscount = values.subtotalWithDiscount;

    this.itemsSubject.next(currentItems);
  }

  removeItem(productId: number): void {
    const currentItems = this.itemsSubject.getValue().filter(i => i.product.id !== productId);
    this.itemsSubject.next(currentItems);
    this.notificationService.info('Producto removido del carrito.');
  }

  clearCart(): void {
    this.itemsSubject.next([]);
  }
}
