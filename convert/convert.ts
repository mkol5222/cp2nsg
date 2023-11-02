import { parse } from "https://deno.land/std@0.202.0/flags/mod.ts";
import { load } from "https://deno.land/std@0.204.0/dotenv/mod.ts";

type ServiceElement = string | Array<ServiceElement>;
type Services = Array<ServiceElement>;

type NsgDirection = "Inbound" | "Outbound";

// type for JSON inputs
type JSONValue =
  | string
  | number
  | boolean
  | JSONObject
  | JSONArray;

interface JSONObject {
  [x: string]: JSONValue;
}

// deno-lint-ignore no-empty-interface
interface JSONArray extends Array<JSONValue> { }


const flags = parse(Deno.args, {
  boolean: ["help", "s1c", "print"],
  string: ["package"],
  default: { color: true },
});
// console.log("Wants help?", flags.help);
// console.log("Use s1c?", flags.s1c);

// const DEMO_FILE = "./data/2nsgs-access-rulebase.json";
const DEMO_FILE = "./data/servicetags-rulebase.json";

const SERVICETAG_PREFIX = "ServiceTag_";
const NSG_PREFIX = "NSG_";


async function loadPolicyFromS1C(packageName: string) {
  const env = await load();
  const cpserver = env["CPSERVER"] || 'use-yourownserver.local';
  const cptenant = env["CPTENANT"] || 'use-yourowntenant';
  const cpapikey = env["CPAPIKEY"] || null;
  const cpuser = env["CPUSER"] || 'use-yourowntenantuser';
  const cppassword = env["CPPASSWORD"] || 'use-yourowntenantpass';


  const cpCreds = cpapikey ? {
    "api-key": cpapikey
  } : {
    "user": cpuser,
    "password": cppassword
  }

  const urlBase = `https://${cpserver}/${cptenant}/web_api/`;
  const loginUrl = `${urlBase}login`;
  const loginResponse = await fetch(loginUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...cpCreds
    }),
  });

  const loginResponseJson = await loginResponse.json();
  // console.log('loginResponseJson', loginResponseJson);

  const sid = loginResponseJson.sid;
  if (sid) {
    // fetch access rulebase
    const showAccessRulebaseUrl = `${urlBase}show-access-rulebase`;
    const showAccessRulebaseResponse = await fetch(showAccessRulebaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-chkp-sid": sid,
      },
      body: JSON.stringify({
        "name": `${packageName} Network`,
        "show-as-ranges": false,
        "use-object-dictionary": true,
        "details-level": "full",
        "dereference-group-members": true
      }),
    });
    const rulebase = await showAccessRulebaseResponse.json();

    // console.log('rulebase', rulebase);
    if (rulebase.code) {
      console.error('Failed to load rulebase', rulebase.message);
      return null;
    }

    const { objectsByUid, objectsByTypeAndName } = processLoadedRulebase(rulebase);
    return { rulebase, objectsByUid, objectsByTypeAndName };
    // console.log(accessRulebase);
  } else {
    console.error('Failed to login to S1C', cpserver);
  }

  return null;
}

function processLoadedRulebase(rulebase: JSONValue) {

  type RulebaseKey = keyof typeof rulebase;
  const rawObjects: Array<JSONValue> = rulebase["objects-dictionary" as RulebaseKey];

  // organize objects by uid for easier access
  const objectsByUid = rawObjects.reduce(
    (objectDict: { [uid: string]: any }, obj: any) => {
      objectDict[obj.uid] = obj;
      return objectDict;
    },
    {},
  );

  // organize objects by type/name for easier access
  const objectsByTypeAndName = rawObjects.reduce(
    (objectDict: { [key: string]: any }, obj: any) => {
      const key = `${obj.type}/${obj.name}`;
      objectDict[key] = obj;
      return objectDict;
    },
    {},
  );

  return { objectsByUid, objectsByTypeAndName };

}

/**
 * Loads raw rulebase from show access-rulebase API response
 * @param {string} filename
 * @returns { {rulebase: [ any ], objectsByUid: { [uid: string]: any; }} } Parsed raw access rulebase and objects by uid
 */
async function loadCpRulebase(filename: string) {
  try {
    const ruleBaseText = await Deno.readTextFile(filename);

    const rulebase = JSON.parse(ruleBaseText);

    const { objectsByUid, objectsByTypeAndName } = processLoadedRulebase(rulebase);
    return { rulebase, objectsByUid, objectsByTypeAndName };
  } catch (err) {
    console.error("Error loading/parsing rulebase:", err);
  }
  return null;
}

function processAction(actionUid: string, objectsByUid: { [uid: string]: JSONObject }) {
  const action = objectsByUid[actionUid];

  return action.name;
}

