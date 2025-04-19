import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Projects } from "./pages/Projects";
import { ProjectTakes } from "./pages/ProjectTakes";
import { NotFound } from "./pages/404";

export function App() {
	return (
		<Router>
			<Routes>
				<Route path="/" element={<Projects />} />
				<Route path="/user/:user" element={<ProjectTakes />} />
				<Route path="*" element={<NotFound />} />
			</Routes>
		</Router>
	);
}
