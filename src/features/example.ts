import { slackApp } from "../index";

const example = async () => {
	slackApp.action("example_action", async ({ context, payload }) => {
		console.log("Example Action", payload);
	});
};

export default example;
