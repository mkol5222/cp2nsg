// const DEMO_FILE = "./data/2nsgs-access-rulebase.json";
const DEMO_FILE = "./data/servicetags-rulebase.json";

const SERVICETAG_PREFIX = "ServiceTag_";
const NSG_PREFIX = "NSG_";
/**
 * Loads raw rulebase from show access-rulebase API response
 * @param {string} filename
 * @returns { {rulebase: [ any ], objectsByUid: { [uid: string]: any; }} } Parsed raw access rulebase and objects by uid
 */
async function loadCpRulebase(filename: string) {
  try {
    const ruleBaseText = await Deno.readTextFile(filename);

    const rulebase = JSON.parse(ruleBaseText);

    const rawObjects = rulebase["objects-dictionary"];

    // organize objects by uid for easier access
    const objectsByUid = rawObjects.reduce(
      (objectDict: { [uid: string]: any }, obj: any) => {
        objectDict[obj.uid] = obj;
        return objectDict;
      },
      {},
    );

    return { rulebase, objectsByUid };
  } catch (err) {
    console.error("Error loading/parsing rulebase:", err);
  }
  return null;
}

function processAction(actionUid, objectsByUid) {
  const action = objectsByUid[actionUid];

  return action.name;
}

function processService(serviceUid, objectsByUid) {
  const service = objectsByUid[serviceUid];

  if (service.type === "CpmiAnyObject" && service.name === "Any") return "*";
  if (service.type === "service-tcp") return `${service.port}/Tcp`;
  if (service.type === "service-udp") return `${service.port}/Udp`;
  return service;
}

function processNetworkObject(networkObjectId, objectsByUid) {
  const networkObject = objectsByUid[networkObjectId];
  
  // log
  // console.log('object:', networkObject.name, networkObject.type);
  // if (networkObject.type === "group") {
  //   console.log('group:', networkObject.name);
  // }
  // if (networkObject.name.startsWith(SERVICETAG_PREFIX)) {
  //   console.log('SERVICETAG_PREFIX:', networkObject.name);
  // }

  if (networkObject.type === "group" && networkObject.name.startsWith(SERVICETAG_PREFIX)) {
    // console.log('service tag', networkObject.name.slice(SERVICETAG_PREFIX.length))
    return networkObject.name.slice(SERVICETAG_PREFIX.length);
  }

  if (networkObject.type === "CpmiAnyObject" && networkObject.name === "Any") {
    return "*";
  }
  if (networkObject.type === "host") {
    return `${networkObject["ipv4-address"]}/32`;
  }
  if (networkObject.type === "network") {
    return `${networkObject["subnet4"]}/${networkObject["mask-length4"]}`;
  }
  if (networkObject.type === "group" && networkObject.name.startsWith(NSG_PREFIX)) {
    return "*";
  }



  return networkObject;
}

/**
 * Converts rulebase to flat array of rules (e.g. by visiting all sections)
 * @param {any} rulebase
 * @returns { [any] } Array of access rules
 */
function flatRules(rulebase: any): [any] {
  // start from top rulebase top level
  const rules = rulebase["rulebase"].reduce(
    (rules: [any], rule: any) => {
      // visiting every every section and collecting all rules
      if (rule.type === "access-section") {
        for (const r of rule.rulebase) {
          rules.push(r);
        }
      }
      // collect top level rules
      if (rule.type === "access-rule") rules.push(rule);
      return rules;
    },
    [],
  );
  return rules;
}

function nsgsFromObjectUids(objectUids, objectsByUid) {
  return unique(
    objectUids
      .map((uid) => objectsByUid[uid]) // get objects by uid
      .filter((o) => o.type === "group" && o.name.startsWith(NSG_PREFIX)) // network group name starts with NSG_
      .map((o) => o.name.slice(4)), // remove NSG_ prefix
  );
}

function processRule(rule, direction, nsgName, objectsByUid) {
  const ruleData = {};

  ruleData.nsg_Direction = direction;

  ruleData.nsg_Services = rule.service.map((service) => {
    return processService(service, objectsByUid);
  });

  ruleData.nsg_SourceAddresses = rule.source.map((source) =>
    processNetworkObject(source, objectsByUid)
  );

  ruleData.nsg_DestinationAddresses = rule.destination.map((destination) =>
    processNetworkObject(destination, objectsByUid)
  );

  ruleData.nsg_Action = processAction(rule.action, objectsByUid);
  ruleData.nsg_Action = ruleData.nsg_Action === "Accept" ? "Allow" : "Deny";

  ruleData.nsg_RuleNo = rule["rule-number"];

  ruleData.nsg_NsgName = nsgName;

  ruleData.nsg_Description = rule.name;

  return ruleData;
}

function unique(array) {
  return Array.from(new Set(array));
}

function uidsIncludeNSG(uids, nsgName, objectsByUid) {
  return uids.map((uid) => objectsByUid[uid].name).includes(`NSG_${nsgName}`);
}

