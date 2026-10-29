<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use Tests\TestCase;

class SaleTest extends TestCase
{
    public function test_can_list_products(): void
    {
        $response = $this->getJson('/api/products');

        $response->assertStatus(200)
            ->assertJsonStructure([
                '*' => ['id', 'name', 'price', 'stock']
            ]);
    }

    public function test_can_create_sale_successfully_and_deducts_stock(): void
    {
        $user = User::first() ?? User::factory()->create();
        $product = Product::first();

        $initialStock = $product->stock;
        $quantity = 2;
        $expectedTotal = round($product->price * $quantity, 2);

        $payload = [
            'user_id' => $user->id,
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                ]
            ]
        ];

        $response = $this->postJson('/api/sales', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'message' => 'Venta creada correctamente',
                'total' => $expectedTotal,
            ])
            ->assertJsonStructure(['message', 'sale_id', 'total']);

        // Verify stock deduction
        $product->refresh();
        $this->assertEquals($initialStock - $quantity, $product->stock);

        // Verify database records
        $saleId = $response->json('sale_id');
        $this->assertDatabaseHas('sales', [
            'id' => $saleId,
            'user_id' => $user->id,
            'total' => $expectedTotal
        ]);

        $this->assertDatabaseHas('sale_details', [
            'sale_id' => $saleId,
            'product_id' => $product->id,
            'quantity' => $quantity,
            'price' => $product->price,
            'subtotal' => $expectedTotal
        ]);
    }

    public function test_can_create_sale_with_optional_product_discount(): void
    {
        $user = User::first() ?? User::factory()->create();
        $product = Product::first();

        $quantity = 2;
        $discountPercent = 10;
        $subtotal = round($product->price * $quantity, 2);
        $discountAmount = round($subtotal * ($discountPercent / 100), 2);
        $expectedTotal = round($subtotal - $discountAmount, 2);

        $payload = [
            'user_id' => $user->id,
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                    'discount_percent' => $discountPercent,
                ]
            ]
        ];

        $response = $this->postJson('/api/sales', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'message' => 'Venta creada correctamente',
                'total' => $expectedTotal,
                'total_discount' => $discountAmount,
            ]);

        $saleId = $response->json('sale_id');
        $this->assertDatabaseHas('sale_details', [
            'sale_id' => $saleId,
            'product_id' => $product->id,
            'discount_percent' => $discountPercent,
            'discount_amount' => $discountAmount,
            'subtotal_with_discount' => $expectedTotal,
        ]);
    }

    public function test_rejects_discount_percent_greater_than_10(): void
    {
        $user = User::first() ?? User::factory()->create();
        $product = Product::first();

        $payload = [
            'user_id' => $user->id,
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 1,
                    'discount_percent' => 15, // max allowed is 10
                ]
            ]
        ];

        $response = $this->postJson('/api/sales', $payload);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['items.0.discount_percent']);
    }

    public function test_cannot_create_sale_with_insufficient_stock(): void
    {
        $user = User::first() ?? User::factory()->create();
        $product = Product::first();

        $payload = [
            'user_id' => $user->id,
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => $product->stock + 10,
                ]
            ]
        ];

        $response = $this->postJson('/api/sales', $payload);

        $response->assertStatus(422)
            ->assertJsonStructure(['message']);
    }

    public function test_validates_quantity_greater_than_zero(): void
    {
        $user = User::first() ?? User::factory()->create();
        $product = Product::first();

        $payload = [
            'user_id' => $user->id,
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 0,
                ]
            ]
        ];

        $response = $this->postJson('/api/sales', $payload);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['items.0.quantity']);
    }

    public function test_can_list_sales_with_details_and_discounts(): void
    {
        $response = $this->getJson('/api/sales');

        $response->assertStatus(200)
            ->assertJsonStructure([
                '*' => [
                    'id',
                    'total',
                    'total_discount',
                    'created_at',
                    'details' => [
                        '*' => [
                            'product',
                            'quantity',
                            'subtotal',
                            'discount_percent',
                            'discount_amount',
                            'subtotal_with_discount'
                        ]
                    ]
                ]
            ]);
    }

    public function test_can_delete_sale_and_restores_stock(): void
    {
        $user = User::first() ?? User::factory()->create();
        $product = Product::first();

        $initialStock = $product->stock;
        $quantity = 1;

        // Create sale
        $createResponse = $this->postJson('/api/sales', [
            'user_id' => $user->id,
            'items' => [
                ['product_id' => $product->id, 'quantity' => $quantity]
            ]
        ]);
        $saleId = $createResponse->json('sale_id');

        $product->refresh();
        $this->assertEquals($initialStock - $quantity, $product->stock);

        // Delete sale
        $deleteResponse = $this->deleteJson("/api/sales/{$saleId}");
        $deleteResponse->assertStatus(200)
            ->assertJson(['message' => 'Venta eliminada correctamente']);

        // Verify stock restored
        $product->refresh();
        $this->assertEquals($initialStock, $product->stock);

        // Verify soft deleted
        $this->assertSoftDeleted('sales', ['id' => $saleId]);
    }

    public function test_returns_404_when_deleting_non_existent_sale(): void
    {
        $response = $this->deleteJson('/api/sales/999999');

        $response->assertStatus(404)
            ->assertJson(['message' => 'Venta no encontrada']);
    }
}
