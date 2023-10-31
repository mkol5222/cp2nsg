
data "checkpoint_management_access_rulebase" "access_rulebase" {
   name = "NSG Network"
   show_as_ranges = true
}

output "access_policy" {
    value = jsonencode(data.checkpoint_management_access_rulebase.access_rulebase)
  
}