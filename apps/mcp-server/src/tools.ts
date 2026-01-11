import { z } from "zod";

export const QueryCustomerSchema = z.object({
	customerIds: z.array(z.string()).describe("The list of customer IDs to query"),
});

export const CheckInventorySchema = z.object({
	productIds: z.array(z.string()).describe("The list of product IDs to check"),
});

export const CreateOrderSchema = z.object({
	customerId: z.string(),
	productId: z.string(),
	quantity: z.number().int().positive(),
});

// Mock Database
const CUSTOMERS: Record<string, any> = {
	"cust_001": { name: "Alice", email: "alice@example.com", status: "VIP" },
	"cust_002": { name: "Bob", email: "bob@example.com", status: "Regular" },
};

const INVENTORY: Record<string, number> = {
	"prod_abc": 150,
	"prod_xyz": 5,
};

export const toolsHandler = {
	query_customer_data: async (args: z.infer<typeof QueryCustomerSchema>) => {
		const { customerIds } = args;
		const results = customerIds.map((customerId) => {
			const customer = CUSTOMERS[customerId];
			if (!customer) {
				return `Customer ${customerId} not found.`;
			}
			return JSON.stringify(customer, null, 2);
		});

		return {
			content: [{ type: "text" as const, text: results.join("\n\n") }],
		};
	},

	check_inventory: async (args: z.infer<typeof CheckInventorySchema>) => {
		const { productIds } = args;
		const results = productIds.map((productId) => {
			const stock = INVENTORY[productId];
			if (stock === undefined) {
				return `Product ${productId} not found.`;
			}
			return `Current stock for ${productId}: ${stock}`;
		});

		return {
			content: [{ type: "text" as const, text: results.join("\n") }],
		};
	},

	create_order: async (args: z.infer<typeof CreateOrderSchema>) => {
		const { customerId, productId, quantity } = args;

		// Basic validation
		if (!CUSTOMERS[customerId]) throw new Error("Invalid Customer");
		const currentStock = INVENTORY[productId];
		if (currentStock === undefined || currentStock < quantity) throw new Error("Insufficient Stock");

		// Execute "Action"
		INVENTORY[productId] = currentStock - quantity;
		const orderId = `ord_${Math.floor(Math.random() * 10000)}`;

		return {
			content: [
				{
					type: "text" as const,
					text: `Order placed successfully! Order ID: ${orderId}. Remaining stock: ${INVENTORY[productId]}`
				}
			],
		};
	}
};
