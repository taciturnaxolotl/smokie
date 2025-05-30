import { db } from "./db";
import { users as usersTable, takes as takesTable } from "./schema";
import { sql, eq, and, ne } from "drizzle-orm";

/**
 * Finds and corrects any drift between the computed user total time and the stored value.
 * This helps ensure time calculations remain accurate even if triggers fail or data gets out of sync.
 */
export async function validateAndFixUserTotals() {
	try {
		console.log("Validating user totals...");

		// First, get the calculated totals per user
		const calculatedTotals = await db
			.select({
				userId: takesTable.userId,
				calculatedTotal:
					sql<number>`COALESCE(SUM(${takesTable.elapsedTime}), 0)::integer`.as(
						"calculated_total",
					),
			})
			.from(takesTable)
			.groupBy(takesTable.userId);

		// Convert to a map for easier lookup
		const totalsMap = new Map(
			calculatedTotals.map((item) => [item.userId, item.calculatedTotal]),
		);

		// Get all users
		const allUsers = await db
			.select({
				id: usersTable.id,
				storedTotal: usersTable.totalTakesTime,
			})
			.from(usersTable);

		// Find users with drift
		const driftedUsers = allUsers
			.filter((user) => {
				const calculatedTotal = totalsMap.get(user.id) || 0;
				return user.storedTotal !== calculatedTotal;
			})
			.map((user) => ({
				id: user.id,
				storedTotal: user.storedTotal,
				calculatedTotal: totalsMap.get(user.id) || 0,
			}));

		if (driftedUsers.length === 0) {
			console.log("✅ All user totals are in sync");
			return { fixed: 0, errors: [] };
		}

		console.log(
			`❌ Found ${driftedUsers.length} users with incorrect totals`,
		);

		// Fix each drifted user
		const errors: string[] = [];
		let fixed = 0;

		for (const user of driftedUsers) {
			try {
				await db
					.update(usersTable)
					.set({ totalTakesTime: user.calculatedTotal })
					.where(eq(usersTable.id, user.id));

				console.log(
					`Fixed user ${user.id}: ${user.storedTotal} → ${user.calculatedTotal}`,
				);
				fixed++;
			} catch (error) {
				const errorMsg = `Failed to fix user ${user.id}: ${error}`;
				console.error(errorMsg);
				errors.push(errorMsg);
			}
		}

		console.log(`✅ Fixed ${fixed} user totals`);

		return { fixed, errors };
	} catch (error) {
		console.error("Error validating user totals:", error);
		throw error;
	}
}
