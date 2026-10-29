<?php

namespace App\Http\Controllers\Api;

use App\Models\Product;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;

class ProductController extends Controller
{
    //
    public function index()
    {
        $products = Product::select('id', 'name', 'price', 'stock', 'image')->get();

        return response()->json($products, 200);
    }
}
