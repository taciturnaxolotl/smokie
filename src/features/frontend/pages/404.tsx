import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

export function NotFound() {
	const navigate = useNavigate();
	const [countdown, setCountdown] = useState(5);

	useEffect(() => {
		const timer = setInterval(() => {
			setCountdown((prev) => {
				if (prev <= 1) {
					clearInterval(timer);
					navigate("/");
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return () => clearInterval(timer);
	}, [navigate]);

	return (
		<div className="container">
			<h1 className="title">404 - Page Not Found</h1>
			<div className="no-takes-message">
				<p>Redirecting to home page in {countdown} seconds...</p>
			</div>
		</div>
	);
}

export default NotFound;
