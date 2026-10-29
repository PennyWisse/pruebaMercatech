import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { PosComponent } from './components/pos/pos.component';
import { SalesListComponent } from './components/sales-list/sales-list.component';

const routes: Routes = [
  { path: 'home', component: HomeComponent },
  { path: 'pos', component: PosComponent },
  { path: 'ventas', component: SalesListComponent },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: '**', redirectTo: 'home' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
