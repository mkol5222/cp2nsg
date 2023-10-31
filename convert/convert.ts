const DEMO_FILE = "./data/2nsgs-access-rulebase.json";

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
  if (service.type === "service-tcp") return `${service.port}/tcp`;
  if (service.type === "service-udp") return `${service.port}/udp`;
  return service;
}

function processNetworkObject(networkObjectId, objectsByUid) {
  const networkObject = objectsByUid[networkObjectId];

  if (networkObject.type === "CpmiAnyObject" && networkObject.name === "Any") {
    return "*";
  }
  if (networkObject.type === "host") {
    return `${networkObject["ipv4-address"]}/32`;
  }
  if (networkObject.type === "network") {
    return `${networkObject["subnet4"]}/${networkObject["mask-length4"]}`;
  }
  if (networkObject.type === "group" && networkObject.name.startsWith("NSG_")) {
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
      .filter((o) => o.type === "group" && o.name.startsWith("NSG_")) // network group name starts with NSG_
      .map((o) => o.name.slice(4)), // remove NSG_ prefix
  );
}

function processRule(rule, direction, objectsByUid) {
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

  ruleData.nsg_RuleNo = rule["rule-number"] + 100;

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
    console.log("processing NSG rulebase", nsgName);

    const nsgOutgoingRules = rules
      .filter((rule) => uidsIncludeNSG(rule.source, nsgName, objectsByUid)) // nsgName in source
      .map((rule) => processRule(rule, "Outbond", objectsByUid));

    const nsgIncomingRules = rules.filter((rule) => {
      const destinationObjectNames = rule.destination
        .map((destination) => objectsByUid[destination].name);
      // console.log(destinationObjectNames)
      return destinationObjectNames.includes(`NSG_${nsgName}`);
    }).map((rule) => processRule(rule, "Inbound", objectsByUid));

    // for (const rule of [...nsgOutgoingRules, ...nsgIncomingRules]) {
    //     console.log(`${rule.nsg_Direction}: ${JSON.stringify(rule.nsg_Addresses)} ${JSON.stringify(rule.nsg_Services)}`);
    // }

    return { nsgName, nsgOutgoingRules, nsgIncomingRules };
  });

  console.log("Processing done");

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
      } ${rule.nsg_Action}`,
    );
  }
}

async function main() {
  console.log("cp2nsg\n");

  const rulebaseData = await loadCpRulebase(DEMO_FILE);
  if (!rulebaseData) {
    console.error("Failed to load rulebase data");
    return;
  }

  const { rulebase, objectsByUid } = rulebaseData!;

  const rules = processRules(rulebase, objectsByUid);

  for (const [nsgIndex, nsgData] of Object.entries<any>(rules.nsgRulebases)) {
    console.log("");
    console.log(`${nsgIndex}. ${nsgData.nsgName}`);
    //console.log(nsgData);
    printRules(nsgData.nsgIncomingRules);
    printRules(nsgData.nsgOutgoingRules);
  }

  //console.log(rules.nsgRulebases)
}

await main();
