import type { Project } from "../features/api/routes/projects";

export function getCategoryLabel(category: Project["projectCategory"]): string {
	const categoryMap: Record<Project["projectCategory"], string> = {
		hardware: "Hardware",
		hardware_software: "Hardware + Software",
		website: "Website",
		app: "App",
		game: "Game",
		art_design: "Art & Design",
		other: "Other",
	};
	return categoryMap[category] || "Other";
}
