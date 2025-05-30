import setupCommands from "./setup/commands";
import setupActions from "./setup/actions";
import { validateAndFixUserTotals } from "../../libs/userTotals";
import * as Sentry from "@sentry/bun";

const takes = async () => {
	setupCommands();
	setupActions();

	// Validate and fix user totals on startup
	try {
		const result = await validateAndFixUserTotals();
		if (result.fixed > 0) {
			console.log(`Fixed ${result.fixed} users with total takes time drift`);
		}
		if (result.errors.length > 0) {
			console.error(`Failed to fix ${result.errors.length} users`);
			Sentry.captureMessage("Failed to fix some user totals", {
				level: "warning",
				extra: { errors: result.errors }
			});
		}
	} catch (error) {
		console.error("Error while validating user totals:", error);
		Sentry.captureException(error, {
			tags: { type: "user_totals_validation" }
		});
	}
};

export default takes;
