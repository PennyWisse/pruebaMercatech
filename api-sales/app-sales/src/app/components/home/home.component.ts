import { Component, OnInit } from '@angular/core';
import { ProductService } from '../../services/product.service';
import { SaleService } from '../../services/sale.service';
import { Product } from '../../models/product.model';
import { Sale } from '../../models/sale.model';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  productsCount: number = 0;
  salesCount: number = 0;
  totalRevenue: number = 0;
  recentSales: Sale[] = [];
  loading: boolean = false;

  constructor(
    private productService: ProductService,
    private saleService: SaleService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;
    this.productService.getProducts().subscribe({
      next: (products: Product[]) => {
        this.productsCount = products.length;
      },
      error: () => {}
    });

    this.saleService.getSales().subscribe({
      next: (sales: Sale[]) => {
        this.salesCount = sales.length;
        this.totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
        this.recentSales = sales.slice(0, 5);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }
}
