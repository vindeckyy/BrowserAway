# Security policy

## Supported versions

Only the latest release receives fixes.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
(the **Security** tab of this repository → **Report a vulnerability**). Do not open a public issue for security
problems. Include the Firefox version, the steps to reproduce, and what an attacker gains.

## Threat model

BrowserAway is a convenience lock that keeps casual access out of an unattended, already-running browser. It is
**not** a security boundary against someone with control of the machine or the Firefox profile. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#security-notes) for details and known limits.