function processServiceObject(service: JSONObject, objectsByUid: { [uid: string]: JSONObject }): Services {

  // console.log('# service', service.name, service.type);

  if (service.type === "CpmiAnyObject" && service.name === "Any") return ["*"];
  if (service.type === "service-tcp") return [`${service.port}/Tcp`];
  if (service.type === "service-udp") return [`${service.port}/Udp`];

  if (service.type === "service-group") {
    const members: Array<JSONObject> = service.members as Array<JSONObject>;
    const services = members.map((member) => processServiceObject(member, objectsByUid));
    // console.log('service group', services);
    return services;
  }

  // console.error("Unknown service type", service.type, service.name);
  // console.log('details:', JSON.stringify(service, null, 2));

  return [`service-${service.type}-${service.name}`];

}

function processService(serviceUid: string, objectsByUid: { [uid: string]: JSONObject }): Services {
  const service = objectsByUid[serviceUid];
  return processServiceObject(service, objectsByUid);
  // console.log('service details:', JSON.stringify(service, null, 2));
}

function processNetworkObject(networkObjectId: string, objectsByUid: { [uid: string]: JSONObject }): string {
  const networkObject = objectsByUid[networkObjectId];

  // log
  // console.log('object:', networkObject.name, networkObject.type);
  // if (networkObject.type === "group") {
  //   console.log('group:', networkObject.name);
  // }
  // if (networkObject.name.startsWith(SERVICETAG_PREFIX)) {
  //   console.log('SERVICETAG_PREFIX:', networkObject.name);
  // }

  const objectName: string = networkObject.name as string;
  if (networkObject.type === "group" && objectName.startsWith(SERVICETAG_PREFIX)) {
    // console.log('service tag', networkObject.name.slice(SERVICETAG_PREFIX.length))
    return objectName.slice(SERVICETAG_PREFIX.length);
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
  if (networkObject.type === "group" && objectName.startsWith(NSG_PREFIX)) {
    return "*";
  }

  return `${networkObject.type}_${networkObject.name}`;
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

function nsgsFromObjectUids(objectUids: Array<string>, objectsByUid: { [uid: string]: JSONObject }): Array<string> {
  const nsgNames = unique(
    objectUids
      .map((uid) => objectsByUid[uid]) // get objects by uid
      .filter((o) => o.type === "group" && (o.name as string).startsWith(NSG_PREFIX)) // network group name starts with NSG_
      .map((o) => (o.name as string).slice(4)), // remove NSG_ prefix
  ) as Array<string>;
  return nsgNames;
}

type NSGData = {
  nsg_Direction: NsgDirection
  nsg_Services: Services,
  nsg_SourceAddresses: Array<string>,
  nsg_DestinationAddresses: Array<string>,
  nsg_Action: "Allow" | "Deny",
  nsg_NsgName: string,
  nsg_Description: string,
  nsg_RuleNo: number
}

function processRule(rule: JSONObject, direction: NsgDirection, nsgName: string, objectsByUid: { [uid: string]: JSONObject }) {
  const ruleData: NSGData = {
    nsg_Direction: direction,
    nsg_Services: (rule.service as Array<string>).flatMap((serviceUid: string) => {
      return processService(serviceUid, objectsByUid);
    }),
    nsg_SourceAddresses: (rule.source as Array<string>).map((sourceUid: string) =>
      processNetworkObject(sourceUid, objectsByUid)
    ),
    nsg_DestinationAddresses: (rule.destination as Array<string>).map((destinationUid: string) =>
      processNetworkObject(destinationUid, objectsByUid)
    ),
    nsg_Action: processAction(rule.action as string, objectsByUid) === "Accept" ? "Allow" : "Deny",
    nsg_RuleNo: rule["rule-number"] as number,
    nsg_NsgName: nsgName,
    nsg_Description: rule.name as string
  };


  return ruleData;
}

function unique(array: Array<any>) {
  return Array.from(new Set(array));
}

function uidsIncludeNSG(uids: Array<string>, nsgName: string, objectsByUid: { [uid: string]: JSONObject }) {
  return uids.map((uid) => objectsByUid[uid].name).includes(`NSG_${nsgName}`);
}

function processRules(rulebase: Array<JSONObject>, objectsByUid: { [uid: string]: JSONObject }, objectsByTypeAndName: { [uid: string]: JSONObject }) {
  const rules = flatRules(rulebase);

  // need all sources and all destination UIDs to find NSG names
  const allSources = unique(rules.flatMap((rule) => rule.source));
  const allDestinations = unique(rules.flatMap((rule) => rule.destination));

  // NSG names
  const allSorceNsgs = nsgsFromObjectUids(allSources, objectsByUid);
  const allDestinationNsgs = nsgsFromObjectUids(allDestinations, objectsByUid);
  const allNsgs = unique([...allSorceNsgs, ...allDestinationNsgs]) as Array<string>;

  // RGs for NSGs:
  const rgByNsg: { [name: string]: string } = {};
  for (const nsg of allNsgs) {
    const nsgObj = objectsByTypeAndName[`group/NSG_${nsg}`];
    // console.log('nsgObj tags', nsgObj.tags);
    for (const tag of nsgObj.tags as Array<JSONObject>) {
      // console.log('nsgObj tags', tag.name);
      if ((tag.name as string).startsWith('RG:')) {
        rgByNsg[nsg] = (tag.name as string).slice(3);
      }
    }
  }
  // console.log('nsgObj tags', rgByNsg);

  // process all NGSs into rulebases
  const nsgRulebases = allNsgs.map((nsgName) => {
    // console.log("processing NSG rulebase", nsgName);

    const nsgOutgoingRules = rules
      .filter((rule => rule.enabled))
      .filter((rule) => uidsIncludeNSG(rule.source, nsgName, objectsByUid)) // nsgName in source
      .map((rule) => processRule(rule, "Outbound", nsgName, objectsByUid));

    const nsgIncomingRules = rules
      .filter((rule => rule.enabled))
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
    rgByNsg
  };
}

function printRules(rules: NSGData[]) {
  for (const rule of rules) {
    console.log(
      `${rule.nsg_RuleNo} ${rule.nsg_Direction}: ${JSON.stringify(rule.nsg_SourceAddresses)
      } -> ${JSON.stringify(rule.nsg_DestinationAddresses)} ${JSON.stringify(rule.nsg_Services)
      } ${rule.nsg_Action} // ${rule.nsg_Description}`,
    );
  }
}

async function main() {
  console.log("# cp2nsg\n");

  let rulebaseData = null;
  if (flags.s1c) {
    const packageName = flags.package || "NSG";
    rulebaseData = await loadPolicyFromS1C(packageName);
  } else {
    rulebaseData = await loadCpRulebase(DEMO_FILE);
  }

  if (!rulebaseData) {
    console.error("Failed to load rulebase data");
    return;
  }

  const { rulebase, objectsByUid, objectsByTypeAndName } = rulebaseData!;

  const rules = processRules(rulebase, objectsByUid, objectsByTypeAndName);

  //   for (const [nsgIndex, nsgData] of Object.entries<any>(rules.nsgRulebases)) {
  //     console.log("");
  //     console.log(`${nsgIndex}. ${nsgData.nsgName}`);
  //     //console.log(nsgData);
  //     printRules(nsgData.nsgIncomingRules);
  //     printRules(nsgData.nsgOutgoingRules);
  //   }

  if (flags.print) {
    for (const [nsgIndex, nsgData] of Object.entries<any>(rules.nsgRulebases)) {
      console.log("");
      console.log(`${nsgIndex}. ${nsgData.nsgName}`);
      //console.log(nsgData);
      printRules(nsgData.nsgIncomingRules);
      printRules(nsgData.nsgOutgoingRules);
    }
  } else {
    generateTerraform(rules);
  }
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

function generateTerraformNSGRules(rules: NSGData[], rgByNsg: { [nsgName: string]: string }) {
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

      if (portsByProto.proto !== "undefined") {
        ports = portsByProto.ports;
        proto = portsByProto.proto;
      }
      // console.log('service ports', ports, proto, servicesByProto);

      let destination = `destination_address_prefixes= ${JSON.stringify(rule.nsg_DestinationAddresses)
        }
      `;
      if (rule.nsg_DestinationAddresses.length === 1) {
        destination = `destination_address_prefix= "${rule.nsg_DestinationAddresses[0]}" `;
      }

      let source = `source_address_prefixes     = ${JSON.stringify(rule.nsg_SourceAddresses)
        }
      `;
      if (rule.nsg_SourceAddresses.length === 1) {
        source = `source_address_prefix= "${rule.nsg_SourceAddresses[0]}" `;
      }

      let portSpec = `destination_port_ranges      = ${JSON.stringify(ports)}`;
      if (ports.length === 1) {
        portSpec = `destination_port_range      = ${JSON.stringify(ports[0])}`;
      }

      const rgForNsg = rgByNsg[rule.nsg_NsgName] ? `"${rgByNsg[rule.nsg_NsgName]}\"` : 'azurerm_resource_group.example.name';
      console.log(`// RG for NSG ${rule.nsg_NsgName} is ${rgForNsg}`);
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
            resource_group_name         = ${rgForNsg}
            network_security_group_name = azurerm_network_security_group.${rule.nsg_NsgName}.name

        }
        `);
    }
  }
}

function generateTerraform(rules) {

  const { rgByNsg } = rules;

  // console.log('generateTerraform rgByNsg', rgByNsg);
  console.log(`
    resource "azurerm_resource_group" "example" {
        name     = "nsg-example-resources"
        location = "West Europe"
      }
    `);

  for (const [nsgIndex, nsgData] of Object.entries<any>(rules.nsgRulebases)) {
    console.log("");
    console.log(`# ${nsgIndex}. ${nsgData.nsgName}`);

    const rgForNsg = rgByNsg[nsgData.nsgName] ? `"${rgByNsg[nsgData.nsgName]}\"` : 'azurerm_resource_group.example.name';

    console.log(` 
      resource "azurerm_network_security_group" "${nsgData.nsgName}" {
        name                = "${nsgData.nsgName}"
        location            = azurerm_resource_group.example.location
        resource_group_name = ${rgForNsg}
      }
        `);

    generateTerraformNSGRules(nsgData.nsgIncomingRules, rgByNsg);
    generateTerraformNSGRules(nsgData.nsgOutgoingRules, rgByNsg);
  }
}

await main();
