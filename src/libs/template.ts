import { parse } from "yaml";

type template = "app.startup";

interface data {
	environment?: string;
}

const file = await Bun.file("src/libs/templates.yaml").text();
const templatesRaw = parse(file);

function flatten(obj: Record<string, unknown>, prefix = "") {
	let result: Record<string, unknown> = {};

	for (const key in obj) {
		if (typeof obj[key] === "object" && Array.isArray(obj[key]) === false) {
			result = {
				...result,
				...flatten(
					obj[key] as Record<string, unknown>,
					`${prefix}${key}.`,
				),
			};
		} else {
			result[`${prefix}${key}`] = obj[key];
		}
	}

	return result;
}

const templates = flatten(templatesRaw);

export function t(template: template, data: data) {
	return t_format(t_fetch(template), data);
}

export function t_fetch(template: template) {
	return Array.isArray(templates[template])
		? (randomChoice(templates[template]) as string)
		: (templates[template] as string);
}

export function t_format(template: string, data: data) {
	return template.replace(
		/\${(.*?)}/g,
		(_, key) => data[key as keyof data] ?? "",
	);
}

export function randomChoice<T>(arr: T[]): T {
	if (arr.length === 0) {
		throw new Error("Cannot get random choice from empty array");
	}
	return arr[Math.floor(Math.random() * arr.length)]!;
}