function processRules(rulebase, objectsByUid) {
  const rules = flatRules(rulebase);

  // need all sources and all destination UIDs to find NSG names
  const allSources = unique(rules.flatMap((rule) => rule.source));
  const allDestinations = unique(rules.flatMap((rule) => rule.destination));

  // NSG names
  const allSorceNsgs = nsgsFromObjectUids(allSources, objectsByUid);
  const allDestinationNsgs = nsgsFromObjectUids(allDestinations, objectsByUid);
  const allNsgs = unique([...allSorceNsgs, ...allDestinationNsgs]);

  // process all NGSs into rulebases
  const nsgRulebases = allNsgs.map((nsgName) => {
    // console.log("processing NSG rulebase", nsgName);

    const nsgOutgoingRules = rules
      .filter((rule) => uidsIncludeNSG(rule.source, nsgName, objectsByUid)) // nsgName in source
      .map((rule) => processRule(rule, "Outbound", nsgName, objectsByUid));

    const nsgIncomingRules = rules
      .filter((rule) => uidsIncludeNSG(rule.destination, nsgName, objectsByUid)) // nsgName in dst
      .map((rule) => processRule(rule, "Inbound", nsgName, objectsByUid));

    // for (const rule of [...nsgOutgoingRules, ...nsgIncomingRules]) {
    //     console.log(`${rule.nsg_Direction}: ${JSON.stringify(rule.nsg_Addresses)} ${JSON.stringify(rule.nsg_Services)}`);
    // }

    return { nsgName, nsgOutgoingRules, nsgIncomingRules };
  });

  // console.log("Processing done");

  return {
    allNsgs,
    nsgRulebases,
  };
}

function printRules(rules) {
  for (const rule of rules) {
    console.log(
      `${rule.nsg_RuleNo} ${rule.nsg_Direction}: ${
        JSON.stringify(rule.nsg_SourceAddresses)
      } -> ${JSON.stringify(rule.nsg_DestinationAddresses)} ${
        JSON.stringify(rule.nsg_Services)
      } ${rule.nsg_Action} // ${rule.nsg_Description}`,
    );
  }
}

async function main() {
  console.log("# cp2nsg\n");

  const rulebaseData = await loadCpRulebase(DEMO_FILE);
  if (!rulebaseData) {
    console.error("Failed to load rulebase data");
    return;
  }

  const { rulebase, objectsByUid } = rulebaseData!;

  const rules = processRules(rulebase, objectsByUid);

  //   for (const [nsgIndex, nsgData] of Object.entries<any>(rules.nsgRulebases)) {
  //     console.log("");
  //     console.log(`${nsgIndex}. ${nsgData.nsgName}`);
  //     //console.log(nsgData);
  //     printRules(nsgData.nsgIncomingRules);
  //     printRules(nsgData.nsgOutgoingRules);
  //   }

  generateTerraform(rules);
  //console.log(rules.nsgRulebases)
}

function servicesByProtocol(services) {
  const serviceObjects = services.map((service) => ({
    proto: service.split("/")[1],
    port: parseInt(service.split("/")[0]),
  }));
  return Object.entries(Object.groupBy(serviceObjects, ({ proto }) => proto))
    .map(([proto, services]) => ({
      proto,
      ports: services.map(({ port }) => port),
    }));
}

function generateTerraformNSGRules(rules) {
  let priority = 100;
  for (const rule of rules) {
    //console.log(rule);

    const servicesByProto = servicesByProtocol(rule.nsg_Services);
    // console.log('servicesByProto', servicesByProto);

    for (const [index, portsByProto] of Object.entries<any>(servicesByProto)) {
      // console.log("proto", index, portsByProto.proto, portsByProto.ports);

      const ruleNo = priority++;

      let ports = ["*"];
      let proto = "Any";

      if ( portsByProto.proto !== "undefined") {
        ports = portsByProto.ports;
        proto = portsByProto.proto;
      }
      // console.log('service ports', ports, proto, servicesByProto);

      let destination = `destination_address_prefixes= ${
        JSON.stringify(rule.nsg_DestinationAddresses)
      }
      `;
      if (rule.nsg_DestinationAddresses.length === 1) {
        destination = `destination_address_prefix= "${rule.nsg_DestinationAddresses[0]}" `;
      }

      let source = `source_address_prefixes     = ${
        JSON.stringify(rule.nsg_SourceAddresses)
      }
      `;
      if (rule.nsg_SourceAddresses.length === 1) {
        source = `source_address_prefix= "${rule.nsg_SourceAddresses[0]}" `;
      }

      let portSpec = `destination_port_ranges      = ${JSON.stringify(ports)}`;
      if (ports.length === 1) {
        portSpec = `destination_port_range      = ${JSON.stringify(ports[0])}`;
      }
        
      // name                        = "${rule.nsg_Description}"
      console.log(`
        resource "azurerm_network_security_rule" "${rule.nsg_NsgName}_${ruleNo}_${rule.nsg_Direction}_${proto}" {

            name = "${rule.nsg_NsgName}_${ruleNo}_${rule.nsg_Direction}_${proto}"
            priority                    = ${ruleNo}
            direction                   = "${rule.nsg_Direction}"
            access                      = "${rule.nsg_Action}"
            protocol                    = "${proto === 'Any' ? '*' : proto}"
            source_port_range           = "*"
            ${portSpec}
            ${source}
            ${destination}
            resource_group_name         = azurerm_resource_group.example.name
            network_security_group_name = azurerm_network_security_group.${rule.nsg_NsgName}.name

        }
        `);
    }
  }
}

function generateTerraform(rules) {
  console.log(`
    resource "azurerm_resource_group" "example" {
        name     = "nsg-example-resources"
        location = "West Europe"
      }
    `);

  for (const [nsgIndex, nsgData] of Object.entries<any>(rules.nsgRulebases)) {
    console.log("");
    console.log(`# ${nsgIndex}. ${nsgData.nsgName}`);

    console.log(` 
      resource "azurerm_network_security_group" "${nsgData.nsgName}" {
        name                = "${nsgData.nsgName}"
        location            = azurerm_resource_group.example.location
        resource_group_name = azurerm_resource_group.example.name
      }
        `);

    generateTerraformNSGRules(nsgData.nsgIncomingRules);
    generateTerraformNSGRules(nsgData.nsgOutgoingRules);
  }
}

await main();
