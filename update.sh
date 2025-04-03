git restore bun.lock
git fetch --all
git reset --hard origin/main
bun install
bun db:generate
bun db:push
systemctl --user restart takes
