import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { prettyPrintTime } from "../../../libs/time";
import type { Project } from "../../api/routes/projects";

export function Projects() {
	const [projects, setProjects] = useState<Project[]>([]);

	useEffect(() => {
		async function getProjects() {
			try {
				const res = await fetch("/api/projects");
				if (!res.ok) {
					throw new Error(`HTTP error! status: ${res.status}`);
				}
				const data = await res.json();
				setProjects(data.projects);
			} catch (error) {
				console.error("Error fetching projects:", error);
				setProjects([]);
			}
		}
		getProjects();
	}, []);

	return (
		<div className="container">
			<h1 className="title">Projects</h1>
			{projects.length === 0 ? (
				<div className="no-takes-message">No projects found</div>
			) : (
				<div className="projects-grid">
					{projects.map((project) => (
						<Link
							to={`/user/${encodeURIComponent(project.userId)}`}
							key={project.projectName}
							className="project-card"
						>
							<img
								src={project.projectBannerUrl}
								alt={`${project.projectName} banner`}
								className="project-banner"
							/>
							<h2 className="project-title">
								{project.projectName}
							</h2>
							<div className="project-meta">
								<span>
									Total Time:{" "}
									{prettyPrintTime(project.totalTakesTime)}
								</span>
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
