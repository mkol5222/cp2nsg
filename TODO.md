### TO DO

- [x] support Azure Service Tags in source/destination
- [ ] NSG rule naming strategy - e.g. based on CP rule uid
- [x] ability to specify target resource group for NSG (e.g. by tag on NSG_name object? - tag format RG:rg-nsg1)
- [ ] fetch rulebase from live Security Management API vs file
- [ ] CI/CD pipeline managing changes to NSGs automatically (generate&commit to terraform apply)