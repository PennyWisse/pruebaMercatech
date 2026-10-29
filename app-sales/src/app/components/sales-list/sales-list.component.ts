import { Component, OnInit } from '@angular/core';
import { SaleService } from '../../services/sale.service';
import { NotificationService } from '../../services/notification.service';
import { Sale } from '../../models/sale.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-sales-list',
  templateUrl: './sales-list.component.html',
  styleUrls: ['./sales-list.component.scss']
})
export class SalesListComponent implements OnInit {
  sales: Sale[] = [];
  loading: boolean = false;
  deletingId: number | null = null;
  selectedSale: Sale | null = null;

  constructor(
    private saleService: SaleService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadSales();
  }

  loadSales(): void {
    this.loading = true;
    this.saleService.getSales().subscribe({
      next: (data) => {
        this.sales = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.notificationService.error('Error al obtener el historial de ventas.');
      }
    });
  }

  openDetailModal(sale: Sale): void {
    this.selectedSale = sale;
  }

  closeDetailModal(): void {
    this.selectedSale = null;
  }

  confirmDelete(sale: Sale): void {
    const totalUnits = sale.details.reduce((acc, d) => acc + d.quantity, 0);

    const itemsListHtml = sale.details.map(d => `
      <li class="d-flex justify-content-between align-items-center py-2 px-3 border-bottom border-light">
        <span class="fw-semibold text-dark text-start">
          <i class="ri-checkbox-circle-fill text-primary me-2"></i>${d.product}
        </span>
        <span class="badge badge-soft-primary px-3 py-1 fs-7">
          +${d.quantity} ${d.quantity === 1 ? 'unidad' : 'unidades'}
        </span>
      </li>
    `).join('');

    Swal.fire({
      title: '¿Confirmar Anulación de Venta?',
      html: `
        <div class="text-start py-1">
          <p class="mb-3 text-secondary">
            Al anular la <strong>Venta #${sale.id}</strong>, se restaurará el stock de estos elementos al stock actual:
          </p>

          <div class="card border rounded-3 mb-3 bg-light overflow-hidden shadow-none">
            <div class="card-header bg-white py-2 px-3 border-bottom fw-bold text-muted smaller text-uppercase d-flex justify-content-between">
              <span><i class="ri-archive-line text-primary me-1"></i> Producto</span>
              <span>Cantidad a Reponer</span>
            </div>
            <ul class="list-unstyled mb-0 bg-white">
              ${itemsListHtml}
            </ul>
            <div class="card-footer bg-light py-2 px-3 d-flex justify-content-between align-items-center fw-bold">
              <span class="text-dark">Total de unidades a restaurar:</span>
              <span class="badge bg-success rounded-pill px-3 py-2 fs-6">+${totalUnits} en total</span>
            </div>
          </div>

          <div class="alert alert-info py-2 px-3 mb-0 smaller d-flex align-items-center gap-2">
            <i class="ri-information-line fs-5 text-primary"></i>
            <span>Se revertirá el monto de <strong>$${sale.total.toFixed(2)}</strong> y el stock se repondrá en la base de datos de inmediato.</span>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: '<i class="ri-delete-bin-line me-1"></i> Sí, anular y reponer stock',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      focusCancel: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.deletingId = sale.id;

        this.saleService.deleteSale(sale.id).subscribe({
          next: (res) => {
            this.deletingId = null;

            // Actualización inmediata en vivo sin recargar la página
            this.sales = this.sales.filter(s => s.id !== sale.id);

            Swal.fire({
              title: '¡Venta Anulada Exitosamente!',
              html: `
                <div class="text-center py-2">
                  <p class="mb-2">La venta <strong>#${sale.id}</strong> ha sido eliminada.</p>
                  <div class="badge bg-success-subtle text-success p-2 rounded-3 fw-bold fs-7">
                    <i class="ri-check-line me-1"></i> Se repusieron +${totalUnits} unidades al stock actual en la base de datos
                  </div>
                </div>
              `,
              icon: 'success',
              confirmButtonColor: '#2563eb',
              timer: 3500
            });
          },
          error: (err) => {
            this.deletingId = null;
            const msg = err.error?.message || 'Error al eliminar la venta.';
            Swal.fire({
              title: 'No se pudo anular la venta',
              text: msg,
              icon: 'error',
              confirmButtonColor: '#ef4444'
            });
          }
        });
      }
    });
  }
}
