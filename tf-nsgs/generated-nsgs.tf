# cp2nsg


    resource "azurerm_resource_group" "example" {
        name     = "nsg-example-resources"
        location = "West Europe"
      }
    

# 0. Default
 
      resource "azurerm_network_security_group" "Default" {
        name                = "Default"
        location            = azurerm_resource_group.example.location
        resource_group_name = azurerm_resource_group.example.name
      }
        

        resource "azurerm_network_security_rule" "Default_100_Inbound_Tcp" {

            name = "Default_100_Inbound_Tcp"
            priority                    = 100
            direction                   = "Inbound"
            access                      = "Allow"
            protocol                    = "Tcp"
            source_port_range           = "*"
            destination_port_ranges      = [22,3389]
            source_address_prefixes     = ["192.168.1.0/24","194.228.2.1/32"]
      
            destination_address_prefix= "*" 
            resource_group_name         = azurerm_resource_group.example.name
            network_security_group_name = azurerm_network_security_group.Default.name

        }
        

        resource "azurerm_network_security_rule" "Default_101_Inbound_Tcp" {

            name = "Default_101_Inbound_Tcp"
            priority                    = 101
            direction                   = "Inbound"
            access                      = "Allow"
            protocol                    = "Tcp"
            source_port_range           = "*"
            destination_port_ranges      = [80,443]
            source_address_prefix= "*" 
            destination_address_prefix= "*" 
            resource_group_name         = azurerm_resource_group.example.name
            network_security_group_name = azurerm_network_security_group.Default.name

        }
        

        resource "azurerm_network_security_rule" "Default_102_Inbound_Tcp" {

            name = "Default_102_Inbound_Tcp"
            priority                    = 102
            direction                   = "Inbound"
            access                      = "Deny"
            protocol                    = "Tcp"
            source_port_range           = "*"
            destination_port_ranges      = [22,3389]
            source_address_prefix= "*" 
            destination_address_prefix= "*" 
            resource_group_name         = azurerm_resource_group.example.name
            network_security_group_name = azurerm_network_security_group.Default.name

        }
        

        resource "azurerm_network_security_rule" "Default_103_Inbound_Any" {

            name = "Default_103_Inbound_Any"
            priority                    = 103
            direction                   = "Inbound"
            access                      = "Deny"
            protocol                    = "*"
            source_port_range           = "*"
            destination_port_range      = "*"
            source_address_prefix= "*" 
            destination_address_prefix= "*" 
            resource_group_name         = azurerm_resource_group.example.name
            network_security_group_name = azurerm_network_security_group.Default.name

        }
        

        resource "azurerm_network_security_rule" "Default_100_Outbound_Any" {

            name = "Default_100_Outbound_Any"
            priority                    = 100
            direction                   = "Outbound"
            access                      = "Allow"
            protocol                    = "*"
            source_port_range           = "*"
            destination_port_range      = "*"
            source_address_prefix= "*" 
            destination_address_prefix= "*" 
            resource_group_name         = azurerm_resource_group.example.name
            network_security_group_name = azurerm_network_security_group.Default.name

        }
        

# 1. WebDemo
 
      resource "azurerm_network_security_group" "WebDemo" {
        name                = "WebDemo"
        location            = azurerm_resource_group.example.location
        resource_group_name = azurerm_resource_group.example.name
      }
        

        resource "azurerm_network_security_rule" "WebDemo_100_Inbound_Tcp" {

            name = "WebDemo_100_Inbound_Tcp"
            priority                    = 100
            direction                   = "Inbound"
            access                      = "Allow"
            protocol                    = "Tcp"
            source_port_range           = "*"
            destination_port_ranges      = [80,443]
            source_address_prefix= "*" 
            destination_address_prefix= "*" 
            resource_group_name         = azurerm_resource_group.example.name
            network_security_group_name = azurerm_network_security_group.WebDemo.name

        }
        

        resource "azurerm_network_security_rule" "WebDemo_101_Inbound_Any" {

            name = "WebDemo_101_Inbound_Any"
            priority                    = 101
            direction                   = "Inbound"
            access                      = "Deny"
            protocol                    = "*"
            source_port_range           = "*"
            destination_port_range      = "*"
            source_address_prefix= "*" 
            destination_address_prefix= "*" 
            resource_group_name         = azurerm_resource_group.example.name
            network_security_group_name = azurerm_network_security_group.WebDemo.name

        }
        

        resource "azurerm_network_security_rule" "WebDemo_100_Outbound_Udp" {

            name = "WebDemo_100_Outbound_Udp"
            priority                    = 100
            direction                   = "Outbound"
            access                      = "Allow"
            protocol                    = "Udp"
            source_port_range           = "*"
            destination_port_range      = 123
            source_address_prefix= "*" 
            destination_address_prefix= "195.113.144.201/32" 
            resource_group_name         = azurerm_resource_group.example.name
            network_security_group_name = azurerm_network_security_group.WebDemo.name

        }
        

        resource "azurerm_network_security_rule" "WebDemo_101_Outbound_Tcp" {

            name = "WebDemo_101_Outbound_Tcp"
            priority                    = 101
            direction                   = "Outbound"
            access                      = "Allow"
            protocol                    = "Tcp"
            source_port_range           = "*"
            destination_port_range      = 123
            source_address_prefix= "*" 
            destination_address_prefix= "195.113.144.201/32" 
            resource_group_name         = azurerm_resource_group.example.name
            network_security_group_name = azurerm_network_security_group.WebDemo.name

        }
        

        resource "azurerm_network_security_rule" "WebDemo_102_Outbound_Tcp" {

            name = "WebDemo_102_Outbound_Tcp"
            priority                    = 102
            direction                   = "Outbound"
            access                      = "Allow"
            protocol                    = "Tcp"
            source_port_range           = "*"
            destination_port_ranges      = [80,443]
            source_address_prefix= "*" 
            destination_address_prefix= "*" 
            resource_group_name         = azurerm_resource_group.example.name
            network_security_group_name = azurerm_network_security_group.WebDemo.name

        }
        