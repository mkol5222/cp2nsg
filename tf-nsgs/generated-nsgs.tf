# cp2nsg


    resource "azurerm_resource_group" "example" {
        name     = "nsg-example-resources"
        location = "West Europe"
      }
    

# 0. demo1
 
      resource "azurerm_network_security_group" "demo1" {
        name                = "demo1"
        location            = azurerm_resource_group.example.location
        resource_group_name = azurerm_resource_group.example.name
      }
        
// RG for NSG demo1 is azurerm_resource_group.example.name

        resource "azurerm_network_security_rule" "demo1_100_Inbound_Tcp" {

            name = "demo1_100_Inbound_Tcp"
            priority                    = 100
            direction                   = "Inbound"
            access                      = "Deny"
            protocol                    = "Tcp"
            source_port_range           = "*"
            destination_port_ranges      = [22,3389]
            source_address_prefix= "*" 
            destination_address_prefix= "*" 
            resource_group_name         = azurerm_resource_group.example.name
            network_security_group_name = azurerm_network_security_group.demo1.name

        }
        
// RG for NSG demo1 is azurerm_resource_group.example.name

        resource "azurerm_network_security_rule" "demo1_101_Inbound_Tcp" {

            name = "demo1_101_Inbound_Tcp"
            priority                    = 101
            direction                   = "Inbound"
            access                      = "Allow"
            protocol                    = "Tcp"
            source_port_range           = "*"
            destination_port_ranges      = [80,443]
            source_address_prefix= "*" 
            destination_address_prefix= "*" 
            resource_group_name         = azurerm_resource_group.example.name
            network_security_group_name = azurerm_network_security_group.demo1.name

        }
        
// RG for NSG demo1 is azurerm_resource_group.example.name

        resource "azurerm_network_security_rule" "demo1_100_Outbound_Tcp" {

            name = "demo1_100_Outbound_Tcp"
            priority                    = 100
            direction                   = "Outbound"
            access                      = "Allow"
            protocol                    = "Tcp"
            source_port_range           = "*"
            destination_port_ranges      = [80,443]
            source_address_prefix= "*" 
            destination_address_prefix= "*" 
            resource_group_name         = azurerm_resource_group.example.name
            network_security_group_name = azurerm_network_security_group.demo1.name

        }
        
