import { Injectable } from '@angular/core';
import * as Toastify from 'toastify-js';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  success(message: string): void {
    Toastify({
      text: message,
      duration: 3500,
      close: true,
      gravity: 'top',
      position: 'right',
      style: {
        background: 'linear-gradient(to right, #00b09b, #96c93d)',
        borderRadius: '8px',
        fontWeight: 'bold',
      }
    }).showToast();
  }

  error(message: string): void {
    Toastify({
      text: message,
      duration: 4000,
      close: true,
      gravity: 'top',
      position: 'right',
      style: {
        background: 'linear-gradient(to right, #e53935, #e35d5b)',
        borderRadius: '8px',
        fontWeight: 'bold',
      }
    }).showToast();
  }

  info(message: string): void {
    Toastify({
      text: message,
      duration: 3000,
      close: true,
      gravity: 'top',
      position: 'right',
      style: {
        background: 'linear-gradient(to right, #2193b0, #6dd5ed)',
        borderRadius: '8px',
      }
    }).showToast();
  }
}
