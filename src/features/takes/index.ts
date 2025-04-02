import setupCommands from "./setup/commands";
import setupActions from "./setup/actions";
import setupNotifications from "./setup/notifications";

const takes = async () => {
	setupCommands();
	setupActions();
	setupNotifications();
};

export default takes;
