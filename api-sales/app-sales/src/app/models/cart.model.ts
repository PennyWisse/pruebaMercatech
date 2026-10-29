import { Product } from './product.model';

export interface CartItem {
  product: Product;
  quantity: number;
  subtotal: number;
  discountPercent: number; // 0 to 10
  discountAmount: number;
  subtotalWithDiscount: number;
}
