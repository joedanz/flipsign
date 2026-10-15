# Security

FlipSign has **no authentication by design**: anyone who can reach the server's port can change what the board says. It is meant for a trusted home network or a private VPN such as Tailscale.

- Do not expose port 3000 to the internet (no port forwarding, no public tunnel).
- If you need access away from home, put it behind a VPN or an authenticating reverse proxy.

To report a vulnerability, please open a private security advisory on the repository (Security tab → "Report a vulnerability") rather than a public issue.
