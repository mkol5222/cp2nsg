### TO DO

- [x] support Azure Service Tags in source/destination
- [x] ability to specify target resource group for NSG (e.g. by tag on NSG_name object? - tag format RG:rg-nsg1)
- [x] fetch rulebase from live Security Management API vs file (--sc1 option and creds in .env file)
- [x] skip disabled rules

- [x] support both Smart-1 Cloud (supported) as well as regular management API (to do)
- [x] support management API auth with user+pass too (vs. just API key)
- [x] handle policy package not found
- [x] allow to specify other policy package than default "NSG" - e.g. via --package option
- [ ] handle self-signed API service certificate (other than deno run --unsafely-ignore-certificate-errors ) - https://medium.com/deno-the-complete-reference/3-ways-of-accepting-self-signed-certificates-in-deno-9c9286ab957
- [x] handle group of services - e.g. dns
- [x] add support for DevContainer/Codespaces

- [x] print view - fix "undefined" when there is no rule name in SmartConsole
- [x] improve code with Typescript types
- [ ] types - avoid JSONObject where relevant

- [ ] NSG rule by Install On column - e.g. NSG_Inbound_name, NSG_Outbound_name
- [ ] section header to set subscription and resource group

- [ ] SmartConsole Extension to start "Install NSG" workflow
- [ ] CI/CD pipeline managing changes to NSGs automatically (generate&commit to terraform apply)

- [ ] research pros and cons of dedicated NSG rule resurces vs inline rules for rulebase updates
- [ ] NSG rule naming strategy - e.g. based on CP rule uid
- [ ] set rule priority in SmartConsole rule: Comment column
- [ ] NSG in multiple resource groups - e.g. by tag on NSG_name object? - tag format RG:rg-nsg1, RG:rg-nsg2 vs nested groups
- [ ] same name of NSG in multiple subscriptions/RG - with own unique rulesets
- [ ] NSG location by group in NSG network group object
- [ ] nested groups in Install On column - subscr/rg/nsg ?

