import { useEffect, useState } from "react";
import { prettyPrintTime } from "../../libs/time";
import { fetchUserData } from "../../libs/cachet";
import type { RecentTake } from "../api/routes/recentTakes";

export function App() {
	const [takes, setTakes] = useState<RecentTake[]>([]);

	const [userData, setUserData] = useState<{
		[key: string]: { displayName: string; imageUrl: string };
	}>({});
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

	useEffect(() => {
		async function getTakes() {
			const res = await fetch("/api/recentTakes");
			const data = await res.json();

			console.log(data);
			setTakes(data.takes);
		}
		getTakes();
	}, []);

	return (
		<div className="container">
			<h1 className="title">Recent Takes</h1>
			<div className="takes-grid">
				{takes.map((take) => (
					<div key={take.id} className="take-card">
						<div className="take-header">
							<h2 className="take-title">{take.notes}</h2>
							<div className="user-pill">
								<div className="user-info">
									<img
										src={userData[take.userId]?.imageUrl}
										alt="Profile"
										className="profile-image"
									/>
									<span className="user-name">
										{userData[take.userId]?.displayName ??
											take.userId}
									</span>
								</div>
							</div>
						</div>

						<div className="take-meta">
							<div className="meta-item">
								<span className="meta-label">Completed:</span>
								<span className="meta-value">
									{new Date(take.createdAt).toLocaleString()}
								</span>
							</div>
							<div className="meta-item">
								<span className="meta-label">Duration:</span>
								<span className="meta-value">
									{prettyPrintTime(take.elapsedTimeMs)}
								</span>
							</div>
						</div>

						{take.mediaUrls?.map((url: string, index: number) => {
							const isVideo = url.endsWith(".mp4");
							return (
								<div
									key={`media-${take.id}-${index}`}
									className={
										isVideo
											? "video-container"
											: "image-container"
									}
								>
									{isVideo ? (
										<video controls className="take-video">
											<source
												src={url}
												type="video/mp4"
											/>
											<track
												kind="captions"
												src=""
												label="Captions"
											/>
										</video>
									) : (
										<img
											src={url}
											alt=""
											className="take-image"
										/>
									)}
								</div>
							);
						})}
					</div>
				))}
			</div>
		</div>
	);
}
