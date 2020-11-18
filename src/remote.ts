import yargs from "yargs"
import MQTT from "async-mqtt"
import tradfri, {Action} from "./lib"

const args = yargs
    .usage("Usage: tradfri-remote -n <remote-name>")
    .wrap(yargs.terminalWidth())
    .options({
        "remote-name": {
            type: "string",
            demandOption: true,
            alias: ["name", "n"],
            desc: "Set the friendly name of the remote name"
        },
        "broker-address": {
            type: "string",
            default: "localhost:1883",
            alias: ["a", "broker"],
            desc: "Set the address of the broker"
        },
    }).argv;

const log = (fn: Function, msg: string) => {
    console.log(`${fn.name}(): ${msg}`);
};

const processAction = (client: MQTT.AsyncMqttClient, action: Action) => {
    switch (action) {
        case Action.Toggle:
            log(processAction, "Toggling lights...");
            tradfri.send({
                state: "toggle",
                warmth: 350,
                brightness: 254,
                "friendly-name": "ikea",
                client
            });
            log(processAction, "Lights toggled.");
            break;
        case Action.BrightnessUp:
        case Action.BrightnessDown:
        case Action.Left:
        case Action.Right:
            log(processAction, `Ignoring '${action}'.`);
            break;
    }
};

const main = async () => {
    log(main, "Connecting to the broker...");
    const client = await tradfri.createClient(args["broker-address"]);
    log(main, "Connected.");
    const subTo = args["remote-name"];
    log(main, `Subscribing to '${subTo}'...`);
    await tradfri.subscribe({
        client,
        "friendly-name": subTo,
        subType: "remote",
        callback: (action: Action) => {
            processAction(client, action);
        }
    });
    log(main, "Subscribed.");
    log(main, "Listening for events...");
};


main();
