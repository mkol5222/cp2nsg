### TO DO

- [x] support Azure Service Tags in source/destination
- [x] ability to specify target resource group for NSG (e.g. by tag on NSG_name object? - tag format RG:rg-nsg1)
- [x] fetch rulebase from live Security Management API vs file (--sc1 option and creds in .env file)
- [x] skip disabled rules

- [ ] SmartConsole Extension to start "Install NSG" workflow
- [ ] CI/CD pipeline managing changes to NSGs automatically (generate&commit to terraform apply)

- [ ] research pros and cons of dedicated NSG rule resurces vs inline rules for rulebase updates
- [ ] NSG rule naming strategy - e.g. based on CP rule uid
