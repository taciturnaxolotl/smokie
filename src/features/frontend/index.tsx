import "./styles.css";
import { createRoot } from "react-dom/client";
import { App } from "./app.tsx";

document.addEventListener("DOMContentLoaded", () => {
	const element = document.getElementById("root");
	if (!element) throw new Error("Root element not found");
	const root = createRoot(element);
	root.render(<App />);
});
