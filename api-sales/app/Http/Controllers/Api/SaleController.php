<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleDetail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class SaleController extends Controller
{
    /**
     * List all sales with their item details, discounts and totals.
     *
     * @return JsonResponse
     */
    public function index(): JsonResponse
    {
        $sales = Sale::with(['details.product'])
            ->orderBy('id', 'desc')
            ->get();

        $response = $sales->map(function (Sale $sale) {
            return [
                'id' => $sale->id,
                'total' => (float) $sale->total,
                'total_discount' => (float) ($sale->total_discount ?? 0),
                'created_at' => $sale->created_at ? $sale->created_at->format('Y-m-d H:i:s') : null,
                'details' => $sale->details->map(function (SaleDetail $detail) {
                    return [
                        'id' => $detail->id,
                        'product_id' => $detail->product_id,
                        'product' => $detail->product ? $detail->product->name : 'Producto no disponible',
                        'quantity' => (int) $detail->quantity,
                        'price' => (float) $detail->price,
                        'subtotal' => (float) $detail->subtotal,
                        'discount_percent' => (float) ($detail->discount_percent ?? 0),
                        'discount_amount' => (float) ($detail->discount_amount ?? 0),
                        'subtotal_with_discount' => (float) ($detail->subtotal_with_discount ?? $detail->subtotal),
                    ];
                }),
            ];
        });

        return response()->json($response, 200);
    }

    /**
     * Create a new sale with item details, optional discounts, and stock deduction.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|integer|exists:users,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.discount_percent' => 'nullable|numeric|min:0|max:10',
        ], [
            'user_id.required' => 'El id de usuario es obligatorio.',
            'user_id.exists' => 'El usuario especificado no existe.',
            'items.required' => 'Debe incluir al menos un producto en la venta.',
            'items.array' => 'El formato de productos no es válido.',
            'items.min' => 'La venta debe contener al menos un producto.',
            'items.*.product_id.required' => 'El producto es obligatorio.',
            'items.*.product_id.exists' => 'Uno de los productos seleccionados no existe.',
            'items.*.quantity.required' => 'La cantidad es obligatoria.',
            'items.*.quantity.min' => 'La cantidad de cada producto debe ser mayor a cero.',
            'items.*.discount_percent.numeric' => 'El porcentaje de descuento debe ser un valor numérico.',
            'items.*.discount_percent.min' => 'El descuento no puede ser menor a 0%.',
            'items.*.discount_percent.max' => 'El descuento por producto no puede exceder el 10%.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $sale = DB::transaction(function () use ($request) {
                $items = $request->input('items');
                $requestedQuantities = [];
                foreach ($items as $item) {
                    $pid = (int) $item['product_id'];
                    $qty = (int) $item['quantity'];
                    $requestedQuantities[$pid] = ($requestedQuantities[$pid] ?? 0) + $qty;
                }

                $productIds = array_keys($requestedQuantities);

                // Concurrency safety with pessimistic lock
                $products = Product::whereIn('id', $productIds)
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');

                // Verify stock availability
                foreach ($requestedQuantities as $productId => $totalQtyRequested) {
                    $product = $products->get($productId);

                    if (!$product) {
                        throw new \Exception("El producto con ID {$productId} no fue encontrado.", 422);
                    }

                    if ($product->stock < $totalQtyRequested) {
                        throw new \Exception("Stock insuficiente para el producto '{$product->name}'. Disponible: {$product->stock}, solicitado: {$totalQtyRequested}.", 422);
                    }
                }

                $totalSale = 0;
                $totalDiscount = 0;
                $detailsToCreate = [];

                foreach ($items as $item) {
                    $productId = (int) $item['product_id'];
                    $quantity = (int) $item['quantity'];
                    $discountPercent = isset($item['discount_percent']) ? (float) $item['discount_percent'] : 0.0;

                    $product = $products->get($productId);
                    $unitPrice = (float) $product->price;

                    // Standard calculation with optional discount
                    $subtotal = round($unitPrice * $quantity, 2);
                    $discountAmount = round($subtotal * ($discountPercent / 100), 2);
                    $subtotalWithDiscount = round($subtotal - $discountAmount, 2);

                    $totalSale += $subtotalWithDiscount;
                    $totalDiscount += $discountAmount;

                    $detailsToCreate[] = [
                        'product_id' => $productId,
                        'quantity' => $quantity,
                        'price' => $unitPrice,
                        'subtotal' => $subtotal,
                        'discount_percent' => $discountPercent,
                        'discount_amount' => $discountAmount,
                        'subtotal_with_discount' => $subtotalWithDiscount,
                    ];
                }

                // Create Sale record
                $sale = Sale::create([
                    'user_id' => $request->input('user_id'),
                    'total' => round($totalSale, 2),
                    'total_discount' => round($totalDiscount, 2),
                ]);

                // Create SaleDetails and decrement product stock
                foreach ($detailsToCreate as $detailData) {
                    $detailData['sale_id'] = $sale->id;
                    SaleDetail::create($detailData);

                    $product = $products->get($detailData['product_id']);
                    $product->decrement('stock', $detailData['quantity']);
                }

                return $sale;
            });

            return response()->json([
                'message' => 'Venta creada correctamente',
                'sale_id' => $sale->id,
                'total' => (float) $sale->total,
                'total_discount' => (float) $sale->total_discount,
            ], 201);

        } catch (\Exception $e) {
            $code = $e->getCode() === 422 ? 422 : 500;
            return response()->json([
                'message' => $e->getMessage() ?: 'Error al procesar la venta',
            ], $code);
        }
    }

    /**
     * Delete (soft-delete) a sale by ID and restore product stock.
     *
     * @param int|string $id
     * @return JsonResponse
     */
    public function destroy($id): JsonResponse
    {
        $sale = Sale::with('details.product')->find($id);

        if (!$sale) {
            return response()->json([
                'message' => 'Venta no encontrada',
            ], 404);
        }

        try {
            DB::transaction(function () use ($sale) {
                // Restore product stock
                foreach ($sale->details as $detail) {
                    if ($detail->product) {
                        $detail->product->increment('stock', $detail->quantity);
                    }
                }

                $sale->delete();
            });

            return response()->json([
                'message' => 'Venta eliminada correctamente',
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error al eliminar la venta: ' . $e->getMessage(),
            ], 500);
        }
    }
}
