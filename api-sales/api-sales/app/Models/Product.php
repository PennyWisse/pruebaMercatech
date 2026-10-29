<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'price',
        'stock',
        'image'
    ];

    protected $casts = [
        'price' => 'float',
        'stock' => 'integer',
    ];

    public function saleDetails(): HasMany
    {
        return $this->hasMany(SaleDetail::class, 'product_id');
    }
}
