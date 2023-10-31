console.log('cp2nsg');

async function loadCpRulebase() {
    // const ruleBaseText = await Deno.readTextFile("./data/nsg-access-rulebase.json");
    const ruleBaseText = await Deno.readTextFile("./data/2nsgs-access-rulebase.json");
    // console.log(ruleBaseText);

    try {
        const rulebase = JSON.parse(ruleBaseText);
        //console.log(rulebase);
        return rulebase;
    } catch (err) {
        console.error("Error parsing rulebase:", err)
    }
    return null;
}

function processObjects(rulebase) {
    // console.log(rulebase["objects-dictionary"])
    const services = {};


    return {
        services
    }
}

function processAction(actionUid, rawObjectsDict) {
    const action = rawObjectsDict[actionUid]

    return action.name;
}

function processService(serviceUid, rawObjectsDict) {

    const service = rawObjectsDict[serviceUid];

    if (service.type === 'CpmiAnyObject' && service.name === 'Any') return '*';
    if (service.type === 'service-tcp') return `${service.port}/tcp`;
    if (service.type === 'service-udp') return `${service.port}/udp`;
    return service;

}

function processNetworkObject(networkObjectId, rawObjectsDict) {
    const networkObject = rawObjectsDict[networkObjectId];

    if (networkObject.type === 'CpmiAnyObject' && networkObject.name === 'Any') return '*'
    if (networkObject.type === 'host') return `${networkObject["ipv4-address"]}/32`
    if (networkObject.type === 'network') return `${networkObject["subnet4"]}/${networkObject["mask-length4"]}`
    return networkObject
}

function processRules(rulebase, objects) {
    const rawObjects = rulebase["objects-dictionary"];
    // console.log('rawObjects', rawObjects);
    const rawObjectsDict = rawObjects.reduce((acc, obj) => {
        acc[obj.uid] = obj;
        return acc;
    }, {});
    // console.log('rawObjectsDict', rawObjectsDict);

    const rules = rulebase["rulebase"].reduce(
        (acc, rule) => {
            if (rule.type === 'access-section') {
                for (const r of rule.rulebase) {
                    acc.push(r)
                }
            }
            if (rule.type === 'access-rule') acc.push(rule);
            return acc;
        }, []
    )
    // console.log('rules', rules)

    const allSources = Array.from(new Set(
        rules.reduce((acc, rule) => {
            // console.log('rule source', rule.source);
            rule.source.forEach(source => acc.push(source));
            // console.log('acc', acc);
            return acc;
        }, [])
    ));
    // console.log('allSources', allSources);

    const allDestinations = Array.from(new Set(
        rules.reduce((acc, rule) => {
            rule.destination.forEach(destination => acc.push(destination));
            return acc;
        }, [])
    ));
    // console.log('allDestinations', allDestinations);

    const allSorceNsgs = Array.from(new Set(
        allSources.map(source => {
            // console.log('source', source, rawObjectsDict[source]);
            return rawObjectsDict[source];
        })
            .filter(o => o.type === "group" && o.name.startsWith("NSG_"))
            .map(o => o.name.slice(4))
    ));
    // console.log(allSorceNsgs);

    const allDestinationNsgs = Array.from(new Set(
        allDestinations.map(dst => {
            return rawObjectsDict[dst];
        })
            .filter(o => o.type === "group" && o.name.startsWith("NSG_"))
            .map(o => o.name.slice(4))
    ));
    // console.log(allDestinationNsgs);

    const allNsgs = Array.from(new Set([...allSorceNsgs, ...allDestinationNsgs]));
    //console.log(allNsgs);

    for (const rule of rulebase["rulebase"]) {
        // console.log(rule);
    }

    const nsgRulebases = allNsgs.reduce((acc, nsg) => {
        console.log('processing NSG rulebase', nsg)
        const nsgOutgoingRules = rules.filter(rule => {
            const sourceObjectNames = rule.source.map(source => rawObjectsDict[source].name);
            // console.log(sourceObjectNames)
            return sourceObjectNames.includes(`NSG_${nsg}`);
        }).map(rule => {
            rule.nsg_Direction = 'Outbound';
            rule.nsg_Services = rule.service.map(service => {
                return processService(service, rawObjectsDict)
            })
            rule.nsg_Addresses = rule.destination.map(destination => processNetworkObject(destination, rawObjectsDict));
            rule.nsg_Action = processAction(rule.action, rawObjectsDict)
            return rule;
        });

        const nsgIncomingRules = rules.filter(rule => {
            const destinationObjectNames = rule.destination
                .map(destination => rawObjectsDict[destination].name);
            // console.log(destinationObjectNames)
            return destinationObjectNames.includes(`NSG_${nsg}`);
        }).map(rule => {
            rule.nsg_Direction = 'Inbound';
            rule.nsg_Services = rule.service.map(service => {
                return processService(service, rawObjectsDict)
            })
            rule.nsg_Addresses = rule.source.map(source => processNetworkObject(source, rawObjectsDict));
            rule.nsg_Action = processAction(rule.action, rawObjectsDict)
            return rule;
        });

        // for (const rule of [...nsgOutgoingRules, ...nsgIncomingRules]) {
        //     console.log(`${rule.nsg_Direction}: ${JSON.stringify(rule.nsg_Addresses)} ${JSON.stringify(rule.nsg_Services)}`);
        // }

         acc[nsg] =  { nsgOutgoingRules, nsgIncomingRules };
         return acc
    }, {})

    console.log('Processing done');

    return {
        allNsgs,
        nsgRulebases
    }
}

function printRules(rules) {
    for (const rule of rules) {
        console.log(`${rule.nsg_Direction}: ${JSON.stringify(rule.nsg_Addresses)} ${JSON.stringify(rule.nsg_Services)} ${rule.nsg_Action}`);
    }
}

const rulebase = await loadCpRulebase();
// console.log(rulebase);

const objects = processObjects(rulebase);

const rules = processRules(rulebase, objects);
//console.log(rules);


for (const [nsg, nsgData] of Object.entries(rules.nsgRulebases)) {
    console.log('');
    console.log(nsg);
    //console.log(nsgData);
    printRules(nsgData.nsgIncomingRules)
    printRules(nsgData.nsgOutgoingRules)
}

//console.log(rules.nsgRulebases)