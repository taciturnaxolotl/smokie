import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { prettyPrintTime } from "../../../libs/time";
import { fetchUserData } from "../../../libs/cachet";
import type { RecentTake } from "../../api/routes/recentTakes";
import type { Project } from "../../api/routes/projects";
import Masonry from "react-masonry-css";

export function ProjectTakes() {
	const { user } = useParams();
	const [takes, setTakes] = useState<RecentTake[]>([]);
	const [userData, setUserData] = useState<{
		[key: string]: { displayName: string; imageUrl: string };
	}>({});
	const [project, setProject] = useState<Project>();

	useEffect(() => {
		async function getTakes() {
			try {
				const res = await fetch(
					`/api/recentTakes?user=${encodeURIComponent(user as string)}`,
				);
				if (!res.ok) {
					throw new Error(`HTTP error! status: ${res.status}`);
				}
				const data = await res.json();
				setTakes(data.takes);
			} catch (error) {
				console.error("Error fetching takes:", error);
				setTakes([]);
			}
		}

		async function getProject() {
			try {
				const res = await fetch(
					`/api/projects?user=${encodeURIComponent(user as string)}`,
				);
				if (!res.ok) {
					throw new Error(`HTTP error! status: ${res.status}`);
				}
				const data = await res.json();
				setProject(data.projects);
			} catch (error) {
				console.error("Error fetching project:", error);
			}
		}

		getTakes();
		getProject();
	}, [user]);

	useEffect(() => {
		async function loadUserData() {
			const userIds = takes.map((take) => take.userId);
			const uniqueIds = [...new Set(userIds)];
			try {
				for (const id of uniqueIds) {
					const data = await fetchUserData(id);
					setUserData((prevData) => ({
						...prevData,
						[id]: {
							displayName: data.displayName,
							imageUrl: data.image,
						},
					}));
				}
			} catch (error) {
				console.error("Error fetching user data:", error);
			}
		}
		loadUserData();
	}, [takes]);

	const breakpointColumns = {
		default: 4,
		1100: 3,
		700: 2,
		500: 1,
	};

	return (
		<div className="container">
			<section className="project-header">
				{project?.projectBannerUrl && (
					<img
						src={project.projectBannerUrl}
						alt="Project banner"
						className="project-banner"
						style={{
							width: "100%",
							height: "200px",
							objectFit: "cover",
							borderRadius: "12px",
							marginBottom: "2rem",
						}}
					/>
				)}
				<h1 className="title">
					{project?.projectName || "Recent Takes"}
				</h1>
			</section>
			{takes.length === 0 ? (
				<div className="no-takes-message">No takes found</div>
			) : (
				<Masonry
					breakpointCols={breakpointColumns}
					className="takes-grid"
					columnClassName="takes-grid-column"
				>
					{takes.map((take) => (
						<div key={take.id} className="take-card">
							<div className="take-header">
								<h2 className="take-title">{take.project}</h2>
								<div className="user-pill">
									<div className="user-info">
										<img
											src={
												userData[take.userId]?.imageUrl
											}
											alt="Profile"
											className="profile-image"
										/>
										<span className="user-name">
											{userData[take.userId]
												?.displayName ?? take.userId}
										</span>
									</div>
								</div>
							</div>

							<div className="take-meta">
								<div className="meta-item">
									<span className="meta-label">
										Completed:
									</span>
									<span className="meta-value">
										{new Date(
											take.createdAt,
										).toLocaleString()}
									</span>
								</div>
								<div className="meta-item">
									<span className="meta-label">
										Duration:
									</span>
									<span className="meta-value">
										{prettyPrintTime(take.elapsedTimeMs)}
									</span>
								</div>
							</div>

							{take.mediaUrls?.map(
								(url: string, index: number) => {
									// More robust video detection for Slack-style URLs
									const isVideo =
										/\.(mp4|mov|webm|ogg)/i.test(url) ||
										(url.includes("files.slack.com") &&
											url.includes("download"));
									const contentType = isVideo
										? "video"
										: "image";

									return (
										<div
											key={`media-${take.id}-${index}`}
											className={`${contentType}-container`}
										>
											{isVideo ? (
												<video
													controls
													className="take-video"
													preload="metadata"
													playsInline
												>
													<source
														src={url}
														type="video/mp4"
													/>
													<track
														kind="captions"
														src=""
														label="Captions"
													/>
													Your browser does not
													support the video tag.
												</video>
											) : (
												<img
													src={url}
													alt={`Media content ${index + 1}`}
													className="take-image"
													loading="lazy"
												/>
											)}
										</div>
									);
								},
							)}
						</div>
					))}
				</Masonry>
			)}
		</div>
	);
}
