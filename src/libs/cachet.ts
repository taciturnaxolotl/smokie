export async function fetchUserData(userId: string) {
	const res = await fetch(`https://cachet.dunkirk.sh/users/${userId}/`);
	const json = await res.json();

	return {
		id: json.id,
		expiration: json.expiration,
		user: json.user,
		displayName: json.displayName,
		image: json.image,
	};
}
