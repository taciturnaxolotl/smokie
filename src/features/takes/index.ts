import setupCommands from "./setup/commands";
import setupActions from "./setup/actions";

const takes = async () => {
	setupCommands();
	setupActions();
};

export default takes;
