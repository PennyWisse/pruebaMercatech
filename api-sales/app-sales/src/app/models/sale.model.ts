export interface SaleItemPayload {
  product_id: number;
  quantity: number;
  discount_percent?: number;
}

export interface CreateSaleRequest {
  user_id: number;
  items: SaleItemPayload[];
}

export interface CreateSaleResponse {
  message: string;
  sale_id: number;
  total: number;
  total_discount?: number;
}

export interface SaleDetail {
  id?: number;
  product_id?: number;
  product: string;
  quantity: number;
  price?: number;
  subtotal: number;
  discount_percent?: number;
  discount_amount?: number;
  subtotal_with_discount?: number;
}

export interface Sale {
  id: number;
  total: number;
  total_discount?: number;
  created_at: string;
  details: SaleDetail[];
}
