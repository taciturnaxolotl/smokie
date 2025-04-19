import { useEffect, useState } from "react";
import { prettyPrintTime } from "../../libs/time";
import { fetchUserData } from "../../libs/cachet";

export function App() {
	const [takes, setTakes] = useState<
		{
			id: string;
			userId: string;
			description: string;
			completedAt: Date;
			status: string;
			mp4Url: string;
			elapsedTime: number;
		}[]
	>([]);

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
							<h2 className="take-title">{take.description}</h2>
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
								<span
									className={`status-badge status-${take.status}`}
								>
									{take.status}
								</span>
							</div>
						</div>

						<div className="take-meta">
							<div className="meta-item">
								<span className="meta-label">Completed:</span>
								<span className="meta-value">
									{new Date(
										take.completedAt,
									).toLocaleString()}
								</span>
							</div>
							<div className="meta-item">
								<span className="meta-label">Duration:</span>
								<span className="meta-value">
									{prettyPrintTime(take.elapsedTime)}
								</span>
							</div>
						</div>

						{take.mp4Url && (
							<div className="video-container">
								<video controls className="take-video">
									<source
										src={take.mp4Url}
										type="video/mp4"
									/>
									<track
										kind="captions"
										src=""
										label="Captions"
									/>
								</video>
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
