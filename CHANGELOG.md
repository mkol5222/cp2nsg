### CHANGELOG

### 2023-10-30

* initial release

#### 2023-11-01

* ability to specify NSG Azure Resource Group in tag e.g. RG:rg-nsg1 on NSG_name object
* ability to read policy package from live Security Management API vs file (--sc1 option and creds in .env file)
* support Azure Service Tags in source/destination
* bugfix: skip disabled rules


#### 2023-11-02
* option --print to produce rule summary (vs Terraform code)

